import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrClassDeclaration, IrModule } from "@tsonic/frontend";
import { planDuplicateTypeSuppression } from "./duplicate-type-suppression.js";

describe("duplicate type suppression", () => {
  it("handles bigint-valued declaration metadata without throwing", () => {
    const classDecl = {
      kind: "classDeclaration",
      name: "BigCounter",
      typeParameters: [],
      implements: [],
      members: [
        {
          kind: "propertyDeclaration",
          name: "seed",
          type: { kind: "referenceType", name: "long" },
          initializer: {
            kind: "literal",
            value: 1n,
            raw: "1n",
          },
          accessibility: "public",
          isStatic: true,
          isReadonly: true,
          isRequired: false,
        },
      ],
      isExported: true,
      isStruct: false,
    } as unknown as IrClassDeclaration;

    const module: IrModule = {
      kind: "module",
      filePath: "/src/big-counter.ts",
      namespace: "Nodejs.Next.Tests",
      className: "big_counter",
      isStaticContainer: false,
      imports: [],
      exports: [],
      body: [classDecl],
    };

    const result = planDuplicateTypeSuppression([module]);

    expect(result.ok).to.equal(true);
  });
});
