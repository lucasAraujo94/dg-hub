export const getFriendlyLoginError = (message?: string) => {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("credenciais invalidas")) {
    return "E-mail ou senha incorretos.";
  }
  if (normalized.includes("oauth") || normalized.includes("google")) {
    return "Nao foi possivel entrar com Google agora. Tente novamente em instantes.";
  }
  if (normalized.includes("sessao")) {
    return "Nao foi possivel concluir sua sessao agora. Tente novamente.";
  }

  return "Nao foi possivel entrar agora. Tente novamente em instantes.";
};

export const getFriendlyWithdrawalError = (message?: string) => {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("saldo insuficiente")) {
    return "Seu saldo disponivel nao cobre este saque.";
  }
  if (normalized.includes("nao autenticado")) {
    return "Entre na sua conta para solicitar o saque.";
  }
  if (normalized.includes("usuario nao encontrado")) {
    return "Nao foi possivel localizar sua conta agora. Tente novamente.";
  }

  return "Nao foi possivel enviar sua solicitacao de saque agora.";
};

export const getFriendlyPixError = (message?: string) => {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("mp_access_token")) {
    return "O PIX ainda nao esta configurado no servidor.";
  }
  if (normalized.includes("x-idempotency-key")) {
    return "Nao foi possivel iniciar o PIX agora. Tente novamente.";
  }
  if (normalized.includes("collector user without key")) {
    return "A conta recebedora ainda nao esta habilitada para gerar PIX.";
  }
  if (normalized.includes("mercado pago error")) {
    return "O provedor de pagamento recusou a geracao do PIX. Revise a configuracao da conta e tente novamente.";
  }

  return "Nao foi possivel gerar o PIX agora. Tente novamente em instantes.";
};

export const getFriendlyAdminWithdrawalError = (message?: string) => {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("ja foi paga") || normalized.includes("ja foi pago")) {
    return "Esse saque ja foi concluido anteriormente.";
  }
  if (normalized.includes("rejeitad")) {
    return "Esse saque ja foi rejeitado e nao pode seguir nesta etapa.";
  }
  if (normalized.includes("saldo insuficiente")) {
    return "O usuario nao tem saldo suficiente para concluir esse pagamento agora.";
  }

  return "Nao foi possivel atualizar o saque agora. Tente novamente.";
};
