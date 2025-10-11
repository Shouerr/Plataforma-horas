// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../app/firebase";

// Crear contexto global de autenticación
const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  // Monitorea cambios de sesión
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      setUser(u);
      try {
        const snap = await getDoc(doc(db, "users", u.uid));
        setRole(snap.exists() ? snap.data().role : null);
      } catch {
        setRole(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Función de cierre de sesión
  const logout = () => signOut(auth);

  // Helpers para roles
  const isAdmin = role === "admin";
  const isEstudiante = role === "estudiante";

  return (
    <AuthCtx.Provider
      value={{
        user,
        role,
        loading,
        isAdmin,
        isEstudiante,
        logout,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
