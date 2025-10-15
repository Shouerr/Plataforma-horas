import { createBrowserRouter } from "react-router-dom";

// Páginas principales
import Login from "../pages/Login";
import DashboardEstudiante from "../pages/DashboardEstudiante";
import DashboardAdmin from "../pages/DashboardAdmin";
import NotFound from "../pages/NotFound";
import EventoDetalle from "../pages/EventoDetalle"; 
import MisCitas from "../pages/MisCitas"; 

// Ruta protegida
import ProtectedRoute from "./ProtectedRoute";

// Componentes comunes
import NavBar from "../components/NavBar";

// Layout con Navbar
function WithLayout(element) {
  return (
    <>
      <NavBar />
      {element}
    </>
  );
}

const router = createBrowserRouter([
  { path: "/", element: <Login /> },
  { path: "/login", element: <Login /> },

  {
    path: "/estudiante",
    element: (
      <ProtectedRoute role="estudiante">
        {WithLayout(<DashboardEstudiante />)}
      </ProtectedRoute>
    ),
  },
  // 👇 nueva ruta: detalle de evento (visible solo para estudiantes)
  {
    path: "/estudiante/evento/:id",
    element: (
      <ProtectedRoute role="estudiante">
        {WithLayout(<EventoDetalle />)}
      </ProtectedRoute>
    ),
  },

  {
    path: "/admin",
    element: (
      <ProtectedRoute role="admin">
        {WithLayout(<DashboardAdmin />)}
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

  { path: "*", element: WithLayout(<NotFound />) },
]);

export default router;
