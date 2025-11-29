// src/pages/EventoDetalle.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../context/AuthContext";

import { watchEventoById } from "../services/eventosService";
import { crearCita, getCitaByEventAndUser } from "../services/citasService";

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

// 🔹 NUEVO: descripción amigable de horas/categoría
function getHorasDescripcion(ev) {
  if (!ev) return "";

  const tipo = (ev.tipoEvento || "").toLowerCase();
  const total = ev.hours ?? ev.horas ?? 0;
  const serv = ev.horasServicioEvento ?? 0;
  const coc = ev.horasCocinaEvento ?? 0;

  // si no hay nada configurado, no mostramos nada
  if (!total && !serv && !coc) return "";

  if (tipo === "mixto") {
    return `Horas mixtas: servicio ${serv}h, cocina ${coc}h`;
  }

  if (tipo === "cocina") {
    const valor = coc || total;
    return `Horas: cocina ${valor}h`;
  }

  // servicio o valor por defecto
  const valor = serv || total;
  return `Horas: servicio ${valor}h`;
}

export default function EventoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [evento, setEvento] = useState(null);
  const [loadingEvento, setLoadingEvento] = useState(true);

  const [miCita, setMiCita] = useState(null);
  const [loadingCita, setLoadingCita] = useState(true);

  const yaInscrito = !!miCita && miCita.estado !== "cancelada";

  // 1) Carga del evento
  useEffect(() => {
    if (!id) return;
    const unsub = watchEventoById(id, (data) => {
      setEvento(data);
      setLoadingEvento(false);
    });
    return () => unsub && unsub();
  }, [id]);

  // 2) Carga de mi cita: SOLO si hay user.uid
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
      } catch (e) {
        console.warn("[EventoDetalle] getCitaByEventAndUser:", e?.message);
        if (!cancel) setMiCita(null);
      } finally {
        if (!cancel) setLoadingCita(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [id, user?.uid]);

  const disabled =
    loadingEvento ||
    loadingCita ||
    !evento ||
    yaInscrito ||
    ((evento.maxSpots ?? evento.cupo ?? 0) <=
      (evento.registeredStudents ?? evento.reservados ?? 0));

  async function handleRegistrar() {
    if (!user?.uid || !evento?.id) return;
    if (
      !window.confirm(
        "¿Deseas registrarte en este evento? Tu inscripción quedará confirmada de inmediato."
      )
    )
      return;

    try {
      await crearCita({ evento, user });
      const c = await getCitaByEventAndUser(evento.id, user.uid);
      setMiCita(c);
    } catch (e) {
      console.error("Registrar cita:", e);
      alert(e.message || "No se pudo registrar.");
    }
  }

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

  return (
    <div className="p-8 space-y-6">
      {/* Flecha de volver al panel estudiante */}
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
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

          <div className="pt-2">
            <Button
              variant="secondary"
              disabled={disabled}
              onClick={handleRegistrar}
              className="w-full max-w-xs"
            >
              {loadingCita
                ? "Verificando inscripción…"
                : yaInscrito
                ? "Ya estás inscrito"
                : "Registrarse"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
