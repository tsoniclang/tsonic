import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Node, type Type } from "@tsonic/tsts";
import { createTargetSourceProgram } from "./target-source-program.js";
import { selectSourceGuardedTypeMembers } from "./value-flow-conditions.js";
import { selectedSourcePropertyDeclarations } from "./selected-property-declarations.js";

function fixture(body: string) {
  const checked = createCompilerSessionFromFiles({ currentDirectory: "/src", files: {
    "/src/index.ts": `
      declare function isArray(value: unknown): value is unknown[];
      declare function observe(value: unknown): void;
      function run(value: string | readonly string[] | undefined, other: string): void { ${body} }
    `,
  }, compilerOptions: { strict: true, target: "es2022", module: "esnext" } }).checkSource();
  assert.deepEqual(checked.diagnostics, []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createTargetSourceProgram(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const reads: Node[] = [];
  const properties: Node[] = [];
  const visit = (node: Node): void => {
    const call = source.semantics.forNode(node).operations.call(node);
    if (call !== undefined && source.ast.text(call.sourceCallee.expression) === "observe") {
      assert.ok(call.sourceArguments[0]);
      reads.push(call.sourceArguments[0].expression);
    }
    if (source.ast.is.IsPropertyAccessExpression(node)) properties.push(node);
    source.ast.forEachChild(node, child => { if (child !== undefined) visit(child); });
  };
  visit(file);
  const context = { ast: source.ast, navigation: source.navigation, sourceFacts: source.sourceFacts,
    semanticsFor: (node: Node) => source.semantics.forNode(node) };
  const select = (reference: Node, sourceType?: Type) => {
    const semantics = source.semantics.forNode(reference);
    const type = sourceType ?? semantics.types.expressionType(reference);
    assert.ok(type);
    return selectSourceGuardedTypeMembers(context, reference, type, expression => {
      const call = source.semantics.forNode(expression).operations.call(expression);
      return call !== undefined && source.ast.text(call.sourceCallee.expression) === "isArray" && call.sourceArguments[0] !== undefined
        ? { sourceOperand: call.sourceArguments[0].expression, predicate: "array" as const } : undefined;
    }, member => semantics.types.isStringLike(member) || semantics.types.isNullish(member) ? false :
      semantics.types.isArrayLike(member) ? true : undefined);
  };
  return { source, reads, properties, select };
}

test("guarded source intersections retain exact array contributors, not impossible native string members", () => {
  const current = fixture("if (isArray(value)) { observe(value); observe(value.length); const unrelated = { count: 1 }; observe(unrelated); }");
  const read = current.reads[0]!;
  const semantics = current.source.semantics.forNode(read);
  const checkedType = semantics.types.expressionType(read);
  assert.ok(checkedType && semantics.types.isUnion(checkedType));
  const types = current.select(read);
  assert.ok(types?.length === 1 && Object.isFrozen(types));
  assert.ok(semantics.types.isIntersection(types[0]!));
  const property = semantics.operations.propertyAccess(current.properties[0]!);
  assert.ok(property);
  const all = selectedSourcePropertyDeclarations(semantics, property.selectedDeclaration, property.selectedSymbol);
  const selected = selectedSourcePropertyDeclarations(semantics, property.selectedDeclaration, property.selectedSymbol, types);
  assert.ok(all && selected && selected.length > 0 && selected.length < all.length && Object.isFrozen(selected));
  assert.ok(selected.every(declaration => all.includes(declaration)));
  assert.equal(selectedSourcePropertyDeclarations(semantics, property.selectedDeclaration, property.selectedSymbol, []), undefined);
  assert.equal(selectedSourcePropertyDeclarations(semantics, undefined, undefined, types), undefined);
  const unrelated = semantics.types.expressionType(current.reads[2]!);
  assert.ok(unrelated);
  assert.equal(selectedSourcePropertyDeclarations(semantics, undefined, property.selectedSymbol, [unrelated]), undefined);
});

test("guarded source contributor selection rejects intervening reassignment and non-dominating guards", () => {
  for (const body of [
    "if (isArray(value)) { value = other; observe(value); }",
    "if (isArray(value)) return; observe(value);",
    "observe(value); if (isArray(value)) return;",
  ]) {
    const current = fixture(body);
    const selected = current.select(current.reads[0]!);
    if (body.startsWith("if (isArray(value)) return")) {
      assert.ok(selected?.every(type => !current.source.semantics.forNode(current.reads[0]!).types.isArrayLike(type)));
    } else assert.equal(selected, undefined, body);
  }
});

test("guarded source contributors preserve unknown premises and reject accounting exhaustion", () => {
  const current = fixture("if (isArray(value)) observe(value);");
  const read = current.reads[0]!;
  const semantics = current.source.semantics.forNode(read);
  const checkedType = semantics.types.expressionType(read);
  assert.ok(checkedType && semantics.types.isUnion(checkedType));
  const original = semantics.types.unionOrIntersectionTypes(checkedType);
  const large = { ...checkedType } as Type;
  const types = { ...semantics.types, isUnion: (type: Type) => type === large || semantics.types.isUnion(type),
    unionOrIntersectionTypes: (type: Type) => type === large ? Array.from({ length: 2_049 }, () => original[0]!) :
      semantics.types.unionOrIntersectionTypes(type) };
  const context = { ast: current.source.ast, navigation: current.source.navigation,
    sourceFacts: current.source.sourceFacts, semanticsFor: () => ({ ...semantics, types }) };
  const selected = selectSourceGuardedTypeMembers(context, read, large, expression => {
    const call = semantics.operations.call(expression);
    return call?.sourceArguments[0] === undefined ? undefined : { sourceOperand: call.sourceArguments[0].expression, predicate: true };
  }, () => undefined);
  assert.equal(selected, undefined);
  const contextWithoutLimit = { ...context, semanticsFor: () => semantics };
  const unknown = selectSourceGuardedTypeMembers(contextWithoutLimit, read, checkedType, expression => {
    const call = semantics.operations.call(expression);
    return call?.sourceArguments[0] === undefined ? undefined : { sourceOperand: call.sourceArguments[0].expression, predicate: true };
  }, () => undefined);
  assert.equal(unknown?.length, original.length);
  assert.ok(Object.isFrozen(unknown));
  assert.ok(unknown?.every((type, index) => type === original[index]));
  for (const depth of [32, 2_049]) {
    const nested: Type[] = Array.from({ length: depth }, (): Type => ({ ...checkedType } as Type));
    const children: ReadonlyMap<Type, Type> = new Map(nested.map((type, index) => [type, nested[index + 1] ?? original[0]!]));
    const nestedTypes = { ...semantics.types,
      unionOrIntersectionTypes: (type: Type): readonly Type[] => children.has(type) ? [children.get(type)!] :
        semantics.types.unionOrIntersectionTypes(type) };
    const selected = selectSourceGuardedTypeMembers({ ...context, semanticsFor: () => ({ ...semantics, types: nestedTypes }) },
      read, nested[0]!, expression => {
        const call = semantics.operations.call(expression);
        return call?.sourceArguments[0] === undefined ? undefined : { sourceOperand: call.sourceArguments[0].expression, predicate: true };
      }, () => undefined);
    assert.equal(selected?.length, depth === 32 ? 1 : undefined);
    if (selected !== undefined) assert.equal(selected[0], nested[1]);
  }
  const cyclicTypes = { ...semantics.types,
    unionOrIntersectionTypes: (type: Type) => type === large ? [large] : semantics.types.unionOrIntersectionTypes(type) };
  assert.equal(selectSourceGuardedTypeMembers({ ...context, semanticsFor: () => ({ ...semantics, types: cyclicTypes }) },
    read, large, expression => {
      const call = semantics.operations.call(expression);
      return call?.sourceArguments[0] === undefined ? undefined : { sourceOperand: call.sourceArguments[0].expression, predicate: true };
    }, () => undefined), undefined);
});
