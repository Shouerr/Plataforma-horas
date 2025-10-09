import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../app/firebase";


const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (u) => {
            if (!u) { setUser(null); setRole(null); setLoading(false); return; }
            setUser(u);
            try {
                const snap = await getDoc(doc(db, "users", u.uid));
                setRole(snap.exists() ? snap.data().role : null);
            } catch {setRole(null); }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    return (
        <AuthCtx.Provider value={{ user, role, loading}}>
            {children}
        </AuthCtx.Provider>
    );
}