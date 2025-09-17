import { Link } from "react-router-dom";

export default function NavBar() {
  const s = { marginRight: 12 };
  return (
    <nav style={{ padding: 12, borderBottom: "1px solid #ddd" }}>
      <Link to="/login" style={s}>Login</Link>
      <Link to="/estudiante" style={s}>Estudiante</Link>
      <Link to="/admin" style={s}>Admin</Link>
    </nav>
  );
}
