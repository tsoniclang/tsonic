/**
 * Tests for attribute collection pass
 */

import { expect } from "chai";
import { runAttributeCollectionPass } from "./attribute-collection-pass.js";
import type {
  IrModule,
  IrClassDeclaration,
  IrFunctionDeclaration,
  IrExpression,
  IrObjectProperty,
  IrType,
  IrStatement,
} from "../types.js";

/**
 * Assert value is not null/undefined and return it typed as non-null.
 */
const assertDefined = <T>(value: T | null | undefined, msg?: string): T => {
  if (value === null || value === undefined) {
    throw new Error(msg ?? "Expected value to be defined");
  }
  return value;
};

describe("Attribute Collection Pass", () => {
  /**
   * Helper to create a minimal IrModule for testing
   */
  const createModule = (
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
  const makeIdentifier = (name: string, resolvedClrType?: string) => ({
    kind: "identifier" as const,
    name,
    resolvedClrType,
  });

  const makeTypedIdentifier = (name: string, inferredType: IrType) => ({
    kind: "identifier" as const,
    name,
    inferredType,
  });

  const makeRefType = (name: string, resolvedClrType?: string) => ({
    kind: "referenceType" as const,
    name,
    resolvedClrType,
  });

  /**
   * Helper to create a minimal member access IR
   */
  const makeMemberAccess = (object: IrExpression, property: string) => ({
    kind: "memberAccess" as const,
    object,
    property,
    isComputed: false,
    isOptional: false,
  });

  /**
   * Helper to create a minimal call IR
   */
  const makeCall = (callee: IrExpression, args: readonly IrExpression[]) => ({
    kind: "call" as const,
    callee,
    arguments: args,
    isOptional: false,
  });

  /**
   * Helper to create a minimal literal IR
   */
  const makeLiteral = (value: string | number | boolean) => ({
    kind: "literal" as const,
    value,
    raw: String(value),
  });

  const makeObject = (properties: readonly IrObjectProperty[]) => ({
    kind: "object" as const,
    properties,
  });

  const makeObjectProp = (
    key: string | IrExpression,
    value: IrExpression
  ): Extract<IrObjectProperty, { kind: "property" }> => ({
    kind: "property" as const,
    key,
    value,
    shorthand: false as const,
  });

  const makeObjectSpread = (
    expression: IrExpression
  ): Extract<IrObjectProperty, { kind: "spread" }> => ({
    kind: "spread" as const,
    expression,
  });

  const makeUnaryTypeof = (expression: IrExpression) => ({
    kind: "unary" as const,
    operator: "typeof" as const,
    expression,
  });

  const makeSpreadArg = (expression: IrExpression) => ({
    kind: "spread" as const,
    expression,
  });

  const makeParameter = (name: string) => ({
    kind: "parameter" as const,
    pattern: { kind: "identifierPattern" as const, name },
    type: undefined,
    initializer: undefined,
    isOptional: false,
    isRest: false,
    passing: "value" as const,
  });

  const makeSelector = (memberName: string) => ({
    kind: "arrowFunction" as const,
    parameters: [makeParameter("x")],
    isAsync: false,
    body: makeMemberAccess(makeIdentifier("x"), memberName),
  });

  const makeBadSelectorCallBody = (memberName: string) => ({
    kind: "arrowFunction" as const,
    parameters: [makeParameter("x")],
    isAsync: false,
    body: makeCall(makeMemberAccess(makeIdentifier("x"), memberName), []),
  });

  /**
   * Helper to create an attribute marker call IR for A.on(Target).type.add(Attr, ...args)
   */
  const makeMarkerCall = (
    targetName: string,
    attrName: string,
    args: Array<{ kind: "literal"; value: string | number | boolean }> = [],
    resolvedClrType?: string,
    apiObjectName = "A"
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeMemberAccess(
          makeCall(makeMemberAccess(makeIdentifier(apiObjectName), "on"), [
            makeIdentifier(targetName),
          ]),
          "type"
        ),
        "add"
      ),
      [
        makeIdentifier(attrName, resolvedClrType),
        ...args.map((a) => makeLiteral(a.value)),
      ]
    ),
  });

  const makeTypeMarkerCallWithTarget = (
    targetName: string,
    attrName: string,
    targetArg: IrExpression,
    apiObjectName = "A"
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeCall(
          makeMemberAccess(
            makeMemberAccess(
              makeCall(makeMemberAccess(makeIdentifier(apiObjectName), "on"), [
                makeIdentifier(targetName),
              ]),
              "type"
            ),
            "target"
          ),
          [targetArg]
        ),
        "add"
      ),
      [makeIdentifier(attrName, `Test.${attrName}`)]
    ),
  });

  const makeCtorMarkerCall = (targetName: string, attrName: string) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeMemberAccess(
          makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
            makeIdentifier(targetName),
          ]),
          "ctor"
        ),
        "add"
      ),
      [makeIdentifier(attrName, `Test.${attrName}`)]
    ),
  });

  const makeCtorMarkerCallWithTarget = (
    targetName: string,
    attrName: string,
    targetArg: IrExpression
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeCall(
          makeMemberAccess(
            makeMemberAccess(
              makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                makeIdentifier(targetName),
              ]),
              "ctor"
            ),
            "target"
          ),
          [targetArg]
        ),
        "add"
      ),
      [makeIdentifier(attrName, `Test.${attrName}`)]
    ),
  });

  const makeMethodMarkerCall = (
    targetName: string,
    attrName: string,
    selector: IrExpression
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeCall(
          makeMemberAccess(
            makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
              makeIdentifier(targetName),
            ]),
            "method"
          ),
          [selector]
        ),
        "add"
      ),
      [makeIdentifier(attrName, `Test.${attrName}`)]
    ),
  });

  const makeMethodMarkerCallWithTarget = (
    targetName: string,
    attrName: string,
    selector: IrExpression,
    targetArg: IrExpression
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeCall(
          makeMemberAccess(
            makeCall(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier(targetName),
                ]),
                "method"
              ),
              [selector]
            ),
            "target"
          ),
          [targetArg]
        ),
        "add"
      ),
      [makeIdentifier(attrName, `Test.${attrName}`)]
    ),
  });

  const makePropMarkerCall = (
    targetName: string,
    propName: string,
    attrName: string
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeCall(
          makeMemberAccess(
            makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
              makeIdentifier(targetName),
            ]),
            "prop"
          ),
          [makeSelector(propName)]
        ),
        "add"
      ),
      [makeIdentifier(attrName, `Test.${attrName}`)]
    ),
  });

  const makePropMarkerCallWithTarget = (
    targetName: string,
    propName: string,
    attrName: string,
    targetArg: IrExpression
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeCall(
          makeMemberAccess(
            makeCall(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier(targetName),
                ]),
                "prop"
              ),
              [makeSelector(propName)]
            ),
            "target"
          ),
          [targetArg]
        ),
        "add"
      ),
      [makeIdentifier(attrName, `Test.${attrName}`)]
    ),
  });

  const makeAttrDescriptorDecl = (varName: string, attrName: string) => ({
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

  const makeAddDescriptorMarkerCall = (
    targetName: string,
    varName: string
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeMemberAccess(
          makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
            makeIdentifier(targetName),
          ]),
          "type"
        ),
        "add"
      ),
      [makeIdentifier(varName)]
    ),
  });

  const makeInlineDescriptorMarkerCall = (
    targetName: string,
    attrName: string
  ) => ({
    kind: "expressionStatement" as const,
    expression: makeCall(
      makeMemberAccess(
        makeMemberAccess(
          makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
            makeIdentifier(targetName),
          ]),
          "type"
        ),
        "add"
      ),
      [
        makeCall(makeMemberAccess(makeIdentifier("A"), "attr"), [
          makeIdentifier(attrName, `Test.${attrName}`),
          makeLiteral("msg"),
        ]),
      ]
    ),
  });

  describe("A.on(Class).type.add(Attr) pattern", () => {
    it("should attach attribute to class declaration", () => {
      // IR representation of:
      // class User {}
      // A.on(User).type.add(SerializableAttribute);
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall(
          "User",
          "SerializableAttribute",
          [],
          "System.SerializableAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;
      expect(result.modules).to.have.length(1);

      const processedModule = assertDefined(result.modules[0]);
      // Marker statement should be removed
      expect(processedModule.body).to.have.length(1);

      const classDecl = processedModule.body[0] as IrClassDeclaration;
      expect(classDecl.kind).to.equal("classDeclaration");
      expect(classDecl.attributes).to.have.length(1);
      const attr0 = assertDefined(classDecl.attributes?.[0]);
      expect(attr0.attributeType.kind).to.equal("referenceType");
    });

    it("should attach attribute with positional arguments", () => {
      // IR representation of:
      // class User {}
      // A.on(User).type.add(ObsoleteAttribute, "Use NewUser instead");
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall(
          "User",
          "ObsoleteAttribute",
          [{ kind: "literal", value: "Use NewUser instead" }],
          "System.ObsoleteAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;

      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.have.length(1);
      expect(attr.positionalArgs[0]).to.deep.equal({
        kind: "string",
        value: "Use NewUser instead",
      });
    });

    it("should attach attribute with named arguments", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([
                makeObjectProp("IsError", makeLiteral(true)),
                makeObjectProp("DiagnosticId", makeLiteral("TSN0000")),
              ]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;

      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.have.length(0);
      expect(attr.namedArgs.get("IsError")).to.deep.equal({
        kind: "boolean",
        value: true,
      });
      expect(attr.namedArgs.get("DiagnosticId")).to.deep.equal({
        kind: "string",
        value: "TSN0000",
      });
    });

    it("should attach attribute with mixed positional and named arguments", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeLiteral("Deprecated"),
              makeObject([makeObjectProp("IsError", makeLiteral(true))]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;

      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.deep.equal([
        { kind: "string", value: "Deprecated" },
      ]);
      expect(attr.namedArgs.get("IsError")).to.deep.equal({
        kind: "boolean",
        value: true,
      });
    });

    it("should attach attribute with typeof argument", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier(
                "TypeConverterAttribute",
                "System.ComponentModel.TypeConverterAttribute"
              ),
              makeUnaryTypeof(
                makeTypedIdentifier("User", makeRefType("User", "Test.User"))
              ),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.have.length(1);
      expect(attr.positionalArgs[0]).to.deep.equal({
        kind: "typeof",
        type: {
          kind: "referenceType",
          name: "User",
          resolvedClrType: "Test.User",
        },
      });
    });

    it("should attach attribute with enum argument", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("MyAttr", "Test.MyAttr"),
              {
                kind: "memberAccess" as const,
                object: makeTypedIdentifier(
                  "MyEnum",
                  makeRefType("MyEnum", "Test.MyEnum")
                ),
                property: "Value",
                isComputed: false,
                isOptional: false,
              },
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.deep.equal([
        {
          kind: "enum",
          type: {
            kind: "referenceType",
            name: "MyEnum",
            resolvedClrType: "Test.MyEnum",
          },
          member: "Value",
        },
      ]);
    });

    it("should use CLR member name for enum arguments when memberBinding is present", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("MyAttr", "Test.MyAttr"),
              {
                kind: "memberAccess" as const,
                object: makeTypedIdentifier(
                  "LayoutKind",
                  makeRefType(
                    "LayoutKind",
                    "System.Runtime.InteropServices.LayoutKind"
                  )
                ),
                property: "sequential",
                isComputed: false,
                isOptional: false,
                memberBinding: {
                  assembly: "System.Runtime.InteropServices",
                  type: "System.Runtime.InteropServices.LayoutKind",
                  member: "Sequential",
                },
              },
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.deep.equal([
        {
          kind: "enum",
          type: {
            kind: "referenceType",
            name: "LayoutKind",
            resolvedClrType: "System.Runtime.InteropServices.LayoutKind",
          },
          member: "Sequential",
        },
      ]);
    });

    it("should support explicit type attribute target (type)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeTypeMarkerCallWithTarget(
          "User",
          "SerializableAttribute",
          makeLiteral("type")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr0 = assertDefined(classDecl.attributes?.[0]);
      expect(attr0.target).to.equal("type");
    });

    it("should reject invalid type attribute targets", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeTypeMarkerCallWithTarget(
          "User",
          "SerializableAttribute",
          makeLiteral("return")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });
  });

  describe("Alias imports", () => {
    it("should recognize any local name imported from @tsonic/core/lang.js", () => {
      const module = createModule(
        [
          {
            kind: "classDeclaration",
            name: "User",
            implements: [],
            members: [],
            isExported: true,
            isStruct: false,
          } as IrClassDeclaration,
          makeMarkerCall(
            "User",
            "SerializableAttribute",
            [],
            "System.SerializableAttribute",
            "Attr"
          ),
        ],
        "Attr"
      );

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      expect(mod.body).to.have.length(1);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
    });
  });

  describe("A.on(Class).ctor.add(Attr) pattern", () => {
    it("should attach attribute to class ctorAttributes", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeCtorMarkerCall("User", "ObsoleteAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.ctorAttributes).to.have.length(1);
    });

    it("should support explicit constructor attribute target (method)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeCtorMarkerCallWithTarget(
          "User",
          "ObsoleteAttribute",
          makeLiteral("method")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const attr0 = assertDefined(classDecl.ctorAttributes?.[0]);
      expect(attr0.target).to.equal("method");
    });

    it("should reject invalid constructor attribute targets", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeCtorMarkerCallWithTarget(
          "User",
          "ObsoleteAttribute",
          makeLiteral("return")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });
  });

  describe("A.on(Class).method(selector).add(Attr) pattern", () => {
    it("should attach attribute to the selected method", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "methodDeclaration",
              name: "save",
              parameters: [],
              body: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isAsync: false,
              isGenerator: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makeMethodMarkerCall("User", "PureAttribute", makeSelector("save")),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const method = classDecl.members.find(
        (m) => m.kind === "methodDeclaration"
      );
      expect(
        method && "attributes" in method ? method.attributes : undefined
      ).to.have.length(1);
    });

    it("should support method attribute targets (e.g., return)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "methodDeclaration",
              name: "save",
              parameters: [],
              body: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isAsync: false,
              isGenerator: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makeMethodMarkerCallWithTarget(
          "User",
          "PureAttribute",
          makeSelector("save"),
          makeLiteral("return")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const method = classDecl.members.find(
        (m) => m.kind === "methodDeclaration"
      );
      const attr0 = assertDefined(
        method && "attributes" in method ? method.attributes?.[0] : undefined
      );
      expect(attr0.target).to.equal("return");
    });

    it("should accept AttributeTargets.<target> (aliased import)", () => {
      const module = createModule(
        [
          {
            kind: "classDeclaration",
            name: "User",
            implements: [],
            members: [
              {
                kind: "methodDeclaration",
                name: "save",
                parameters: [],
                body: { kind: "blockStatement", statements: [] },
                isStatic: false,
                isAsync: false,
                isGenerator: false,
                accessibility: "public",
              },
            ],
            isExported: true,
            isStruct: false,
          } as unknown as IrClassDeclaration,
          makeMethodMarkerCallWithTarget(
            "User",
            "PureAttribute",
            makeSelector("save"),
            makeMemberAccess(makeIdentifier("AT"), "return")
          ),
        ],
        "A",
        "AT"
      );

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const method = classDecl.members.find(
        (m) => m.kind === "methodDeclaration"
      );
      const attr0 = assertDefined(
        method && "attributes" in method ? method.attributes?.[0] : undefined
      );
      expect(attr0.target).to.equal("return");
    });

    it("should reject invalid method attribute targets", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "methodDeclaration",
              name: "save",
              parameters: [],
              body: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isAsync: false,
              isGenerator: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makeMethodMarkerCallWithTarget(
          "User",
          "PureAttribute",
          makeSelector("save"),
          makeLiteral("field")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should reject invalid attribute targets", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "methodDeclaration",
              name: "save",
              parameters: [],
              body: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isAsync: false,
              isGenerator: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makeMethodMarkerCallWithTarget(
          "User",
          "PureAttribute",
          makeSelector("save"),
          makeLiteral("not-a-target")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when .target(...) has wrong arity", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "methodDeclaration",
              name: "save",
              parameters: [],
              body: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isAsync: false,
              isGenerator: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeCall(
                makeMemberAccess(
                  makeCall(
                    makeMemberAccess(
                      makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                        makeIdentifier("User"),
                      ]),
                      "method"
                    ),
                    [makeSelector("save")]
                  ),
                  "target"
                ),
                [] // wrong arity
              ),
              "add"
            ),
            [makeIdentifier("PureAttribute", "Test.PureAttribute")]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when .target(...) receives a spread argument", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "methodDeclaration",
              name: "save",
              parameters: [],
              body: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isAsync: false,
              isGenerator: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makeMethodMarkerCallWithTarget(
          "User",
          "PureAttribute",
          makeSelector("save"),
          makeSpreadArg(makeIdentifier("x"))
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when the selected method does not exist", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "methodDeclaration",
              name: "save",
              parameters: [],
              body: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isAsync: false,
              isGenerator: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makeMethodMarkerCall("User", "PureAttribute", makeSelector("missing")),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4007")).to.be.true;
    });

    it("should error on invalid selector body", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "methodDeclaration",
              name: "save",
              parameters: [],
              body: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isAsync: false,
              isGenerator: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makeMethodMarkerCall(
          "User",
          "PureAttribute",
          makeBadSelectorCallBody("save")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });
  });

  describe("A.on(Class).prop(selector).add(Attr) pattern", () => {
    it("should attach attribute to the selected property", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCall("User", "name", "DataMemberAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const prop = classDecl.members.find(
        (m) => m.kind === "propertyDeclaration"
      );
      expect(
        prop && "attributes" in prop ? prop.attributes : undefined
      ).to.have.length(1);
    });

    it("should support property attribute targets (e.g., field on auto-property)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCallWithTarget(
          "User",
          "name",
          "DataMemberAttribute",
          makeLiteral("field")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      const prop = classDecl.members.find(
        (m) => m.kind === "propertyDeclaration"
      );
      const attr0 = assertDefined(
        prop && "attributes" in prop ? prop.attributes?.[0] : undefined
      );
      expect(attr0.target).to.equal("field");
    });

    it("should reject [field: ...] on accessor properties", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              getterBody: { kind: "blockStatement", statements: [] },
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCallWithTarget(
          "User",
          "name",
          "DataMemberAttribute",
          makeLiteral("field")
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when the selected property does not exist", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [
            {
              kind: "propertyDeclaration",
              name: "name",
              isStatic: false,
              isReadonly: false,
              accessibility: "public",
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrClassDeclaration,
        makePropMarkerCall("User", "missing", "DataMemberAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4007")).to.be.true;
    });
  });

  describe("AttributeDescriptor forms", () => {
    it("should support inline A.attr(...) passed to add()", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeInlineDescriptorMarkerCall("User", "ObsoleteAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.positionalArgs).to.have.length(1);
    });

    it("should support descriptor variables (const d = A.attr(...); add(d))", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeAttrDescriptorDecl("d", "ObsoleteAttribute") as IrStatement,
        makeAddDescriptorMarkerCall("User", "d"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      // Removes both the descriptor declaration and the marker call
      expect(mod.body).to.have.length(1);
      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
    });
  });

  describe("A.on(fn).type.add(Attr) pattern", () => {
    it("should attach attribute to function declaration", () => {
      // IR representation of:
      // function greet() {}
      // A.on(greet).type.add(PureAttribute);
      const module = createModule([
        {
          kind: "functionDeclaration",
          name: "greet",
          parameters: [],
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        } as IrFunctionDeclaration,
        makeMarkerCall(
          "greet",
          "PureAttribute",
          [],
          "System.Diagnostics.Contracts.PureAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      expect(mod.body).to.have.length(1);

      const funcDecl = mod.body[0] as IrFunctionDeclaration;
      expect(funcDecl.kind).to.equal("functionDeclaration");
      expect(funcDecl.attributes).to.have.length(1);
    });
  });

  describe("Error cases", () => {
    it("should error when attribute constructor has no CLR binding and is not a local class", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall("User", "MissingAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4004")).to.be.true;
    });

    it("should allow locally declared attribute types (no CLR binding)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "MyAttr",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall("User", "MyAttr"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const classDecl = mod.body.find(
        (s) => s.kind === "classDeclaration" && s.name === "User"
      ) as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(1);
      const attr = assertDefined(classDecl.attributes?.[0]);
      expect(attr.attributeType).to.deep.equal({
        kind: "referenceType",
        name: "MyAttr",
      });
    });

    it("should emit diagnostic when target not found", () => {
      // IR representation of:
      // A.on(NotExist).type.add(SomeAttribute);
      const module = createModule([
        makeMarkerCall("NotExist", "SomeAttribute", [], "Test.SomeAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.false;
      expect(result.diagnostics).to.have.length(1);
      const diag = assertDefined(result.diagnostics[0]);
      expect(diag.message).to.include("NotExist");
      expect(diag.code).to.equal("TSN4007");
    });

    it("should emit diagnostic when attribute args are not constants", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeIdentifier("notConst"),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error when positional args appear after named args", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([makeObjectProp("IsError", makeLiteral(true))]),
              makeLiteral("too late"),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error on spreads in named arguments object", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([makeObjectSpread(makeIdentifier("x"))]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error when a named argument value is not a constant", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([
                makeObjectProp("IsError", makeIdentifier("notConst")),
              ]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error when a named argument key is not a string", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "add"
            ),
            [
              makeIdentifier("ObsoleteAttribute", "System.ObsoleteAttribute"),
              makeObject([
                makeObjectProp(makeIdentifier("IsError"), makeLiteral(true)),
              ]),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4006")).to.be.true;
    });

    it("should error on unsupported marker call shapes using the attributes API", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "expressionStatement",
          expression: makeCall(
            makeMemberAccess(
              makeMemberAccess(
                makeCall(makeMemberAccess(makeIdentifier("A"), "on"), [
                  makeIdentifier("User"),
                ]),
                "type"
              ),
              "nope"
            ),
            [
              makeIdentifier(
                "SerializableAttribute",
                "System.SerializableAttribute"
              ),
            ]
          ),
        },
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when type target is ambiguous (class and function share name)", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        {
          kind: "functionDeclaration",
          name: "User",
          parameters: [],
          body: { kind: "blockStatement", statements: [] },
          isAsync: false,
          isGenerator: false,
          isExported: true,
        } as IrFunctionDeclaration,
        makeMarkerCall(
          "User",
          "SerializableAttribute",
          [],
          "System.SerializableAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });

    it("should error when applying ctor attributes to a struct without an explicit ctor", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "S",
          implements: [],
          members: [],
          isExported: true,
          isStruct: true,
        } as IrClassDeclaration,
        makeCtorMarkerCall("S", "ObsoleteAttribute"),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
    });
  });

  describe("Modules without attributes", () => {
    it("should pass through modules unchanged when no marker calls", () => {
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;
      expect(result.modules[0]).to.equal(module); // Same reference
    });
  });

  describe("Multiple attributes", () => {
    it("should attach multiple attributes to same declaration", () => {
      // IR representation of:
      // class User {}
      // A.on(User).type.add(SerializableAttribute);
      // A.on(User).type.add(ObsoleteAttribute, "Deprecated");
      const module = createModule([
        {
          kind: "classDeclaration",
          name: "User",
          implements: [],
          members: [],
          isExported: true,
          isStruct: false,
        } as IrClassDeclaration,
        makeMarkerCall(
          "User",
          "SerializableAttribute",
          [],
          "System.SerializableAttribute"
        ),
        makeMarkerCall(
          "User",
          "ObsoleteAttribute",
          [{ kind: "literal", value: "Deprecated" }],
          "System.ObsoleteAttribute"
        ),
      ]);

      const result = runAttributeCollectionPass([module]);

      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      expect(mod.body).to.have.length(1);

      const classDecl = mod.body[0] as IrClassDeclaration;
      expect(classDecl.attributes).to.have.length(2);
    });
  });
});
