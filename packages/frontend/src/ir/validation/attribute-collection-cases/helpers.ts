/**
 * Shared test helpers for attribute collection pass tests.
 */

export { describe, it } from "mocha";
export { expect } from "chai";
export { runAttributeCollectionPass } from "../attribute-collection-pass.js";
export type {
  IrModule,
  IrClassDeclaration,
  IrInterfaceDeclaration,
  IrFunctionDeclaration,
} from "../../types.js";
import type { IrModule } from "../../types.js";

/**
 * Assert value is not null/undefined and return it typed as non-null.
 */
export const assertDefined = <T>(
  value: T | null | undefined,
  msg?: string
): T => {
  if (value === null || value === undefined) {
    throw new Error(msg ?? "Expected value to be defined");
  }
  return value;
};

/**
 * Helper to create a minimal IrModule for testing
 */
export const createModule = (
  body: IrModule["body"],
  attributesApiLocalName = "A",
  attributeTargetsLocalName?: string
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
          name: "attributes",
          localName: attributesApiLocalName,
        },
        ...(attributeTargetsLocalName
          ? [
              {
                kind: "named" as const,
                name: "AttributeTargets",
                localName: attributeTargetsLocalName,
              },
            ]
          : []),
      ],
    },
  ],
  body,
  exports: [],
});

/**
 * Helper to create a minimal identifier IR
 */
export const makeIdentifier = (name: string, resolvedClrType?: string) => ({
  kind: "identifier" as const,
  name,
  resolvedClrType,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeTypedIdentifier = (
  name: string,
  inferredType: unknown
): any => ({
  kind: "identifier" as const,
  name,
  inferredType,
});

export const makeRefType = (name: string, resolvedClrType?: string) => ({
  kind: "referenceType" as const,
  name,
  resolvedClrType,
});

/**
 * Helper to create a minimal member access IR
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeMemberAccess = (object: any, property: string): any => ({
  kind: "memberAccess" as const,
  object,
  property,
  isComputed: false,
  isOptional: false,
});

/**
 * Helper to create a minimal call IR
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeCall = (
  callee: any,
  args: readonly any[],
  typeArguments?: readonly any[]
): any => ({
  kind: "call" as const,
  callee,
  arguments: args,
  isOptional: false,
  ...(typeArguments ? { typeArguments } : {}),
});

/**
 * Helper to create a minimal literal IR
 */
export const makeLiteral = (value: string | number | boolean) => ({
  kind: "literal" as const,
  value,
  raw: String(value),
});

export const makeObject = (properties: readonly unknown[]) => ({
  kind: "object" as const,
  properties,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeObjectProp = (key: string | unknown, value: unknown): any => ({
  kind: "property" as const,
  key,
  value,
  shorthand: false as const,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeObjectSpread = (expression: unknown): any => ({
  kind: "spread" as const,
  expression,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeUnaryTypeof = (expression: unknown): any => ({
  kind: "unary" as const,
  operator: "typeof" as const,
  expression,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const makeSpreadArg = (expression: unknown): any => ({
  kind: "spread" as const,
  expression,
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

export const makeSelector = (memberName: string) => ({
  kind: "arrowFunction" as const,
  parameters: [makeParameter("x")],
  isAsync: false,
  body: makeMemberAccess(makeIdentifier("x"), memberName),
});

export const makeWrappedSelector = (memberName: string) => ({
  kind: "arrowFunction" as const,
  parameters: [makeParameter("x")],
  isAsync: false,
  body: makeMemberAccess(
    {
      kind: "typeAssertion" as const,
      expression: makeTypedIdentifier("x", makeRefType("User")),
      targetType: makeRefType("User"),
      inferredType: makeRefType("User"),
    },
    memberName
  ),
});

export const makeBadSelectorCallBody = (memberName: string) => ({
  kind: "arrowFunction" as const,
  parameters: [makeParameter("x")],
  isAsync: false,
  body: makeCall(makeMemberAccess(makeIdentifier("x"), memberName), []),
});

export const makeTypeRootCall = (targetName: string, apiObjectName = "A") =>
  makeCall(makeIdentifier(apiObjectName), [], [makeRefType(targetName)]);

export const makeFunctionRootCall = (targetName: string, apiObjectName = "A") =>
  makeCall(makeIdentifier(apiObjectName), [makeIdentifier(targetName)]);

/**
 * Helper to create an attribute marker call IR for A<T>().add(Attr, ...args)
 */
export const makeMarkerCall = (
  targetName: string,
  attrName: string,
  args: Array<{ kind: "literal"; value: string | number | boolean }> = [],
  resolvedClrType?: string,
  apiObjectName = "A"
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(makeTypeRootCall(targetName, apiObjectName), "add"),
    [
      makeIdentifier(attrName, resolvedClrType),
      ...args.map((a) => makeLiteral(a.value)),
    ]
  ),
});

export const makeTypeMarkerCallWithTarget = (
  targetName: string,
  attrName: string,
  targetArg: unknown,
  apiObjectName = "A"
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(makeMemberAccess(makeTypeRootCall(targetName, apiObjectName), "target"), [targetArg]),
      "add"
    ),
    [makeIdentifier(attrName, `Test.${attrName}`)]
  ),
});

export const makeCtorMarkerCall = (targetName: string, attrName: string) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeMemberAccess(makeTypeRootCall(targetName), "ctor"),
      "add"
    ),
    [makeIdentifier(attrName, `Test.${attrName}`)]
  ),
});

export const makeCtorMarkerCallWithTarget = (
  targetName: string,
  attrName: string,
  targetArg: unknown
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(
        makeMemberAccess(makeMemberAccess(makeTypeRootCall(targetName), "ctor"), "target"),
        [targetArg]
      ),
      "add"
    ),
    [makeIdentifier(attrName, `Test.${attrName}`)]
  ),
});

