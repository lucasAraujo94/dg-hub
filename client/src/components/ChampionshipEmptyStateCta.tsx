import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";

type ChampionshipEmptyStateCtaProps = {
  onNotify: () => void;
};

export function ChampionshipEmptyStateCta({ onNotify }: ChampionshipEmptyStateCtaProps) {
  return (
    <section className="border-t border-border py-12">
      <div className="container">
        <div className="card-elegant neon-border text-center">
          <Trophy className="mx-auto mb-4 h-12 w-12 text-purple-400" />
          <h3 className="mb-4 text-2xl font-bold">Não encontrou o que procura?</h3>
          <p className="mb-6 text-muted-foreground">Novos campeonatos sao adicionados diariamente. Fique atento!</p>
          <Button className="btn-secondary" onClick={onNotify}>
            Notifique-me sobre novos campeonatos
          </Button>
        </div>
      </div>
    </section>
  );
}
