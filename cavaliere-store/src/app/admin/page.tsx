import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminPanel from "@/components/AdminPanel";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <Header />
      <main className="flex-1 pt-32 pb-24">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-white">
            Richieste clienti
          </h1>
          <p className="mt-4 max-w-xl text-sm text-[var(--color-fg-muted)]">
            Tutte le richieste ricevute dal configuratore, raggruppate per
            cliente, con gli allegati caricati.
          </p>
          <div className="mt-10">
            <AdminPanel />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
