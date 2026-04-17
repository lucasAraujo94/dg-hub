import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";

type AdminSupportPanelsProps = {
  activeTab: "premiacoes" | "saques" | "usuarios";
  depositoRef: React.Ref<HTMLDivElement>;
  usuariosSelect: any[];
  depositoUsuarioId: string;
  setDepositoUsuarioId: (value: string) => void;
  depositoValor: string;
  setDepositoValor: (value: string) => void;
  depositoDescricao: string;
  setDepositoDescricao: (value: string) => void;
  handleGerarPix: () => void;
  criarPixPending: boolean;
  pixStatusData: any;
  pixStatusLabel: string;
  depositosBusca: string;
  setDepositosBusca: (value: string) => void;
  depositosStatus: string;
  setDepositosStatus: (value: string) => void;
  pixPaymentsLoading: boolean;
  pixPaymentsError?: string | null;
  filteredPixPayments: any[];
  getPixStatusLabel: (status?: string) => string;
  saquesBusca: string;
  setSaquesBusca: (value: string) => void;
  saquesStatus: string;
  setSaquesStatus: (value: string) => void;
  saquesLoading: boolean;
  saquesError?: string | null;
  filteredSaques: any[];
  getWithdrawalStatusLabel: (status?: string) => string;
  rejeitarSaquePending: boolean;
  marcarSaquePagoPending: boolean;
  onRejectWithdrawal: (solicitacaoId: number) => void;
  onMarkWithdrawalPaid: (solicitacaoId: number) => void;
  usuariosLoading: boolean;
  usuariosError?: string | null;
  usuariosData: any[];
  setRolePending: boolean;
  onToggleRole: (openId?: string, email?: string | null, currentRole?: string) => void;
};

