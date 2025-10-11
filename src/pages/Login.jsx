import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {signInWithEmailAndPassword, createUserWithEmailAndPassword} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../app/firebase";
import { useAuth } from "../context/AuthContext";
import "./login.css";

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false); // <-- boolean
  const [msg, setMsg] = useState({ type: "", text: "" });
  const nav = useNavigate();
  const { user, role } = useAuth();

  // --- helper: timeout defensivo ---
  const withTimeout = (promise, ms = 12000) =>
    Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
    ]);

  // Redirige cuando ya hay sesión y rol
  useEffect(() => {
    if (!user || !role) return;
    nav(role === "admin" ? "/admin" : "/estudiante", { replace: true });
  }, [user, role, nav]);

  // Al cambiar de pestaña, limpia estados y asegura que el botón no quede pegado
  useEffect(() => {
    setLoading(false);
    setMsg({ type: "", text: "" });
  }, [mode]);

  // --- LOGIN ---
  const handleLogin = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    setLoading(true);
    try {
      await withTimeout(signInWithEmailAndPassword(auth, email, pass));
      setMsg({ type: "success", text: "Sesión iniciada." });
    } catch (err) {
      console.error("Login error:", err);
      const text =
        err?.message === "timeout"
          ? "Tiempo de espera agotado. Revisa tu conexión/bloqueadores."
          : err?.code === "auth/invalid-credential"
          ? "Credenciales inválidas."
          : "Error al iniciar sesión.";
      setMsg({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  // --- REGISTRO ---
  const handleRegister = async (e) => {
    e.preventDefault();
    setMsg({ type: "", text: "" });
    setLoading(true);
    try {
      const cred = await withTimeout(
        createUserWithEmailAndPassword(auth, email, pass)
      );
      // crea perfil con rol por defecto
      await withTimeout(
        setDoc(doc(db, "users", cred.user.uid), {
          email,
          role: "estudiante",
          createdAt: new Date(),
        })
      );
      setMsg({ type: "success", text: "Cuenta creada. Redirigiendo…" });
    } catch (err) {
      console.error("Register error:", err);
      let text = "No se pudo crear la cuenta.";
      if (err?.message === "timeout") text = "Tiempo de espera agotado.";
      if (err?.code === "auth/weak-password") text = "La contraseña es muy débil (mín 6).";
      if (err?.code === "auth/email-already-in-use") text = "Ese correo ya está registrado.";
      setMsg({ type: "error", text });
    } finally {
      setLoading(false);
    }
  };

  // desactivar formulario si ya hay sesión o está cargando
  const formDisabled = loading || !!user;

  return (
    <div className="auth-wrap">
      <div className="card" style={{ position: "relative", zIndex: 10 }}>
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

        <div className="tabs" role="tablist" aria-label="modes">
          <button
            className={`tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            role="tab"
            aria-selected={mode === "login"}
            disabled={formDisabled}
          >
            Ya tengo cuenta
          </button>
          <button
            className={`tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            role="tab"
            aria-selected={mode === "register"}
            disabled={formDisabled}
          >
            Registrarme
          </button>
        </div>

        {/* Mensaje de estado/rol */}
        {user && !role && (
          <div className="msg info" style={{ marginTop: 8 }}>
            Validando tu rol… 🔎
          </div>
        )}
        {user && role && (
          <div className="msg success" style={{ marginTop: 8 }}>
            Detectamos tu rol: <b>{role === "admin" ? "Administrador" : "Estudiante"}</b>. Redirigiendo…
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
            disabled={formDisabled}
          />

          <label className="lbl">Contraseña</label>
          <input
            className="inp"
            type="password"
            placeholder="••••••••"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            required
            disabled={formDisabled}
          />

          {msg?.text && <div className={`msg ${msg.type}`}>{msg.text}</div>}

          <div className="row">
            <button className="btn" type="submit" disabled={formDisabled}>
              {loading
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
              disabled={formDisabled}
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
      <path d="M8 12h8M8 15h6M8 9h8" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
