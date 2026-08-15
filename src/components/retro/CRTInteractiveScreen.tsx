
import React, { useRef } from "react";
import { CRTWebGLCanvas, type CRTShaderParams, type CRTThemeId } from "./CRTWebGLCanvas";
import { useDomToCanvas } from "../../hooks/useDomToCanvas";

interface CRTInteractiveScreenProps {
    params: CRTShaderParams;
    themeId?: CRTThemeId;
    children: React.ReactNode;
}

export function CRTInteractiveScreen({ params, themeId, children }: CRTInteractiveScreenProps) {
    const uiRef = useRef<HTMLDivElement>(null);
    const captureCanvasRef = useRef<HTMLCanvasElement>(document.createElement("canvas"));

    useDomToCanvas(uiRef, captureCanvasRef, { fps: 15 });

    return (
        <div className="fixed inset-0 w-screen h-screen bg-black">
            {/* Camada 0: UI real, normal, opaca — vira textura do shader */}
            <div ref={uiRef} className="absolute inset-0">
                {children}
            </div>

            {/* Camada 1: versão com CRT por cima, não recebe clique */}
            <div className="absolute inset-0 pointer-events-none">
                <CRTWebGLCanvas params={params} themeId={themeId} uiCaptureCanvasRef={captureCanvasRef} />
            </div>
        </div>
    );
}