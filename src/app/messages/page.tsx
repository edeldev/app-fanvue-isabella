import { cookies } from "next/headers";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Search } from "lucide-react";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { LiveRefresh } from "@/components/live-refresh";
import { FanPresenceReconciler } from "@/components/fan-presence-reconciler";
import { MarkConversationRead } from "@/components/mark-conversation-read";
import { MessageHistory } from "@/components/message-history";
import { MessageComposer } from "@/components/message-composer";
import { ExpandableImage } from "@/components/expandable-image";
import { ChatMediaCarousel } from "@/components/chat-media-carousel";
import { fanvueRequest } from "@/lib/fanvue/client";
import {
  chatMediaPageSchema,
  messagesPageSchema,
} from "@/lib/fanvue/sync-schemas";
import { FanvueError } from "@/lib/fanvue/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  CREATOR_SESSION_COOKIE,
  readCreatorSession,
} from "@/lib/session/creator-session";
import { getValidFanvueAccessToken } from "@/services/fanvue/get-access-token";
import { fanFilterWhere, isFanOnlineNow, type FanFilter } from "@/domain/fans/filters";

type Props = {
  searchParams: Promise<{
    fan?: string;
    q?: string;
    filter?: string;
    sent?: string;
    error?: string;
  }>;
};
type ResolvedMedia = {
  uuid: string;
  variantUuids: string[];
  mediaType: string;
  name: string | null;
  url?: string;
  priceMinor: number | null;
  purchasedAt: string | null;
};
const audience = [
  { isFollower: true },
  { isSubscriber: true },
  { isExpiredSubscriber: true },
];
const conversationFilters = [
  { value: "all", label: "Todos" },
  { value: "unread", label: "No leídos" },
  { value: "online", label: "En línea", fanFilter: "ONLINE" },
  { value: "subscribers", label: "Suscriptores", fanFilter: "ACTIVE_SUBSCRIBERS" },
  { value: "paid", label: "De pago", fanFilter: "PAID_SUBSCRIBERS" },
  { value: "trial", label: "Prueba gratuita", fanFilter: "FREE_TRIAL_SUBSCRIBERS" },
  { value: "followers", label: "Seguidores", fanFilter: "FOLLOWERS" },
  { value: "followers_only", label: "Solo seguidores", fanFilter: "FOLLOWERS_ONLY" },
  { value: "expired", label: "Vencidos", fanFilter: "EXPIRED_SUBSCRIBERS" },
  { value: "spent_50", label: "Gastaron +$50", fanFilter: "SPENT_MORE_THAN_50" },
  { value: "tipped", label: "Dieron propina", fanFilter: "HAS_TIPPED" },
  { value: "purchased", label: "Compraron", fanFilter: "HAS_PURCHASED" },
  { value: "vip", label: "VIP", fanFilter: "TOP_SPENDERS" },
] as const satisfies ReadonlyArray<{ value: string; label: string; fanFilter?: FanFilter }>;
const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "F";

