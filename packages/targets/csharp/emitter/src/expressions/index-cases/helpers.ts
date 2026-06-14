import { describe, it } from "mocha";
import { expect } from "chai";
import {
  emitModule,
  testIfStatement,
  type TestIrModule,
} from "../../test-ir-strict.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitMemberAccess } from "../access.js";
import {
  BindingRegistry,
  type IrExpression,
  type IrType,
  type SimpleBindingDescriptor,
} from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
export { semanticTypeMap, storageCarrierMap } from "../../types.js";
import { printExpression } from "../../core/format/backend-ast/printer.js";

export const createExactGlobalBindingRegistry = (
  bindings: Readonly<Record<string, SimpleBindingDescriptor>>
): BindingRegistry => {
  const registry = new BindingRegistry();
  registry.addBindings("__test__/bindings.json", {
    schema: "tsonic.bindings",
    provider: { namespace: "sourceSurface" },
    sourceSurface: { bindings },
    targetSurface: { types: [] },
  });
  return registry;
};

export const createJsSurfaceBindingRegistry = (
  overrides: Readonly<Record<string, SimpleBindingDescriptor>> = {}
): BindingRegistry =>
  createExactGlobalBindingRegistry({
    Array: {
      kind: "global",
      ownerIdentity: "js",
      type: "js.Array",
    },
    JSON: {
      kind: "global",
      ownerIdentity: "js",
      type: "js.JSON",
    },
    ...overrides,
  });

export const jsSurfaceCapabilities: EmitterContext["options"]["surfaceCapabilities"] =
  {
    mode: "@tsonic/js",
    includesCore: false,
    resolvedModes: ["@tsonic/js"],
    requiredTypeRoots: [],
    memberSemantics: {
      "js.Array": {
        length: { storageAccess: "arrayLength" },
        push: { mutatesReceiver: true },
        reverse: { mutatesReceiver: true, returnsReceiver: true },
        sort: { mutatesReceiver: true, returnsReceiver: true },
      },
      "js.Array`1": {
        length: { storageAccess: "arrayLength" },
        push: { mutatesReceiver: true },
        reverse: { mutatesReceiver: true, returnsReceiver: true },
        sort: { mutatesReceiver: true, returnsReceiver: true },
      },
      "js.ReadonlyArray": {
        length: { storageAccess: "arrayLength" },
      },
      "js.ReadonlyArray`1": {
        length: { storageAccess: "arrayLength" },
      },
      "js.String": {
        length: {
          emittedMemberName: "Length",
          emissionKind: "instanceMember",
        },
      },
    },
  };

export {
  describe,
  it,
  expect,
  emitModule,
  testIfStatement,
  emitExpressionAst,
  emitMemberAccess,
  printExpression,
};
export type { EmitterContext, IrExpression, TestIrModule as IrModule, IrType };
