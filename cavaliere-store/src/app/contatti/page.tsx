import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { contact } from "@/content/site";

export const metadata: Metadata = {
  title: "Contatti",
  description:
    "Contatta Cavaliere.store via email, WhatsApp, Instagram o TikTok, oppure scrivici tramite il modulo di contatto.",
};

export default function ContattiPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-32 pb-24">
        <div className="mx-auto grid max-w-4xl gap-14 px-6 sm:grid-cols-2">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-white">
              Contatti
            </h1>
            <p className="mt-4 text-sm text-[var(--color-fg-muted)]">
              Scrivici per una richiesta personalizzata o qualsiasi
              informazione.
            </p>

            <ul className="mt-8 space-y-3 text-sm">
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="text-white/80 hover:text-white"
                >
                  {contact.email}
                </a>
              </li>
              <li>
                <a
                  href={contact.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white"
                >
                  WhatsApp
                </a>
              </li>
              <li>
                <a
                  href={contact.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white"
                >
                  Instagram
                </a>
              </li>
              <li>
                <a
                  href={contact.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/80 hover:text-white"
                >
                  TikTok
                </a>
              </li>
            </ul>

            {contact.mapQuery ? (
              <div className="mt-8 overflow-hidden rounded-xl border border-[var(--color-line)]">
                <iframe
                  title="Mappa"
                  className="h-56 w-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(
                    contact.mapQuery
                  )}&output=embed`}
                />
              </div>
            ) : null}
          </div>

          <form
            name="contatti"
            method="POST"
            data-netlify="true"
            netlify-honeypot="azienda"
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="form-name" value="contatti" />
            <p className="hidden">
              <label>
                Non compilare questo campo: <input name="azienda" />
              </label>
            </p>

            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              Nome
              <input
                name="nome"
                required
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-alt)] px-4 py-3 text-sm text-white normal-case tracking-normal outline-none focus:border-[var(--color-accent)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              Email
              <input
                type="email"
                name="email"
                required
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-alt)] px-4 py-3 text-sm text-white normal-case tracking-normal outline-none focus:border-[var(--color-accent)]"
              />
            </label>

            <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
              Messaggio
              <textarea
                name="messaggio"
                required
                rows={5}
                className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-alt)] px-4 py-3 text-sm text-white normal-case tracking-normal outline-none focus:border-[var(--color-accent)]"
              />
            </label>

            <button
              type="submit"
              className="mt-2 inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-8 py-3 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105"
            >
              Invia
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
