export function emptyMemoryRecordProofFiles(includeFrozen = false) {
  return Object.freeze({
  "schema.ts": `
import { struct, field, memoryLayout, memoryField } from "@tsonic/core/lang.js";
import { abi } from "test:abi";

export const Empty: {} = struct({});
export const emptyLayout = memoryLayout<typeof Empty>(abi, 0, 1, 0);
export const objectLayout = memoryLayout<{}>(abi, 0, 1, 0);
export const Parent: { blank: {} } = struct({ blank: field<{}>() });
export const blankField = memoryField((value: typeof Parent) => value.blank, 0, 1, emptyLayout);
export const parentLayout = memoryLayout<typeof Parent>(abi, 0, 1, 0, blankField);
`,
  "index.ts": `
import { allocatePointer, addressOf, bindMemoryField, bindMemoryRecord,
  loadPointer, storePointer, viewPointer, equalPointer, sizeOf } from "@tsonic/core/lang.js";
import { Empty, emptyLayout, objectLayout, blankField, parentLayout } from "./schema.js";

${includeFrozen ? `function frozenIdentity(): boolean {
  const physical = bindMemoryRecord(emptyLayout);
  const projected: {} = physical;
  const first: {} = {};
  const alias = first;
  const second: {} = {};
  const frozen = Object.freeze(first);
  return frozen === alias && Object.isFrozen(alias) &&
    !Object.isFrozen(second) && !Object.isFrozen(projected) && first !== second;
}` : ""}

function identityAndConversions(): boolean {
  let first: {} = {};
  const alias = first;
  const second: {} = {};
  let visits = 0;
  const read = (): typeof Empty => { visits += 1; return bindMemoryRecord(emptyLayout); };
  const projected: {} = read();
  const restored: typeof Empty = projected;
  const storage = allocatePointer<typeof Empty>(restored);
  const loaded: {} = loadPointer(storage);
  const pointer = addressOf(first);
  const bound = bindMemoryRecord(objectLayout);
  const other = bindMemoryRecord(objectLayout);
  return first === alias && first !== second && loadPointer(pointer) === first &&
    visits === 1 && bound !== other && loaded !== projected;
}

export function run(): boolean {
  let reads = 0;
  let writes = 0;
  const value = bindMemoryRecord(emptyLayout);
  const original = allocatePointer<typeof Empty>(value);
  const view = viewPointer<typeof Empty, {}>(original,
    () => { reads += 1; return bindMemoryRecord(emptyLayout); },
    value => { writes += 1; storePointer(original, value); });
  const record = bindMemoryRecord(parentLayout, bindMemoryField(blankField, view));
  const captured = addressOf(record.blank);
  const beforeReads = reads;
  const beforeWrites = writes;
  loadPointer(captured);
  storePointer(captured, bindMemoryRecord(emptyLayout));
  return ${includeFrozen ? "frozenIdentity() && " : ""}identityAndConversions() && beforeReads === 0 && beforeWrites === 0 && reads === 1 && writes === 1 &&
    sizeOf(parentLayout) === 0 && equalPointer(captured, view);
}
`,
});
}
