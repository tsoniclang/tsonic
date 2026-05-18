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
    readonly targetName: string;
    readonly ownerIdentity: string;
    readonly methods?: readonly {
      readonly targetName: string;
      readonly normalizedSignature?: string;
      readonly parameterCount?: number;
      readonly ownerQualifiedName: string;
      readonly ownerIdentity: string;
      readonly isExtensionMethod?: boolean;
    }[];
    readonly properties?: readonly {
      readonly targetName: string;
      readonly ownerQualifiedName: string;
      readonly ownerIdentity: string;
    }[];
  }[]
): void => {
  bindings.addBindings(path, {
    namespace,
    types: types.map((type) => ({
      targetName: type.targetName,
      ownerIdentity: type.ownerIdentity,
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
          targetName: "Acme.Js.console",
          ownerIdentity: "Acme.Js",
          methods: [
            {
              targetName: "error",
              normalizedSignature:
                "error|(System.String):System.Void|static=false",
              parameterCount: 1,
              ownerQualifiedName: "Acme.Js.console",
              ownerIdentity: "Acme.Js",
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
          targetQualifiedName: "Acme.Js.console",
          targetOwnerIdentity: "Acme.Js",
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
          targetName: "Acme.Js.ArrayRuntime",
          ownerIdentity: "Acme.Js",
        },
        {
          targetName: "Acme.Js.ArrayStatics",
          ownerIdentity: "Acme.Js",
          methods: [
            {
              targetName: "isArray",
              normalizedSignature:
                "isArray|(System.Object):System.Boolean|static=true",
              parameterCount: 1,
              ownerQualifiedName: "Acme.Js.ArrayStatics",
              ownerIdentity: "Acme.Js",
            },
            {
              targetName: "from",
              normalizedSignature:
                "from|(System.Object):Acme.Js.ArrayRuntime|static=true",
              parameterCount: 1,
              ownerQualifiedName: "Acme.Js.ArrayStatics",
              ownerIdentity: "Acme.Js",
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
          targetQualifiedName: "Acme.Js.ArrayRuntime",
          targetOwnerIdentity: "Acme.Js",
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
          targetName: "Acme.Js.ArrayRuntime",
          ownerIdentity: "Acme.Js",
        },
        {
          targetName: "Acme.Js.ArrayStatics",
          ownerIdentity: "Acme.Js",
          methods: [
            {
              targetName: "from",
              normalizedSignature:
                "from|(System.Object):Acme.Js.ArrayRuntime|static=true",
              parameterCount: 1,
              ownerQualifiedName: "Acme.Js.ArrayStatics",
              ownerIdentity: "Acme.Js",
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
          targetQualifiedName: "Acme.Js.ArrayRuntime",
          targetOwnerIdentity: "Acme.Js",
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
          targetName: "Acme.Js.console",
          ownerIdentity: "Acme.Js",
          methods: [
            {
              targetName: "error",
              normalizedSignature:
                "error|(System.String):System.Void|static=false",
              parameterCount: 1,
              ownerQualifiedName: "Acme.Js.console",
              ownerIdentity: "Acme.Js",
            },
          ],
        },
      ]);
      addClrBindings(bindings, "/test/system.json", "System", [
        {
          targetName: "System.Console",
          ownerIdentity: "System.Runtime",
          methods: [
            {
              targetName: "Error",
              normalizedSignature:
                "Error|(System.String):System.Void|static=true",
              parameterCount: 1,
              ownerQualifiedName: "System.Console",
              ownerIdentity: "System.Runtime",
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
            targetName: "System.Diagnostics.Process",
            ownerIdentity: "System.Diagnostics.Process",
            properties: [
              {
                targetName: "ExitCode",
                ownerQualifiedName: "System.Diagnostics.Process",
                ownerIdentity: "System.Diagnostics.Process",
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
            targetMemberName: "Globals.Boolean",
          },
        },
      });
      bindings.addBindings("/test/js-index.json", {
        namespace: "js",
        types: [
          {
            targetName: "js.Boolean",
            ownerIdentity: "js",
            methods: [
              {
                targetName: "toString",
                normalizedSignature:
                  "toString|(System.Boolean):System.String|static=true",
                parameterCount: 1,
                ownerQualifiedName: "js.Boolean",
                ownerIdentity: "js",
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
            targetName: "System.Boolean",
            ownerIdentity: "System.Runtime",
            methods: [
              {
                targetName: "ToString",
                normalizedSignature: "ToString|():System.String",
                parameterCount: 0,
                ownerQualifiedName: "System.Boolean",
                ownerIdentity: "System.Runtime",
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
