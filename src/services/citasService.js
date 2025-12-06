// src/services/citasService.js
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "../app/firebase";

/* ---------------------------------- Utils ---------------------------------- */
function pickEventHours(ev) {
  if (!ev) return 0;
  if (typeof ev.hours === "number") return ev.hours;
  if (typeof ev.horas === "number") return ev.horas;
  return 0;
}

async function getEventSafe(eventId) {
  if (!eventId) return null;
  const ref = doc(db, "events", eventId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* ---------------------- Crear cita (idempotente/segura) --------------------- */
// AHORA crea la cita YA CONFIRMADA (sin aprobación de admin)
export async function crearCita({ evento, user }) {
  if (!db) throw new Error("DB no inicializada");
  if (!user?.uid) throw new Error("Usuario no autenticado");
  const eventoId = evento?.id;
  if (!eventoId) throw new Error("Evento inválido");

  // 1) Verifica duplicado (pendiente/confirmada)
  const q = query(
    collection(db, "citas"),
    where("eventoId", "==", eventoId),
    where("userId", "==", user.uid)
  );
  const snap = await getDocs(q);
  const dup = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .find((c) => c.estado !== "cancelada");
  if (dup) {
    throw new Error("Ya tienes una inscripción para este evento.");
  }

  // 2) Crea la cita directamente como CONFIRMADA
  const ref = await addDoc(collection(db, "citas"), {
    eventoId,
    userId: user.uid,
    userEmail: user.email ?? null,
    userName: user.displayName ?? null,
    estado: "confirmada",
    creadoEn: serverTimestamp(),
    confirmadoEn: serverTimestamp(),
    horas: pickEventHours(evento),

    // 👇 NUEVO: campos para asistencia por QR
    asistenciaEntradaAt: null,
    asistenciaSalidaAt: null,
    asistenciaCompleta: false,
    asistenciaEstado: "ninguna", // opcional (ninguna | entrada | completa)
  });

  // 3) Sube contador de inscritos del evento (si existe ese campo)
  try {
    await updateDoc(doc(db, "events", eventoId), {
      registeredStudents: increment(1),
      reservados: increment(1), // compatibilidad legacy
    });
  } catch {
    // ignorar si el evento no tiene esos campos
  }

  return ref.id;
}

/* ----------------------------- Lecturas varias ----------------------------- */
export async function getCitaByEventAndUser(eventId, userId) {
  const q = query(
    collection(db, "citas"),
    where("eventoId", "==", eventId),
    where("userId", "==", userId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const row = snap.docs[0];
  return { id: row.id, ...row.data() };
}

/** Suscripción a citas por evento (ordenadas por creadoEn) */
export const watchCitasByEvento = (eventoId, cb, onError) => {
  // Asegura que tenemos un id válido
  if (!eventoId) {
    onError && onError(new Error("Falta eventoId para listar citas"));
    return () => {};
  }

  const q = query(
    collection(db, "citas"),
    where("eventoId", "==", eventoId),
    orderBy("creadoEn", "desc")
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cb(rows);
    },
    (err) => {
      console.error("watchCitasByEvento error:", err);
      onError && onError(err);
    }
  );
};

/** Suscripción a TODAS las citas del usuario (merge userId/usuarioId) */
export function watchCitasByUser(uid, cb) {
  if (!uid) return () => {};
  const col = collection(db, "citas");
  const q1 = query(col, where("userId", "==", uid));
  const q2 = query(col, where("usuarioId", "==", uid)); // legacy

  let a = [],
    b = [];
  const emit = () => {
    const map = new Map();
    [...a, ...b].forEach((x) => map.set(x.id, x));
    cb(Array.from(map.values()));
  };

  const u1 = onSnapshot(q1, (s) => {
    a = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });
  const u2 = onSnapshot(q2, (s) => {
    b = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    emit();
  });

  return () => {
    u1 && u1();
    u2 && u2();
  };
}

/* ----------------------------- Acciones admin ------------------------------ */
export async function adminConfirmarCita(citaId) {
  await updateDoc(doc(db, "citas", citaId), {
    estado: "confirmada",
    confirmadoEn: serverTimestamp(),
  });
}

export async function adminCancelarCita(citaId) {
  await updateDoc(doc(db, "citas", citaId), {
    estado: "cancelada",
    canceladoEn: serverTimestamp(),
  });
}

/** Borrar todas las citas de un evento (para cascada) */
export async function deleteCitasByEvento(eventoId) {
  const q = query(collection(db, "citas"), where("eventoId", "==", eventoId));
  const s = await getDocs(q);
  if (s.empty) return;
  const batch = writeBatch(db);
  s.forEach((d) => batch.delete(doc(db, "citas", d.id)));
  await batch.commit();
}

/* ---------- Helper opcional para comprobar que el evento existe ----------- */
/** Devuelve true si el evento aún existe (útil para filtrar huérfanas en UI) */
export async function eventoExiste(eventoId) {
  const ev = await getEventSafe(eventoId);
  return !!ev;
}

/* ------------------ NUEVO: registrar asistencia desde QR ------------------- */
/**
 * Lógica de asistencia por QR:
 *  - Primer escaneo => marca ENTRADA
 *  - Segundo escaneo => marca SALIDA y asistenciaCompleta = true
 *  - Tercero+ => lanza error ("ya registrada")
 */
export async function registrarAsistenciaQR({ eventId, userId }) {
  if (!eventId || !userId) {
    throw new Error("Faltan datos de evento o usuario.");
  }

  const cita = await getCitaByEventAndUser(eventId, userId);
  if (!cita) {
    throw new Error("No tienes inscripción en este evento.");
  }

  if (cita.estado === "cancelada") {
    throw new Error("Tu inscripción para este evento está cancelada.");
  }

  const ref = doc(db, "citas", cita.id);

  // 1) No tiene entrada todavía => registramos ENTRADA
  if (!cita.asistenciaEntradaAt) {
    await updateDoc(ref, {
      asistenciaEntradaAt: serverTimestamp(),
      asistenciaEstado: "entrada",
    });

    return { step: "entrada", citaId: cita.id };
  }

  // 2) Tiene entrada pero no salida => registramos SALIDA y completamos
  if (!cita.asistenciaSalidaAt) {
    await updateDoc(ref, {
      asistenciaSalidaAt: serverTimestamp(),
      asistenciaCompleta: true,
      asistenciaEstado: "completa",
    });

    return { step: "salida", citaId: cita.id };
  }

  // 3) Ya tenía entrada y salida
  throw new Error("Ya registraste entrada y salida para este evento.");
}
