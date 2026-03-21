import {
  baseContext,
  clrTypeNameToTypeAst,
  createModuleWithType,
  describe,
  emitModule,
  emitReferenceType,
  expect,
  it,
  printType,
} from "./helpers.js";
import type { IrModule } from "./helpers.js";
describe("Reference Type Emission", () => {
  describe("Pre-resolved CLR Types", () => {
    it("should use resolvedClrType when present", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Action",
        resolvedClrType: "global::System.Action",
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Action");
    });

    it("should use resolvedClrType with type arguments", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Func",
        resolvedClrType: "global::System.Func",
        typeArguments: [
          { kind: "primitiveType", name: "string" },
          { kind: "primitiveType", name: "number" },
        ],
      });

      const result = emitModule(module);

      expect(result).to.include("global::System.Func<string, double>");
    });

    it("should sanitize CLR metadata generic names in resolvedClrType", () => {
      const module = createModuleWithType({
        kind: "referenceType",
        name: "Ok",
        resolvedClrType: "Jotster.Core.types.Ok__Alias`1",
        typeArguments: [{ kind: "primitiveType", name: "string" }],
      });

      const result = emitModule(module);

      expect(result).to.include("global::Jotster.Core.types.Ok__Alias<string>");
      expect(result).to.not.include("Ok__Alias`1");
    });
  });

  describe("Imported Type Identity", () => {
    it("should map Foo$instance to imported Foo CLR type", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "@jotster/core/Jotster.Core.js",
            isLocal: false,
            isClr: true,
            resolvedNamespace: "Jotster.Core",
            specifiers: [
              {
                kind: "named",
                name: "Channel",
                localName: "Channel",
                isType: true,
                resolvedClrType: "Jotster.Core.db.entities.Channel",
              },
            ],
          },
        ],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "x" },
                type: {
                  kind: "referenceType",
                  name: "Channel$instance",
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);
      expect(result).to.include("global::Jotster.Core.db.entities.Channel x");
    });

    it("should sanitize imported CLR metadata generic names", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "@jotster/core/Jotster.Core.types.js",
            isLocal: false,
            isClr: true,
            resolvedNamespace: "Jotster.Core.types",
            specifiers: [
              {
                kind: "named",
                name: "Ok",
                localName: "Ok",
                isType: true,
                resolvedClrType: "Jotster.Core.types.Ok__Alias`1",
              },
            ],
          },
        ],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "x" },
                type: {
                  kind: "referenceType",
                  name: "Ok",
                  typeArguments: [{ kind: "primitiveType", name: "string" }],
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);

      expect(result).to.include(
        "global::Jotster.Core.types.Ok__Alias<string> x"
      );
      expect(result).to.not.include("Ok__Alias`1");
    });

    it("should emit imported primitive aliases as C# primitives", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "MetricName",
        },
        {
          ...baseContext,
          importBindings: new Map([
            [
              "MetricName",
              {
                kind: "type",
                typeAst: clrTypeNameToTypeAst("string"),
              },
            ],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("string");
    });

    it("should emit arrays of imported primitive aliases without global qualification", () => {
      const [typeAst] = emitReferenceType(
        {
          kind: "referenceType",
          name: "Array",
          typeArguments: [
            {
              kind: "referenceType",
              name: "MetricName",
            },
          ],
        },
        {
          ...baseContext,
          importBindings: new Map([
            [
              "MetricName",
              {
                kind: "type",
                typeAst: clrTypeNameToTypeAst("string"),
              },
            ],
          ]),
        }
      );

      expect(printType(typeAst)).to.equal("string[]");
    });

    it("should use module-bound imported type FQNs instead of module container members", () => {
      const module: IrModule = {
        kind: "module",
        filePath: "/src/test.ts",
        namespace: "Test",
        className: "Test",
        isStaticContainer: true,
        imports: [
          {
            kind: "import",
            source: "node:http",
            isLocal: false,
            isClr: false,
            resolvedClrType: "nodejs.Http.http",
            specifiers: [
              {
                kind: "named",
                name: "IncomingMessage",
                localName: "IncomingMessage",
                isType: true,
                resolvedClrType: "nodejs.Http.IncomingMessage",
              },
            ],
          },
        ],
        body: [
          {
            kind: "variableDeclaration",
            declarationKind: "const",
            isExported: false,
            declarations: [
              {
                kind: "variableDeclarator",
                name: { kind: "identifierPattern", name: "req" },
                type: {
                  kind: "referenceType",
                  name: "IncomingMessage$instance",
                },
                initializer: { kind: "literal", value: null },
              },
            ],
          },
        ],
        exports: [],
      };

      const result = emitModule(module);
      expect(result).to.include("global::nodejs.Http.IncomingMessage req");
      expect(result).not.to.include("global::nodejs.Http.http.IncomingMessage");
    });
  });
});
