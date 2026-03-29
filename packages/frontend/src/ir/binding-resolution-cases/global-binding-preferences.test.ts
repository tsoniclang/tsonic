/**
 * Tests for global binding preference ordering in IR conversion
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import {
  createTestProgram,
  createTestDeclId,
  resolveHierarchicalBinding,
  BindingRegistry,
} from "./helpers.js";
import type { IrIdentifierExpression } from "./helpers.js";

const addClrBindings = (
  bindings: BindingRegistry,
  path: string,
  namespace: string,
  types: readonly {
    readonly clrName: string;
    readonly assemblyName: string;
    readonly methods?: readonly {
      readonly clrName: string;
      readonly normalizedSignature?: string;
      readonly parameterCount?: number;
      readonly declaringClrType: string;
      readonly declaringAssemblyName: string;
      readonly isExtensionMethod?: boolean;
    }[];
    readonly properties?: readonly {
      readonly clrName: string;
      readonly declaringClrType: string;
      readonly declaringAssemblyName: string;
    }[];
  }[]
): void => {
  bindings.addBindings(path, {
    namespace,
    types: types.map((type) => ({
      clrName: type.clrName,
      assemblyName: type.assemblyName,
      methods: type.methods ?? [],
      properties: type.properties ?? [],
      fields: [],
    })),
  });
};

describe("Binding Resolution in IR", () => {
  describe("Global Identifier Resolution — Binding Preferences", () => {
    it("prefers resolved global member owners over polluted ambient identifier types", () => {
      const bindings = new BindingRegistry();
      addClrBindings(bindings, "/test/js.json", "Acme.Js", [
        {
          clrName: "Acme.Js.console",
          assemblyName: "Acme.Js",
          methods: [
            {
              clrName: "error",
              normalizedSignature:
                "error|(System.String):System.Void|static=false",
              parameterCount: 1,
              declaringClrType: "Acme.Js.console",
              declaringAssemblyName: "Acme.Js",
            },
          ],
        },
      ]);

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "console",
          inferredType: { kind: "referenceType", name: "Console" },
          resolvedClrType: "Acme.Js.console",
          resolvedAssembly: "Acme.Js",
        } satisfies IrIdentifierExpression,
        "error",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "Acme.Js",
        type: "Acme.Js.console",
        member: "error",
      });
    });

    it("prefers simple-binding static owners over resolved runtime generic owners for static members", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js-simple.json", {
        bindings: {
          Array: {
            kind: "global",
            assembly: "Acme.Js",
            type: "Acme.Js.ArrayRuntime",
            staticType: "Acme.Js.ArrayStatics",
          },
        },
      });
      addClrBindings(bindings, "/test/js-index.json", "Acme.Js", [
        {
          clrName: "Acme.Js.ArrayRuntime",
          assemblyName: "Acme.Js",
        },
        {
          clrName: "Acme.Js.ArrayStatics",
          assemblyName: "Acme.Js",
          methods: [
            {
              clrName: "isArray",
              normalizedSignature:
                "isArray|(System.Object):System.Boolean|static=true",
              parameterCount: 1,
              declaringClrType: "Acme.Js.ArrayStatics",
              declaringAssemblyName: "Acme.Js",
            },
            {
              clrName: "from",
              normalizedSignature:
                "from|(System.Object):Acme.Js.ArrayRuntime|static=true",
              parameterCount: 1,
              declaringClrType: "Acme.Js.ArrayStatics",
              declaringAssemblyName: "Acme.Js",
            },
          ],
        },
      ]);

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "Array",
          inferredType: { kind: "referenceType", name: "Array" },
          resolvedClrType: "Acme.Js.ArrayRuntime",
          resolvedAssembly: "Acme.Js",
        } satisfies IrIdentifierExpression,
        "isArray",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "Acme.Js",
        type: "Acme.Js.ArrayStatics",
        member: "isArray",
      });
    });

    it("still prefers simple-binding static owners for ambient globals with declarations", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js-simple.json", {
        bindings: {
          Array: {
            kind: "global",
            assembly: "Acme.Js",
            type: "Acme.Js.ArrayRuntime",
            staticType: "Acme.Js.ArrayStatics",
          },
        },
      });
      addClrBindings(bindings, "/test/js-index.json", "Acme.Js", [
        {
          clrName: "Acme.Js.ArrayRuntime",
          assemblyName: "Acme.Js",
        },
        {
          clrName: "Acme.Js.ArrayStatics",
          assemblyName: "Acme.Js",
          methods: [
            {
              clrName: "from",
              normalizedSignature:
                "from|(System.Object):Acme.Js.ArrayRuntime|static=true",
              parameterCount: 1,
              declaringClrType: "Acme.Js.ArrayStatics",
              declaringAssemblyName: "Acme.Js",
            },
          ],
        },
      ]);

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "Array",
          declId: createTestDeclId(1),
          inferredType: { kind: "referenceType", name: "Array" },
          resolvedClrType: "Acme.Js.ArrayRuntime",
          resolvedAssembly: "Acme.Js",
        } satisfies IrIdentifierExpression,
        "from",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "Acme.Js",
        type: "Acme.Js.ArrayStatics",
        member: "from",
      });
    });

    it("prefers simple-binding runtime owners for ambient globals without resolved CLR owners", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js-simple.json", {
        bindings: {
          console: {
            kind: "global",
            assembly: "Acme.Js",
            type: "Acme.Js.console",
          },
        },
      });
      addClrBindings(bindings, "/test/js-index.json", "Acme.Js", [
        {
          clrName: "Acme.Js.console",
          assemblyName: "Acme.Js",
          methods: [
            {
              clrName: "error",
              normalizedSignature:
                "error|(System.String):System.Void|static=false",
              parameterCount: 1,
              declaringClrType: "Acme.Js.console",
              declaringAssemblyName: "Acme.Js",
            },
          ],
        },
      ]);
      addClrBindings(bindings, "/test/system.json", "System", [
        {
          clrName: "System.Console",
          assemblyName: "System.Runtime",
          methods: [
            {
              clrName: "Error",
              normalizedSignature:
                "Error|(System.String):System.Void|static=true",
              parameterCount: 1,
              declaringClrType: "System.Console",
              declaringAssemblyName: "System.Runtime",
            },
          ],
        },
      ]);

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "console",
          declId: createTestDeclId(2),
          inferredType: { kind: "referenceType", name: "Console" },
        } satisfies IrIdentifierExpression,
        "error",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "Acme.Js",
        type: "Acme.Js.console",
        member: "error",
      });
    });

    it("does not misbind lowercase local CLR variables to unrelated global member owners", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/nodejs.json", {
        bindings: {
          process: {
            kind: "global",
            assembly: "Acme.Node",
            type: "Acme.Node.process",
          },
        },
      });
      addClrBindings(
        bindings,
        "/test/system-diagnostics.json",
        "System.Diagnostics",
        [
          {
            clrName: "System.Diagnostics.Process",
            assemblyName: "System.Diagnostics.Process",
            properties: [
              {
                clrName: "ExitCode",
                declaringClrType: "System.Diagnostics.Process",
                declaringAssemblyName: "System.Diagnostics.Process",
              },
            ],
          },
        ]
      );

      const { ctx } = createTestProgram(
        "export function test(): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "process",
          declId: createTestDeclId(3),
          inferredType: {
            kind: "unionType",
            types: [
              { kind: "primitiveType", name: "undefined" },
              { kind: "referenceType", name: "Process" },
            ],
          },
        } satisfies IrIdentifierExpression,
        "ExitCode",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "property",
        assembly: "System.Diagnostics.Process",
        type: "System.Diagnostics.Process",
        member: "ExitCode",
      });
    });

    it("prefers js primitive wrapper owners over CLR instance owners", () => {
      const bindings = new BindingRegistry();
      bindings.addBindings("/test/js-simple.json", {
        bindings: {
          Boolean: {
            kind: "global",
            assembly: "js",
            type: "js.Boolean",
            csharpName: "Globals.Boolean",
          },
        },
      });
      bindings.addBindings("/test/js-index.json", {
        namespace: "js",
        types: [
          {
            clrName: "js.Boolean",
            assemblyName: "js",
            methods: [
              {
                clrName: "toString",
                normalizedSignature:
                  "toString|(System.Boolean):System.String|static=true",
                parameterCount: 1,
                declaringClrType: "js.Boolean",
                declaringAssemblyName: "js",
                isExtensionMethod: true,
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });
      bindings.addBindings("/test/system.json", {
        namespace: "System",
        types: [
          {
            clrName: "System.Boolean",
            assemblyName: "System.Runtime",
            methods: [
              {
                clrName: "ToString",
                normalizedSignature: "ToString|():System.String",
                parameterCount: 0,
                declaringClrType: "System.Boolean",
                declaringAssemblyName: "System.Runtime",
                isExtensionMethod: false,
              },
            ],
            properties: [],
            fields: [],
          },
        ],
      });

      const { ctx } = createTestProgram(
        "export function test(flag: boolean): void {}",
        bindings
      );
      const binding = resolveHierarchicalBinding(
        {
          kind: "identifier",
          name: "flag",
          declId: createTestDeclId(4),
          inferredType: { kind: "primitiveType", name: "boolean" },
        } satisfies IrIdentifierExpression,
        "toString",
        ctx
      );

      expect(binding).to.deep.include({
        kind: "method",
        assembly: "js",
        type: "js.Boolean",
        member: "toString",
      });
      expect(binding?.isExtensionMethod).to.equal(true);
    });
  });
});
