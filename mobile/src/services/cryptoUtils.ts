import { Timestamp } from "firebase/firestore";

/**
 * Pure TypeScript standard SHA-256 implementation with UTF-8 support.
 * Zero external dependencies, runs universally on Expo (iOS, Android, Web).
 */

function unescapeUtf8(str: string): string {
  try {
    return decodeURIComponent(encodeURIComponent(str));
  } catch {
    return str;
  }
}

function rightRotate(value: number, amount: number): number {
  return (value >>> amount) | (value << (32 - amount));
}

export function sha256Hex(str: string): string {
  const utf8String = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
    String.fromCharCode(parseInt(p1, 16))
  );

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let i = 0;
  let j = 0;
  let result = "";

  const words: number[] = [];
  const asciiBitLength = utf8String.length * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;
  const isComposite: { [key: number]: boolean } = {};

  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let composite = candidate * candidate; composite < 312; composite += candidate) {
        isComposite[composite] = true;
      }
      if (primeCounter < 8) {
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      }
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter++;
    }
  }

  let asciiPadded = utf8String + "\x80";
  while (asciiPadded.length % 64 !== 56) {
    asciiPadded += "\x00";
  }

  for (i = 0; i < asciiPadded.length; i++) {
    j = asciiPadded.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }

  words.push((asciiBitLength / maxWord) | 0);
  words.push(asciiBitLength | 0);
  while (words.length % 16 !== 0) words.push(0);

  for (j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = [...hash];

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];

      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);

      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0, a, hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byteVal = (hash[i] >> (b * 8)) & 255;
      result += (byteVal < 16 ? "0" : "") + byteVal.toString(16);
    }
  }

  return result;
}

export function canonicalize(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Timestamp) {
    return value.toMillis();
  }
  if (typeof (value as any).toMillis === "function") {
    return (value as any).toMillis();
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

export function randomNonce(byteLength = 16): string {
  const hex = "0123456789abcdef";
  let str = "";
  for (let i = 0; i < byteLength * 2; i++) {
    str += hex[Math.floor(Math.random() * 16)];
  }
  return str;
}
