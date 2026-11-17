import assert from "node:assert/strict";
import test from "node:test";
import { getTargetCompilationPaths, resolveProjectPaths } from "../../packages/host/dist/index.js";
import { sourceObjectLiteralDestinationMember } from "../../packages/target-api/dist/public/source.js";
import { createCsharpTargetPack } from "../../../tsonic-csharp/dist/public/index.js";
import { checkSourceProgramFixture } from "./source-program-fixture.mjs";

test("optional union literal members retain exact selected destination declarations", () => {
  const targetPack = createCsharpTargetPack();
  const target = { id: "csharp", options: { outputType: "Library" } };
  const project = { entryPoint: "index.ts", rootDir: ".", targets: [target] };
  const paths = getTargetCompilationPaths(resolveProjectPaths({ projectFilePath: "/src/tsonic.json", project }), target);
  const checked = checkSourceProgramFixture({ project, projectDirectory: "/src", currentDirectory: "/src", target, targetPack, paths,
      selectedCapabilities: [], selectedSurfaces: [],
      compilerOptions: { strict: true, noLib: true, target: "es2022", module: "esnext" },
      files: { "/src/index.ts": `
        interface Count { readonly count: number; readonly note?: string; }
        declare function accept(value: Count | { text: string } | undefined): void;
        declare function requireCount(value: Count): void;
        accept({ note: "first", count: 7 });
        accept({ text: "other" });
        const sample: Count = { count: 1 };
        requireCount(sample);
      ` } });
  assert.equal(checked.kind, "resolved", checked.diagnostics.map(issue => issue.message).join("\n"));
  assert.equal(checked.diagnostics.length, 0, "the original program has no checker, extension, or Source-composition diagnostic");
  const source = checked.value;
  const file = source.sourceFiles.find(node => source.ast.getFileName(node) === "/src/index.ts");
  assert.ok(file);
  const declarations = source.ast.statements(file).filter(source.ast.is.IsInterfaceDeclaration);
  assert.equal(declarations.length, 1);
  const pending = [file];
  const nodes = [];
  while (pending.length > 0) {
    const node = pending.pop();
    nodes.push(node);
    pending.push(...source.ast.children(node).filter(child => child !== undefined));
  }
  const sample = nodes.find(node => source.ast.is.IsVariableDeclaration(node) && source.ast.text(source.ast.name(node)) === "sample");
  assert.ok(sample);
  const slot = source.facts.values.declaredSlot(sample);
  assert.equal(slot.kind, "resolved");
  const destination = slot.value.type;
  let count = 0;
  let unrelated = 0;
  for (const node of nodes) {
    if (!source.ast.is.IsPropertyAssignment(node)) continue;
    const literal = source.ast.parent(node);
    assert.equal(source.ast.is.IsObjectLiteralExpression(literal), true);
    const value = source.facts.values.type(literal);
    assert.equal(value.kind, "resolved");
    const selected = sourceObjectLiteralDestinationMember(node, value.value, destination, source.facts.objects);
    assert.equal(selected.kind, "resolved");
    if (source.ast.text(source.ast.name(node)) === "text") {
      assert.equal(selected.value.kind, "none", "a missing required destination member rejects");
      unrelated++;
      continue;
    }
    assert.equal(selected.value.kind, "present", "every present destination member is exact");
    const member = selected.value.value;
    assert.equal(member.declarations.length, 1);
    assert.equal(source.ast.parent(member.declarations[0]) === declarations[0], true, "destination belongs to its exact interface");
    assert.equal(Object.isFrozen(member), true);
    const correspondence = source.facts.objects.correspondence(value.value, destination, "correspondence");
    assert.equal(correspondence.kind, "resolved");
    assert.equal(correspondence.value.kind, "available");
    const pair = correspondence.value.members.find(pair => pair.kind === "present" && pair.destination === member);
    assert.ok(pair);
    const ambiguous = { ...source.facts.objects, correspondence: (...arguments_) => {
      assert.equal(arguments_[2], "correspondence", "literal declaration identity is not a read operation");
      return { kind: "resolved", value: { ...correspondence.value, members: [...correspondence.value.members, pair] } };
    } };
    assert.equal(sourceObjectLiteralDestinationMember(node, value.value, destination, ambiguous).value.kind, "none");
    assert.equal(sourceObjectLiteralDestinationMember(file, value.value, destination, source.facts.objects).value.kind, "none");
    count++;
  }
  assert.equal(count, 3);
  assert.equal(unrelated, 1);
});
