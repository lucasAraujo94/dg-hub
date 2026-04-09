import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Cake, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

type DisplayPref = "real" | "hago";

export default function Aniversariantes() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "#/login" });
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

  const formatDate = (value: string | Date) => {
    const d = new Date(value);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6 flex items-center justify-between">
          <Button asChild variant="ghost" className="gap-2">
            <Link href="/">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
          </Button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Comunidade</p>
            <h1 className="text-3xl font-bold">Aniversariantes</h1>
            <p className="text-sm text-muted-foreground">Use sua data de nascimento no perfil para aparecer aqui.</p>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="container py-8 space-y-6">
        {birthdaysQuery.isLoading ? (
          <p className="text-center text-muted-foreground">Carregando aniversarios...</p>
        ) : null}
        {!birthdaysQuery.isLoading && items.length === 0 ? (
          <Card className="p-6 text-center bg-card/60 border-dashed border-muted">
            <p className="text-muted-foreground text-sm">Nenhum aniversariante cadastrado ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">Preencha sua data de nascimento em Perfil para entrar na lista.</p>
          </Card>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map(item => {
            const displayName =
              displayPref === "hago" && (item.nickname ?? "").trim()
                ? (item.nickname ?? "").trim()
                : item.name || item.nickname || "Jogador";
            return (
              <Card
                key={item.id}
                className={`p-4 flex gap-3 items-center bg-card/70 border ${item.isToday ? "border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.25)]" : "border-border"}`}
              >
                {item.avatarUrl ? (
                  <img src={item.avatarUrl} alt={displayName} className="h-12 w-12 rounded-full object-cover border border-white/10" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-sm font-bold">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.isToday ? "Hoje" : `${item.daysUntil} dia${item.daysUntil === 1 ? "" : "s"}`}
                  </p>
                  <p className="text-xs text-muted-foreground">Data: {formatDate(item.birthDate as any)}</p>
                </div>
                <Cake className={`w-5 h-5 ${item.isToday ? "text-emerald-300" : "text-muted-foreground"}`} />
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
