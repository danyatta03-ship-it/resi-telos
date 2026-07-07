import Product360Viewer from "@/components/Product360Viewer";
import { product360 } from "@/content/site";

export default function Product360Section() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 sm:grid-cols-2">
        <div className="mx-auto w-full max-w-md">
          <Product360Viewer images={product360.images} title={product360.title} />
        </div>
        <div>
          <span className="text-xs uppercase tracking-[0.3em] text-[var(--color-accent)]">
            Vista 360°
          </span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl sm:text-4xl text-white">
            {product360.title}
          </h2>
          <p className="mt-4 max-w-md text-sm sm:text-base text-[var(--color-fg-muted)]">
            {product360.description}
          </p>
          <p className="mt-4 text-xs text-[var(--color-fg-muted)]">
            Trascina l&apos;immagine con il mouse o con il dito per girare il
            cappellino e vederlo da ogni lato.
          </p>
        </div>
      </div>
    </section>
  );
}
