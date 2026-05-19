import type { IrModule, IrStatement, IrType } from "@tsonic/frontend";

export const createModule = (
  statements: IrStatement[],
  isStatic = false
): IrModule => ({
  kind: "module",
  filePath: "/src/test.ts",
  namespace: "TestApp",
  className: "test",
  isStaticContainer: isStatic,
  imports: [],
  body: isStatic
    ? statements
    : [
        {
          kind: "functionDeclaration",
          name: "testFunc",
          parameters: [],
          returnType: { kind: "voidType" },
          body: {
            kind: "blockStatement",
            statements,
          },
          isExported: true,
          isAsync: false,
          isGenerator: false,
        },
      ],
  exports: [],
});

export const arrayType = (elementType: IrType): IrType => ({
  kind: "arrayType",
  elementType,
});

export const stringType: IrType = { kind: "primitiveType", name: "string" };
export const numberType: IrType = { kind: "primitiveType", name: "number" };
