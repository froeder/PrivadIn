export type RegisterPoopErrorCode =
  | "deactivated_user"
  | "missing_terms"
  | "missing_work_schedule"
  | "invalid_work_schedule"
  | "outside_work_hours"
  | "lunch_break"
  | "cooldown"
  | "daily_limit"
  | "location_denied"
  | "location_unavailable"
  | "location_invalid";

export type RegisterPoopResolutionTarget = "none" | "profile" | "terms";

export class RegisterPoopError extends Error {
  readonly code: RegisterPoopErrorCode;
  readonly resolutionTarget: RegisterPoopResolutionTarget;

  constructor(
    code: RegisterPoopErrorCode,
    message: string,
    resolutionTarget: RegisterPoopResolutionTarget = "none"
  ) {
    super(message);
    this.name = "RegisterPoopError";
    this.code = code;
    this.resolutionTarget = resolutionTarget;
  }
}

export function isRegisterPoopError(error: unknown): error is RegisterPoopError {
  return error instanceof RegisterPoopError;
}
