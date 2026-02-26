/**
 * Tests for attribute emission
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitAttributes, emitParameterAttributes } from "./attributes.js";
import { printAttributes, printExpression } from "./backend-ast/printer.js";
import { getIndent } from "../../types.js";
import type { IrAttribute } from "@tsonic/frontend";
import type { EmitterContext, EmitterOptions } from "../../types.js";
import type { CSharpAttributeAst } from "./backend-ast/types.js";

const defaultOptions: EmitterOptions = {
  rootNamespace: "Test",
  indent: 2,
};

/**
 * Create a minimal emitter context for testing
 */
const createContext = (indentLevel = 0): EmitterContext => ({
  indentLevel,
  options: defaultOptions,
  isStatic: false,
  isAsync: false,
  usings: new Set<string>(),
});

/**
 * Format attribute ASTs as declaration-level text (multi-line with indent)
 */
const formatAttrs = (
  attrs: readonly CSharpAttributeAst[],
  context: EmitterContext
): string => printAttributes(attrs, getIndent(context));

/**
 * Format attribute ASTs as inline parameter attributes: [Attr1][Attr2]<space>
 */
const formatInlineAttrs = (attrs: readonly CSharpAttributeAst[]): string => {
  if (attrs.length === 0) return "";
  return (
    attrs
      .map((a) => {
        const targetPrefix = a.target ? `${a.target}: ` : "";
        const args =
          a.arguments && a.arguments.length > 0
            ? `(${a.arguments.map(printExpression).join(", ")})`
            : "";
        return `[${targetPrefix}${a.name}${args}]`;
      })
      .join("") + " "
  );
};

