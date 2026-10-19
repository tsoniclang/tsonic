import {
  defineExtensionFactKey,
} from "@tsonic/tsts";
import type {
  Node,
  Type,
} from "@tsonic/tsts";
import {
  tsonicCoreSourceExtensionId,
} from "../identity.js";

export type TsonicCompileTimeFact =
  | {
      readonly kind: "value";
      readonly expression: Node;
      readonly sourceType: Type;
      readonly resultType: Type;
    }
  | {
      readonly kind: "type";
      readonly selectedType: Type;
      readonly typeParameter: Type;
      readonly explicitTypeNode?: Node;
      readonly resultType: Type;
    }
  | {
      readonly kind: "condition";
      readonly condition: Node;
      readonly sourceType: Type;
      readonly resultType: Type;
    }
  | {
      readonly kind: "iteration";
      readonly iterable: Node;
      readonly sourceType: Type;
      readonly resultType: Type;
    };

export const tsonicCompileTimeFactKey = defineExtensionFactKey<TsonicCompileTimeFact>({
  extensionId: tsonicCoreSourceExtensionId,
  name: "compileTime",
  snapshot: (value) => Object.freeze({ ...value }),
  equals: compileTimeFactsEqual,
});

function compileTimeFactsEqual(
  left: TsonicCompileTimeFact,
  right: TsonicCompileTimeFact,
): boolean {
  if (left.kind !== right.kind || left.resultType !== right.resultType) {
    return false;
  }
  switch (left.kind) {
    case "value":
      return right.kind === "value" &&
        left.expression === right.expression &&
        left.sourceType === right.sourceType;
    case "type":
      return right.kind === "type" &&
        left.selectedType === right.selectedType &&
        left.typeParameter === right.typeParameter &&
        left.explicitTypeNode === right.explicitTypeNode;
    case "condition":
      return right.kind === "condition" &&
        left.condition === right.condition &&
        left.sourceType === right.sourceType;
    case "iteration":
      return right.kind === "iteration" &&
        left.iterable === right.iterable &&
        left.sourceType === right.sourceType;
  }
}
