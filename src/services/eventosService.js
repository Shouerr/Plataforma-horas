import { collection, getDoc, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../app/firebase";

const col = collection(db, "eventos");

export const watchEventos = (cb) => {
    const q = query(col, orderBy("fechaInicio", "desc"));
    return onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cb(data);
    });
};

export const crearEvento = async (data, userId) => {
    const payload = normalizeToFirestore(data);
    payload.creadoEn = serverTimestamp();
    payload.creadoPor = userId || "admin";
    return addDoc(col, payload);
};

export const actualizarEvento = async (id, data) => {
    const ref = doc(db, "eventos", id);
    return updateDoc(ref, normalizeToFirestore(data));
};

export const eliminarEvento = async (id) => {
    const ref = doc(db, "eventos", id);
      await deleteDoc(ref);
};

// --- detalle de evento ---
export const watchEventoById = (id, cb) => {
  const ref = doc(db, "eventos", id);
  return onSnapshot(ref, (snap) => cb(snap.exists() ? ({ id: snap.id, ...snap.data() }) : null));
};

export const getEventoById = async (id) => {
  const ref = doc(db, "eventos", id);
  const snap = await getDoc(ref);
  return snap.exists() ? ({ id: snap.id, ...snap.data() }) : null;
};

//helpers
const normalizeToFirestore = (e) => ({
    titulo: e.titulo?.trim() || "",
  descripcion: e.descripcion?.trim() || "",
  lugar: e.lugar?.trim() || "",
  estado: e.estado || "activo",
  cupo: Number(e.cupo || 0),
  fechaInicio: toTimestamp(e.fechaInicio),
  fechaFin: toTimestamp(e.fechaFin),
});


const toTimestamp = (v) => {
    if (!v) return null;
  if (v instanceof Date) return Timestamp.fromDate(v);
  if (typeof v === "string") return Timestamp.fromDate(new Date(v));
  return v; // ya es Timestamp
};



