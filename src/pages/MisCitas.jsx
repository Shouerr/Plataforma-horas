// src/pages/MisCitas.jsx
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../app/firebase";
import { useAuth } from "../context/AuthContext";
import { watchCitasByUser } from "../services/citasService";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";

function fmt(tsOrDate) {
  if (!tsOrDate) return "—";
  const d = tsOrDate.toDate ? tsOrDate.toDate() : new Date(tsOrDate);
  if (isNaN(+d)) return "—";
  return d.toLocaleString("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MisCitas() {
  const { currentUser } = useAuth();
  const [citas, setCitas] = useState([]);
  const [eventsMap, setEventsMap] = useState(new Map());

  // 1) Mapa de eventos actuales (para ocultar huérfanas si el evento ya no existe)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "events"), (s) => {
      const m = new Map();
      s.docs.forEach((d) => m.set(d.id, { id: d.id, ...d.data() }));
      setEventsMap(m);
    });
    return () => unsub && unsub();
  }, []);

  // 2) Mis citas (merge userId/usuarioId)
  useEffect(() => {
    if (!currentUser?.uid) return;
    const off = watchCitasByUser(currentUser.uid, setCitas);
    return () => off && off();
  }, [currentUser?.uid]);

  // 3) Citas visibles (sin huérfanas)
  const visibles = useMemo(
    () => citas.filter((c) => eventsMap.has(c.eventoId)),
    [citas, eventsMap]
  );

  const horasConfirmadas = useMemo(() => {
    let total = 0;
    for (const c of visibles) {
      if (c.estado === "confirmada") {
        const h =
          typeof c.horas === "number"
            ? c.horas
            : typeof c.hours === "number"
            ? c.hours
            : 0;
        total += h;
      }
    }
    return total.toFixed(2);
  }, [visibles]);

  const estadoBadge = (estado) => {
    if (estado === "confirmada")
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500" variant="outline">
          Confirmada
        </Badge>
      );
    if (estado === "cancelada")
      return (
        <Badge className="bg-red-500/10 text-red-600 border-red-500" variant="outline">
          Cancelada
        </Badge>
      );
    return <Badge variant="secondary">Pendiente</Badge>;
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Mis citas</CardTitle>
          <p className="text-sm text-muted-foreground">
            Horas confirmadas: {horasConfirmadas}
          </p>
        </CardHeader>

        <CardContent>
          {visibles.length === 0 ? (
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
                  {visibles.map((c) => {
                    const ev = eventsMap.get(c.eventoId);
                    const titulo = ev?.titulo || ev?.title || "Evento";
                    const horas =
                      typeof c.horas === "number"
                        ? c.horas
                        : typeof c.hours === "number"
                        ? c.hours
                        : 0;
                    return (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2 px-3">{titulo}</td>
                        <td className="py-2 px-3">{horas}</td>
                        <td className="py-2 px-3">{estadoBadge(c.estado)}</td>
                        <td className="py-2 px-3">{fmt(c.creadoEn)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
