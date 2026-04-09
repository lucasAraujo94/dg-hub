import { useEffect } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Mail } from "lucide-react";
import { Link } from "wouter";

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
        <p>Não foi possível carregar o perfil.</p>
        <Button asChild variant="ghost">
          <Link href="/perfil">Voltar</Link>
        </Button>
      </div>
    );
  }

  const data = profileQuery.data;
  const displayName = data.nickname?.trim() || data.name || "Jogador";

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
            <p className="text-lg font-semibold break-words">{displayName}</p>
            {data.email ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {data.email}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Email ocultado</p>
            )}
            {data.birthDate ? (
              <p className="text-sm text-muted-foreground">
                Aniversário: {new Date(data.birthDate).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
            {data.createdAt ? (
              <p className="text-xs text-muted-foreground">
                Membro desde {new Date(data.createdAt).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
            {data.lastSignedIn ? (
              <p className="text-xs text-muted-foreground">
                Último acesso {new Date(data.lastSignedIn).toLocaleString("pt-BR")}
              </p>
            ) : null}
          </div>
        </Card>
      </main>
    </div>
  );
}
