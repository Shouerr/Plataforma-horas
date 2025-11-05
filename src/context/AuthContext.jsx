import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../app/firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import toast from "react-hot-toast";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// --- timeout para promesas (seguridad) ---
const withTimeout = (promise, ms = 8000) =>
  Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);

// --- traducción corta de errores comunes ---
function authMsg(e) {
  const code = (e?.code || "").toLowerCase();
  if (code.includes("user-not-found")) return "Usuario no encontrado.";
  if (code.includes("wrong-password")) return "Contraseña incorrecta.";
  if (code.includes("invalid-credential")) return "Credenciales inválidas.";
  if (code.includes("too-many-requests")) return "Demasiados intentos. Intenta más tarde.";
  if (code.includes("network-request-failed")) return "Sin conexión. Revisa tu internet.";
  return e?.message || "Error de autenticación.";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState(true);

  // --- login seguro ---
  async function login(email, password) {
    setAuthLoading(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      toast.error(authMsg(e));
    } finally {
      setAuthLoading(false);
    }
  }

  // --- logout general ---
  async function logout() {
    try {
      await signOut(auth);
    } catch (_) {}
    setUser(null);
    setRole(null);
  }

  // --- resolver rol desde Firestore ---
  async function resolveRole(u) {
    setLoadingRole(true);
    try {
      const ref = doc(db, "users", u.uid);
      const snap = await withTimeout(getDoc(ref), 8000);

      if (!snap.exists()) {
        toast.error("Tu cuenta no tiene perfil activo. Contacta al administrador.");
        await logout();
        return;
      }

      const data = snap.data();
      const r = data.role || "estudiante";
      setRole(r);
    } catch (e) {
      console.warn("[resolveRole]", e);
      toast.error("No se pudo validar tu rol. Intenta de nuevo.");
      await logout();
    } finally {
      setLoadingRole(false);
    }
  }

  // --- escucha de sesión ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (!u) {
        setRole(null);
        setLoadingRole(false);
        return;
      }
      await resolveRole(u);
    });
    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({ user, role, login, logout, authLoading, loadingRole }),
    [user, role, authLoading, loadingRole]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
