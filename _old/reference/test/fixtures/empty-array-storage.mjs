export const emptyArrayStorageFiles = {
  "index.ts": `
function count<T>(values: readonly T[]): number { return values.length; }
function select<T>(values: readonly T[]): readonly T[] { return values; }
export function run(): boolean { return count([]) === 0 && select([]).length === 0; }
`,
};

export const emptyNativeArrayStorageFiles = {
  "index.ts": `
function inspect<T>(_values: readonly T[]): boolean { return true; }
function select<T>(values: readonly T[]): readonly T[] { return values; }
export function run(): boolean { return inspect([]) && inspect(select([])); }
`,
};
