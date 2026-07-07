"use client";

import { useRef, useState } from "react";
import Image from "next/image";

const DRAG_SENSITIVITY = 45; // px di trascinamento per ogni scatto di rotazione

export default function Product360Viewer({
  images,
  title,
}: {
  images: string[];
  title: string;
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
    <div className="select-none">
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        className={`relative aspect-square w-full overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={`${title} — vista ${i + 1}`}
            fill
            unoptimized
            draggable={false}
            sizes="(max-width: 640px) 90vw, 480px"
            className="object-contain p-6 pointer-events-none"
            style={{ opacity: i === index ? 1 : 0, transition: dragging ? "none" : "opacity 120ms ease" }}
            priority={i === 0}
          />
        ))}

        {!hasInteracted && (
          <div className="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-black/50">
            <span>↔</span>
            <span>Trascina per ruotare</span>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          type="button"
          aria-label="Ruota a sinistra"
          onClick={() => step(-1)}
          className="h-9 w-9 rounded-full border border-[var(--color-line)] text-white hover:border-[var(--color-accent)]"
        >
          ‹
        </button>
        <div className="flex gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === index ? "bg-[var(--color-accent)]" : "bg-[var(--color-line)]"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label="Ruota a destra"
          onClick={() => step(1)}
          className="h-9 w-9 rounded-full border border-[var(--color-line)] text-white hover:border-[var(--color-accent)]"
        >
          ›
        </button>
      </div>
    </div>
  );
}
