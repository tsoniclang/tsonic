import assert from "node:assert/strict";
import test from "node:test";
import { fixedArrayTypeMarkerDeclaration } from "./provider-declarations.js";
import { pointerCallMarkerDeclaration } from "../pointers/marker-declarations.js";

test("FixedArray native length and index are int32 while the exact extent remains a type parameter", () => {
  const declaration = fixedArrayTypeMarkerDeclaration("FixedArray");
  assert.equal(declaration.kind, "interface");
  if (declaration.kind !== "interface") return;
  const length = declaration.members?.find(member => member.kind === "property" && member.name === "length");
  const index = declaration.members?.find(member => member.kind === "indexer");
  const indexType = index?.kind === "indexer" ? index.signatures[0]?.parameters[0]?.type : undefined;
  assert.equal(length?.kind === "property" && length.readonly === true &&
    length.type.kind === "source-primitive" && length.type.name === "int32", true);
  assert.equal(indexType?.kind === "source-primitive" && indexType.name === "int32", true);
  assert.equal(declaration.typeParameters?.[1]?.name, "TLength");
  assert.deepEqual(declaration.typeParameters?.[1]?.constraints,
    [{ kind: "union", types: [{ kind: "number" }, { kind: "bigint" }] }]);
});

test("both pointer hash declarations expose the runtime uint32 hash without a number transport", () => {
  for (const [name, marker] of [["hashptr", "hash-pointer"], ["hashrawptr", "hash-raw-pointer"]] as const) {
    const declaration = pointerCallMarkerDeclaration(name, marker, { kind: "source-primitive", name: "int32" });
    assert.equal(declaration.kind, "function");
    if (declaration.kind !== "function") return;
    assert.equal(declaration.signatures.length, 1);
    assert.deepEqual(declaration.signatures[0]?.returnType, { kind: "source-primitive", name: "uint32" });
  }
});
