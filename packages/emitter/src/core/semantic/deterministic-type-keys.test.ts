import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { createContext } from "../../emitter-types/context.js";
import type { EmitterContext } from "../../emitter-types/core.js";
import { getContextualTypeVisitKey } from "./deterministic-type-keys.js";

const context: EmitterContext = createContext({ rootNamespace: "Test" });

describe("deterministic-type-keys", () => {
  it("compacts large structural keys without constructing unbounded strings", () => {
    const largeStructuralType: IrType = {
      kind: "objectType",
      members: Array.from({ length: 1200 }, (_unused, index) => ({
        kind: "propertySignature" as const,
        name: `member_${index.toString().padStart(4, "0")}`,
        type: {
          kind: "referenceType" as const,
          name: "List_1",
          resolvedClrType: "System.Collections.Generic.List`1",
          typeArguments: [
            {
              kind: "referenceType" as const,
              name: "Dictionary_2",
              resolvedClrType: "System.Collections.Generic.Dictionary`2",
              typeArguments: [
                { kind: "primitiveType" as const, name: "string" as const },
                { kind: "primitiveType" as const, name: "int" as const },
              ],
            },
          ],
        },
        isOptional: false,
        isReadonly: false,
      })),
    };

    const key = getContextualTypeVisitKey(largeStructuralType, context);

    expect(key.length).to.be.lessThan(9000);
    expect(key).to.match(/^obj:hash:|^hash:/);
  });
});
