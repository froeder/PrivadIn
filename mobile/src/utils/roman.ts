const romanNumerals: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(value: number): string {
  let number = Math.trunc(value);
  if (!Number.isFinite(number) || number <= 0) {
    return "I";
  }

  let result = "";
  for (const [digit, symbol] of romanNumerals) {
    while (number >= digit) {
      result += symbol;
      number -= digit;
    }
  }

  return result;
}

export function fromRoman(roman: string): number {
  if (!roman || typeof roman !== "string") return 0;
  const clean = roman.trim().toUpperCase();
  if (/^\d+$/.test(clean)) {
    const parsed = parseInt(clean, 10);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
  }

  const map: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };

  let total = 0;
  for (let i = 0; i < clean.length; i++) {
    const current = map[clean[i]];
    if (!current) continue;
    const next = map[clean[i + 1]];
    if (next && next > current) {
      total += next - current;
      i++;
    } else {
      total += current;
    }
  }

  return total > 0 ? total : 0;
}
