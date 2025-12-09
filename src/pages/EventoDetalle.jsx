// src/pages/EventoDetalle.jsx

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

import { useAuth } from "../context/AuthContext";

import { watchEventoById } from "../services/eventosService";
import { crearCita, getCitaByEventAndUser } from "../services/citasService";

import { db } from "../app/firebase";
import { doc, updateDoc, increment } from "firebase/firestore";

/* ================= Helpers de fecha / horas ================= */

function getEventStartMs(ev) {
  if (!ev) return 0;

  const base = ev.date ?? ev.fechaInicio ?? null;
  if (!base) return 0;

  const d = base.toDate ? base.toDate() : new Date(base);
  const start = ev.startTime || "00:00";
  const [H, M] = String(start)
    .split(":")
    .map((n) => parseInt(n || "0", 10));

  d.setHours(isNaN(H) ? 0 : H, isNaN(M) ? 0 : M, 0, 0);
  return d.getTime();
}

function fmtRange(ev) {
  if (!ev) return "—";
  const d = ev.date ?? ev.fechaInicio ?? null;
  const s = ev.startTime ?? "";
  const e = ev.endTime ?? "";

  if (d?.toDate || d instanceof Date) {
    const dt = d?.toDate ? d.toDate() : d;
    const fecha = dt.toLocaleDateString("es-CR", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    const rango = [s, e].filter(Boolean).join(" - ");
    return rango ? `${fecha}, ${rango}` : fecha;
  }
  return "—";
}

// descripción amigable de horas
function getHorasDescripcion(ev) {
  if (!ev) return "";

  const tipo = (ev.tipoEvento || "").toLowerCase();
  const total = ev.hours ?? ev.horas ?? 0;
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

/* ================= Componente principal ================= */

export default function EventoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [evento, setEvento] = useState(null);
  const [loadingEvento, setLoadingEvento] = useState(true);

  const [miCita, setMiCita] = useState(null);
  const [loadingCita, setLoadingCita] = useState(true);

  const [cancelando, setCancelando] = useState(false);

  const yaInscrito = !!miCita && miCita.estado !== "cancelada";

  /* --------- Cargar evento --------- */
  useEffect(() => {
    if (!id) return;

    const unsub = watchEventoById(id, (data) => {
      setEvento(data);
      setLoadingEvento(false);
    });

    return () => unsub && unsub();
  }, [id]);

  /* --------- Cargar cita del usuario --------- */
  useEffect(() => {
    let cancel = false;

    (async () => {
      setLoadingCita(true);
      try {
        if (user?.uid && id) {
          const cita = await getCitaByEventAndUser(id, user.uid);
          if (!cancel) setMiCita(cita);
        } else {
          if (!cancel) setMiCita(null);
        }
      } catch (err) {
        console.error("Error cargando cita:", err);
        if (!cancel) setMiCita(null);
      } finally {
        if (!cancel) setLoadingCita(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [id, user?.uid]);

  /* --------- Registrar inscripción --------- */
  async function handleRegistrar() {
  if (!user?.uid || !evento?.id) return;

  const ok = window.confirm(
    "¿Deseas registrarte nuevamente en este evento?"
  );
  if (!ok) return;

  try {
    // Si existe una cita cancelada, la reactivamos
    if (miCita && miCita.estado === "cancelada") {
      const citaRef = doc(db, "citas", miCita.id);

      await updateDoc(citaRef, {
        estado: "confirmada",
        reactivadaEn: new Date(),
      });

      // volver a sumar cupo
      await updateDoc(doc(db, "events", evento.id), {
        registeredStudents: increment(1),
      });

      const citaActualizada = {
        ...miCita,
        estado: "confirmada",
      };

      setMiCita(citaActualizada);

      alert("Te has inscrito nuevamente en el evento.");
      return;
    }

    // Caso normal: crear cita
    await crearCita({ evento, user });
    const cita = await getCitaByEventAndUser(evento.id, user.uid);
    setMiCita(cita);

    alert("Inscripción registrada correctamente.");
  } catch (error) {
    console.error("Error al registrar cita:", error);
    alert("No se pudo registrar.");
  }
}

  /* --------- Cancelar inscripción (con sanciones) --------- */
  async function handleCancelar() {
    if (!miCita?.id || !evento?.id || !user?.uid) return;

    const confirmar = window.confirm(
      "¿Deseas cancelar tu inscripción en este evento? Se aplican sanciones si faltan menos de 48 horas para el inicio."
    );
    if (!confirmar) return;

    setCancelando(true);

    try {
      const eventoRef = doc(db, "events", evento.id);
      const citaRef = doc(db, "citas", miCita.id);
      const userRef = doc(db, "users", user.uid);

      // Diferencia en horas hasta el inicio del evento
      const startMs = getEventStartMs(evento);
      const diffHoras = (startMs - Date.now()) / (1000 * 60 * 60);

      // 1. Marcar cita como cancelada (NO borrar)
      await updateDoc(citaRef, {
        estado: "cancelada",
        canceladaEn: new Date(),
      });

      // 2. Restar 1 en el cupo del evento
      await updateDoc(eventoRef, {
        registeredStudents: increment(-1),
      });

      // 3. Si cancela tarde (< 48h), aplicar advertencia + penalización
      if (diffHoras < 48) {
        const updates = {
          warnings: increment(1),
        };

        const tipo = (evento.tipoEvento || "").toLowerCase();

        // Opcional: penalizar horas según categoría
        if (tipo === "servicio") {
          updates.horasServicio = increment(-5);
        } else if (tipo === "cocina") {
          updates.horasCocina = increment(-5);
        } else if (tipo === "mixto") {
          // ejemplo: 3h servicio + 2h cocina = 5h
          updates.horasServicio = increment(-3);
          updates.horasCocina = increment(-2);
        }

        await updateDoc(userRef, updates);
      }

      // 4. Actualizar estado local
      setMiCita((prev) => (prev ? { ...prev, estado: "cancelada" } : null));

      alert("Inscripción cancelada correctamente.");
    } catch (error) {
      console.error("Error al cancelar inscripción:", error);
      alert("No se pudo cancelar la inscripción. Inténtalo de nuevo.");
    } finally {
      setCancelando(false);
    }
  }

  /* ================= Render ================= */

  if (loadingEvento) {
    return (
      <div className="grid place-items-center min-h-[60vh] text-muted-foreground">
        Cargando detalle…
      </div>
    );
  }

  if (!evento) {
    return (
      <div className="grid place-items-center min-h-[60vh] text-muted-foreground">
        Evento no encontrado.
      </div>
    );
  }

  const titulo = evento.titulo ?? evento.title ?? "Evento";
  const lugar = evento.lugar ?? evento.location ?? "—";
  const estado = (evento.estado ?? evento.status ?? "active")
    .toString()
    .toLowerCase();

  const badge =
    estado === "active" || estado === "activo"
      ? { text: "Activo", cls: "text-green-400 border-green-400" }
      : estado === "completed" || estado === "finalizado"
      ? { text: "Completado", cls: "text-yellow-500 border-yellow-500" }
      : { text: "Lleno", cls: "text-red-500 border-red-500" };

  const horasDescripcion = getHorasDescripcion(evento);

  const maxSpots = evento.maxSpots ?? evento.cupo ?? null;
  const registrados = evento.registeredStudents ?? evento.reservados ?? 0;
  const eventoLleno = maxSpots != null && registrados >= maxSpots;

  const disabledRegistrar =
    loadingEvento || loadingCita || !evento || yaInscrito || eventoLleno;

  return (
    <div className="p-8 space-y-6">
      {/* volver */}
      <div
        onClick={() => navigate("/estudiante")}
        className="flex items-center gap-2 text-primary cursor-pointer mb-4 w-fit"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        <span className="font-medium">Volver</span>
      </div>

      <Card>
        <CardHeader className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{titulo}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {evento.descripcion ?? evento.description ?? ""}
            </p>
          </div>
          <Badge variant="outline" className={badge.cls}>
            {badge.text}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Fecha:</strong> {fmtRange(evento)}
          </p>
          <p>
            <strong>Lugar:</strong> {lugar}
          </p>
          {horasDescripcion && <p>{horasDescripcion}</p>}

          <div className="pt-4 space-y-3">
            {!yaInscrito ? (
              <Button
                variant="secondary"
                disabled={disabledRegistrar}
                onClick={handleRegistrar}
                className="w-full max-w-xs"
              >
                {loadingCita ? "Verificando inscripción…" : "Registrarse"}
              </Button>
            ) : (
              <>
                <div className="rounded-md bg-muted text-center py-2 text-sm text-muted-foreground max-w-xs">
                  Ya estás inscrito en este evento.
                </div>
                <Button
                  variant="outline"
                  className="w-full max-w-xs border-red-300 text-red-600 bg-red-200"
                  onClick={handleCancelar}
                  disabled={cancelando}
                >
                  {cancelando ? "Cancelando…" : "Cancelar inscripción"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
