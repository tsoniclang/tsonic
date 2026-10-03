export const liveErrorStorageFiles = Object.freeze({
  "failures.ts": `
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super("initial message");
    this.status = status;
    this.name = "HttpError";
  }
}
export class RequestError extends HttpError {
  readonly route: string;
  constructor() {
    super(403);
    this.route = "/protected";
  }
}
export class OrdinaryThrownValue {
  name = "HttpError";
  message = "not an Error";
  stack: string | undefined = undefined;
}
export class StoredError {
  constructor(public readonly error: Error) {}
}
export function throughBase(error: Error): Error { return error; }
export function throwBase(error: Error): void { throw error; }
export function observe(error: Error, name: string, message: string, stack: string | undefined): boolean {
  return error.name === name && error.message === message && error.stack === stack;
}
export function mutate(error: HttpError, name: string, message: string, stack: string | undefined): void {
  error.name = name;
  error.message = message;
  error.stack = stack;
}
`,
  "index.ts": `
import { HttpError, OrdinaryThrownValue, RequestError, StoredError, mutate, observe, throughBase, throwBase } from "./failures.js";
export function run(): boolean {
  const original = new RequestError();
  const base: Error = throughBase(original);
  const stored = new StoredError(base);
  const items: Error[] = [base];
  if (base !== original || stored.error !== original || items[0] !== original) return false;
  if (!observe(base, "HttpError", "initial message", undefined)) return false;
  mutate(original, "RequestError", "updated message", "authored stack");
  if (!observe(base, "RequestError", "updated message", "authored stack")) return false;
  if (!observe(stored.error, "RequestError", "updated message", "authored stack")) return false;
  if (!observe(items[0], "RequestError", "updated message", "authored stack")) return false;
  let recovered = false;
  let finalized = 0;
  try {
    try { throwBase(base); }
    catch (caught) {
      if (!(caught instanceof Error)) return false;
      if (caught !== original || !observe(caught, "RequestError", "updated message", "authored stack")) return false;
      mutate(original, "ChangedWhileCaught", "live in catch", undefined);
      if (!observe(caught, "ChangedWhileCaught", "live in catch", undefined)) return false;
      throw caught;
    } finally { finalized += 1; }
  } catch (caught) {
    if (caught instanceof RequestError) {
      recovered = caught === original && caught.status === 403 && caught.route === "/protected";
      if (!observe(caught, "ChangedWhileCaught", "live in catch", undefined)) return false;
      mutate(caught, "Recovered", "recovered message", "recovered stack");
    }
  }
  if (!recovered || finalized !== 1 || !observe(base, "Recovered", "recovered message", "recovered stack")) return false;
  const sibling = new HttpError(500);
  const siblingBase: Error = throughBase(sibling);
  if (siblingBase === base || !observe(siblingBase, "HttpError", "initial message", undefined)) return false;
  let rejected = false;
  try { throw new OrdinaryThrownValue(); }
  catch (caught) {
    if (caught instanceof Error) return false;
    if (caught instanceof OrdinaryThrownValue) rejected = caught.message === "not an Error";
  }
  const builtin = new Error("unchanged native Error");
  return rejected && builtin.stack === undefined && builtin.name === "Error" && builtin.message === "unchanged native Error";
}
`,
});

export const liveErrorBaseWriteSource = `
class MutableFailure extends Error {
  constructor() { super("original"); }
}
function mutate(error: Error): void {
  error.name = "Changed";
  error.message = "changed message";
  error.stack = "changed stack";
}
export function run(): boolean {
  const failure = new MutableFailure();
  const base: Error = failure;
  mutate(base);
  if (failure.name !== "Changed" || failure.message !== "changed message" || failure.stack !== "changed stack") return false;
  const builtin = new Error("builtin");
  const alias = builtin;
  mutate(builtin);
  return alias.name === "Changed" && alias.message === "changed message" && alias.stack === "changed stack";
}
`;

export function liveErrorMixedRecoverySource(projectError) {
  return `
class Failure extends Error {}
class Unrelated {
  name = "Error";
  message = "not an Error";
  stack: string | undefined = "not an Error stack";
}
function recover(flag: boolean): boolean {
  const original = ${projectError ? "new Failure" : "new Error"}("before");
  let excluded = false;
  try { if (flag) throw original; throw new Unrelated(); }
  catch (caught) {
    if (caught instanceof Error) {
      if (caught !== original) return false;
      caught.name = "Changed";
      caught.message = "after";
      caught.stack = "stack";
    } else if (caught instanceof Unrelated) {
      excluded = caught.name === "Error" && caught.message === "not an Error" && caught.stack === "not an Error stack";
    } else return false;
  }
  return flag
    ? !excluded && original.name === "Changed" && original.message === "after" && original.stack === "stack"
    : excluded && original.message === "before" && original.stack === undefined;
}
export function run(): boolean { return recover(false) && recover(true); }
`;
}
