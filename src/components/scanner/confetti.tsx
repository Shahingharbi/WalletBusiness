"use client";

import { useEffect, useState } from "react";

const COLORS = ["#fbbf24", "#10b981", "#ef4444", "#3b82f6", "#a855f7", "#f97316"];

export function Confetti({ count = 40 }: { count?: number }) {
  const [particles, setParticles] = useState<
    { id: number; left: number; color: string; delay: number; rotate: number }[]
  >([]);

  useEffect(() => {
    const items = Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      delay: Math.random() * 0.5,
      rotate: Math.random() * 360,
    }));
    setParticles(items);
  }, [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.id}
          className="confetti-particle"
          style={{
            left: `${p.left}%`,
            backgroundColor: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}
