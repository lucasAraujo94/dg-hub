import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Award, Trophy, Medal, ShieldCheck } from "lucide-react";

export default function PerfilPublico() {
  const [match, params] = useRoute("/perfil/:id");
  const userId = match ? Number(params?.id) : NaN;
  const profileQuery = trpc.profile.publicById.useQuery(
    { userId },
    { enabled: Number.isFinite(userId) }
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!match || Number.isNaN(userId)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Perfil invalido.
      </div>
    );
  }

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando perfil...
      </div>
    );
  }

  if (profileQuery.error || !profileQuery.data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <p>Nao foi possivel carregar o perfil.</p>
        <Button asChild variant="ghost">
          <Link href="/ranking">Voltar</Link>
        </Button>
      </div>
    );
  }

  const data = profileQuery.data;
  const displayName = data.nickname?.trim() || data.name || "Jogador";
  const ranking = data.ranking;
  const campeonatos = ranking?.campeonatos ?? [];
  const isAdmin = data.role === "admin";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container py-6 flex items-center justify-between">
          <Button asChild variant="ghost" className="gap-2">
            <Link href="/ranking">
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
          </Button>
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Perfil publico</p>
            <h1 className="text-3xl font-bold">{displayName}</h1>
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="container py-8 space-y-4">
        <Card className="p-6 flex flex-col sm:flex-row gap-4 items-center sm:items-start">
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt={displayName}
              className="h-24 w-24 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div className="h-24 w-24 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xl font-bold">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 space-y-2 min-w-0 text-center sm:text-left">
            <p className="text-lg font-semibold break-words flex items-center justify-center sm:justify-start gap-2">
              {displayName}
              {isAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] uppercase tracking-wide bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" />
                  Admin
                </span>
              ) : null}
            </p>
            {data.createdAt ? (
              <p className="text-xs text-muted-foreground">
                Membro desde {new Date(data.createdAt).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
            {data.lastSignedIn ? (
              <p className="text-xs text-muted-foreground">
                Ultimo acesso {new Date(data.lastSignedIn).toLocaleString("pt-BR")}
              </p>
            ) : null}
          </div>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">Posicao</p>
              <p className="text-2xl font-bold">#{ranking?.posicao ?? "-"}</p>
            </div>
            <Award className="w-8 h-8 text-amber-300" />
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">Pontos</p>
              <p className="text-2xl font-bold">{ranking?.pontos ?? 0}</p>
            </div>
            <Trophy className="w-8 h-8 text-emerald-300" />
          </Card>
          <Card className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground mb-1">Titulos</p>
              <p className="text-2xl font-bold">{ranking?.wins ?? 0}</p>
            </div>
            <Medal className="w-8 h-8 text-cyan-300" />
          </Card>
        </div>

        <Card className="p-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Campeonatos conquistados</p>
            <span className="text-xs text-muted-foreground">{campeonatos.length} titulos</span>
          </div>
          {campeonatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum titulo conquistado ainda.</p>
          ) : (
            <ul className="space-y-2">
              {campeonatos.map(camp => (
                <li
                  key={camp.id}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{camp.nome}</p>
                    <p className="text-xs text-muted-foreground">{camp.jogo}</p>
                  </div>
                  <span className="text-[11px] text-emerald-300">Campeao</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>
    </div>
  );
}
