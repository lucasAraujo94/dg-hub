import { Crown, Medal, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Link } from "wouter";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

type RankingPodiumItem = {
  usuarioId: number;
  pontuacao: number;
  wins?: number;
  usuario?: {
    name?: string | null;
    email?: string | null;
    nickname?: string | null;
    role?: string | null;
    avatarUrl?: string | null;
    avatar?: string | null;
    genero?: string | null;
    gender?: string | null;
    sexo?: string | null;
  } | null;
  campeonatosCampeao?: Array<{ id: number; nome: string; jogo: string }>;
};

type RankingPodiumProps = {
  data: RankingPodiumItem[];
  displayPref: "real" | "hago";
  hagoNickLocal?: string;
};

type PodiumTone = {
  cardClass: string;
  badgeClass: string;
  glowClass: string;
  accentClass: string;
  icon: typeof Crown;
  iconClass: string;
  blockClass: string;
};

const PODIUM_LAYOUT = [
  { place: 2, desktopOrder: "md:order-1", heightClass: "md:mt-16", scaleClass: "md:scale-[0.97]" },
  { place: 1, desktopOrder: "md:order-2", heightClass: "md:-mt-6", scaleClass: "md:scale-100" },
  { place: 3, desktopOrder: "md:order-3", heightClass: "md:mt-20", scaleClass: "md:scale-[0.95]" },
] as const;

const podiumTones: Record<1 | 2 | 3, PodiumTone> = {
  1: {
    cardClass:
      "border-amber-300/50 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.28),_rgba(255,255,255,0.03)_45%,_rgba(0,0,0,0.35)_100%)]",
    badgeClass: "border-amber-300/40 bg-amber-300/15 text-amber-200",
    glowClass: "shadow-[0_0_45px_rgba(251,191,36,0.18)]",
    accentClass: "from-amber-300 via-yellow-200 to-amber-500",
    icon: Crown,
    iconClass: "text-amber-200",
    blockClass: "from-amber-500/90 to-yellow-300/80",
  },
  2: {
    cardClass:
      "border-slate-300/35 bg-[radial-gradient(circle_at_top,_rgba(226,232,240,0.18),_rgba(255,255,255,0.03)_45%,_rgba(0,0,0,0.35)_100%)]",
    badgeClass: "border-slate-300/30 bg-slate-300/10 text-slate-100",
    glowClass: "shadow-[0_0_40px_rgba(226,232,240,0.12)]",
    accentClass: "from-slate-200 via-slate-100 to-slate-400",
    icon: Medal,
    iconClass: "text-slate-100",
    blockClass: "from-slate-400/85 to-slate-200/80",
  },
  3: {
    cardClass:
      "border-orange-400/35 bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.18),_rgba(255,255,255,0.03)_45%,_rgba(0,0,0,0.35)_100%)]",
    badgeClass: "border-orange-300/30 bg-orange-400/10 text-orange-100",
    glowClass: "shadow-[0_0_40px_rgba(251,146,60,0.12)]",
    accentClass: "from-orange-300 via-amber-200 to-orange-500",
    icon: Trophy,
    iconClass: "text-orange-200",
    blockClass: "from-orange-500/85 to-amber-300/75",
  },
};

function normalizeGender(value: string | null | undefined): "male" | "female" | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (["f", "feminino", "female", "mulher"].includes(normalized)) return "female";
  if (["m", "masculino", "male", "homem"].includes(normalized)) return "male";
  return null;
}

function resolveDisplayName(
  player: RankingPodiumItem,
  displayPref: "real" | "hago",
  hagoNickLocal?: string
) {
  const usuario = player.usuario;
  const baseName = usuario?.name || usuario?.email || `Jogador ${player.usuarioId}`;
  const nick = (usuario?.nickname || hagoNickLocal || "").trim();
  return displayPref === "hago" && nick ? nick : baseName;
}

function getLastTitle(player: RankingPodiumItem) {
  const campeonatos = player.campeonatosCampeao ?? [];
  if (campeonatos.length === 0) return null;
  return campeonatos.reduce<{ id: number; nome: string; jogo: string } | null>((acc, curr) => {
    if (!acc) return curr;
    return curr.id > acc.id ? curr : acc;
  }, null);
}

