import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../app/firebase";
import { useAuth } from "../context/AuthContext";
import "./login.css";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState({ type: "", text: "" });
  const nav = useNavigate();

  const { user, role, login, authLoading, loadingRole } = useAuth();

  // Redirige cuando ya hay sesión y rol
  useEffect(() => {
    if (!user || !role) return;
    nav(role === "admin" ? "/admin" : "/estudiante", { replace: true });
  }, [user, role, nav]);

  // Al cambiar de pestaña, limpia estados
  useEffect(() => setMsg({ type: "", text: "" }), [mode]);

  // --- REGISTRO ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, "users", cred.user.uid), {
        email,
        role: "estudiante",
        createdAt: new Date(),
      });
      setMsg({ type: "success", text: "Cuenta creada. Redirigiendo…" });
    } catch (err) {
      console.error("Register error:", err);
      let text = "No se pudo crear la cuenta.";
      if (err?.code === "auth/weak-password") text = "Contraseña muy débil.";
      if (err?.code === "auth/email-already-in-use") text = "Correo ya registrado.";
      setMsg({ type: "error", text });
    }
  };

  // --- LOGIN (usa el AuthContext) ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    await login(email, pass); // El contexto maneja errores y estados
  };

  const disabled = authLoading || loadingRole || !!user;

  return (
    <div className="auth-wrap">
      <div className="card">
        <div className="hdr">
          <LogoIcon />
          <div>
            <div className="tiny">EGH Sistema</div>
            <h1>{mode === "login" ? "Iniciar Sesión" : "Crear Cuenta"}</h1>
            <p className="lead">
              {mode === "login"
                ? "Ingresa tus credenciales para acceder"
                : "Completa tus datos para registrarte"}
            </p>
          </div>
        </div>

        <div className="tabs">
          <button
            className={`tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            disabled={disabled}
          >
            Ya tengo cuenta
          </button>
          <button
            className={`tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            disabled={disabled}
          >
            Registrarme
          </button>
        </div>

        {/* Estado / Rol */}
        {user && !role && (
          <div className="msg info" style={{ marginTop: 8 }}>
            Validando tu rol… 🔎
          </div>
        )}
        {user && role && (
          <div className="msg success" style={{ marginTop: 8 }}>
            Detectamos tu rol:{" "}
            <b>{role === "admin" ? "Administrador" : "Estudiante"}</b>. Redirigiendo…
          </div>
        )}

        <form onSubmit={mode === "login" ? handleLogin : handleRegister}>
          <label className="lbl">Correo institucional</label>
          <input
            className="inp"
            type="email"
            placeholder="tu.correo@estudiante.egh.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={disabled}
          />

          <label className="lbl">Contraseña</label>
          <input
            className="inp"
            type="password"
            placeholder="••••••••"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            disabled={disabled}
          />

          {msg.text && <div className={`msg ${msg.type}`}>{msg.text}</div>}

          <div className="row">
            <button className="btn" type="submit" disabled={disabled}>
              {authLoading || loadingRole
                ? "Procesando…"
                : mode === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setEmail("");
                setPass("");
                setMsg({ type: "", text: "" });
              }}
              disabled={disabled}
            >
              Limpiar
            </button>
          </div>
        </form>

        <hr className="hr" />
        <p className="tiny center">© 2025 Escuela de Gastronomía y Hotelería</p>
      </div>
    </div>
  );
}

function LogoIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#g)" />
      <path
        d="M8 12h8M8 15h6M8 9h8"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
