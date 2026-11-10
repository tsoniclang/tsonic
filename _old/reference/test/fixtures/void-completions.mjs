export const voidCompletionSource = `
let calls = 0;
function bump(): number { calls++; return calls; }
function discarded(): void { return void bump(); }
function absent(): number | undefined { return void bump(); }
function literal(): void { return undefined; }
function parenthesized(): void { return (undefined); }
function conditional(present: boolean): void { return present ? undefined : void bump(); }
function shadowed(undefined: number): number { return undefined; }
export function run(): boolean {
  discarded();
  const result = absent();
  const observed = calls;
  literal();
  parenthesized();
  conditional(true);
  conditional(false);
  const callback: () => void = () => undefined;
  callback();
  return result === undefined && observed === 2 && calls === 3 && shadowed(9) === 9;
}
`;
