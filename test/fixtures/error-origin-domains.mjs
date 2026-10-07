export function errorOriginDomainSource(called = false) {
  return `
export function inspect(value: Error): string { return value.message; }
function privateInspect(value: Error): string { return value.message; }
declare const External: typeof Error;
const unowned = ${called ? "External" : "new External"}("external ambient");
export function construct(factory: typeof Error, owner: Error): Error {
  return ${called ? "factory" : "new factory"}("external");
}
export function run(): string {
  const original = ${called ? "Error" : "new Error"}("original");
  const Owned = Error;
  const aliased = ${called ? "Owned" : "new Owned"}("aliased");
  return inspect(original) + privateInspect(original);
}
`;
}

export function errorRecoveryDomainSource(exported) {
  return `
${exported ? "export " : ""}function recover(value: unknown): void {
  try { throw value; } catch (caught) {
    if (caught instanceof Error) caught.message = "changed";
  }
}

export function run(): boolean {
  const original = new Error("original");
  recover(original);
  return original.message === "changed";
}
`;
}

export function errorConstructorFootprintSource(footprint) {
  const body = footprint === "readonly" ? `return "initialized";`
    : `${footprint === "receiver" ? "this" : footprint === "bound" ? "value" : "original"}.message = "changed"; return "initialized";`;
  const initializer = footprint === "deferred" ? `() => { ${body} }`
    : footprint === "bound" ? `((value: Error) => { ${body} })(original)`
    : `(() => { ${body} })()`;
  return `
export function run(): void {
  const original = new Error("original");
  class Base extends Error { initialized = ${initializer}; }
  class Derived extends Base {}
  const created = new Derived("derived");
}
`;
}
