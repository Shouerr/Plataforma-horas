import { useAuth } from "../context/AuthContext";

export default function NavBar() {
  const { user, logout } = useAuth();

  return (
    <nav>
      <a href="/login">Login</a>
      <a href="/estudiante">Estudiante</a>
      <a href="/admin">Admin</a>
      {user && (
        <button onClick={logout} style={{ marginLeft: "1rem" }}>
          Cerrar sesión
        </button>
      )}
    </nav>
  );
}
