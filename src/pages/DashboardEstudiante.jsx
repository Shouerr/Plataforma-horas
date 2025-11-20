// ---------------------------------
// DashboardEstudiante.jsx (FINAL)
// Con soporte de warnings + metas por carrera + mis eventos
// ---------------------------------

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

// ---------------------------------------
// Helpers (todos los que ya estaban)
// ---------------------------------------

const norm = (v) => (v == null ? "" : String(v).trim().toLowerCase());
const lower = (s) => (s || "").toString().trim().toLowerCase();

const getTitulo = (ev) => ev._titulo ?? ev.titulo ?? ev.title ?? "Evento";
const getLugar = (ev) => ev._lugar ?? ev.lugar ?? ev.location ?? "—";

function formatEventRange(ev) {
  const dateTs = ev.date ?? ev.fechaInicio;
  const start = ev.startTime;
  const end = ev.endTime;

  if (dateTs) {
    const d = dateTs.toDate ? dateTs.toDate() : new Date(dateTs);
    const fecha = d.toLocaleDateString("es-CR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    return `${fecha}, ${start || "—"} - ${end || "—"}`;
  }

  return "—";
}

const pickEventoIdFromCita = (c) =>
  c.eventoId ?? c.eventId ?? c.idEvento ?? c.event ?? c.eventRef ?? null;

const getCupo = (ev) =>
  typeof ev.maxSpots === "number" ? ev.maxSpots : ev.cupo ?? null;

const getReservados = (ev) =>
  typeof ev.registeredStudents === "number"
    ? ev.registeredStudents
    : ev.reservados ?? null;

const getDuracionHoras = (ev) =>
  typeof ev.hours === "number"
    ? ev.hours
    : typeof ev.horas === "number"
    ? ev.horas
    : null;

const estadoEventoPill = ({ yaInscrito, cupo, reservados }) => {
  if (yaInscrito)
    return {
      label: "Registrado",
      cls: "bg-green-50 text-green-700 border-green-400",
    };
  if (cupo != null && reservados != null && reservados >= cupo)
    return {
      label: "Lleno",
      cls: "bg-red-50 text-red-700 border-red-400",
    };
  return {
    label: "Disponible",
    cls: "bg-gray-50 text-gray-700 border-gray-300",
  };
};

// ---------------------------------------
// COMPONENTE PRINCIPAL
// ---------------------------------------

export default function DashboardEstudiante() {
  const { user: currentUser } = useAuth(); // ← FIX IMPORTANTE
  const nav = useNavigate();

  // Horas por categoría
  const [horasServicio, setHorasServicio] = useState(0);
  const [horasCocina, setHorasCocina] = useState(0);

  // Eventos y citas
  const [allEvents, setAllEvents] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [misCitas, setMisCitas] = useState([]);
  const [citasConfirmadas, setCitasConfirmadas] = useState([]);
  const [citasAgenda, setCitasAgenda] = useState([]);
  const [inscritoSet, setInscritoSet] = useState(new Set());

  // Carrera + metas
  const [carrera, setCarrera] = useState("");
  const [metaServicio, setMetaServicio] = useState(0);
  const [metaCocina, setMetaCocina] = useState(0);

  // ⚠️ Nuevo estado: advertencias / warnings
  const [advertencias, setAdvertencias] = useState(0);

  const [loading, setLoading] = useState(true);

  const totalHoras = useMemo(
    () => Number((horasServicio + horasCocina).toFixed(2)),
    [horasServicio, horasCocina]
  );
  const metaTotal = useMemo(
    () => (metaServicio + metaCocina > 0 ? metaServicio + metaCocina : 200),
    [metaServicio, metaCocina]
  );
  const porcentajeTotal = useMemo(() => {
    if (!metaTotal) return 0;
    return Math.min(100, Math.round((totalHoras / metaTotal) * 100));
  }, [totalHoras, metaTotal]);

  // ---------------------------------------
  // 1) Cargar carrera + warnings del usuario
  // ---------------------------------------
  useEffect(() => {
    if (!currentUser?.uid || !db) return;

    const ref = doc(db, "users", currentUser.uid);

    getDoc(ref)
      .then((snap) => {
        if (!snap.exists()) return;
        const data = snap.data() || {};

        // Carrera
        const carreraRaw =
          (data.carrera ||
            data.career ||
            data.programa ||
            data.plan ||
            "") + "";
        const c = carreraRaw.toLowerCase();
        setCarrera(carreraRaw);

        // Metas según carrera
        if (c.includes("hotel")) {
          setMetaServicio(150);
          setMetaCocina(50);
        } else if (c.includes("gastr")) {
          setMetaServicio(50);
          setMetaCocina(150);
        } else {
          setMetaServicio(100);
          setMetaCocina(100);
        }

        // ⚠ leer warnings (en inglés)
        setAdvertencias(data.warnings ?? 0);
      })
      .catch((e) => console.warn("Error leyendo usuario:", e));
  }, [currentUser]);

  // ---------------------------------------
  // 2) Cargar eventos
  // ---------------------------------------
  useEffect(() => {
    const colRef = collection(db, "events");
    const unsub = onSnapshot(
      colRef,
      (snap) => {
        const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllEvents(arr);

        const activos = arr.filter(
          (ev) =>
            norm(ev.estado) === "activo" || norm(ev.status) === "active"
        );
        setEventos(activos);

        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub && unsub();
  }, []);

  // ---------------------------------------
  // 3) Cargar mis citas y calcular horas
  // ---------------------------------------
  useEffect(() => {
    if (!currentUser?.uid) return;
    const uid = currentUser.uid;

    const col = collection(db, "citas");
    const q = query(col, where("userId", "==", uid));

    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMisCitas(rows);

      const confirmadas = rows.filter(
        (c) => norm(c.estado) === "confirmada"
      );
      setCitasConfirmadas(confirmadas);

      // horas
      let totalServ = 0;
      let totalCoc = 0;

      for (const c of confirmadas) {
        const evId = pickEventoIdFromCita(c);
        const ev = allEvents.find((e) => e.id === evId);

        if (!ev) continue;

        const tipo = (ev.tipoEvento || "servicio").toLowerCase();

        if (tipo === "mixto") {
          totalServ += ev.horasServicioEvento || 0;
          totalCoc += ev.horasCocinaEvento || 0;
        } else if (tipo === "cocina") {
          totalCoc += ev.hours || 0;
        } else {
          totalServ += ev.hours || 0;
        }
      }

      setHorasServicio(totalServ);
      setHorasCocina(totalCoc);

      setCitasAgenda(
        rows.filter((c) =>
          ["confirmada", "pendiente"].includes(norm(c.estado))
        )
      );
    });

    return () => unsub && unsub();
  }, [currentUser, allEvents]);

  // ---------------------------------------
  // 4) Determinar mis eventos
  // ---------------------------------------
  const inscritoPorEvento = useMemo(() => {
    const m = new Map();
    for (const c of misCitas) {
      if (norm(c.estado) !== "cancelada") {
        const evId = pickEventoIdFromCita(c);
        if (evId) m.set(evId, true);
      }
    }
    return m;
  }, [misCitas]);

  const misEventos = useMemo(
    () => eventos.filter((ev) => inscritoPorEvento.get(ev.id)),
    [eventos, inscritoPorEvento]
  );

  // ---------------------------------------
  // RENDER
  // ---------------------------------------

  if (loading) {
    return (
      <div className="grid place-items-center min-h-[70vh] text-muted-foreground">
        Cargando información...
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-background text-foreground min-h-screen">

      {/* Header */}
      <section>
        <h1 className="text-3xl font-bold mb-1">¡Hola estudiante!</h1>
        <p className="text-muted-foreground">
          Bienvenido a tu panel (Carrera: {carrera || "-"})
        </p>
      </section>

      {/* ---------------------------------------
         SECCIÓN DE STATS (AQUÍ AGREGAMOS WARNINGS)
      ---------------------------------------- */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

        {/* Total horas */}
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

        {/* Eventos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              Eventos Registrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{misEventos.length}</p>
            <p className="text-xs text-muted-foreground">
              Total de eventos inscritos
            </p>
          </CardContent>
        </Card>

        {/* Horas Servicio */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Horas Servicio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{horasServicio.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">
              meta: {metaServicio}h
            </p>
          </CardContent>
        </Card>

        {/* Horas Cocina */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Horas Cocina</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{horasCocina.toFixed(1)}h</p>
            <p className="text-xs text-muted-foreground">
              meta: {metaCocina}h
            </p>
          </CardContent>
        </Card>

        {/* ⚠️ NUEVA TARJETA: ADVERTENCIAS */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Advertencias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{advertencias}</p>

            {advertencias === 0 && (
              <p className="text-xs text-muted-foreground">Sin advertencias</p>
            )}

            {advertencias === 1 && (
              <p className="text-xs text-muted-foreground">
                Primera advertencia: solo aviso.
              </p>
            )}

            {advertencias === 2 && (
              <p className="text-xs text-muted-foreground">
                Se descontarán <strong>5 horas</strong> de la categoría
                correspondiente.
              </p>
            )}

            {advertencias >= 3 && (
              <p className="text-xs text-red-600">
                Penalizado por 1 semana: no puedes inscribirte a eventos.
              </p>
            )}
          </CardContent>
        </Card>

      </section>

      {/* MIS EVENTOS */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Mis eventos</h2>
        <p className="text-muted-foreground text-sm mb-3">
          Eventos en los que estás inscrito
        </p>

        {misEventos.length === 0 ? (
          <p className="text-muted-foreground">Aún no estás inscrito en eventos.</p>
        ) : (
          <div className="space-y-4">
            {misEventos.map((ev) => {
              const etiqueta = null;
              return (
                <Card key={ev.id} className="rounded-xl border bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {getTitulo(ev)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {formatEventRange(ev)}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 mt-2">
                      <MapPin className="w-4 h-4" /> {getLugar(ev)}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* EVENTOS DISPONIBLES */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Eventos Disponibles</h2>

        {eventos.length === 0 ? (
          <p className="text-muted-foreground">No hay eventos activos.</p>
        ) : (
          <div className="space-y-4">
            {eventos.map((ev) => {
              const yaInscrito = inscritoPorEvento.get(ev.id) === true;

              const cupo = getCupo(ev);
              const reservados = getReservados(ev);
              const dur = getDuracionHoras(ev);

              const pill = estadoEventoPill({
                yaInscrito,
                cupo,
                reservados,
              });

              return (
                <Card key={ev.id} className="rounded-xl">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {getTitulo(ev)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-2">
                      {formatEventRange(ev)}
                    </p>

                    {dur && (
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <Timer className="w-4 h-4" />
                        {dur} horas
                      </p>
                    )}

                    {yaInscrito ? (
                      <Badge
                        variant="outline"
                        className="mt-4 text-green-700 border-green-400"
                      >
                        Ya inscrito
                      </Badge>
                    ) : advertencias >= 3 ? (
                      <Badge
                        variant="outline"
                        className="mt-4 text-red-600 border-red-400"
                      >
                        Penalizado (1 semana)
                      </Badge>
                    ) : (
                      <Button
                        className="mt-4"
                        onClick={() => nav(`/estudiante/evento/${ev.id}`)}
                      >
                        Registrarse
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
