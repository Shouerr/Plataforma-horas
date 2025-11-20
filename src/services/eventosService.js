// src/services/eventsService.js
import { db } from "../app/firebase";
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  collection,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  getDoc,
} from "firebase/firestore";

const col = collection(db, "events");

// =====================
// 🔹 ESCUCHAR EVENTOS ACTIVOS
// =====================
export const watchActiveEvents = (cb) => {
  const q = query(col, where("status", "==", "active"), orderBy("date", "asc"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
};

// =====================
// 🔹 ESCUCHAR TODOS LOS EVENTOS
// =====================
export const watchAllEvents = (cb) => {
  const q = query(col, orderBy("date", "desc"));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
};

// helper
const toTs = (v) =>
  v instanceof Date ? Timestamp.fromDate(v) : v || null;

// =====================
// 🔹 CREAR EVENTO NUEVO
// =====================
export const createEvent = async (data, userId = "admin") => {
  const tipoEvento = data.tipoEvento || "servicio";

  const payload = {
    title: data.title?.trim() || "",
    description: data.description?.trim() || "",
    location: data.location?.trim() || "",
    date: toTs(data.date),
    startTime: data.startTime || "",
    endTime: data.endTime || "",
    // total de horas del evento
    hours: Number(data.hours || 0),
    maxSpots: Number(data.maxSpots || 0),
    registeredStudents: 0,
    status: data.status || "active",
    createdAt: serverTimestamp(),
    createdBy: userId,

    // nuevo: modelado por tipo
    tipoEvento, // "servicio" | "cocina" | "mixto"
    horasServicioEvento: Number(data.horasServicioEvento || 0),
    horasCocinaEvento: Number(data.horasCocinaEvento || 0),
  };

  return await addDoc(col, payload);
};

// =====================
// 🔹 ACTUALIZAR EVENTO
// =====================
export const updateEvent = async (id, data) => {
  const ref = doc(db, "events", id);
  const payload = { ...data };
  delete payload.id;
  await updateDoc(ref, payload);
};

// =====================
// 🔹 ELIMINAR EVENTO
// =====================
export const deleteEvent = async (id) => {
  const ref = doc(db, "events", id);
  await deleteDoc(ref);
};

// =====================
// 🔹 OBTENER EVENTO POR ID
// =====================
export const getEventById = async (id) => {
  const ref = doc(db, "events", id);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const watchEventoById = (id, cb) => {
  if (!id) return () => {};
  const ref = doc(db, "events", id);
  return onSnapshot(ref, (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
};
