import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitMemberAccess } from "../access.js";
import {
  BindingRegistry,
  type IrExpression,
  type IrModule,
  type IrType,
  type SimpleBindingDescriptor,
} from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { printExpression } from "../../core/format/backend-ast/printer.js";

export const createExactGlobalBindingRegistry = (
  bindings: Readonly<Record<string, SimpleBindingDescriptor>>
): BindingRegistry => {
  const registry = new BindingRegistry();
  registry.addBindings("__test__/bindings.json", { bindings });
  return registry;
};

export const createJsSurfaceBindingRegistry = (
  overrides: Readonly<Record<string, SimpleBindingDescriptor>> = {}
): BindingRegistry =>
  createExactGlobalBindingRegistry({
    Array: {
      kind: "global",
      assembly: "js",
      type: "js.Array",
    },
    JSON: {
      kind: "global",
      assembly: "js",
      type: "js.JSON",
    },
    ...overrides,
  });

export {
  describe,
  it,
  expect,
  emitModule,
  emitExpressionAst,
  emitMemberAccess,
  printExpression,
};
export type { EmitterContext, IrExpression, IrModule, IrType };
