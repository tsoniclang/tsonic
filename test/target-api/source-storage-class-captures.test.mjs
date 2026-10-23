import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, Node_Initializer } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": `export {}; ${body}` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length === 0, true, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const initializer = name => Node_Initializer(source.ast, namedVariable(source.ast, file, name));
  const expect = (name, original) => {
    const selected = storage.subjectFor(initializer(name));
    assert.equal(selected.kind === "resolved", true, `${name}: exact checked result subject`);
    const origins = storage.closedOriginsFor(selected.subject);
    assert.equal(origins.kind === "complete", true, `${name}: ${origins.reason ?? origins.kind}`);
    assert.equal(origins.origins.length === 1 && origins.origins[0].subject.node === initializer(original), true,
      `${name}: only the callback belonging to the constructed class activation`);
    assert.equal(storage.failureReason() === undefined, true, "exact finite scoped producer evidence");
  };
  return { expect, source, storage, initializer };
}

test("an external class factory does not acquire a checked local class activation", () => {
  const current = fixture(`
    interface Factory { new(value: object): { readonly value: object }; }
    declare const imported: Factory;
    const original = {};
    const first = new imported(original);
    const result = first.value;
  `);
  const subject = current.storage.subjectFor(current.initializer("result"));
  assert.equal(subject.kind === "resolved", true, "checked external member subject");
  assert.equal(current.storage.closedOriginsFor(subject.subject).kind === "unresolved", true,
    "an external constructor never invents local capture or parameter correspondence");
});

for (const indirect of [false, true]) for (const reverse of [false, true]) {
  test(`captured generic class callbacks retain their construction's activation (${indirect}, ${reverse})`, () => {
    const current = fixture(`
      abstract class Base { abstract read(): object; }
      interface Factory<Value> { new(value: Value): Base & { readonly value: Value }; }
      function factory<Value>(select: (value: Value) => object): Factory<Value> {
        return class Selected extends Base {
          constructor(readonly value: Value) { super(); }
          read(): object { return select(this.value); }
        };
      }
      function invoke(value: Base): object { return value.read(); }
      const original = {}; const separate = {};
      const numberArgument = 4; const textArgument = "native";
      const numeric = factory<number>(value => { const numericInput = value; return original; });
      const text = factory<string>(value => { const textInput = value; return separate; });
      const first = new numeric(numberArgument); const second = new text(textArgument);
      const result = ${indirect ? "invoke(first)" : "first.read()"};
      const untouched = ${indirect ? "invoke(second)" : "second.read()"};
    `);
    for (const [name, original] of reverse ? [["untouched", "separate"], ["result", "original"]]
      : [["result", "original"], ["untouched", "separate"]]) current.expect(name, original);
    current.expect("numericInput", "numberArgument");
    current.expect("textInput", "textArgument");
  });
}
