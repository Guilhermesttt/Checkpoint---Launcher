import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Edit3, Star } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  onAction: (action: string) => void;
  isFavorite?: boolean;
  isEdit?: boolean;
  playSound: (type: any) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  onAction,
  isFavorite,
  playSound,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
          <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          className="fixed z-200 w-64 premium-glass-black rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.1)] p-2"
          style={{ left: x, top: y }}
        >
          <div className="flex flex-col gap-1">
            <MenuButton
              playSound={playSound}
              icon={<Edit3 className="w-4 h-4" />}
              label="Editar Metadados"
              onClick={() => onAction("edit")}
            />
            <MenuButton
              playSound={playSound}
              icon={<Star className={`w-4 h-4 ${isFavorite ? "text-amber-300 fill-amber-300" : ""}`} />}
              label={isFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
              onClick={() => onAction("favorite")}
            />
            <div className="h-px bg-white/10 my-1 mx-2" />
            <MenuButton
              playSound={playSound}
              icon={<Trash2 className="w-4 h-4 text-red-500" />}
              label="Remover da Biblioteca"
              onClick={() => onAction("delete")}
              className="text-red-500 hover:bg-red-500/10"
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const MenuButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
  playSound: (type: any) => void;
}> = ({ icon, label, onClick, className = "", playSound }) => (
  <button
    onClick={() => {
      onClick();
      playSound("select");
    }}
    onMouseEnter={() => playSound("navigate")}
    className={`
      w-full flex items-center gap-4 px-4 py-3 rounded-xl
      text-[11px] font-bold uppercase tracking-wider text-white/60
      hover:bg-white/10 hover:text-white transition-all
      ${className}
    `}
  >
    {icon}
    {label}
  </button>
);

export default ContextMenu;
