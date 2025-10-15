import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { watchCitasByUser, cancelarCita } from "../services/citasService";

export default function MisCitas() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [citas, setCitas] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = watchCitasByUser(user.uid, setCitas);
    return () => unsub && unsub();
  }, [user]);

  const cancelar = async (c) => {
    if (!confirm("¿Cancelar esta cita?")) return;
    try {
      setBusy(c.id);
      await cancelarCita(c.id, user.uid);
    } catch (e) {
      alert(e?.message || "No se pudo cancelar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <button className="btn ghost" onClick={() => nav(-1)} style={{ marginBottom: 10 }}>← Volver</button>
      <h2>Mis Citas</h2>

      {citas.length === 0 ? (
        <p style={{ opacity: .7 }}>No tienes citas registradas.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Evento</th><th>Inicio</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {citas.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                <td><Link to={`/estudiante/evento/${c.eventoId}`}>{c.eventoTitulo || c.eventoId}</Link></td>
                <td>{fmt(c.eventoInicio)}</td>
                <td>{badge(c.estado)}</td>
                <td style={{ textAlign: "right" }}>
                  {(c.estado === "pendiente" || c.estado === "confirmada") && (
                    <button className="btn" disabled={busy === c.id} onClick={() => cancelar(c)}>
                      {busy === c.id ? "Cancelando…" : "Cancelar"}
                    </button>
                  )}
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
function badge(estado) {
  const map = { pendiente: "🟡 Pendiente", confirmada: "🟢 Confirmada", cancelada: "⚪ Cancelada" };
  return map[estado] || estado;
}
