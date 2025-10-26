// src/pages/CitasAdmin.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { watchCitasByEvento, adminConfirmarCita, adminCancelarCita } from "../services/citasService";
import toast from "react-hot-toast";

export default function CitasAdmin() {
  const { eventoId } = useParams();
  const nav = useNavigate();
  const [citas, setCitas] = useState([]);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    if (!eventoId) return;
    const unsub = watchCitasByEvento(eventoId, setCitas);
    return () => unsub && unsub();
  }, [eventoId]);

  const confirmar = async (c) => {
    try { setBusy(c.id); await adminConfirmarCita(c.id); 
    toast("Cita confirmada ✅"); }
    catch (e) { toast.error(e?.message || "No se pudo confirmar."); }
    finally { setBusy(null); }
  };

  const cancelar = async (c) => {
    try { setBusy(c.id); await adminCancelarCita(c.id);
    toast("Cita cancelada ❎"); }
    catch (e) { toast.error(e?.message || "No se pudo cancelar."); }
    finally { setBusy(null); }
  };

  const displayUser = (c) => c.userName || c.userEmail || c.userId;

  return (
    <div>
      <button className="btn ghost" onClick={() => nav(-1)} style={{ marginBottom: 10 }}>← Volver</button>
      <h2>Citas del evento</h2>

      {citas.length === 0 ? (
        <p style={{ opacity: .7 }}>No hay citas.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Usuario</th>
              <th>Estado</th>
              <th>Creado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {citas.map((c) => (
              <tr key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                <td>{displayUser(c)}</td>
                <td>{c.estado}</td>
                <td>{fmt(c.creadoEn)}</td>
                <td style={{ textAlign: "right", display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  {c.estado !== "confirmada" && (
                    <button className="btn" disabled={busy === c.id} onClick={() => confirmar(c)}>
                      {busy === c.id ? "..." : "Confirmar"}
                    </button>
                  )}
                  {c.estado !== "cancelada" && (
                    <button className="btn" disabled={busy === c.id} onClick={() => cancelar(c)}>
                      {busy === c.id ? "..." : "Cancelar"}
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
