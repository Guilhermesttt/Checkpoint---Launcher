import React, { useEffect, useState } from "react";

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
}

const SplitText: React.FC<SplitTextProps> = ({ text, className, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => clearTimeout(timer);
  }, [text, delay]);

  return (
    <span className={`inline-flex overflow-hidden ${className}`}>
      {text.split("").map((char, index) => (
        <span
          key={`${char}-${index}`}
          className={`
            inline-block transition-all duration-500 ease-out
            ${isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}
          `}
          style={{ transitionDelay: `${index * 30}ms` }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
};

export default SplitText;
