import React from "react";
import { Trash2, Edit3, Star } from "lucide-react";
import { usePreferences } from "../context/PreferencesContext";
import {
  ContextMenu as RadixContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "./ui/context-menu";

interface ContextMenuProps {
  children: React.ReactNode;
  onAction: (action: string) => void;
  isFavorite?: boolean;
  playSound: (type: any) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  children,
  onAction,
  isFavorite,
  playSound,
}) => {
  const { t } = usePreferences();

  return (
    <RadixContextMenu>
      <ContextMenuTrigger asChild>
        <div style={{ display: "contents" }}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64 premium-glass-black rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.1)] p-2 z-[300]">
        <ContextMenuItem
          onClick={() => { playSound("edit"); onAction("edit"); }}
          onMouseEnter={() => playSound("hover")}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[12px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white cursor-pointer transition-colors outline-none focus:bg-white/10 focus:text-white"
        >
          <Edit3 className="w-4 h-4" />
          {t("editMetadata")}
        </ContextMenuItem>
        
        <ContextMenuItem
          onClick={() => { playSound(isFavorite ? "favoriteOff" : "favoriteOn"); onAction("favorite"); }}
          onMouseEnter={() => playSound("hover")}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[12px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white cursor-pointer transition-colors outline-none focus:bg-white/10 focus:text-white"
        >
          <Star className={`w-4 h-4 ${isFavorite ? "text-amber-300 fill-amber-300" : ""}`} />
          {isFavorite ? t("removeFavorite") : t("addFavorite")}
        </ContextMenuItem>
        
        <ContextMenuSeparator className="bg-white/10 my-1 mx-2" />
        
        <ContextMenuItem
          onClick={() => { playSound("delete"); onAction("delete"); }}
          onMouseEnter={() => playSound("hover")}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-[12px] font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/10 hover:text-red-400 cursor-pointer transition-colors outline-none focus:bg-red-500/10 focus:text-red-400"
        >
          <Trash2 className="w-4 h-4 text-red-500" />
          {t("removeFromLibrary")}
        </ContextMenuItem>
      </ContextMenuContent>
    </RadixContextMenu>
  );
};

export default ContextMenu;
