import i18n from "../i18n";
import { DEFAULT_LANGUAGE, normalizeAppLanguage } from "../i18n/config";

function getFormatterLanguage(language?: string | null) {
  return normalizeAppLanguage(language) ?? normalizeAppLanguage(i18n.resolvedLanguage) ?? DEFAULT_LANGUAGE;
}

export function formatNumber(value: number, language?: string | null, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(getFormatterLanguage(language), options).format(value);
}

export function formatDecimal(
  value: number,
  language?: string | null,
  options: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1 },
) {
  return formatNumber(value, language, options);
}
