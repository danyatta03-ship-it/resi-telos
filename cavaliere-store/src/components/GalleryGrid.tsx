"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { works } from "@/content/site";

const categories = ["Tutti", "Ricami", "Streetwear", "Personalizzati", "Brand", "Clienti"] as const;

const categoryByWorkId: Record<string, (typeof categories)[number]> = {
  "ricamo-oro": "Ricami",
  "patch-urban": "Streetwear",
  "stampa-street": "Streetwear",
  "logo-brand": "Brand",
  "edizione-limitata": "Personalizzati",
  "cliente-nike-style": "Clienti",
};

export default function GalleryGrid() {
  const [active, setActive] = useState<(typeof categories)[number]>("Tutti");

  const filtered = useMemo(() => {
    if (active === "Tutti") return works;
    return works.filter((w) => categoryByWorkId[w.id] === active);
  }, [active]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActive(cat)}
            className={`rounded-full border px-4 py-2 text-xs sm:text-sm transition-colors ${
              active === cat
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black font-semibold"
                : "border-[var(--color-line)] text-white/70 hover:border-white/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {filtered.map((work) => (
          <div
            key={work.id}
            className="group relative aspect-[4/5] overflow-hidden rounded-xl border border-[var(--color-line)]"
          >
            <Image
              src={work.image}
              alt={work.title}
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
              <p className="text-xs font-medium text-white">{work.title}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