export const makeMethodMarkerCall = (
  targetName: string,
  attrName: string,
  selector: unknown
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(
        makeMemberAccess(makeTypeRootCall(targetName), "method"),
        [selector]
      ),
      "add"
    ),
    [makeIdentifier(attrName, `Test.${attrName}`)]
  ),
});

export const makeMethodMarkerCallWithTarget = (
  targetName: string,
  attrName: string,
  selector: unknown,
  targetArg: unknown
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(
        makeMemberAccess(
          makeCall(makeMemberAccess(makeTypeRootCall(targetName), "method"), [selector]),
          "target"
        ),
        [targetArg]
      ),
      "add"
    ),
    [makeIdentifier(attrName, `Test.${attrName}`)]
  ),
});

export const makePropMarkerCall = (
  targetName: string,
  propName: string,
  attrName: string,
  selector: unknown = makeSelector(propName)
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(
        makeMemberAccess(makeTypeRootCall(targetName), "prop"),
        [selector]
      ),
      "add"
    ),
    [makeIdentifier(attrName, `Test.${attrName}`)]
  ),
});

export const makePropMarkerCallWithTarget = (
  targetName: string,
  propName: string,
  attrName: string,
  targetArg: unknown
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(
      makeCall(
        makeMemberAccess(
          makeCall(makeMemberAccess(makeTypeRootCall(targetName), "prop"), [makeSelector(propName)]),
          "target"
        ),
        [targetArg]
      ),
      "add"
    ),
    [makeIdentifier(attrName, `Test.${attrName}`)]
  ),
});

export const makeAttrDescriptorDecl = (varName: string, attrName: string) => ({
  kind: "variableDeclaration" as const,
  declarationKind: "const" as const,
  isExported: false,
  declarations: [
    {
      kind: "variableDeclarator" as const,
      name: { kind: "identifierPattern" as const, name: varName },
      initializer: makeCall(makeMemberAccess(makeIdentifier("A"), "attr"), [
        makeIdentifier(attrName, `Test.${attrName}`),
        makeLiteral("msg"),
      ]),
    },
  ],
});

export const makeAddDescriptorMarkerCall = (
  targetName: string,
  varName: string
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(makeTypeRootCall(targetName), "add"),
    [makeIdentifier(varName)]
  ),
});

export const makeInlineDescriptorMarkerCall = (
  targetName: string,
  attrName: string
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(makeTypeRootCall(targetName), "add"),
    [
      makeCall(makeMemberAccess(makeIdentifier("A"), "attr"), [
        makeIdentifier(attrName, `Test.${attrName}`),
        makeLiteral("msg"),
      ]),
    ]
  ),
});

export const makeFunctionMarkerCall = (
  functionName: string,
  attrName: string,
  args: Array<{ kind: "literal"; value: string | number | boolean }> = [],
  resolvedClrType?: string,
  apiObjectName = "A"
) => ({
  kind: "expressionStatement" as const,
  expression: makeCall(
    makeMemberAccess(makeFunctionRootCall(functionName, apiObjectName), "add"),
    [
      makeIdentifier(attrName, resolvedClrType),
      ...args.map((a) => makeLiteral(a.value)),
    ]
  ),
});
