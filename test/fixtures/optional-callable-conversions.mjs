export const optionalCallableConversionSource = `
function constant(): number { return 9; }
function optional(value?: number): number { return value ?? 7; }
function defaulted(value = 11): number { return value; }
let defaults = 0;
function choose(): number { defaults++; return 19; }
function computed(value = choose()): number { return value; }
let failures = 0;
function fail(): number { failures++; throw new Error("callback failure"); }
function failureCount(): number { return failures; }
function shared(): number { return 23; }
export function run(): boolean {
  const ignored: (value?: number) => number = constant;
  const required: (value: number) => number = optional;
  const withDefault: (value?: number) => number = defaulted;
  const withComputed: (value?: number) => number = computed;
  const first = shared;
  const second = shared;
  const adapted: (value?: number) => number = shared;
  const throwing: (value?: number) => void = fail;
  if (failureCount() !== 0) return false;
  let caught = false;
  try { throwing(); } catch { caught = true; }
  let calls = 0;
  let original = (): number => { calls++; return 13; };
  const discarded: (value?: number) => void = original;
  original = (): number => { calls += 10; return 17; };
  discarded();
  discarded(3);
  const rebound = original();
  return ignored() === 9 && ignored(3) === 9 && required(5) === 5 &&
    withDefault() === 11 && withDefault(2) === 2 && withDefault(undefined) === 11 &&
    withComputed(4) === 4 && withComputed() === 19 && computed(5) === 5 &&
    computed() === 19 && defaults === 2 && calls === 12 && rebound === 17 && caught && failureCount() === 1 &&
    first === second && first() === 23 && adapted(2) === 23;
}
`;
