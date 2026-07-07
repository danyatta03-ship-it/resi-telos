"use client";

import { useEffect, useMemo, useState } from "react";

type Submission = {
  id: string;
  created_at: string;
  data: Record<string, unknown>;
};

function normalizeFiles(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(normalizeFiles);
  if (typeof value === "object") {
    const url = (value as { url?: string }).url;
    return url ? [url] : [];
  }
  if (typeof value === "string") {
    return value
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function field(data: Record<string, unknown>, key: string): string {
  const v = data[key];
  return typeof v === "string" && v.trim() ? v : "—";
}

export default function AdminPanel() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  async function loadSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/.netlify/functions/admin-submissions");
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Errore nel caricamento.");
      setSubmissions(json.submissions || []);
      setAuthed(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel caricamento.");
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }

  useEffect(() => {
    loadSubmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    try {
      const res = await fetch("/.netlify/functions/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Accesso negato.");
      setPassword("");
      await loadSubmissions();
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Accesso negato.");
    }
  }

  async function handleLogout() {
    await fetch("/.netlify/functions/admin-logout", { method: "POST" });
    setAuthed(false);
    setSubmissions([]);
  }

  const groups = useMemo(() => {
    const map = new Map<string, Submission[]>();
    for (const s of submissions) {
      const nome = field(s.data, "nome");
      const cognome = field(s.data, "cognome");
      const key = `${nome} ${cognome}`.trim() || "Cliente senza nome";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [submissions]);

  if (checking) {
    return <p className="text-sm text-[var(--color-fg-muted)]">Caricamento…</p>;
  }

  if (!authed) {
    return (
      <form onSubmit={handleLogin} className="flex max-w-xs flex-col gap-4">
        <label className="flex flex-col gap-1 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-bg-alt)] px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-accent)]"
          />
        </label>
        {loginError && <p className="text-xs text-red-400">{loginError}</p>}
        <button
          type="submit"
          className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-bold uppercase tracking-wider text-black transition-transform hover:scale-105"
        >
          Accedi
        </button>
      </form>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <p className="text-sm text-[var(--color-fg-muted)]">
          {submissions.length} richiest{submissions.length === 1 ? "a" : "e"} da{" "}
          {groups.length} client{groups.length === 1 ? "e" : "i"}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={loadSubmissions}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-wider text-white hover:border-[var(--color-accent)]"
          >
            Aggiorna
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-full border border-[var(--color-line)] px-4 py-2 text-xs uppercase tracking-wider text-white hover:border-[var(--color-accent)]"
          >
            Esci
          </button>
        </div>
      </div>

      {error && <p className="mb-6 text-sm text-red-400">{error}</p>}
      {loading && <p className="mb-6 text-sm text-[var(--color-fg-muted)]">Aggiornamento…</p>}

      {groups.length === 0 && !loading && (
        <p className="text-sm text-[var(--color-fg-muted)]">
          Nessuna richiesta ricevuta finora.
        </p>
      )}

      <div className="flex flex-col gap-10">
        {groups.map(([customer, items]) => (
          <div key={customer} className="rounded-2xl border border-[var(--color-line)] p-6">
            <h2 className="font-[family-name:var(--font-display)] text-xl text-white">
              {customer}
            </h2>

            <div className="mt-4 flex flex-col gap-6">
              {items.map((s) => {
                const files = [
                  ...normalizeFiles(s.data.immagini_riferimento).map((url) => ({
                    label: "Immagine di riferimento",
                    url,
                  })),
                  ...normalizeFiles(s.data.logo).map((url) => ({ label: "Logo", url })),
                  ...normalizeFiles(s.data.bozze).map((url) => ({ label: "Bozza", url })),
                ];

                return (
                  <div key={s.id} className="border-t border-[var(--color-line)] pt-4 text-sm">
                    <p className="text-xs text-[var(--color-fg-muted)]">
                      {new Date(s.created_at).toLocaleString("it-IT")}
                    </p>
                    <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                      <div>
                        <dt className="inline text-[var(--color-fg-muted)]">Email: </dt>
                        <dd className="inline text-white">{field(s.data, "email")}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--color-fg-muted)]">Telefono: </dt>
                        <dd className="inline text-white">{field(s.data, "telefono")}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--color-fg-muted)]">Colore: </dt>
                        <dd className="inline text-white">{field(s.data, "colore")}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--color-fg-muted)]">Modello: </dt>
                        <dd className="inline text-white">{field(s.data, "modello")}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--color-fg-muted)]">Taglia: </dt>
                        <dd className="inline text-white">{field(s.data, "taglia")}</dd>
                      </div>
                      <div>
                        <dt className="inline text-[var(--color-fg-muted)]">Quantità: </dt>
                        <dd className="inline text-white">{field(s.data, "quantita")}</dd>
                      </div>
                    </dl>
                    <p className="mt-2">
                      <span className="text-[var(--color-fg-muted)]">Testo ricamo/stampa: </span>
                      <span className="text-white">{field(s.data, "testo_personalizzazione")}</span>
                    </p>
                    <p className="mt-2">
                      <span className="text-[var(--color-fg-muted)]">Descrizione: </span>
                      <span className="text-white">{field(s.data, "descrizione")}</span>
                    </p>
                    <p className="mt-2">
                      <span className="text-[var(--color-fg-muted)]">Note: </span>
                      <span className="text-white">{field(s.data, "note_finali")}</span>
                    </p>

                    {files.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {files.map((f, i) => (
                          <a
                            key={i}
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full border border-[var(--color-accent)] px-3 py-1.5 text-xs text-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black"
                          >
                            {f.label} ↓
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
