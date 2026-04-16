import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "wouter";

type OnlinePlayer = {
  id: number;
  name: string;
};

type Campeonato = {
  id: number;
  nome: string;
  descricao?: string | null;
  dataInicio?: string | Date | null;
  premioValor?: number | string | null;
  status?: string;
};

type HomeActivePanelsProps = {
  activeSection: "campeonatos" | "perfil" | "chat" | null;
  campeonatos: Campeonato[];
  onlinePlayers: OnlinePlayer[];
  userRole?: string | null;
  onRegister: (campeonatoId?: number) => void;
  onMarkChatAsRead: () => void;
};

export default function HomeActivePanels({
  activeSection,
  campeonatos,
  onlinePlayers,
  userRole,
  onRegister,
  onMarkChatAsRead,
}: HomeActivePanelsProps) {
  if (activeSection === "campeonatos") {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
          <Button asChild size="sm">
            <Link href="/campeonatos">Abrir página</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 p-3">
          <p className="flex items-center gap-2 text-sm text-emerald-100">
            <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            Jogadores online
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-emerald-100">
            {onlinePlayers.map(p => (
              <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1">
                <span className="h-2 w-2 rounded-full bg-green-400" />
                {p.name}
              </span>
            ))}
          </div>
        </div>
        {userRole === "admin" ? (
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-card/60 p-3">
            <div>
              <p className="text-sm font-semibold">Criar novo campeonato</p>
              <p className="text-xs text-muted-foreground">Admins podem cadastrar e gerenciar campeonatos.</p>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href="/admin">Criar campeonato</Link>
            </Button>
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {campeonatos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum campeonato cadastrado ainda.</p>
          ) : null}
          {campeonatos.map(camp => {
            const dataInicio = camp.dataInicio ? new Date(camp.dataInicio) : null;
            const status = (() => {
              const rawStatus = camp.status ?? "ativo";
              const started = dataInicio ? dataInicio.getTime() <= Date.now() : false;
              return rawStatus === "cancelado" || rawStatus === "finalizado" ? rawStatus : started ? "finalizado" : "ativo";
            })();
            const inscricoesEncerradas = (() => {
              if (status === "cancelado" || status === "finalizado") return true;
              if (!dataInicio) return false;
              const diff = dataInicio.getTime() - Date.now();
              if (diff <= 0) return true;
              return diff < 24 * 60 * 60 * 1000;
            })();
            const faseLabel =
              status === "cancelado"
                ? "Cancelado"
                : status === "finalizado"
                  ? "Finalizado"
                  : inscricoesEncerradas
                    ? "Inscricoes encerradas"
                    : "Fase de inscricoes";
            return (
              <Card key={camp.id} className="space-y-2 border-border/70 bg-card/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h3 className="break-words font-semibold">{camp.nome}</h3>
                    <p className="text-xs text-muted-foreground break-words">{faseLabel}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {dataInicio ? dataInicio.toLocaleDateString("pt-BR") : "Data a definir"}
                  </span>
                </div>
                <p className="line-clamp-2 break-words text-sm text-muted-foreground">
                  {camp.descricao ?? "Campeonato ativo"}
                </p>
                <div className="mt-1 flex items-center justify-between text-sm">
                  <span>Prêmio</span>
                  <span className="font-medium text-yellow-400">R$ {camp.premioValor as any}</span>
                </div>
                <Button
                  className="mt-2"
                  size="sm"
                  variant="outline"
                  onClick={() => onRegister(camp.id)}
                  disabled={inscricoesEncerradas}
                >
                  {inscricoesEncerradas ? "Inscricoes encerradas" : "Inscreva-se"}
                </Button>
              </Card>
            );
          })}
        </div>
      </section>
    );
  }

  if (activeSection === "perfil") {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
          <Button asChild size="sm">
            <Link href="/perfil">Abrir perfil</Link>
          </Button>
        </div>
        <Card className="border-border/70 bg-card/60 p-5">
          <p className="text-sm text-muted-foreground">Veja e edite seus dados, conquistas e histórico de campeonatos.</p>
        </Card>
      </section>
    );
  }

  if (activeSection === "chat") {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Ranking de campeoes</h2>
          <Button asChild size="sm">
            <Link href="/chat" onClick={onMarkChatAsRead}>
              Ir para o chat
            </Link>
          </Button>
        </div>
        <Card className="border-border/70 bg-card/60 p-5">
          <p className="text-sm text-muted-foreground">
            Converse com a comunidade e acompanhe transmissões em tempo real.
          </p>
        </Card>
      </section>
    );
  }

  return null;
}
