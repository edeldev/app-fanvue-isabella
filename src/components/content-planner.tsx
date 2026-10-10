/* eslint-disable @next/next/no-img-element -- Fanvue entrega URLs temporales firmadas. */
"use client";

import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Heart,
  ImageIcon,
  LoaderCircle,
  LockKeyhole,
  MessageCircle,
  Play,
  RefreshCw,
  Send,
  Sparkles,
  Users,
  WandSparkles,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { enqueueSnackbar } from "notistack";
import { MediaFields, type AttachedMedia } from "@/components/media-fields";
import {
  MediaGalleryLightbox,
  type LightboxMedia,
} from "@/components/media-lightbox";

type MediaValue = {
  media: AttachedMedia[];
  priceMinor: number | null;
  previewUuid: string | null;
};
type Post = {
  uuid: string;
  text: string | null;
  price: number | null;
  mediaPreviewUuid: string | null;
  mediaUuids: string[];
  media: Array<{
    uuid: string;
    name: string;
    mediaType: "image" | "video";
    url: string;
    thumbnailUrl: string;
    isPreview: boolean;
  }>;
  audience: "subscribers" | "followers-and-subscribers";
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  commentsCount: number;
  likesCount: number;
};

const emptyMedia: MediaValue = {
  media: [],
  priceMinor: null,
  previewUuid: null,
};

