export const contextualCallableCompletionSource = `
type Handler = (left: number, right: number, next: () => void) => unknown;
let observed = 0;
function take(handler: Handler): boolean {
  return handler(1, 2, () => { observed += 1; }) == null;
}
function takeMany(...handlers: Handler[]): boolean {
  for (const handler of handlers) {
    if (!take(handler)) return false;
  }
  return true;
}
function missing(): unknown { return; }
function conditional(present: boolean): unknown {
  if (present) return 7;
}
class Missing {
  read(): unknown { return; }
}
export function run(): boolean {
  const absent = new Missing();
  const partial: (present: boolean) => unknown = present => {
    if (present) return 9;
  };
  return take(() => {}) && take(() => { return; }) &&
    take(() => undefined) && take((left, right) => {
      if (left === right) return "present";
    }) && take((left, right, next) => {
      if (left !== right) next();
      return;
    }) && takeMany(() => {}, () => { return; }) &&
    missing() === undefined && absent.read() === null &&
    conditional(false) === null && conditional(true) === 7 &&
    partial(false) === undefined && partial(true) === 9 && observed === 1;
}
`;

export const optionalCallableCompletionSource = `
type Handler = (present: boolean) => number | null | undefined;
function take(handler: Handler): boolean {
  return handler(false) === undefined && handler(true) === 7;
}
function conditional(present: boolean): number | null | undefined {
  if (present) return 7;
}
function explicit(present: boolean): number | null | undefined {
  if (!present) return;
  return 7;
}
function absent<Value>(): Value | null | undefined { return; }
function generic<Value>(value: Value, present: boolean): Value | null | undefined {
  if (present) return value;
}
function genericExplicit<Value>(value: Value, present: boolean): Value | null | undefined {
  if (!present) return;
  return value;
}
class Missing {
  read(present: boolean): number | null | undefined {
    if (!present) return;
    return 7;
  }
}
export function run(): boolean {
  const missing = new Missing();
  return take(present => { if (present) return 7; }) &&
    take(present => { if (!present) return; return 7; }) &&
    take(present => present ? 7 : undefined) && take(conditional) &&
    take(explicit) && missing.read(false) === null && missing.read(true) === 7 &&
    absent<number>() === undefined && generic(7, false) === null && generic(7, true) === 7 &&
    genericExplicit(7, false) === undefined && genericExplicit(7, true) === 7;
}
`;
