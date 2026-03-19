import {
  describe,
  it,
  expect,
  selectObjectLiteralUnionMember,
  selectUnionMemberForObjectLiteral,
  type EmitterContext,
  type IrInterfaceMember,
  type IrType,
  type LocalTypeInfo,
} from "./helpers.js";

describe("type-resolution", () => {
  describe("selectUnionMemberForObjectLiteral", () => {
    it("selects synthetic union members from moduleMap", () => {
      const eventsMembers: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "events",
          type: {
            kind: "arrayType",
            elementType: { kind: "primitiveType", name: "string" },
          },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const errorMembers: IrInterfaceMember[] = [
        {
          kind: "propertySignature",
          name: "error",
          type: { kind: "primitiveType", name: "string" },
          isOptional: false,
          isReadonly: false,
        },
      ];

      const syntheticLocalTypes = new Map<string, LocalTypeInfo>([
        [
          "__Anon_events",
          {
            kind: "interface",
            typeParameters: [],
            members: eventsMembers,
            extends: [],
          },
        ],
        [
          "__Anon_error",
          {
            kind: "interface",
            typeParameters: [],
            members: errorMembers,
            extends: [],
          },
        ],
      ]);

      const context: EmitterContext = {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          indent: 4,
          moduleMap: new Map([
            [
              "__tsonic/__tsonic_anonymous_types.g.ts",
              {
                namespace: "Test",
                className: "__tsonic_anonymous_types",
                filePath: "__tsonic/__tsonic_anonymous_types.g.ts",
                hasRuntimeContainer: false,
                hasTypeCollision: false,
                localTypes: syntheticLocalTypes,
              },
            ],
          ]),
        },
        isStatic: false,
        isAsync: false,
        localTypes: new Map<string, LocalTypeInfo>(),
        usings: new Set<string>(),
      };

      const unionType: Extract<IrType, { kind: "unionType" }> = {
        kind: "unionType",
        types: [
          {
            kind: "referenceType",
            name: "__Anon_events",
            resolvedClrType: "Test.__Anon_events",
          },
          {
            kind: "referenceType",
            name: "__Anon_error",
            resolvedClrType: "Test.__Anon_error",
          },
        ],
      };

      const selected = selectUnionMemberForObjectLiteral(
        unionType,
        ["events"],
        context
      );

      expect(selected?.kind).to.equal("referenceType");
      expect(selected?.name).to.equal("__Anon_events");
    });

    it("selects dictionary members from object-or-callback unions", () => {
      const context: EmitterContext = {
        indentLevel: 0,
        options: {
          rootNamespace: "Test",
          indent: 4,
        },
        isStatic: false,
        isAsync: false,
        usings: new Set<string>(),
      };

      const unionType: Extract<IrType, { kind: "unionType" }> = {
        kind: "unionType",
        types: [
          {
            kind: "dictionaryType",
            keyType: { kind: "primitiveType", name: "string" },
            valueType: { kind: "unknownType" },
          },
          {
            kind: "functionType",
            parameters: [
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "error" },
                type: { kind: "unknownType" },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
              {
                kind: "parameter",
                pattern: { kind: "identifierPattern", name: "html" },
                type: { kind: "primitiveType", name: "string" },
                isOptional: false,
                isRest: false,
                passing: "value",
              },
            ],
            returnType: { kind: "voidType" },
          },
        ],
      };

      const selected = selectObjectLiteralUnionMember(
        unionType,
        ["name"],
        context
      );

      expect(selected?.kind).to.equal("dictionaryType");
    });
  });
});
