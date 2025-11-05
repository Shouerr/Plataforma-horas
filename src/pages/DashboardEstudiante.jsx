// src/pages/DashboardEstudiante.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card.jsx";
import { Progress } from "../components/ui/progress.jsx";
import { Badge } from "../components/ui/badge.jsx";
import { Button } from "../components/ui/button.jsx";

import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../app/firebase.js";

const HORAS_OBJETIVO = 60;

/* ====================== helpers ====================== */
const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());
const getTitulo = (ev) => ev._titulo ?? ev.titulo ?? ev.title ?? "Evento";
const getLugar = (ev) => ev._lugar ?? ev.lugar ?? ev.location ?? "—";
const getFechaInicio = (ev) => ev._fechaInicio ?? ev.fechaInicio ?? ev.date ?? null;
const getFechaFin = (ev) => ev._fechaFin ?? ev.fechaFin ?? null;
const isActive = (ev) => norm(ev.estado) === "activo" || norm(ev.status) === "active";

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

/* ====== helpers de fecha ====== */
function toDateJS(tsOrStr) {
  if (!tsOrStr) return null;
  if (tsOrStr?.toDate) return tsOrStr.toDate();
  if (tsOrStr instanceof Date) return tsOrStr;
  if (typeof tsOrStr === "string") return new Date(`${tsOrStr}T00:00:00`);
  return new Date(tsOrStr);
}
function parseHM(hm) {
  if (!hm) return [0, 0];
  const [H, M] = String(hm).split(":").map((n) => parseInt(n || "0", 10));
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

/* ================================== componente ================================== */
export default function DashboardEstudiante() {
  const { currentUser } = useAuth();
  const [allEvents, setAllEvents] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [horasAcumuladas, setHorasAcumuladas] = useState(0);
  const [citasConfirmadas, setCitasConfirmadas] = useState([]);
  const [misCitas, setMisCitas] = useState([]);

  const nav = useNavigate();

  // ========= EVENTOS activos + todos =========
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

  // ========= PROGRESO: citas confirmadas =========
  useEffect(() => {
    const uid = currentUser?.uid || "";
    if (!uid || !db) return;

    const col = collection(db, "citas");
    const q1 = query(col, where("userId", "==", uid), where("estado", "==", "confirmada"));
    const q2 = query(col, where("usuarioId", "==", uid), where("estado", "==", "confirmada"));

    const merge = (arr1, arr2) => {
      const map = new Map();
      [...arr1, ...arr2].forEach((d) => map.set(d.id, d));
      return Array.from(map.values());
    };

    let snap1 = [], snap2 = [];
    const calc = () => {
      const rows = merge(snap1, snap2);
      setCitasConfirmadas(rows);

      let total = 0;
      for (const c of rows) {
        const h =
          typeof c.horas === "number"
            ? c.horas
            : typeof c.hours === "number"
            ? c.hours
            : null;
        if (h != null) {
          total += h;
          continue;
        }
        if (c.fechaInicio && c.fechaFin) {
          const ini = c.fechaInicio?.toDate ? c.fechaInicio.toDate() : new Date(c.fechaInicio);
          const fin = c.fechaFin?.toDate ? c.fechaFin.toDate() : new Date(c.fechaFin);
          total += Math.max(0, (fin - ini) / 36e5);
        }
      }
      setHorasAcumuladas(Number(total.toFixed(2)));
    };

    const u1 = onSnapshot(q1, (s) => {
      snap1 = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      calc();
    });
    const u2 = onSnapshot(q2, (s) => {
      snap2 = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      calc();
    });

    return () => {
      u1 && u1();
      u2 && u2();
    };
  }, [currentUser]);

  // ========= TODAS mis citas =========
  useEffect(() => {
    const uid = currentUser?.uid || "";
    if (!uid || !db) return;

    const col = collection(db, "citas");
    const q1 = query(col, where("userId", "==", uid));
    const q2 = query(col, where("usuarioId", "==", uid));

    const merge = (a, b) => {
      const map = new Map();
      [...a, ...b].forEach((d) => map.set(d.id, d));
      return Array.from(map.values());
    };

    let s1 = [], s2 = [];
    const refresh = () => setMisCitas(merge(s1, s2));

    const u1 = onSnapshot(q1, (s) => {
      s1 = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      refresh();
    });
    const u2 = onSnapshot(q2, (s) => {
      s2 = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      refresh();
    });

    return () => {
      u1 && u1();
      u2 && u2();
    };
  }, [currentUser]);

  /* ========= Confirmados ========= */
  const eventosById = useMemo(() => new Map(allEvents.map((e) => [e.id, e])), [allEvents]);

  const proximasConfirmadas = useMemo(() => {
    const now = Date.now();
    const filas = citasConfirmadas
      .map((c) => ({ cita: c, ev: eventosById.get(c.eventoId) }))
      .filter((x) => !!x.ev);

    const upcoming = filas.filter(({ ev }) => eventEndMs(ev) >= now);
    upcoming.sort((a, b) => eventStartMs(a.ev) - eventStartMs(b.ev));
    return upcoming;
  }, [citasConfirmadas, eventosById]);

  const inscritoPorEvento = useMemo(() => {
    const m = new Map();
    for (const c of misCitas) {
      if (c.estado !== "cancelada") m.set(c.eventoId, true);
    }
    return m;
  }, [misCitas]);

  const porcentaje = useMemo(
    () => Math.min(100, Math.round((horasAcumuladas / HORAS_OBJETIVO) * 100)),
    [horasAcumuladas]
  );

  if (loading) {
    return (
      <div className="grid place-items-center min-h-[60vh] text-muted-foreground">
        Cargando información...
      </div>
    );
  }

  return (
    // 👇 SIN forzar "dark": deja que el theme global controle claro/oscuro
    <div className="p-8 space-y-8 bg-background text-foreground min-h-screen">
      {/* Encabezado */}
      <section>
        <h1 className="text-3xl font-bold mb-1">¡Hola, Estudiante!</h1>
        <p className="text-muted-foreground">
          Gestiona tus actividades y controla tu progreso académico
        </p>
      </section>

      {/* Stats */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Horas Completadas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{horasAcumuladas.toFixed(2)}h</p>
            <p className="text-xs text-muted-foreground">
              de {HORAS_OBJETIVO} horas requeridas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Eventos Registrados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{proximasConfirmadas.length}</p>
            <p className="text-xs text-muted-foreground">próximos eventos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Asistencias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {citasConfirmadas.length}
            </p>
            <p className="text-xs text-muted-foreground">eventos completados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Advertencias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">0</p>
            <p className="text-xs text-muted-foreground">máximo permitido: 2</p>
          </CardContent>
        </Card>
      </section>

      {/* Progreso */}
      <section>
        <Card>
          <CardHeader>
            <CardTitle>Progreso Académico</CardTitle>
            <p className="text-sm text-muted-foreground">
              Tu avance hacia el cumplimiento de las horas de servicio estudiantil
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress value={porcentaje} />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{horasAcumuladas.toFixed(2)} horas</span>
                <span>{HORAS_OBJETIVO} horas</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Próximos eventos confirmados */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Próximos Eventos Confirmados</h2>

        {proximasConfirmadas.length === 0 ? (
          <p className="text-muted-foreground">No tienes eventos confirmados.</p>
        ) : (
          <div className="grid gap-4">
            {proximasConfirmadas.map(({ cita, ev }) => {
              const etiqueta = dayLabel(ev);
              return (
                <Card key={cita.id}>
                  <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {getTitulo(ev)}
                        {etiqueta && (
                          <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-400">
                            {etiqueta}
                          </Badge>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {formatEventRange(ev)}
                      </p>
                      <p className="text-sm text-muted-foreground">{getLugar(ev)}</p>
                    </div>
                    <Badge variant="outline" className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-400">
                      Confirmado
                    </Badge>
                  </CardHeader>
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
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {eventos.map((ev) => {
              const yaInscrito = inscritoPorEvento.get(ev.id) === true;
              const etiqueta = dayLabel(ev);
              return (
                <Card key={ev.id} className="transition hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      {getTitulo(ev)}
                      {etiqueta && (
                        <Badge variant="outline" className="text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-400">
                          {etiqueta}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p>
                      <strong>Fecha:</strong> {formatEventRange(ev)}
                    </p>
                    <p>
                      <strong>Lugar:</strong> {getLugar(ev)}
                    </p>

                    {yaInscrito ? (
                      <Button className="w-full mt-2" disabled>
                        Ya estás inscrito
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        className="w-full mt-2"
                        onClick={() => nav(`/estudiante/evento/${ev.id}`)}
                      >
                        Ver evento
                      </Button>
                    )}
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
