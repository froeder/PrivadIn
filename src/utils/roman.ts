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

export function toRoman(value: number) {
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
