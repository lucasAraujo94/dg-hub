import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { SitePage, SiteSection } from "@/components/SitePage";
import { Cake } from "lucide-react";

type DisplayPref = "real" | "hago";

export default function Aniversariantes() {
  const { loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "#/login" });
  const [displayPref, setDisplayPref] = useState<DisplayPref>(() => {
    if (typeof window === "undefined") return "real";
    const stored = localStorage.getItem("dg-display-pref");
    return stored === "hago" ? "hago" : "real";
  });
  const birthdaysQuery = trpc.profile.birthdays.useQuery(undefined, { refetchOnWindowFocus: false });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pref = localStorage.getItem("dg-display-pref");
    if (pref === "hago" || pref === "real") setDisplayPref(pref);
  }, []);

  const items = useMemo(() => birthdaysQuery.data ?? [], [birthdaysQuery.data]);
  const confetti = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 2}s`,
        duration: `${4 + Math.random() * 3}s`,
        color: ["#34d399", "#22d3ee", "#a78bfa", "#f472b6", "#facc15"][i % 5],
      })),
    []
  );

  const parseBirth = (value: string | Date) => {
    const iso =
      typeof value === "string"
        ? value.split("T")[0] || value
        : value.toISOString().split("T")[0];
    const [y, m, d] = iso.split("-").map(Number);
    return { year: y, month: m, day: d, iso };
  };

  const formatDate = (value: string | Date) => {
    const { month, day } = parseBirth(value);
    const dd = String(day).padStart(2, "0");
    const mm = String(month).padStart(2, "0");
    return `${dd}/${mm}`;
  };

  const groupedByMonth = useMemo(() => {
    const map = new Map<number, typeof items>();
    items.forEach(item => {
      const { month } = parseBirth(item.birthDate as any);
      const list = map.get(month) ?? [];
      list.push(item);
      map.set(month, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [items]);

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <SitePage
      title="Aniversariantes"
      description="Veja quem faz aniversario na comunidade e use sua data no perfil para aparecer aqui."
      badge="Arena community"
      icon={Cake}
    >
      <div className="relative overflow-hidden rounded-[28px]">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          {confetti.map(item => (
            <span
              key={item.id}
              className="absolute h-2 w-2 rounded-full animate-[fall_6s_linear_infinite]"
              style={{
                left: item.left,
                backgroundColor: item.color,
                animationDelay: item.delay as string,
                animationDuration: item.duration as string,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 space-y-6">
          <SiteSection>
            {birthdaysQuery.isLoading ? (
              <p className="text-center text-muted-foreground">Carregando aniversarios...</p>
            ) : null}
            {!birthdaysQuery.isLoading && items.length === 0 ? (
              <Card className="border-dashed border-muted bg-card/60 p-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum aniversariante cadastrado ainda.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Preencha sua data de nascimento em Perfil para entrar na lista.
                </p>
              </Card>
            ) : null}
          </SiteSection>

          {groupedByMonth.map(([month, list]) => (
            <SiteSection key={month}>
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/15 text-sm text-emerald-200">
                    {String(list[0] ? parseBirth(list[0].birthDate as any).day : 1).padStart(2, "0")}
                  </div>
                  <h2 className="text-lg font-semibold">
                    {["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][month - 1]}
                  </h2>
                  <span className="text-xs text-muted-foreground">Celebre quem faz aniversario.</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {list.map(item => {
                    const displayName =
                      displayPref === "hago" && (item.nickname ?? "").trim()
                        ? (item.nickname ?? "").trim()
                        : item.name || item.nickname || "Jogador";
                    return (
                      <Card
                        key={item.id}
                        className={`flex items-center gap-3 border p-4 ${item.isToday ? "border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.25)]" : "border-border"} bg-card/70`}
                      >
                        {item.avatarUrl ? (
                          <img src={item.avatarUrl} alt={displayName} className="h-12 w-12 rounded-full border border-white/10 object-cover" />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-sm font-bold">
                            {displayName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{displayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.isToday ? "Hoje" : `${item.daysUntil} dia${item.daysUntil === 1 ? "" : "s"}`}
                          </p>
                          <p className="text-xs text-muted-foreground">Data: {formatDate(item.birthDate as any)}</p>
                        </div>
                        <Cake className={`h-5 w-5 ${item.isToday ? "text-emerald-300" : "text-muted-foreground"}`} />
                      </Card>
                    );
                  })}
                </div>
              </section>
            </SiteSection>
          ))}
        </div>
      </div>
    </SitePage>
  );
}
