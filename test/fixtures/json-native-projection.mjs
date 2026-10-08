export const jsonNativeProjectionSource = `
  import type { int32, int64 } from "@tsonic/core/types.js";
  export function run(): void {
    let calls: int32 = 0;
    const count: int64 = 9007199254740993n;
    const value = {
      toJSON(key: string): { count: int64; key: string } {
        calls += 1;
        return { count, key };
      },
    };
    const root = JSON.stringify(value);
    const nested = JSON.stringify({ child: value });
    if (root !== '{"count":9007199254740993,"key":""}' ||
        nested !== '{"child":{"count":9007199254740993,"key":"child"}}' || calls !== 2) {
      throw new Error("native JSON projection lost its value, key or invocation count");
    }
    const failure = new Error("native JSON callback failure");
    const throwing = { toJSON(): string { throw failure; } };
    let caught = false;
    try {
      JSON.stringify(throwing);
    } catch (error) {
      caught = error === failure;
    }
    if (!caught || calls !== 2) {
      throw new Error("native JSON projection lost the original callback failure");
    }
  }
`;
