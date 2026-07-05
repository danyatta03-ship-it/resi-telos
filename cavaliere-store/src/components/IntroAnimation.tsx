"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { brand } from "@/content/site";

export default function IntroAnimation() {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          onAnimationComplete={() => {
            if (!show) document.body.style.overflow = "";
          }}
        >
          <motion.div
            className="flex flex-col items-center"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <motion.span
              className="font-[family-name:var(--font-tag)] text-4xl sm:text-6xl text-white tracking-wide"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              {brand.name}
            </motion.span>
            <motion.span
              className="mt-3 h-[2px] bg-[var(--color-accent)]"
              initial={{ width: 0 }}
              animate={{ width: 120 }}
              transition={{ delay: 0.7, duration: 0.7, ease: "easeInOut" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