export default async function MessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const creatorId = readCreatorSession(
    (await cookies()).get(CREATOR_SESSION_COOKIE)?.value,
  );
  const query = params.q?.trim() ?? "";
  const activeFilter = conversationFilters.some((item) => item.value === params.filter)
    ? params.filter!
    : "all";
  const unreadOnly = activeFilter === "unread";
  const selectedFilter = conversationFilters.find((item) => item.value === activeFilter);
  const fanSegment = selectedFilter && "fanFilter" in selectedFilter
    ? fanFilterWhere(selectedFilter.fanFilter)
    : {};
  const conversations = creatorId
    ? await prisma.conversation.findMany({
        where: {
          creatorId,
          ...(unreadOnly ? { unreadMessagesCount: { gt: 0 } } : {}),
          fan: {
            isCreatorAccount: false,
            AND: [
              { OR: audience },
              fanSegment,
              ...(query
                ? [
                    {
                      OR: [
                        {
                          username: {
                            contains: query,
                            mode: "insensitive" as const,
                          },
                        },
                        {
                          displayName: {
                            contains: query,
                            mode: "insensitive" as const,
                          },
                        },
                      ],
                    },
                  ]
                : []),
            ],
          },
        },
        include: {
          fan: true,
          messages: { orderBy: { sentAt: "desc" }, take: 1 },
        },
        orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
        take: 100,
      })
    : [];
  const templates = creatorId
    ? await prisma.messageTemplate.findMany({
        where: { creatorId, status: "ACTIVE" },
        select: {
          id: true,
          name: true,
          text: true,
          category: true,
          metadata: true,
        },
        orderBy: [{ category: "asc" }, { name: "asc" }],
      })
    : [];
  const selected =
    creatorId && params.fan
      ? await prisma.conversation.findFirst({
          where: {
            creatorId,
            fan: {
              fanvueUserId: params.fan,
              isCreatorAccount: false,
              OR: audience,
            },
          },
          include: { fan: true },
        })
      : null;
  let messages: Array<{
    uuid: string;
    text: string | null;
    sentAt: string | null;
    sender: { uuid: string; handle: string };
    type: string;
    isRead: boolean;
    hasMedia: boolean | null;
    mediaType: "image" | "video" | "audio" | "document" | null;
    mediaUuids: string[];
    mediaPreviewUuid: string | null;
    previewMediaUuid: string | null;
    media_preview_uuid: string | null;
    pricing: { USD: { price: number } } | null;
    purchasedAt: string | null;
    gif: { title: string | null; url: string | null } | null;
  }> = [];
  const mediaByMessage = new Map<string, ResolvedMedia[]>();
  let historyError = false;
  if (creatorId && selected) {
    try {
      const token = await getValidFanvueAccessToken(creatorId);
      const result = await fanvueRequest(
        `/v1/chats/${selected.fan.fanvueUserId}/messages?page=1&size=50&markAsRead=false`,
        token,
        messagesPageSchema,
      );
      const localPpv = await prisma.message.findMany({
        where: {
          creatorId,
          fanvueMessageId: { in: result.data.map((message) => message.uuid) },
        },
        select: {
          fanvueMessageId: true,
          mediaUuids: true,
          mediaPreviewUuid: true,
          priceMinor: true,
        },
      });
      const localPpvByMessage = new Map(
        localPpv.map((message) => [message.fanvueMessageId, message]),
      );
      messages = [
        ...new Map(
          result.data.map((message) => {
            const saved = localPpvByMessage.get(message.uuid);
            const savedMediaUuids = Array.isArray(saved?.mediaUuids)
              ? saved.mediaUuids.filter(
                  (uuid): uuid is string => typeof uuid === "string",
                )
              : [];
            return [
              message.uuid,
              {
                ...message,
                mediaUuids:
                  savedMediaUuids.length > 0
                    ? savedMediaUuids
                    : message.mediaUuids,
                mediaPreviewUuid:
                  saved?.mediaPreviewUuid ?? message.mediaPreviewUuid,
                pricing:
                  saved?.priceMinor != null
                    ? { USD: { price: saved.priceMinor } }
                    : message.pricing,
              },
            ];
          }),
        ).values(),
      ].reverse();
      try {
        const mediaPage = await fanvueRequest(
          `/v1/chats/${selected.fan.fanvueUserId}/media?limit=50`,
          token,
          chatMediaPageSchema,
        );
        mediaPage.data.forEach((item) => {
          const preferred =
            item.variants.find(
              (variant) => variant.variantType === "main" && variant.url,
            ) ??
            item.variants.find(
              (variant) => variant.variantType === "thumbnail" && variant.url,
            ) ??
            item.variants.find((variant) => variant.url);
          const current = mediaByMessage.get(item.messageUuid) ?? [];
          if (current.some((media) => media.uuid === item.uuid)) return;
          current.push({
            uuid: item.uuid,
            variantUuids: item.variants.flatMap((variant) =>
              variant.uuid ? [variant.uuid] : [],
            ),
            mediaType: item.mediaType,
            name: item.name,
            url: preferred?.url,
            priceMinor:
              item.pricing?.USD.price ?? item.amountPaid?.USD.price ?? null,
            purchasedAt: item.purchasedAt,
          });
          mediaByMessage.set(item.messageUuid, current);
        });
      } catch (caught) {
        logger.error("Fanvue conversation media failed", {
          errorName: caught instanceof Error ? caught.name : "UnknownError",
          errorCode: caught instanceof FanvueError ? caught.code : undefined,
          status: caught instanceof FanvueError ? caught.status : undefined,
        });
      }
    } catch (caught) {
      logger.error("Fanvue message history failed", {
        errorName: caught instanceof Error ? caught.name : "UnknownError",
        errorCode: caught instanceof FanvueError ? caught.code : undefined,
        status: caught instanceof FanvueError ? caught.status : undefined,
      });
      historyError = true;
    }
  }
  const unreadTotal = conversations.reduce(
    (sum, item) => sum + item.unreadMessagesCount,
    0,
  );
  const conversationHref = (fanUuid: string) => {
    const next = new URLSearchParams({ fan: fanUuid });
    if (query) next.set("q", query);
    if (activeFilter !== "all") next.set("filter", activeFilter);
    return `/messages?${next}`;
  };
  const inboxParams = new URLSearchParams();
  if (query) inboxParams.set("q", query);
  if (activeFilter !== "all") inboxParams.set("filter", activeFilter);
  const inboxHref = inboxParams.size ? `/messages?${inboxParams}` : "/messages";
  const filterHref = (filter: string) => {
    const next = new URLSearchParams();
    if (query) next.set("q", query);
    if (filter !== "all") next.set("filter", filter);
    return next.size ? `/messages?${next}` : "/messages";
  };
  const conversationIsOpen = Boolean(params.fan);

  return (
    <div className="flex min-h-screen bg-[#101218] text-zinc-100 md:h-dvh md:overflow-hidden">
      <LiveRefresh />
      <FanPresenceReconciler />
      {selected && selected.unreadMessagesCount > 0 ? (
        <MarkConversationRead fanUuid={selected.fan.fanvueUserId} />
      ) : null}
      <Sidebar />
      <div className="min-w-0 flex-1 md:flex md:h-dvh md:flex-col md:overflow-hidden">
        <Topbar />
        <main id="main-content" tabIndex={-1} className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col px-3 py-4 sm:px-5 sm:py-5 md:min-h-0 md:px-8">
          <div className="mb-4 shrink-0">
            <p className="mb-1 text-xs font-medium uppercase tracking-[.18em] text-violet-400">
              Bandeja de entrada
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Mensajes
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Conversaciones con fans y suscriptores sincronizadas con Fanvue.
            </p>
          </div>
          <div className="grid min-h-[620px] flex-1 overflow-hidden rounded-2xl border border-white/8 bg-white/[.025] md:min-h-0 md:grid-cols-[340px_minmax(0,1fr)]">
            <section className={`${conversationIsOpen ? "hidden md:flex" : "flex"} min-h-0 flex-col border-b border-white/8 md:border-b-0 md:border-r`}>
              <div className="shrink-0 border-b border-white/8 p-4">
                <form className="flex items-center gap-2 rounded-xl border border-white/8 bg-black/20 px-3 py-2.5">
                  <Search className="size-4 text-zinc-600" />
                  <input
                    name="q"
                    defaultValue={query}
                    placeholder="Buscar conversación"
                    className="min-w-0 flex-1 bg-transparent text-sm text-zinc-200 outline-none placeholder:text-zinc-600"
                  />
                  {activeFilter !== "all" ? (
                    <input type="hidden" name="filter" value={activeFilter} />
                  ) : null}
                </form>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 text-xs [scrollbar-width:thin]">
                  {conversationFilters.map((filter) => (
                    <Link
                      key={filter.value}
                      href={filterHref(filter.value)}
                      prefetch={false}
                      aria-current={activeFilter === filter.value ? "page" : undefined}
                      className={`shrink-0 rounded-full border px-3 py-1.5 transition ${activeFilter === filter.value ? "border-violet-400/30 bg-violet-500 text-white shadow-md shadow-violet-950/30" : "border-white/8 bg-white/5 text-zinc-400 hover:border-white/15 hover:bg-white/8 hover:text-white"}`}
                    >
                      {filter.label}{filter.value === "unread" && unreadTotal > 0 ? ` (${unreadTotal})` : ""}
                    </Link>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {conversations.map((item) => {
                  const name =
                    item.fan.displayName || item.fan.username || "Fan";
                  const last = item.messages[0];
                  return (
                    <Link
                      prefetch={false}
                      key={item.id}
                      href={conversationHref(item.fan.fanvueUserId)}
                      className={`flex gap-3 border-b border-white/5 px-4 py-4 transition hover:bg-white/5 ${selected?.id === item.id ? "bg-violet-500/10" : ""}`}
                    >
                      <div className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500/50 to-fuchsia-600/40 text-xs font-semibold">
                        {initials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium text-zinc-200">
                            {name}
                          </p>
                          {item.unreadMessagesCount > 0 ? (
                            <span className="rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-semibold">
                              {item.unreadMessagesCount}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">
                          {last?.text || "Conversación sincronizada"}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {isFanOnlineNow(item.fan.isOnline, item.fan.presenceChangedAt) ? <span className="rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">En línea</span> : null}
                          {item.fan.isSubscriber || item.fan.isFreeTrialSubscriber ? <span className="rounded-full bg-violet-400/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-300">{item.fan.isFreeTrialSubscriber ? "Prueba" : "Suscriptor"}</span> : item.fan.isFollower ? <span className="rounded-full bg-sky-400/10 px-1.5 py-0.5 text-[9px] font-medium text-sky-300">Seguidor</span> : null}
                        </div>
                        <p className="mt-1 text-[10px] text-zinc-700">
                          {item.lastMessageAt?.toLocaleString("es-MX") ??
                            "Sin fecha"}
                        </p>
                      </div>
                    </Link>
                  );
                })}
                {conversations.length === 0 ? (
                  <div className="grid min-h-72 place-items-center px-6 text-center">
                    <div>
                      <MessageCircle className="mx-auto mb-3 size-7 text-zinc-700" />
                      <p className="text-sm text-zinc-300">
                        No hay conversaciones
                      </p>
                      <p className="mt-1 text-xs text-zinc-600">
                        Prueba otro filtro o sincroniza Fanvue.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
            <section className={`${conversationIsOpen ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-col`}>
              {selected ? (
                <>
                  <header className="flex shrink-0 items-center gap-3 border-b border-white/8 px-4 py-3 md:px-5">
                    <Link href={inboxHref} aria-label="Volver a conversaciones" className="grid size-9 shrink-0 place-items-center rounded-lg border border-white/8 text-zinc-400 hover:bg-white/5 hover:text-white md:hidden"><ArrowLeft className="size-4" /></Link>
                    <div className="min-w-0"><p className="truncate font-medium text-zinc-200">
                      {selected.fan.displayName ||
                        selected.fan.username ||
                        "Fan"}
                    </p>
                    <p className="truncate text-xs text-zinc-600">
                      @{selected.fan.username || "sin-usuario"}
                    </p></div>
                  </header>
                  <MessageHistory conversationKey={selected.id}>
                    {historyError ? (
                      <p className="m-auto text-center text-sm text-red-300">
                        No se pudo cargar el historial desde Fanvue.
                      </p>
                    ) : messages.length === 0 ? (
                      <p className="m-auto text-center text-sm text-zinc-600">
                        Esta conversación todavía no tiene mensajes visibles.
                      </p>
                    ) : (
                      messages.map((message, messageIndex) => {
                        const inbound =
                          message.sender.uuid === selected.fan.fanvueUserId;
                        const media = mediaByMessage.get(message.uuid) ?? [];
                        const ppvPrice =
                          message.pricing?.USD.price ??
                          media.find((item) => item.priceMinor !== null)
                            ?.priceMinor ??
                          null;
                        const purchased =
                          message.purchasedAt ??
                          media.find((item) => item.purchasedAt)?.purchasedAt ??
                          null;
                        const previewUuid =
                          message.mediaPreviewUuid ??
                          message.previewMediaUuid ??
                          message.media_preview_uuid;
                        const unattachedMedia = media.filter(
                          (item) => !message.mediaUuids.includes(item.uuid),
                        );
                        const inferredPreviewUuid =
                          !previewUuid &&
                          unattachedMedia.length === 1 &&
                          media.length === message.mediaUuids.length + 1
                            ? unattachedMedia[0].uuid
                            : !previewUuid && ppvPrice !== null && media.length > 1
                              ? media.at(-1)?.uuid ?? null
                              : null;
                        const effectivePreviewUuid =
                          previewUuid ?? inferredPreviewUuid;
                        return (
                          <div
                            key={`${message.uuid}-${messageIndex}`}
                            className={`max-w-[85%] sm:max-w-[72%] ${inbound ? "self-start" : "self-end"}`}
                          >
                            <div
                              className={`overflow-hidden rounded-2xl text-sm leading-5 ${inbound ? "rounded-bl-md bg-white/8 text-zinc-200" : "rounded-br-md bg-violet-600 text-white"}`}
                            >
                              {message.gif?.url ? (
                                <ExpandableImage
                                  src={message.gif.url}
                                  alt={message.gif.title || "GIF"}
                                  className="max-h-80 w-full object-contain"
                                />
                              ) : null}
                              {media.length > 0 ? <ChatMediaCarousel media={media} ppvPrice={ppvPrice} previewUuid={effectivePreviewUuid} /> : null}
                              {ppvPrice !== null ? (
                                <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-black/25 px-4 py-2.5">
                                  <span className="text-xs font-semibold">
                                    🔒 PPV · ${(ppvPrice / 100).toFixed(2)} USD
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${purchased ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"}`}
                                  >
                                    {purchased ? "Pagado" : "Aún no pagado"}
                                  </span>
                                </div>
                              ) : null}
                              {message.text ? (
                                <p className="px-4 py-3">{message.text}</p>
                              ) : !message.gif?.url && media.length === 0 ? (
                                <p className="px-4 py-3">
                                  [{message.mediaType || message.type}]
                                </p>
                              ) : null}
                            </div>
                            <p
                              className={`mt-1 px-1 text-[10px] text-zinc-700 ${inbound ? "text-left" : "text-right"}`}
                            >
                              {message.sentAt
                                ? new Date(message.sentAt).toLocaleString(
                                    "es-MX",
                                  )
                                : "Sin fecha"}
                              {!inbound
                                ? message.isRead
                                  ? " · Leído"
                                  : " · Enviado"
                                : ""}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </MessageHistory>
                  <MessageComposer
                    fanUuid={selected.fan.fanvueUserId}
                    fanName={
                      selected.fan.displayName || selected.fan.username || "Fan"
                    }
                    username={selected.fan.username || ""}
                    templates={templates.map((template) => ({
                      ...template,
                      ...readTemplateMetadata(template.metadata),
                    }))}
                  />
                </>
              ) : (
                <div className="grid flex-1 place-items-center text-center">
                  <div className="max-w-sm px-6">
                    <span className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl border border-violet-400/15 bg-violet-400/[.06] text-violet-300 shadow-xl shadow-black/20"><MessageCircle className="size-6" /></span>
                    <p className="text-lg font-semibold text-zinc-200">
                      Bienvenido a chats
                    </p>
                    <p className="mt-2 text-sm leading-6 text-zinc-500">
                      Selecciona un contacto de la lista ¡y diviértete!
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function readTemplateMetadata(value: unknown) {
  const metadata =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const media = Array.isArray(metadata.media)
    ? metadata.media.flatMap((value) => {
        const item =
          typeof value === "object" && value !== null && !Array.isArray(value)
            ? (value as Record<string, unknown>)
            : {};
        return typeof item.uuid === "string" &&
          typeof item.name === "string" &&
          typeof item.mediaType === "string"
          ? [{ uuid: item.uuid, name: item.name, mediaType: item.mediaType }]
          : [];
      })
    : [];
  return {
    media,
    priceMinor:
      typeof metadata.priceMinor === "number" ? metadata.priceMinor : null,
    previewUuid:
      typeof metadata.previewUuid === "string" ? metadata.previewUuid : null,
  };
}
