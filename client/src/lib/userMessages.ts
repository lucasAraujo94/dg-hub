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

  if (normalized.includes("checkout.already.requested") || normalized.includes("ja solicitado")) {
    return "Esse saque ja foi enviado para processamento. Aguarde a atualizacao do status.";
  }
  if (normalized.includes("saldo insuficiente")) {
    return "Seu saldo disponivel nao cobre este saque.";
  }
  if (normalized.includes("chave pix invalida")) {
    return "Informe uma chave Pix valida para receber o saque automatico.";
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
  if (normalized.includes("asaas_api_key")) {
    return "O PIX via Asaas ainda nao esta configurado no servidor.";
  }
  if (normalized.includes("cpf/cnpj do usuario")) {
    return "O usuario precisa cadastrar CPF ou CNPJ no perfil para gerar PIX no Asaas.";
  }
  if (normalized.includes("asaas customer error")) {
    return "Nao foi possivel cadastrar o cliente no Asaas para gerar o PIX.";
  }
  if (normalized.includes("asaas payment error")) {
    return "O Asaas recusou a geracao do PIX. Revise a conta e os dados do usuario.";
  }
  if (normalized.includes("x-idempotency-key")) {
    return "Nao foi possivel iniciar o PIX agora. Tente novamente.";
  }

  return "Nao foi possivel gerar o PIX agora. Tente novamente em instantes.";
};

export const getFriendlyAdminWithdrawalError = (message?: string) => {
  const normalized = (message || "").toLowerCase();

  if (normalized.includes("checkout.already.requested") || normalized.includes("ja solicitado")) {
    return "Esse saque ja foi enviado ao Asaas anteriormente. Aguarde a atualizacao ou confira o status antes de tentar de novo.";
  }
  if (normalized.includes("ja foi paga") || normalized.includes("ja foi pago")) {
    return "Esse saque ja foi concluido anteriormente.";
  }
  if (normalized.includes("rejeitad")) {
    return "Esse saque ja foi rejeitado e nao pode seguir nesta etapa.";
  }
  if (normalized.includes("saldo insuficiente")) {
    return "O usuario nao tem saldo suficiente para concluir esse pagamento agora.";
  }
  if (normalized.includes("asaas_api_key")) {
    return "O saque automatico ainda nao esta configurado no servidor.";
  }
  if (normalized.includes("asaas transfer error")) {
    return "O Asaas recusou ou nao conseguiu concluir a transferencia Pix. Revise a conta Asaas e a chave Pix do usuario.";
  }
  if (normalized.includes("transferencia asaas retornou status")) {
    return "A transferencia foi criada no Asaas, mas ainda nao foi concluida instantaneamente.";
  }

  return "Nao foi possivel atualizar o saque agora. Tente novamente.";
};
