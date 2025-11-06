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
  collection,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  Timestamp,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../app/firebase";

import { deleteCitasByEvento } from "../services/citasService";

/* ---------- helpers de tiempo ---------- */
function toDateJS(x) {
  if (!x) return null;
  if (x?.toDate) return x.toDate();
  if (x instanceof Date) return isNaN(+x) ? null : x;
  if (typeof x === "string") {
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return new Date(`${x}T00:00:00`);
    // dd/mm/yyyy (por si guardaste dateFormatted y deseas fallback)
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(x)) {
      const [dd, mm, yyyy] = x.split("/");
      return new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    }
    const d = new Date(x);
    return isNaN(+d) ? null : d;
  }
  const d = new Date(x);
  return isNaN(+d) ? null : d;
}
function parseHM(hm) {
  const [H, M] = String(hm || "").split(":").map(n => parseInt(n || "0", 10));
  return [isNaN(H) ? 0 : H, isNaN(M) ? 0 : M];
}
function eventStartMs(ev) {
  const base = toDateJS(ev?.date);
  if (!base) return 0;
  const d = new Date(base);
  if (ev?.startTime) {
    const [H, M] = parseHM(ev.startTime);
    d.setHours(H, M, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d.getTime();
}
function eventEndMs(ev) {
  const base = toDateJS(ev?.date);
  if (!base) return 0;
  if (ev?.endTime) {
    const d = new Date(base);
    const [H, M] = parseHM(ev.endTime);
    d.setHours(H, M, 0, 0);
    return d.getTime();
  }
  const d = new Date(base);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
/** completed > full > active */
function deriveStatus(ev) {
  const now = Date.now();
  const max = Number(ev?.maxSpots ?? 0);
  const reg = Number(ev?.registeredStudents ?? 0);
  const ended = eventEndMs(ev) <= now;
  if (ended) return "completed";
  if (max > 0 && reg >= max) return "full";
  return "active";
}

function dateStringToTimestamp(yyyy_mm_dd) {
  if (!yyyy_mm_dd) return null;
  const d = new Date(yyyy_mm_dd + "T00:00:00");
  return Timestamp.fromDate(d);
}

/* --------------------------------- componente --------------------------------- */
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

  // Solo colección `events`
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "events"), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Decorar con status derivado
      const decorated = list
        .map(e => ({ ...e, _displayStatus: deriveStatus(e) }))
        .sort((a,b) => (a?.date?.toMillis?.() ?? 0) - (b?.date?.toMillis?.() ?? 0));
      setEvents(decorated);
      setLoading(false);

      // Opcional: sincronizar si el status guardado difiere del derivado
      decorated.forEach(async ev => {
        const stored = ev.status || "active";
        if (stored !== ev._displayStatus) {
          try {
            await updateDoc(doc(db, "events", ev.id), { status: ev._displayStatus });
          } catch { /* noop */ }
        }
      });
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

  /* ------------------------------- crear evento ------------------------------- */
  async function handleCreateEvent(newEvent) {
    const dateTs = newEvent.date ?? null;
    const payload = {
      title: newEvent.title?.trim() ?? "",
      description: newEvent.description ?? "",
      location: newEvent.location ?? "",
      date: dateTs,
      dateFormatted: newEvent.dateFormatted ?? "",
      startTime: newEvent.startTime ?? "",
      endTime: newEvent.endTime ?? "",
      hours: Number(newEvent.hours ?? 0),
      maxSpots: Number(newEvent.maxSpots ?? 0),
      registeredStudents: 0,
      status: deriveStatus({
        date: dateTs,
        startTime: newEvent.startTime,
        endTime: newEvent.endTime,
        maxSpots: Number(newEvent.maxSpots ?? 0),
        registeredStudents: 0,
      }),
      createdAt: new Date(),
      createdBy: user.uid,
    };
    await addDoc(collection(db, "events"), payload);
    setIsCreateDialogOpen(false);
    toast.success("Evento creado correctamente.");
  }

  function openEdit(ev) {
    setEditing(ev);
    setIsEditOpen(true);
  }

  async function handleEditSubmit(form) {
    try {
      const dateTs = form.date ? dateStringToTimestamp(form.date) : (editing?.date ?? null);
      const registered = Number(editing?.registeredStudents ?? 0);

      const next = {
        title: form.title?.trim() ?? "",
        description: form.description ?? "",
        location: form.location ?? "",
        date: dateTs,
        dateFormatted: dateTs
          ? dateTs.toDate().toLocaleDateString("es-CR", { day: "2-digit", month: "2-digit", year: "numeric" })
          : (editing?.dateFormatted ?? ""),
        startTime: form.startTime ?? "",
        endTime: form.endTime ?? "",
        hours: Number(form.hours ?? 0),
        maxSpots: Number(form.maxSpots ?? 0),
      };

      next.status = deriveStatus({
        ...next,
        registeredStudents: registered,
      });

      await updateDoc(doc(db, "events", editing.id), next);

      toast.success("Cambios guardados.");
      setIsEditOpen(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo actualizar el evento.");
    }
  }

  /* --------------------------- borrado en cascada --------------------------- */
  async function deleteEventCascade(eventId) {
    await deleteCitasByEvento(eventId);   // borra citas asociadas
    await deleteDoc(doc(db, "events", eventId));
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

  const activeCount = events.filter(e => e._displayStatus === "active").length;
  const completedCount = events.filter(e => e._displayStatus === "completed").length;

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
              <AlertTriangle className="w-4 h-4 text-blue-500" />
              Completados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{completedCount}</div>
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
                        event._displayStatus === "active"
                          ? "bg-green-500/10 text-green-600 border-green-500"
                          : event._displayStatus === "completed"
                          ? "bg-blue-500/10 text-blue-500 border-blue-700"
                          : "bg-red-500/10 text-red-500 border-red-500"
                      }
                      variant={event._displayStatus === "active" ? "outline" : "secondary"}
                    >
                      {event._displayStatus === "active" ? "Activo"
                        : event._displayStatus === "completed" ? "Completado" : "Lleno"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      {event.date?.toDate
                        ? event.date.toDate().toLocaleDateString("es-CR",{day:"2-digit",month:"2-digit",year:"numeric"})
                        : (event.dateFormatted || "Sin fecha")}
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {(event.startTime || "--:--")}{event.endTime ? ` - ${event.endTime}` : ""}
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      {event.location || "—"}
                    </div>
                    <div className="flex items-center">
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {Number(event.hours ?? 0).toFixed(2)} horas
                    </div>
                  </div>

                  <div className="flex justify-between items-center mt-3">
                    <div className="flex items-center gap-2">
                      <p className="text-sm">
                        <strong className="text-foreground">{event.registeredStudents ?? 0}</strong>/{event.maxSpots} inscritos
                      </p>

                      <Link to={`/admin/eventos/${event.id}/citas`}>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs flex items-center gap-1" title="Ver participantes">
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
                        onClick={() => { setPendingDelete({ id: event.id, title: event.title }); setConfirmOpen(true); }}
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
              Vas a eliminar <span className="font-medium text-foreground">{pendingDelete?.title}</span>. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={confirmDelete}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------------------- Formulario de edición ---------------------------- */
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
    status: (initial.status || "active"),
  });

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition";
  const label = "block text-sm font-medium mb-1";
  const handle = (e) => setF((s) => ({ ...s, [e.target.name]: e.target.value }));

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit?.(f); }} className="space-y-4">
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
          <label className={label}>Horas servicio *</label>
          <input type="number" min="0" step="0.5" className={input} name="hours" value={f.hours} onChange={handle} required />
        </div>

        <div className="col-span-2">
          <label className={label}>Estado (se recalcula automáticamente)</label>
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
