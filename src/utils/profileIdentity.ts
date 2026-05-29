export const NAME_MAX_LENGTH = 25;
export const NICKNAME_MAX_LENGTH = 15;

const PROFILE_IDENTITY_ALLOWED_PATTERN = /^[\p{L}\p{N}@#$%&*()!._+-]+$/u;
const PROFILE_IDENTITY_DISALLOWED_PATTERN = /[\s\p{C}]/u;

export type ProfileIdentityErrorCode = "required" | "invalid_chars" | "too_long";

export function normalizeProfileIdentity(value: string) {
  return value.normalize("NFC");
}

export function validateProfileIdentity(
  value: string,
  options: { required?: boolean; maxLength?: number } = {},
): ProfileIdentityErrorCode | null {
  const normalizedValue = normalizeProfileIdentity(value);

  if (normalizedValue.length === 0) {
    return options.required ? "required" : null;
  }

  if (PROFILE_IDENTITY_DISALLOWED_PATTERN.test(normalizedValue)) {
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
