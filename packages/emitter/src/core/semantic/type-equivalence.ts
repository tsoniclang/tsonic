import type { IrType } from "@tsonic/frontend";
import type { EmitterContext } from "../../types.js";
import { resolveComparableType } from "./comparable-types.js";

export const areIrTypesEquivalent = (
  left: IrType,
  right: IrType,
  context: EmitterContext,
  visited: WeakMap<object, WeakSet<object>> = new WeakMap()
): boolean => {
  const seenRight = visited.get(left);
  if (seenRight?.has(right)) {
    return true;
  }
  if (seenRight) {
    seenRight.add(right);
  } else {
    visited.set(left, new WeakSet([right]));
  }

  const a = resolveComparableType(left, context);
  const b = resolveComparableType(right, context);

  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "primitiveType":
      return a.name === (b as typeof a).name;
    case "literalType":
      return a.value === (b as typeof a).value;
    case "referenceType": {
      const rb = b as typeof a;
      if (a.name !== rb.name) return false;
      const aArgs = a.typeArguments ?? [];
      const bArgs = rb.typeArguments ?? [];
      if (aArgs.length !== bArgs.length) return false;
      for (let i = 0; i < aArgs.length; i++) {
        const aa = aArgs[i];
        const bb = bArgs[i];
        if (!aa || !bb || !areIrTypesEquivalent(aa, bb, context, visited)) {
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
        visited
      );
    case "dictionaryType":
      return (
        areIrTypesEquivalent(
          a.keyType,
          (b as typeof a).keyType,
          context,
          visited
        ) &&
        areIrTypesEquivalent(
          a.valueType,
          (b as typeof a).valueType,
          context,
          visited
        )
      );
    case "tupleType": {
      const rb = b as typeof a;
      if (a.elementTypes.length !== rb.elementTypes.length) return false;
      for (let i = 0; i < a.elementTypes.length; i++) {
        const ae = a.elementTypes[i];
        const be = rb.elementTypes[i];
        if (!ae || !be || !areIrTypesEquivalent(ae, be, context, visited)) {
          return false;
        }
      }
      return true;
    }
    case "functionType": {
      const rb = b as typeof a;
      if (a.parameters.length !== rb.parameters.length) return false;
      for (let i = 0; i < a.parameters.length; i++) {
        const ap = a.parameters[i];
        const bp = rb.parameters[i];
        if (!ap || !bp) return false;
        if (!ap.type && !bp.type) continue;
        if (!ap.type || !bp.type) return false;
        if (!areIrTypesEquivalent(ap.type, bp.type, context, visited)) {
          return false;
        }
      }
      return areIrTypesEquivalent(
        a.returnType,
        rb.returnType,
        context,
        visited
      );
    }
    case "unionType":
    case "intersectionType": {
      const rb = b as typeof a;
      if (a.types.length !== rb.types.length) return false;
      const used = new Set<number>();
      for (const at of a.types) {
        if (!at) return false;
        let matched = false;
        for (let i = 0; i < rb.types.length; i++) {
          if (used.has(i)) continue;
          const bt = rb.types[i];
          if (!bt) continue;
          if (areIrTypesEquivalent(at, bt, context, visited)) {
            used.add(i);
            matched = true;
            break;
          }
        }
        if (!matched) return false;
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
      if (a.members.length !== rb.members.length) return false;
      for (let i = 0; i < a.members.length; i++) {
        const am = a.members[i];
        const bm = rb.members[i];
        if (!am || !bm || am.kind !== bm.kind) return false;
        if (
          am.kind === "propertySignature" &&
          bm.kind === "propertySignature"
        ) {
          if (am.name !== bm.name) return false;
          if (!areIrTypesEquivalent(am.type, bm.type, context, visited)) {
            return false;
          }
          continue;
        }
        if (am.kind === "methodSignature" && bm.kind === "methodSignature") {
          if (am.name !== bm.name) return false;
          if (am.parameters.length !== bm.parameters.length) return false;
          for (let j = 0; j < am.parameters.length; j++) {
            const ap = am.parameters[j];
            const bp = bm.parameters[j];
            if (!ap || !bp) return false;
            if (!ap.type || !bp.type) return false;
            if (!areIrTypesEquivalent(ap.type, bp.type, context, visited)) {
              return false;
            }
          }
          if (!am.returnType || !bm.returnType) return false;
          if (
            !areIrTypesEquivalent(
              am.returnType,
              bm.returnType,
              context,
              visited
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