export default function AdminSupportPanels(props: AdminSupportPanelsProps) {
  const {
    activeTab,
    depositoRef,
    usuariosSelect,
    depositoUsuarioId,
    setDepositoUsuarioId,
    depositoValor,
    setDepositoValor,
    depositoDescricao,
    setDepositoDescricao,
    handleGerarPix,
    criarPixPending,
    pixStatusData,
    pixStatusLabel,
    depositosBusca,
    setDepositosBusca,
    depositosStatus,
    setDepositosStatus,
    pixPaymentsLoading,
    pixPaymentsError,
    filteredPixPayments,
    getPixStatusLabel,
    saquesBusca,
    setSaquesBusca,
    saquesStatus,
    setSaquesStatus,
    saquesLoading,
    saquesError,
    filteredSaques,
    getWithdrawalStatusLabel,
    rejeitarSaquePending,
    marcarSaquePagoPending,
    onRejectWithdrawal,
    onMarkWithdrawalPaid,
    usuariosLoading,
    usuariosError,
    usuariosData,
    setRolePending,
    onToggleRole,
  } = props;

  if (activeTab === "premiacoes") {
    return (
      <div className="space-y-6">
        <div className="card-elegant p-4 md:p-6" ref={depositoRef}>
          <h2 className="text-xl font-bold mb-2">Premiar jogador via PIX</h2>
          <p className="text-sm text-muted-foreground mb-4">Gere um PIX real pelo Asaas, acompanhe o status e aguarde a confirmacao automatica.</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-semibold mb-2 block">Jogador</label>
              <select
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                value={depositoUsuarioId}
                onChange={e => setDepositoUsuarioId(e.target.value)}
              >
                <option value="">Selecione um jogador</option>
                {usuariosSelect.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email || u.openId}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Valor (R$)</label>
              <Input value={depositoValor} onChange={e => setDepositoValor(e.target.value)} placeholder="Ex: 25.00" />
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Descricao</label>
              <Input value={depositoDescricao} onChange={e => setDepositoDescricao(e.target.value)} placeholder="Premiacao, bonus, campanha..." />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button className="btn-secondary" onClick={handleGerarPix} disabled={criarPixPending}>
              {criarPixPending ? "Gerando..." : "Gerar PIX de premiacao"}
            </Button>
          </div>

          {pixStatusData ? (
            <div className="mt-6 rounded-xl border border-border/60 bg-card/50 p-4 space-y-4">
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold">Status: {pixStatusLabel}</p>
                <p className="text-xs text-muted-foreground">
                  ID interno {pixStatusData.id} - pagamento {pixStatusData.providerPaymentId ?? "aguardando criacao"}
                </p>
                <p className="text-xs text-muted-foreground">Valor: R$ {pixStatusData.valor.toFixed(2)}</p>
              </div>

              {pixStatusData.qrCodeBase64 ? (
                <div className="flex flex-col items-start gap-3">
                  <img
                    src={`data:image/png;base64,${pixStatusData.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-56 max-w-full rounded-lg border border-border bg-white p-3"
                  />
                  <p className="text-xs text-muted-foreground break-all">{pixStatusData.qrCode}</p>
                  {pixStatusData.ticketUrl ? (
                    <a href={pixStatusData.ticketUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
                      Abrir comprovante do PIX
                    </a>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">QR Code ainda nao disponivel.</p>
              )}

              {pixStatusData.creditedAt ? (
                <p className="text-sm text-green-400">
                  Saldo creditado em {new Date(pixStatusData.creditedAt).toLocaleString("pt-BR")}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">O saldo sera creditado automaticamente apos o pagamento aprovado.</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="card-elegant p-4 md:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">Historico de premiacoes PIX</h2>
              <p className="text-sm text-muted-foreground">Filtre por status e localize rapido o jogador ou a referencia da premiacao.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input value={depositosBusca} onChange={e => setDepositosBusca(e.target.value)} placeholder="Buscar por jogador, email, referencia..." />
              <select
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
                value={depositosStatus}
                onChange={e => setDepositosStatus(e.target.value)}
              >
                <option value="todos">Todos os status</option>
                <option value="pending">Aguardando pagamento</option>
                <option value="approved">Aprovado</option>
                <option value="in_process">Em processamento</option>
                <option value="rejected">Recusado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>

          {pixPaymentsLoading ? <p className="mt-4 text-sm text-muted-foreground">Carregando premiacoes...</p> : null}
          {pixPaymentsError ? <p className="mt-4 text-sm text-red-400">Erro: {pixPaymentsError}</p> : null}
          {!pixPaymentsLoading && filteredPixPayments.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhuma premiacao encontrada com os filtros atuais.</p>
          ) : null}

          <div className="mt-4 space-y-3">
            {filteredPixPayments.map(item => (
              <div key={item.id} className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-2">
                <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-semibold">{item.usuario?.name || item.usuario?.email || `Usuario #${item.usuarioId}`}</p>
                    <p className="text-xs text-muted-foreground">
                      Valor: R$ {Number(item.valor).toFixed(2)} - status: {getPixStatusLabel(item.status)}
                    </p>
                    <p className="text-xs text-muted-foreground break-all">Referencia: {item.externalReference}</p>
                    {item.descricao ? <p className="text-xs text-muted-foreground break-words">Descricao: {item.descricao}</p> : null}
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-xs text-muted-foreground">Criado em {new Date(item.createdAt).toLocaleString("pt-BR")}</p>
                    {item.creditedAt ? (
                      <p className="text-xs text-green-400">Creditado em {new Date(item.creditedAt).toLocaleString("pt-BR")}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "saques") {
    return (
      <div className="card-elegant p-4 md:p-6">
        <h2 className="text-xl font-bold mb-2">Solicitacoes de saque</h2>
        <p className="text-sm text-muted-foreground mb-4">Aprove, rejeite ou execute o saque. Ao confirmar o pagamento, a plataforma envia a transferencia Pix pelo Asaas.</p>
        <div className="grid grid-cols-1 gap-3 mb-4 md:grid-cols-2">
          <Input value={saquesBusca} onChange={e => setSaquesBusca(e.target.value)} placeholder="Buscar por jogador, email ou chave Pix..." />
          <select className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm" value={saquesStatus} onChange={e => setSaquesStatus(e.target.value)}>
            <option value="todos">Todos os status</option>
            <option value="solicitado">Solicitado</option>
            <option value="pago">Pago</option>
            <option value="rejeitado">Rejeitado</option>
          </select>
        </div>
        {saquesLoading ? <p className="text-sm text-muted-foreground">Carregando saques...</p> : null}
        {saquesError ? <p className="text-sm text-red-400">Erro: {saquesError}</p> : null}
        {!saquesLoading && filteredSaques.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma solicitacao de saque encontrada com os filtros atuais.</p>
        ) : null}
        <div className="space-y-3">
          {filteredSaques.map(item => {
            const status = item.status ?? "solicitado";
            const canReject = status === "solicitado";
            const canPay = status === "solicitado";
            return (
              <div key={item.id} className="rounded-lg border border-border/60 bg-card/60 p-4 space-y-3">
                <div className="flex flex-col gap-1">
                  <p className="font-semibold">{item.usuario?.name || item.usuario?.email || `Usuario #${item.usuarioId}`}</p>
                  <p className="text-xs text-muted-foreground">Valor: R$ {Number(item.valor).toFixed(2)} - status: {getWithdrawalStatusLabel(status)}</p>
                  <p className="text-xs text-muted-foreground break-all">Chave {item.walletProvider}: {item.walletAddress}</p>
                  <p className="text-xs text-muted-foreground">
                    Solicitado em {new Date(item.dataSolicitacao).toLocaleString("pt-BR")}
                    {item.dataPagamento ? ` - pago em ${new Date(item.dataPagamento).toLocaleString("pt-BR")}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" disabled={!canReject || rejeitarSaquePending} onClick={() => onRejectWithdrawal(item.id)}>
                    Rejeitar
                  </Button>
                  <Button size="sm" className="btn-primary" disabled={!canPay || marcarSaquePagoPending} onClick={() => onMarkWithdrawalPaid(item.id)}>
                    Pagar via Pix
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="card-elegant p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-5 h-5 text-green-400" />
        <h2 className="text-2xl font-bold">Usuarios</h2>
      </div>
      {usuariosLoading ? <p className="text-sm text-muted-foreground">Carregando usuarios...</p> : null}
      {usuariosError ? <p className="text-sm text-red-400">Erro: {usuariosError}</p> : null}
      {!usuariosLoading && usuariosData.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum usuario cadastrado.</p> : null}
      <div className="space-y-3">
        {usuariosData.map(u => {
          const lastSeen = u.lastSignedIn ? new Date(u.lastSignedIn as any).getTime() : 0;
          const isOnline = lastSeen > 0 && Date.now() - lastSeen < 10 * 60 * 1000;
          return (
            <div key={u.id} className="flex items-center justify-between p-4 bg-card/50 rounded-lg border border-border/50">
              <div className="flex flex-col gap-1">
                <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={`w-2 h-2 rounded-full inline-block ${isOnline ? "bg-green-500" : "bg-zinc-500"}`} />
                  {isOnline ? "online" : "offline"}
                </span>
                <p className="font-semibold">{u.nickname ? `${u.name || u.email || u.openId} (${u.nickname})` : u.name || u.email || u.openId}</p>
                <p className="text-xs text-muted-foreground">
                  {(u as any)?.hideEmail ? "email oculto" : u.email || "sem email"} - role: <span className="font-semibold">{u.role}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Ultimo acesso: {u.lastSignedIn ? new Date(u.lastSignedIn as any).toLocaleString("pt-BR") : "n/d"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => onToggleRole(u.openId, u.email, u.role)} disabled={setRolePending}>
                  {u.role === "admin" ? "Tornar usuario" : "Tornar admin"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
