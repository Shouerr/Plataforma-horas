// src/pages/EventosAdmin.jsx
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { watchEventos, crearEvento, actualizarEvento, eliminarEvento } from "../services/eventosService";
import EventoForm from "../components/EventoForm";
import { Link } from "react-router-dom";              // ⬅️ nuevo
import toast from "react-hot-toast";

export default function EventosAdmin() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const unsub = watchEventos(setItems);
    return () => unsub && unsub();
  }, []);

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit   = (ev) => { setEditing(ev); setShowForm(true); };

  const handleSubmit = async (data) => {
    try {
      setBusyId("saving");
      if (editing) await actualizarEvento(editing.id, data);
      else await crearEvento(data, user?.uid);
      setShowForm(false);
    } finally { setBusyId(null); }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar evento?")) return;
    try {
      setBusyId(id);
      await eliminarEvento(id);
      toast("Evento eliminado ✅");
      setItems(prev => Array.isArray(prev) ? prev.filter(e => e.id !== id) : []);
    } catch (err) {
      console.error("Eliminar evento error:", err);
      alert(err?.message || "Error al eliminar.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ padding: "16px 20px" }}>
      <h2 style={{ marginBottom: 12 }}>Eventos (Admin)</h2>

      {!showForm && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <button className="btn" type="button" onClick={openCreate}>Nuevo evento</button>
        </div>
      )}

      {showForm ? (
        <EventoForm
          initial={editing}
          onCancel={() => setShowForm(false)}
          onSubmit={handleSubmit}
        />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Título</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Cupo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map(ev => (
              <tr key={ev.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                <td>{ev.titulo}</td>
                <td>{fmt(ev.fechaInicio)}</td>
                <td>{fmt(ev.fechaFin)}</td>
                <td>{ev.cupo}</td>
                <td>{ev.estado}</td>
                <td style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Link className="btn ghost" to={`/admin/eventos/${ev.id}/citas`}>
                    Ver citas
                  </Link>
                  <button type="button" className="btn ghost" onClick={() => openEdit(ev)}>
                    Editar
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busyId === ev.id}
                    onClick={() => handleDelete(ev.id)}
                  >
                    {busyId === ev.id ? "Eliminando…" : "Eliminar"}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan="6" style={{ opacity: .7, padding: "12px 0" }}>
                  No hay eventos.
                </td>
              </tr>
            )}
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
