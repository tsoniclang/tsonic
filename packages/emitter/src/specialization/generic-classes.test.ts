/**
 * Tests for Generic Classes
 * Covers spec/15-generics.md §3-5 - Generic Classes
 */

import { describe, it } from "mocha";
import { expect } from "chai";
import { emitModule } from "../../emitter.js";
import { IrModule } from "@tsonic/frontend";

describe("Generic Classes (spec/15 §3-5)", () => {
  it("should emit generic class with type parameter", () => {
    const module: IrModule = {
      kind: "module",
      filePath: "/src/Box.ts",
      namespace: "MyApp",
      className: "Box",
      isStaticContainer: false,
      imports: [],
      body: [
        {
          kind: "classDeclaration",
          name: "Box",
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
          isStruct: false,
          members: [
            {
              kind: "propertyDeclaration",
              name: "value",
              type: { kind: "referenceType", name: "T", typeArguments: [] },
              initializer: undefined,
              accessibility: "public",
              isStatic: false,
              isReadonly: false,
            },
          ],
          superClass: undefined,
          implements: [],
          isExported: true,
        },
      ],
      exports: [],
    };

    const result = emitModule(module);

    expect(result).to.include("public class Box<T>");
    expect(result).to.include("public T value");
  });
});
