export function emptyMemoryRecordProofFiles(includeFrozen = false) {
  return Object.freeze({
  "schema.ts": `
import { struct, field, memorylayout, memoryfield } from "@tsonic/core/lang.js";
import { abi } from "test:abi";

export const Empty: {} = struct({});
export const emptyLayout = memorylayout<typeof Empty>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [] });
export const objectLayout = memorylayout<{}>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [] });
export const Parent: { blank: {} } = struct({ blank: field<{}>() });
export const blankField = memoryfield({ select: (value: typeof Parent) => value.blank, byteoffset: 0, bytealignment: 1, fieldlayout: emptyLayout });
export const parentLayout = memorylayout<typeof Parent>({ datalayout: abi, bytesize: 0, bytealignment: 1, stride: 0, fields: [blankField] });
`,
  "index.ts": `
import { allocateptr, addressof, bindmemoryfield, bindmemoryrecord,
  loadptr, storeptr, viewptr, equalptr, sizeof } from "@tsonic/core/lang.js";
import { Empty, emptyLayout, objectLayout, blankField, parentLayout } from "./schema.js";

${includeFrozen ? `function frozenIdentity(): boolean {
  const physical = bindmemoryrecord(emptyLayout);
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
  const read = (): typeof Empty => { visits += 1; return bindmemoryrecord(emptyLayout); };
  const projected: {} = read();
  const restored: typeof Empty = projected;
  const storage = allocateptr<typeof Empty>(restored);
  const loaded: {} = loadptr(storage);
  const pointer = addressof(first);
  const bound = bindmemoryrecord(objectLayout);
  const other = bindmemoryrecord(objectLayout);
  return first === alias && first !== second && loadptr(pointer) === first &&
    visits === 1 && bound !== other && loaded !== projected;
}

export function run(): boolean {
  let reads = 0;
  let writes = 0;
  const value = bindmemoryrecord(emptyLayout);
  const original = allocateptr<typeof Empty>(value);
  const view = viewptr<typeof Empty, {}>(original,
    () => { reads += 1; return bindmemoryrecord(emptyLayout); },
    value => { writes += 1; storeptr(original, value); });
  const record = bindmemoryrecord(parentLayout, bindmemoryfield(blankField, view));
  const captured = addressof(record.blank);
  const beforeReads = reads;
  const beforeWrites = writes;
  loadptr(captured);
  storeptr(captured, bindmemoryrecord(emptyLayout));
  return ${includeFrozen ? "frozenIdentity() && " : ""}identityAndConversions() && beforeReads === 0 && beforeWrites === 0 && reads === 1 && writes === 1 &&
    sizeof(parentLayout) === 0 && equalptr(captured, view);
}
`,
});
}
