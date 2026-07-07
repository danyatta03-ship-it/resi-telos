"use client";

import { useRef, useState } from "react";
import Image from "next/image";

const DRAG_SENSITIVITY = 45; // px di trascinamento per ogni scatto di rotazione

export default function Product360Viewer({
  images,
  title,
  description,
}: {
  images: string[];
  title: string;
  description?: string;
}) {
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const dragState = useRef({ startX: 0, startIndex: 0 });

  const mod = (n: number) => ((n % images.length) + images.length) % images.length;

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { startX: e.clientX, startIndex: index };
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    const deltaX = e.clientX - dragState.current.startX;
    const steps = Math.round(deltaX / DRAG_SENSITIVITY);
    if (steps !== 0) setHasInteracted(true);
    setIndex(mod(dragState.current.startIndex - steps));
  }

  function endDrag() {
    setDragging(false);
  }

  function step(delta: number) {
    setHasInteracted(true);
    setIndex((i) => mod(i + delta));
  }

  return (
    <div className="group relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-alt)] select-none">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        style={{ touchAction: "none" }}
        className={`absolute inset-0 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`${title} — vista ${i + 1}`}
            fill
            unoptimized
            draggable={false}
            sizes="(max-width: 640px) 78vw, 320px"
            className="object-cover pointer-events-none"
            style={{ opacity: i === index ? 1 : 0, transition: dragging ? "none" : "opacity 120ms ease" }}
            priority={i === 0}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-3 flex items-center justify-center gap-1.5">
        {images.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-1.5 rounded-full ${i === index ? "bg-[var(--color-accent)]" : "bg-white/30"}`}
          />
        ))}
      </div>

      <button
        type="button"
        aria-label="Ruota a sinistra"
        onClick={() => step(-1)}
        className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="Ruota a destra"
        onClick={() => step(1)}
        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-white hover:bg-black/50"
      >
        ›
      </button>

      {!hasInteracted && (
        <div className="pointer-events-none absolute inset-x-0 bottom-16 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-white/70">
          <span>↔</span>
          <span>360°</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent p-5">
        <h3 className="font-[family-name:var(--font-display)] text-lg text-white">{title}</h3>
        {description && (
          <p className="mt-2 text-xs leading-relaxed text-white/70 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
