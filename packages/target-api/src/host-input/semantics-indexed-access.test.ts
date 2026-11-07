import { createHostSourceProgramFixture } from "../source-semantics/host-program-fixtures.js";
import assert from "node:assert/strict";
import test from "node:test";
import { createCompilerSessionFromFiles, type Type } from "@tsonic/tsts";

function sourceFixture() {
  const checked = createCompilerSessionFromFiles({
    currentDirectory: "/src",
    files: { "/src/model.ts": `export interface Model { count: number; label?: string; }`,
      "/src/index.ts": `
import type { Model } from "./model.js";
export type Item = Model;
export type Count = "count";
export type Label = "label";
export type Open<Source, Key extends keyof Source> = Source[Key];
` },
    compilerOptions: { strict: true, target: "es2022", module: "esnext" },
  }).checkSource();
  assert.deepEqual(checked.diagnostics.map(diagnostic => diagnostic?.code), []);
  assert.deepEqual(checked.extensionDiagnostics, []);
  const source = createHostSourceProgramFixture(checked);
  const file = checked.getSourceFile("/src/index.ts");
  assert.ok(file);
  const semantics = source.semantics.forFile(file);
  const aliases = new Map<string, Type>();
  // The object and index types of the open alias `Source[Key]`, read from its authored indexed-access syntax.
  let open: { readonly objectType: Type; readonly indexType: Type } | undefined;
  for (const declaration of source.ast.statements(file)) {
    if (declaration === undefined || !source.ast.is.IsTypeAliasDeclaration(declaration)) continue;
    const typeNode = source.ast.typeNode(declaration);
    const type = typeNode === undefined ? undefined : semantics.types.authoredType(typeNode);
    assert.ok(type);
    aliases.set(source.ast.text(source.ast.name(declaration)), type);
    const indexed = typeNode !== undefined && source.ast.is.IsIndexedAccessTypeNode(typeNode)
      ? source.ast.as.AsIndexedAccessTypeNode(typeNode) : undefined;
    if (indexed?.ObjectType !== undefined && indexed.IndexType !== undefined) {
      const objectType = semantics.types.authoredType(indexed.ObjectType);
      const indexType = semantics.types.authoredType(indexed.IndexType);
      assert.ok(objectType && indexType);
      open = { objectType, indexType };
    }
  }
  assert.ok(open, "the open alias has authored object and index types");
  return {semantics, aliases, open};
}

test("public target queries preserve selected indexed members and deferred relationships", () => {
  const {semantics, aliases, open} = sourceFixture();
  const count = semantics.types.selectIndexedAccess(aliases.get("Item")!, aliases.get("Count")!);
  const label = semantics.types.selectIndexedAccess(aliases.get("Item")!, aliases.get("Label")!);
  assert.ok(count?.kind === "resolved" && label?.kind === "resolved");
  assert.ok(count.members[0]?.kind === "property" && label.members[0]?.kind === "property");
  assert.notEqual(count.members[0].property.symbol, label.members[0].property.symbol);
  assert.equal(count.members[0].property.name, "count");
  assert.equal(label.members[0].property.optional, true);
  assert.equal(semantics.types.isNumberLike(count.readType), true);
  assert.equal(semantics.types.isUnion(label.readType), true);
  // REVIEW-R2 #51: a generic indexed access whose key is a type parameter stays deferred.
  assert.equal(semantics.types.selectIndexedAccess(open.objectType, open.indexType)?.kind, "deferred");
  assert.ok(Object.isFrozen(count) && Object.isFrozen(count.members));
});

test("public indexed queries do not accept a key or owner from another checked program", () => {
  const {semantics, aliases} = sourceFixture();
  const foreign = sourceFixture();
  assert.equal(semantics.types.selectIndexedAccess(aliases.get("Item")!, foreign.aliases.get("Count")!), undefined);
  assert.equal(semantics.types.selectIndexedAccess(foreign.aliases.get("Item")!, foreign.aliases.get("Count")!), undefined);
  assert.equal(semantics.types.selectIndexedAccess(foreign.open.objectType, foreign.open.indexType), undefined,
    "a deferred access of another checked program is not selected either");
});
