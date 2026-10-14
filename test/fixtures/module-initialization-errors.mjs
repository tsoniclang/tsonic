import { sourcePackageCallbackErrorFiles, sourcePackageCallbackErrorGraph } from "./source-package-callback-errors.mjs";

const preamble = `import type { int32 } from "@tsonic/core/types.js";
function invoke(read: () => int32): int32 { return read(); }
`;

export const moduleInitializationErrorCases = Object.freeze([
  {
    name: "pure_callback",
    source: preamble + `export function main(): void {
      if (invoke((): int32 => 7) !== 7) throw new Error("pure callback");
    } main();`,
  },
  {
    name: "nested_empty_channels",
    source: preamble + `export function main(): void {
      const result = invoke((): int32 => invoke((): int32 => 1) + invoke((): int32 => 2));
      if (result !== 3) throw new Error("nested callback");
    } main();`,
  },
  {
    name: "mixed_channels",
    source: preamble + `function selected(value: int32): int32 {
      return invoke((): int32 => {
        if (value < 0) throw new Error("negative input");
        return invoke((): int32 => value) + invoke((): int32 => 2);
      });
    }
    export function main(): void {
      if (selected(1) !== 3) throw new Error("mixed callback");
    } main();`,
  },
  {
    name: "async_empty_channels",
    source: `import type { int32 } from "@tsonic/core/types.js";
    async function invoke(read: () => Promise<int32>): Promise<int32> { return await read(); }
    export async function main(): Promise<void> { await invoke(async (): Promise<int32> => 7); }
    await main();`,
  },
  {
    name: "multiple_modules",
    source: `import { left } from "./left.js";
    import { right } from "./right.js";
    export function main(): void {
      if (left + right !== 3) throw new Error("module callback order");
    } main();`,
    files: {
      "left.ts": preamble + "export const left: int32 = invoke((): int32 => 1);",
      "right.ts": preamble + "export const right: int32 = invoke((): int32 => 2);",
    },
  },
  {
    name: "source_package_identity",
    source: sourcePackageCallbackErrorFiles["index.ts"] +
      '\nexport function main(): void { if (!run()) throw new Error("package callback identity"); }\nmain();',
    files: Object.fromEntries(Object.entries(sourcePackageCallbackErrorFiles).filter(([path]) => path !== "index.ts")),
    sourcePackages: sourcePackageCallbackErrorGraph,
  },
]);
