// src/routes/router.jsx
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
// import EventosAdmin from "../pages/EventosAdmin";
import CitasAdmin from "../pages/CitasAdmin";

// Rutas protegidas (inyectan Header automáticamente)
import ProtectedRoute from "./ProtectedRoute";

// 🆕 Escáner QR
import ScannerQR from "../pages/ScannerQR";

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

  // 🆕 Ruta del escáner SIN ProtectedRoute para que no redirija a /login
  {
    path: "/scanner",
    element: <ScannerQR />,
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
  {
    path: "/admin/eventos",
    element: <Navigate to="/admin" replace />,
  },
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
