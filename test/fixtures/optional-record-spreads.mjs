export const optionalRecordSpreadsSource = `
interface Options { name?: string; count?: number; }
let order = 0;
function selected(options?: Options): Options | undefined {
  order = order * 10 + 1;
  return options;
}
function replacement(): number { order = order * 10 + 2; return 4; }
function merge(options?: Options): Options {
  const base: Options = { name: "base", count: 2 };
  return { ...base, ...selected(options), count: replacement() };
}
function plain(options?: Options): Options { return { ...options, count: 0 }; }
export function run(): boolean {
  order = 0;
  const absent = merge();
  if (absent.name !== "base" || absent.count !== 4 || order !== 12) return false;
  order = 0;
  const source: Options = { name: "kept", count: 9 };
  const present = merge(source);
  if (present.name !== "kept" || present.count !== 4 || order !== 12) return false;
  const empty = plain();
  const copied = plain(source);
  const overwritten: Options = { ...source, ...empty, name: "last" };
  return empty.name === undefined && empty.count === 0 && copied.name === "kept" &&
    copied.count === 0 && overwritten.name === "last" && overwritten.count === 0 && source.count === 9;
}
`;
