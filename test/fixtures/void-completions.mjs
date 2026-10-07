export const voidCompletionSource = `
let calls = 0;
function bump(): number { calls++; return calls; }
function discarded(): void { return void bump(); }
function absent(): number | undefined { return void bump(); }
export function run(): boolean {
  discarded();
  const result = absent();
  const observed = calls;
  return result === undefined && observed === 2;
}
`;
