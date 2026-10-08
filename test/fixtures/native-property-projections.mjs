export const nativePropertyProjectionSource = `
  import type { int32, int64 } from "@tsonic/core/types.js";
  let selectedReads: int32 = 0;
  let unrelatedReads: int32 = 0;
  let suppliers: int32 = 0;
  interface Options { readonly useGrouping: boolean; }
  class GenericOptions<T> {
    constructor(private readonly grouping: T) {}
    get useGrouping(): T { selectedReads += 1; return this.grouping; }
    get unrelated(): boolean { unrelatedReads += 1; throw new Error("unselected getter"); }
  }
  class NativeOptions extends GenericOptions<boolean> {
    constructor() { super(false); }
  }
  function supply(): NativeOptions { suppliers += 1; return new NativeOptions(); }
  function supplyEmpty() { suppliers += 1; return {}; }
  function format(value: int64, options: Options | undefined): string {
    return value.toLocaleString("en", options);
  }
  export function run(): boolean {
    const exact: int64 = 9007199254740993n;
    const options = supply();
    const alias: Options = options;
    if (new Intl.NumberFormat("en", options).format(exact) !== "9007199254740993") return false;
    if (format(exact, alias) !== "9007199254740993") return false;
    if (format(exact, undefined) !== "9,007,199,254,740,993") return false;
    if (exact.toLocaleString("en", supply()) !== "9007199254740993") return false;
    const reversed = { unrelated: true, useGrouping: false };
    if (exact.toLocaleString("en", reversed) !== "9007199254740993") return false;
    const empty = {};
    if (new Intl.NumberFormat("en", empty).format(exact) !== "9,007,199,254,740,993") return false;
    if (new Intl.NumberFormat("en", supplyEmpty()).format(exact) !== "9,007,199,254,740,993") return false;
    const optional: { useGrouping?: boolean } = {};
    if (exact.toLocaleString("en", optional) !== "9,007,199,254,740,993") return false;
    const failure = new Error("selected getter failure");
    const throwing = { get useGrouping(): boolean { throw failure; } };
    let caught = false;
    try { new Intl.NumberFormat("en", throwing); }
    catch (error) { caught = error === failure; }
    if (!caught) return false;
    const nominalFailure = new Error("nominal selected getter failure");
    class ThrowingOptions {
      get useGrouping(): boolean { throw nominalFailure; }
    }
    caught = false;
    try { format(exact, new ThrowingOptions()); }
    catch (error) { caught = error === nominalFailure; }
    if (!caught) return false;
    return selectedReads === 3 && unrelatedReads === 0 && suppliers === 3;
  }
`;

export const nativePropertyProjectionCostSource = `
  import type { int64 } from "@tsonic/core/types.js";
  export class Options { readonly useGrouping: boolean = false; }
  export function format(options: Options): string {
    const value: int64 = 9007199254740993n;
    return value.toLocaleString("en", options);
  }
`;
