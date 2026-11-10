export const callableInputDomainSource = `
function borrowed(value: string): string { return value === "FIRST" ? "first" : "third"; }
function owned(value: string): string { return value; }
function borrowedPredicate(value: string): boolean { return value === "native"; }
export function evaluate(input: string, transform: (value: string) => boolean): boolean {
  return transform(input);
}
export function measured(input: string): boolean { return evaluate(input, borrowedPredicate); }
export function apply(input: string, transform: (value: string) => string): string {
  return transform(input);
}
function privateApply(input: string, transform: (value: string) => string): string {
  return transform(input);
}
export function run(): boolean {
  return apply("FIRST", borrowed) === "first" && apply("SECOND", owned) === "SECOND" &&
    privateApply("THIRD", borrowed) === "third" && privateApply("FOURTH", owned) === "FOURTH" && measured("native");
}
export function main(): void { if (!run()) throw new Error("native callback input domain"); }
`;

export const callableInputDomainDeclaration = `
export function apply(input: string, transform: (value: string) => string): string {
  return transform(input);
}
`;

export const callableInputDomainObservedCaller = `
function borrowed(value: string): string { return value === "VALUE" ? "value" : "other"; }
export function observed(): string { return apply("VALUE", borrowed); }
`;
