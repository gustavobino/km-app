/** Friendly pt-BR messages for Supabase Auth errors. */
export function authErrorMessage(error: {
  code?: string;
  status?: number;
  message?: string;
}): string {
  const code = error.code ?? "";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    error.status === 429
  ) {
    return "Muitos pedidos de acesso em pouco tempo. Espere alguns minutos e tente de novo.";
  }
  if (
    code === "otp_expired" ||
    code === "invalid_credentials" ||
    /expired|invalid/i.test(error.message ?? "")
  ) {
    return "Código inválido ou expirado. Peça um novo link.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "Confira o e-mail: parece que falta alguma coisa.";
  }
  if (code === "signup_disabled") {
    return "Cadastros estão fechados no momento.";
  }
  if (/fetch|network/i.test(error.message ?? "")) {
    return "Sem conexão. Para entrar você precisa de internet; depois o app funciona sem sinal.";
  }
  return "Não deu para enviar agora. Tente de novo em instantes.";
}
