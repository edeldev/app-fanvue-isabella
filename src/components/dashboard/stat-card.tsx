import type { LucideIcon } from "lucide-react";

const tones = {
  violet: {
    line: "from-violet-500 via-fuchsia-400 to-transparent",
    icon: "border-violet-400/20 bg-violet-500/12 text-violet-200 shadow-[0_0_24px_rgba(139,92,246,.12)]",
  },
  cyan: {
    line: "from-cyan-400 via-sky-400 to-transparent",
    icon: "border-cyan-400/20 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,.1)]",
  },
  emerald: {
    line: "from-emerald-400 via-teal-400 to-transparent",
    icon: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,.1)]",
  },
  pink: {
    line: "from-pink-400 via-fuchsia-400 to-transparent",
    icon: "border-pink-400/20 bg-pink-400/10 text-pink-200 shadow-[0_0_24px_rgba(244,114,182,.1)]",
  },
  amber: {
    line: "from-amber-300 via-orange-400 to-transparent",
    icon: "border-amber-300/20 bg-amber-300/10 text-amber-100 shadow-[0_0_24px_rgba(252,211,77,.1)]",
  },
} as const;

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "violet",
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: keyof typeof tones;
}) {
  const style = tones[tone];

  return (
    <article className="group relative isolate overflow-hidden rounded-[1.35rem] border border-white/[.075] bg-[#15171f]/90 p-5 shadow-[0_18px_55px_rgba(0,0,0,.18)] transition duration-300 hover:-translate-y-0.5 hover:border-white/15 hover:shadow-[0_22px_65px_rgba(0,0,0,.28)]">
      <span className={`absolute inset-x-0 top-0 h-px bg-linear-to-r ${style.line} opacity-70`} />
      <span className="pointer-events-none absolute -right-12 -top-14 size-32 rounded-full bg-violet-500/[.055] blur-3xl transition group-hover:bg-violet-500/[.09]" />
      <div className="relative mb-7 flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-zinc-500">{label}</p>
        <div className={`grid size-10 place-items-center rounded-xl border ${style.icon}`}>
          <Icon className="size-[18px]" />
        </div>
      </div>
      <p className="relative text-[1.8rem] font-semibold tracking-[-.035em] text-white">{value}</p>
      <p className="relative mt-2 text-xs leading-5 text-zinc-500">{detail}</p>
    </article>
  );
}
