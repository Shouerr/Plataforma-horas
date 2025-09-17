//función de React Router para definir rutas de la app (SPA sin recargar la página)
import { createBrowserRouter } from "react-router-dom";

//Páginas principales
import Login from "../pages/Login";
import DashboardEstudiante from "../pages/DashboardEstudiante";
import DashboardAdmin from "../pages/DashboardAdmin";
import NotFound from "../pages/NotFound";

//Ruta protegida
import ProtectedRoute from "./ProtectedRoute";

//Componentes comunes
import NavBar from "../components/NavBar";


//Layout con Navbar (se envuelven las páginas con la barra de navegación)
function WithLayout(element) {
    return (
        <>
        <NavBar />
        {element}
        </>
    );
}


//Definición de rutas
const router = createBrowserRouter([
    { path: "/", element: WithLayout(<Login />) },       //página raíz
    { path: "/login", element: WithLayout(<Login />) },  //ruta explícita
    {
        path: "/estudiante",
        element: (
            <ProtectedRoute role = "estudiante">
                {WithLayout(<DashboardEstudiante />)}
            </ProtectedRoute>
        ),
    },
    {
        path: "/admin",
        element: (
            <ProtectedRoute role = "admin">
                {WithLayout(<DashboardAdmin />)}
            </ProtectedRoute>
        ),
    },
    {
        path: "*", element: WithLayout(<NotFound />) 
    },
]);

export default router;