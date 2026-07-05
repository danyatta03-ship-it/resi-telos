import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Header />
      <main className="flex-1 pt-32 pb-24">
        <div className="mx-auto max-w-3xl px-6">
          <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-white">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-4 text-base text-[var(--color-fg-muted)]">
              {subtitle}
            </p>
          )}
          <div className="mt-10 space-y-6 text-sm leading-relaxed text-white/80">
            {children}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
