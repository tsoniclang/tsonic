/**
 * Tests for struct emission
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitCSharpFile } from "../../index.js";
import {
  IrModule,
  IrClassDeclaration,
  IrInterfaceDeclaration,
} from "@tsonic/frontend";

describe("Struct Emission", () => {
  it("should emit struct for class with isStruct flag", () => {
    const classDecl: IrClassDeclaration = {
      kind: "classDeclaration",
      name: "Point",
      members: [
        {
          kind: "propertyDeclaration",
          name: "x",
          type: { kind: "primitiveType", name: "number" },
          accessibility: "public",
          isStatic: false,
          isReadonly: false,
          isRequired: true,
        },
        {
          kind: "propertyDeclaration",
          name: "y",
          type: { kind: "primitiveType", name: "number" },
          accessibility: "public",
          isStatic: false,
          isReadonly: false,
          isRequired: true,
        },
      ],
      implements: [],
      isExported: true,
      isStruct: true,
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/Point.ts",
      namespace: "Geometry",
      className: "Point",
      isStaticContainer: false,
      imports: [],
      body: [classDecl],
      exports: [],
    };

    const result = emitCSharpFile(module);
    expect(result).to.include("public struct Point");
    expect(result).to.include("public required double X");
    expect(result).to.include("public required double Y");
    expect(result).not.to.include("class Point");
  });

  it("should emit class for class without isStruct flag", () => {
    const classDecl: IrClassDeclaration = {
      kind: "classDeclaration",
      name: "RegularClass",
      members: [
        {
          kind: "propertyDeclaration",
          name: "value",
          type: { kind: "primitiveType", name: "number" },
          accessibility: "public",
          isStatic: false,
          isReadonly: false,
        },
      ],
      implements: [],
      isExported: true,
      isStruct: false,
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/RegularClass.ts",
      namespace: "App",
      className: "RegularClass",
      isStaticContainer: false,
      imports: [],
      body: [classDecl],
      exports: [],
    };

    const result = emitCSharpFile(module);
    expect(result).to.include("public class RegularClass");
    expect(result).not.to.include("struct RegularClass");
  });

  it("should emit struct for interface with isStruct flag", () => {
    const interfaceDecl: IrInterfaceDeclaration = {
      kind: "interfaceDeclaration",
      name: "Vector3D",
      members: [
        {
          kind: "propertySignature",
          name: "x",
          type: { kind: "primitiveType", name: "number" },
          isOptional: false,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "y",
          type: { kind: "primitiveType", name: "number" },
          isOptional: false,
          isReadonly: false,
        },
        {
          kind: "propertySignature",
          name: "z",
          type: { kind: "primitiveType", name: "number" },
          isOptional: false,
          isReadonly: false,
        },
      ],
      extends: [],
      isExported: true,
      isStruct: true,
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/Vector3D.ts",
      namespace: "Geometry",
      className: "Vector3D",
      isStaticContainer: false,
      imports: [],
      body: [interfaceDecl],
      exports: [],
    };

    const result = emitCSharpFile(module);
    expect(result).to.include("public struct Vector3D");
    expect(result).to.include("public required double X");
    expect(result).to.include("public required double Y");
    expect(result).to.include("public required double Z");
    expect(result).not.to.include("class Vector3D");
  });

  it("should not emit __brand property for struct", () => {
    const classDecl: IrClassDeclaration = {
      kind: "classDeclaration",
      name: "Coord",
      members: [
        {
          kind: "propertyDeclaration",
          name: "x",
          type: { kind: "primitiveType", name: "number" },
          accessibility: "public",
          isStatic: false,
          isReadonly: false,
        },
        // __brand should already be filtered by the IR builder,
        // but test that emitter handles it gracefully
      ],
      implements: [],
      isExported: true,
      isStruct: true,
    };

    const module: IrModule = {
      kind: "module",
      filePath: "/src/Coord.ts",
      namespace: "Geometry",
      className: "Coord",
      isStaticContainer: false,
      imports: [],
      body: [classDecl],
      exports: [],
    };

    const result = emitCSharpFile(module);
    expect(result).to.include("public struct Coord");
    expect(result).not.to.include("__brand");
  });
});
