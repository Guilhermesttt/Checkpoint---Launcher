import React from "react";
import { LogOut, Settings, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import type { LauncherLanguage } from "../../context/PreferencesContext";

interface ProfileDropdownProps {
  userDisplay: string;
  email?: string;
  avatarUrl?: string;
  onLogout: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  language?: LauncherLanguage;
}

const dropdownCopy = {
  "pt-BR": { identity: "Identidade", profile: "Ver perfil", settings: "Configurações", logout: "Sair" },
  "en-US": { identity: "Identity", profile: "View profile", settings: "Settings", logout: "Sign out" },
  "es-ES": { identity: "Identidad", profile: "Ver perfil", settings: "Configuración", logout: "Salir" },
  "fr-FR": { identity: "Identité", profile: "Voir le profil", settings: "Paramètres", logout: "Se déconnecter" },
  "de-DE": { identity: "Identität", profile: "Profil anzeigen", settings: "Einstellungen", logout: "Abmelden" },
  "it-IT": { identity: "Identità", profile: "Vedi profilo", settings: "Impostazioni", logout: "Esci" },
} as const;

export function ProfileDropdown({
  userDisplay,
  email,
  avatarUrl,
  onLogout,
  onOpenProfile,
  onOpenSettings,
  language = "pt-BR",
}: ProfileDropdownProps) {
  const initials = userDisplay.slice(0, 2).toUpperCase();
  const copy = dropdownCopy[language];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-2xl p-1.5 transition-colors hover:bg-white/5 active:scale-95 outline-none focus-visible:ring-2 focus-visible:ring-white/20">
          <div className="flex flex-col items-end pl-2">
            <span className="text-[8px] font-black uppercase tracking-widest text-white/30">
              {copy.identity}
            </span>
            <span className="text-[10px] font-black uppercase text-white/80">
              {userDisplay}
            </span>
          </div>
          <div className="h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
            {avatarUrl ? (
              <img src={avatarUrl} alt={userDisplay} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-black text-white/50">
                {initials}
              </div>
            )}
          </div>
        </button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent
        className="w-64 rounded-[20px] border border-white/10 bg-[#09090b]/95 p-2 shadow-2xl backdrop-blur-xl"
        align="end"
        sideOffset={12}
      >
        <DropdownMenuLabel className="p-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold text-white">{userDisplay}</span>
            {email && <span className="text-xs font-medium text-white/40">{email}</span>}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuGroup className="p-1">
          {onOpenProfile && (
            <DropdownMenuItem
              onClick={onOpenProfile}
              className="flex cursor-pointer items-center gap-3 rounded-xl p-3 text-xs font-semibold text-white/70 transition-colors focus:bg-white/10 focus:text-white"
            >
              <User className="h-4 w-4" />
              {copy.profile}
            </DropdownMenuItem>
          )}
          {onOpenSettings && (
            <DropdownMenuItem
              onClick={onOpenSettings}
              className="flex cursor-pointer items-center gap-3 rounded-xl p-3 text-xs font-semibold text-white/70 transition-colors focus:bg-white/10 focus:text-white"
            >
              <Settings className="h-4 w-4" />
              {copy.settings}
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/10" />
        <div className="p-1">
          <DropdownMenuItem
            onClick={onLogout}
            className="flex cursor-pointer items-center gap-3 rounded-xl p-3 text-xs font-bold text-red-400 transition-colors focus:bg-red-500/15 focus:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            {copy.logout}
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
