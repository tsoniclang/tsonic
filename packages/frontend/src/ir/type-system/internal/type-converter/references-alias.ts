/**
 * Type alias declaration handling for reference type conversion.
 *
 * Handles function type aliases, declaration-file alias erasure,
 * user-defined type alias expansion, and tsbindgen facade conditional types.
 */

import * as ts from "typescript";
import { IrType } from "../../../types.js";
import { substituteIrType } from "../../../types/ir-substitution.js";
import { convertFunctionType } from "./functions.js";
import type { Binding } from "../../../binding/index.js";
import type { DeclId } from "../../../type-system/types.js";
import {
  normalizeSystemInternalQualifiedName,
  normalizeNamespaceAliasQualifiedName,
  normalizeExpandedAliasType,
  getTypeAliasBodyCache,
} from "./references-normalize.js";
import {
  isTsonicBindingsDeclarationFile,
  isSafeToEraseUserTypeAliasTarget,
  isRecursiveUserTypeAliasDeclaration,
  expandTypeAliasBody,
} from "./references-structural.js";

export const entityNameToText = (entityName: ts.EntityName): string =>
  ts.isIdentifier(entityName)
    ? entityName.text
    : `${entityNameToText(entityName.left)}.${entityName.right.text}`;

/**
 * Handle type alias declarations during reference type conversion.
 *
 * Returns an IrType if the alias was handled, or undefined to fall through
 * to the default reference type path.
 */
export const handleTypeAliasDeclaration = (
  node: ts.TypeReferenceNode,
  typeName: string,
  declId: DeclId,
  declInfo: {
    readonly valueDeclNode?: unknown;
  },
  declNode: ts.TypeAliasDeclaration,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | undefined => {
  const convertFunctionAliasBody = (
    functionTypeNode: ts.FunctionTypeNode
  ): IrType => {
    const fnType = convertFunctionType(functionTypeNode, binding, convertType);

    const aliasTypeParams = (declNode.typeParameters ?? []).map(
      (tp) => tp.name.text
    );
    const refTypeArgs = (node.typeArguments ?? []).map((t) =>
      convertType(t, binding)
    );

    if (aliasTypeParams.length > 0 && refTypeArgs.length > 0) {
      const subst = new Map<string, IrType>();
      for (
        let i = 0;
        i < Math.min(aliasTypeParams.length, refTypeArgs.length);
        i++
      ) {
        const name = aliasTypeParams[i];
        const arg = refTypeArgs[i];
        if (name && arg) subst.set(name, arg);
      }

      return normalizeExpandedAliasType(
        subst.size > 0 ? substituteIrType(fnType, subst) : fnType
      );
    }

    return normalizeExpandedAliasType(fnType);
  };

  // tsbindgen extension method wrapper types erasure
  if (
    declNode.name.text.startsWith("ExtensionMethods_") &&
    node.typeArguments?.length === 1
  ) {
    const shape = node.typeArguments[0];
    return shape ? convertType(shape, binding) : { kind: "unknownType" };
  }

  if (ts.isFunctionTypeNode(declNode.type)) {
    // CLR delegate types are NOMINAL in C#.
    if (declNode.getSourceFile().isDeclarationFile) {
      if (
        isTsonicBindingsDeclarationFile(declNode.getSourceFile().fileName) &&
        !declInfo.valueDeclNode
      ) {
        return convertFunctionAliasBody(declNode.type);
      }
      // Fall through to the referenceType emission.
    } else {
      return convertFunctionAliasBody(declNode.type);
    }
  }

  // Declaration-file type-only alias erasure
  if (
    declNode.getSourceFile().isDeclarationFile &&
    isTsonicBindingsDeclarationFile(declNode.getSourceFile().fileName) &&
    !declInfo.valueDeclNode &&
    !ts.isConditionalTypeNode(declNode.type)
  ) {
    const expanded = expandTypeAliasBody(
      declId.id,
      declNode,
      node,
      binding,
      convertType
    );
    if (expanded) return expanded;
  }

  // User-defined type aliases are TS-only and have no CLR identity.
  if (
    !declNode.getSourceFile().isDeclarationFile &&
    isSafeToEraseUserTypeAliasTarget(declNode.type) &&
    !isRecursiveUserTypeAliasDeclaration(declId.id, declNode, binding)
  ) {
    const key = declId.id;
    const typeAliasBodyCache = getTypeAliasBodyCache(binding);
    const cached = typeAliasBodyCache.get(key);

    if (cached !== "in-progress") {
      const expanded = expandTypeAliasBody(
        declId.id,
        declNode,
        node,
        binding,
        convertType
      );
      if (expanded) return expanded;
    }
  }

  // tsbindgen facade type families: conditional type aliases
  if (
    node.typeArguments &&
    node.typeArguments.length > 0 &&
    declNode.typeParameters &&
    declNode.typeParameters.length === 1
  ) {
    const param = declNode.typeParameters[0];
    const hasTsbindgenDefaultSentinel =
      !!param &&
      !!param.default &&
      ts.isTypeReferenceNode(param.default) &&
      entityNameToText(param.default.typeName) === "__";

    if (
      hasTsbindgenDefaultSentinel &&
      ts.isConditionalTypeNode(declNode.type)
    ) {
      const expected = `${typeName}_${node.typeArguments.length}`;
      let found: string | undefined;

      const visit = (t: ts.TypeNode): void => {
        if (found) return;

        if (ts.isTypeReferenceNode(t)) {
          const raw = entityNameToText(t.typeName);
          const normalized = normalizeNamespaceAliasQualifiedName(
            normalizeSystemInternalQualifiedName(raw)
          );
          if (normalized === expected) {
            found = normalized;
          }
          return;
        }

        if (ts.isConditionalTypeNode(t)) {
          visit(t.trueType);
          visit(t.falseType);
          return;
        }

        if (ts.isParenthesizedTypeNode(t)) {
          visit(t.type);
        }
      };

      visit(declNode.type);

      if (found) {
        return {
          kind: "referenceType",
          name: found,
          typeArguments: node.typeArguments.map((t) => convertType(t, binding)),
        };
      }
    }
  }

  // Not handled - fall through to default path
  return undefined;
};
