import { collection, addDoc, updateDoc,deleteDoc, doc, onSnapshot, query, where, orderBy, getDocs, serverTimestamp } from "firebase/firestore";
 import { db } from "../app/firebase";

 const col = collection(db, "citas");

// Observa citas del usuario en tiempo real */
export const watchCitasByUser = (userId, cb) => {
  const q = query(col, where("userId", "==", userId), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(data);
  });
};

// Verifica si ya está inscrito el usuario en ese evento 
export const getCitaByEventAndUser = async (eventoId, userId) => {
  const q = query(col, where("eventoId", "==", eventoId), where("userId", "==", userId));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
};

// Cuenta inscripciones activas (pendiente/confirmada) del evento 
export const countCitasActivas = async (eventoId) => {
  const q = query(col, where("eventoId", "==", eventoId), where("estado", "in", ["pendiente", "confirmada"]));
  const snap = await getDocs(q);
  return snap.size;
};

// Crea la inscripción con validaciones básicas de front (no atómicas) 
export const crearCita = async ({ evento, user }) => {
  if (!user?.uid) throw new Error("Usuario no autenticado");
  if (!evento?.id) throw new Error("Evento inválido");
  if (evento.estado !== "activo") throw new Error("El evento no está activo");

  // no duplicar
  const ya = await getCitaByEventAndUser(evento.id, user.uid);
  if (ya) throw new Error("Ya estás inscrito en este evento");

  // validar cupo
  const ocupados = await countCitasActivas(evento.id);
  const cupo = Number(evento.cupo || 0);
  if (cupo > 0 && ocupados >= cupo) throw new Error("No hay cupos disponibles");

  // guardar snapshot mínimo del evento para mostrar en MisCitas
  const payload = {
    userId: user.uid,
    eventoId: evento.id,
    estado: "pendiente",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    eventoTitulo: evento.titulo || "",
    eventoInicio: evento.fechaInicio || null,
    eventoFin: evento.fechaFin || null,
    eventoLugar: evento.lugar || "",
  };

  return addDoc(col, payload);
};

export const cancelarCita = async (citaId, userId) => {
  const ref = doc(db, "citas", citaId);
  // por seguridad de UI, solo dejamos cambiar a cancelada
  await updateDoc(ref, { estado: "cancelada", updatedAt: serverTimestamp(), canceladaPor: userId || null });
};

// (opcional) eliminar físicamente una cita del usuario 
export const eliminarCita = async (citaId) => {
  const ref = doc(db, "citas", citaId);
  return deleteDoc(ref);
};