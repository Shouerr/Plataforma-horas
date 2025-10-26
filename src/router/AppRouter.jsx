import { createBrowserRouter } from "react-router-dom";

// Páginas (estudiante)
import Login from "../pages/Login";
import DashboardEstudiante from "../pages/DashboardEstudiante";
import EventoDetalle from "../pages/EventoDetalle";
import MisCitas from "../pages/MisCitas";

// Páginas (admin)
import DashboardAdmin from "../pages/DashboardAdmin";
import EventosAdmin from "../pages/EventosAdmin";
import CitasAdmin from "../pages/CitasAdmin"; // <-- crea este archivo si aún no

// Comunes
import NotFound from "../pages/NotFound";
import ProtectedRoute from "./ProtectedRoute";
import NavBar from "../components/NavBar";

// Layout simple con NavBar
function WithLayout(element) {
  return (
    <>
      <NavBar />
      {element}
    </>
  );
}

const router = createBrowserRouter([
  // Público
  { path: "/", element: <Login /> },
  { path: "/login", element: <Login /> },

  // ===== Estudiante =====
  {
    path: "/estudiante",
    element: (
      <ProtectedRoute role="estudiante">
        {WithLayout(<DashboardEstudiante />)}
      </ProtectedRoute>
    ),
  },
  {
    path: "/estudiante/evento/:id",
    element: (
      <ProtectedRoute role="estudiante">
        {WithLayout(<EventoDetalle />)}
      </ProtectedRoute>
    ),
  },
  {
    path: "/estudiante/mis-citas",
    element: (
      <ProtectedRoute role="estudiante">
        {WithLayout(<MisCitas />)}
      </ProtectedRoute>
    ),
  },

  // ===== Admin =====
  {
    path: "/admin",
    element: (
      <ProtectedRoute role="admin">
        {WithLayout(<DashboardAdmin />)}
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/eventos",
    element: (
      <ProtectedRoute role="admin">
        {WithLayout(<EventosAdmin />)}
      </ProtectedRoute>
    ),
  },
  {
    // gestión de citas por evento
    path: "/admin/eventos/:eventoId/citas",
    element: (
      <ProtectedRoute role="admin">
        {WithLayout(<CitasAdmin />)}
      </ProtectedRoute>
    ),
  },

  // 404
  { path: "*", element: WithLayout(<NotFound />) },
]);

export default router;
