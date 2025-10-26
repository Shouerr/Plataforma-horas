/*import EventosAdmin from "./EventosAdmin";

export default function DashboardAdmin() {
    return (
        <main style={{ padding: 24}}>
            <h1>Dashboard Admin</h1>
            <p>Aquí se gestionarán los eventos, cupos y reportes</p>

            <EventosAdmin />
        </main>
    );
} */
// src/layouts/AdminLayout.jsx
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  if (!user) return null; // ya lo protege ProtectedRoute

  return (
    <div className="admin-layout" style={{ display: "flex", minHeight: "100vh" }}>
      {/* Sidebar */}
      <aside
        className="admin-sidebar"
        style={{
          width: 240,
          padding: 16,
          borderRight: "1px solid rgba(255,255,255,.08)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div className="admin-brand" style={{ fontWeight: 600, marginBottom: 8 }}>
          Panel Admin
        </div>
        <nav className="admin-nav" style={{ display: "grid", gap: 6 }}>
          <Link className="btn ghost" to="/admin">🏠 Dashboard</Link>
          <Link className="btn ghost" to="/admin/eventos">📅 Eventos</Link>
          <Link className="btn ghost" to="/admin/usuarios">👥 Usuarios</Link>
          <Link className="btn ghost" to="/admin/reportes">📊 Reportes</Link>
        </nav>
        <div style={{ marginTop: "auto" }}>
          <button
            className="btn ghost"
            onClick={async () => { await logout(); nav("/login"); }}
          >
            🔒 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="admin-content" style={{ flex: 1, padding: 20 }}>
        <Outlet />
      </main>
    </div>
  );
}
