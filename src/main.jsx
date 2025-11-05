// src/main.jsx
import "./app/firebase";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import router from "./router/AppRouter";
import { AuthProvider } from "./context/AuthContext";
import { Toaster } from "react-hot-toast";
import "./index.css";
import { ThemeProvider, useTheme } from "./context/ThemeContext";

function AppWrapper() {
  const { theme } = useTheme();

  const baseStyle = {
    background: "#111827", // negro siempre
    color: "#fff",
    borderRadius: "12px",
    border: theme === "dark" ? "1px solid rgba(255,255,255,.08)" : "1px solid rgba(0,0,0,.15)",
  };

  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 3000,
          // 🔥 forzamos negro en ambos temas
          style: baseStyle,
          success: {
            iconTheme: { primary: "#16a34a", secondary: "white" },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "white" },
          },
        }}
      />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AppWrapper />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
