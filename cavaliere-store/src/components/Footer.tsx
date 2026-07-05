import Link from "next/link";
import { brand, contact } from "@/content/site";

export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-line)] bg-black">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div>
            <p className="font-[family-name:var(--font-display)] text-xl text-white">
              {brand.name}
            </p>
            <p className="mt-2 max-w-xs text-sm text-[var(--color-fg-muted)]">
              {brand.tagline}
            </p>
            <div className="mt-5 flex gap-4 text-sm text-[var(--color-fg-muted)]">
              <a
                href={contact.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                Instagram
              </a>
              <a
                href={contact.tiktok}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors"
              >
                TikTok
              </a>
              <a
                href={`mailto:${contact.email}`}
                className="hover:text-white transition-colors"
              >
                Email
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm sm:flex sm:gap-16">
            <div className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                Sito
              </span>
              <Link href="/galleria" className="text-white/80 hover:text-white">
                Galleria
              </Link>
              <Link href="/chi-sono" className="text-white/80 hover:text-white">
                Chi sono
              </Link>
              <Link href="/contatti" className="text-white/80 hover:text-white">
                Contatti
              </Link>
            </div>
            <div className="flex flex-col gap-3">
              <span className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
                Legale
              </span>
              <Link href="/privacy-policy" className="text-white/80 hover:text-white">
                Privacy Policy
              </Link>
              <Link href="/cookie-policy" className="text-white/80 hover:text-white">
                Cookie Policy
              </Link>
              <Link href="/termini" className="text-white/80 hover:text-white">
                Termini
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-[var(--color-line)] pt-6 text-xs text-[var(--color-fg-muted)]">
          © {new Date().getFullYear()} {brand.name}. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
}
