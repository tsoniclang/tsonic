export const sourceErrorDeclarations = `
interface Error {
  name: string;
  message: string;
  stack?: string;
}
interface ErrorConstructor {
  new (message?: string): Error;
  (message?: string): Error;
  captureStackTrace(error: Error): void;
}
declare var Error: ErrorConstructor;
`;
