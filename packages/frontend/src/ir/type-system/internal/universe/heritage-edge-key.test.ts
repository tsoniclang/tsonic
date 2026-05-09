import { describe, it } from "mocha";
import { expect } from "chai";
import type { IrType } from "../../../types/index.js";
import { compareHeritageEdges, heritageEdgeKey } from "./heritage-edge-key.js";
import type { HeritageEdge } from "./types.js";

const unresolvedReference = (name: string): IrType => ({
  kind: "referenceType",
  name,
});

describe("heritageEdgeKey", () => {
  it("builds deterministic keys for composite unresolved generic arguments", () => {
    const arrayOfUnresolved: IrType = {
      kind: "arrayType",
      elementType: unresolvedReference("StandardFormat"),
    };

    const edge: HeritageEdge = {
      kind: "implements",
      targetStableId: "System.Private.CoreLib:System.IEquatable`1",
      typeArguments: [arrayOfUnresolved],
    };

    expect(heritageEdgeKey(edge)).to.equal(
      "implements|System.Private.CoreLib:System.IEquatable`1|arr:unresolved-ref:StandardFormat/0<>:tuple::rest:none"
    );
  });

  it("orders union and intersection composite arguments deterministically", () => {
    const alpha = unresolvedReference("Alpha");
    const beta = unresolvedReference("Beta");
    const left: HeritageEdge = {
      kind: "implements",
      targetStableId: "Example:IExample`1",
      typeArguments: [{ kind: "unionType", types: [beta, alpha] }],
    };
    const right: HeritageEdge = {
      kind: "implements",
      targetStableId: "Example:IExample`1",
      typeArguments: [{ kind: "unionType", types: [alpha, beta] }],
    };

    expect(compareHeritageEdges(left, right)).to.equal(0);
  });

  it("terminates on recursive composite fallback arguments", () => {
    const recursive = {
      kind: "unionType",
      types: [] as IrType[],
    } as Extract<IrType, { kind: "unionType" }> & { types: IrType[] };
    recursive.types.push({
      kind: "arrayType",
      elementType: recursive,
    });

    const edge: HeritageEdge = {
      kind: "implements",
      targetStableId: "Example:IRecursive`1",
      typeArguments: [recursive],
    };

    expect(heritageEdgeKey(edge)).to.equal(
      "implements|Example:IRecursive`1|union:arr:cycle:0:tuple::rest:none"
    );
  });
});
