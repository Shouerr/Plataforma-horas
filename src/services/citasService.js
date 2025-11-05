// src/services/citasService.js
import { db } from "../app/firebase";
import {
  doc, getDoc, getDocs, runTransaction, collection,
  query, where, orderBy, onSnapshot, serverTimestamp,
} from "firebase/firestore";

// helpers lectura segura de campos en ambos modelos
const getCupo = (ev) => ev?.cupo ?? ev?.maxSpots ?? 0;
const getReservados = (ev) => ev?.reservados ?? ev?.registeredStudents ?? 0;
const getEstado = (ev) => ev?.estado ?? ev?.status ?? "activo";

export const crearCita = async ({ evento, user }) => {
  if (!evento?.id) throw new Error("Evento inválido");
  if (!user?.uid) throw new Error("Usuario no autenticado");

  // ← colección canónica
  const evRef = doc(db, "events", evento.id);
  const citaId = `${evento.id}_${user.uid}`;
  const citaRef = doc(db, "citas", citaId);

  try {
    await runTransaction(db, async (tx) => {
      const evSnap = await tx.get(evRef);
      if (!evSnap.exists()) throw new Error("El evento no existe");

      const ev = evSnap.data();
      const estado = getEstado(ev);
      if (!(estado === "activo" || estado === "active")) {
        throw new Error("El evento no está activo");
      }

      const cupo = getCupo(ev);
      const reservados = getReservados(ev);
      if (reservados >= cupo) throw new Error("No hay cupos disponibles");

      const citaSnap = await tx.get(citaRef);
      if (citaSnap.exists()) throw new Error("Ya estás inscrito en este evento");

      // ✅ copiar horas del evento
      const horasNum = Number(ev.horas ?? ev.hours ?? 0) || 0;

      tx.set(citaRef, {
        eventoId: evento.id,
        eventoTitulo: ev.titulo || ev.title || "Evento",
        eventoInicio: ev.fechaInicio || ev.date || null,
        // Guarda las horas en la cita
        horas: horasNum,          // ← usado por DashboardEstudiante
        hours: horasNum,          // ← alias por compatibilidad
        userId: user.uid,
        userEmail: user.email || null,
        userName: user.displayName || null,
        estado: "pendiente",
        creadoEn: serverTimestamp(),
      });

      // incrementa reservados en el campo existente
      if (ev.hasOwnProperty("reservados")) {
        tx.update(evRef, { reservados: reservados + 1 });
      } else {
        tx.update(evRef, { registeredStudents: reservados + 1 });
      }
    });
  } catch (err) {
    console.error("Error creando cita:", err);
    if (err.message.includes("inscrito"))  throw new Error("Ya estás inscrito en este evento.");
    if (err.message.includes("cupos"))     throw new Error("Este evento ya no tiene cupos disponibles.");
    if (err.message.includes("activo"))    throw new Error("El evento no está disponible actualmente.");
    if (err.message.includes("no existe")) throw new Error("El evento no fue encontrado o ha sido eliminado.");
    throw new Error("Error al registrar la cita. Inténtalo nuevamente.");
  }
};


export const getCitaByEventAndUser = async (eventoId, uid) => {
  const ref = doc(db, "citas", `${eventoId}_${uid}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const countCitasActivas = async (eventoId) => {
  const q = query(
    collection(db, "citas"),
    where("eventoId", "==", eventoId),
    where("estado", "in", ["pendiente", "confirmada"])
  );
  const snap = await getDocs(q);
  return snap.size;
};

export const watchCitasByUser = (uid, cb) => {
  const q = query(
    collection(db, "citas"),
    where("userId", "==", uid),
    orderBy("creadoEn", "desc")
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    cb(data);
  });
};

export const cancelarCita = async (citaId, uid) => {
  if (!citaId || !uid) throw new Error("Datos incompletos para cancelar cita");
  const [eventoId] = citaId.split("_");
  const evRef = doc(db, "events", eventoId);
  const citaRef = doc(db, "citas", citaId);

  try {
    await runTransaction(db, async (tx) => {
      const citaSnap = await tx.get(citaRef);
      if (!citaSnap.exists()) throw new Error("La cita no existe");
      const cita = citaSnap.data();
      if (cita.userId !== uid) throw new Error("No tienes permisos para cancelar esta cita");
      if (cita.estado === "cancelada") return;

      const evSnap = await tx.get(evRef);
      const ev = evSnap.exists() ? evSnap.data() : null;
      const reservados = getReservados(ev);

      tx.update(citaRef, { estado: "cancelada" });
      if (ev) {
        if (ev.hasOwnProperty("reservados")) {
          tx.update(evRef, { reservados: Math.max(0, reservados - 1) });
        } else {
          tx.update(evRef, { registeredStudents: Math.max(0, reservados - 1) });
        }
      }
    });
  } catch (err) {
    console.error("Error al cancelar cita:", err);
    if (err.message.includes("permisos"))  throw new Error("No puedes cancelar esta cita.");
    if (err.message.includes("no existe")) throw new Error("La cita ya no existe.");
    throw new Error("Error al cancelar la cita. Inténtalo nuevamente.");
  }
};

export const adminCambiarEstadoCita = async (citaId, nuevoEstado) => {
  const [eventoId] = citaId.split("_");
  const evRef = doc(db, "events", eventoId);
  const citaRef = doc(db, "citas", citaId);

  await runTransaction(db, async (tx) => {
    const citaSnap = await tx.get(citaRef);
    if (!citaSnap.exists()) throw new Error("La cita no existe");
    const cita = citaSnap.data();
    const estadoActual = cita.estado;

    if (estadoActual === nuevoEstado) return;

    const evSnap = await tx.get(evRef);
    if (!evSnap.exists()) throw new Error("Evento no existe");
    const ev = evSnap.data();

    const cupo = getCupo(ev);
    const reservados = getReservados(ev);

    let delta = 0;
    if (["pendiente", "confirmada"].includes(estadoActual) && nuevoEstado === "cancelada") delta = -1;
    if (estadoActual === "cancelada" && ["pendiente", "confirmada"].includes(nuevoEstado)) {
      if (reservados >= cupo) throw new Error("No hay cupos disponibles");
      delta = +1;
    }

    if (delta !== 0) {
      const nuevoReservados = reservados + delta;
      if (ev.hasOwnProperty("reservados")) {
        tx.update(evRef, { reservados: nuevoReservados });
      } else {
        tx.update(evRef, { registeredStudents: nuevoReservados });
      }
    }

    tx.update(citaRef, { estado: nuevoEstado });
  });
};

export const adminConfirmarCita = (citaId) => adminCambiarEstadoCita(citaId, "confirmada");
export const adminCancelarCita  = (citaId) => adminCambiarEstadoCita(citaId, "cancelada");

export const watchCitasByEvento = (eventoId, cb) => {
  const q = query(
    collection(db, "citas"),
    where("eventoId", "==", eventoId),
    orderBy("creadoEn", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};
