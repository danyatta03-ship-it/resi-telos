"use client";

import { configuratorOptions } from "@/content/site";
import { contact } from "@/content/site";

const inputClass =
  "w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-alt)] px-4 py-3 text-sm text-white normal-case tracking-normal outline-none focus:border-[var(--color-accent)]";
const labelClass =
  "flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]";

function buildSummary(form: HTMLFormElement) {
  const data = new FormData(form);
  const get = (name: string) => (data.get(name) as string) || "—";
  return [
    "Richiesta cappellino personalizzato — Cavaliere.store",
    `Nome: ${get("nome")}`,
    `Email: ${get("email")}`,
    `Telefono: ${get("telefono")}`,
    `Colore: ${get("colore")}`,
    `Modello: ${get("modello")}`,
    `Taglia: ${get("taglia")}`,
    `Quantità: ${get("quantita")}`,
    `Tipo di personalizzazione: ${get("tipo_lavorazione")}`,
    `Testo da ricamare/stampare: ${get("testo_personalizzazione")}`,
    `Descrizione: ${get("descrizione")}`,
    `Note finali: ${get("note_finali")}`,
    "",
    "(immagini/loghi/bozze inviati tramite il modulo sul sito)",
  ].join("\n");
}

export default function ConfiguratoreForm() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const summary = buildSummary(e.currentTarget);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(summary).catch(() => {});
    }
    window.open(contact.instagramDm, "_blank", "noopener,noreferrer");
    // il form prosegue con il normale invio nativo a Netlify (non blocchiamo l'evento)
  }

  return (
    <form
      name="configuratore"
      method="POST"
      data-netlify="true"
      netlify-honeypot="azienda"
      encType="multipart/form-data"
      action="/configuratore/grazie"
      onSubmit={handleSubmit}
      className="flex flex-col gap-8"
    >
      <input type="hidden" name="form-name" value="configuratore" />
      <p className="hidden">
        <label>
          Non compilare questo campo: <input name="azienda" />
        </label>
      </p>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-[family-name:var(--font-display)] text-lg text-white">
          Il tuo cappellino
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Colore
            <select name="colore" required className={inputClass} defaultValue="">
              <option value="" disabled>
                Scegli un colore
              </option>
              {configuratorOptions.colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Modello
            <select
              name="modello"
              required
              className={inputClass}
              defaultValue={configuratorOptions.models[0]}
            >
              {configuratorOptions.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Taglia
            <select name="taglia" className={inputClass} defaultValue={configuratorOptions.sizes[0]}>
              {configuratorOptions.sizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className={labelClass}>
            Quantità
            <input
              type="number"
              name="quantita"
              min={1}
              max={10}
              defaultValue={1}
              required
              className={inputClass}
            />
          </label>
        </div>

        <div>
          <span className="mb-2 block text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
            Tipo di personalizzazione
          </span>
          <div className="flex flex-wrap gap-4">
            {configuratorOptions.workTypes.map((w, i) => (
              <label key={w} className="flex items-center gap-2 text-sm text-white/80">
                <input
                  type="radio"
                  name="tipo_lavorazione"
                  value={w}
                  required
                  defaultChecked={i === 0}
                  className="accent-[var(--color-accent)]"
                />
                {w}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-[family-name:var(--font-display)] text-lg text-white">
          I tuoi dati
        </legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Nome
            <input type="text" name="nome" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Email
            <input type="email" name="email" required className={inputClass} />
          </label>
          <label className={labelClass}>
            Telefono
            <input type="tel" name="telefono" className={inputClass} />
          </label>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 font-[family-name:var(--font-display)] text-lg text-white">
          Personalizzazione
        </legend>

        <label className={labelClass}>
          Testo da ricamare o stampare
          <input type="text" name="testo_personalizzazione" className={inputClass} />
        </label>

        <label className={labelClass}>
          Descrizione dettagliata
          <textarea
            name="descrizione"
            rows={4}
            className={inputClass}
            placeholder="Racconta come immagini il tuo cappellino: posizione del ricamo, colori, ispirazione..."
          />
        </label>

        <label className={labelClass}>
          Immagini di riferimento
          <input
            type="file"
            name="immagini_riferimento"
            accept="image/*"
            multiple
            className={`${inputClass} file:mr-4 file:rounded-full file:border-0 file:bg-[var(--color-accent)] file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:text-black`}
          />
        </label>

        <label className={labelClass}>
          Logo
          <input
            type="file"
            name="logo"
            accept="image/*"
            className={`${inputClass} file:mr-4 file:rounded-full file:border-0 file:bg-[var(--color-accent)] file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:text-black`}
          />
        </label>

        <label className={labelClass}>
          Bozze
          <input
            type="file"
            name="bozze"
            accept="image/*,.pdf"
            multiple
            className={`${inputClass} file:mr-4 file:rounded-full file:border-0 file:bg-[var(--color-accent)] file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:text-black`}
          />
        </label>

        <p className="text-xs text-[var(--color-fg-muted)]">
          File di dimensioni contenute (idealmente sotto i 5 MB ciascuno).
        </p>

        <label className={labelClass}>
          Note finali
          <textarea name="note_finali" rows={3} className={inputClass} />
        </label>
      </fieldset>

      <button
        type="submit"
        className="inline-flex items-center justify-center rounded-full bg-[var(--color-accent)] px-8 py-4 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105"
      >
        Invia richiesta di personalizzazione
      </button>
      <p className="text-xs text-[var(--color-fg-muted)]">
        Al clic si apre automaticamente Instagram con i dettagli copiati:
        incollali nel messaggio (Ctrl+V, o tieni premuto e incolla da
        smartphone) per inviarceli subito.
      </p>
    </form>
  );
}
