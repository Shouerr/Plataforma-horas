// src/pages/DashboardEstudiante.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card.jsx";
import { Progress } from "../components/ui/progress.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";
import { Calendar, Clock, Timer, MapPin } from "lucide-react";

import {
  collection,
  onSnapshot,
  query,
  where,
  limit,
  getDocs,
  collectionGroup,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../app/firebase.js";

// diagnóstico leve
try {
  console.info("Firestore projectId:", db?.app?.options?.projectId);
} catch {}

/* ============ helpers ============ */
const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());
const lower = (s) => (s || "").toString().trim().toLowerCase();

const getTitulo = (ev) => ev._titulo ?? ev.titulo ?? ev.title ?? "Evento";
const getLugar = (ev) => ev._lugar ?? ev.lugar ?? ev.location ?? "—";
const getFechaInicio = (ev) => ev._fechaInicio ?? ev.fechaInicio ?? ev.date ?? null;
const getFechaFin = (ev) => ev._fechaFin ?? ev.fechaFin ?? null;
const isActive = (ev) =>
  norm(ev.estado) === "activo" || norm(ev.status) === "active";

function formatEventRange(ev) {
  const dateTs = ev.date ?? getFechaInicio(ev);
  const start = ev.startTime;
  const end = ev.endTime;

  if (dateTs && (start || end)) {
    const d = dateTs?.toDate ? dateTs.toDate() : new Date(dateTs);
    const fecha = d.toLocaleDateString("es-CR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const rango = `${start || "—"} - ${end || "—"}`;
    return `${fecha}, ${rango}`;
  }

  const ini = getFechaInicio(ev);
  const fin = getFechaFin(ev);
  if (ini) {
    const di = ini?.toDate ? ini.toDate() : new Date(ini);
    const base = di.toLocaleDateString("es-CR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    if (fin) {
      const fi = fin?.toDate ? fin.toDate() : new Date(fin);
      const rangoHoras = `${di.toLocaleTimeString("es-CR", {
        hour: "2-digit",
        minute: "2-digit",
      })} - ${fi.toLocaleTimeString("es-CR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
      return `${base}, ${rangoHoras}`;
    }
    return base;
  }
  return "—";
}

/* fechas */
function toDateJS(x) {
  if (!x) return null;
  if (x?.toDate) return x.toDate();
  if (x instanceof Date) return x;
  if (typeof x === "string") return new Date(`${x}T00:00:00`);
  return new Date(x);
}
function parseHM(hm) {
  if (!hm) return [0, 0];
  const [H, M] = String(hm)
    .split(":")
    .map((n) => parseInt(n || "0", 10));
  return [isNaN(H) ? 0 : H, isNaN(M) ? 0 : M];
}
function eventStartMs(ev) {
  const base = toDateJS(ev.date ?? ev.fechaInicio);
  if (!base) return 0;
  if (ev.startTime) {
    const [H, M] = parseHM(ev.startTime);
    const d = new Date(base);
    d.setHours(H, M, 0, 0);
    return d.getTime();
  }
  return base.getTime();
}
function eventEndMs(ev) {
  const base = toDateJS(ev.date ?? ev.fechaInicio);
  if (!base) return 0;
  if (ev.endTime) {
    const [H, M] = parseHM(ev.endTime);
    const d = new Date(base);
    d.setHours(H, M, 0, 0);
    return d.getTime();
  }
  if (ev.fechaFin) {
    const fin = toDateJS(ev.fechaFin);
    return fin ? fin.getTime() : 0;
  }
  const d = new Date(base);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
function dayLabel(ev) {
  const start = eventStartMs(ev);
  if (!start) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(start);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.round((d - today) / 86400000);
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Mañana";
  return null;
}

/* fallbacks desde CITA */
function citaStartMs(c) {
  const base = c.fechaInicio ?? c.date ?? null;
  const d = base?.toDate ? base.toDate() : base ? new Date(base) : null;
  if (!d) return 0;
  if (c.startTime) {
    const [H, M] = parseHM(c.startTime);
    d.setHours(H, M, 0, 0);
  }
  return d.getTime();
}
function citaEndMs(c) {
  const base = c.fechaFin ?? c.date ?? null;
  const d = base?.toDate ? base.toDate() : base ? new Date(base) : null;
  if (!d) return 0;
  if (c.endTime) {
    const [H, M] = parseHM(c.endTime);
    d.setHours(H, M, 0, 0);
  } else {
    d.setHours(23, 59, 59, 999);
  }
  return d.getTime();
}
function fmtRangoDesdeCita(c) {
  const ini = c.fechaInicio?.toDate
    ? c.fechaInicio.toDate()
    : c.fechaInicio
    ? new Date(c.fechaInicio)
    : c.date?.toDate
    ? c.date.toDate()
    : c.date
    ? new Date(c.date)
    : null;
  const fin = c.fechaFin?.toDate
    ? c.fechaFin.toDate()
    : c.fechaFin
    ? new Date(c.fechaFin)
    : null;
  if (!ini) return "—";
  const base = ini.toLocaleDateString("es-CR", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (c.startTime || c.endTime)
    return `${base}, ${c.startTime || "—"} - ${c.endTime || "—"}`;
  if (fin) {
    const rango = `${ini.toLocaleTimeString("es-CR", {
      hour: "2-digit",
      minute: "2-digit",
    })} - ${fin.toLocaleTimeString("es-CR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
    return `${base}, ${rango}`;
  }
  return base;
}
const getTituloDesdeCita = (c) =>
  c.eventoTitulo || c.eventTitle || c.titulo || c.title || "Evento";
const getLugarDesdeCita = (c) =>
  c.lugar || c.location || c.sede || "—";

/* UI / negocio */
const getCupo = (ev) =>
  typeof ev.cupo === "number"
    ? ev.cupo
    : typeof ev.maxSpots === "number"
    ? ev.maxSpots
    : typeof ev.aforo === "number"
    ? ev.aforo
    : null;
const getReservados = (ev) =>
  typeof ev.reservados === "number"
    ? ev.reservados
    : typeof ev.registered === "number"
    ? ev.registered
    : typeof ev.registeredStudents === "number"
    ? ev.registeredStudents
    : null;
const getDuracionHoras = (ev) => {
  if (typeof ev.horas === "number") return ev.horas;
  if (typeof ev.hours === "number") return ev.hours;
  const a = eventStartMs(ev),
    b = eventEndMs(ev);
  return a && b && b > a
    ? Math.round(((b - a) / 36e5) * 10) / 10
    : null;
};
const estadoEventoPill = ({ yaInscrito, cupo, reservados }) => {
  if (yaInscrito)
    return {
      label: "Registrado",
      cls: "bg-green-50 text-green-700 border-green-400",
    };
  if (
    typeof cupo === "number" &&
    typeof reservados === "number" &&
    reservados >= cupo
  )
    return {
      label: "Lleno",
      cls: "bg-red-50 text-red-700 border-red-400",
    };
  return {
    label: "Disponible",
    cls: "bg-gray-50 text-gray-700 border-gray-300",
  };
};
const pickEventoIdFromCita = (c) =>
  c.eventoId ?? c.eventId ?? c.idEvento ?? c.event ?? c.eventRef ?? null;
const belongsToMe = (c, uid, email) => {
  const byUid =
    c.userId === uid ||
    c.usuarioId === uid ||
    c.uid === uid ||
    c?.user?.uid === uid ||
    c?.usuario?.uid === uid;
  const e = lower(email);
  const byEmail =
    !!e &&
    (lower(c.userEmail) === e ||
      lower(c.email) === e ||
      lower(c.correo) === e ||
      lower(c?.user?.email) === e ||
      lower(c?.usuario?.email) === e);
  return byUid || byEmail;
};

/* ============ componente ============ */
export default function DashboardEstudiante() {
  const { user: currentUser } = useAuth();
  const [allEvents, setAllEvents] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [horasServicio, setHorasServicio] = useState(0);
  const [horasCocina, setHorasCocina] = useState(0);
  const [citasConfirmadas, setCitasConfirmadas] = useState([]);
  const [citasAgenda, setCitasAgenda] = useState([]); // confirmadas + pendientes
  const [misCitas, setMisCitas] = useState([]);
  const [inscritoSet, setInscritoSet] = useState(() => new Set()); // refuerzo vía collectionGroup

  const [carrera, setCarrera] = useState("");
  const [metaServicio, setMetaServicio] = useState(0);
  const [metaCocina, setMetaCocina] = useState(0);

  const nav = useNavigate();

  const totalHoras = useMemo(
    () => Number((horasServicio + horasCocina).toFixed(2)),
    [horasServicio, horasCocina]
  );
  const metaTotal = useMemo(() => {
    const m = metaServicio + metaCocina;
    return m > 0 ? m : 200; // fallback
  }, [metaServicio, metaCocina]);
  const porcentajeTotal = useMemo(() => {
    if (!metaTotal) return 0;
    return Math.min(100, Math.round((totalHoras / metaTotal) * 100));
  }, [totalHoras, metaTotal]);

  /* Cargar carrera del estudiante y metas */
  useEffect(() => {
    if (!currentUser?.uid || !db) return;
    const ref = doc(db, "users", currentUser.uid);
    getDoc(ref)
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};
        const carreraRaw =
          (data.carrera ||
            data.career ||
            data.programa ||
            data.plan ||
            "") + "";
        const c = carreraRaw.toLowerCase();
        setCarrera(carreraRaw);

        if (c.includes("hotel")) {
          // Hotelería: 150 servicio, 50 cocina
          setMetaServicio(150);
          setMetaCocina(50);
        } else if (c.includes("gastr")) {
          // Gastronomía: 150 cocina, 50 servicio
          setMetaServicio(50);
          setMetaCocina(150);
        } else {
          // Desconocido: meta total 200 repartida 100/100
          setMetaServicio(100);
          setMetaCocina(100);
        }
      })
      .catch((e) => {
        console.warn("[DashboardEstudiante] Error cargando usuario:", e);
      });
  }, [currentUser]);

  /* EVENTOS activos */
  useEffect(() => {
    const colRef = collection(db, "events");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllEvents(arr);
        const activos = arr.filter(isActive);
        const seen = new Set();
        const unicos = activos.filter((ev) =>
          seen.has(ev.id) ? false : (seen.add(ev.id), true)
        );
        setEventos(unicos);
        setLoading(false);
      },
      (err) => {
        console.error("[DashboardEstudiante] eventos ERROR:", err?.message);
        setLoading(false);
      }
    );
    return () => unsub && unsub();
  }, []);

  /* MIS CITAS (muchos listeners + fallback) */
  useEffect(() => {
    const uid = currentUser?.uid || "";
    const mail = (currentUser?.email || "").trim();
    if (!db || (!uid && !mail)) return;

    const col = collection(db, "citas");
    const qs = [
      query(col, where("userId", "==", uid)),
      query(col, where("usuarioId", "==", uid)),
      query(col, where("uid", "==", uid)),
      query(col, where("user.uid", "==", uid)),
      query(col, where("usuario.uid", "==", uid)),
      ...(mail
        ? [
            query(col, where("email", "==", mail)),
            query(col, where("userEmail", "==", mail)),
            query(col, where("correo", "==", mail)),
          ]
        : []),
    ];

    const parts = Array.from({ length: qs.length + 1 }, () => []);
    const mergeById = (lists) => {
      const m = new Map();
      for (const arr of lists) for (const d of arr) m.set(d.id, d);
      return Array.from(m.values());
    };

    const recompute = () => {
      const rows = mergeById(parts);
      setMisCitas(rows);

      const confirmadas = rows.filter(
        (c) => (c.estado || "").toLowerCase() === "confirmada"
      );
      setCitasConfirmadas(confirmadas);

      const agenda = rows.filter((c) =>
        ["confirmada", "pendiente"].includes((c.estado || "").toLowerCase())
      );
      setCitasAgenda(agenda);

      // ---- cálculo de horas servicio / cocina por evento ----
      let totalServ = 0;
      let totalCoc = 0;

      for (const c of confirmadas) {
        // total horas de la cita
        let totalCita = null;
        if (typeof c.horas === "number") totalCita = c.horas;
        else if (typeof c.hours === "number") totalCita = c.hours;
        else {
          const ini = c.fechaInicio?.toDate
            ? c.fechaInicio.toDate()
            : c.fechaInicio
            ? new Date(c.fechaInicio)
            : null;
          const fin = c.fechaFin?.toDate
            ? c.fechaFin.toDate()
            : c.fechaFin
            ? new Date(c.fechaFin)
            : null;
          if (ini && fin) totalCita = Math.max(0, (fin - ini) / 36e5);
        }
        if (totalCita == null) continue;

        const evId = pickEventoIdFromCita(c);
        const ev = evId ? allEvents.find((e) => e.id === evId) : null;
        const tipo = (ev?.tipoEvento || "servicio").toString().toLowerCase();
        const hsEv =
          typeof ev?.horasServicioEvento === "number"
            ? ev.horasServicioEvento
            : 0;
        const hcEv =
          typeof ev?.horasCocinaEvento === "number"
            ? ev.horasCocinaEvento
            : 0;

        if (tipo === "mixto") {
          // usamos la distribución del evento
          totalServ += hsEv || 0;
          totalCoc += hcEv || 0;
        } else if (tipo === "cocina") {
          totalCoc += totalCita;
        } else {
          // servicio por defecto
          totalServ += totalCita;
        }
      }

      setHorasServicio(Number(totalServ.toFixed(2)));
      setHorasCocina(Number(totalCoc.toFixed(2)));
    };

    const unsubs = qs.map((q, i) =>
      onSnapshot(
        q,
        (s) => {
          parts[i] = s.docs.map((d) => ({ id: d.id, ...d.data() }));
          recompute();
        },
        (err) => console.error("[MisCitas listener]", err?.message)
      )
    );

    const qAll = query(col, limit(200));
    const uAll = onSnapshot(
      qAll,
      (s) => {
        const todos = s.docs.map((d) => ({ id: d.id, ...d.data() }));
        parts[qs.length] = todos.filter((c) =>
          belongsToMe(c, uid, mail)
        );
        recompute();
      },
      (err) => console.error("[MisCitas fallback]", err?.message)
    );
    unsubs.push(uAll);

    return () =>
      unsubs.forEach((u) => {
        try {
          u && u();
        } catch {}
      });
  }, [currentUser, allEvents]);

  /* Refuerzo: detectar inscripción vía collectionGroup (por si la cita está anidada) */
  useEffect(() => {
    if (!db) return;
    const ids = allEvents.map((e) => e.id).filter(Boolean);
    if (ids.length === 0) {
      setInscritoSet(new Set());
      return;
    }

    const uid = currentUser?.uid || "";
    const mail = (currentUser?.email || "").trim().toLowerCase();
    if (!uid && !mail) {
      setInscritoSet(new Set());
      return;
    }

    const chunks = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));
    let cancelled = false;
    (async () => {
      const found = new Set();
      for (const chunk of chunks) {
        if (uid) {
          const s1 = await getDocs(
            query(
              collectionGroup(db, "citas"),
              where("eventoId", "in", chunk),
              where("userId", "==", uid)
            )
          ).catch(() => null);
          if (s1) s1.docs.forEach((d) => found.add(d.get("eventoId")));
        }
        if (mail) {
          const s2 = await getDocs(
            query(
              collectionGroup(db, "citas"),
              where("eventoId", "in", chunk),
              where("userEmail", "==", mail)
            )
          ).catch(() => null);
          if (s2) s2.docs.forEach((d) => found.add(d.get("eventoId")));
        }
        if (uid) {
          const s3 = await getDocs(
            query(
              collectionGroup(db, "citas"),
              where("eventId", "in", chunk),
              where("userId", "==", uid)
            )
          ).catch(() => null);
          if (s3) s3.docs.forEach((d) => found.add(d.get("eventId")));
        }
        if (mail) {
          const s4 = await getDocs(
            query(
              collectionGroup(db, "citas"),
              where("eventId", "in", chunk),
              where("userEmail", "==", mail)
            )
          ).catch(() => null);
          if (s4) s4.docs.forEach((d) => found.add(d.get("eventId")));
        }
      }
      if (!cancelled) setInscritoSet(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, allEvents, currentUser]);

  /* Agenda */
  const eventosById = useMemo(
    () => new Map(allEvents.map((e) => [e.id, e])),
    [allEvents]
  );

  const proximasAgenda = useMemo(() => {
    const now = Date.now();
    const filas = citasAgenda.map((c) => {
      const evId = pickEventoIdFromCita(c);
      const ev = evId ? eventosById.get(evId) : null;
      const startMs = ev ? eventStartMs(ev) : citaStartMs(c);
      const endMs = ev ? eventEndMs(ev) : citaEndMs(c);
      return { c, ev, startMs, endMs };
    });
    const upcoming = filas.filter((x) => x.endMs >= now);
    upcoming.sort((a, b) => a.startMs - b.startMs);
    return upcoming;
  }, [citasAgenda, eventosById]);

  const inscritoPorEvento = useMemo(() => {
    const m = new Map();
    for (const c of misCitas) {
      if ((c.estado || "").toLowerCase() === "cancelada") continue;
      const evId = pickEventoIdFromCita(c);
      if (evId) m.set(evId, true);
    }
    for (const evId of inscritoSet) m.set(evId, true);
    return m;
  }, [misCitas, inscritoSet]);

  const misEventos = useMemo(
    () => eventos.filter((ev) => inscritoPorEvento.get(ev.id)),
    [eventos, inscritoPorEvento]
  );

  if (loading) {
    return (
      <div className="grid place-items-center min-h-[60vh] text-muted-foreground">
        Cargando información...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-background text-foreground min-h-screen">
      {/* Encabezado */}
      <section>
        <h1 className="text-3xl font-bold mb-1">¡Hola, Estudiante!</h1>
        <p className="text-muted-foreground">
          Gestiona tus actividades y controla tu progreso académico
          {carrera ? ` (${carrera})` : ""}
        </p>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Horas Completadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalHoras.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground mb-2">
              de {metaTotal} horas requeridas
            </p>
            <Progress value={porcentajeTotal} className="h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Eventos Registrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{misEventos.length}</p>
            <p className="text-xs text-muted-foreground">
              eventos en los que estás inscrito
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Horas Servicio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{horasServicio.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">
              meta: {metaServicio || "-"}h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Horas Cocina</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{horasCocina.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">
              meta: {metaCocina || "-"}h
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Mis eventos */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Mis eventos</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Listado de eventos en los que estás inscrito actualmente
        </p>

        {misEventos.length === 0 ? (
          <p className="text-muted-foreground">
            Aún no estás inscrito en ningún evento.
          </p>
        ) : (
          <div className="space-y-4">
            {misEventos.map((ev) => {
              const etiqueta = dayLabel(ev);
              const cupo = getCupo(ev);
              const reservados = getReservados(ev);
              const dur = getDuracionHoras(ev);

              return (
                <Card key={ev.id} className="rounded-xl border bg-muted/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">
                          {getTitulo(ev)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {ev.descripcion ||
                            ev.description ||
                            "Evento inscrito"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {etiqueta && (
                          <Badge
                            variant="outline"
                            className="rounded-full text-blue-600 border-blue-400"
                          >
                            {etiqueta}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="rounded-full text-green-700 border-green-400 bg-green-50"
                        >
                          Registrado
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatEventRange(ev)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{getLugar(ev)}</span>
                        </div>
                        {typeof reservados === "number" &&
                          typeof cupo === "number" && (
                            <div className="flex items-center gap-2">
                              <span className="inline-block rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">
                                {reservados}/{cupo} cupos ocupados
                              </span>
                            </div>
                          )}
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground md:min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {ev.startTime && ev.endTime
                              ? `${ev.startTime} - ${ev.endTime}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4" />
                          <span>{dur ? `${dur} horas` : "— horas"}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Eventos disponibles */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Eventos Disponibles</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Regístrate en las actividades que te interesen
        </p>

        {eventos.length === 0 ? (
          <p className="text-muted-foreground">No hay eventos activos.</p>
        ) : (
          <div className="space-y-4">
            {eventos.map((ev) => {
              const yaInscrito = inscritoPorEvento.get(ev.id) === true;
              const etiqueta = dayLabel(ev);
              const cupo = getCupo(ev);
              const reservados = getReservados(ev);
              const dur = getDuracionHoras(ev);
              const { label: pillLabel, cls: pillCls } = estadoEventoPill({
                yaInscrito,
                cupo,
                reservados,
              });

              return (
                <Card key={ev.id} className="rounded-xl">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <CardTitle className="text-base">
                          {getTitulo(ev)}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {ev.descripcion || ev.description || " "}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {etiqueta && (
                          <Badge
                            variant="outline"
                            className="rounded-full text-blue-600 border-blue-400"
                          >
                            {etiqueta}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`rounded-full ${pillCls}`}
                        >
                          {pillLabel}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>{formatEventRange(ev)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          <span>{getLugar(ev)}</span>
                        </div>
                        {typeof reservados === "number" &&
                          typeof cupo === "number" && (
                            <div className="flex items-center gap-2">
                              <span className="inline-block rounded-full bg-gray-100 text-gray-700 px-2 py-0.5 text-xs">
                                {reservados}/{cupo} cupos ocupados
                              </span>
                            </div>
                          )}
                      </div>

                      <div className="space-y-2 text-sm text-muted-foreground md:min-w-[200px]">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>
                            {ev.startTime && ev.endTime
                              ? `${ev.startTime} - ${ev.endTime}`
                              : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4" />
                          <span>{dur ? `${dur} horas` : "— horas"}</span>
                        </div>
                      </div>

                      <div className="md:text-right mt-3 md:mt-0">
                        {yaInscrito ? (
                          <Badge
                            variant="outline"
                            className="rounded-md text-green-700 border-green-400"
                          >
                            Ya estás inscrito
                          </Badge>
                        ) : typeof cupo === "number" &&
                          typeof reservados === "number" &&
                          reservados >= cupo ? (
                          <Badge
                            variant="outline"
                            className="rounded-md text-red-600 border-red-400"
                          >
                            Sin cupos
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            className="mt-2 min-w-[110px]"
                            onClick={() => nav(`/estudiante/evento/${ev.id}`)}
                          >
                            Registrarse
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
