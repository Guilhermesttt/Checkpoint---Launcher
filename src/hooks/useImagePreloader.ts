import { useEffect } from "react";

export const useImagePreloader = (urls: string[]) => {
  useEffect(() => {
    const uniqueUrls = Array.from(new Set(urls)).slice(0, 20);
    uniqueUrls.forEach((url) => {
      if (!url) return;
      const img = new Image();
      img.src = url;
    });
  }, [urls]);
};
