import { Link } from "react-router-dom";

export default function NotFound() {
    return (
        <main style={{ padding: 24 }}>
            <h1>404 - Página no encontrada</h1>
            <Link to = "/login">Ir al Login</Link>
        </main>
    );
}