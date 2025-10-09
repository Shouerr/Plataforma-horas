import { createBrowserRouter } from "react-router-dom";

// Páginas principales
import Login from "../pages/Login";
import DashboardEstudiante from "../pages/DashboardEstudiante";
import DashboardAdmin from "../pages/DashboardAdmin";
import NotFound from "../pages/NotFound";

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
  {
    path: "/admin",
    element: (
      <ProtectedRoute role="admin">
        {WithLayout(<DashboardAdmin />)}
      </ProtectedRoute>
    ),
  },
  { path: "*", element: WithLayout(<NotFound />) },
]);

export default router;
