"use client";

import { useEffect, useRef } from "react";
import type { LivePhase } from "@/lib/live/types";

type BlobSpec = {
  color: string;
  radius: number;
  orbit: number;
  speed: number;
  phase: number;
};

const COLOURS = ["#e53927", "#8bb2de", "#f5b726", "#e97b77", "#8bb2de"];

function lowEnd() {
  if (typeof navigator === "undefined") return false;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  return cores <= 4 || memory <= 4;
}

function makeBlobs(count: number): BlobSpec[] {
  return Array.from({ length: count }, (_, index) => ({
    color: COLOURS[index % COLOURS.length] ?? "#f5b726",
    radius: 0.22 + (index % 3) * 0.04,
    orbit: 0.12 + (index % 4) * 0.05,
    speed: 0.35 + index * 0.12,
    phase: (index / count) * Math.PI * 2,
  }));
}

export function OrbCanvas({
  phase,
  level,
  reducedMotion,
}: {
  phase: LivePhase;
  level: number;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef(phase);
  const levelRef = useRef(level);
  const reduceRef = useRef(reducedMotion);
  phaseRef.current = phase;
  levelRef.current = level;
  reduceRef.current = reducedMotion;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeContext = canvas.getContext("2d");
    if (!maybeContext) return;
    const ctx: CanvasRenderingContext2D = maybeContext;

    const blobCount = lowEnd() ? 3 : 5;
    const blobs = makeBlobs(blobCount);
    let raf = 0;
    let last = 0;
    let time = 0;
    let running = true;

    function resize() {
      if (!canvas) return;
      const size = Math.min(360, Math.floor(window.innerWidth * 0.72));
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(size * dpr);
      canvas.height = Math.floor(size * dpr);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now: number) {
      if (!running || !canvas) return;
      // Cap near 60fps so phones stay cool.
      if (now - last < 16) {
        raf = window.requestAnimationFrame(draw);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!reduceRef.current) time += dt;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width / 2;
      const cy = height / 2;
      const base = Math.min(width, height) * 0.34;
      const state = phaseRef.current;
      const mic = levelRef.current;
      const reduce = reduceRef.current;

      let scale = 1;
      let swirl = 0;
      let gold = 0;
      if (state === "idle") scale = reduce ? 1 : 1 + Math.sin(time * 1.2) * 0.04;
      if (state === "listening") scale = 1 + 0.08 + mic * 0.28 + (reduce ? 0 : Math.sin(time * 4) * 0.03 * mic);
      if (state === "thinking") {
        scale = 1.05;
        swirl = reduce ? 0 : time * 0.9;
        gold = 0.55;
      }
      if (state === "speaking") {
        scale = 1 + mic * 0.22;
        swirl = reduce ? 0 : time * 1.4;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // Soft glow behind the blobs.
      const glow = ctx.createRadialGradient(0, 0, base * 0.2, 0, 0, base * 1.35);
      glow.addColorStop(0, `rgba(245, 183, 38, ${0.18 + gold * 0.2})`);
      glow.addColorStop(0.55, "rgba(46, 71, 66, 0.35)");
      glow.addColorStop(1, "rgba(35, 31, 32, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, base * 1.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = "lighter";
      for (const blob of blobs) {
        const angle = blob.phase + (reduce ? 0 : time * blob.speed) + swirl * 0.35;
        const ripple = state === "speaking" && !reduce ? Math.sin(time * 6 + blob.phase) * blob.orbit * 0.35 * mic : 0;
        const x = Math.cos(angle) * blob.orbit * base + ripple;
        const y = Math.sin(angle * 1.15) * blob.orbit * base * 0.85;
        const radius = blob.radius * base * (state === "listening" ? 1 + mic * 0.2 : 1);
        const colour = gold > 0 ? mixTowardsYellow(blob.color, gold) : blob.color;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, withAlpha(colour, 0.85));
        gradient.addColorStop(0.55, withAlpha(colour, 0.35));
        gradient.addColorStop(1, withAlpha(colour, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.restore();

      raf = window.requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = window.requestAnimationFrame(draw);
    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="mx-auto block"
      aria-hidden="true"
      style={{ filter: reducedMotion ? "none" : "blur(0.2px)" }}
    />
  );
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixTowardsYellow(hex: string, amount: number) {
  const { r, g, b } = rgb(hex);
  const tr = 245;
  const tg = 183;
  const tb = 38;
  const nr = Math.round(r + (tr - r) * amount);
  const ng = Math.round(g + (tg - g) * amount);
  const nb = Math.round(b + (tb - b) * amount);
  return `#${toHex(nr)}${toHex(ng)}${toHex(nb)}`;
}

function rgb(hex: string) {
  const raw = hex.replace("#", "");
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function toHex(value: number) {
  return value.toString(16).padStart(2, "0");
}
