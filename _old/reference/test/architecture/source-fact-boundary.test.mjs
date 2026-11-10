import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { collectConsumedPublicExports, readPublicDeclarationInputs } from "./tooling/public-declarations.mjs";
import { auditPublicTypeBoundary } from "./tooling/public-type-boundary.mjs";
import { readSourceInventory } from "./tooling/file-inventory.mjs";
import { readArchitectureTypeScript } from "./tooling/typescript-source.mjs";
import { checkerImportFindings, moduleLifetimeFindings } from "./tooling/source-boundaries.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("every target-facing export and Native-consumed fact or reader is checker-free across its complete public surface", () => {
  const inputs = readPublicDeclarationInputs(["target-api", "source-core", "js-source-profile", "tsts", "host"].map(name => resolve(root, "packages", name)));
  const consumers = readSourceInventory(resolve(root, "../tsonic-csharp/src"), { extensions: [".ts"] });
  const rows = auditPublicTypeBoundary({
    ...inputs,
    checkerEntry: "@tsonic/tsts",
    targets: [
      ...inputs.entries.filter(entry => entry.name.startsWith("@tsonic/target-api"))
        .map(entry => ({ entry: entry.name, exports: "all" })),
      ...collectConsumedPublicExports(consumers),
    ],
  });
  assert.equal(rows.length > 0, true, "public export inventory is nonempty");
  assert.deepEqual(rows.filter(row => row.verdict !== "clean"), []);
});

test("only Host input adapters import checker vocabulary and Source ownership caches live inside a program", () => {
  const sources = new Map(["host", "target-api", "source-core", "js-source-profile"].flatMap(name =>
    [...readSourceInventory(resolve(root, "packages", name, "src"), { extensions: [".ts"] })]
      .filter(([file]) => !file.endsWith(".test.ts"))
      .map(([file, text]) => [`packages/${name}/src/${file}`, text])));
  const source = readArchitectureTypeScript(sources);
  assert.deepEqual(source.sourceFiles.flatMap(file => [
    ...checkerImportFindings(source, file), ...moduleLifetimeFindings(source, file),
  ]), []);
});
