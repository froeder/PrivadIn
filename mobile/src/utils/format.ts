export function formatNumber(
  value: number,
  locale = "pt-BR",
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDecimal(
  value: number,
  locale = "pt-BR",
  options: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1 }
): string {
  return formatNumber(value, locale, options);
}

export function formatPoopcoins(value: number): string {
  return formatNumber(Math.round(value));
}
