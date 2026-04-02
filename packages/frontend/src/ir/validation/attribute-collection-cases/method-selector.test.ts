/**
 * Tests for A<T>().method(selector).add(Attr) pattern.
 */

import {
  assertDefined,
  createModule,
  describe,
  expect,
  it,
  makeBadSelectorCallBody,
  makeCall,
  makeIdentifier,
  makeLiteral,
  makeMemberAccess,
  makeMethodMarkerCall,
  makeMethodMarkerCallWithTarget,
  makeSelector,
  makeSpreadArg,
  makeTypeRootCall,
  makeWrappedSelector,
  runAttributeCollectionPass,
} from "./helpers.js";
import type { IrClassDeclaration, IrInterfaceDeclaration } from "./helpers.js";

describe("Attribute Collection Pass", () => {
  describe("A<T>().method(selector).add(Attr) pattern", () => {
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

    it("should attach attribute to the selected interface method", () => {
      const module = createModule([
        {
          kind: "interfaceDeclaration",
          name: "IUser",
          extends: [],
          typeParameters: [],
          members: [
            {
              kind: "methodSignature",
              name: "save",
              parameters: [],
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrInterfaceDeclaration,
        makeMethodMarkerCall("IUser", "PureAttribute", makeSelector("save")),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.true;
      const mod = assertDefined(result.modules[0]);
      const ifaceDecl = mod.body[0] as IrInterfaceDeclaration;
      const method = ifaceDecl.members.find((m) => m.kind === "methodSignature");
      expect(
        method && "attributes" in method ? method.attributes : undefined
      ).to.have.length(1);
    });

    it("should reject selectors that are ambiguous across overloaded interface methods", () => {
      const module = createModule([
        {
          kind: "interfaceDeclaration",
          name: "IReader",
          extends: [],
          typeParameters: [],
          members: [
            {
              kind: "methodSignature",
              name: "read",
              parameters: [
                {
                  kind: "parameter",
                  pattern: { kind: "identifierPattern", name: "path" },
                  type: { kind: "primitiveType", name: "string" },
                  initializer: undefined,
                  isOptional: false,
                  isRest: false,
                  passing: "value",
                },
              ],
            },
            {
              kind: "methodSignature",
              name: "read",
              parameters: [
                {
                  kind: "parameter",
                  pattern: { kind: "identifierPattern", name: "fd" },
                  type: { kind: "primitiveType", name: "number" },
                  initializer: undefined,
                  isOptional: false,
                  isRest: false,
                  passing: "value",
                },
              ],
            },
          ],
          isExported: true,
          isStruct: false,
        } as unknown as IrInterfaceDeclaration,
        makeMethodMarkerCall("IReader", "PureAttribute", makeSelector("read")),
      ]);

      const result = runAttributeCollectionPass([module]);
      expect(result.ok).to.be.false;
      expect(result.diagnostics.some((d) => d.code === "TSN4005")).to.be.true;
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

    it("should accept selectors whose parameter identifier is wrapped in transparent assertions", () => {
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
          makeWrappedSelector("save")
        ),
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
                  makeCall(makeMemberAccess(makeTypeRootCall("User"), "method"), [
                    makeSelector("save"),
                  ]),
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
});
