// src/components/layout/Header.jsx
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";

import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Moon, Sun, LogOut, User, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useState } from "react";

export default function Header() {
  const { user, role, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return null;

  const name = user.displayName || user.name || "Usuario";
  const email = user.email || "";
  const photo = user.photoURL || user.avatar || "";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase();

  return (
    <header className="bg-card border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
        {/* Marca */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-500 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">UL</span>
          </div>
          <div className="truncate">
            <h1 className="text-xl font-bold text-foreground leading-tight truncate">
              Universidad Latina
            </h1>
            <p className="text-sm text-muted-foreground truncate">
              Escuela de Gastronomía y Hotelería
            </p>
          </div>
        </div>

        {/* Nav (desktop) */}
        <nav className="hidden md:flex items-center gap-2">
          <RoleNav role={role} />
        </nav>

        {/* Acciones */}
        <div className="flex items-center gap-2">
          {/* Toggle tema */}
          <Button variant="outline" size="icon" onClick={toggleTheme} title="Cambiar tema">
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
          </Button>

          {/* Menú móvil: navegación + perfil */}
          <DropdownMenu open={mobileOpen} onOpenChange={setMobileOpen}>
            <DropdownMenuTrigger asChild className="md:hidden">
              <Button variant="outline" size="icon" aria-label="Menú">
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 md:hidden">
              {/* Nav por rol en móvil */}
              <div className="px-2 py-1.5">
                <MobileRoleNav role={role} onNavigate={() => setMobileOpen(false)} />
              </div>
              <DropdownMenuSeparator />
              {/* Perfil */}
              <div className="flex flex-col space-y-1 px-2 pb-2">
                <p className="text-sm font-medium leading-none">{name}</p>
                {email && <p className="text-xs leading-none text-muted-foreground">{email}</p>}
              </div>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Avatar / menú de usuario (desktop) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild className="hidden md:block">
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={photo} alt={name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-600 to-indigo-500 text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56" align="end">
              <div className="flex flex-col space-y-1 p-2">
                <p className="text-sm font-medium leading-none">{name}</p>
                {email && <p className="text-xs leading-none text-muted-foreground">{email}</p>}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Nav (sub-barra visible solo en desktop para separar visualmente) */}
      <div className="hidden md:block border-t border-border">
        <div className="container mx-auto px-4 py-2">
          <RoleNav role={role} compact />
        </div>
      </div>
    </header>
  );
}

/* ---------- Nav por rol (desktop) ---------- */
function RoleNav({ role, compact = false }) {
  const base =
    "px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-muted";
  const active =
    "bg-muted text-foreground";
  const inactive = "text-muted-foreground";

  if (role === "admin") {
    return (
      <div className={`flex items-center gap-1 ${compact ? "" : "ml-4"}`}>
        <NavLink
          to="/admin"
          className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
          end
        >
          Panel
        </NavLink>
        {/* No mostramos rutas viejas (como /admin/eventos); se navega al detalle desde el propio panel */}
      </div>
    );
  }

  // Estudiante
  return (
    <div className={`flex items-center gap-1 ${compact ? "" : "ml-4"}`}>
      <NavLink
        to="/estudiante"
        className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
        end
      >
        Eventos
      </NavLink>
      <NavLink
        to="/estudiante/mis-citas"
        className={({ isActive }) => `${base} ${isActive ? active : inactive}`}
      >
        Mis citas
      </NavLink>
    </div>
  );
}

/* ---------- Nav móvil dentro del dropdown ---------- */
function MobileRoleNav({ role, onNavigate }) {
  const link =
    "block w-full px-3 py-2 rounded-md text-sm font-medium hover:bg-muted text-foreground";

  if (role === "admin") {
    return (
      <div className="grid gap-1">
        <NavLink to="/admin" className={link} onClick={onNavigate} end>
          Panel
        </NavLink>
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <NavLink to="/estudiante" className={link} onClick={onNavigate} end>
        Eventos
      </NavLink>
      <NavLink to="/estudiante/mis-citas" className={link} onClick={onNavigate}>
        Mis citas
      </NavLink>
    </div>
  );
}
