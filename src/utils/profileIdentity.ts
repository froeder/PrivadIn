export const NAME_MAX_LENGTH = 25;
export const NICKNAME_MAX_LENGTH = 15;

const PROFILE_IDENTITY_ALLOWED_PATTERN = /^[\p{L}\p{N}@#$%&*()!._+\- ]+$/u;
const PROFILE_IDENTITY_DISALLOWED_PATTERN = /[\p{C}\t\n\r\f\v\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/u;

export type ProfileIdentityErrorCode = "required" | "invalid_chars" | "too_long";

export function normalizeProfileIdentity(value: string) {
  return value.normalize("NFC").replace(/^ +| +$/g, "");
}

export function validateProfileIdentity(
  value: string,
  options: { required?: boolean; maxLength?: number } = {},
): ProfileIdentityErrorCode | null {
  const candidateValue = value.normalize("NFC");
  const normalizedValue = normalizeProfileIdentity(value);

  if (candidateValue.length === 0) {
    return options.required ? "required" : null;
  }

  if (normalizedValue.length === 0) {
    return options.required ? "required" : "invalid_chars";
  }

  if (PROFILE_IDENTITY_DISALLOWED_PATTERN.test(candidateValue)) {
    return "invalid_chars";
  }

  if (!PROFILE_IDENTITY_ALLOWED_PATTERN.test(normalizedValue)) {
    return "invalid_chars";
  }

  if (typeof options.maxLength === "number" && normalizedValue.length > options.maxLength) {
    return "too_long";
  }

  return null;
}
