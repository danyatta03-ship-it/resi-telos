import Link from "next/link";
import { brand } from "@/content/site";

export default function Header() {
  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-[var(--color-line)] bg-black/60 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-[family-name:var(--font-display)] text-lg sm:text-xl tracking-wide text-white"
        >
          {brand.name}
        </Link>
        <nav className="hidden sm:flex items-center gap-8 text-sm text-[var(--color-fg-muted)]">
          <Link href="/#lavori" className="hover:text-white transition-colors">
            Lavori
          </Link>
          <Link href="/galleria" className="hover:text-white transition-colors">
            Galleria
          </Link>
          <Link href="/chi-sono" className="hover:text-white transition-colors">
            Chi sono
          </Link>
          <Link href="/contatti" className="hover:text-white transition-colors">
            Contatti
          </Link>
        </nav>
        <Link
          href="/configuratore"
          className="rounded-full border border-[var(--color-accent)] px-4 py-2 text-xs sm:text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black transition-colors"
        >
          Crea il tuo cappellino
        </Link>
      </div>
    </header>
  );
}
