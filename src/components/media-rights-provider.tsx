"use client";

import { Check, FileCheck2, ShieldCheck, X } from "lucide-react";
import { enqueueSnackbar } from "notistack";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type MediaRightsContextValue = { requestUpload: (upload: () => void | Promise<void>) => Promise<void> };
const MediaRightsContext = createContext<MediaRightsContextValue | null>(null);

export function useMediaRights() {
  const context = useContext(MediaRightsContext);
  if (!context) throw new Error("MediaRightsProvider is missing");
  return context;
}

export function MediaRightsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [peopleConfirmed, setPeopleConfirmed] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const accepted = useRef(false);
  const pendingUpload = useRef<(() => void | Promise<void>) | null>(null);
  const firstCheckbox = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);

  const close = useCallback(() => {
    if (saving) return;
    pendingUpload.current = null;
    setOpen(false);
    setRightsConfirmed(false);
    setPeopleConfirmed(false);
    setTermsConfirmed(false);
  }, [saving]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    firstCheckbox.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, [close, open]);

  const requestUpload = useCallback(async (upload: () => void | Promise<void>) => {
    if (accepted.current) { await upload(); return; }
    if (pendingUpload.current) return;
    try {
      const response = await fetch("/api/media/rights", { cache: "no-store" });
      if (!response.ok) throw new Error("No se pudo verificar la autorización para subir archivos.");
      const body = await response.json() as { accepted: boolean };
      if (body.accepted) {
        accepted.current = true;
        await upload();
      } else {
        pendingUpload.current = upload;
        setOpen(true);
      }
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo verificar la autorización.", { variant: "error" });
    }
  }, []);

  async function accept() {
    if (!rightsConfirmed || !peopleConfirmed || !termsConfirmed || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/media/rights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rightsConfirmed: true, peopleConfirmed: true, termsConfirmed: true }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo registrar tu confirmación.");
      accepted.current = true;
      const upload = pendingUpload.current;
      pendingUpload.current = null;
      setOpen(false);
      setRightsConfirmed(false);
      setPeopleConfirmed(false);
      setTermsConfirmed(false);
      if (upload) await upload();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo continuar.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <MediaRightsContext.Provider value={{ requestUpload }}>
      {children}
      {open && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md" role="presentation">
          <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="media-rights-title" aria-describedby="media-rights-description" className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/10 bg-[#191b23] shadow-2xl shadow-black/70">
            <div className="border-b border-white/8 bg-gradient-to-br from-violet-500/10 via-transparent to-transparent px-6 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <span className="grid size-11 place-items-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300"><ShieldCheck className="size-5" /></span>
                <button type="button" onClick={close} disabled={saving} aria-label="Cerrar aviso" className="cursor-pointer rounded-xl p-2 text-zinc-500 transition hover:bg-white/5 hover:text-white disabled:opacity-40"><X className="size-5" /></button>
              </div>
              <p className="mt-5 text-[11px] font-semibold uppercase tracking-[.18em] text-violet-300">Antes de tu primera subida</p>
              <h2 id="media-rights-title" className="mt-1 text-2xl font-semibold tracking-tight text-white">Tus archivos, tus derechos</h2>
              <p id="media-rights-description" className="mt-2 text-sm leading-6 text-zinc-400">Para proteger a las personas que aparecen en el contenido y cumplir las reglas de Fanvue, confirma lo siguiente antes de subir fotos o videos nuevos.</p>
            </div>
            <div className="space-y-3 px-6 py-5 sm:px-7">
              <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4 transition hover:border-violet-400/30">
                <input ref={firstCheckbox} type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-violet-500" />
                <span><span className="flex items-center gap-2 text-sm font-medium text-zinc-100"><FileCheck2 className="size-4 text-violet-300" />Tengo derecho a usar los archivos que suba</span><span className="mt-1 block text-xs leading-5 text-zinc-400">Este contenido y el que suba después es mío, o cuento con autorización/licencia válida de su titular para usarlo en Fanvue. No reutilizaré contenido ajeno sin permiso.</span></span>
              </label>
              <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/10 bg-white/[.025] p-4 transition hover:border-violet-400/30">
                <input type="checkbox" checked={peopleConfirmed} onChange={(event) => setPeopleConfirmed(event.target.checked)} className="mt-1 size-4 shrink-0 accent-violet-500" />
                <span><span className="flex items-center gap-2 text-sm font-medium text-zinc-100"><Check className="size-4 text-violet-300" />Las personas incluidas dieron su consentimiento</span><span className="mt-1 block text-xs leading-5 text-zinc-400">Si aparece o se escucha otra persona en cualquier archivo que suba, confirmaré que es adulta y conservaré su identificación y consentimiento escrito según Fanvue. Si también es creadora en Fanvue, la etiquetaré. Si no aparece nadie más, este punto no requiere documentación adicional.</span></span>
              </label>
              <div className="flex items-start gap-3 px-1 py-1 text-xs leading-5 text-zinc-300">
                <input id="media-rights-terms" type="checkbox" checked={termsConfirmed} onChange={(event) => setTermsConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-violet-500" />
                <span><label htmlFor="media-rights-terms" className="cursor-pointer">He leído y acepto cumplir las políticas de Fanvue:</label> <a href="https://legal.fanvue.com/creator-terms" target="_blank" rel="noopener noreferrer" className="text-violet-300 underline underline-offset-2 hover:text-violet-200">Términos para creadores</a> y <a href="https://legal.fanvue.com/co-authored" target="_blank" rel="noopener noreferrer" className="text-violet-300 underline underline-offset-2 hover:text-violet-200">contenido con terceros</a>.</span>
              </div>
              <p className="text-[11px] leading-5 text-zinc-500">Esta confirmación se guardará en tu cuenta y no reemplaza la verificación de Fanvue ni los permisos de cada archivo.</p>
            </div>
            <div className="flex flex-col-reverse gap-2 border-t border-white/8 px-6 py-4 sm:flex-row sm:justify-end sm:px-7">
              <button type="button" onClick={close} disabled={saving} className="cursor-pointer rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-40">Cancelar</button>
              <button type="button" onClick={() => void accept()} disabled={!rightsConfirmed || !peopleConfirmed || !termsConfirmed || saving} className="cursor-pointer rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Guardando…" : "Confirmar y subir"}</button>
            </div>
          </section>
        </div>, document.body) : null}
    </MediaRightsContext.Provider>
  );
}
