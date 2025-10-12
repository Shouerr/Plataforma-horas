import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { watchEventos } from "../services/eventosService";

export default function DashboardEstudiante() {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    const unsub = watchEventos((data) => {
      setEventos(data.filter((ev) => ev.estado === "activo")); // solo activos
      setLoading(false);
    });
    return () => unsub && unsub();
  }, []);

  if (loading)
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        Cargando eventos…
      </div>
    );

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginBottom: 10 }}>Eventos disponibles</h2>

      {eventos.length === 0 ? (
        <p style={{ opacity: 0.7 }}>No hay eventos activos.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Título</th>
              <th>Fecha inicio</th>
              <th>Fecha fin</th>
              <th>Lugar</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {eventos.map((ev) => (
              <tr
                key={ev.id}
                style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}
              >
                <td>{ev.titulo}</td>
                <td>{fmt(ev.fechaInicio)}</td>
                <td>{fmt(ev.fechaFin)}</td>
                <td>{ev.lugar}</td>
                <td>
                  <button
                    className="btn ghost"
                    onClick={() => nav(`/estudiante/evento/${ev.id}`)}
                  >
                    Ver detalle
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function fmt(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}
