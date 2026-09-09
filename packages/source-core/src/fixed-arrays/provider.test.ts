import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProviderDeclarationIdentity } from "@tsonic/tsts";
import { tsonicCoreProviderVersion, tsonicCoreTypesModule, tsonicCoreVirtualModulesProviderId } from "../identity.js";
import { isTsonicFixedArrayProviderType, tsonicFixedArrayProviderIds } from "./provider.js";
import { fixedArrayTypeMarkerDeclaration } from "./provider-declarations.js";

test("fixed-array selection requires the complete canonical provider type identity", () => {
  const identity: ProviderDeclarationIdentity = {
    providerId: tsonicCoreVirtualModulesProviderId,
    providerVersion: tsonicCoreProviderVersion,
    providerModuleId: tsonicCoreTypesModule,
    moduleSpecifier: tsonicCoreTypesModule,
    exportId: tsonicFixedArrayProviderIds.exportId,
    exportName: "FixedArray",
  };
  assert.equal(isTsonicFixedArrayProviderType(identity), true);
  assert.equal(isTsonicFixedArrayProviderType(undefined), false);
  for (const changed of [
    { providerId: "other" },
    { providerVersion: undefined },
    { providerVersion: "other" },
    { providerModuleId: "other" },
    { moduleSpecifier: "other" },
    { exportId: undefined },
    { exportId: "other" },
    { exportName: undefined },
    { exportName: "other" },
    { memberId: tsonicFixedArrayProviderIds.lengthMemberId },
    { memberName: "length" },
    { memberKey: { kind: "property-key" as const, name: "length" } },
    { memberStatic: false },
    { signatureId: tsonicFixedArrayProviderIds.indexSignatureId },
  ]) {
    assert.equal(isTsonicFixedArrayProviderType({ ...identity, ...changed }), false);
  }
});

test("fixed-array declaration keeps selected length type and existing member identities", () => {
  const declaration = fixedArrayTypeMarkerDeclaration("FixedArray");
  assert.equal(declaration.kind, "interface");
  if (declaration.kind !== "interface") return;
  assert.equal(declaration.id, tsonicFixedArrayProviderIds.exportId);
  assert.deepEqual(declaration.typeParameters, [
    { name: "T" },
    { name: "TLength", constraints: [{ kind: "union", types: [{ kind: "number" }, { kind: "bigint" }] }] },
  ]);
  assert.deepEqual(declaration.members?.map(member => member.id), [
    tsonicFixedArrayProviderIds.indexMemberId,
    tsonicFixedArrayProviderIds.lengthMemberId,
    tsonicFixedArrayProviderIds.iteratorMemberId,
  ]);
  const length = declaration.members?.find(member => member.id === tsonicFixedArrayProviderIds.lengthMemberId);
  assert.equal(length?.kind, "property");
  if (length?.kind !== "property") return;
  assert.equal(length.readonly, true);
  assert.deepEqual(length.type, { kind: "type-parameter", name: "TLength" });
});
