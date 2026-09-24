import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, formatDiagnostics, type Node } from "@tsonic/tsts";
import { createTargetSourceProgram } from "../public/source.js";

function inspect(sourceText: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: { "/src/index.ts": sourceText },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.equal(formatDiagnostics(checked.diagnostics.filter(value => value !== undefined), "/src"), "");
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const results = [];
  const pending: Node[] = [file];
  while (pending.length > 0) {
    const node = pending.pop()!;
    if (source.ast.is.IsCallExpression(node)) {
      const call = semantics.operations.call(node);
      const argument = call?.sourceArguments[0];
      const declaration = argument === undefined ? undefined : source.navigation.referenceFor(argument.expression)?.declaration;
      const declared = declaration === undefined ? undefined : semantics.declarations.declaredValueType(declaration);
      if (declared !== undefined && argument?.type !== undefined) {
        results.push({ result: semantics.types.refinement(declared, argument.type), declared, selected: argument.type });
      }
    }
    source.ast.forEachChild(node, child => { if (child !== undefined) pending.push(child); });
  }
  return { results, semantics };
}

test("generic undefined exclusion retains the exact declared non-absent member", () => {
  const { results, semantics } = inspect(`
    declare function observe<T>(value: T): void;
    function read<T>(value: T | undefined): void { if (value !== undefined) observe(value); }
  `);
  assert.equal(results.length, 1);
  const entry = results[0]!;
  assert.equal(entry.result.kind, "members");
  if (entry.result.kind !== "members") return;
  const members = semantics.types.unionOrIntersectionTypes(entry.declared).filter(type => !semantics.types.isNullish(type));
  assert.deepEqual(entry.result.types, members);
  assert.ok(Object.isFrozen(entry.result.types));
});

test("numeric literals retain their declared primitive member, not a new carrier", () => {
  const { results, semantics } = inspect(`
    declare function observe(value: bigint): void;
    function read(value: bigint | undefined): void { if (value === 0n) observe(value); }
  `);
  assert.equal(results.length, 1);
  const entry = results[0]!;
  assert.equal(entry.result.kind, "members");
  if (entry.result.kind !== "members") return;
  assert.deepEqual(entry.result.types, semantics.types.unionOrIntersectionTypes(entry.declared).filter(type => !semantics.types.isNullish(type)));
});

test("an intersection with two possible source members remains ambiguous", () => {
  const { results, semantics } = inspect(`
    interface Left { left: string; }
    interface Right { right: string; }
    declare function observe(value: Left | Right): void;
    function inspect(value: Left | Right, selected: Left & Right): void { observe(value); observe(selected); }
  `);
  const union = results.find(entry => semantics.types.isUnion(entry.declared));
  const intersection = results.find(entry => semantics.types.isIntersection(entry.declared));
  assert.ok(union && intersection);
  assert.deepEqual(semantics.types.refinement(union.declared, intersection.declared), { kind: "ambiguous" });
  const unrelated = semantics.types.propertyInfos(intersection.declared)[0]?.type;
  assert.ok(unrelated);
  assert.deepEqual(semantics.types.refinement(union.declared, unrelated), { kind: "unrelated" });
});
