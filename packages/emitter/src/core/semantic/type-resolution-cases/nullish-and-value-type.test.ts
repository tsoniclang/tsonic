import {
  describe,
  it,
  expect,
  resolveTypeAlias,
  stripNullish,
  isDefinitelyValueType,
  type EmitterContext,
  type EmitterOptions,
  type IrType,
  type LocalTypeInfo,
} from "./helpers.js";
import { identifierType } from "../../format/backend-ast/builders.js";

describe("type-resolution", () => {
  const makeContext = (
    localTypes?: ReadonlyMap<string, LocalTypeInfo>,
    options?: Partial<EmitterOptions>
  ): EmitterContext => ({
    indentLevel: 0,
    options: {
      rootNamespace: "App",
      indent: 2,
      ...options,
    },
    isStatic: false,
    isAsync: false,
    localTypes,
    usings: new Set<string>(),
  });

  describe("stripNullish", () => {
    it("returns non-union types unchanged", () => {
      const type: IrType = { kind: "primitiveType", name: "string" };
      expect(stripNullish(type)).to.deep.equal(type);
    });

    it("strips null from T | null union", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "null" },
        ],
      };
      const result = stripNullish(type);
      expect(result).to.deep.equal({ kind: "primitiveType", name: "number" });
    });

    it("strips undefined from T | undefined union", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "referenceType", name: "MyType" },
          { kind: "primitiveType", name: "undefined" },
        ],
      };
      const result = stripNullish(type);
      expect(result).to.deep.equal({ kind: "referenceType", name: "MyType" });
    });

    it("strips both null and undefined from T | null | undefined", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          {
            kind: "referenceType",
            name: "Option",
            typeArguments: [{ kind: "typeParameterType", name: "T" }],
          },
          { kind: "primitiveType", name: "null" },
          { kind: "primitiveType", name: "undefined" },
        ],
      };
      const result = stripNullish(type);
      expect(result).to.deep.equal({
        kind: "referenceType",
        name: "Option",
        typeArguments: [{ kind: "typeParameterType", name: "T" }],
      });
    });

    it("strips nullish members while preserving multi-member unions", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "null" },
        ],
      };
      const result = stripNullish(type);
      expect(result).to.deep.equal({
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "string" },
        ],
      });
    });

    it("leaves non-nullish runtime-union carriers unchanged", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          {
            kind: "referenceType",
            name: "RegExp",
            resolvedClrType: "js.RegExp",
          },
        ],
        runtimeCarrierFamilyKey:
          "runtime-union:canonical:prim:string|ref#0:clr:js.RegExp::",
      };

      expect(stripNullish(type)).to.equal(type);
    });

    it("preserves runtime-union carrier family while removing nullish members", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "string" },
          {
            kind: "referenceType",
            name: "RegExp",
            resolvedClrType: "js.RegExp",
          },
          { kind: "primitiveType", name: "undefined" },
        ],
        runtimeCarrierFamilyKey:
          "runtime-union:canonical:prim:string|ref#0:clr:js.RegExp::",
      };

      const result = stripNullish(type);
      expect(result.kind).to.equal("unionType");
      expect(
        result.kind === "unionType" ? result.runtimeCarrierFamilyKey : undefined
      ).to.equal("runtime-union:canonical:prim:string|ref#0:clr:js.RegExp::");
    });
  });

  describe("resolveTypeAlias", () => {
    it("resolves imported callable aliases from the exact import binding", () => {
      const requestHandler: LocalTypeInfo = {
        kind: "typeAlias",
        typeParameters: [],
        type: {
          kind: "functionType",
          parameters: [
            {
              kind: "parameter",
              pattern: { kind: "identifierPattern", name: "req" },
              type: { kind: "primitiveType", name: "string" },
              initializer: undefined,
              isOptional: false,
              isRest: false,
              passing: "value",
            },
          ],
          returnType: { kind: "voidType" },
        },
      };

      const result = resolveTypeAlias(
        { kind: "referenceType", name: "RequestHandler" },
        {
          ...makeContext(),
          importBindings: new Map([
            [
              "RequestHandler",
              {
                kind: "type",
                typeAst: identifierType(
                  "global::App.express.runtime.RequestHandler"
                ),
                aliasType: requestHandler.type,
                aliasTypeParameters: requestHandler.typeParameters,
              },
            ],
          ]),
        }
      );

      expect(result).to.deep.equal(requestHandler.type);
    });

    it("does not resolve non-alias imports through unrelated leaf aliases", () => {
      const unrelatedReadableAlias: LocalTypeInfo = {
        kind: "typeAlias",
        typeParameters: [],
        type: {
          kind: "unknownType",
          explicit: true,
        },
      };

      const ref: IrType = { kind: "referenceType", name: "Readable" };
      const result = resolveTypeAlias(ref, {
        ...makeContext(undefined, {
          moduleMap: new Map([
            [
              "/nodejs/stream/readable.ts",
              {
                namespace: "nodejs.stream",
                className: "readable",
                filePath: "/nodejs/stream/readable.ts",
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                localTypes: new Map(),
              },
            ],
            [
              "/nodejs/child_process/child-process.ts",
              {
                namespace: "nodejs.child_process",
                className: "child_process",
                filePath: "/nodejs/child_process/child-process.ts",
                hasRuntimeContainer: true,
                hasTypeCollision: false,
                localTypes: new Map([["Readable", unrelatedReadableAlias]]),
              },
            ],
          ]),
        }),
        importBindings: new Map([
          [
            "Readable",
            {
              kind: "type",
              typeAst: identifierType("global::nodejs.stream.Readable"),
            },
          ],
        ]),
      });

      expect(result).to.deep.equal(ref);
    });

    it("resolves non-alias imports through the exact imported namespace", () => {
      const readableAliasType: IrType = {
        kind: "primitiveType",
        name: "string",
      };

      const result = resolveTypeAlias(
        { kind: "referenceType", name: "Readable" },
        {
          ...makeContext(undefined, {
            moduleMap: new Map([
              [
                "/nodejs/stream/readable.ts",
                {
                  namespace: "nodejs.stream",
                  className: "readable",
                  filePath: "/nodejs/stream/readable.ts",
                  hasRuntimeContainer: true,
                  hasTypeCollision: false,
                  localTypes: new Map([
                    [
                      "Readable",
                      {
                        kind: "typeAlias",
                        typeParameters: [],
                        type: readableAliasType,
                      },
                    ],
                  ]),
                },
              ],
            ]),
          }),
          importBindings: new Map([
            [
              "Readable",
              {
                kind: "type",
                typeAst: identifierType("global::nodejs.stream.Readable"),
              },
            ],
          ]),
        }
      );

      expect(result).to.deep.equal(readableAliasType);
    });

    it("resolves cross-module callable aliases from exact type identity", () => {
      const requestHandlerType: IrType = {
        kind: "functionType",
        parameters: [
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "req" },
            type: { kind: "primitiveType", name: "string" },
            initializer: undefined,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "res" },
            type: { kind: "primitiveType", name: "string" },
            initializer: undefined,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
          {
            kind: "parameter",
            pattern: { kind: "identifierPattern", name: "next" },
            type: {
              kind: "functionType",
              parameters: [],
              returnType: { kind: "voidType" },
            },
            initializer: undefined,
            isOptional: false,
            isRest: false,
            passing: "value",
          },
        ],
        returnType: { kind: "unknownType", explicit: true },
      };

      const result = resolveTypeAlias(
        {
          kind: "referenceType",
          name: "RequestHandler",
          typeId: {
            stableId: "App:App.express.runtime.RequestHandler",
            clrName: "App.express.runtime.RequestHandler",
            assemblyName: "App",
            tsName: "RequestHandler",
          },
        },
        makeContext(undefined, {
          typeAliasIndex: {
            byFqn: new Map([
              [
                "App.express.runtime.RequestHandler",
                {
                  fqn: "App.express.runtime.RequestHandler",
                  name: "RequestHandler",
                  type: requestHandlerType,
                  typeParameters: [],
                },
              ],
            ]),
          },
        })
      );

      expect(result).to.deep.equal(requestHandlerType);
    });
  });

  describe("isDefinitelyValueType", () => {
    it("returns true for number primitive", () => {
      const type: IrType = { kind: "primitiveType", name: "number" };
      expect(isDefinitelyValueType(type)).to.be.true;
    });

    it("returns true for boolean primitive", () => {
      const type: IrType = { kind: "primitiveType", name: "boolean" };
      expect(isDefinitelyValueType(type)).to.be.true;
    });

    it("returns false for string primitive", () => {
      const type: IrType = { kind: "primitiveType", name: "string" };
      expect(isDefinitelyValueType(type)).to.be.false;
    });

    it("returns true for number | null (strips nullish first)", () => {
      const type: IrType = {
        kind: "unionType",
        types: [
          { kind: "primitiveType", name: "number" },
          { kind: "primitiveType", name: "null" },
        ],
      };
      expect(isDefinitelyValueType(type)).to.be.true;
    });

    it("returns false for type parameters", () => {
      const type: IrType = { kind: "typeParameterType", name: "T" };
      expect(isDefinitelyValueType(type)).to.be.false;
    });

    it("returns false for reference types without resolvedClrType", () => {
      const type: IrType = { kind: "referenceType", name: "MyClass" };
      expect(isDefinitelyValueType(type)).to.be.false;
    });

    it("returns true for exact numeric reference aliases without resolvedClrType", () => {
      for (const name of [
        "byte",
        "sbyte",
        "short",
        "ushort",
        "int",
        "uint",
        "long",
        "ulong",
        "nint",
        "nuint",
        "float",
        "double",
        "decimal",
        "char",
      ] as const) {
        const type: IrType = { kind: "referenceType", name };
        expect(isDefinitelyValueType(type), name).to.be.true;
      }
    });

    it("returns true for known CLR value type (System.DateTime)", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "DateTime",
        resolvedClrType: "global::System.DateTime",
      };
      expect(isDefinitelyValueType(type)).to.be.true;
    });

    it("returns true for known CLR value type (System.Guid)", () => {
      const type: IrType = {
        kind: "referenceType",
        name: "Guid",
        resolvedClrType: "System.Guid",
      };
      expect(isDefinitelyValueType(type)).to.be.true;
    });
  });
});
