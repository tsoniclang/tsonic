import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveComparableType } from "./comparable-types.js";
import {
  getReferenceDeterministicIdentityKey,
  typesHaveDeterministicIdentityConflict,
  typesShareDirectClrIdentity,
} from "./clr-type-identity.js";
import {
  referenceTypesHaveNominalIdentity,
  referenceTypesShareNominalIdentity,
} from "./reference-type-identity.js";

const referenceTypeIdentity = (
  type: Extract<IrType, { kind: "referenceType" }>
): string | undefined => getReferenceDeterministicIdentityKey(type);

const buildTypePairKey = (leftKey: string, rightKey: string): string =>
  leftKey <= rightKey
    ? `${leftKey}=>${rightKey}`
    : `${rightKey}=>${leftKey}`;

const coarseTypeEquivalenceIdentity = (type: IrType): string => {
  switch (type.kind) {
    case "primitiveType":
      return `prim:${type.name}`;
    case "literalType":
      return `lit:${JSON.stringify(type.value)}`;
    case "typeParameterType":
      return `tp:${type.name}`;
    case "anyType":
      return "any";
    case "unknownType":
      return "unknown";
    case "voidType":
      return "void";
    case "neverType":
      return "never";
    case "referenceType":
      return `ref:${referenceTypeIdentity(type) ?? "unidentified"}:${type.typeArguments?.length ?? 0}`;
    case "arrayType":
      return "arr";
    case "dictionaryType":
      return "dict";
    case "tupleType":
      return `tuple:${type.elementTypes.length}`;
    case "functionType":
      return `fn:${type.parameters.length}`;
    case "unionType":
      return `union:${type.types.length}`;
    case "intersectionType":
      return `inter:${type.types.length}`;
    case "objectType":
      return `obj:${type.members
        .map((member) =>
          member.kind === "propertySignature"
            ? `prop:${member.name}`
            : `method:${member.name}:${member.parameters.length}`
        )
        .sort()
        .join("|")}`;
  }
};

