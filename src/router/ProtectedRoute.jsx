import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children /*, role*/ }) {
  const isLoggedIn = true;    // por ahora true para probar rutas
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}