export { describe, it } from "mocha";
export { expect } from "chai";
export { emitCSharpFiles } from "../../emitter.js";
export {
  emitModule,
  normalizeTestIrModule,
  type TestIrModule as IrModule,
} from "../../test-ir-normalization.js";
export type {
  EmittableIrModule,
  TypeBinding as FrontendTypeBinding,
  IrType,
} from "@tsonic/frontend";
import {
  assumeEmittableIrModule as assumeFrontendEmittableIrModule,
  type EmittableIrModule,
} from "@tsonic/frontend";
import {
  normalizeTestIrModule,
  type TestIrModule,
} from "../../test-ir-normalization.js";

export const assumeEmittableIrModule = (
  module: TestIrModule
): EmittableIrModule =>
  assumeFrontendEmittableIrModule(normalizeTestIrModule(module));
export { emitReferenceType } from "../references.js";
export { emitTypeAst } from "../emitter.js";
export type { EmitterContext } from "../../types.js";
export { clrTypeNameToTypeAst } from "../../core/format/backend-ast/utils.js";
export { printType } from "../../core/format/backend-ast/printer.js";
import type { IrModule, IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";

export const createModuleWithType = (varType: IrType): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "Test",
  className: "Test",
  isStaticContainer: true,
  imports: [],
  body: [
    {
      kind: "variableDeclaration",
      declarationKind: "const",
      isExported: false,
      declarations: [
        {
          kind: "variableDeclarator",
          name: { kind: "identifierPattern", name: "x" },
          type: varType,
          initializer: { kind: "literal", value: null },
        },
      ],
    },
  ],
  exports: [],
});

export const baseContext: EmitterContext = {
  indentLevel: 0,
  isStatic: false,
  isAsync: false,
  options: { rootNamespace: "Test" },
  usings: new Set<string>(),
};
