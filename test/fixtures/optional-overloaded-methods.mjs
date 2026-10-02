export const optionalOverloadedMethodSource = `
let calls = 0;
let receivers = 0;
let argumentsRead = 0;
class Source {
  read(key: string): string;
  read(key: number): string;
  read(key: string | number): string { calls += 1; return "value"; }
}
class Derived extends Source {}
function receiver(present: boolean): Source | undefined {
  receivers += 1;
  return present ? new Derived() : undefined;
}
function argument(): string { argumentsRead += 1; return "key"; }
function observedCalls(): number { return calls; }
function read(source: Source | undefined): string | undefined { return source?.read(argument()); }
export function run(): boolean {
  const absent = read(receiver(false));
  const present = read(receiver(true));
  const numeric = new Derived().read(7);
  return absent === undefined && present === "value" && numeric === "value" &&
    observedCalls() === 2 && receivers === 2 && argumentsRead === 1;
}
`;

export const optionalOverloadedBroadMethodSource = `
let calls = 0;
class Source {
  read(key: string): unknown;
  read(key: number): unknown;
  read(key: string | number): unknown { calls += 1; return 9; }
}
class Derived extends Source {}
function read(source: Source | undefined): unknown { return source?.read("key"); }
export function run(): boolean {
  read(undefined);
  read(new Derived());
  new Derived().read(7);
  return calls === 2;
}
`;
