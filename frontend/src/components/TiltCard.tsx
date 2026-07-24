import React, { useRef } from "react";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Max tilt rotation in degrees */
  strength?: number;
  style?: React.CSSProperties;
}

/**
 * Purely presentational: wraps its children in a div that tilts in 3D
 * toward the cursor and springs back on leave. Does not intercept clicks,
 * so buttons/links inside keep working exactly as before.
 */
export default function TiltCard({ children, className = "", strength = 8, style }: TiltCardProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;

    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      if (!ref.current) return;
      const rotY = px * strength * 2;
      const rotX = -py * strength * 2;
      ref.current.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(0)`;
      ref.current.style.setProperty("--sheen-x", `${(px + 0.5) * 100}%`);
      ref.current.style.setProperty("--sheen-y", `${(py + 0.5) * 100}%`);
    });
  }

  function handleLeave() {
    const el = ref.current;
    if (!el) return;
    if (frame.current) cancelAnimationFrame(frame.current);
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)";
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      className={`tilt-card ${className}`}
      style={{ transition: "transform 0.35s cubic-bezier(0.16,1,0.3,1)", transformStyle: "preserve-3d", ...style }}
    >
      {children}
    </div>
  );
}
