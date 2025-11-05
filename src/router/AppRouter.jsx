import { createBrowserRouter, Navigate } from "react-router-dom";

// Páginas públicas
import Login from "../pages/Login";
import NotFound from "../pages/NotFound";

// Estudiante
import DashboardEstudiante from "../pages/DashboardEstudiante";
import EventoDetalle from "../pages/EventoDetalle";
import MisCitas from "../pages/MisCitas";

// Admin
import DashboardAdmin from "../pages/DashboardAdmin";
// import EventosAdmin from "../pages/EventosAdmin";  // ⬅️ ya no lo necesitamos
import CitasAdmin from "../pages/CitasAdmin";

// Rutas protegidas (inyectan Header automáticamente)
import ProtectedRoute from "./ProtectedRoute";

const router = createBrowserRouter([
  // Público
  { path: "/", element: <Login /> },
  { path: "/login", element: <Login /> },

  // ===== Estudiante =====
  {
    path: "/estudiante",
    element: (
      <ProtectedRoute role="estudiante">
        <DashboardEstudiante />
      </ProtectedRoute>
    ),
  },
  {
    path: "/estudiante/evento/:id",
    element: (
      <ProtectedRoute role="estudiante">
        <EventoDetalle />
      </ProtectedRoute>
    ),
  },
  {
    path: "/estudiante/mis-citas",
    element: (
      <ProtectedRoute role="estudiante">
        <MisCitas />
      </ProtectedRoute>
    ),
  },

  // ===== Admin =====
  {
    path: "/admin",
    element: (
      <ProtectedRoute role="admin">
        <DashboardAdmin />
      </ProtectedRoute>
    ),
  },

  // (Opcional) backward-compat: si alguien entra a /admin/eventos,
  // lo redirigimos al único dashboard admin.
  {
    path: "/admin/eventos",
    element: <Navigate to="/admin" replace />,
  },

  // Participantes de un evento (desde el botón “Participantes”)
  {
    path: "/admin/eventos/:eventoId/citas",
    element: (
      <ProtectedRoute role="admin">
        <CitasAdmin />
      </ProtectedRoute>
    ),
  },

  // 404
  { path: "*", element: <NotFound /> },
]);

export default router;
