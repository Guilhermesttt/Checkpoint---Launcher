import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CategoryBarProps {
  categories: Array<string | { id: string; label: string }>;
  activeCategory: string;
  onCategoryChange?: (category: string) => void;
  playSound: (type: any) => void;
  disableKeyboardShortcuts?: boolean;
}

/**
 * PS5-style category navigation with Liquid Glass design
 */
const CategoryBar: React.FC<CategoryBarProps> = ({
  categories,
  activeCategory,
  onCategoryChange,
  playSound,
  disableKeyboardShortcuts = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const normalizedCategories = categories.map((category) =>
    typeof category === "string" ? { id: category, label: category } : category,
  );

  // Keyboard navigation: Q = prev, E = next
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disableKeyboardShortcuts) return;

      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
        return;
      }

      if (e.key.toLowerCase() !== "q" && e.key.toLowerCase() !== "e") return;
      const currentIndex = normalizedCategories.findIndex((category) => category.id === activeCategory);
      if (e.key.toLowerCase() === "q") {
        e.preventDefault();
        const nextIndex = (currentIndex - 1 + normalizedCategories.length) % normalizedCategories.length;
        onCategoryChange?.(normalizedCategories[nextIndex].id);
        playSound("navigate");
      } else if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % normalizedCategories.length;
        onCategoryChange?.(normalizedCategories[nextIndex].id);
        playSound("navigate");
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [activeCategory, disableKeyboardShortcuts, normalizedCategories, onCategoryChange, playSound]);

  // Auto-scroll active button into view
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const activeBtn = container.querySelector("[data-active='true']");
    if (activeBtn) {
      (activeBtn as HTMLElement).scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeCategory]);

  const handlePrev = () => {
    const currentIndex = normalizedCategories.findIndex((category) => category.id === activeCategory);
    const nextIndex = (currentIndex - 1 + normalizedCategories.length) % normalizedCategories.length;
    onCategoryChange?.(normalizedCategories[nextIndex].id);
    playSound("navigate");
  };

  const handleNext = () => {
    const currentIndex = normalizedCategories.findIndex((category) => category.id === activeCategory);
    const nextIndex = (currentIndex + 1) % normalizedCategories.length;
    onCategoryChange?.(normalizedCategories[nextIndex].id);
    playSound("navigate");
  };

  return (
    <div className="flex items-center gap-4 px-8 md:px-12 py-4 select-none">
      {/* Prev Button */}
      <button
        onClick={handlePrev}
        onMouseEnter={() => playSound("navigate")}
        className="shrink-0 w-10 h-10 rounded-xl liquid-glass-subtle flex items-center justify-center
          hover:bg-white/10 transition-all active:scale-95 group"
        aria-label="Previous category"
      >
        <ChevronLeft className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
      </button>

      {/* Categories */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar"
      >
        {normalizedCategories.map((category) => {
          const isActive = activeCategory === category.id;

          return (
            <button
              key={category.id}
              data-active={isActive}
              onClick={() => {
                onCategoryChange?.(category.id);
                playSound("select");
              }}
              onMouseEnter={() => playSound("navigate")}
              className={`
                relative px-6 py-3 rounded-xl
                text-[11px] font-bold tracking-[0.2em] uppercase
                whitespace-nowrap
                transition-all duration-300
                ${isActive 
                  ? "text-white" 
                  : "text-white/30 hover:text-white/60 hover:bg-white/5"
                }
              `}
            >
              {/* Animated Liquid Glass background */}
              {isActive && (
                <motion.div
                  layoutId="category-pill"
                  className="absolute inset-0 rounded-xl liquid-glass"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}

              {/* Label */}
              <span className="relative z-10 flex items-center gap-2">
                {category.label}
                {isActive && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-1.5 h-1.5 rounded-full bg-blue-400"
                    style={{ boxShadow: "0 0 10px rgba(96, 165, 250, 0.8)" }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Next Button */}
      <button
        onClick={handleNext}
        onMouseEnter={() => playSound("navigate")}
        className="shrink-0 w-10 h-10 rounded-xl liquid-glass-subtle flex items-center justify-center
          hover:bg-white/10 transition-all active:scale-95 group"
        aria-label="Next category"
      >
        <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-white/80 transition-colors" />
      </button>

      {/* Keyboard Hints */}
      <div className="hidden md:flex items-center gap-3 ml-4">
        <KeyHint label="Q" />
        <span className="text-[9px] font-bold tracking-[0.2em] text-white/20 uppercase">Navegar</span>
        <KeyHint label="E" />
      </div>
    </div>
  );
};

/** Small keyboard hint indicator */
const KeyHint: React.FC<{ label: string }> = ({ label }) => (
  <div
    className="shrink-0 flex items-center justify-center
      w-7 h-6 rounded-md
      border border-white/15 bg-white/5
      text-[10px] font-bold tracking-wide text-white/30
      transition-colors duration-300 hover:text-white/50 hover:border-white/25"
  >
    {label}
  </div>
);

export default CategoryBar;
