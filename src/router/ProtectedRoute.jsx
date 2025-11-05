// src/router/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Header from "../components/layout/Header";

export default function ProtectedRoute({ children, role }) {
  const { user, role: userRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Cargando sesión…
      </div>
    );
  }

  // No logueado → login
  if (!user) return <Navigate to="/login" replace />;

  // Está logueado pero NO tiene el rol requerido → página de error
  if (role && userRole !== role) {
    return (
      <>
        <Header />
        <main className="p-6 text-red-600 font-medium">
          No tienes permisos para acceder a esta sección 🚫
        </main>
      </>
    );
  }

  // ✅ Render con Header cuando todo ok
  return (
    <>
      <Header />
      <main className="p-6">{children}</main>
    </>
  );
}
