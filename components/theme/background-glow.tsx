"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./theme-provider";

type TrailPoint = { x: number; y: number; bornAt: number; radius: number };

export function BackgroundGlow() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== "dark") return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let targetX = width * 0.5;
    let targetY = height * 0.3;
    let x = targetX;
    let y = targetY;
    let velocityX = 0;
    let velocityY = 0;
    let animationFrame = 0;
    let lastMovement = performance.now();
    let visible = true;
    const trail: TrailPoint[] = [];
    const trailLifetime = 2800;
    const focusRadius = 58;

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawLight = (
      pointX: number,
      pointY: number,
      radius: number,
      alpha: number,
    ) => {
      if (alpha <= 0.001 || radius <= 0) return;
      const gradient = context.createRadialGradient(
        pointX,
        pointY,
        0,
        pointX,
        pointY,
        radius,
      );
      gradient.addColorStop(0, `rgba(255, 145, 45, ${alpha})`);
      gradient.addColorStop(0.25, `rgba(255, 120, 30, ${alpha * 0.75})`);
      gradient.addColorStop(0.55, `rgba(235, 90, 20, ${alpha * 0.38})`);
      gradient.addColorStop(0.8, `rgba(215, 75, 10, ${alpha * 0.12})`);
      gradient.addColorStop(1, "rgba(215, 75, 10, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(pointX, pointY, radius, 0, Math.PI * 2);
      context.fill();
    };

    const tick = () => {
      const now = performance.now();
      velocityX = (velocityX + (targetX - x) * 0.065) * 0.82;
      velocityY = (velocityY + (targetY - y) * 0.065) * 0.82;
      x += velocityX;
      y += velocityY;
      const speed = Math.hypot(velocityX, velocityY);
      const last = trail.at(-1);
      if (!last || Math.hypot(x - last.x, y - last.y) >= 3) {
        trail.push({ x, y, bornAt: now, radius: focusRadius * 0.62 });
        if (trail.length > 240) trail.shift();
      }
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = "lighter";
      for (let index = trail.length - 1; index >= 0; index -= 1) {
        const point = trail[index];
        const progress = (now - point.bornAt) / trailLifetime;
        if (progress >= 1) {
          trail.splice(index, 1);
          continue;
        }
        const fade = Math.pow(1 - progress, 1.05);
        const intensity = Math.min(speed / 25, 1);
        drawLight(
          point.x,
          point.y,
          point.radius * (0.7 + fade * 0.3),
          (0.16 + intensity * 0.11) * fade,
        );
      }
      const focus = 0.3 + Math.min(speed / 35, 1) * 0.1;
      drawLight(x, y, focusRadius * 1.35, focus * 0.3);
      drawLight(x, y, focusRadius, focus * 0.8);
      drawLight(x, y, focusRadius * 0.38, focus * 0.45);
      context.globalCompositeOperation = "source-over";
      if (speed < 0.03 && trail.length === 0 && now - lastMovement > 500) {
        animationFrame = 0;
        return;
      }
      animationFrame = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      lastMovement = performance.now();
      if (!animationFrame && visible)
        animationFrame = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      visible = !document.hidden;
      if (!visible && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else if (visible && !animationFrame) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    resize();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    animationFrame = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [theme]);

  if (theme !== "dark") return null;
  return (
    <div aria-hidden="true" className="background-glow">
      <div className="background-glow-static" />
      <canvas ref={canvasRef} className="background-glow-canvas" />
    </div>
  );
}
