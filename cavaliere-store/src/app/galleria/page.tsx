import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GalleryGrid from "@/components/GalleryGrid";

export const metadata: Metadata = {
  title: "Galleria",
  description:
    "Galleria dei lavori Cavaliere.store: ricami, streetwear, personalizzati, brand e progetti clienti.",
};

export default function GalleriaPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-32 pb-24">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-white">
            Galleria
          </h1>
          <p className="mt-4 max-w-xl text-sm text-[var(--color-fg-muted)]">
            Filtra i lavori per categoria.
          </p>
          <div className="mt-10">
            <GalleryGrid />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
