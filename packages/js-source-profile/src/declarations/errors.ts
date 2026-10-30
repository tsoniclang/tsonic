export const sourceErrorDeclarations = `
interface ErrorOptions {
  cause?: Error;
}
interface Error {
  name: string;
  message: string;
  stack?: string;
  cause?: Error;
}
interface ErrorConstructor {
  new (message?: string, options?: ErrorOptions): Error;
  (message?: string, options?: ErrorOptions): Error;
  captureStackTrace(error: Error): void;
}
declare var Error: ErrorConstructor;
`;
