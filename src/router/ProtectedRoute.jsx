import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, role }) {
  const { user, role: userRole, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Cargando sesión…</div>;

  // Si no está logueado → redirige al login
  if (!user) return <Navigate to="/login" replace />;

  // Si hay rol definido y no coincide → redirige también
  if (role && userRole !== role) return <Navigate to="/login" replace />;

  return children;
}