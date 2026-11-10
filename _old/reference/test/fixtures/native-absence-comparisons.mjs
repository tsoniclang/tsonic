export const nativeAbsenceComparisonSource = `
interface Stored { value: string | null | undefined; }
class Box { value: string | null | undefined = "present"; }
class Failure extends Error {}
let effects = 0;
function clear(value: Stored): void { value.value = undefined; }
function absent(): undefined { effects++; return undefined; }
function classCase(): boolean {
  const box = new Box();
  const alias = box;
  if (box.value !== "present") return false;
  clear(alias);
  return box.value === null && null === box.value &&
    box.value === undefined && undefined === box.value &&
    !(box.value != null) && !(undefined != box.value) &&
    box.value === absent() && absent() === box.value;
}
function recordCase(): boolean {
  const record: Stored = { value: "present" };
  const alias = record;
  if (record.value !== "present") return false;
  clear(alias);
  return record.value === null && null === record.value &&
    record.value === undefined && undefined === record.value &&
    record.value === absent() && absent() === record.value;
}
function inheritedCase(): boolean {
  const original = new Failure("original");
  const alias = original;
  original.stack = "present";
  if (alias.stack !== "present") return false;
  const base: Error = original;
  base.stack = undefined;
  if (alias.stack !== null || null !== original.stack) return false;
  alias.stack = "restored";
  return original.stack !== null && base.stack !== undefined;
}
export function run(): boolean { return classCase() && recordCase() && inheritedCase() && effects === 4; }
`;

export const readonlyNativeAbsenceComparisonSource = `
interface Stored { value: string | null | undefined; }
class Box { value: string | null | undefined = "present"; }
class Failure extends Error { trace: string | undefined = undefined; }
let effects = 0;
function clear(value: Stored): void { value.value = undefined; }
function absent(): undefined { effects++; return undefined; }
function classCase(): boolean {
  const box = new Box();
  const alias = box;
  if (box.value !== "present") return false;
  clear(alias);
  return box.value === null && null === box.value &&
    box.value === undefined && undefined === box.value &&
    !(box.value != null) && !(undefined != box.value) &&
    box.value === absent() && absent() === box.value;
}
function recordCase(): boolean {
  const record: Stored = { value: "present" };
  const alias = record;
  if (record.value !== "present") return false;
  clear(alias);
  return record.value === null && null === record.value &&
    record.value === undefined && undefined === record.value &&
    record.value === absent() && absent() === record.value;
}
function inheritedCase(): boolean {
  const original = new Failure("original");
  const alias = original;
  original.trace = "present";
  if (alias.trace !== "present") return false;
  const base: Error = original;
  const mutable: Failure = original;
  mutable.trace = undefined;
  if (alias.trace !== null || null !== original.trace || base.stack !== undefined) return false;
  alias.trace = "restored";
  if (original.trace === null || mutable.trace === undefined || base !== original || base.message !== "original") return false;
  try { throw base; }
  catch (failure) {
    return failure instanceof Failure && failure === original && failure.stack !== null && failure.trace === "restored";
  }
}
export function run(): boolean { return classCase() && recordCase() && inheritedCase() && effects === 4; }
`;
