export const nonReturningCallsSource = `
let calls = 0;
let discardedCount = 0;
function fail(): never { calls++; throw new Error("native termination"); }
async function suspended(): Promise<never> { calls++; throw new Error("native suspended termination"); }
function caught(): number { try { fail(); } catch { return 7; } }
function discarded(): void { try { void fail(); } catch { discardedCount++; } }
function delegated(): number { return fail(); }
function branches(failed: boolean): number { if (failed) { fail(); } else { return 9; } }
function ordinary(): number { calls++; return 10; }
async function caughtAsync(): Promise<number> { try { return await suspended(); } catch { return 11; } }
async function discardedAsync(): Promise<void> { try { void (await suspended()); } catch { discardedCount++; } }
function cleanup(): number { let observed = 0; try { fail(); } catch { observed = 13; } finally { observed++; } return observed; }
function closure(): number { const invoke = (): number => { try { fail(); } catch { return 15; } }; return invoke(); }
export async function run(): Promise<boolean> {
  discarded();
  await discardedAsync();
  if (caught() !== 7 || branches(false) !== 9 || ordinary() !== 10 ||
      await caughtAsync() !== 11 || cleanup() !== 14 || closure() !== 15) return false;
  let observed = 0;
  try { delegated(); } catch { observed++; }
  try { branches(true); } catch { observed++; }
  return observed === 2 && calls === 9 && discardedCount === 2;
}
`;
