import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../../packages/target-api/dist/public/source.js";
import { createSourceStorageQuery } from "../../packages/target-api/dist/public/analysis.js";
import { namedVariable, requiredNode } from "../fixtures/source-navigation.mjs";

function fixture(body) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `export {}; ${body}`,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(checked.diagnostics.length, 0, formatDiagnostics(checked.diagnostics));
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  const storage = createSourceStorageQuery(source, [file]);
  const select = name => {
    const subject = storage.subjectFor(namedVariable(source.ast, file, name));
    assert.equal(subject.kind, "resolved", `exact ${name}`);
    const result = storage.closedOriginsFor(subject.subject);
    assert.notEqual(result.kind, "unresolved", result.kind === "unresolved" ? result.reason : name);
    return result;
  };
  return { source, file, storage, select };
}

for (const initializer of ["{}", "{ value: 1 }", "new Token()"])
  test(`initializer summaries retain separate physical births and exposed slots for ${initializer}`, () => {
    const current = fixture(`class Token { value = 1; }
      class Holder { token = ${initializer}; }
      export const published = new Holder();
      const privateHolder = new Holder();
      const publicValue = published.token;
      const privateValue = privateHolder.token;`);
    const exposed = current.select("publicValue");
    const hidden = current.select("privateValue");
    assert.equal(exposed.kind, "open", "the actual published slot is writable outside");
    assert.equal(hidden.kind, "complete", "a different creation does not inherit that exposure");
    assert.equal(hidden.origins.length, 1, "one exact private initializer allocation");
    const field = requiredNode(current.source.ast, current.file, node => current.source.ast.is.IsPropertyDeclaration(node) &&
      current.source.ast.text(current.source.ast.name(node)) === "token");
    const authored = current.source.ast.as.AsPropertyDeclaration(field).Initializer;
    assert.equal(hidden.origins[0].subject.node === authored, true, "original initializer allocation, not the containing instance");
    assert.equal(current.storage.failureReason(), undefined, "all identities remain inside the original resource budgets");
  });

test("initializer summaries retain parameter aliases and independent captured storage", () => {
  const current = fixture(`function factory(input: object) {
      class Holder { token = input; }
      return new Holder();
    }
    const first = {};
    const second = {};
    const left = factory(first);
    const right = factory(second);
    const alias = factory(first);
    const leftValue = left.token;
    const rightValue = right.token;
    const aliasValue = alias.token;`);
  const first = current.source.ast.as.AsVariableDeclaration(namedVariable(current.source.ast, current.file, "first")).Initializer;
  const second = current.source.ast.as.AsVariableDeclaration(namedVariable(current.source.ast, current.file, "second")).Initializer;
  for (const [name, expected] of [["leftValue", first], ["rightValue", second], ["aliasValue", first]]) {
    const selected = current.select(name);
    assert.equal(selected.kind, "complete", `${name}: exact captured domain`);
    assert.equal(selected.origins.length === 1 && selected.origins[0].subject.node === expected, true,
      `${name}: actual source input and alias identity`);
  }
});
