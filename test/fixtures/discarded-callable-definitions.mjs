export const discardedCallableDefinitionsSource = `
let calls = 0;
function readCalls() { return calls; }
function initialize(): number { calls++; return calls; }
function factory(): () => number { calls++; return () => initialize(); }
function fail(): number { calls++; throw new Error("discarded call"); }
class Callbacks {
  get callback(): () => number { calls++; return () => initialize(); }
}
export function run(): boolean {
  calls = 0;
  (() => initialize());
  (((async () => initialize())));
  (function () { return initialize(); });
  if (readCalls() !== 0) return false;
  const captured = initialize();
  (() => captured + initialize());
  async () => captured + initialize();
  (() => {
    const nested = async () => captured + initialize();
    return nested;
  });
  void (() => initialize());
  void (async () => initialize());
  if (readCalls() !== 1 || captured !== 1) return false;
  let iterations = 0;
  for (() => initialize(); iterations < 2; () => initialize()) { iterations++; }
  for (async () => initialize(); iterations < 4; async () => initialize()) { iterations++; }
  if (iterations !== 4 || readCalls() !== 1) return false;
  const callback = () => initialize();
  if (callback() !== 2) return false;
  factory();
  new Callbacks().callback;
  if (readCalls() !== 4) return false;
  for (initialize(); iterations < 6; initialize()) { iterations++; }
  if (readCalls() !== 7) return false;
  (initialize(), () => initialize());
  if (readCalls() !== 8) return false;
  if ((() => initialize())() !== 9) return false;
  let caught = false;
  try { fail(); } catch { caught = true; }
  return caught && readCalls() === 10;
}
export function discarded(input: number): number {
  (() => input + 1);
  async () => input + 1;
  void (() => input + 1);
  let mutable = input;
  (() => mutable++);
  async () => mutable++;
  void (() => mutable++);
  (() => {
    const nested = async () => mutable++;
    return nested;
  });
  return mutable;
}
`;

export const retainedDefaultCallableSource = `
let calls = 0;
function initialize() { calls++; return calls; }
export function run(): boolean {
  const { callback = () => initialize() } = { callback: undefined };
  return calls === 0 && callback() === 1 && callback() === 2;
}
`;
