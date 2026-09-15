export const jsArrayCopyFiles = Object.freeze({
  "index.ts": `
function copy<T>(values: T[]): T[] { return Array.from(values); }
function optionalCopy<T>(values: (T | undefined)[]): (T | undefined)[] { return Array.from(values); }
export function run(): boolean {
  const original = [1, 2, 3];
  const copied = copy(original);
  copied[0] = 9;
  const sparse: (number | undefined)[] = [1, , undefined];
  const filled = optionalCopy(sparse);
  const originalPresence = 1 in sparse;
  const copiedPresence = 1 in filled && 2 in filled;
  delete filled[0];
  const missing: undefined[] = new Array<undefined>(2);
  const present = Array.from(missing);
  const nullable: (number | null)[] = [null, 3];
  const nullableCopy = copy(nullable);
  return original[0] === 1 && copied[0] === 9 && !originalPresence && copiedPresence &&
    filled[1] === undefined && filled[2] === undefined && sparse[0] === 1 &&
    !(0 in missing) && 0 in present && 1 in present && present[0] === undefined &&
    nullableCopy[0] === null && nullableCopy[1] === 3;
}
`,
});
