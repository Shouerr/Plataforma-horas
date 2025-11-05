// src/pages/DashboardAdmin.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "../components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
  DialogTrigger, DialogFooter, DialogClose,
} from "../components/ui/dialog";

import { CreateEventForm } from "../components/admin/CreateEventForm";
import { QRCodeDialog } from "../components/admin/QRCodeDialog";
import { useAuth } from "../context/AuthContext";

import {
  Calendar, Clock, Users, Plus, QrCode, Edit, Trash2, CheckCircle, AlertTriangle,
} from "lucide-react";

import {
  collection, onSnapshot, addDoc, doc, updateDoc, Timestamp,
  where, getDocs, writeBatch, query,
} from "firebase/firestore";
import { db } from "../app/firebase";
import { deleteField } from "firebase/firestore";

/* ---- Util: horas decimales (1 decimal) a partir de hours/horas o start/end ---- */
function diffHours1Dec(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [h1, m1] = String(startTime).split(":").map(Number);
  const [h2, m2] = String(endTime).split(":").map(Number);
  const diff = Math.max(0, (h2 + (m2 || 0) / 60) - (h1 + (m1 || 0) / 60));
  return Math.round(diff * 10) / 10;
}

function getEventHoursFromRaw(ev) {
  const direct = ev?.hours ?? ev?.horas;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return Math.round(direct * 10) / 10;
  }
  if ((ev?.startTime && ev?.endTime) && (ev?.date || ev?.fechaInicio)) {
    return diffHours1Dec(ev.startTime, ev.endTime);
  }
  if (ev?.fechaInicio && ev?.fechaFin) {
    const ini = ev.fechaInicio?.toDate ? ev.fechaInicio.toDate() : new Date(ev.fechaInicio);
    const fin = ev.fechaFin?.toDate ? ev.fechaFin.toDate() : new Date(ev.fechaFin);
    const diff = Math.max(0, (fin - ini) / 36e5);
    return Math.round(diff * 10) / 10;
  }
  return 0;
}

const fmtHours = (h) => Number(h || 0).toLocaleString("es-CR", { maximumFractionDigits: 1 });

function unifyEvent(id, data) {
  const isLegacy =
    data.titulo !== undefined ||
    data.fechaInicio !== undefined ||
    data.cupo !== undefined;

  const title = isLegacy ? (data.titulo ?? "") : (data.title ?? "");
  const dateTs = isLegacy ? (data.fechaInicio ?? null) : (data.date ?? null);
  const endTs  = isLegacy ? (data.fechaFin ?? null) : null;

  const startTime = !isLegacy ? (data.startTime ?? "") :
    (dateTs?.toDate ? dateTs.toDate().toTimeString().slice(0,5) : (data.horaInicio ?? ""));
  const endTime = !isLegacy ? (data.endTime ?? "") :
    (endTs?.toDate ? endTs.toDate().toTimeString().slice(0,5) : (data.horaFin ?? ""));

  const status = !isLegacy ? (data.status ?? "active") : (data.estado ?? "activo");
  const maxSpots = !isLegacy ? (data.maxSpots ?? 0) : (data.cupo ?? 0);
  const registeredStudents = !isLegacy ? (data.registeredStudents ?? 0) : (data.reservados ?? 0);

  const dateFormatted =
    data.dateFormatted ??
    (dateTs?.toDate
      ? dateTs.toDate().toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : null);

  const hours = getEventHoursFromRaw(data);

  return {
    id,
    title,
    description: isLegacy ? (data.descripcion ?? "") : (data.description ?? ""),
    location:   isLegacy ? (data.lugar ?? "")        : (data.location ?? ""),
    date: dateTs || null,
    dateFormatted: dateFormatted || "",
    startTime,
    endTime,
    hours,
    status,
    maxSpots,
    registeredStudents,
    _legacy: isLegacy,
    _raw: data,
  };
}

function dateStringToTimestamp(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return null;
  const d = new Date(yyyy_mm_dd + "T00:00:00");
  return Timestamp.fromDate(d);
}

