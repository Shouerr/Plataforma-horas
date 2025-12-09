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

import { MapPin, Calendar, Clock, Users, BookOpen } from "lucide-react";

import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../app/firebase.js";

/* ====================== Helpers ====================== */

const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());

const getTitulo = (ev) => ev.titulo ?? ev.title ?? "Evento";
const getLugar = (ev) => ev.lugar ?? ev.location ?? "—";

function formatEventRange(ev) {
  const dateTs = ev.date ?? ev.fechaInicio;
  const start = ev.startTime;
  const end = ev.endTime;

  if (!dateTs) return "—";
  const d = dateTs.toDate ? dateTs.toDate() : new Date(dateTs);

  const fecha = d.toLocaleDateString("es-CR", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return `${fecha}, ${start || "—"} - ${end || "—"}`;
}

const pickEventoIdFromCita = (c) =>
  c.eventoId ?? c.eventId ?? c.idEvento ?? c.event ?? c.eventRef ?? null;

const getDuracionHoras = (ev) =>
  typeof ev.hours === "number"
    ? ev.hours
    : typeof ev.horas === "number"
    ? ev.horas
    : null;

// inicio del evento (para ordenar)
function getEventStartMs(ev) {
  const base = ev.date ?? ev.fechaInicio;
  if (!base) return Number.MAX_SAFE_INTEGER;

  const d = base.toDate ? base.toDate() : new Date(base);
  const startTime = ev.startTime || "00:00";

  const [H, M] = String(startTime)
    .split(":")
    .map((n) => parseInt(n || "0", 10));

  d.setHours(isNaN(H) ? 0 : H, isNaN(M) ? 0 : M, 0, 0);
  return d.getTime();
}

function getEventEndMs(ev) {
  const base = ev.date ?? ev.fechaInicio;
  if (!base) return 0;

  const d = base.toDate ? base.toDate() : new Date(base);
  const endTime = ev.endTime || "23:59";

  const [H, M] = String(endTime)
    .split(":")
    .map((n) => parseInt(n || "0", 10));

  d.setHours(isNaN(H) ? 23 : H, isNaN(M) ? 59 : M, 0, 0);
  return d.getTime();
}

function isEventCompletedByTime(ev) {
  const endMs = getEventEndMs(ev);
  if (!endMs) return false;
  return endMs <= Date.now();
}

function getHorasDescripcion(ev) {
  const tipo = (ev.tipoEvento || "").toLowerCase();
  const total = getDuracionHoras(ev) ?? 0;
  const serv = ev.horasServicioEvento ?? 0;
  const coc = ev.horasCocinaEvento ?? 0;

  if (!total && !serv && !coc) return "";

  if (tipo === "mixto") {
    return `Horas mixtas: servicio ${serv}h, cocina ${coc}h`;
  }

  if (tipo === "cocina") {
    const valor = coc || total;
    return `Horas: cocina ${valor}h`;
  }

  const valor = serv || total;
  return `Horas: servicio ${valor}h`;
}

/* =================== Componente =================== */

export default function DashboardEstudiante() {
  const { user: currentUser } = useAuth();
  const nav = useNavigate();

  const [horasServicio, setHorasServicio] = useState(0);
  const [horasCocina, setHorasCocina] = useState(0);

  const [allEvents, setAllEvents] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [misCitas, setMisCitas] = useState([]);

  const [carrera, setCarrera] = useState("");
  const [metaServicio, setMetaServicio] = useState(0);
  const [metaCocina, setMetaCocina] = useState(0);

  const [advertencias, setAdvertencias] = useState(0);

  // NUEVO: penalizaciones por horas y ventana de bloqueo
  const [penaltyServicio, setPenaltyServicio] = useState(0);
  const [penaltyCocina, setPenaltyCocina] = useState(0);
  const [penaltyUntil, setPenaltyUntil] = useState(null);

  const [loading, setLoading] = useState(true);

  /* ------- usuario (carrera, metas, advertencias, penalizaciones) ------- */
  useEffect(() => {
    if (!currentUser?.uid) return;

    const ref = doc(db, "users", currentUser.uid);
    getDoc(ref).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() || {};

      const carreraRaw =
        data.carrera ||
        data.career ||
        data.programa ||
        data.plan ||
        "";

      setCarrera(carreraRaw);

      const cLower = carreraRaw.toLowerCase();
      if (cLower.includes("hotel")) {
        setMetaServicio(150);
        setMetaCocina(50);
      } else if (cLower.includes("gastr")) {
        setMetaServicio(50);
        setMetaCocina(150);
      } else {
        setMetaServicio(100);
        setMetaCocina(100);
      }

      setAdvertencias(data.warnings ?? 0);
      setPenaltyServicio(data.penaltyServicio ?? 0);
      setPenaltyCocina(data.penaltyCocina ?? 0);

      const rawPenUntil = data.penaltyUntil ?? null;
      if (rawPenUntil?.toDate) {
        setPenaltyUntil(rawPenUntil.toDate());
      } else if (rawPenUntil) {
        setPenaltyUntil(new Date(rawPenUntil));
      } else {
        setPenaltyUntil(null);
      }
    });
  }, [currentUser]);

  /* ------- eventos ------- */
  useEffect(() => {
    const colRef = collection(db, "events");

    const unsub = onSnapshot(colRef, (snap) => {
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const decorated = raw.map((ev) => {
        const ended = isEventCompletedByTime(ev);
        let status = norm(ev.status) || norm(ev.estado) || "active";
        if (ended) status = "completed";
        return { ...ev, _status: status };
      });

      setAllEvents(decorated);

      // mostrar todos menos los completados
      const visibles = decorated.filter((ev) => ev._status !== "completed");
      setEventos(visibles);

      setLoading(false);
    });

    return () => unsub && unsub();
  }, []);

  /* ------- citas + horas completadas ------- */
  useEffect(() => {
    if (!currentUser?.uid) return;

    const col = collection(db, "citas");
    const q = query(col, where("userId", "==", currentUser.uid));

    const unsub = onSnapshot(q, (snap) => {
      const citas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMisCitas(citas);

      let serv = 0;
      let coc = 0;
      const now = Date.now();

      for (const c of citas) {
        if (norm(c.estado) !== "confirmada") continue;

        // ⚠️ solo contar horas si la asistencia está completa
        if (!c.asistenciaCompleta) continue;

        const evId = pickEventoIdFromCita(c);
        const ev = allEvents.find((e) => e.id === evId);
        if (!ev) continue;

        const endMs = getEventEndMs(ev);
        if (!endMs || endMs > now) continue;

        const tipo = (ev.tipoEvento || "servicio").toLowerCase();

        if (tipo === "mixto") {
          serv += ev.horasServicioEvento || 0;
          coc += ev.horasCocinaEvento || 0;
        } else if (tipo === "cocina") {
          coc += ev.hours || 0;
        } else {
          serv += ev.hours || 0;
        }
      }

      setHorasServicio(serv);
      setHorasCocina(coc);
    });

    return () => unsub && unsub();
  }, [currentUser, allEvents]);

  /* ------- mapa de eventos donde está inscrito ------- */
  const inscritoPorEvento = useMemo(() => {
    const m = new Map();
    for (const c of misCitas) {
      if (norm(c.estado) !== "cancelada") {
        const evId = pickEventoIdFromCita(c);
        m.set(evId, true);
      }
    }
    return m;
  }, [misCitas]);

  const misEventosList = useMemo(
    () => eventos.filter((ev) => inscritoPorEvento.get(ev.id)),
    [eventos, inscritoPorEvento]
  );

  // eventos ordenados por fecha/hora (para la sección de disponibles)
  const eventosOrdenados = useMemo(() => {
    const copia = [...eventos];
    copia.sort((a, b) => getEventStartMs(a) - getEventStartMs(b));
    return copia;
  }, [eventos]);

  /* ------- totales para tarjetas (aplicando penalizaciones) ------- */
  const horasServicioNet = Math.max(0, horasServicio - penaltyServicio);
  const horasCocinaNet = Math.max(0, horasCocina - penaltyCocina);

  const totalHorasNum = horasServicioNet + horasCocinaNet;
  const totalHoras = totalHorasNum.toFixed(1);
  const metaTotal = metaServicio + metaCocina || 1;

  const pctTotal = Math.min(100, (totalHorasNum / metaTotal) * 100 || 0);
  const pctServ = Math.min(
    100,
    (horasServicioNet / (metaServicio || 1)) * 100 || 0
  );
  const pctCoc = Math.min(
    100,
    (horasCocinaNet / (metaCocina || 1)) * 100 || 0
  );

  // ¿está penalizado actualmente?
  let estaPenalizado = false;
  const now = new Date();
  if (penaltyUntil && penaltyUntil instanceof Date) {
    if (penaltyUntil.getTime() > now.getTime()) {
      estaPenalizado = true;
    }
  }
  // fallback: si no hay fecha guardada pero tiene 3+ advertencias
  if (!estaPenalizado && advertencias >= 3) {
    estaPenalizado = true;
  }

  if (loading) {
    return (
      <div className="grid place-items-center min-h-[60vh] text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <div className="container mx-auto p-6 space-y-6">
        {/* Encabezado */}
        <section>
          <h1 className="text-3xl font-bold mb-1">¡Hola estudiante!</h1>
          <p className="text-muted-foreground">
            Bienvenido a tu panel (Carrera: {carrera?.trim() || "-"})
          </p>
        </section>

        {/* Tarjetas stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {/* Horas totales */}
          <Card className="bg-gradient-primary text-primary-foreground border-0 shadow-elevation-medium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Horas Completadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalHoras}h</p>
              <p className="text-xs opacity-90">
                de {metaTotal} horas requeridas
              </p>
              <Progress value={pctTotal} className="h-2" />
            </CardContent>
          </Card>

          {/* Horas servicio */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Horas Servicio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {horasServicioNet.toFixed(1)}h
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                meta: {metaServicio}h
              </p>
              <Progress value={pctServ} className="h-2" />
            </CardContent>
          </Card>

          {/* Horas cocina */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Horas Cocina</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {horasCocinaNet.toFixed(1)}h
              </p>
              <p className="text-xs text-muted-foreground mb-2">
                meta: {metaCocina}h
              </p>
              <Progress value={pctCoc} className="h-2" />
            </CardContent>
          </Card>

          {/* Eventos registrados */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Eventos Registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {misEventosList.length}
              </p>
              <p className="text-xs text-muted-foreground">
                Total de eventos inscritos
              </p>
            </CardContent>
          </Card>

          {/* Advertencias */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Advertencias</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-yellow-500">
                {advertencias}
              </p>

              {advertencias === 0 && (
                <p className="text-xs text-muted-foreground">
                  Sin advertencias
                </p>
              )}

              {advertencias === 1 && (
                <p className="text-xs text-muted-foreground">
                  Primera advertencia: solo aviso.
                </p>
              )}

              {advertencias === 2 && (
                <p className="text-xs text-muted-foreground">
                  Segunda advertencia: se descontarán{" "}
                  <strong>5 horas</strong> de la categoría correspondiente.
                </p>
              )}

              {advertencias >= 3 && (
                <p className="text-xs text-red-600">
                  Penalizado por 1 semana para nuevos eventos.
                </p>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ---------------- MIS EVENTOS ---------------- */}
        <section>
          <h2 className="text-xl font-semibold mb-2">Mis eventos</h2>
          <p className="text-muted-foreground text-sm mb-3">
            Eventos en los que estás inscrito
          </p>

          {misEventosList.length === 0 ? (
            <p className="text-muted-foreground">
              Aún no estás inscrito en eventos.
            </p>
          ) : (
            <div className="space-y-4">
              {misEventosList.map((ev) => {
                const baseDate = ev.date ?? ev.fechaInicio ?? null;
                let fechaSolo = "—";
                if (baseDate) {
                  const d = baseDate.toDate
                    ? baseDate.toDate()
                    : new Date(baseDate);
                  fechaSolo = d.toISOString().slice(0, 10);
                }
                const rangoHora =
                  ev.startTime && ev.endTime
                    ? `${ev.startTime} - ${ev.endTime}`
                    : "Horario por definir";

                return (
                  <Card
                    key={ev.id}
                    className="rounded-lg border border-border bg-muted/30"
                  >
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="font-semibold text-base text-foreground">
                          {getTitulo(ev)}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {fechaSolo} • {rangoHora}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {getLugar(ev)}
                        </p>

                        <Button
                          variant="outline"
                          size="xss"
                          onClick={() => nav(`/estudiante/evento/${ev.id}`)}
                          className="mt-2 w-fit border-[2px] rounded-md px-3 py-0.5"
                        >
                          Ver detalles
                        </Button>
                      </div>

                      <Badge
                        variant="outline"
                        className="border-green-400 text-green-700 bg-green-400 self-start sm:self-auto"
                      >
                        Confirmado
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* ---------------- EVENTOS DISPONIBLES ---------------- */}
        <section>
          <h2 className="text-xl font-semibold mb-2">Eventos Disponibles</h2>
          <p className="text-muted-foreground text-sm mb-3">
            Regístrate en las actividades que te interesen
          </p>

          {eventosOrdenados.length === 0 ? (
            <p className="text-muted-foreground">No hay eventos activos.</p>
          ) : (
            <div className="space-y-4">
              {eventosOrdenados.map((ev) => {
                const yaInscrito = inscritoPorEvento.get(ev.id) === true;

                const dur = getDuracionHoras(ev);
                const horasDescripcion = getHorasDescripcion(ev);

                const maxSpots = ev.maxSpots ?? ev.cupo ?? null;
                const registrados = ev.registeredStudents ?? ev.reservados ?? 0;
                const eventoLleno =
                  maxSpots != null && registrados >= maxSpots;

                const baseDate = ev.date ?? ev.fechaInicio ?? null;
                let fechaSolo = "—";
                if (baseDate) {
                  const d = baseDate.toDate
                    ? baseDate.toDate()
                    : new Date(baseDate);
                  fechaSolo = d.toISOString().slice(0, 10);
                }

                const rangoHora =
                  ev.startTime && ev.endTime
                    ? `${ev.startTime} - ${ev.endTime}`
                    : "Horario por definir";

                const badgeLabel = yaInscrito
                  ? "Registrado"
                  : eventoLleno
                  ? "Lleno"
                  : "Disponible";

                return (
                  <Card
                    key={ev.id}
                    className="rounded-lg border border-border hover:shadow-md transition-all"
                  >
                    <CardContent className="p-4 space-y-4">
                      {/* Título + descripción + badge */}
                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <h3 className="font-semibold text-lg text-foreground">
                            {getTitulo(ev)}
                          </h3>
                          {ev.description && (
                            <p className="text-muted-foreground text-sm mt-1">
                              {ev.description}
                            </p>
                          )}
                        </div>

                        <Badge
                          variant="outline"
                          className={
                            yaInscrito
                              ? "bg-green-200 text-green-700 border-green-400"
                              : eventoLleno
                              ? "bg-red-600 text-red-100 border-red-700"
                              : "bg-blue-100 text-blue-700 border-blue-400"
                          }
                        >
                          {badgeLabel}
                        </Badge>
                      </div>

                      {/* Grid info */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-2" />
                          {fechaSolo}
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          {rangoHora}
                        </div>
                        <div className="flex items-center">
                          <Users className="w-4 h-4 mr-2" />
                          {getLugar(ev)}
                        </div>
                        <div className="flex items-center">
                          <BookOpen className="w-4 h-4 mr-2" />
                          {horasDescripcion ||
                            (dur ? `${dur} horas` : "Horas por definir")}
                        </div>
                      </div>

                      {/* Cupos + botón */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="text-sm text-muted-foreground">
                          {maxSpots != null
                            ? `${registrados}/${maxSpots} cupos ocupados`
                            : "Cupos no definidos"}
                        </div>

                        {yaInscrito ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-400 text-green-700 bg-green-50 hover:bg-green-100"
                            disabled
                          >
                            Registrado
                          </Button>
                        ) : estaPenalizado ? (
                          <Badge
                            variant="outline"
                            className="text-red-600 border-red-400"
                          >
                            Penalizado (no puede registrarse)
                          </Badge>
                        ) : eventoLleno ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled
                            className="bg-gray-100 text-gray-500 cursor-not-allowed"
                          >
                            Sin cupos
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => nav(`/estudiante/evento/${ev.id}`)}
                          >
                            Registrarse
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
