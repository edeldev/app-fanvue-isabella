"use client";

import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ImageIcon,
  LoaderCircle,
  LockKeyhole,
  Send,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { MediaFields, type AttachedMedia } from "@/components/media-fields";

type MediaValue = {
  media: AttachedMedia[];
  priceMinor: number | null;
  previewUuid: string | null;
};
type Post = {
  uuid: string;
  text: string | null;
  price: number | null;
  audience: "subscribers" | "followers-and-subscribers";
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
};

const emptyMedia: MediaValue = { media: [], priceMinor: null, previewUuid: null };

export function ContentPlanner() {
  const [text, setText] = useState("");
  const [mediaValue, setMediaValue] = useState<MediaValue>(emptyMedia);
  const [audience, setAudience] = useState<Post["audience"]>("followers-and-subscribers");
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [intensity, setIntensity] = useState<"coqueto" | "atrevido" | "explicito">("atrevido");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [visualSummary, setVisualSummary] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [mediaKey, setMediaKey] = useState(0);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const response = await fetch("/api/posts", { cache: "no-store" });
      const body = await response.json() as { data?: Post[]; error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudieron cargar las publicaciones.");
      setPosts(body.data ?? []);
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudieron cargar las publicaciones.", { variant: "error" });
    } finally {
      setLoadingPosts(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadPosts(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPosts]);

  const firstImage = useMemo(
    () => mediaValue.media.find((item) => item.mediaType === "image"),
    [mediaValue.media],
  );

  async function generateCaption() {
    if (!firstImage) {
      enqueueSnackbar("Agrega al menos una foto para que la IA pueda analizarla.", { variant: "info" });
      return;
    }
    setGenerating(true);
    try {
      const response = await fetch("/api/posts/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mediaUuid: firstImage.uuid,
          intensity,
          objective: mediaValue.priceMinor ? "ppv" : "engagement",
        }),
      });
      const body = await response.json() as {
        suggestion?: { caption: string; visualSummary: string; tone: string };
        error?: string;
      };
      if (!response.ok || !body.suggestion) throw new Error(body.error || "No se pudo generar el texto.");
      setText(body.suggestion.caption);
      setVisualSummary(body.suggestion.visualSummary);
      enqueueSnackbar(`Caption ${body.suggestion.tone.toLocaleLowerCase()} generado.`, { variant: "success" });
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo generar el texto.", { variant: "error" });
    } finally {
      setGenerating(false);
    }
  }

  async function publish() {
    if (!text.trim() && mediaValue.media.length === 0) {
      enqueueSnackbar("Agrega un texto, una foto o un video.", { variant: "warning" });
      return;
    }
    if (publishMode === "schedule" && !scheduledAt) {
      enqueueSnackbar("Elige la fecha y hora de publicación.", { variant: "warning" });
      return;
    }
    setPublishing(true);
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          mediaUuids: mediaValue.media.map((item) => item.uuid),
          mediaPreviewUuid: mediaValue.previewUuid,
          price: mediaValue.priceMinor,
          audience,
          publishAt: publishMode === "schedule" ? new Date(scheduledAt).toISOString() : null,
        }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "No se pudo crear la publicación.");
      enqueueSnackbar(publishMode === "schedule" ? "Contenido programado en Fanvue." : "Contenido publicado en Fanvue.", { variant: "success" });
      setText("");
      setMediaValue(emptyMedia);
      setVisualSummary("");
      setScheduledAt("");
      setPublishMode("now");
      setMediaKey((value) => value + 1);
      await loadPosts();
    } catch (error) {
      enqueueSnackbar(error instanceof Error ? error.message : "No se pudo crear la publicación.", { variant: "error" });
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
      <section className="overflow-hidden rounded-3xl border border-white/8 bg-[#15171d] shadow-2xl shadow-black/10">
        <header className="border-b border-white/8 bg-gradient-to-r from-violet-500/[.08] via-transparent to-fuchsia-500/[.05] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[.18em] text-violet-300">Nuevo contenido</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Crea, vende o programa</h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">Fanvue guardará la programación; puedes cerrar el navegador o apagar tu laptop.</p>
            </div>
            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[.06] px-3 py-1.5 text-[10px] text-emerald-300">Publicación nativa</span>
          </div>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          <MediaFields key={mediaKey} onValueChange={setMediaValue} />

          <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[.035] p-4">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white"><WandSparkles className="size-4 text-violet-300" />Caption con IA visual</div>
                <p className="mt-1 text-[11px] leading-5 text-zinc-500">Analiza la primera foto seleccionada y escribe según lo que realmente aparece.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(["coqueto", "atrevido", "explicito"] as const).map((value) => (
                  <button key={value} type="button" onClick={() => setIntensity(value)} className={`cursor-pointer rounded-xl border px-3 py-2 text-[11px] capitalize transition ${intensity === value ? "border-violet-400/40 bg-violet-500 text-white" : "border-white/8 text-zinc-500 hover:bg-white/5"}`}>{value === "explicito" ? "Explícito" : value}</button>
                ))}
                <button type="button" disabled={!firstImage || generating} onClick={() => void generateCaption()} className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-[11px] font-bold text-zinc-950 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-35">
                  {generating ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  {generating ? "Analizando…" : "GENERAR"}
                </button>
              </div>
            </div>
            {visualSummary ? <p className="mt-3 rounded-xl border border-white/6 bg-black/15 px-3 py-2 text-[10px] leading-4 text-zinc-500"><span className="font-medium text-zinc-300">La IA detectó:</span> {visualSummary}</p> : null}
          </div>

          <label className="block">
            <span className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-300"><span>Texto de la publicación</span><span className="text-[10px] font-normal text-zinc-600">{text.length}/5000</span></span>
            <textarea value={text} onChange={(event) => setText(event.target.value.slice(0, 5_000))} rows={6} placeholder="Escribe tu caption o deja que la IA analice la foto…" className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-400/40 focus:ring-4 focus:ring-violet-400/[.06]" />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <fieldset className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <legend className="px-1 text-xs font-medium text-zinc-300">Audiencia</legend>
              <div className="mt-2 grid gap-2">
                <Choice active={audience === "followers-and-subscribers"} icon={<Users className="size-4" />} title="Seguidores y suscriptores" detail="Mayor alcance" onClick={() => setAudience("followers-and-subscribers")} />
                <Choice active={audience === "subscribers"} icon={<LockKeyhole className="size-4" />} title="Solo suscriptores" detail="Contenido exclusivo" onClick={() => setAudience("subscribers")} />
              </div>
            </fieldset>
            <fieldset className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <legend className="px-1 text-xs font-medium text-zinc-300">Cuándo publicar</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Choice active={publishMode === "now"} icon={<Send className="size-4" />} title="Ahora" detail="Publicar al instante" onClick={() => setPublishMode("now")} />
                <Choice active={publishMode === "schedule"} icon={<CalendarClock className="size-4" />} title="Programar" detail="Fecha y hora" onClick={() => setPublishMode("schedule")} />
              </div>
              {publishMode === "schedule" ? <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-[#20222b] px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-violet-400/40" /> : null}
            </fieldset>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">{mediaValue.priceMinor ? <><LockKeyhole className="size-3.5 text-amber-300" />PPV · ${(mediaValue.priceMinor / 100).toFixed(2)}</> : <><ImageIcon className="size-3.5" />Publicación gratuita</>}</div>
            <button type="button" disabled={publishing} onClick={() => void publish()} className="flex min-w-52 cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/20 transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-50">
              {publishing ? <LoaderCircle className="size-4 animate-spin" /> : publishMode === "schedule" ? <CalendarClock className="size-4" /> : <Send className="size-4" />}
              {publishing ? "Procesando…" : publishMode === "schedule" ? "Programar contenido" : "Publicar ahora"}
            </button>
          </div>
        </div>
      </section>

      <aside className="self-start overflow-hidden rounded-3xl border border-white/8 bg-[#15171d] xl:sticky xl:top-6">
        <header className="flex items-center justify-between border-b border-white/8 p-5"><div><h2 className="text-sm font-semibold text-white">Contenido reciente</h2><p className="mt-1 text-[10px] text-zinc-600">Publicado y programado en Fanvue</p></div><Clock3 className="size-4 text-violet-300" /></header>
        <div className="max-h-[720px] overflow-y-auto">
          {loadingPosts ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="size-6 animate-spin text-violet-400" /></div> : posts.length ? posts.map((post) => <PostRow key={post.uuid} post={post} />) : <div className="grid min-h-56 place-items-center px-6 text-center text-xs leading-5 text-zinc-600">Tus publicaciones aparecerán aquí.</div>}
        </div>
      </aside>
    </div>
  );
}

function Choice({ active, icon, title, detail, onClick }: { active: boolean; icon: React.ReactNode; title: string; detail: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-violet-400/40 bg-violet-400/[.08] text-violet-200" : "border-white/8 text-zinc-500 hover:bg-white/[.03]"}`}><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? "bg-violet-500/20" : "bg-white/[.04]"}`}>{icon}</span><span><span className="block text-xs font-medium">{title}</span><span className="mt-0.5 block text-[9px] text-zinc-600">{detail}</span></span></button>;
}

function PostRow({ post }: { post: Post }) {
  const scheduled = Boolean(post.publishAt && !post.publishedAt);
  const date = post.publishAt ?? post.publishedAt ?? post.createdAt;
  return <article className="border-b border-white/7 p-4 last:border-b-0"><div className="flex items-start gap-3"><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl ${scheduled ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300"}`}>{scheduled ? <Clock3 className="size-4" /> : <CheckCircle2 className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className={`text-[10px] font-medium uppercase tracking-wide ${scheduled ? "text-amber-300" : "text-emerald-300"}`}>{scheduled ? "Programado" : "Publicado"}</p>{post.price ? <span className="rounded-md bg-amber-400/8 px-2 py-1 text-[9px] text-amber-200">PPV ${(post.price / 100).toFixed(2)}</span> : null}</div><p className="mt-2 line-clamp-3 text-xs leading-5 text-zinc-400">{post.text || "Publicación multimedia sin texto"}</p><p className="mt-2 text-[9px] text-zinc-700">{new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(new Date(date))}</p></div></div></article>;
}

