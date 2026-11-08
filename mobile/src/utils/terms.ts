import type { AppSettings, AppUser } from "../types";

export const INITIAL_TERMS_OF_USE_VERSION = 1;
export const MAX_TERMS_OF_USE_LENGTH = 10000;
export const TERMS_ENFORCEMENT_ENABLED = false;

export const DEFAULT_TERMS_OF_USE_TEXT = [
  "Ao usar o PrivadIn, você concorda com a coleta e o armazenamento dos dados necessários para operar a competição do trono corporativo.",
  "Isso inclui horários de registro, duração de sessões, timezone, pontuações, transferências de Poopcoins e informações de auditoria para fins de transparência da liga.",
  "Os dados são armazenados de forma segura em conformidade com as diretrizes da LGPD (Lei Geral de Proteção de Dados) e políticas do Google Play.",
  "Os termos podem ser atualizados periodicamente pela administração da liga. Quando houver alteração relevante, uma nova versão poderá ser solicitada.",
].join("\n\n");

export function normalizeTermsOfUseText(value: string): string {
  return value.trim().slice(0, MAX_TERMS_OF_USE_LENGTH);
}

export function getCurrentTermsVersion(settings?: Pick<AppSettings, "termsOfUseVersion"> | null): number {
  return Math.max(INITIAL_TERMS_OF_USE_VERSION, Number(settings?.termsOfUseVersion ?? INITIAL_TERMS_OF_USE_VERSION));
}

export function getCurrentTermsText(settings?: Pick<AppSettings, "termsOfUseText"> | null): string {
  const normalized = normalizeTermsOfUseText(String(settings?.termsOfUseText ?? ""));
  return normalized || DEFAULT_TERMS_OF_USE_TEXT;
}

export function hasAcceptedCurrentTerms(
  user: Pick<AppUser, "termsAccepted" | "acceptedTermsVersion"> | null | undefined,
  settings?: Pick<AppSettings, "termsOfUseVersion"> | null
): boolean {
  if (!TERMS_ENFORCEMENT_ENABLED) {
    return true;
  }

  if (!user) return false;

  const currentVersion = getCurrentTermsVersion(settings);
  const acceptedVersion = Number(user.acceptedTermsVersion ?? 0);

  if (acceptedVersion >= currentVersion) {
    return true;
  }

  return currentVersion === INITIAL_TERMS_OF_USE_VERSION && user.termsAccepted === true;
}