export function ContentPlanner() {
  const [text, setText] = useState("");
  const [mediaValue, setMediaValue] = useState<MediaValue>(emptyMedia);
  const [audience, setAudience] = useState<Post["audience"]>(
    "followers-and-subscribers",
  );
  const [publishMode, setPublishMode] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [intensity, setIntensity] = useState<
    "coqueto" | "atrevido" | "explicito"
  >("atrevido");
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [visualSummary, setVisualSummary] = useState("");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postFilter, setPostFilter] = useState<
    "all" | "published" | "scheduled"
  >("all");
  const [mediaKey, setMediaKey] = useState(0);

  const loadPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const response = await fetch("/api/posts", { cache: "no-store" });
      const body = (await response.json()) as { data?: Post[]; error?: string };
      if (!response.ok)
        throw new Error(
          body.error || "No se pudieron cargar las publicaciones.",
        );
      setPosts(body.data ?? []);
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error
          ? error.message
          : "No se pudieron cargar las publicaciones.",
        { variant: "error" },
      );
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
  const visiblePosts = useMemo(
    () =>
      posts.filter((post) => {
        const scheduled = Boolean(post.publishAt && !post.publishedAt);
        if (postFilter === "scheduled") return scheduled;
        if (postFilter === "published") return !scheduled;
        return true;
      }),
    [postFilter, posts],
  );
  const postCounts = useMemo(
    () => ({
      all: posts.length,
      published: posts.filter((post) => !post.publishAt || post.publishedAt)
        .length,
      scheduled: posts.filter((post) => post.publishAt && !post.publishedAt)
        .length,
    }),
    [posts],
  );

  async function generateCaption() {
    if (!firstImage) {
      enqueueSnackbar(
        "Agrega al menos una foto para que la IA pueda analizarla.",
        { variant: "info" },
      );
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
      const body = (await response.json()) as {
        suggestion?: { caption: string; visualSummary: string; tone: string };
        error?: string;
      };
      if (!response.ok || !body.suggestion)
        throw new Error(body.error || "No se pudo generar el texto.");
      setText(body.suggestion.caption);
      setVisualSummary(body.suggestion.visualSummary);
      enqueueSnackbar(
        `Caption ${body.suggestion.tone.toLocaleLowerCase()} generado.`,
        { variant: "success" },
      );
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error ? error.message : "No se pudo generar el texto.",
        { variant: "error" },
      );
    } finally {
      setGenerating(false);
    }
  }

  async function publish() {
    if (!text.trim() && mediaValue.media.length === 0) {
      enqueueSnackbar("Agrega un texto, una foto o un video.", {
        variant: "warning",
      });
      return;
    }
    if (publishMode === "schedule" && !scheduledAt) {
      enqueueSnackbar("Elige la fecha y hora de publicación.", {
        variant: "warning",
      });
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
          publishAt:
            publishMode === "schedule"
              ? new Date(scheduledAt).toISOString()
              : null,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || "No se pudo crear la publicación.");
      enqueueSnackbar(
        publishMode === "schedule"
          ? "Contenido programado en Fanvue."
          : "Contenido publicado en Fanvue.",
        { variant: "success" },
      );
      setText("");
      setMediaValue(emptyMedia);
      setVisualSummary("");
      setScheduledAt("");
      setPublishMode("now");
      setMediaKey((value) => value + 1);
      await loadPosts();
    } catch (error) {
      enqueueSnackbar(
        error instanceof Error
          ? error.message
          : "No se pudo crear la publicación.",
        { variant: "error" },
      );
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(430px,.8fr)]">
      <section className="overflow-hidden rounded-3xl border border-white/8 bg-[#15171d] shadow-2xl shadow-black/10">
        <header className="border-b border-white/8 bg-gradient-to-r from-violet-500/[.08] via-transparent to-fuchsia-500/[.05] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[.18em] text-violet-300">
                Nuevo contenido
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Crea, vende o programa
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Fanvue guardará la programación; puedes cerrar el navegador o
                apagar tu laptop.
              </p>
            </div>
            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[.06] px-3 py-1.5 text-[10px] text-emerald-300">
              Publicación nativa
            </span>
          </div>
        </header>

        <div className="space-y-6 p-5 sm:p-6">
          <MediaFields key={mediaKey} onValueChange={setMediaValue} />

          <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[.035] p-4">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <WandSparkles className="size-4 text-violet-300" />
                  Caption con IA visual
                </div>
                <p className="mt-1 text-[11px] leading-5 text-zinc-500">
                  Analiza la primera foto seleccionada y escribe según lo que
                  realmente aparece.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 w-full justify-end">
                {(["coqueto", "atrevido", "explicito"] as const).map(
                  (value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setIntensity(value)}
                      className={`cursor-pointer rounded-xl border px-3 py-2 text-[11px] capitalize transition ${intensity === value ? "border-violet-400/40 bg-violet-500 text-white" : "border-white/8 text-zinc-500 hover:bg-white/5"}`}
                    >
                      {value === "explicito" ? "Explícito" : value}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={!firstImage || generating}
                  onClick={() => void generateCaption()}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-4 py-2 text-[11px] font-bold text-zinc-950 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {generating ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="size-3.5" />
                  )}
                  {generating ? "Analizando…" : "GENERAR"}
                </button>
              </div>
            </div>
            {visualSummary ? (
              <p className="mt-3 rounded-xl border border-white/6 bg-black/15 px-3 py-2 text-[10px] leading-4 text-zinc-500">
                <span className="font-medium text-zinc-300">
                  La IA detectó:
                </span>{" "}
                {visualSummary}
              </p>
            ) : null}
          </div>

          <label className="block">
            <span className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-300">
              <span>Texto de la publicación</span>
              <span className="text-[10px] font-normal text-zinc-600">
                {text.length}/5000
              </span>
            </span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, 5_000))}
              rows={6}
              placeholder="Escribe tu caption o deja que la IA analice la foto…"
              className="w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-zinc-700 focus:border-violet-400/40 focus:ring-4 focus:ring-violet-400/[.06]"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <fieldset className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <legend className="px-1 text-xs font-medium text-zinc-300">
                Audiencia
              </legend>
              <div className="mt-2 grid gap-2">
                <Choice
                  active={audience === "followers-and-subscribers"}
                  icon={<Users className="size-4" />}
                  title="Seguidores y suscriptores"
                  detail="Mayor alcance"
                  onClick={() => setAudience("followers-and-subscribers")}
                />
                <Choice
                  active={audience === "subscribers"}
                  icon={<LockKeyhole className="size-4" />}
                  title="Solo suscriptores"
                  detail="Contenido exclusivo"
                  onClick={() => setAudience("subscribers")}
                />
              </div>
            </fieldset>
            <fieldset className="rounded-2xl border border-white/8 bg-black/10 p-4">
              <legend className="px-1 text-xs font-medium text-zinc-300">
                Cuándo publicar
              </legend>
              <div className="mt-2 grid gap-2">
                <Choice
                  active={publishMode === "now"}
                  icon={<Send className="size-4" />}
                  title="Ahora"
                  detail="Publicar al instante"
                  onClick={() => setPublishMode("now")}
                />
                <Choice
                  active={publishMode === "schedule"}
                  icon={<CalendarClock className="size-4" />}
                  title="Programar"
                  detail="Fecha y hora"
                  onClick={() => setPublishMode("schedule")}
                />
              </div>
              {publishMode === "schedule" ? (
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="mt-3 w-full rounded-xl border border-white/10 bg-[#20222b] px-3 py-2.5 text-xs text-zinc-200 outline-none focus:border-violet-400/40"
                />
              ) : null}
            </fieldset>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-white/8 pt-5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-[11px] text-zinc-600">
              {mediaValue.priceMinor ? (
                <>
                  <LockKeyhole className="size-3.5 text-amber-300" />
                  PPV · ${(mediaValue.priceMinor / 100).toFixed(2)}
                </>
              ) : (
                <>
                  <ImageIcon className="size-3.5" />
                  Publicación gratuita
                </>
              )}
            </div>
            <button
              type="button"
              disabled={publishing}
              onClick={() => void publish()}
              className="flex min-w-52 cursor-pointer items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-950/20 transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-50"
            >
              {publishing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : publishMode === "schedule" ? (
                <CalendarClock className="size-4" />
              ) : (
                <Send className="size-4" />
              )}
              {publishing
                ? "Procesando…"
                : publishMode === "schedule"
                  ? "Programar contenido"
                  : "Publicar ahora"}
            </button>
          </div>
        </div>
      </section>

      <aside className="self-start overflow-hidden rounded-3xl border border-white/8 bg-[#15171d] shadow-2xl shadow-black/10 xl:sticky xl:top-6">
        <header className="border-b border-white/8 bg-gradient-to-br from-white/[.025] to-transparent p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[.16em] text-violet-300">
                Tu escaparate
              </p>
              <h2 className="mt-1 text-base font-semibold text-white">
                Publicaciones
              </h2>
              <p className="mt-1 text-[10px] leading-4 text-zinc-600">
                Revisa exactamente qué contenido y texto ya enviaste a Fanvue.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadPosts()}
              disabled={loadingPosts}
              aria-label="Actualizar publicaciones"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-white/8 bg-black/15 text-zinc-500 transition hover:border-violet-400/30 hover:text-violet-300 disabled:cursor-wait"
            >
              <RefreshCw
                className={`size-4 ${loadingPosts ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl border border-white/7 bg-black/20 p-1">
            {(
              [
                ["all", "Todo", postCounts.all],
                ["published", "Publicado", postCounts.published],
                ["scheduled", "Programado", postCounts.scheduled],
              ] as const
            ).map(([value, label, count]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPostFilter(value)}
                className={`cursor-pointer rounded-lg px-2 py-2 text-[10px] font-medium transition ${postFilter === value ? "bg-violet-500 text-white shadow-md shadow-violet-950/20" : "text-zinc-600 hover:bg-white/[.04] hover:text-zinc-300"}`}
              >
                {label} <span className="ml-1 opacity-70">{count}</span>
              </button>
            ))}
          </div>
        </header>
        <div className="max-h-[760px] space-y-3 overflow-y-auto p-3 [scrollbar-color:#3f3f46_transparent]">
          {loadingPosts ? (
            <PostSkeletons />
          ) : visiblePosts.length ? (
            visiblePosts.map((post) => <PostRow key={post.uuid} post={post} />)
          ) : (
            <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/8 px-6 text-center">
              <div>
                <ImageIcon className="mx-auto size-7 text-zinc-700" />
                <p className="mt-3 text-xs text-zinc-500">
                  No hay publicaciones en este filtro.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Choice({
  active,
  icon,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition ${active ? "border-violet-400/40 bg-violet-400/[.08] text-violet-200" : "border-white/8 text-zinc-500 hover:bg-white/[.03]"}`}
    >
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-lg ${active ? "bg-violet-500/20" : "bg-white/[.04]"}`}
      >
        {icon}
      </span>
      <span>
        <span className="block text-xs font-medium">{title}</span>
        <span className="mt-0.5 block text-[9px] text-zinc-600">{detail}</span>
      </span>
    </button>
  );
}

function PostRow({ post }: { post: Post }) {
  const scheduled = Boolean(post.publishAt && !post.publishedAt);
  const date = post.publishAt ?? post.publishedAt ?? post.createdAt;
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const longText = (post.text?.length ?? 0) > 220;
  const lightboxItems: LightboxMedia[] = post.media.map((item) => ({
    id: item.uuid,
    src: item.url,
    type: item.mediaType,
    name: item.name,
    poster: item.mediaType === "video" ? item.thumbnailUrl : undefined,
  }));

  return (
    <article className="overflow-hidden rounded-2xl border border-white/8 bg-[#111319] transition hover:border-white/12">
      {post.media.length ? (
        <div
          className={`grid gap-px bg-black ${post.media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {post.media.slice(0, 4).map((item, index) => {
            const remaining = post.media.length - 4;
            return (
              <button
                key={item.uuid}
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label={`Abrir ${item.name}`}
                className={`group relative cursor-zoom-in overflow-hidden bg-zinc-950 ${post.media.length === 1 ? "aspect-[16/10]" : "aspect-[4/3]"}`}
              >
                <img
                  src={item.thumbnailUrl || item.url}
                  alt={item.name}
                  className="size-full object-cover transition duration-500 group-hover:scale-[1.035] group-hover:opacity-90"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
                {item.mediaType === "video" ? (
                  <span className="absolute left-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/65 text-white backdrop-blur">
                    <Play className="ml-0.5 size-4 fill-current" />
                  </span>
                ) : null}
                {item.isPreview ? (
                  <span className="absolute bottom-2 left-2 rounded-md border border-white/10 bg-black/70 px-2 py-1 text-[8px] font-medium uppercase tracking-wide text-white backdrop-blur">
                    Vista gratis
                  </span>
                ) : post.price ? (
                  <span className="absolute bottom-2 left-2 grid size-6 place-items-center rounded-md bg-black/70 text-amber-200 backdrop-blur">
                    <LockKeyhole className="size-3" />
                  </span>
                ) : null}
                {remaining > 0 && index === 3 ? (
                  <span className="absolute inset-0 grid place-items-center bg-black/70 text-lg font-semibold text-white">
                    +{remaining}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-medium ${scheduled ? "bg-amber-400/10 text-amber-300" : "bg-emerald-400/10 text-emerald-300"}`}
            >
              {scheduled ? (
                <Clock3 className="size-3" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              {scheduled ? "Programado" : "Publicado"}
            </span>
            <span className="rounded-full bg-white/[.045] px-2.5 py-1 text-[9px] text-zinc-500">
              {post.audience === "subscribers"
                ? "Suscriptores"
                : "Seguidores + suscriptores"}
            </span>
          </div>
          {post.price ? (
            <span className="shrink-0 rounded-full border border-amber-400/15 bg-amber-400/[.07] px-2.5 py-1 text-[9px] font-semibold text-amber-200">
              PPV ${(post.price / 100).toFixed(2)}
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-white/[.04] px-2.5 py-1 text-[9px] text-zinc-500">
              Gratis
            </span>
          )}
        </div>
        <p
          className={`mt-3 whitespace-pre-wrap break-words text-xs leading-5 ${post.text ? "text-zinc-300" : "italic text-zinc-600"} ${!expanded && longText ? "line-clamp-4" : ""}`}
        >
          {post.text || "Publicación multimedia sin texto"}
        </p>
        {longText ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[10px] font-medium text-violet-300 hover:text-violet-200"
          >
            {expanded ? "Mostrar menos" : "Ver texto completo"}
            <ChevronDown
              className={`size-3 transition ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/6 pt-3">
          <p className="text-[9px] text-zinc-600">
            {new Intl.DateTimeFormat("es-MX", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(date))}
          </p>
          <div className="flex items-center gap-3 text-[9px] text-zinc-600">
            <span className="inline-flex items-center gap-1">
              <Heart className="size-3" />
              {post.likesCount}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3" />
              {post.commentsCount}
            </span>
          </div>
        </div>
      </div>
      {lightboxIndex !== null ? (
        <MediaGalleryLightbox
          items={lightboxItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </article>
  );
}

function PostSkeletons() {
  return (
    <>
      {[0, 1].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-2xl border border-white/7 bg-[#111319]"
        >
          <div className="aspect-[16/8] animate-pulse bg-white/[.035]" />
          <div className="space-y-3 p-4">
            <div className="h-5 w-2/5 animate-pulse rounded-full bg-white/[.04]" />
            <div className="h-3 w-full animate-pulse rounded bg-white/[.035]" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-white/[.035]" />
          </div>
        </div>
      ))}
    </>
  );
}
