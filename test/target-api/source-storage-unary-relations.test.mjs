import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery, defaultSourceStorageLimits } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file], { ...defaultSourceStorageLimits, maximumSteps: 131_072 });
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  return (name, expected) => {
    const subject = storage.subjectFor(initializer(name));
    assert.equal(subject.kind === "resolved", true, name);
    const result = storage.closedOriginsFor(subject.subject);
    assert.equal(result.kind === "complete", true, `${name}: ${storage.failureReason() ?? result.reason ?? result.kind}`);
    assert.equal(result.origins.length === expected.length && expected.every(original =>
      result.origins.some(origin => origin.subject.node === initializer(original))), true,
    `${name}: exact producers ${expected.join(", ")}`);
    assert.equal(storage.failureReason() === undefined, true, "unchanged finite guards");
  };
}

for (const read of ["current.read()", 'current["read"]()']) for (const reverse of [false, true]) {
  test(`independent nominal and method selection shares recursive relations (${read}; ${reverse})`, () => {
    const count = 8;
    const expect = fixture(`
      declare const stop: boolean;
      class Value { readonly brand = 1; }
      ${Array.from({ length: count }, (_, index) => `class Variant${index} extends Value {
        constructor(readonly value: object) { super(); }
        read(): object { return this.value; }
      }`).join("\n")}
      function resolve(value: Value): Value {
        let current = value;
        ${Array.from({ length: count }, (_, index) => `${index === 0 ? "" : "else "}if (current instanceof Variant${index})
          current = new Variant${(index + 1) % count}(${read});`).join("\n")}
        return current;
      }
      function descend(value: Value): Value { return stop ? value : descend(resolve(value)); }
      function pipeline(token: object): object {
        const value = descend(new Variant0(token));
        ${Array.from({ length: count }, (_, index) => `if (value instanceof Variant${index}) return value.read();`).join("\n")}
        return token;
      }
      const left = {}; const right = {};
      const first = pipeline(left); const second = pipeline(right);
    `);
    const selections = [["first", "left"], ["second", "right"]];
    for (const [name, original] of reverse ? selections.reverse() : selections) expect(name, [original]);
  });
}

for (const access of ["first.read(left)", 'first["read"](left)']) {
  test(`independent method selection does not split a correlated receiver/argument tuple (${access})`, () => {
    const expect = fixture(`
      declare const stop: boolean;
      interface Pair { left: object; right: object; }
      interface Reader { read(pair: Pair): object; }
      class Left implements Reader { read(pair: Pair): object { return pair.left; } }
      class Right implements Reader { read(pair: Pair): object { return pair.right; } }
      function rotate(first: Reader, second: Reader, left: Pair, right: Pair): object {
        return stop ? ${access} : rotate(second, first, right, left);
      }
      const original = {}; const forbidden = {}; const separate = {};
      const first = rotate(new Left(), new Right(),
        { left: original, right: forbidden }, { left: forbidden, right: original });
      const second = rotate(new Left(), new Right(),
        { left: separate, right: forbidden }, { left: forbidden, right: separate });
    `);
    expect("first", ["original"]);
    expect("second", ["separate"]);
  });
}
