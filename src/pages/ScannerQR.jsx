// src/pages/ScannerQR.jsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { QrCode, CheckCircle2, AlertCircle } from "lucide-react";

import { registrarAsistenciaQR } from "../services/citasService";
import { getEventById } from "../services/eventosService";

export default function ScannerQR() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const eventId = (searchParams.get("eventId") || "").trim();

  const [eventInfo, setEventInfo] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [status, setStatus] = useState("idle"); // idle | success | error
  const [message, setMessage] = useState("");
  const [step, setStep] = useState(""); // entrada | salida | ""

  const [hasTried, setHasTried] = useState(false);

  // 1) Cargar información básica del evento
  useEffect(() => {
    if (!eventId) {
      setLoadingEvent(false);
      return;
    }

    let cancel = false;
    (async () => {
      try {
        const ev = await getEventById(eventId);
        if (!cancel) {
          setEventInfo(ev);
        }
      } catch (err) {
        console.error("[ScannerQR] getEventById error:", err);
      } finally {
        if (!cancel) setLoadingEvent(false);
      }
    })();

    return () => {
      cancel = true;
    };
  }, [eventId]);

  // 2) Registrar asistencia automáticamente al abrir el link
  useEffect(() => {
    if (!eventId || !user?.uid || hasTried) return;

    setHasTried(true);
    (async () => {
      try {
        const res = await registrarAsistenciaQR({
          eventId,
          userId: user.uid,
        });

        setStep(res.step || "");
        setStatus("success");

        if (res.step === "entrada") {
          setMessage(
            "Entrada registrada correctamente ✅. Recuerda volver a escanear al salir."
          );
        } else if (res.step === "salida") {
          setMessage(
            "Salida registrada ✅. Tus horas se tomarán en cuenta para este evento."
          );
        } else {
          setMessage("Asistencia registrada correctamente.");
        }
      } catch (err) {
        console.error("[ScannerQR] registrarAsistenciaQR error:", err);
        setStatus("error");
        setMessage(
          err?.message ||
            "No se pudo registrar la asistencia con este enlace."
        );
      }
    })();
  }, [eventId, user?.uid, hasTried]);

  // 3) Casos sin eventId o sin usuario
  if (!eventId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Enlace inválido
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Este enlace no contiene un identificador de evento válido.
              Verifica que estés usando el código QR generado por la plataforma.
            </p>
            <Button onClick={() => navigate("/")}>Ir al inicio</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-lg">
              Inicia sesión para registrar tu asistencia
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Debes iniciar sesión con tu usuario de estudiante para que la
              asistencia quede asociada correctamente.
            </p>
            <Button onClick={() => navigate("/login")}>
              Ir a iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const titulo = eventInfo?.title ?? eventInfo?.titulo ?? "Evento";
  const fecha =
    eventInfo?.date?.toDate?.().toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) || "—";

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Registro de asistencia
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Este enlace se abrió desde el código QR del evento.
          </p>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          {loadingEvent ? (
            <p className="text-muted-foreground">Cargando información…</p>
          ) : eventInfo ? (
            <div className="space-y-1">
              <p>
                <strong>Evento:</strong> {titulo}
              </p>
              <p>
                <strong>Fecha:</strong> {fecha}
              </p>
              <p className="text-[11px] text-muted-foreground">
                ID del evento:{" "}
                <span className="font-mono break-all">{eventId}</span>
              </p>
            </div>
          ) : (
            <p className="text-red-600">
              No se encontró información para este evento. Es posible que haya
              sido eliminado.
            </p>
          )}

          {status !== "idle" && (
            <div
              className={`flex items-start gap-2 text-sm rounded-md border px-3 py-2 ${
                status === "success"
                  ? "border-green-500/40 bg-green-500/5 text-green-700"
                  : "border-red-500/40 bg-red-500/5 text-red-700"
              }`}
            >
              {status === "success" ? (
                <CheckCircle2 className="w-4 h-4 mt-[2px]" />
              ) : (
                <AlertCircle className="w-4 h-4 mt-[2px]" />
              )}
              <span>{message}</span>
            </div>
          )}

          {status === "idle" && (
            <p className="text-xs text-muted-foreground">
              Procesando tu asistencia…
            </p>
          )}

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/estudiante")}
            >
              Ir a mi panel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
