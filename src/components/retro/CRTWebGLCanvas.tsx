  import React, { useEffect, useRef, useState, useCallback } from "react";

  export interface CRTShaderParams {
    curvature: number; // 0.0 to 0.4
    dotPitch: number; // 1.5 to 8.0
    glowStrength: number; // 0.0 to 2.5
    rgbShift: number; // 0.0 to 0.015
    scanlines: number; // 0.0 to 1.0
    vignette: number; // 0.0 to 1.5
    glowColor: [number, number, number]; // [r, g, b] 0..1
    coreBoost: number; // 0.5 to 2.0
    flicker: number; // 0.0 to 1.0
    noise: number; // 0.0 to 1.0
  }

  export type CRTThemeId = "green" | "yellow" | "blue" | "gray";

  export interface CRTThemeConfig {
    id: CRTThemeId;
    name: string;
    glowColor: [number, number, number];
    primaryFont: string;
    monoFont: string;
    previewColor: string;
  }

  export const CRT_THEMES: CRTThemeConfig[] = [
    {
      id: "green",
      name: "Green PVM (Padrão)",
      glowColor: [0.1, 1.0, 0.35],
      primaryFont: "'Unbounded', 'Space Grotesk', sans-serif",
      monoFont: "'IBM Plex Mono', monospace",
      previewColor: "#10b981",
    },
    {
      id: "yellow",
      name: "Retro Arcade Yellow",
      glowColor: [1.0, 0.8, 0.05],
      primaryFont: "'Archivo Black', 'Arial Black', sans-serif",
      monoFont: "'Space Grotesk', monospace",
      previewColor: "#f59e0b",
    },
    {
      id: "blue",
      name: "8-Bit Space Blue",
      glowColor: [0.0, 0.95, 1.0],
      primaryFont: "'Space Mono', monospace",
      monoFont: "'JetBrains Mono', monospace",
      previewColor: "#00e5ff",
    },
    {
      id: "gray",
      name: "Studio Monochrome Gray",
      glowColor: [0.85, 0.95, 1.0],
      primaryFont: "'Plus Jakarta Sans', sans-serif",
      monoFont: "'Inter', monospace",
      previewColor: "#e2e8f0",
    },
  ];

  export interface CRTWebGLCanvasProps {
    params: CRTShaderParams;
    themeId?: CRTThemeId;
    headline?: string;
    subtitle?: string;
    badgeText?: string;
    itemsList?: Array<{ label: string; value: string }>;
    activeMode?: "shelf" | "showcase" | "emulator" | "matrix";
    className?: string;
    /**
     * Canvas offscreen (preenchido via html2canvas por um hook como useDomToCanvas)
     * contendo um snapshot da UI real (botões, navbar, barras etc). Quando fornecido,
     * esse snapshot é desenhado sobre o fundo procedural e passa pelo mesmo pipeline
     * do shader CRT — ou seja, os botões reais recebem curvatura, glow, scanlines etc.
     */
    uiCaptureCanvasRef?: React.RefObject<HTMLCanvasElement>;
  }

  const VERTEX_SHADER_SRC = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = (a_position + 1.0) * 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  const FRAGMENT_SHADER_SRC = `
    precision highp float;
    varying vec2 v_uv;
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_time;
    
    uniform float u_curvature;
    uniform float u_dotPitch;
    uniform float u_glowStrength;
    uniform float u_rgbShift;
    uniform float u_scanlines;
    uniform float u_vignette;
    uniform vec3 u_glowColor;
    uniform float u_coreBoost;
    uniform float u_flicker;
    uniform float u_noise;

    vec2 curveCoords(vec2 uv, float bend) {
      vec2 cc = uv - 0.5;
      float dist = dot(cc, cc);
      return uv + cc * (dist * bend * 1.35);
    }

    void main() {
      vec2 baseUV = vec2(v_uv.x, 1.0 - v_uv.y);
      vec2 curvedUV = curveCoords(baseUV, u_curvature);

      if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
        vec2 border = abs(curvedUV - 0.5) - 0.5;
        float bDist = length(max(border, 0.0));
        float borderGlow = exp(-bDist * 36.0) * 0.05;
        gl_FragColor = vec4(vec3(0.005, 0.008, 0.012) * (1.0 + borderGlow), 1.0);
        return;
      }

      vec3 baseSample = texture2D(u_texture, curvedUV).rgb;
      float baseLuma = dot(baseSample, vec3(0.299, 0.587, 0.114));
      float textProtect = pow(smoothstep(0.12, 0.4, baseLuma), 0.4);

      vec2 dirFromCenter = curvedUV - 0.5;
      float distFromCenter = length(dirFromCenter);
      float shiftAmount = u_rgbShift * (1.0 + distFromCenter * 0.9) * (1.0 - textProtect * 0.9);
      vec2 rOffset = dirFromCenter * shiftAmount;
      vec2 bOffset = -dirFromCenter * shiftAmount;

      float r = texture2D(u_texture, curvedUV + rOffset).r;
      float g = baseSample.g;
      float b = texture2D(u_texture, curvedUV + bOffset).b;
      vec3 sampledColor = vec3(r, g, b);

      float blurRadius = (0.0016 + distFromCenter * 0.0008) * u_glowStrength;
      vec4 bloom = vec4(0.0);
      bloom += texture2D(u_texture, curvedUV + vec2(-blurRadius, -blurRadius)) * 0.09;
      bloom += texture2D(u_texture, curvedUV + vec2(0.0, -blurRadius)) * 0.12;
      bloom += texture2D(u_texture, curvedUV + vec2(blurRadius, -blurRadius)) * 0.09;
      bloom += texture2D(u_texture, curvedUV + vec2(-blurRadius, 0.0)) * 0.12;
      bloom += texture2D(u_texture, curvedUV) * 0.16;
      bloom += texture2D(u_texture, curvedUV + vec2(blurRadius, 0.0)) * 0.12;
      bloom += texture2D(u_texture, curvedUV + vec2(-blurRadius, blurRadius)) * 0.09;
      bloom += texture2D(u_texture, curvedUV + vec2(0.0, blurRadius)) * 0.12;
      bloom += texture2D(u_texture, curvedUV + vec2(blurRadius, blurRadius)) * 0.09;

      float wideRadius = blurRadius * 3.6;
      vec4 wideBloom = vec4(0.0);
      wideBloom += texture2D(u_texture, curvedUV + vec2(-wideRadius, 0.0)) * 0.25;
      wideBloom += texture2D(u_texture, curvedUV + vec2(wideRadius, 0.0)) * 0.25;
      wideBloom += texture2D(u_texture, curvedUV + vec2(0.0, -wideRadius)) * 0.25;
      wideBloom += texture2D(u_texture, curvedUV + vec2(0.0, wideRadius)) * 0.25;

      float luma = dot(sampledColor, vec3(0.299, 0.587, 0.114));
      float bloomLuma = dot(bloom.rgb, vec3(0.299, 0.587, 0.114));
      float wideLuma = dot(wideBloom.rgb, vec3(0.299, 0.587, 0.114));

      vec3 hotCore = mix(u_glowColor * 0.9, vec3(1.0, 1.0, 1.0), pow(clamp(luma * u_coreBoost, 0.0, 1.0), 0.45));
      vec3 glowHalo = u_glowColor * (bloomLuma * 1.6 + wideLuma * 1.0) * u_glowStrength;
      vec3 finalColor = (sampledColor * hotCore) + glowHalo;

      vec2 fragCoord = gl_FragCoord.xy;
      float dotPitch = max(u_dotPitch, 1.0);
      vec2 dotGrid = fract(fragCoord / dotPitch);
      vec2 dotCenter = dotGrid - 0.5;
      float dotDist = length(dotCenter);
      float dotMask = smoothstep(0.5, 0.08, dotDist);

      int subpixel = int(mod(floor(fragCoord.x / (dotPitch * 0.33333)), 3.0));
      vec3 triadMask = vec3(0.35);
      if (subpixel == 0) triadMask = vec3(1.4, 0.35, 0.35);
      else if (subpixel == 1) triadMask = vec3(0.35, 1.4, 0.35);
      else triadMask = vec3(0.35, 0.55, 1.5);

      vec3 phosphorPattern = mix(vec3(0.55), triadMask, 0.55) * (0.72 + 0.28 * dotMask);
      phosphorPattern = mix(phosphorPattern, vec3(1.0), textProtect);
      finalColor *= phosphorPattern;

      float scanlineVal = sin(curvedUV.y * u_resolution.y * 1.15) * 0.5 + 0.5;
      float scanMod = pow(scanlineVal, 1.5) * (u_scanlines * 0.22) * (1.0 - textProtect * 0.9);
      finalColor *= (1.0 - scanMod);

      float microFlicker = 1.0 + (sin(u_time * 62.0) * 0.012 + sin(u_time * 121.0) * 0.007) * u_flicker;
      float pNoise = (fract(sin(dot(curvedUV + u_time * 0.02, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.018 * u_noise;
      finalColor *= microFlicker;
      finalColor += pNoise * (0.04 + luma * 0.12) * (1.0 - textProtect * 0.7);

      vec2 vUV = curvedUV * (1.0 - curvedUV.yx);
      float vign = vUV.x * vUV.y * 20.0;
      vign = clamp(pow(vign, 0.24 * u_vignette), 0.0, 1.0);
      finalColor *= vign;

      vec3 glassAmbience = vec3(0.01, 0.022, 0.035) * (1.0 - distFromCenter * 0.4);
      finalColor += glassAmbience;

      gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
    }
  `;

  export const CRTWebGLCanvas: React.FC<CRTWebGLCanvasProps> = ({
    params,
    themeId = "green",
    headline = "TEST PROTOCOL INITIATED_",
    subtitle = "SYSTEM ONLINE // PS2 EMULATION CORE ACTIVE // RESOLUTION 1080P",
    badgeText = "USER: VIKTOR",
    itemsList = [
      { label: "CORE 01/1", value: "SET" },
      { label: "CORE 02/1", value: "READY" },
      { label: "SYS TEST", value: "RUN" },
      { label: "SR-A", value: "SYNC" },
    ],
    activeMode = "showcase",
    className = "",
    uiCaptureCanvasRef,
  }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const glRef = useRef<WebGLRenderingContext | null>(null);
    const programRef = useRef<WebGLProgram | null>(null);
    const textureRef = useRef<WebGLTexture | null>(null);
    const uniformsRef = useRef<Record<string, WebGLUniformLocation | null>>({});
    const animFrameIdRef = useRef<number | null>(null);
    const startTimeRef = useRef<number>(performance.now());
    const [glSupported, setGlSupported] = useState<boolean>(true);

    const currentTheme = CRT_THEMES.find((t) => t.id === themeId) || CRT_THEMES[0];

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const gl =
        canvas.getContext("webgl", {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
        }) || (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

      if (!gl) {
        setGlSupported(false);
        return;
      }

      glRef.current = gl;

      const createShader = (type: number, src: string) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vertShader = createShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
      const fragShader = createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
      if (!vertShader || !fragShader) {
        setGlSupported(false);
        return;
      }

      const program = gl.createProgram();
      if (!program) {
        setGlSupported(false);
        return;
      }

      gl.attachShader(program, vertShader);
      gl.attachShader(program, fragShader);
      gl.linkProgram(program);

      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        setGlSupported(false);
        return;
      }

      programRef.current = program;
      gl.useProgram(program);

      const positionBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      const positions = new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1,
      ]);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

      const aPositionLoc = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(aPositionLoc);
      gl.vertexAttribPointer(aPositionLoc, 2, gl.FLOAT, false, 0, 0);

      uniformsRef.current = {
        u_texture: gl.getUniformLocation(program, "u_texture"),
        u_resolution: gl.getUniformLocation(program, "u_resolution"),
        u_time: gl.getUniformLocation(program, "u_time"),
        u_curvature: gl.getUniformLocation(program, "u_curvature"),
        u_dotPitch: gl.getUniformLocation(program, "u_dotPitch"),
        u_glowStrength: gl.getUniformLocation(program, "u_glowStrength"),
        u_rgbShift: gl.getUniformLocation(program, "u_rgbShift"),
        u_scanlines: gl.getUniformLocation(program, "u_scanlines"),
        u_vignette: gl.getUniformLocation(program, "u_vignette"),
        u_glowColor: gl.getUniformLocation(program, "u_glowColor"),
        u_coreBoost: gl.getUniformLocation(program, "u_coreBoost"),
        u_flicker: gl.getUniformLocation(program, "u_flicker"),
        u_noise: gl.getUniformLocation(program, "u_noise"),
      };

      if (!offscreenCanvasRef.current) {
        const offscreen = document.createElement("canvas");
        offscreen.width = 1920;
        offscreen.height = 1080;
        offscreenCanvasRef.current = offscreen;
      }

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      textureRef.current = texture;

      return () => {
        if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
        if (program && gl) gl.deleteProgram(program);
        if (texture && gl) gl.deleteTexture(texture);
      };
    }, []);

    // Render 2D UI com Tactical Years 2000s & Reference Theme Styles
    const renderOffscreenContent = useCallback(
      (timeSec: number, canvasWidth: number, canvasHeight: number) => {
        const offscreen = offscreenCanvasRef.current;
        if (!offscreen) return;

        if (offscreen.width !== canvasWidth || offscreen.height !== canvasHeight) {
          offscreen.width = canvasWidth;
          offscreen.height = canvasHeight;
        }

        const ctx = offscreen.getContext("2d");
        if (!ctx) return;

        const w = offscreen.width;
        const h = offscreen.height;

        // Dark background
        ctx.fillStyle = "#020407";
        ctx.fillRect(0, 0, w, h);

        // Subtle phosphor raster grid
        ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
        ctx.lineWidth = 1;
        const gridSize = 40;
        for (let x = 0; x < w; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
          ctx.stroke();
        }
        for (let y = 0; y < h; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y);
          ctx.stroke();
        }

        if (activeMode === "shelf") {
          const marginX = w * 0.055;
          const marginY = h * 0.055;
          const frameW = w - marginX * 2;
          const frameH = h - marginY * 2;

          // Outer Tactical Frame
          ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
          ctx.lineWidth = 1;
          ctx.strokeRect(marginX, marginY, frameW, frameH);

          // Corner Brackets (Imagem 3)
          const bLen = Math.min(32, w * 0.025);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          // Top-left
          ctx.beginPath(); ctx.moveTo(marginX, marginY + bLen); ctx.lineTo(marginX, marginY); ctx.lineTo(marginX + bLen, marginY); ctx.stroke();
          // Top-right
          ctx.beginPath(); ctx.moveTo(marginX + frameW - bLen, marginY); ctx.lineTo(marginX + frameW, marginY); ctx.lineTo(marginX + frameW, marginY + bLen); ctx.stroke();
          // Bottom-left
          ctx.beginPath(); ctx.moveTo(marginX, marginY + frameH - bLen); ctx.lineTo(marginX, marginY + frameH); ctx.lineTo(marginX + bLen, marginY + frameH); ctx.stroke();
          // Bottom-right
          ctx.beginPath(); ctx.moveTo(marginX + frameW - bLen, marginY + frameH); ctx.lineTo(marginX + frameW, marginY + frameH); ctx.lineTo(marginX + frameW, marginY + frameH - bLen); ctx.stroke();

          return;
        }

        // SHOWCASE / TACTICAL HUD
        ctx.font = `bold 13px ${currentTheme.monoFont}`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.fillText(`${badgeText.toUpperCase()}`, 50, 110);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(200, 96, 40, 18);
        ctx.fillStyle = "#020407";
        ctx.fillText("02", 212, 110);

        ctx.fillStyle = "#ffffff";
        ctx.fillText("↗", 255, 110);

        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(50, 125);
        ctx.lineTo(w - 50, 125);
        ctx.stroke();

        const titleSize = Math.min(68, Math.max(34, Math.floor(w * 0.042)));
        ctx.font = `900 ${titleSize}px ${currentTheme.primaryFont}`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.fillText(`> ${headline}`, 60, 215);

        ctx.font = `bold 14px ${currentTheme.monoFont}`;
        ctx.textAlign = "right";
        ctx.fillText("12 / 158", w - 60, 215);

        ctx.font = `900 32px ${currentTheme.monoFont}`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "left";
        ctx.fillText("▶ ▶ ▶ ▶ ▶ ▶ ▶", 60, 320);

        const blockW = 130;
        const blockH = 50;
        const startX = 60;
        const startY = 380;

        itemsList.forEach((item, idx) => {
          const bx = startX + idx * (blockW + 15);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(bx, startY, blockW, blockH);

          ctx.font = `bold 10px ${currentTheme.monoFont}`;
          ctx.fillStyle = "#ffffff";
          ctx.textAlign = "center";
          ctx.fillText(item.label, bx + blockW / 2, startY + 20);
          ctx.fillText(item.value, bx + blockW / 2, startY + 38);
        });

        const barY = h - 100;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(60, barY, w - 120, 28);
        ctx.fillStyle = "#020407";
        ctx.font = `bold 12px ${currentTheme.monoFont}`;
        ctx.textAlign = "left";
        ctx.fillText("  F1.ESTANTE_3D    F2.JOGOS_RETRO    F3.CONQUISTAS    F4.BUSCAR_DB    F5.CRT_SHADERS", 70, barY + 18);
        ctx.textAlign = "right";
        ctx.fillText("SCHR V15.04.3888  ", w - 70, barY + 18);
      },
      [headline, subtitle, badgeText, itemsList, activeMode, currentTheme]
    );

    useEffect(() => {
      const canvas = canvasRef.current;
      const gl = glRef.current;
      const program = programRef.current;
      const offscreen = offscreenCanvasRef.current;
      const texture = textureRef.current;

      if (!canvas || !gl || !program || !offscreen || !texture) return;

      let isRunning = true;

      const render = () => {
        if (!isRunning) return;

        const now = performance.now();
        const timeSec = (now - startTimeRef.current) / 1000.0;

        const rect = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const displayWidth = Math.floor(rect.width * dpr);
        const displayHeight = Math.floor(rect.height * dpr);

        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
          gl.viewport(0, 0, displayWidth, displayHeight);
        }

        // 1. Desenha o fundo procedural (grid, HUD estático, bezel etc.)
        renderOffscreenContent(timeSec, displayWidth, displayHeight);

        // 2. Sobrepõe o snapshot da UI real (botões, navbar, barra inferior, setas)
        //    capturado via html2canvas por um hook externo (ex: useDomToCanvas).
        //    Como isso acontece ANTES de subir a textura pro WebGL, os botões
        //    passam pelo mesmo pipeline do shader (curvatura, glow, scanlines...).
        const uiCapture = uiCaptureCanvasRef?.current;
        if (uiCapture && uiCapture.width > 0 && uiCapture.height > 0) {
          const octx = offscreen.getContext("2d");
          if (octx) {
            octx.drawImage(uiCapture, 0, 0, offscreen.width, offscreen.height);
          }
        }

        // 3. Sobe o resultado combinado como textura
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, offscreen);

        gl.useProgram(program);
        const u = uniformsRef.current;

        if (u.u_resolution) gl.uniform2f(u.u_resolution, canvas.width, canvas.height);
        if (u.u_time) gl.uniform1f(u.u_time, timeSec);
        if (u.u_curvature) gl.uniform1f(u.u_curvature, params.curvature);
        if (u.u_dotPitch) gl.uniform1f(u.u_dotPitch, params.dotPitch * Math.min(canvas.width / 1600, 1.0));
        if (u.u_glowStrength) gl.uniform1f(u.u_glowStrength, params.glowStrength);
        if (u.u_rgbShift) gl.uniform1f(u.u_rgbShift, params.rgbShift);
        if (u.u_scanlines) gl.uniform1f(u.u_scanlines, params.scanlines);
        if (u.u_vignette) gl.uniform1f(u.u_vignette, params.vignette);
        if (u.u_glowColor) gl.uniform3fv(u.u_glowColor, params.glowColor);
        if (u.u_coreBoost) gl.uniform1f(u.u_coreBoost, params.coreBoost);
        if (u.u_flicker) gl.uniform1f(u.u_flicker, params.flicker);
        if (u.u_noise) gl.uniform1f(u.u_noise, params.noise);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        animFrameIdRef.current = requestAnimationFrame(render);
      };

      animFrameIdRef.current = requestAnimationFrame(render);

      return () => {
        isRunning = false;
        if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      };
    }, [params, renderOffscreenContent, uiCaptureCanvasRef]);

    if (!glSupported) {
      return (
        <div className={`fixed inset-0 w-full h-full flex items-center justify-center p-8 bg-black text-cyan-400 font-mono text-center ${className}`}>
          <div>
            <h2 className="text-5xl font-bold mb-4 text-white drop-shadow-[0_0_20px_#00e5ff]">
              {headline}
            </h2>
            <p className="text-cyan-300 max-w-xl mx-auto">{subtitle}</p>
          </div>
        </div>
      );
    }

    return (
      <div className={`fixed inset-0 w-screen h-screen overflow-hidden select-none bg-black ${className}`}>
        <canvas ref={canvasRef} className="w-full h-full block select-none" />
      </div>
    );
  };

  export default CRTWebGLCanvas;