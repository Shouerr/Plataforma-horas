import { useEffect, useState } from "react";

export default function EventoForm ({ initial, onCancel, onSubmit}) {
    const [f, setF] = useState({
        titulo: "", descripcion: "", lugar: "",
    cupo: 0, estado: "activo",
    fechaInicio: "", fechaFin: ""
    });

useEffect(() => {
    if (!initial) return;
    setF({
        titulo: initial.titulo || "",
      descripcion: initial.descripcion || "",
      lugar: initial.lugar || "",
      cupo: initial.cupo || 0,
      estado: initial.estado || "activo",
      fechaInicio: stampToLocal(initial.fechaInicio),
      fechaFin: stampToLocal(initial.fechaFin),
    });
}, [initial]);

  const handle = (e) => setF(s => ({ ...s, [e.target.name]: e.target.value }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit?.(f); }}
      style={{ display:"grid", gap:10 }}
    >
      <label>Título<input name="titulo" value={f.titulo} onChange={handle} required/></label>
      <label>Descripción<textarea name="descripcion" value={f.descripcion} onChange={handle} rows="3"/></label>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
        <label>Inicio<input type="datetime-local" name="fechaInicio" value={f.fechaInicio} onChange={handle} required/></label>
        <label>Fin<input type="datetime-local" name="fechaFin" value={f.fechaFin} onChange={handle} required/></label>
      </div>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:10}}>
        <label>Lugar<input name="lugar" value={f.lugar} onChange={handle}/></label>
        <label>Cupo<input type="number" min="0" name="cupo" value={f.cupo} onChange={handle}/></label>
      </div>
      <label>Estado
        <select name="estado" value={f.estado} onChange={handle}>
          <option value="activo">Activo</option>
          <option value="cerrado">Cerrado</option>
          <option value="finalizado">Finalizado</option>
        </select>
      </label>

      <div style={{display:"flex", gap:10, marginTop:6}}>
        <button className="btn" type="submit">{initial ? "Guardar cambios" : "Crear evento"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function stampToLocal(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const pad = (n) => String(n).padStart(2,"0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}