export function implicitErrorInterfaceSource(projectError) {
  return `
${projectError ? "class Failure extends Error {}" : ""}
interface StoredView { readonly error: Error; }
class StoredError {
  readonly error: Error;
  constructor(error: Error) { this.error = error; }
}
function view(value: StoredError): StoredView { return value; }
function observe(value: StoredView, message: string): boolean { return value.error.message === message; }
export function run(): boolean {
  const original = ${projectError ? "new Failure" : "new Error"}("original");
  const stored = new StoredError(original);
  const selected = view(stored);
  if (selected.error !== original || !observe(selected, "original")) return false;
  original.message = "changed";
  return selected.error === original && observe(selected, "changed");
}
`;
}
