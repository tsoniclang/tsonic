import assert from "node:assert/strict";
import { test } from "node:test";
import { loadFrontFixture } from "./fixtures/front/checked-module.mjs";

test("captured constraints retain each merged interface fragment's actual type parameter declaration", async () => {
  assert.equal(process.env.TSONIC_TEST_ADMISSION !== undefined, true);
  const fixture = await loadFrontFixture();
  const libraries = [
    { name: "lib.es5.d.ts", text: fixture.sdk.barebonesLibContent +
      "\ninterface Array<T> { first<S extends T>(input: S): S; }\ndeclare var items: Array<boolean>;\n" },
    { name: "lib.es2023.array.d.ts", text: "interface Array<T> { second<S extends T>(input: S): S; }\n" },
  ];
  const snapshot = fixture.projectSnapshot({ sourceFiles: { "main.ts": "export type Environment = typeof globalThis;\n" }, libraries });
  const { captured, deps, opened } = fixture.captureModulesOf(snapshot);
  const { program } = opened;
  const { OpenedProgram } = await import("../../packages/host/dist/front/handles.js");
  const checked = OpenedProgram.checked(program);
  const groups = [];
  const selected = [];
  for (const [index, library] of libraries.entries()) {
    const moduleId = fixture.moduleOf(fixture.packageOf("/checker"), library.name);
    const { module, raw, definitions } = captured.find(entry => entry.module === moduleId);
    const methodName = index === 0 ? "first" : "second";
    const syntax = raw.tree.statements.nodes.find(node => node.kind === "InterfaceDeclaration"
      && node.members.nodes.some(member => member.name?.text === methodName));
    const parameter = syntax.typeParameters.nodes[0];
    const constraint = syntax.members.nodes[0].typeParameters.nodes[0].constraint;
    const numbering = OpenedProgram.syntax(program).get("/checker/" + library.name).outcome.numbering;
    const checker = checked.getSourceFileQueries(OpenedProgram.file(program, module).file).checker;
    const source = numbering.nodes[constraint.id];
    const symbol = checker.getTypeSymbol(checker.getTypeFromTypeNode(source).type);
    const group = checker.getSymbolDeclarations(symbol);
    assert.equal(group.length, 3, "the test exercises a native merged parameter, not two independent symbols");
    assert.equal(group.includes(numbering.nodes[parameter.id]), true);
    groups.push(group);
    const rows = captured.flatMap(entry => entry.raw.types.types).filter(type =>
      type.authoredTypeNode?.module === module && type.authoredTypeNode.node === constraint.id);
    assert.ok(rows.length > 1, "the actual cross-module type graph captures the original constraint too");
    const definition = definitions.rows.find(row => row.node === parameter.id);
    assert.equal(definition?.kind, "TypeParameter");
    for (const row of rows) {
      assert.deepEqual(row.form, { kind: "available", value: { kind: "parameter",
        parameter: { module, node: parameter.id }, constraint: null, default: null } });
      assert.equal(deps.definitionOf(row.form.value.parameter), definition.definition);
    }
    selected.push(definition.definition);
  }
  assert.equal(groups[0].every(declaration => groups[1].includes(declaration)), true, "both checkers retain the same genuine merged group");
  assert.notEqual(selected[0], selected[1], "the checker merge must not collapse the authored F1 identities");
  const main = fixture.moduleOf(fixture.packageOf("/project"), "src/main.ts");
  const raw = captured.find(entry => entry.module === main).raw;
  const imported = raw.types.types.filter(row => row.authoredTypeNode !== null && row.authoredTypeNode.module !== main
    && row.form.kind === "available" && row.form.value.kind === "parameter"
    && selected.includes(deps.definitionOf(row.form.value.parameter)));
  assert.ok(imported.length >= 2, "the same capture needs the merged owner index for more than one use");
  const declarations = new Set(groups[0]);
  const reads = [];
  const observed = OpenedProgram.create({ ...checked, ast: { ...checked.ast, parent(node) {
    if (declarations.has(node)) reads.push(node);
    return checked.ast.parent(node);
  } } }, OpenedProgram.table(program), OpenedProgram.modules(program).modules.map(entry =>
    OpenedProgram.file(program, entry.kind === "snapshot" ? entry.module : entry.document.module)),
  OpenedProgram.libraryData(program), OpenedProgram.contributions(program));
  const repeated = fixture.front.captureModule(opened.deps, observed, main);
  assert.equal(repeated.kind, "ok");
  assert.equal(reads.length, declarations.size, "one owner-index read per actual merged declaration, not per use");
  assert.equal(new Set(reads).size, declarations.size);
});
