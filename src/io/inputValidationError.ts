export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export function isInputValidationError(
  error: unknown,
): error is InputValidationError {
  return error instanceof InputValidationError;
}
