export const nativeCompletionRegionsSource = `
let trace: number = 0;
function mark(value: number): number { trace = trace * 10 + value; return value; }
function finish(): number {
  try { return mark(1); } finally { mark(2); }
}
function recover(): number {
  try { throw new Error("caught"); }
  catch { return mark(5); }
  finally { mark(6); }
}
function initialized(): number {
  let value: number;
  try {} finally { value = mark(7); }
  return value;
}
function loop(): number {
  let value: number;
  outside: do {
    try { value = mark(8); break outside; }
    finally { mark(9); }
  } while (true);
  return value;
}
function nested(): number {
  try {
    try { return mark(1); }
    finally { mark(2); }
  } finally { mark(3); }
}
function callback(): number {
  try {
    const read = (): number => 4;
    return read();
  } finally { mark(5); }
}
function localCleanupFlow(): number {
  let value: number = 0;
  try {} finally {
    for (let index = 0; index < 3; index++) {
      if (index === 0) continue;
      value += index;
      break;
    }
    const select = (): number => { return 2; };
    value += select();
  }
  return value;
}
export function run(): boolean {
  if (finish() !== 1 || trace !== 12) return false;
  trace = 0;
  if (recover() !== 5 || trace !== 56) return false;
  trace = 0;
  if (initialized() !== 7 || trace !== 7) return false;
  trace = 0;
  if (loop() !== 8 || trace !== 89) return false;
  trace = 0;
  if (nested() !== 1 || trace !== 123) return false;
  trace = 0;
  return callback() === 4 && trace === 5 && localCleanupFlow() === 3;
}
`;

export const nativeFinallyOverrideSource = `
export function finallyOverride(): boolean {
  try { return false; } finally { return true; }
}
`;
