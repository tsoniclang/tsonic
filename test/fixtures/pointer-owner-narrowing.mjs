export const pointerOwnerNarrowingSource = `
import { bindPointer, equalPointer, loadPointer, storePointer } from "@tsonic/core/lang.js";
import type { int32, Pointer } from "@tsonic/core/types.js";
class Cell { value: int32 = 1; }
function create(present: boolean): Cell | undefined { return present ? new Cell() : undefined; }
function bind(cell: Cell | undefined): Pointer<int32> | undefined {
  return cell === undefined ? undefined : bindPointer<int32>(cell, () => cell.value, value => { cell.value = value; });
}
export function run(): boolean {
  const owner = create(true);
  const other = create(true);
  const first = bind(owner);
  const second = bind(owner);
  const separate = bind(other);
  if (owner === undefined || first === undefined || second === undefined || separate === undefined) return false;
  storePointer(first, 42);
  return owner.value === 42 && loadPointer(second) === 42 && loadPointer(separate) === 1 &&
    equalPointer(first, second) && !equalPointer(first, separate) && bind(undefined) === undefined;
}
`;