describe("Attribute Emission", () => {
  describe("emitAttributes", () => {
    it("should return empty array when no attributes", () => {
      const context = createContext();
      const [result, _ctx] = emitAttributes(undefined, context);
      expect(result).to.deep.equal([]);
    });

    it("should return empty array for empty input", () => {
      const context = createContext();
      const [result, _ctx] = emitAttributes([], context);
      expect(result).to.deep.equal([]);
    });

    it("should emit single attribute without arguments", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "SerializableAttribute",
          resolvedClrType: "System.SerializableAttribute",
        },
        positionalArgs: [],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include("[global::System.SerializableAttribute]");
    });

    it("should emit attribute target specifier when provided", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        target: "return",
        attributeType: {
          kind: "referenceType",
          name: "MarshalAsAttribute",
          resolvedClrType: "System.Runtime.InteropServices.MarshalAsAttribute",
        },
        positionalArgs: [
          {
            kind: "enum",
            type: {
              kind: "referenceType",
              name: "UnmanagedType",
              resolvedClrType: "System.Runtime.InteropServices.UnmanagedType",
            },
            member: "Bool",
          },
        ],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include(
        "[return: global::System.Runtime.InteropServices.MarshalAsAttribute(global::System.Runtime.InteropServices.UnmanagedType.Bool)]"
      );
    });

    it("should emit attribute with positional string argument", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "ObsoleteAttribute",
          resolvedClrType: "System.ObsoleteAttribute",
        },
        positionalArgs: [{ kind: "string", value: "Use NewClass instead" }],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include("System.ObsoleteAttribute");
      expect(text).to.include('"Use NewClass instead"');
    });

    it("should emit attribute with positional number argument", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "CustomAttribute",
          resolvedClrType: "MyApp.CustomAttribute",
        },
        positionalArgs: [{ kind: "number", value: 42 }],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include("MyApp.CustomAttribute");
      expect(text).to.include("(42)");
    });

    it("should emit attribute with positional boolean argument", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "DebugAttribute",
          resolvedClrType: "Debug.DebugAttribute",
        },
        positionalArgs: [{ kind: "boolean", value: true }],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include("(true)");
    });

    it("should emit attribute with named arguments", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "DataContractAttribute",
          resolvedClrType: "System.Runtime.Serialization.DataContractAttribute",
        },
        positionalArgs: [],
        namedArgs: new Map([
          ["Name", { kind: "string", value: "UserDTO" }],
          ["Namespace", { kind: "string", value: "urn:example" }],
        ]),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include("DataContractAttribute");
      expect(text).to.include('Name = "UserDTO"');
      expect(text).to.include('Namespace = "urn:example"');
    });

    it("should emit attribute with mixed positional and named arguments", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "ObsoleteAttribute",
          resolvedClrType: "System.ObsoleteAttribute",
        },
        positionalArgs: [{ kind: "string", value: "Deprecated" }],
        namedArgs: new Map([["IsError", { kind: "boolean", value: true }]]),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include('"Deprecated"');
      expect(text).to.include("IsError = true");
    });

    it("should emit multiple attributes on separate lines", () => {
      const context = createContext();
      const attrs: IrAttribute[] = [
        {
          kind: "attribute",
          attributeType: {
            kind: "referenceType",
            name: "SerializableAttribute",
            resolvedClrType: "System.SerializableAttribute",
          },
          positionalArgs: [],
          namedArgs: new Map(),
        },
        {
          kind: "attribute",
          attributeType: {
            kind: "referenceType",
            name: "ObsoleteAttribute",
            resolvedClrType: "System.ObsoleteAttribute",
          },
          positionalArgs: [{ kind: "string", value: "Old" }],
          namedArgs: new Map(),
        },
      ];
      const [result, _ctx] = emitAttributes(attrs, context);
      const text = formatAttrs(result, context);
      const lines = text.split("\n").filter((l) => l.length > 0);
      expect(lines).to.have.length(2);
      expect(lines[0]).to.include("SerializableAttribute");
      expect(lines[1]).to.include("ObsoleteAttribute");
    });

    it("should respect indentation level", () => {
      const context = createContext(2); // indent level 2
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "TestAttribute",
          resolvedClrType: "Test.TestAttribute",
        },
        positionalArgs: [],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      // Should have 4 spaces (2 * 2 spaces per level)
      expect(text).to.match(/^ {4}\[/);
    });

    it("should emit typeof argument", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "TypeConverterAttribute",
          resolvedClrType: "System.ComponentModel.TypeConverterAttribute",
        },
        positionalArgs: [
          {
            kind: "typeof",
            type: {
              kind: "referenceType",
              name: "CustomConverter",
              resolvedClrType: "MyApp.CustomConverter",
            },
          },
        ],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include("typeof(global::MyApp.CustomConverter)");
    });

    it("should emit enum argument", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "JsonPropertyAttribute",
          resolvedClrType: "Newtonsoft.Json.JsonPropertyAttribute",
        },
        positionalArgs: [
          {
            kind: "enum",
            type: {
              kind: "referenceType",
              name: "Required",
              resolvedClrType: "Newtonsoft.Json.Required",
            },
            member: "Always",
          },
        ],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include("Newtonsoft.Json.Required.Always");
    });

    it("should emit array argument", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "IndexAttribute",
          resolvedClrType: "Microsoft.EntityFrameworkCore.IndexAttribute",
        },
        positionalArgs: [
          {
            kind: "array",
            elements: [
              { kind: "string", value: "PropertyId" },
              { kind: "string", value: "Ts" },
            ],
          },
        ],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include('new[] { "PropertyId", "Ts" }');
    });

    it("should escape special characters in string arguments", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "DescriptionAttribute",
          resolvedClrType: "System.ComponentModel.DescriptionAttribute",
        },
        positionalArgs: [{ kind: "string", value: 'Say "Hello" and \\escape' }],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitAttributes([attr], context);
      const text = formatAttrs(result, context);
      expect(text).to.include('"Say \\"Hello\\" and \\\\escape"');
    });
  });

  describe("emitParameterAttributes", () => {
    it("should return empty array when no attributes", () => {
      const context = createContext();
      const [result, _ctx] = emitParameterAttributes(undefined, context);
      expect(result).to.deep.equal([]);
    });

    it("should emit inline attribute with trailing space", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        attributeType: {
          kind: "referenceType",
          name: "NotNullAttribute",
          resolvedClrType: "System.Diagnostics.CodeAnalysis.NotNullAttribute",
        },
        positionalArgs: [],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitParameterAttributes([attr], context);
      const text = formatInlineAttrs(result);
      expect(text).to.match(/^\[.*\] $/);
      expect(text).to.include("NotNullAttribute");
    });

    it("should emit inline attribute target specifier when provided", () => {
      const context = createContext();
      const attr: IrAttribute = {
        kind: "attribute",
        target: "param",
        attributeType: {
          kind: "referenceType",
          name: "InAttribute",
          resolvedClrType: "System.Runtime.InteropServices.InAttribute",
        },
        positionalArgs: [],
        namedArgs: new Map(),
      };
      const [result, _ctx] = emitParameterAttributes([attr], context);
      const text = formatInlineAttrs(result);
      expect(text).to.include(
        "[param: global::System.Runtime.InteropServices.InAttribute]"
      );
      expect(text).to.match(/ $/);
    });

    it("should emit multiple inline attributes", () => {
      const context = createContext();
      const attrs: IrAttribute[] = [
        {
          kind: "attribute",
          attributeType: {
            kind: "referenceType",
            name: "NotNullAttribute",
            resolvedClrType: "System.Diagnostics.CodeAnalysis.NotNullAttribute",
          },
          positionalArgs: [],
          namedArgs: new Map(),
        },
        {
          kind: "attribute",
          attributeType: {
            kind: "referenceType",
            name: "CallerMemberNameAttribute",
            resolvedClrType:
              "System.Runtime.CompilerServices.CallerMemberNameAttribute",
          },
          positionalArgs: [],
          namedArgs: new Map(),
        },
      ];
      const [result, _ctx] = emitParameterAttributes(attrs, context);
      const text = formatInlineAttrs(result);
      // Should be on same line: [Attr1][Attr2]<space>
      expect(text).to.not.include("\n");
      expect(text).to.include("NotNullAttribute");
      expect(text).to.include("CallerMemberNameAttribute");
      expect(text).to.match(/ $/);
    });
  });
});
