export const sourceErrorNames = Object.freeze(["Error", "RangeError", "TypeError", "URIError"] as const);

export const sourceErrorDeclarations = `
interface Error {
  readonly name: string;
  readonly message: string;
  readonly stack: string | undefined;
  readonly cause: Error | undefined;
}
interface ErrorOptions { cause?: Error; }
interface ErrorConstructor {
  new (message?: string, options?: ErrorOptions): Error;
  (message?: string, options?: ErrorOptions): Error;
  captureStackTrace(error: Error): void;
}
declare var Error: ErrorConstructor;
`;
