import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "@tsonic/frontend";
import { getAcceptedParameterType, getAcceptedSurfaceType } from "./defaults.js";

describe("defaults", () => {
  it("preserves required parameter types as-is", () => {
    const type: IrType = { kind: "primitiveType", name: "int" };

    expect(getAcceptedParameterType(type, false)).to.equal(type);
  });

  it("widens optional parameter types to accept explicit undefined", () => {
    expect(
      getAcceptedParameterType({ kind: "primitiveType", name: "int" }, true)
    ).to.deep.equal({
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "int" },
        { kind: "primitiveType", name: "undefined" },
      ],
    });
  });

  it("leaves missing parameter types unresolved", () => {
    expect(getAcceptedParameterType(undefined, true)).to.equal(undefined);
  });

  it("preserves optional surfaces that already include undefined", () => {
    const type: IrType = {
      kind: "unionType",
      types: [
        { kind: "primitiveType", name: "string" },
        { kind: "primitiveType", name: "undefined" },
      ],
    };

    expect(getAcceptedSurfaceType(type, true)).to.equal(type);
  });
});
