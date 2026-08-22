import React, { useEffect, useRef } from "react";

interface PherieliumCosmicBackgroundProps {
  accentColor?: string;
}

export const PherieliumCosmicBackground: React.FC<PherieliumCosmicBackgroundProps> = ({
  accentColor = "#7DFFB2",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, targetX: 0.5, targetY: 0.5 });
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX / window.innerWidth;
      mouseRef.current.targetY = e.clientY / window.innerHeight;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    // Stars generation
    const starCount = Math.min(180, Math.floor((width * height) / 9000));
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.6 + 0.3,
      baseAlpha: Math.random() * 0.7 + 0.2,
      twinkleSpeed: Math.random() * 0.02 + 0.005,
      twinkleOffset: Math.random() * Math.PI * 2,
      depth: Math.random() * 0.8 + 0.2,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
    }));

    // Floating Cosmic Orbital Nodes
    const nodeCount = 28;
    const nodes = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 2 + 1,
    }));

    let time = 0;

    const render = () => {
      time += 0.016;

      // Smooth mouse interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mx = (mouseRef.current.x - 0.5) * 40;
      const my = (mouseRef.current.y - 0.5) * 40;

      // Background clear: Deep Space absolute black
      ctx.fillStyle = "#030408";
      ctx.fillRect(0, 0, width, height);

      // 1. Subtle Radial Cosmic Nebula Glows
      const grad1 = ctx.createRadialGradient(
        width * 0.3 + mx * 0.5,
        height * 0.25 + my * 0.5,
        0,
        width * 0.3 + mx * 0.5,
        height * 0.25 + my * 0.5,
        width * 0.6
      );
      grad1.addColorStop(0, "rgba(10, 30, 24, 0.22)");
      grad1.addColorStop(0.5, "rgba(5, 14, 18, 0.10)");
      grad1.addColorStop(1, "rgba(3, 4, 8, 0)");
      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      const grad2 = ctx.createRadialGradient(
        width * 0.75 - mx * 0.4,
        height * 0.7 - my * 0.4,
        0,
        width * 0.75 - mx * 0.4,
        height * 0.7 - my * 0.4,
        width * 0.5
      );
      grad2.addColorStop(0, "rgba(8, 20, 38, 0.18)");
      grad2.addColorStop(0.6, "rgba(4, 10, 20, 0.06)");
      grad2.addColorStop(1, "rgba(3, 4, 8, 0)");
      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      // 2. Render Starfield with Parallax
      for (const s of stars) {
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        const starX = s.x + mx * s.depth;
        const starY = s.y + my * s.depth;

        const twinkle = Math.sin(time * s.twinkleSpeed * 60 + s.twinkleOffset) * 0.3 + 0.7;
        const alpha = Math.min(1, Math.max(0, s.baseAlpha * twinkle));

        ctx.fillStyle = `rgba(235, 245, 255, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(starX, starY, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Extra twinkle flare for brighter stars
        if (s.size > 1.4 && alpha > 0.6) {
          ctx.strokeStyle = `rgba(125, 255, 178, ${(alpha * 0.25).toFixed(3)})`;
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(starX - 3, starY);
          ctx.lineTo(starX + 3, starY);
          ctx.moveTo(starX, starY - 3);
          ctx.lineTo(starX, starY + 3);
          ctx.stroke();
        }
      }

      // 3. Render Orbital Nodes & Constellation Lines
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0) node.x = width;
        if (node.x > width) node.x = 0;
        if (node.y < 0) node.y = height;
        if (node.y > height) node.y = 0;

        const nodeX = node.x + mx * 0.3;
        const nodeY = node.y + my * 0.3;

        // Render connected lines to nearby nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const otherX = other.x + mx * 0.3;
          const otherY = other.y + my * 0.3;
          const dist = Math.hypot(nodeX - otherX, nodeY - otherY);

          if (dist < 180) {
            const lineAlpha = (1 - dist / 180) * 0.12;
            ctx.strokeStyle = `rgba(125, 255, 178, ${lineAlpha.toFixed(3)})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(nodeX, nodeY);
            ctx.lineTo(otherX, otherY);
            ctx.stroke();
          }
        }

        // Draw node center
        ctx.fillStyle = "rgba(125, 255, 178, 0.4)";
        ctx.beginPath();
        ctx.arc(nodeX, nodeY, node.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [accentColor]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#030408]">
      <canvas ref={canvasRef} className="w-full h-full block" />
      {/* Subtle tech sci-fi grid layer */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #7DFFB2 1px, transparent 1px), linear-gradient(to bottom, #7DFFB2 1px, transparent 1px)`,
          backgroundSize: "64px 64px",
        }}
      />
      {/* Soft Vignette Mask */}
      <div className="absolute inset-0 bg-radial-vignette pointer-events-none" />
    </div>
  );
};
