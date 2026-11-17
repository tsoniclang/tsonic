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
class Container { get(): Source { return new Derived(); } }
function container(present: boolean): Container | undefined { return present ? new Container() : undefined; }
function callable(present: boolean): (() => Source) | undefined { return present ? () => new Derived() : undefined; }
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
  const absentContainer = container(false);
  const absentChain = absentContainer?.get().read(argument());
  const presentContainer = container(true);
  const presentChain = presentContainer?.get().read(argument());
  const absentCallable = callable(false);
  const presentCallable = callable(true);
  const absentCallChain = absentCallable?.().read(argument());
  const presentCallChain = presentCallable?.().read(argument());
  return absent === undefined && present === "value" && numeric === "value" &&
    absentChain === undefined && presentChain === "value" &&
    absentCallChain === undefined && presentCallChain === "value" &&
    observedCalls() === 4 && receivers === 2 && argumentsRead === 3;
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
