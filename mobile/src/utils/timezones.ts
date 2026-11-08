export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONE_VALUES = [
  "America/Sao_Paulo",
  "America/Fortaleza",
  "America/Belem",
  "America/Recife",
  "America/Manaus",
  "America/Cuiaba",
  "America/Campo_Grande",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Rio_Branco",
  "America/Noronha",
  "UTC",
] as const;

export function getGMTOffsetLabel(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    }).formatToParts(new Date());
    const offsetPart = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
    return offsetPart;
  } catch {
    return "GMT";
  }
}

export function buildTimezoneOptions(): TimezoneOption[] {
  return TIMEZONE_VALUES.map((value) => ({
    value,
    label: `${value} (${getGMTOffsetLabel(value)})`,
  }));
}

export const TIMEZONE_OPTIONS = [
  { id: "America/Sao_Paulo", label: "Brasília (UTC-3)" },
  { id: "America/Manaus", label: "Manaus (UTC-4)" },
  { id: "America/Cuiaba", label: "Cuiabá (UTC-4)" },
  { id: "America/Belem", label: "Belém (UTC-3)" },
  { id: "America/Noronha", label: "Noronha (UTC-2)" },
  { id: "America/Rio_Branco", label: "Rio Branco (UTC-5)" },
  { id: "UTC", label: "UTC (Global)" },
];
