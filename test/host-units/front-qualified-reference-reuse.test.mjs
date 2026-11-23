import assert from "node:assert/strict";
import { test } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("one capture reuses completed source references without conflating identical foreign node numbers", async () => {
  const fixture = await loadFrontFixture();
  const box = "export interface Box<T> { readonly value: T; }";
  const snapshot = fixture.projectSnapshot({
    sourceFiles: {
      "main.ts": `
        import { Box as Left } from "./left";
        import { Box as Right } from "./right";
        export type Uses = { first: Left<boolean>; second: Left<boolean>; third: Right<boolean>; fourth: Right<boolean>; };
      `,
      "left.ts": box,
      "right.ts": box,
    },
    libraries: [{ name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent }],
  });
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const { deps, program, set } = fixture.openAndCapture(snapshot);
  const checked = OpenedProgram.checked(program);
  const { ast } = checked;
  const foreign = ["src/left.ts", "src/right.ts"].map(path => {
    const module = fixture.moduleOf(fixture.packageOf("/project"), path);
    const file = OpenedProgram.file(program, module).file;
    const declaration = ast.children(file).find(node => ast.kindName(node) === "KindInterfaceDeclaration");
    return { module, file, declaration, binder: ast.typeParameters(declaration)[0] };
  });
  assert.equal(foreign[0].declaration !== foreign[1].declaration && foreign[0].binder !== foreign[1].binder, true);
  const watched = foreign.flatMap(item => [item.declaration, item.binder]);
  const reads = new Map();
  const observed = OpenedProgram.create({ ...checked, ast: { ...ast, getSourceFile(node) {
    if (watched.includes(node)) reads.set(node, (reads.get(node) ?? 0) + 1);
    return ast.getSourceFile(node);
  } } }, OpenedProgram.table(program), set.modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  const capture = () => fixture.front.captureModule(deps, observed, snapshot.entryPoint);
  const first = capture();
  assert.equal(first.kind, "ok");
  assert.deepEqual(watched.map(node => reads.get(node)), [1, 1, 1, 1]);
  const references = foreign.map(item => {
    const { numbering } = OpenedProgram.syntax(observed).get(ast.getFileName(item.file)).outcome;
    return {
      declaration: { module: item.module, node: numbering.ids.get(item.declaration) },
      binder: { module: item.module, node: numbering.ids.get(item.binder) },
    };
  });
  assert.equal(references[0].declaration.node, references[1].declaration.node);
  assert.equal(references[0].binder.node, references[1].binder.node);
  for (const expected of references) {
    const actual = first.value.types.types.map(row => row.form).filter(form =>
      form.kind === "available" && form.value.kind === "declared" && form.value.declaration.module === expected.declaration.module);
    assert.ok(actual.length >= 2);
    assert.equal(actual.every(form => form.value.declaration.node === expected.declaration.node &&
      form.value.parameters.length === 1 && form.value.parameters[0].node === expected.binder.node &&
      form.value.parameters[0].module === expected.binder.module), true);
  }
  const second = capture();
  assert.equal(second.kind, "ok");
  assert.equal(isDeepStrictEqual(second.value, first.value), true, "capture retains the same complete raw rows");
  assert.deepEqual(watched.map(node => reads.get(node)), [2, 2, 2, 2]);
});
