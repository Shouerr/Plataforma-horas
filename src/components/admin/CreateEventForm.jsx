// src/components/admin/CreateEventForm.jsx
import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { DialogClose } from "../ui/dialog";
import toast from "react-hot-toast";
import { Timestamp } from "firebase/firestore";

function hoursFromTimes(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [h1, m1] = String(startTime).split(":").map(Number);
  const [h2, m2] = String(endTime).split(":").map(Number);
  const diff = Math.max(0, (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60));
  return Math.round(diff * 10) / 10; // 1 decimal
}

export function CreateEventForm({ onSubmit }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "",
    endTime: "",
    location: "",
    maxSpots: "",
  });

  // Horas calculadas (número) y visual con coma
  const hours = useMemo(
    () => hoursFromTimes(formData.startTime, formData.endTime),
    [formData.startTime, formData.endTime]
  );
  const hoursUI = useMemo(
    () => Number(hours || 0).toLocaleString("es-CR", { maximumFractionDigits: 1 }),
    [hours]
  );

  // Estilo base coherente para inputs (claro/oscuro)
  const inputClass =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm " +
    "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition " +
    "[color-scheme:light] dark:[color-scheme:dark]";
  const labelClass = "block text-sm font-medium mb-1";

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validaciones mínimas requeridas
    const required = ["title", "date", "startTime", "endTime", "location", "maxSpots"];
    const missing = required.filter((k) => !String(formData[k] || "").trim());
    if (missing.length) {
      toast.error("Por favor completa todos los campos requeridos.");
      return;
    }

    const maxSpotsNum = parseInt(formData.maxSpots, 10);
    if (Number.isNaN(maxSpotsNum) || maxSpotsNum <= 0) {
      toast.error("Cupos máximos debe ser un número mayor a 0.");
      return;
    }

    if (!Number.isFinite(hours) || hours <= 0) {
      toast.error("Revisa las horas: la hora de fin debe ser mayor a la de inicio.");
      return;
    }

    // Normaliza fecha a Timestamp y string DD/MM/YYYY
    const dateObj = new Date(formData.date + "T00:00:00");
    const dateFormatted = dateObj.toLocaleDateString("es-CR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    await onSubmit({
      title: formData.title.trim(),
      description: formData.description || "",
      date: Timestamp.fromDate(dateObj),
      dateFormatted,
      startTime: formData.startTime,
      endTime: formData.endTime,
      location: formData.location,
      maxSpots: maxSpotsNum,
      hours, // número con punto (p.ej., 2.5) — se guarda en Firestore
    });

    // Reset visual del formulario
    setFormData({
      title: "",
      description: "",
      date: "",
      startTime: "",
      endTime: "",
      location: "",
      maxSpots: "",
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label htmlFor="title" className={labelClass}>Título del Evento *</label>
          <input
            id="title"
            name="title"
            className={inputClass}
            placeholder="Ej: Taller de Técnicas Culinarias"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="description" className={labelClass}>Descripción</label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className={inputClass}
            placeholder="Describe el evento y sus objetivos"
            value={formData.description}
            onChange={handleChange}
          />
        </div>

        <div>
          <label htmlFor="date" className={labelClass}>Fecha *</label>
          <input
            id="date"
            name="date"
            type="date"
            className={inputClass}
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="location" className={labelClass}>Ubicación *</label>
          <input
            id="location"
            name="location"
            className={inputClass}
            placeholder="Ej: Laboratorio de Cocina A"
            value={formData.location}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="startTime" className={labelClass}>Hora de Inicio *</label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            className={inputClass}
            value={formData.startTime}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="endTime" className={labelClass}>Hora de Fin *</label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            className={inputClass}
            value={formData.endTime}
            onChange={handleChange}
            required
          />
        </div>

        <div>
          <label htmlFor="maxSpots" className={labelClass}>Cupos Máximos *</label>
          <input
            id="maxSpots"
            name="maxSpots"
            type="number"
            min="1"
            className={inputClass}
            placeholder="Ej: 20"
            value={formData.maxSpots}
            onChange={handleChange}
            required
          />
        </div>

        {/* Horas automáticas (read-only) */}
        <div>
          <label className={labelClass}>Horas de Servicio (auto)</label>
          <input
            value={hoursUI} // se muestra con coma por locale (2,5)
            className={inputClass}
            readOnly
          />
          <p className="text-xs text-muted-foreground mt-1">
            Se calcula automáticamente a partir de inicio/fin (1 decimal).
          </p>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancelar</Button>
        </DialogClose>

        <Button type="submit" className="bg-gradient-primary hover:bg-gradient-primary/90">
          Crear Evento
        </Button>
      </div>
    </form>
  );
}
