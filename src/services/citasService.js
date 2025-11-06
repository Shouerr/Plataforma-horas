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
  const dup = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    .find((c) => c.estado !== "cancelada");
  if (dup) {
    throw new Error("Ya tienes una inscripción para este evento.");
  }

  // 2) Crea
  const ref = await addDoc(collection(db, "citas"), {
    eventoId,
    userId: user.uid,
    userEmail: user.email ?? null,
    userName: user.displayName ?? null,
    estado: "pendiente",
    creadoEn: serverTimestamp(),
    horas: pickEventHours(evento),
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
export function watchCitasByEvento(eventoId, cb) {
  if (!eventoId) return () => {};
  const q = query(
    collection(db, "citas"),
    where("eventoId", "==", eventoId),
    orderBy("creadoEn", "asc")
  );
  return onSnapshot(
    q,
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => cb([])
  );
}

/** Suscripción a TODAS las citas del usuario (merge userId/usuarioId) */
export function watchCitasByUser(uid, cb) {
  if (!uid) return () => {};
  const col = collection(db, "citas");
  const q1 = query(col, where("userId", "==", uid));
  const q2 = query(col, where("usuarioId", "==", uid)); // legacy

  let a = [], b = [];
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
