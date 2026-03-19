import {
  IrModule,
  IrMemberExpression,
  IrExpression,
  ComputedAccessKind,
} from "@tsonic/frontend";

export type { IrModule, IrMemberExpression, IrExpression, ComputedAccessKind };

export const createModuleWithAccess = (options: {
  accessKind?: ComputedAccessKind;
  indexHasProof: boolean;
  indexValue?: number;
  indexRaw?: string;
}): IrModule => {
  const indexExpr: IrExpression = {
    kind: "literal",
    value: options.indexValue ?? 0,
    raw: options.indexRaw ?? "0",
    ...(options.indexHasProof
      ? {
          inferredType: {
            kind: "primitiveType" as const,
            name: "int" as const,
          },
        }
      : {}),
  };

  const memberAccess: IrMemberExpression = {
    kind: "memberAccess",
    object: {
      kind: "identifier",
      name: "arr",
      inferredType: {
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "number" },
      },
    },
    property: indexExpr,
    isComputed: true,
    isOptional: false,
    ...(options.accessKind !== undefined ? { accessKind: options.accessKind } : {}),
    inferredType: { kind: "primitiveType", name: "number" },
  };

  return {
    kind: "module",
    filePath: "/test/contract.ts",
    namespace: "Test",
    className: "contract",
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
            name: { kind: "identifierPattern", name: "arr" },
            type: {
              kind: "arrayType",
              elementType: { kind: "primitiveType", name: "number" },
            },
            initializer: {
              kind: "array",
              elements: [
                { kind: "literal", value: 1 },
                { kind: "literal", value: 2 },
                { kind: "literal", value: 3 },
              ],
            },
          },
        ],
      },
      {
        kind: "variableDeclaration",
        declarationKind: "const",
        isExported: false,
        declarations: [
          {
            kind: "variableDeclarator",
            name: { kind: "identifierPattern", name: "x" },
            initializer: memberAccess,
          },
        ],
      },
    ],
    exports: [],
  };
};

export const createModuleWithIdentifierIndex = (options: {
  accessKind: ComputedAccessKind;
  indexName: string;
  indexHasInt32Type: boolean;
}): IrModule => {
  const indexExpr: IrExpression = {
    kind: "identifier",
    name: options.indexName,
    ...(options.indexHasInt32Type
      ? {
          inferredType: {
            kind: "primitiveType" as const,
            name: "int" as const,
          },
        }
      : {
          inferredType: { kind: "primitiveType", name: "number" },
        }),
  };

  const memberAccess: IrMemberExpression = {
    kind: "memberAccess",
    object: {
      kind: "identifier",
      name: "arr",
      inferredType: {
        kind: "arrayType",
        elementType: { kind: "primitiveType", name: "number" },
      },
    },
    property: indexExpr,
    isComputed: true,
    isOptional: false,
    accessKind: options.accessKind,
    inferredType: { kind: "primitiveType", name: "number" },
  };

  return {
    kind: "module",
    filePath: "/test/contract.ts",
    namespace: "Test",
    className: "contract",
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
            name: { kind: "identifierPattern", name: "arr" },
            type: {
              kind: "arrayType",
              elementType: { kind: "primitiveType", name: "number" },
            },
            initializer: {
              kind: "array",
              elements: [
                { kind: "literal", value: 1 },
                { kind: "literal", value: 2 },
                { kind: "literal", value: 3 },
              ],
            },
          },
        ],
      },
      {
        kind: "variableDeclaration",
        declarationKind: "const",
        isExported: false,
        declarations: [
          {
            kind: "variableDeclarator",
            name: { kind: "identifierPattern", name: "x" },
            initializer: memberAccess,
          },
        ],
      },
    ],
    exports: [],
  };
};
