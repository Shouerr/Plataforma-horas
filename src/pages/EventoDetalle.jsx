import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { watchEventoById } from "../services/eventosService";

export default function EventoDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const unsub = watchEventoById(id, (data) => {
      setEv(data);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [id]);

  if (loading) {
    return (
      <div style={{ minHeight: "50vh", display: "grid", placeItems: "center" }}>
        Cargando evento…
      </div>
    );
  }

  if (!ev) {
    return (
      <div style={{ padding: 20 }}>
        <p style={{ opacity: 0.8 }}>Evento no encontrado.</p>
        <button className="btn ghost" onClick={() => nav(-1)}>
          Volver
        </button>
      </div>
    );
  }

  const activo = ev.estado === "activo";

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <button
        className="btn ghost"
        onClick={() => nav(-1)}
        style={{ marginBottom: 10 }}
      >
        ← Volver
      </button>

      <h2 style={{ margin: "6px 0 8px" }}>{ev.titulo}</h2>
      <p style={{ opacity: 0.85, marginTop: 0 }}>
        {ev.descripcion || "Sin descripción."}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          margin: "12px 0",
        }}
      >
        <Info label="Inicio" value={fmt(ev.fechaInicio)} />
        <Info label="Fin" value={fmt(ev.fechaFin)} />
        <Info label="Lugar" value={ev.lugar || "—"} />
        <Info label="Cupo" value={ev.cupo ?? "—"} />
        <Info label="Estado" value={ev.estado} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          className="btn"
          disabled={!activo}
          onClick={() => alert("Inscripción: siguiente paso 😉")}
        >
          {activo ? "Inscribirme" : "No disponible"}
        </button>
        <button className="btn ghost" onClick={() => nav("/estudiante")}>
          Ir a mi panel
        </button>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>{label}</div>
      <div>{String(value ?? "—")}</div>
    </div>
  );
}

function fmt(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString();
}
