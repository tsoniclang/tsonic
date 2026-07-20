import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTsgoOutputPaths } from "../scripts/build/clean-tsgo-output.mjs";

test("TS-Go output cleaning follows the resolved canonical config output", () => {
  assert.deepEqual(resolveTsgoOutputPaths(
    "/workspace/tsonic-csharp/.temp/build/tsconfig.canonical-tsonic.json",
    {
      compilerOptions: {
        outDir: "../../dist",
        tsBuildInfoFile: "../../dist/.tsbuildinfo",
      },
    },
  ), {
    outputDirectory: "/workspace/tsonic-csharp/dist",
    buildInfoPath: "/workspace/tsonic-csharp/dist/.tsbuildinfo",
  });
});

test("TS-Go output cleaning rejects non-canonical output directories", () => {
  assert.throws(
    () => resolveTsgoOutputPaths("/workspace/project/tsconfig.json", {
      compilerOptions: { outDir: "../artifacts" },
    }),
    /expected a directory named 'dist'/u,
  );
});