export const areIrTypesEquivalent = (
  left: IrType,
  right: IrType,
  context: EmitterContext,
  visitedPairs: Set<string> = new Set<string>()
): boolean => {
  if (left === right) {
    return true;
  }

  if (typesHaveDeterministicIdentityConflict(left, right)) {
    return false;
  }

  if (typesShareDirectClrIdentity(left, right)) {
    return true;
  }

  const rawPairKey = buildTypePairKey(
    coarseTypeEquivalenceIdentity(left),
    coarseTypeEquivalenceIdentity(right)
  );
  if (visitedPairs.has(rawPairKey)) {
    return true;
  }
  visitedPairs.add(rawPairKey);

  if (
    left.kind === "referenceType" &&
    right.kind === "referenceType"
  ) {
    if (referenceTypesShareNominalIdentity(left, right, context)) {
      const leftArgs = left.typeArguments ?? [];
      const rightArgs = right.typeArguments ?? [];
      if (leftArgs.length !== rightArgs.length) {
        return false;
      }

      return leftArgs.every((leftArg, index) => {
        const rightArg = rightArgs[index];
        return (
          rightArg !== undefined &&
          areIrTypesEquivalent(leftArg, rightArg, context, visitedPairs)
        );
      });
    }

    if (referenceTypesHaveNominalIdentity(left, right, context)) {
      return false;
    }
  }

  const a = resolveComparableType(left, context);
  const b = resolveComparableType(right, context);
  if (a === b) {
    return true;
  }

  const comparablePairKey = buildTypePairKey(
    coarseTypeEquivalenceIdentity(a),
    coarseTypeEquivalenceIdentity(b)
  );
  if (comparablePairKey !== rawPairKey && visitedPairs.has(comparablePairKey)) {
    return true;
  }
  if (comparablePairKey !== rawPairKey) {
    visitedPairs.add(comparablePairKey);
  }

  if (a.kind !== b.kind) {
    return false;
  }

  switch (a.kind) {
    case "primitiveType":
      return a.name === (b as typeof a).name;
    case "literalType":
      return a.value === (b as typeof a).value;
    case "referenceType": {
      const rb = b as typeof a;
      if (!referenceTypesShareNominalIdentity(a, rb, context)) {
        return false;
      }
      const aArgs = a.typeArguments ?? [];
      const bArgs = rb.typeArguments ?? [];
      if (aArgs.length !== bArgs.length) {
        return false;
      }
      for (let i = 0; i < aArgs.length; i++) {
        const aa = aArgs[i];
        const bb = bArgs[i];
        if (!aa || !bb || !areIrTypesEquivalent(aa, bb, context, visitedPairs)) {
          return false;
        }
      }
      return true;
    }
    case "arrayType":
      return areIrTypesEquivalent(
        a.elementType,
        (b as typeof a).elementType,
        context,
        visitedPairs
      );
    case "dictionaryType":
      return (
        areIrTypesEquivalent(
          a.keyType,
          (b as typeof a).keyType,
          context,
          visitedPairs
        ) &&
        areIrTypesEquivalent(
          a.valueType,
          (b as typeof a).valueType,
          context,
          visitedPairs
        )
      );
    case "tupleType": {
      const rb = b as typeof a;
      if (a.elementTypes.length !== rb.elementTypes.length) {
        return false;
      }
      for (let i = 0; i < a.elementTypes.length; i++) {
        const ae = a.elementTypes[i];
        const be = rb.elementTypes[i];
        if (!ae || !be || !areIrTypesEquivalent(ae, be, context, visitedPairs)) {
          return false;
        }
      }
      return true;
    }
    case "functionType": {
      const rb = b as typeof a;
      if (a.parameters.length !== rb.parameters.length) {
        return false;
      }
      for (let i = 0; i < a.parameters.length; i++) {
        const ap = a.parameters[i];
        const bp = rb.parameters[i];
        if (!ap || !bp) {
          return false;
        }
        if (!ap.type && !bp.type) {
          continue;
        }
        if (!ap.type || !bp.type) {
          return false;
        }
        if (!areIrTypesEquivalent(ap.type, bp.type, context, visitedPairs)) {
          return false;
        }
      }
      return areIrTypesEquivalent(
        a.returnType,
        rb.returnType,
        context,
        visitedPairs
      );
    }
    case "unionType":
    case "intersectionType": {
      const rb = b as typeof a;
      if (a.types.length !== rb.types.length) {
        return false;
      }
      const used = new Set<number>();
      for (const at of a.types) {
        if (!at) {
          return false;
        }
        let matched = false;
        for (let i = 0; i < rb.types.length; i++) {
          if (used.has(i)) {
            continue;
          }
          const bt = rb.types[i];
          if (!bt) {
            continue;
          }
          if (areIrTypesEquivalent(at, bt, context, visitedPairs)) {
            used.add(i);
            matched = true;
            break;
          }
        }
        if (!matched) {
          return false;
        }
      }
      return true;
    }
    case "typeParameterType":
      return a.name === (b as typeof a).name;
    case "voidType":
    case "anyType":
    case "unknownType":
    case "neverType":
      return true;
    case "objectType": {
      const rb = b as typeof a;
      if (a.members.length !== rb.members.length) {
        return false;
      }
      for (let i = 0; i < a.members.length; i++) {
        const am = a.members[i];
        const bm = rb.members[i];
        if (!am || !bm || am.kind !== bm.kind) {
          return false;
        }
        if (
          am.kind === "propertySignature" &&
          bm.kind === "propertySignature"
        ) {
          if (am.name !== bm.name) {
            return false;
          }
          if (!areIrTypesEquivalent(am.type, bm.type, context, visitedPairs)) {
            return false;
          }
          continue;
        }
        if (am.kind === "methodSignature" && bm.kind === "methodSignature") {
          if (am.name !== bm.name) {
            return false;
          }
          if (am.parameters.length !== bm.parameters.length) {
            return false;
          }
          for (let j = 0; j < am.parameters.length; j++) {
            const ap = am.parameters[j];
            const bp = bm.parameters[j];
            if (!ap || !bp) {
              return false;
            }
            if (!ap.type || !bp.type) {
              return false;
            }
            if (!areIrTypesEquivalent(ap.type, bp.type, context, visitedPairs)) {
              return false;
            }
          }
          if (!am.returnType || !bm.returnType) {
            return false;
          }
          if (
            !areIrTypesEquivalent(
              am.returnType,
              bm.returnType,
              context,
              visitedPairs
            )
          ) {
            return false;
          }
          continue;
        }
        return false;
      }
      return true;
    }
  }
};
