"use client";

import { useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { works } from "@/content/site";

export default function WorksSlider() {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollBy = (amount: number) => {
    trackRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  };

  return (
    <section id="lavori" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-white">
              I miei lavori
            </h2>
            <p className="mt-3 max-w-md text-sm sm:text-base text-[var(--color-fg-muted)]">
              Ogni pezzo è realizzato a mano, uno alla volta. Ecco una
              selezione dei lavori più recenti.
            </p>
          </div>
          <div className="hidden sm:flex gap-3">
            <button
              type="button"
              aria-label="Precedente"
              onClick={() => scrollBy(-360)}
              className="h-11 w-11 rounded-full border border-[var(--color-line)] text-white hover:border-[var(--color-accent)] transition-colors"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Successivo"
              onClick={() => scrollBy(360)}
              className="h-11 w-11 rounded-full border border-[var(--color-line)] text-white hover:border-[var(--color-accent)] transition-colors"
            >
              →
            </button>
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        className="no-scrollbar flex gap-5 overflow-x-auto px-6 pb-4 sm:px-[calc((100vw-72rem)/2+1.5rem)] snap-x snap-mandatory"
      >
        {works.map((work, i) => (
          <motion.article
            key={work.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
            className="group relative w-[78vw] max-w-[320px] shrink-0 snap-start overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-bg-alt)]"
          >
            <div className="relative aspect-[4/5] overflow-hidden">
              <Image
                src={work.image}
                alt={work.title}
                fill
                unoptimized
                sizes="(max-width: 640px) 78vw, 320px"
                className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-90" />
              <div
                className="absolute inset-x-0 bottom-0 translate-y-2 p-5 transition-transform duration-500 group-hover:translate-y-0"
              >
                <h3 className="font-[family-name:var(--font-display)] text-lg text-white">
                  {work.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-white/70 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
                  {work.description}
                </p>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
