export { describe, it } from "mocha";
export { expect } from "chai";
export { emitCSharpFiles, emitModule } from "../../emitter.js";
export type { IrModule, IrType, TypeBinding as FrontendTypeBinding } from "@tsonic/frontend";
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
