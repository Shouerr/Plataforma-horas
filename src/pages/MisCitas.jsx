// src/pages/MisCitas.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { watchCitasByUser } from "../services/citasService";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

export default function MisCitas() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = watchCitasByUser(user.uid, setRows);
    return () => unsub && unsub();
  }, [user?.uid]);

  if (!user || role !== "estudiante") return null;

  const horasTotales = useMemo(() => {
    // suma solo confirmadas; ajusta si quieres incluir pendientes
    return rows
      .filter((r) => r.estado === "confirmada")
      .reduce((acc, r) => acc + Number(r.eventoHoras ?? 0), 0);
  }, [rows]);

  const fmt = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("es-CR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mis citas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm">
            <span className="font-semibold">Horas confirmadas: </span>
            {horasTotales}
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes citas.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground border-b">
                    <th className="py-2 px-3 text-left">Evento</th>
                    <th className="py-2 px-3 text-left">Horas</th>
                    <th className="py-2 px-3 text-left">Estado</th>
                    <th className="py-2 px-3 text-left">Fecha registro</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{r.eventoTitulo}</td>
                      <td className="py-2 px-3">{r.eventoHoras ?? 0}</td>
                      <td className="py-2 px-3">
                        {r.estado === "confirmada" ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-500" variant="outline">Confirmada</Badge>
                        ) : r.estado === "cancelada" ? (
                          <Badge className="bg-red-500/10 text-red-600 border-red-500" variant="outline">Cancelada</Badge>
                        ) : (
                          <Badge variant="secondary">Pendiente</Badge>
                        )}
                      </td>
                      <td className="py-2 px-3">{fmt(r.creadoEn)}</td>
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
