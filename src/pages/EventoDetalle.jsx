import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { watchEventoById } from "../services/eventosService";
import { useAuth } from "../context/AuthContext";
import { crearCita, getCitaByEventAndUser, countCitasActivas } from "../services/citasService";

export default function EventoDetalle() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [ev, setEv] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [yaInscrito, setYaInscrito] = useState(false);
  const [cuposInfo, setCuposInfo] = useState({ ocupados: 0, cupo: 0 });

  // cargar evento
  useEffect(() => {
    if (!id) return;
    const unsub = watchEventoById(id, (data) => {
      setEv(data);
      setLoading(false);
    });
    return () => unsub && unsub();
  }, [id]);

  // comprobar inscripción y cupos
  useEffect(() => {
    const run = async () => {
      if (!id || !user) return;
      const cita = await getCitaByEventAndUser(id, user.uid);
      setYaInscrito(!!cita);
      if (ev) {
        const ocup = await countCitasActivas(id);
        setCuposInfo({ ocupados: ocup, cupo: Number(ev.cupo || 0) });
      }
    };
    run();
  }, [id, user, ev]);

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
        <button className="btn ghost" onClick={() => nav(-1)}>Volver</button>
      </div>
    );
  }

  const activo = ev.estado === "activo";
const sinCupo = ev?.cupo && cuposInfo.ocupados >= Number(ev.cupo);
  const puedeInscribir = activo && !yaInscrito && !sinCupo;

  const inscribirme = async () => {
    try {
      if (!user?.uid) return alert("Inicia sesión para inscribirte.");
      setBusy(true);
      await crearCita({ evento: ev, user });
      alert("Inscripción registrada (pendiente).");
      setYaInscrito(true);
      const ocup = await countCitasActivas(ev.id);
      setCuposInfo({ ocupados: ocup, cupo: Number(ev.cupo || 0) });
    } catch (e) {
      alert(e?.message || "No se pudo inscribir.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 800 }}>
      <button className="btn ghost" onClick={() => nav(-1)} style={{ marginBottom: 10 }}>
        ← Volver
      </button>

      <h2 style={{ margin: "6px 0 8px" }}>{ev.titulo}</h2>
      <p style={{ opacity: 0.85, marginTop: 0 }}>{ev.descripcion || "Sin descripción."}</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "12px 0" }}>
        <Info label="Inicio" value={fmt(ev.fechaInicio)} />
        <Info label="Fin" value={fmt(ev.fechaFin)} />
        <Info label="Lugar" value={ev.lugar || "—"} />
        <Info label="Cupo" value={ev.cupo ?? "—"} />
        <Info label="Ocupados" value={cuposInfo.ocupados} />
        <Info label="Estado" value={ev.estado} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button
          className="btn"
          disabled={!puedeInscribir || busy}
          onClick={inscribirme}
        >
          {busy
            ? "Procesando…"
            : yaInscrito
            ? "Ya inscrito"
            : sinCupo
            ? "Sin cupo"
            : "Inscribirme"}
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
    <div style={{ border: "1px solid rgba(255,255,255,.08)", borderRadius: 12, padding: 12 }}>
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
