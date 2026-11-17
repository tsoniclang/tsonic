import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalTargetSourceRules,
  createTargetLayerRules,
} from "./tooling/target-layer-contract.mjs";

test("common target classification preserves precisely declared native SDK and model owners", () => {
  const nativeModels = ["src/providers/relations/model.ts"];
  const nativeSdk = ["src/public/provider-native.ts"];
  const rules = createTargetLayerRules({ providerModelPaths: nativeModels, providerSdkPaths: nativeSdk });
  nativeModels.push("src/providers/late.ts");
  nativeSdk.push("src/public/late.ts");
  for (const [path, owner] of [
    ["src/providers/relations/model.ts", "provider-model"],
    ["src/providers/model/value.ts", "provider-model"],
    ["src/providers/native/projection/type.ts", "provider-implementation"],
    ["src/providers/late.ts", "provider-implementation"],
    ["src/public/provider-native.ts", "public-provider-sdk"],
    ["src/policy/operations/members/selection.ts", "policy"],
    ["src/backend/planner/declarations/callables/functions.ts", "planner"],
  ]) {
    assert.deepEqual(rules.filter(rule => rule.matches(path)).map(rule => rule.layer), [owner], path);
  }
  assert.deepEqual(rules.filter(rule => rule.matches("src/public/late.ts")), []);
});

test("equivalent target responsibilities cannot return to competing family paths", () => {
  const rule = canonicalTargetSourceRules.find(entry => entry.ruleId === "ARCH-TARGET-FAMILY-001");
  for (const path of [
    "src/analysis/object-shapes/model.ts",
    "src/policy/members/selection.ts",
    "src/providers/dotnet/types.ts",
    "src/providers/compiler/types.ts",
    "src/compilation/runtime-references.ts",
    "src/backend/planner/bindings/parameters.ts",
    "src/backend/planner/declarations/callable-parameters.ts",
  ]) assert.equal(rule.matches(path, ""), true, path);
  for (const path of [
    "src/analysis/objects/model.ts",
    "src/providers/native/projection/types.ts",
    "src/providers/runtime/source-projects.ts",
    "src/providers/runtime/source-crates.ts",
    "src/backend/planner/declarations/callables/parameters.ts",
  ]) assert.equal(rule.matches(path, ""), false, path);
});
