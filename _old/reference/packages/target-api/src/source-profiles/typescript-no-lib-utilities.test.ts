import assert from "node:assert/strict";
import test from "node:test";
import { typescriptNoLibUtilityDeclarations } from "./typescript-no-lib-utilities.js";

test("the no-lib utility declaration slice exposes the complete pinned utility family", () => {
  const names = [...typescriptNoLibUtilityDeclarations.matchAll(
    /(?:type|interface)\s+([A-Za-z][A-Za-z0-9]*)\s*</gu,
  )].map((match) => match[1]);

  assert.deepEqual(names, [
    "ThisParameterType",
    "OmitThisParameter",
    "Awaited",
    "Partial",
    "Required",
    "Readonly",
    "Pick",
    "Record",
    "Exclude",
    "Extract",
    "Omit",
    "NonNullable",
    "Parameters",
    "ConstructorParameters",
    "ReturnType",
    "InstanceType",
    "Uppercase",
    "Lowercase",
    "Capitalize",
    "Uncapitalize",
    "NoInfer",
    "ThisType",
  ]);
  assert.match(
    typescriptNoLibUtilityDeclarations,
    /object & \{ then\(onfulfilled: infer F/u,
  );
});
