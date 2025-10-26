import { db } from "../app/firebase";
import {
  doc,
  getDoc,
  getDocs,
  runTransaction,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";

/**
 * Crear cita (transaccional)
 * - Verifica cupos
 * - Evita duplicados
 * - Actualiza contador `reservados` del evento
 */
export const crearCita = async ({ evento, user }) => {
  if (!evento?.id) throw new Error("Evento inválido");
  if (!user?.uid) throw new Error("Usuario no autenticado");

  const evRef = doc(db, "eventos", evento.id);
  const citaId = `${evento.id}_${user.uid}`;
  const citaRef = doc(db, "citas", citaId);

  try {
    await runTransaction(db, async (tx) => {
      const evSnap = await tx.get(evRef);
      if (!evSnap.exists()) throw new Error("El evento no existe");

      const ev = evSnap.data();

      // Validaciones de estado y cupos
      if (ev.estado !== "activo") throw new Error("El evento no está activo");
      const reservados = ev.reservados ?? 0;
      if (reservados >= ev.cupo) throw new Error("No hay cupos disponibles");

      // Verificar si ya existe cita
      const citaSnap = await tx.get(citaRef);
      if (citaSnap.exists()) throw new Error("Ya estás inscrito en este evento");

      // Crear nueva cita
      tx.set(citaRef, {
      eventoId: evento.id,
      eventoTitulo: evento.titulo || "Evento sin título",
      eventoInicio: evento.fechaInicio || null,
      userId: user.uid,
      userEmail: user.email || null,
      userName: user.displayName || null,
      estado: "pendiente",
      creadoEn: serverTimestamp(),
});

      // Incrementar contador de reservados
      tx.update(evRef, { reservados: reservados + 1 });
    });
  } catch (err) {
    console.error("Error creando cita:", err);
    // Mensajes más legibles para el usuario
    if (err.message.includes("inscrito"))
      throw new Error("Ya estás inscrito en este evento.");
    if (err.message.includes("cupos"))
      throw new Error("Este evento ya no tiene cupos disponibles.");
    if (err.message.includes("activo"))
      throw new Error("El evento no está disponible actualmente.");
    if (err.message.includes("no existe"))
      throw new Error("El evento no fue encontrado o ha sido eliminado.");

    throw new Error("Error al registrar la cita. Inténtalo nuevamente.");
  }
};

/**
 * Obtener cita específica por evento + usuario
 */
export const getCitaByEventAndUser = async (eventoId, uid) => {
  const ref = doc(db, "citas", `${eventoId}_${uid}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

/**
 * Contar citas activas (pendientes o confirmadas) para un evento
 */
export const countCitasActivas = async (eventoId) => {
  const q = query(
    collection(db, "citas"),
    where("eventoId", "==", eventoId),
    where("estado", "in", ["pendiente", "confirmada"])
  );
  const snap = await getDocs(q);
  return snap.size;
};

/**
 * Escuchar las citas de un usuario en tiempo real
 */
export const watchCitasByUser = (uid, cb) => {
  const q = query(
    collection(db, "citas"),
    where("userId", "==", uid),
    orderBy("creadoEn", "desc")
  );
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    cb(data);
  });
};

/**
 * Cancelar una cita del usuario actual (transaccional)
 */
export const cancelarCita = async (citaId, uid) => {
  if (!citaId || !uid) throw new Error("Datos incompletos para cancelar cita");

  const [eventoId] = citaId.split("_");
  const evRef = doc(db, "eventos", eventoId);
  const citaRef = doc(db, "citas", citaId);

  try {
    await runTransaction(db, async (tx) => {
      // 1) LECTURAS (todas antes de escribir)
      const citaSnap = await tx.get(citaRef);
      if (!citaSnap.exists()) throw new Error("La cita no existe");
      const cita = citaSnap.data();

      if (cita.userId !== uid)
        throw new Error("No tienes permisos para cancelar esta cita");
      if (cita.estado === "cancelada") return; // idempotente

      // Lee el evento ANTES de cualquier write
      const evSnap = await tx.get(evRef);
      const ev = evSnap.exists() ? evSnap.data() : null;
      const reservados = ev ? (ev.reservados ?? 0) : 0;

      // 2) ESCRITURAS (después de todas las lecturas)
      tx.update(citaRef, { estado: "cancelada" });
      if (ev) {
        tx.update(evRef, { reservados: Math.max(0, reservados - 1) });
      }
    });
  } catch (err) {
    console.error("Error al cancelar cita:", err);
    if (err.message.includes("permisos"))
      throw new Error("No puedes cancelar esta cita.");
    if (err.message.includes("no existe"))
      throw new Error("La cita ya no existe.");
    throw new Error("Error al cancelar la cita. Inténtalo nuevamente.");
  }
};

/**
 * Admin: cambiar estado de una cita con ajuste de cupos.
 * Reglas:
 * - pendiente -> confirmada: no cambia reservados (ya se contó al crear)
 * - confirmada -> cancelada: reservados -1
 * - pendiente -> cancelada: reservados -1
 * - cancelada -> pendiente|confirmada: reservados +1 (si hay cupo)
 */
export const adminCambiarEstadoCita = async (citaId, nuevoEstado) => {
  const [eventoId] = citaId.split("_");
  const evRef = doc(db, "eventos", eventoId);
  const citaRef = doc(db, "citas", citaId);

  await runTransaction(db, async (tx) => {
    const citaSnap = await tx.get(citaRef);
    if (!citaSnap.exists()) throw new Error("La cita no existe");
    const cita = citaSnap.data();
    const estadoActual = cita.estado;

    if (estadoActual === nuevoEstado) return; // nada que hacer

    const evSnap = await tx.get(evRef);
    if (!evSnap.exists()) throw new Error("Evento no existe");
    const ev = evSnap.data();
    const cupo = ev.cupo ?? 0;
    const reservados = ev.reservados ?? 0;

    let delta = 0;
    // cancelaciones restan 1 si veníamos de un estado no-cancelado
    if (["pendiente", "confirmada"].includes(estadoActual) && nuevoEstado === "cancelada") {
      delta = -1;
    }
    // reabrir desde cancelada suma 1 (si hay cupo)
    if (estadoActual === "cancelada" && ["pendiente", "confirmada"].includes(nuevoEstado)) {
      if (reservados >= cupo) throw new Error("No hay cupos disponibles");
      delta = +1;
    }

    // aplica delta si corresponde
    if (delta !== 0) {
      const nuevoReservados = reservados + delta;
      if (nuevoReservados < 0 || nuevoReservados > cupo) throw new Error("Cupo inválido");
      tx.update(evRef, { reservados: nuevoReservados });
      // Si prefieres atómico y tienes import increment:
      // tx.update(evRef, { reservados: increment(delta) });
    }

    tx.update(citaRef, { estado: nuevoEstado });
  });
};

export const adminConfirmarCita = (citaId) => adminCambiarEstadoCita(citaId, "confirmada");
export const adminCancelarCita  = (citaId) => adminCambiarEstadoCita(citaId, "cancelada");

/**
 * Listar citas por evento (para admin)
 */
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
