import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics } from "@tsonic/tsts";
import { createTargetSourceProgram, createSourceArrayDensityQuery } from "../../packages/target-api/dist/public/source.js";
import { jsArrayMemberEffect } from "../../packages/js-source-profile/dist/index.js";

test("array effect declarations require exact owners and own member rows", () => {
  assert.equal(jsArrayMemberEffect(undefined), undefined);
  assert.equal(jsArrayMemberEffect({ ownerName: "UserArray", memberName: "push" }), undefined);
  assert.equal(jsArrayMemberEffect({ ownerName: "Array", memberName: "constructor" }), undefined);
  assert.equal(jsArrayMemberEffect({ ownerName: "Array", memberName: "unknown" }), undefined);
  assert.equal(jsArrayMemberEffect({ ownerName: "Array", memberName: "from" }), undefined);
  assert.deepEqual(jsArrayMemberEffect({ ownerName: "ArrayConstructor", memberName: "from" }), { kind: "copy" });
  const effect = jsArrayMemberEffect({ ownerName: "Array", memberName: "forEach" });
  assert.deepEqual(effect, { kind: "method", callbackReceiverIndex: 2 });
  assert.ok(Object.isFrozen(effect));
});

for (const [name, preparation, expected] of [
  ["literal", "const values = [1, 2];", true],
  ["in-range overwrite", "const values = [1, 2]; values[0] = 8;", true],
  ["alias in-range overwrite", "const values = [1, 2]; const alias = values; alias[1] = 8;", true],
  ["out-of-range overwrite", "const values = [1, 2]; values[4] = 8;", false],
  ["overwrite after shrink", "const values = [1, 2]; values.pop(); values.pop(); values[1] = 8;", false],
  ["overwrite after alias shrink", "const values = [1, 2]; const alias = values; alias.pop(); values[1] = 8;", false],
  ["deletion at in-range index", "const values = [1, 2]; delete values[0];", false],
  ["push", "const values: number[] = []; values.push(1);", true],
  ["alias deletion", "const values = [1, 2]; const alias = values; delete alias[0];", false],
  ["length expansion", "const values = [1]; values.length = 3;", false],
  ["literal hole", "const values: (number | undefined)[] = [1, , 2];", false],
  ["array length construction", "const values = new Array<number>(2);", false],
  ["unknown escape", "declare function escape(values: number[]): void; const values = [1]; escape(values);", false],
  ["callback receiver mutation", "const values = [1]; values.forEach((_value, _index, alias) => { delete alias[0]; });", false],
]) {
  test(`shared array density: ${name}`, () => {
    const checked = inspect(`${preparation} const output = Array.from(values); export { output };`);
    assert.deepEqual(checked.results, [expected]);
  });
}

test("shared density follows exact aliases and fresh project-returned arrays", () => {
  assert.deepEqual(inspect(`
function fresh(): number[] { const result: number[] = []; result.push(1); return result; }
const original = fresh();
const values = original;
const output = Array.from(values);
export { output };
`).results, [true]);
});

test("shared density distinguishes closed calls from open exported signatures", () => {
  const text = `
export function copy<T>(values: T[]): T[] { return Array.from(values); }
export const output = copy([1, 2]);
`;
  assert.deepEqual(inspect(text, true).results, [true]);
  assert.deepEqual(inspect(text, false).results, [false]);
});

test("missing selected member identity cannot prove a copy non-mutating", () => {
  assert.deepEqual(inspect("const values = [1]; const output = Array.from(values);", false, true).results, [false]);
});

test("shared density follows closed cross-file calls without treating imports as escapes", () => {
  const files = { "/src/copy.ts": "export function copy(values: readonly number[]): number[] { return Array.from(values); }" };
  const text = 'import { copy as clone } from "./copy.js"; const values = [1, 2]; export const output = clone(values);';
  assert.deepEqual(inspect(text, true, false, files).results, [true]);
  assert.deepEqual(inspect(text, false, false, files).results, [false]);
});

test("a cached safe alias cannot hide a shrink from an indexed write proof", () => {
  assert.deepEqual(inspect(`
const values = [1, 2];
const alias = values;
alias.pop();
values[1] = 8;
const first = Array.from(alias);
const second = Array.from(values);
export { first, second };
`).results, [false, false]);
});

function inspect(text, closed = false, omitIdentity = false, files = {}) {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/index.ts": text, ...files },
    compilerOptions: { strict: true, target: "esnext", module: "esnext" },
  }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const { ast } = source;
  const identities = new Map();
  for (const library of source.sourceFiles.filter(candidate => ast.isDeclarationFile(candidate))) {
    const visit = node => {
      if (ast.is.IsInterfaceDeclaration(node)) {
        const ownerName = ast.text(ast.name(node));
        if (ownerName === "Array" || ownerName === "ReadonlyArray" || ownerName === "ArrayConstructor") {
          for (const member of ast.members(node)) {
            const name = member === undefined ? undefined : ast.name(member);
            if (name !== undefined && ast.is.IsIdentifier(name)) {
              identities.set(member, { ownerName, memberName: ast.text(name) });
            }
          }
        }
      }
      ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
    };
    visit(library);
  }
  const query = createSourceArrayDensityQuery(source, {
    closedSourceFiles: new Set(closed ? source.navigation.sourceFiles : []),
    memberEffect: declaration => jsArrayMemberEffect(omitIdentity ? undefined : identities.get(declaration)),
  });
  const results = [];
  const visit = node => {
    if (ast.is.IsCallExpression(node)) {
      const call = source.semantics.forNode(node).operations.call(node);
      const signature = call === undefined ? undefined : source.semantics.forNode(node).declarations.signatureDeclaration(call.selectedSignature);
      const identity = identities.get(signature);
      if (identity?.ownerName === "ArrayConstructor" && identity.memberName === "from") {
        results.push(query.array(ast.arguments(node)[0]));
      }
    }
    ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  for (const sourceFile of source.navigation.sourceFiles) visit(sourceFile);
  assert.ok(Object.isFrozen(query));
  return { results };
}
