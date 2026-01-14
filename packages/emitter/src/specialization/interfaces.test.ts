/**
 * Tests for Interfaces
 * Covers spec/16-types-and-interfaces.md §2 - Interfaces
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Interfaces (spec/16 §2)", () => {
  it("should emit interface as C# class with auto-properties", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/User.ts",
      namespace: "MyApp",
      className: "User",
      isStaticContainer: false,
      imports: [],
      body: [
        {
          kind: "interfaceDeclaration",
          name: "User",
          typeParameters: undefined,
          extends: [],
          isStruct: false,
          members: [
            {
              kind: "propertySignature",
              name: "id",
              type: { kind: "primitiveType", name: "number" },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "name",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: false,
            },
            {
              kind: "propertySignature",
              name: "active",
              type: { kind: "primitiveType", name: "boolean" },
              isOptional: true,
              isReadonly: false,
            },
          ],
          isExported: true,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Should emit as C# class, not interface
    expect(result).to.include("public class User");
    expect(result).not.to.include("interface User");

    // Should have auto-properties (required for non-optional)
    expect(result).to.include("public required double Id { get; set; }");
    expect(result).to.include("public required string Name { get; set; }");

    // Optional property should be nullable
    expect(result).to.include("public bool? Active { get; set; }");
  });

  it("should emit interface with readonly members", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/Config.ts",
      namespace: "MyApp",
      className: "Config",
      isStaticContainer: false,
      imports: [],
      body: [
        {
          kind: "interfaceDeclaration",
          name: "Config",
          typeParameters: undefined,
          extends: [],
          isStruct: false,
          members: [
            {
              kind: "propertySignature",
              name: "apiUrl",
              type: { kind: "primitiveType", name: "string" },
              isOptional: false,
              isReadonly: true,
            },
          ],
          isExported: true,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Readonly should use init-only setter (required for non-optional + C# 11 required)
    expect(result).to.include("public required string ApiUrl { get; init; }");
  });

  it("should emit generic interface", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/Result.ts",
      namespace: "MyApp",
      className: "Result",
      isStaticContainer: true, // Changed to true to emit at top level
      imports: [],
      body: [
        {
          kind: "interfaceDeclaration",
          name: "Result",
          typeParameters: [
            {
              kind: "typeParameter",
              name: "T",
              constraint: undefined,
              default: undefined,
              variance: undefined,
              isStructuralConstraint: false,
            },
          ],
          extends: [],
          isStruct: false,
          members: [
            {
              kind: "propertySignature",
              name: "data",
              type: { kind: "referenceType", name: "T", typeArguments: [] },
              isOptional: false,
              isReadonly: false,
            },
          ],
          isExported: true,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    // Allow for whitespace variations
    expect(result).to.match(/public\s+class\s+Result\s*<T>/);
    expect(result).to.include("public required T Data { get; set; }");
  });
});
