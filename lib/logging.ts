type ErrorContext = {
  event: string;
  recoverable: boolean;
};

/** Logs operational metadata only; never pass card data or attachment contents. */
export function logError(context: ErrorContext, error: unknown): void {
  console.error({
    level: "error",
    event: context.event,
    recoverable: context.recoverable,
    message: error instanceof Error ? error.message : "unknown_error",
  });
}