function DefaultAvatar({ variant, name }: { variant: "male" | "female"; name: string }) {
  const isFemale = variant === "female";
  return (
    <svg viewBox="0 0 80 80" aria-label={`Avatar padrao ${variant === "female" ? "feminino" : "masculino"} de ${name}`} className="h-full w-full">
      <rect x="2" y="2" width="76" height="76" rx="38" fill={isFemale ? "#f472b6" : "#22d3ee"} opacity="0.2" />
      <circle cx="56" cy="18" r="13" fill={isFemale ? "#fb7185" : "#a855f7"} opacity="0.22" />
      <circle cx="40" cy="27" r="14" fill="#f5d0a5" />
      {isFemale ? (
        <>
          <path d="M26 24c2-11 26-12 28 0v5H26z" fill="#f472b6" />
          <path d="M23 56c2-10 11-16 17-16s15 6 17 16v6H23z" fill="#fb7185" opacity="0.9" />
        </>
      ) : (
        <>
          <path d="M25 23c2-9 28-9 30 0v6H25z" fill="#22d3ee" />
          <path d="M21 56c3-10 12-16 19-16s16 6 19 16v6H21z" fill="#38bdf8" opacity="0.9" />
        </>
      )}
      <circle cx="35" cy="27" r="1.4" fill="#111827" />
      <circle cx="45" cy="27" r="1.4" fill="#111827" />
      <path d="M35 34c3 2 7 2 10 0" stroke="#111827" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function PodiumCard({
  player,
  place,
  displayPref,
  hagoNickLocal,
  desktopOrder,
  heightClass,
  scaleClass,
}: {
  player: RankingPodiumItem;
  place: 1 | 2 | 3;
  displayPref: "real" | "hago";
  hagoNickLocal?: string;
  desktopOrder: string;
  heightClass: string;
  scaleClass: string;
}) {
  const usuario = player.usuario;
  const wins = player.wins ?? player.campeonatosCampeao?.length ?? 0;
  const displayName = resolveDisplayName(player, displayPref, hagoNickLocal);
  const avatarUrl = usuario?.avatarUrl || usuario?.avatar || "";
  const lastTitle = getLastTitle(player);
  const isAdmin = usuario?.role === "admin";
  const tone = podiumTones[place];
  const Icon = tone.icon;
  const profileHref = `/perfil/${player.usuarioId}`;
  const gender = normalizeGender(usuario?.gender || usuario?.genero || usuario?.sexo) ?? "male";

  return (
    <HoverCard openDelay={120} closeDelay={120}>
      <HoverCardTrigger asChild>
        <Link href={profileHref} className={`group relative block ${desktopOrder} ${heightClass}`}>
          <article
            className={`relative overflow-hidden rounded-[28px] border p-4 sm:p-5 transition-all duration-300 ease-out animate-in fade-in zoom-in-95 ${tone.cardClass} ${tone.glowClass} ${scaleClass} hover:-translate-y-2 hover:scale-[1.02] hover:shadow-[0_0_55px_rgba(255,255,255,0.08)]`}
          >
            <div className={`absolute inset-x-5 top-0 h-px bg-gradient-to-r ${tone.accentClass} opacity-80`} />
            <div className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
              <div className={`absolute inset-x-6 top-4 h-20 rounded-full blur-3xl bg-gradient-to-r ${tone.accentClass} opacity-20`} />
            </div>

            <div className="relative flex flex-col items-center text-center">
              <div className={`mb-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${tone.badgeClass}`}>
                <Icon className={`h-3.5 w-3.5 ${tone.iconClass}`} />
                {place}º lugar
              </div>

              <div className="relative mb-4">
                <div className={`absolute inset-0 rounded-full blur-xl bg-gradient-to-br ${tone.accentClass} opacity-35`} />
                <div className="relative h-20 w-20 sm:h-24 sm:w-24 overflow-hidden rounded-full border border-white/20 bg-black/30">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                  ) : (
                    <DefaultAvatar variant={gender} name={displayName} />
                  )}
                </div>
                {place === 1 ? (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/30 bg-amber-300/12 p-2 shadow-[0_0_24px_rgba(251,191,36,0.25)]">
                    <Crown className="h-5 w-5 text-amber-200" />
                  </div>
                ) : null}
              </div>

              <div className="space-y-1">
                <p className="text-lg font-semibold leading-tight text-foreground">
                  {displayName}
                </p>
                {isAdmin ? (
                  <div className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200">
                    <ShieldCheck className="h-3 w-3" />
                    Admin
                  </div>
                ) : null}
              </div>

              <div className="mt-4 grid w-full grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Pontos</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{player.pontuacao}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">Vitorias</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{wins}</p>
                </div>
              </div>

              <div className={`mt-5 h-3 w-full rounded-full bg-gradient-to-r ${tone.blockClass} opacity-90`} />
              <div className={`mt-2 w-full rounded-t-3xl border border-white/10 bg-white/5 bg-gradient-to-b ${tone.blockClass} px-3 py-4 text-sm font-semibold text-white/95`}>
                Destaque do pódio
              </div>
            </div>
          </article>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="border-white/10 bg-card/95 backdrop-blur-xl">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className={`h-4 w-4 ${tone.iconClass}`} />
            Resumo do jogador
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-muted-foreground">Posicao</p>
              <p className="font-semibold">{place}º lugar</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-muted-foreground">Pontos</p>
              <p className="font-semibold">{player.pontuacao}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-muted-foreground">Vitorias</p>
              <p className="font-semibold">{wins}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-muted-foreground">Perfil</p>
              <p className="font-semibold">Clique para abrir</p>
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs">
            <p className="text-muted-foreground">Ultimo titulo</p>
            <p className="mt-1 font-medium">
              {lastTitle ? `${lastTitle.nome} - ${lastTitle.jogo}` : "Nenhum titulo ainda"}
            </p>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function RankingPodium({ data, displayPref, hagoNickLocal }: RankingPodiumProps) {
  const topThree = data.slice(0, 3);

  if (topThree.length === 0) return null;

  return (
    <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-card/70 px-4 py-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-6 sm:py-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(168,85,247,0.14),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.12),_transparent_32%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/60 to-transparent" />

      <div className="relative mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Top 3 do ranking</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground sm:text-3xl">Pódio geral em destaque</h2>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          O pódio acompanha automaticamente a mesma ordenação da tabela principal e abre o perfil público ao clicar.
        </p>
      </div>

      <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
        {PODIUM_LAYOUT.map(layout => {
          const player = topThree[layout.place - 1];
          if (!player) {
            return (
              <div
                key={layout.place}
                className={`rounded-[28px] border border-dashed border-white/10 bg-black/10 p-6 text-center text-sm text-muted-foreground ${layout.desktopOrder} ${layout.heightClass}`}
              >
                Posição {layout.place}º aguardando jogador
              </div>
            );
          }

          return (
            <PodiumCard
              key={`${player.usuarioId}-${layout.place}`}
              player={player}
              place={layout.place}
              displayPref={displayPref}
              hagoNickLocal={hagoNickLocal}
              desktopOrder={layout.desktopOrder}
              heightClass={layout.heightClass}
              scaleClass={layout.scaleClass}
            />
          );
        })}
      </div>
    </section>
  );
}
