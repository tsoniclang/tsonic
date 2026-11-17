import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePackageId, encodeModuleId, encodeDefId, encodeBodyId, encodeKey } from "../../../packages/host/dist/ids/index.js";
import { executionKey, declaredExecutionKey } from "../../../packages/host/dist/ir-types/index.js";

export async function summaryPositionCases(suite) {
  const facts = await import("../../../packages/host/dist/ir-facts/index.js");
  const internal = await import("../../../packages/host/dist/ir-facts/summary-key.js");
  const module = encodeModuleId({ package: encodePackageId("summary-position"), path: "main.ts" });
  const definition = name => encodeDefId({ module, segments: [{ name, ordinal: 0 }] });
  const body = encodeBodyId({ owner: definition("function"), role: "function", ordinal: 0 });
  const bindings = { kind: "instantiated", bindings: { classBindings: [], methodBindings: [], capturedBindings: [], selfBindings: [] } };
  const execution = { instance: { body, bindings }, provided: 0 };
  const at = { kind: "body", execution, point: { block: 2, statement: null }, edge: "return" };
  const declared = { kind: "declared", execution: { request: { definition: definition("declared"), endpoint: "api-signature",
    ordinal: 0, bindings }, provided: 0 }, source: { kind: "item", value: { owner: definition("declared"), node: 3 } } };

  await suite.test("the public position reader is the same canonical verifier implementation for both namespaces", () => {
    assert.equal(facts.summaryPositionKey === internal.summaryPositionKey, true);
    assert.equal(facts.summaryPositionKey(at), encodeKey(["body", executionKey(execution), 2, null, "return"]));
    assert.equal(facts.summaryPositionKey(declared), encodeKey(["declared", declaredExecutionKey(declared.execution),
      "item", definition("declared"), 3]));
    const source = { kind: "body", value: { body, node: 3 } };
    assert.equal(facts.summaryPositionKey({ ...declared, source }), encodeKey(["declared",
      declaredExecutionKey(declared.execution), "body", body, 3]));
    assert.equal(facts.summaryPositionKey(structuredClone(at)), facts.summaryPositionKey(at));
  });

  await suite.test("position order retains full executions, MIR occurrence, edge and qualified authored source", () => {
    const positions = [at,
      { ...at, execution: { ...execution, provided: 1 } },
      { ...at, execution: { ...execution, instance: { ...execution.instance, bindings: { kind: "parametric" } } } },
      { ...at, execution: { ...execution, instance: { ...execution.instance, body: encodeBodyId({ owner: definition("other"), role: "function", ordinal: 0 }) } } },
      { ...at, point: { block: 3, statement: null } }, { ...at, point: { block: 2, statement: 0 } },
      ...[null, "unwind", "continue", "resume"].map(edge => ({ ...at, edge })), declared,
      { ...declared, execution: { ...declared.execution, provided: 1 } },
      { ...declared, execution: { ...declared.execution, request: { ...declared.execution.request, ordinal: 1 } } },
      { ...declared, execution: { ...declared.execution, request: { ...declared.execution.request, endpoint: "advertised" } } },
      { ...declared, source: { kind: "item", value: { owner: definition("other"), node: 3 } } },
      { ...declared, source: { kind: "item", value: { owner: definition("declared"), node: 4 } } },
      { ...declared, source: { kind: "body", value: { body, node: 3 } } }];
    const keys = positions.map(facts.summaryPositionKey);
    assert.equal(new Set(keys).size, positions.length);
    const expected = [...keys].sort();
    const ordered = [...positions].reverse().sort((left, right) => {
      const first = facts.summaryPositionKey(left);
      const second = facts.summaryPositionKey(right);
      return first < second ? -1 : first > second ? 1 : 0;
    });
    assert.deepEqual(ordered.map(facts.summaryPositionKey), expected);
  });

  await suite.test("fresh public declarations expose exactly the canonical required position reader", () => {
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const stage = mkdtempSync(resolve(root, ".temp/summary-position-"));
    const compiler = resolve(process.env.TSONIC_HOST_TOOLING_ROOT ?? root, "node_modules/@typescript/native-preview/bin/tsgo.js");
    const write = (name, value) => writeFileSync(resolve(stage, name), typeof value === "string" ? value : JSON.stringify(value));
    const compile = name => {
      const result = spawnSync(process.execPath, [compiler, "--project", resolve(stage, name), "--pretty", "false"],
        { cwd: root, encoding: "utf8", timeout: 90000, maxBuffer: 1048576 });
      write(`${name}.log`, `${result.stdout ?? ""}${result.stderr ?? ""}`);
      assert.equal(result.signal, null);
      if (result.error !== undefined) throw result.error;
      return { status: result.status, output: result.stdout + result.stderr };
    };
    write("package.json", { type: "module", private: true });
    write("producer.json", { extends: resolve(root, "packages/host/tsconfig.json"), compilerOptions: {
      declaration: true, declarationMap: false, sourceMap: false, emitDeclarationOnly: true, noEmit: false,
      noEmitOnError: true, rootDir: resolve(root, "packages/host/src"), outDir: resolve(stage, "declarations"), types: [] },
      files: [resolve(root, "packages/host/src/ir-facts/index.ts")], include: [] });
    assert.deepEqual(compile("producer.json"), { status: 0, output: "" });
    write("reader.ts", 'import { summaryPositionKey } from "./declarations/ir-facts/index.js";\nimport type { SummaryPositionKey, SummaryPosition } from "./declarations/ir-facts/contract.js";\nexport const key: SummaryPositionKey = summaryPositionKey;\nexport function read(at: SummaryPosition): string { return key(at); }\n');
    write("reader.json", { extends: resolve(root, "tsconfig.base.json"), compilerOptions: { noEmit: true, types: [],
      strict: true, skipLibCheck: false, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true },
      files: [resolve(stage, "reader.ts")], include: [] });
    assert.deepEqual(compile("reader.json"), { status: 0, output: "" });
    write("reader.ts", 'import { summaryPositionKey } from "./declarations/ir-facts/index.js";\nimport type { SummaryKey, SummaryPosition } from "./declarations/ir-facts/contract.js";\nexport function invalid(key: SummaryKey, position: SummaryPosition): void { summaryPositionKey(key); summaryPositionKey(); position.kind = "body"; }\n');
    const invalid = compile("reader.json");
    assert.equal(invalid.status, 1, invalid.output.slice(-4000));
    assert.deepEqual([...invalid.output.matchAll(/error TS(\d+):/gu)].map(match => Number(match[1])), [2345, 2554, 2540]);
  });
}
