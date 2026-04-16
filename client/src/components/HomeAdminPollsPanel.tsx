import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type PollResult = {
  pollId: number;
  question: string | null;
  closesAt: string | Date | null;
};

type HomeAdminPollsPanelProps = {
  pollResults: PollResult[];
  pollPergunta: string;
  pollClosesAt: string;
  pollOptionsText: string;
  setPollPergunta: (value: string) => void;
  setPollClosesAt: (value: string) => void;
  setPollOptionsText: (value: string) => void;
  clampDateYear: (value: string) => string;
  isCreating: boolean;
  isDeleting: boolean;
  onCreate: (input: { pergunta: string | null; closesAt: Date | null; options: string[] }) => void;
  onDelete: (pollId: number) => void;
};

export default function HomeAdminPollsPanel({
  pollResults,
  pollPergunta,
  pollClosesAt,
  pollOptionsText,
  setPollPergunta,
  setPollClosesAt,
  setPollOptionsText,
  clampDateYear,
  isCreating,
  isDeleting,
  onCreate,
  onDelete,
}: HomeAdminPollsPanelProps) {
  return (
    <>
      <div className="card-elegant space-y-4 border border-emerald-400/30 bg-black/40 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/80">Admin</p>
            <h2 className="text-2xl font-bold text-white">Criar enquete</h2>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Pergunta</p>
            <input
              className="w-full rounded-md border border-emerald-400/40 bg-black/30 px-3 py-2 text-sm text-white"
              value={pollPergunta}
              onChange={e => setPollPergunta(e.target.value)}
            />
          </div>
          <div>
            <p className="mb-1 text-sm text-muted-foreground">Fecha em (opcional)</p>
            <input
              type="datetime-local"
              max="9999-12-31T23:59"
              className="w-full rounded-md border border-emerald-400/40 bg-black/30 px-3 py-2 text-sm text-white"
              value={pollClosesAt}
              onChange={e => setPollClosesAt(clampDateYear(e.target.value))}
            />
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Opções (1 por linha, mínimo 2 e máximo 6)</p>
          <textarea
            className="min-h-[120px] w-full rounded-md border border-emerald-400/40 bg-black/30 px-3 py-2 text-sm text-white"
            value={pollOptionsText}
            onChange={e => setPollOptionsText(e.target.value)}
          />
        </div>
        <Button
          className="btn-primary w-full"
          disabled={isCreating}
          onClick={() => {
            const options = pollOptionsText
              .split("\n")
              .map(opt => opt.trim())
              .filter(Boolean);
            if (options.length < 2 || options.length > 6) {
              toast.error("Informe entre 2 e 6 opções");
              return;
            }
            const year = (pollClosesAt.split("T")[0] || "").split("-")[0];
            if (year && year.length > 4) {
              toast.error("O ano deve ter no máximo 4 dígitos");
              return;
            }
            onCreate({
              pergunta: pollPergunta.trim() || null,
              closesAt: pollClosesAt ? new Date(pollClosesAt) : null,
              options,
            });
          }}
        >
          {isCreating ? "Criando..." : "Criar Enquete"}
        </Button>
      </div>

      {pollResults.length ? (
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Enquetes abertas</h3>
          <div className="space-y-3">
            {pollResults.map(poll => (
              <Card key={poll.pollId} className="border border-emerald-500/30 bg-black/30 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{poll.question || "Enquete"}</p>
                    {poll.closesAt ? (
                      <p className="text-xs text-muted-foreground">
                        Fecha em: {new Date(poll.closesAt).toLocaleString("pt-BR")}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(poll.pollId)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Excluindo..." : "Excluir"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
