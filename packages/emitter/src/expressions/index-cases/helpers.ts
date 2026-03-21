import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitMemberAccess } from "../access.js";
import type { IrExpression, IrModule, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { printExpression } from "../../core/format/backend-ast/printer.js";

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
