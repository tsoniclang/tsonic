/**
 * Shared helpers for soundness-gate tests.
 */

import { IrModule, IrType } from "../../types.js";

/**
 * Helper to create a minimal module with a variable declaration of a given type
 */
export const createModuleWithType = (
  varType: IrType,
  options: {
    imports?: IrModule["imports"];
    additionalBody?: IrModule["body"];
  } = {}
): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "Test",
  className: "test",
  isStaticContainer: true,
  imports: options.imports ?? [],
  body: [
    ...(options.additionalBody ?? []),
    {
      kind: "variableDeclaration",
      declarationKind: "const",
      isExported: false,
      declarations: [
        {
          kind: "variableDeclarator",
          name: { kind: "identifierPattern", name: "x" },
          type: varType,
          initializer: {
            kind: "literal",
            value: null,
            raw: "null",
          },
        },
      ],
    },
  ],
  exports: [],
});
