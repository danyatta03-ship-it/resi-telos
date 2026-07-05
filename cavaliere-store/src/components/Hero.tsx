"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { hero } from "@/content/site";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(202,162,74,0.16), transparent 60%), linear-gradient(180deg, #0a0a0a 0%, #050505 100%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 text-center">
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.3, duration: 0.6 }}
          className="mb-5 font-[family-name:var(--font-tag)] text-[var(--color-accent)] text-lg sm:text-xl"
        >
          Cavaliere.store
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.5, duration: 0.7, ease: "easeOut" }}
          className="font-[family-name:var(--font-display)] text-4xl leading-tight sm:text-6xl md:text-7xl text-white"
        >
          {hero.headline}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2.75, duration: 0.7, ease: "easeOut" }}
          className="mt-6 text-base sm:text-lg text-[var(--color-fg-muted)]"
        >
          {hero.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 3, duration: 0.7, ease: "easeOut" }}
          className="mt-10"
        >
          <Link
            href={hero.ctaHref}
            className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm sm:text-base font-bold uppercase tracking-wider text-black transition-transform hover:scale-105 active:scale-95"
          >
            {hero.ctaLabel}
          </Link>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3.3, duration: 0.8 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-[var(--color-fg-muted)]"
      >
        Scorri
      </motion.div>
    </section>
  );
}
