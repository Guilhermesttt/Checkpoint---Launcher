import { useEffect } from "react";
import html2canvas from "html2canvas";

export function useDomToCanvas(
    sourceRef: React.RefObject<HTMLElement>,
    targetCanvasRef: React.RefObject<HTMLCanvasElement>,
    { fps = 15 }: { fps?: number } = {}
) {
    useEffect(() => {
        let cancelled = false;
        let timeoutId: number;

        const capture = async () => {
            if (cancelled) return;
            const source = sourceRef.current;
            const target = targetCanvasRef.current;
            if (source && target) {
                try {
                    const snap = await html2canvas(source, {
                        backgroundColor: null, // mantém transparência onde não tem UI
                        scale: Math.min(window.devicePixelRatio || 1, 2),
                        logging: false,
                    });
                    const ctx = target.getContext("2d");
                    if (ctx) {
                        target.width = snap.width;
                        target.height = snap.height;
                        ctx.clearRect(0, 0, target.width, target.height);
                        ctx.drawImage(snap, 0, 0);
                    }
                } catch {
                    // captura falhou nesse ciclo, tenta de novo no próximo
                }
            }
            timeoutId = window.setTimeout(capture, 1000 / fps);
        };

        capture();
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [sourceRef, targetCanvasRef, fps]);
}