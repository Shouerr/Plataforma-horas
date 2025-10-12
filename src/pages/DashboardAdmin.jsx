import EventosAdmin from "./EventosAdmin";

export default function DashboardAdmin() {
    return (
        <main style={{ padding: 24}}>
            <h1>Dashboard Admin</h1>
            <p>Aquí se gestionarán los eventos, cupos y reportes</p>

            <EventosAdmin />
        </main>
    );
}