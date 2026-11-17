export const sourceErrorConstructorProof = `
export class ImplicitFailure extends Error { readonly tag = "implicit"; }
export class ChildFailure extends ImplicitFailure { readonly detail = "child"; }
export class ExplicitFailure extends Error {
  readonly tag = "explicit";
  constructor(message?: string) { super(message); }
}
export function makeImplicit(message?: string): ImplicitFailure { return new ImplicitFailure(message); }
export function makeExplicit(message?: string): ExplicitFailure { return new ExplicitFailure(message); }
export function checkBase(message?: string): boolean {
  const failure = new Error(message);
  return failure.message === (message ?? "") && failure.name === "Error" && failure.stack === undefined;
}
export function run(): boolean {
  if (!checkBase() || !checkBase("base") || !checkBase("") || new Error(undefined).message !== "") return false;
  const omitted = new ImplicitFailure();
  const absent = new ImplicitFailure(undefined);
  const present = makeImplicit("implicit message");
  const explicit = makeExplicit("explicit message");
  const explicitOmitted = makeExplicit();
  const child = new ChildFailure("child message");
  const childOmitted = new ChildFailure();
  if (omitted.message !== "" || absent.message !== "" || present.message !== "implicit message" ||
    explicit.message !== "explicit message" || explicitOmitted.message !== "" || child.message !== "child message" ||
    childOmitted.message !== "" || present.name !== "Error" || child.name !== "Error" ||
    present.tag !== "implicit" || explicit.tag !== "explicit" || child.detail !== "child" ||
    omitted.stack !== undefined || explicit.stack !== undefined || child.stack !== undefined) return false;
  try { throw child; }
  catch (failure) { return failure instanceof ChildFailure && failure.detail === "child" && failure.message === "child message"; }
}
`;

export const sourceJsErrorConstructorProof = `
export function check(message?: string): boolean {
  const type = new TypeError(message);
  const range = new RangeError(message);
  const uri = new URIError(message);
  return type.message === (message ?? "") && range.message === (message ?? "") && uri.message === (message ?? "") &&
    type.name === "TypeError" && range.name === "RangeError" && uri.name === "URIError" &&
    type.stack === undefined && range.stack === undefined && uri.stack === undefined;
}
export function run(): boolean {
  return check() && check("") && check("native message") && new TypeError().message === "" &&
    new RangeError(undefined).message === "" && new URIError("direct").message === "direct";
}
`;

export const sourceOwnedErrorConstructorProof = `
class Error<T> {
  readonly value: T;
  constructor(value: T) { this.value = value; }
}
class LocalFailure extends Error<number> { readonly tag = "local"; }
export function run(): boolean {
  const value = new LocalFailure(37);
  return value.value === 37 && value.tag === "local";
}
`;

export const sourceErrorConstructorCostProof = `
export function makeOptional(message?: string): Error { return new Error(message); }
export function makeRequired(message: string): Error { return new Error(message); }
`;

export const sourceExplicitErrorInitializationProof = `
class RequiredFailure extends Error { constructor(message: string) { super(message); } }
class OptionalFailure extends Error { constructor(message?: string) { super(message); } }
class RetainedFailure extends Error {
  saved: string;
  constructor(message: string) { super(message); this.saved = message; }
}
let calls = 0;
function absent(): undefined { calls += 1; return undefined; }
class EffectFailure extends Error { constructor() { super(absent()); } }
export function run(): boolean {
  const required = new RequiredFailure("café😀");
  const optional = new OptionalFailure("optional");
  const omitted = new OptionalFailure();
  const missing = new OptionalFailure(undefined);
  const retained = new RetainedFailure("retained");
  const effect = new EffectFailure();
  return required.message === "café😀" && optional.message === "optional" &&
    omitted.message === "" && missing.message === "" && effect.message === "" && calls === 1 &&
    retained.message === "retained" && retained.saved === "retained" && required.stack === undefined;
}
`;

export const sourceExplicitErrorInitializationCostProof = `
export class ImplicitOwnedFailure extends Error {}
export class RequiredOwnedFailure extends Error { constructor(message: string) { super(message); } }
export class OptionalOwnedFailure extends Error { constructor(message?: string) { super(message); } }
export class RetainedOwnedFailure extends Error {
  saved: string;
  constructor(message: string) { super(message); this.saved = message; }
}
`;