export default function DashboardAdmin() {
  const { user, role } = useAuth();

  const [events, setEvents] = useState([]);
  const [studentsCount, setStudentsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "events"), (snap) => {
      const list = snap.docs.map((d) => unifyEvent(d.id, d.data()));
      list.sort((a, b) => {
        const ta = a.date?.toMillis?.() ?? 0;
        const tb = b.date?.toMillis?.() ?? 0;
        return ta - tb;
      });
      setEvents(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      setStudentsCount(snap.size);
    });
    return () => unsub();
  }, []);

  if (!user || role !== "admin") return null;
  if (loading) return <p className="p-6">Cargando eventos…</p>;

  async function handleCreateEvent(newEvent) {
    const dateTs = newEvent.date;

    // Prioriza horas calculadas desde HH:mm; si vienen, respétalas como número
    let hours = Number(newEvent.hours ?? 0);
    if ((!Number.isFinite(hours) || hours === 0) && newEvent.startTime && newEvent.endTime) {
      hours = diffHours1Dec(newEvent.startTime, newEvent.endTime);
    }

    const payloadNew = {
      title: newEvent.title?.trim() ?? "",
      description: newEvent.description ?? "",
      location: newEvent.location ?? "",
      date: dateTs ?? null,
      dateFormatted: newEvent.dateFormatted ?? "",
      startTime: newEvent.startTime ?? "",
      endTime: newEvent.endTime ?? "",
      hours: Number.isFinite(hours) ? hours : 0, // número con punto, 1 decimal esperado
      maxSpots: Number(newEvent.maxSpots ?? 0),
      registeredStudents: 0,
      status: "active",
      createdAt: new Date(),
      createdBy: user.uid,
    };

    await addDoc(collection(db, "events"), payloadNew);
    setIsCreateDialogOpen(false);
    toast.success("Evento creado correctamente.");
  }

  function openEdit(ev) {
    setEditing(ev);
    setIsEditOpen(true);
  }

  async function handleEditSubmit(form) {
    try {
      const dateTs =
        form.date ? dateStringToTimestamp(form.date) : (editing?.date ?? null);

      // Recalcular horas si procede
      let hours = Number(form.hours ?? 0);
      if ((!Number.isFinite(hours) || hours === 0) && form.startTime && form.endTime) {
        hours = diffHours1Dec(form.startTime, form.endTime);
      }

      const payloadNew = {
        title: form.title?.trim() ?? "",
        description: form.description ?? "",
        location: form.location ?? "",
        date: dateTs,
        dateFormatted: dateTs
          ? dateTs.toDate().toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" })
          : (editing?.dateFormatted ?? ""),
        startTime: form.startTime ?? "",
        endTime: form.endTime ?? "",
        hours: Number.isFinite(hours) ? hours : 0,
        maxSpots: Number(form.maxSpots ?? 0),
        status: form.status ?? "active",
      };

      await updateDoc(doc(db, "events", editing.id), payloadNew);

      toast.success("Cambios guardados.");
      setIsEditOpen(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el evento.");
    }
  }

  async function deleteEventCascade(eventId) {
    const batch = writeBatch(db);

    const citasQ = query(collection(db, "citas"), where("eventoId", "==", eventId));
    const citasSnap = await getDocs(citasQ);
    citasSnap.forEach((d) => {
      batch.delete(doc(db, "citas", d.id));
    });

    batch.delete(doc(db, "events", eventId));
    await batch.commit();
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await deleteEventCascade(pendingDelete.id);
      toast.success("Evento y citas asociadas eliminados.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo eliminar el evento.");
    } finally {
      setConfirmOpen(false);
      setPendingDelete(null);
    }
  }

  async function cleanLegacyFields() {
    if (!window.confirm("¿Deseas eliminar los campos legacy (titulo, descripcion, etc.) de 'events'?")) return;

    try {
      const snap = await getDocs(collection(db, "events"));
      if (snap.empty) {
        toast("No hay documentos en 'events'.");
        return;
      }

      let cleaned = 0;
      for (const d of snap.docs) {
        try {
          await updateDoc(doc(db, "events", d.id), {
            titulo: deleteField(),
            descripcion: deleteField(),
            lugar: deleteField(),
            fechaInicio: deleteField(),
            fechaFin: deleteField(),
            cupo: deleteField(),
            reservados: deleteField(),
            estado: deleteField(),
            horas: deleteField(),
          });
          cleaned++;
        } catch (err) {
          console.error(`❌ Error limpiando ${d.id}:`, err.code, err.message);
        }
      }

      toast.success(`✅ Limpieza completada: ${cleaned} documentos actualizados.`);
    } catch (err) {
      console.error("Error en limpieza:", err);
      toast.error("Error al limpiar campos legacy. Revisa la consola.");
    }
  }

  const activeCount = events.filter((e) =>
    (e.status ?? "active") === "active" || (e._legacy && e.status === "activo")
  ).length;

  const completedCount = events.filter((e) =>
    (e.status ?? "") === "completed" || (e._legacy && e.status === "finalizado")
  ).length;

  const toInputDate = (val) => {
    const d = val?.toDate ? val.toDate() : typeof val === "string" ? new Date(val) : val;
    if (!d || isNaN(+d)) return "";
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Panel de Administrador</h1>
          <p className="text-muted-foreground">Gestiona eventos y participación estudiantil</p>
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Crear Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Nuevo Evento</DialogTitle>
                <DialogDescription>Completa la información del evento</DialogDescription>
              </DialogHeader>
              <CreateEventForm onSubmit={handleCreateEvent} />
            </DialogContent>
          </Dialog>

          {/* Botón limpiar legacy */}
          <Button
            variant="outline"
            className="border-green-300 text-green-500 hover:bg-green-50"
            onClick={cleanLegacyFields}
          >
            Limpiar legacy
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-gradient-primary text-primary-foreground border-0 shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Total Eventos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{events.length}</div>
            <p className="text-xs opacity-90">eventos creados</p>
          </CardContent>
        </Card>

        <Card className="shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Eventos Activos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{activeCount}</div>
            <p className="text-xs text-muted-foreground">próximos eventos</p>
          </CardContent>
        </Card>

        <Card className="shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{studentsCount}</div>
            <p className="text-xs text-muted-foreground">estudiantes registrados</p>
          </CardContent>
        </Card>

        <Card className="shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              Completados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{completedCount}</div>
            <p className="text-xs text-muted-foreground">eventos finalizados</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de eventos */}
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Eventos</CardTitle>
          <CardDescription>Administra, edita y genera códigos QR</CardDescription>
        </CardHeader>

        <CardContent>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay eventos creados.</p>
          ) : (
            <div className="grid gap-4">
              {events.map((event) => (
                <div key={event.id} className="p-4 border rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">{event.title}</h3>
                      <p className="text-muted-foreground text-sm">{event.description}</p>
                    </div>

                    <Badge
                      className={
                        (event.status === "active" || event.status === "activo")
                          ? "bg-green-500/10 text-green-600 border-green-500"
                          : (event.status === "completed" || event.status === "finalizado")
                          ? "bg-yellow-500/10 text-yellow-600 border-yellow-500"
                          : "bg-red-500/10 text-red-500 border-red-500"
                      }
                      variant={(event.status === "active" || event.status === "activo") ? "outline" : "secondary"}
                    >
                      {(event.status === "active" || event.status === "activo")
                        ? "Activo"
                        : (event.status === "completed" || event.status === "finalizado")
                        ? "Completado"
                        : "Lleno"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {event.dateFormatted ||
                        (event?.date?.toDate
                          ? event.date.toDate().toLocaleDateString("es-CR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "Sin fecha")}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {event.startTime} {event.endTime ? `- ${event.endTime}` : ""}
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      {event.location}
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {fmtHours(event.hours)} horas
                    </div>
                  </div>

                  {/* Línea inferior */}
                  <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm">
                        <strong className="text-foreground">
                          {event.registeredStudents ?? 0}
                        </strong>
                        /{event.maxSpots} inscritos
                      </p>

                      <Link to={`/admin/eventos/${event.id}/citas`}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs flex items-center gap-1"
                          title="Ver participantes"
                        >
                          <Users className="w-3.5 h-3.5" />
                          Participantes
                        </Button>
                      </Link>
                    </div>

                    <div className="flex gap-2">
                      <QRCodeDialog eventId={event.id} eventTitle={event.title}>
                        <Button size="sm" variant="outline">
                          <QrCode className="w-4 h-4 mr-2" />
                          QR Code
                        </Button>
                      </QRCodeDialog>

                      <Button size="sm" variant="outline" onClick={() => openEdit(event)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPendingDelete({ id: event.id, title: event.title });
                          setConfirmOpen(true);
                        }}
                        className="text-red-500"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Eliminar
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL: Editar */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Editar evento</DialogTitle>
            <DialogDescription>Actualiza la información del evento</DialogDescription>
          </DialogHeader>

          {editing && (
            <EditEventForm
              initial={editing}
              onCancel={() => { setIsEditOpen(false); setEditing(null); }}
              onSubmit={handleEditSubmit}
              toInputDate={(v) => {
                const d = v?.toDate ? v.toDate() : typeof v === "string" ? new Date(v) : v;
                if (!d || isNaN(+d)) return "";
                const off = d.getTimezoneOffset();
                const local = new Date(d.getTime() - off * 60000);
                return local.toISOString().slice(0, 10);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmación de borrado */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Eliminar evento?</DialogTitle>
            <DialogDescription>
              Vas a eliminar{" "}
              <span className="font-medium text-foreground">{pendingDelete?.title}</span>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={confirmDelete}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ======= Formulario de EDICIÓN ======= */
function EditEventForm({ initial, onCancel, onSubmit, toInputDate }) {
  const [f, setF] = useState({
    title: initial.title || "",
    description: initial.description || "",
    date: toInputDate(initial.date) || "",
    startTime: initial.startTime || "",
    endTime: initial.endTime || "",
    location: initial.location || "",
    maxSpots: String(initial.maxSpots ?? 0),
    hours: String(initial.hours ?? 0),
    status: (initial.status === "activo" ? "active" : initial.status) || "active",
  });

  useEffect(() => {
    if (f.startTime && f.endTime) {
      const dec = diffHours1Dec(f.startTime, f.endTime);
      setF((s) => ({ ...s, hours: String(dec) }));
    }
  }, [f.startTime, f.endTime]);

  const input =
    "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition";
  const label = "block text-sm font-medium mb-1";
  const handle = (e) => setF((s) => ({ ...s, [e.target.name]: e.target.value }));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit?.(f); }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={label}>Título *</label>
          <input className={input} name="title" value={f.title} onChange={handle} required />
        </div>

        <div className="col-span-2">
          <label className={label}>Descripción</label>
          <textarea className={input} name="description" rows={3} value={f.description} onChange={handle} />
        </div>

        <div>
          <label className={label}>Fecha *</label>
          <input type="date" className={input} name="date" value={f.date} onChange={handle} required />
        </div>

        <div>
          <label className={label}>Ubicación *</label>
          <input className={input} name="location" value={f.location} onChange={handle} required />
        </div>

        <div>
          <label className={label}>Hora inicio *</label>
          <input type="time" className={input} name="startTime" value={f.startTime} onChange={handle} required />
        </div>

        <div>
          <label className={label}>Hora fin *</label>
          <input type="time" className={input} name="endTime" value={f.endTime} onChange={handle} required />
        </div>

        <div>
          <label className={label}>Cupos *</label>
          <input type="number" min="0" className={input} name="maxSpots" value={f.maxSpots} onChange={handle} required />
        </div>

        <div>
          <label className={label}>Horas servicio (auto)</label>
          <input
            className={input}
            name="hours"
            value={Number(f.hours || 0).toLocaleString("es-CR", { maximumFractionDigits: 1 })}
            readOnly
          />
          <p className="text-xs text-muted-foreground mt-1">Se calcula a 1 decimal a partir de inicio/fin.</p>
        </div>

        <div className="col-span-2">
          <label className={label}>Estado</label>
          <select className={input} name="status" value={f.status} onChange={handle}>
            <option value="active">Activo</option>
            <option value="completed">Completado</option>
            <option value="full">Lleno</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit">Guardar cambios</Button>
      </div>
    </form>
  );
}
