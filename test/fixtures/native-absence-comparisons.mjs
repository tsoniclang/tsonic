export const nativeAbsenceComparisonSource = `
interface Stored { value: string | null | undefined; }
class Box { value: string | null | undefined = "present"; }
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
export function run(): boolean { return classCase() && recordCase() && effects === 4; }
`;
