import type {
  IrBranchNarrowing,
  IrGuardPolarity,
  IrIfBranchPlan,
  IrIfGuardShape,
} from "./statements.js";

export const createOpaqueIfGuardShape = (
  polarity: IrGuardPolarity
): IrIfGuardShape => ({
  kind: "opaqueBoolean",
  polarity,
});

export const createIfBranchPlan = (
  guardShape: IrIfGuardShape,
  narrowedBindings: readonly IrBranchNarrowing[] = []
): IrIfBranchPlan => ({
  guardShape,
  narrowedBindings,
});

export const createOpaqueIfBranchPlan = (
  polarity: IrGuardPolarity,
  narrowedBindings: readonly IrBranchNarrowing[] = []
): IrIfBranchPlan =>
  createIfBranchPlan(createOpaqueIfGuardShape(polarity), narrowedBindings);

export const invertIfGuardShape = (shape: IrIfGuardShape): IrIfGuardShape => {
  const polarity: IrGuardPolarity =
    shape.polarity === "truthy" ? "falsy" : "truthy";

  switch (shape.kind) {
    case "typeofGuard":
    case "instanceofGuard":
    case "arrayIsArrayGuard":
    case "discriminantEquality":
    case "propertyTruthiness":
    case "nullableGuard":
    case "opaqueBoolean":
      return { ...shape, polarity };
    case "compound":
      return {
        ...shape,
        polarity,
        left: invertIfGuardShape(shape.left),
        right: invertIfGuardShape(shape.right),
      };
  }
};
