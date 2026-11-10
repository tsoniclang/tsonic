export const nativeCallableAdapterCostSource = `
let total = 0;
function original(): number { total++; return total; }
function defaulted(value = 5): number { return value; }
export function staticCallback(): (unused: number) => number { return original; }
export function inlineCallback(): (unused: number) => number { return () => original(); }
export function capturedCallback(initial: number): (unused: number) => number {
  return (): number => { initial++; return initial; };
}
export function defaultCallback(): (value?: number) => number { return defaulted; }
`;

export const nativeCallableInputBorrowSource = `
let reads = 0;
function count(value: string): number { reads++; return value === "returned" ? 8 : 6; }
function consume(callback: (value: string) => number, value: string): number {
  return callback(value);
}
export function selected(): (value: string) => number { return count; }
export function run(): boolean {
  const saved: (value: string) => number = count;
  const result = consume(count, "direct") + saved("stored") + selected()("returned");
  return result === 20 && reads === 3;
}
`;

export const absenceCallableConversionSource = `
let first = 0;
let second = 0;
let factories = 0;
let reads = 0;
function make(): () => undefined {
  factories++;
  return (): undefined => { first++; return undefined; };
}
function read(): undefined { reads++; return undefined; }
export function run(): boolean {
  const __tsonic_arg0 = 17;
  const __tsonic_callable = 29;
  let original = (): undefined => { first++; return undefined; };
  const converted: (unused: number) => number | undefined = original;
  original = (): undefined => { second++; return undefined; };
  const produced: (unused: number) => number | undefined = make();
  const absent: number | undefined = read();
  const left = converted(1);
  const right = converted(2);
  const factoryLeft = produced(3);
  const factoryRight = produced(4);
  original();
  return left === undefined && right === null && factoryLeft === null &&
    factoryRight === undefined && absent === null && first === 4 && second === 1 &&
    factories === 1 && reads === 1 && __tsonic_arg0 === 17 && __tsonic_callable === 29;
}
`;

export const broadCallableConversionSource = `
let first = 0;
let second = 0;
let factories = 0;
function make(): () => void {
  factories++;
  return () => { first++; };
}
export function run(): boolean {
  let original = (): void => { first++; };
  const converted: (unused: number) => unknown = original;
  original = (): void => { second++; };
  const produced: (unused: number) => unknown = make();
  const left = converted(1);
  const right = converted(2);
  const factoryLeft = produced(3);
  const factoryRight = produced(4);
  original();
  return left === undefined && right === null && factoryLeft === null &&
    factoryRight === undefined && first === 4 && second === 1 && factories === 1;
}
`;

export const broadAsyncCallableConversionSource = `
function take(handler: (left: number, right: number) => unknown): boolean {
  return handler(3, 7) !== null;
}
export async function run(): Promise<boolean> {
  let delta = 5;
  const retained = async (value: number): Promise<number> => value + delta;
  const direct = take(async () => 9);
  const captured = take(async (value: number) => value + delta);
  const converted: (value: number) => unknown = retained;
  const stored = converted(3) !== undefined;
  delta = 8;
  return direct && captured && stored && await retained(1) === 9;
}
`;
