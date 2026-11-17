import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageBudget, defaultSourceStorageLimits } from "../../packages/target-api/dist/target-analysis/source-storage/model/resource-budget.js";
import { createSourceStorageTransport } from "../../packages/target-api/dist/target-analysis/source-storage/transport/transport.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body, limits = {}) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const base = createSourceStorageBudget({ ...defaultSourceStorageLimits, maximumSteps: 65_536, ...limits });
  let steps = 0;
  const budget = { ...base, step() { steps += 1; return base.step(); } };
  const transport = createSourceStorageTransport(source, [file], budget);
  const subject = name => transport.subjectFor(Node_Initializer(source.ast, namedVariable(source.ast, file, name)));
  const initialized = budget.usage();
  const queryWork = [];
  const expect = (name, names) => {
    const before = budget.usage();
    const origins = transport.substitutions.origins(subject(name), transport.substitutions.empty);
    const after = budget.usage();
    queryWork.push(`${name}:${after.steps - before.steps}`);
    assert.equal(origins !== undefined && origins.size === names.length && names.every(name => origins.has(subject(name))), true,
      `${name}: exact origins ${names.join(", ")}; ${budget.failure() ?? "no resource failure"}; ` +
      `initialized=${JSON.stringify(initialized)}; query steps=${queryWork.join(",")}; usage=${JSON.stringify(after)}`);
    assert.equal(budget.failure() === undefined, true);
  };
  return { budget, expect, steps: () => steps };
}

for (const count of [8, 16, 32]) {
  test(`${count} independently selected local writers require linear invocation work`, () => {
    const current = fixture(`
      function update(first: object, second: object): object { let value = first; value = second; return value; }
      ${Array.from({ length: count }, (_, index) => `const before${index} = {}; const after${index} = {};
        const result${index} = update(before${index}, after${index});`).join("\n")}
    `, { maximumSteps: 512 * count + 2048 });
    for (let index = 0; index < count; index += 1) current.expect(`result${index}`, [`before${index}`, `after${index}`]);
    assert.equal(current.steps() <= 512 * count + 2048, true, "one exact activation does not search every other invocation");
  });
}

for (const reverse of [false, true]) for (const binding of ["let value = seed;", ""]) {
  test(`same-region local and parameter writes retain independent entries (${reverse}, ${binding.length})`, () => {
    const current = fixture(`
      function update(${binding === "" ? "value" : "seed"}: object, replacement: object): object {
        ${binding}
        value = replacement;
        return value;
      }
      const left = {}; const leftNext = {}; const right = {}; const rightNext = {};
      const first = update(left, leftNext); const second = update(right, rightNext);
    `);
    for (const [name, originals] of reverse
      ? [["second", ["right", "rightNext"]], ["first", ["left", "leftNext"]]]
      : [["first", ["left", "leftNext"]], ["second", ["right", "rightNext"]]]) current.expect(name, originals);
  });
}

test("a recursive local writer retains the actual entry without importing a separate recursion", () => {
  const current = fixture(`
    declare const stop: boolean;
    function update(seed: object, replacement: object): object {
      let value = seed;
      value = replacement;
      return stop ? value : update(seed, replacement);
    }
    const left = {}; const leftNext = {}; const right = {}; const rightNext = {};
    const first = update(left, leftNext); const second = update(right, rightNext);
  `);
  current.expect("first", ["left", "leftNext"]);
  current.expect("second", ["right", "rightNext"]);
});

test("a local write captured by a returned reader uses its creator, not the reader's caller", () => {
  const current = fixture(`
    function create(seed: object, replacement: object) {
      let value = seed;
      value = replacement;
      return () => value;
    }
    const left = {}; const leftNext = {}; const right = {}; const rightNext = {};
    const readLeft = create(left, leftNext); const readRight = create(right, rightNext);
    function invoke(read: () => object): object { return read(); }
    const first = invoke(readLeft); const second = invoke(readRight);
  `);
  current.expect("first", ["left", "leftNext"]);
  current.expect("second", ["right", "rightNext"]);
});

test("writes from an uninvoked nested body do not become same-activation writes", () => {
  const current = fixture(`
    const forbidden = {};
    function create(seed: object, replacement: object): object {
      let value = seed;
      value = replacement;
      function neverCalled(): void { value = forbidden; }
      return value;
    }
    const original = {}; const replacement = {};
    const selected = create(original, replacement);
  `);
  current.expect("selected", ["original", "replacement"]);
});

test("an escaped nested writer remains execution-qualified and isolated from an equal-input creator", () => {
  const current = fixture(`
    function create(seed: object, replacement: object) {
      let value = seed;
      value = replacement;
      return { read: () => value, write: (next: object) => { value = next; } };
    }
    const original = {}; const replacement = {}; const written = {};
    const first = create(original, replacement); const second = create(original, replacement);
    first.write(written);
    const firstResult = first.read(); const secondResult = second.read();
  `);
  current.expect("firstResult", ["original", "replacement", "written"]);
  current.expect("secondResult", ["original", "replacement"]);
});

test("module binding writes retain their module region without executing an uncalled writer", () => {
  const current = fixture(`
    const original = {}; const replacement = {}; const forbidden = {};
    let value = original;
    value = replacement;
    function neverCalled(): void { value = forbidden; }
    function read(): object { return value; }
    const selected = read();
  `);
  current.expect("selected", ["original", "replacement"]);
});
