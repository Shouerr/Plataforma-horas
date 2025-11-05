// src/App.jsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { RouterProvider } from "react-router-dom";
import router from "./router/AppRouter";
import { AuthProvider } from "./context/AuthContext";

// Creamos el cliente global de React Query
const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {/* Aquí se manejan todas tus rutas (login, dashboard, etc.) */}
          <RouterProvider router={router} />

          {/* Notificaciones tipo “toast” */}
          <Toaster />
          <Sonner />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
