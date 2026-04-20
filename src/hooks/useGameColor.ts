import { useState, useEffect } from 'react';
import { FastAverageColor } from 'fast-average-color';

const fac = new FastAverageColor();

export const useGameColor = (imageUrl?: string) => {
  const [color, setColor] = useState({ hex: 'rgba(255,255,255,1)', isDark: false });

  useEffect(() => {
    if (!imageUrl) {
      setColor({ hex: 'rgba(255,255,255,1)', isDark: false });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    const handleLoad = () => {
      try {
        const extracted = fac.getColor(img);
        // To make the color more vibrant for accents, we can use the hex
        setColor({ hex: extracted.hex, isDark: extracted.isDark });
      } catch (e) {
        setColor({ hex: '#ffffff', isDark: false });
      }
    };

    const handleError = () => {
      setColor({ hex: '#ffffff', isDark: false });
    };

    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [imageUrl]);

  return color;
};
