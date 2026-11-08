import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node } from "@tsonic/tsts";
import type { SourceRefusal } from "../public/source/contracts.js";
import { createSourceAdmissionFacts } from "./admission.js";

function fixture() {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      namespace RuntimeValue { export const value = 1; }
      interface Shape { readonly value: number; }
      type NamespaceShape = typeof RuntimeValue;
      declare function tag(parts: TemplateStringsArray): string;
      const value = tag\`sample\`;
      export = RuntimeValue;
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "commonjs" } }).checkSource();
  const file = checked.getSourceFile("/src/index.ts");
  if (file === undefined) throw new Error("The exact original Source file is required.");
  const originals = new Set<Node>();
  function visit(node: Node): void {
    originals.add(node);
    checked.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  }
  visit(file);
  const refusals = new Set<SourceRefusal>();
  const facts = createSourceAdmissionFacts({ ast: checked.ast,
    assertNode(node) { if (!originals.has(node)) throw new Error("The form query requires an exact original Node."); },
    observe(result) { if (result.kind === "refused") refusals.add(result); return result; } });
  function find(predicate: (node: Node) => boolean): Node {
    const selected = [...originals].find(predicate);
    if (selected === undefined) throw new Error("The exact original Source form is required.");
    return selected;
  }
  return { ast: checked.ast, facts, find, refusals };
}

test("runtime form admission is demand-only and does not ban type-only namespace or interface evidence", () => {
  const current = fixture();
  const typeQuery = current.find(current.ast.is.IsTypeQueryNode);
  const typeAlias = current.find(current.ast.is.IsTypeAliasDeclaration);
  const interfaceDeclaration = current.find(current.ast.is.IsInterfaceDeclaration);
  assert.equal(current.refusals.size, 0);
  for (const original of [typeQuery, typeAlias, interfaceDeclaration]) {
    const selected = current.facts.form(original);
    assert.equal(selected.kind === "resolved" && selected.value.kind === "supported", true);
  }
  assert.equal(current.refusals.size, 0, "unused unsupported runtime forms are not eagerly demanded");
  const cases = [
    [current.find(current.ast.is.IsModuleDeclaration), "Namespace declarations have no supported Source runtime value form."],
    [current.find(current.ast.is.IsTaggedTemplateExpression), "Tagged template expressions have no supported Source runtime application form."],
    [current.find(current.ast.is.IsExportAssignment), "Export-equals assignments have no supported Source module value form."],
  ] as const;
  for (const [original, message] of cases) {
    const selected = current.facts.form(original);
    assert.equal(selected.kind === "refused" && selected.source === "tsonic" && selected.code === "TSONIC_SOURCE_FORM_UNSUPPORTED" &&
      selected.site === original && selected.message === message && current.refusals.has(selected), true);
    assert.equal(current.facts.form(original) === selected && Object.isFrozen(selected), true);
  }
  assert.equal(current.refusals.size, 3);
});

test("runtime form ownership is authenticated before warm or cold memo lookup", () => {
  const current = fixture(), foreign = fixture();
  const original = current.find(current.ast.is.IsModuleDeclaration);
  const selected = current.facts.form(original);
  assert.equal(selected.kind, "refused");
  assert.throws(() => current.facts.form({ ...original }), /exact original Node/);
  assert.throws(() => current.facts.form(foreign.find(foreign.ast.is.IsModuleDeclaration)), /exact original Node/);
  assert.equal(current.facts.form(original) === selected, true);
});
