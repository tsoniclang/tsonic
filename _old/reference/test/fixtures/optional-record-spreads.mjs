export const optionalRecordSpreadsSource = `
interface Options { name?: string; count?: number; }
let order = 0;
let getterOrder = 0;
function optionalGetter(source?: { readonly count: number; readonly name: string }): { count: number; name: string } {
  return { ...source, count: 4, name: "last" };
}
function getterSpreads(): boolean {
  getterOrder = 0;
  const source = {
    get count(): number { getterOrder = getterOrder * 10 + 1; return 3; },
    get name(): string { getterOrder = getterOrder * 10 + 2; return "kept"; },
  };
  const base = { count: 2 };
  const mixed = { ...base, ...source, name: "last" };
  if (mixed.count !== 3 || mixed.name !== "last" || getterOrder !== 12) return false;
  getterOrder = 0;
  const overwritten = { ...source, count: 4, name: "last" };
  if (overwritten.count !== 4 || overwritten.name !== "last" || getterOrder !== 12) return false;
  getterOrder = 0;
  const optional = optionalGetter(source);
  if (optional.count !== 4 || optional.name !== "last" || getterOrder !== 12) return false;
  getterOrder = 0;
  const absent = optionalGetter();
  return absent.count === 4 && absent.name === "last" && getterOrder === 0;
}
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
    copied.count === 0 && overwritten.name === "last" && overwritten.count === 0 && source.count === 9 && getterSpreads();
}
`;
