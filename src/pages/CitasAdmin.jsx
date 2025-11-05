// src/pages/CitasAdmin.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  watchCitasByEvento,
  adminConfirmarCita,
  adminCancelarCita,
} from "../services/citasService";
import { watchEventoById } from "../services/eventosService";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import toast from "react-hot-toast";

import { ArrowLeft, Check, X, User2, Mail, Calendar } from "lucide-react";

export default function CitasAdmin() {
  const { eventoId } = useParams();
  const nav = useNavigate();

  const [evento, setEvento] = useState(null);
  const [citas, setCitas] = useState([]);
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(true);

  // Evento (para mostrar título/fecha)
  useEffect(() => {
    if (!eventoId) return;
    const unsub = watchEventoById(eventoId, (ev) => setEvento(ev));
    return () => unsub && unsub();
  }, [eventoId]);

  // Citas del evento
  useEffect(() => {
    if (!eventoId) return;
    const unsub = watchCitasByEvento(eventoId, (rows) => {
      setCitas(rows || []);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [eventoId]);

  const counts = useMemo(() => {
    const total = citas.length;
    const confirmadas = citas.filter((c) => c.estado === "confirmada").length;
    const canceladas = citas.filter((c) => c.estado === "cancelada").length;
    const pendientes = total - confirmadas - canceladas;
    return { total, confirmadas, pendientes, canceladas };
  }, [citas]);

  const confirmar = async (c) => {
    try {
      setBusy(c.id);
      await adminConfirmarCita(c.id);
      toast.success("Cita confirmada ✅");
    } catch (e) {
      toast.error(e?.message || "No se pudo confirmar.");
    } finally {
      setBusy(null);
    }
  };

  const cancelar = async (c) => {
    try {
      setBusy(c.id);
      await adminCancelarCita(c.id);
      toast("Cita cancelada 🗑️");
    } catch (e) {
      toast.error(e?.message || "No se pudo cancelar.");
    } finally {
      setBusy(null);
    }
  };

  const displayUser = (c) => c.userName || c.userEmail || c.userId;

  const estadoBadge = (estado) => {
    if (estado === "confirmada")
      return (
        <Badge
          className="bg-green-500/10 text-green-600 border-green-500"
          variant="outline"
        >
          Confirmada
        </Badge>
      );
    if (estado === "cancelada")
      return (
        <Badge
          className="bg-red-500/10 text-red-600 border-red-500"
          variant="outline"
        >
          Cancelada
        </Badge>
      );
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  const fmtFecha = (tsOrDate, fallback = "—") => {
    if (!tsOrDate) return fallback;
    const d = tsOrDate.toDate ? tsOrDate.toDate() : new Date(tsOrDate);
    if (isNaN(+d)) return fallback;
    return d.toLocaleString("es-CR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" onClick={() => nav(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>

        {/* Resumen rápido */}
        <div className="flex gap-2 text-sm">
          <Badge variant="outline">Total: {counts.total}</Badge>
          <Badge
            className="bg-green-500/10 text-green-600 border-green-500"
            variant="outline"
          >
            Confirmadas: {counts.confirmadas}
          </Badge>
          <Badge variant="secondary">Pendientes: {counts.pendientes}</Badge>
          <Badge
            className="bg-red-500/10 text-red-600 border-red-500"
            variant="outline"
          >
            Canceladas: {counts.canceladas}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-xl">
              {evento?.titulo || evento?.title || "Citas del evento"}
            </CardTitle>
            {evento?.fechaInicio || evento?.date ? (
              <div className="inline-flex items-center text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 mr-2" />
                {evento.dateFormatted
                  ? evento.dateFormatted
                  : fmtFecha(evento.fechaInicio || evento.date, "—")}
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : citas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay citas registradas para este evento.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="py-2 px-3 text-left">Usuario</th>
                    <th className="py-2 px-3 text-left">Estado</th>
                    <th className="py-2 px-3 text-left">Creado</th>
                    <th className="py-2 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {citas.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <User2 className="w-4 h-4 opacity-70" />
                          <span className="font-medium text-foreground">
                            {displayUser(c)}
                          </span>
                          {c.userEmail && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="w-3.5 h-3.5" />
                              {c.userEmail}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">{estadoBadge(c.estado)}</td>
                      <td className="py-3 px-3">{fmtFecha(c.creadoEn)}</td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2 justify-end">
                          {c.estado !== "confirmada" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === c.id}
                              onClick={() => confirmar(c)}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              {busy === c.id ? "…" : "Confirmar"}
                            </Button>
                          )}
                          {c.estado !== "cancelada" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600"
                              disabled={busy === c.id}
                              onClick={() => cancelar(c)}
                            >
                              <X className="w-4 h-4 mr-2" />
                              {busy === c.id ? "…" : "Cancelar"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
