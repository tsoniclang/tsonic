export { describe, it } from "mocha";
export { expect } from "chai";
export {
  runOverloadCollectionPass,
  runOverloadFamilyConsistencyPass,
} from "../index.js";
export type {
  IrCallExpression,
  IrModule,
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrInterfaceDeclaration,
  IrExpression,
  IrMethodDeclaration,
  IrMethodSignature,
  IrParameter,
  IrType,
} from "../../types.js";
import type {
  IrCallExpression,
  IrExpression,
  IrFunctionDeclaration,
  IrMethodDeclaration,
  IrMethodSignature,
  IrModule,
  IrParameter,
  IrType,
} from "../../types.js";

export const assertDefined = <T>(
  value: T | null | undefined,
  msg?: string
): T => {
  if (value === null || value === undefined) {
    throw new Error(msg ?? "Expected value to be defined");
  }
  return value;
};

export const createModule = (
  body: IrModule["body"],
  overloadsApiLocalName = "O"
): IrModule => ({
  kind: "module",
  filePath: "test.ts",
  namespace: "Test",
  className: "Test",
  isStaticContainer: false,
  imports: [
    {
      kind: "import",
      source: "@tsonic/core/lang.js",
      isLocal: false,
      isClr: false,
      specifiers: [
        {
          kind: "named",
          name: "overloads",
          localName: overloadsApiLocalName,
        },
      ],
    },
  ],
  body,
  exports: [],
});

export const makeIdentifier = (name: string) => ({
  kind: "identifier" as const,
  name,
});

export const makeReferenceType = (name: string) => ({
  kind: "referenceType" as const,
  name,
});

export const makePrimitiveType = (
  name: "string" | "number" | "int" | "char" | "boolean" | "null" | "undefined"
) => ({
  kind: "primitiveType" as const,
  name,
});

export const makeUnknownType = () => ({
  kind: "unknownType" as const,
  explicit: true as const,
});

export const makeAnyType = () => ({
  kind: "anyType" as const,
});

export const makeMemberAccess = (
  object: IrExpression,
  property: string
): IrExpression => ({
  kind: "memberAccess" as const,
  object,
  property,
  isComputed: false,
  isOptional: false,
});

export const makeCall = (
  callee: IrExpression,
  args: readonly IrExpression[],
  typeArguments?: readonly IrType[]
): IrCallExpression => ({
  kind: "call" as const,
  callee,
  arguments: args,
  isOptional: false,
  ...(typeArguments ? { typeArguments } : {}),
});

export const makeLiteral = (value: string | number | boolean) => ({
  kind: "literal" as const,
  value,
  raw: JSON.stringify(value),
});

export const makeParameter = (name: string) => ({
  kind: "parameter" as const,
  pattern: { kind: "identifierPattern" as const, name },
  type: undefined,
  initializer: undefined,
  isOptional: false,
  isRest: false,
  passing: "value" as const,
});

export const makeTypedParameter = (name: string, type: IrType): IrParameter => ({
  ...makeParameter(name),
  type,
});

export const makeBlock = () => ({
  kind: "blockStatement" as const,
  statements: [],
});

export const makeFunctionDeclaration = (
  name: string,
  parameters: readonly IrParameter[],
  returnType: IrType,
  options?: {
    readonly isExported?: boolean;
    readonly isDeclarationOnly?: boolean;
  }
): IrFunctionDeclaration => ({
  kind: "functionDeclaration" as const,
  name,
  parameters,
  returnType,
  body: makeBlock(),
  ...(options?.isDeclarationOnly ? { isDeclarationOnly: true } : {}),
  isAsync: false,
  isGenerator: false,
  isExported: options?.isExported ?? true,
});

export const makeMethodDeclaration = (
  name: string,
  parameters: readonly IrParameter[],
  returnType: IrType,
  options?: {
    readonly isStatic?: boolean;
    readonly hasBody?: boolean;
    readonly accessibility?: "public" | "private" | "protected" | "internal";
  }
): IrMethodDeclaration => ({
  kind: "methodDeclaration" as const,
  name,
  parameters,
  returnType,
  ...(options?.hasBody === false ? {} : { body: makeBlock() }),
  isStatic: options?.isStatic ?? false,
  isAsync: false,
  isGenerator: false,
  accessibility: options?.accessibility ?? "public",
});

export const makeMethodSignature = (
  name: string,
  parameters: readonly IrParameter[],
  returnType: IrType
): IrMethodSignature => ({
  kind: "methodSignature" as const,
  name,
  parameters,
  returnType,
});

export const makeSelector = (memberName: string) => ({
  kind: "arrowFunction" as const,
  parameters: [makeParameter("x")],
  isAsync: false,
  body: makeMemberAccess(makeIdentifier("x"), memberName),
});

export const makeBadSelector = (memberName: string) => ({
  kind: "arrowFunction" as const,
  parameters: [makeParameter("x")],
  isAsync: false,
  body: makeCall(makeMemberAccess(makeIdentifier("x"), memberName), []),
});

export const makeFunctionMarkerCall = (
  functionName: string,
  familyName: string,
  apiObjectName = "O"
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(makeIdentifier(apiObjectName), [makeIdentifier(functionName)]),
      "family"
    ),
    [makeIdentifier(familyName)]
  ),
});

export const makeMethodMarkerCall = (
  typeName: string,
  memberName: string,
  familyName: string,
  _isStatic = false,
  apiObjectName = "O"
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(
        makeMemberAccess(makeCall(makeIdentifier(apiObjectName), [], [makeReferenceType(typeName)]), "method"),
        [makeSelector(memberName)]
      ),
      "family"
    ),
    [makeSelector(familyName)]
  ),
});

export const makeMethodMarkerCallWithSelector = (
  typeName: string,
  selector: IrExpression,
  familyName: string,
  _isStatic = false,
  apiObjectName = "O"
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(
        makeMemberAccess(makeCall(makeIdentifier(apiObjectName), [], [makeReferenceType(typeName)]), "method"),
        [selector]
      ),
      "family"
    ),
    [makeSelector(familyName)]
  ),
});
