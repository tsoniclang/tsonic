/**
 * Conditional utility type expansion - ReturnType, Parameters, Awaited,
 * ConstructorParameters, InstanceType.
 *
 * DETERMINISTIC IR TYPING (INV-0 compliant):
 * These utility types are expanded using AST-based syntactic algorithms only.
 * No banned APIs (getTypeAtLocation, getTypeOfSymbolAtLocation, typeToTypeNode).
 * Uses Binding for symbol resolution and extracts types from TypeNodes.
 *
 * Split from conditional-utility-types.ts for file-size compliance (< 500 LOC).
 */

import * as ts from "typescript";
import { IrType } from "../../../types.js";
import type { Binding, BindingInternal } from "../../../binding/index.js";
import {
  isTypeParameterNode,
  flattenUnionIrType,
} from "./mapped-utility-types.js";
import {
  unwrapParens,
  flattenUnionTypeNodes,
} from "./conditional-utility-types-core.js";

/**
 * Expand ReturnType<F> by extracting from function type declaration (INV-0 compliant).
 */
export const expandReturnType = (
  fArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(fArg, binding)) {
    return null;
  }

  // Distribute over unions: ReturnType<F1 | F2> = ReturnType<F1> | ReturnType<F2>
  const unwrapped = unwrapParens(fArg);
  if (ts.isUnionTypeNode(unwrapped)) {
    const results: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const result = expandReturnType(member, binding, convertType);
      if (!result) return null;
      results.push(result);
    }
    const flat = results.flatMap((t) => flattenUnionIrType(t));
    if (flat.length === 0) return { kind: "neverType" };
    if (flat.length === 1) return flat[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: flat };
  }

  // Case 1: Direct function type node
  if (ts.isFunctionTypeNode(unwrapped)) {
    return unwrapped.type
      ? convertType(unwrapped.type, binding)
      : { kind: "voidType" };
  }

  // Case 2: Type reference to function type alias
  if (
    ts.isTypeReferenceNode(unwrapped) &&
    ts.isIdentifier(unwrapped.typeName)
  ) {
    const declId = binding.resolveTypeReference(unwrapped);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;
      if (
        decl &&
        ts.isTypeAliasDeclaration(decl) &&
        ts.isFunctionTypeNode(decl.type)
      ) {
        return decl.type.type
          ? convertType(decl.type.type, binding)
          : { kind: "voidType" };
      }
    }
  }

  // Case 3: typeof function value (ReturnType<typeof fn>)
  //
  // INV-0 COMPLIANT: Resolve the identifier to a declaration via Binding and
  // read the syntactic return type annotation (no ts.Type queries).
  if (ts.isTypeQueryNode(unwrapped) && ts.isIdentifier(unwrapped.exprName)) {
    const declId = binding.resolveIdentifier(unwrapped.exprName);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;

      if (
        decl &&
        (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl))
      ) {
        return decl.type ? convertType(decl.type, binding) : null;
      }

      if (decl && ts.isVariableDeclaration(decl) && decl.type) {
        return expandReturnType(decl.type, binding, convertType);
      }
    }
  }

  return null; // Can't extract return type
};

/**
 * Expand Parameters<F> by extracting from function type declaration (INV-0 compliant).
 */
export const expandParameters = (
  fArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(fArg, binding)) {
    return null;
  }

  let functionType: ts.FunctionTypeNode | undefined;

  // Case 1: Direct function type node
  if (ts.isFunctionTypeNode(fArg)) {
    functionType = fArg;
  }

  // Case 2: Type reference to function type alias
  if (
    !functionType &&
    ts.isTypeReferenceNode(fArg) &&
    ts.isIdentifier(fArg.typeName)
  ) {
    const declId = binding.resolveTypeReference(fArg);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;
      if (
        decl &&
        ts.isTypeAliasDeclaration(decl) &&
        ts.isFunctionTypeNode(decl.type)
      ) {
        functionType = decl.type;
      }
    }
  }

  // Case 3: typeof function value (Parameters<typeof fn>)
  //
  // INV-0 COMPLIANT: Resolve the identifier to a declaration via Binding and
  // read syntactic parameter type annotations (no ts.Type queries).
  if (
    !functionType &&
    ts.isTypeQueryNode(fArg) &&
    ts.isIdentifier(fArg.exprName)
  ) {
    const declId = binding.resolveIdentifier(fArg.exprName);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;

      if (
        decl &&
        (ts.isFunctionDeclaration(decl) || ts.isMethodDeclaration(decl))
      ) {
        const paramTypes: IrType[] = decl.parameters.map((param) =>
          param.type ? convertType(param.type, binding) : { kind: "anyType" }
        );
        return { kind: "tupleType", elementTypes: paramTypes };
      }

      if (decl && ts.isVariableDeclaration(decl) && decl.type) {
        return expandParameters(decl.type, binding, convertType);
      }
    }
  }

  if (!functionType) {
    return null; // Can't extract parameters
  }

  // Build tuple type from parameters
  const paramTypes: IrType[] = functionType.parameters.map((param) =>
    param.type ? convertType(param.type, binding) : { kind: "anyType" }
  );

  return { kind: "tupleType", elementTypes: paramTypes };
};

/**
 * Expand Awaited<T> by extracting from Promise type parameter (INV-0 compliant).
 */
export const expandAwaited = (
  tArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  // Check for type parameter
  if (isTypeParameterNode(tArg, binding)) {
    return null;
  }

  // Handle Promise<T> or PromiseLike<T>
  if (ts.isTypeReferenceNode(tArg) && ts.isIdentifier(tArg.typeName)) {
    const name = tArg.typeName.text;
    if ((name === "Promise" || name === "PromiseLike") && tArg.typeArguments) {
      const innerArg = tArg.typeArguments[0];
      if (innerArg) {
        // Recursively unwrap nested promises
        return (
          expandAwaited(innerArg, binding, convertType) ??
          convertType(innerArg, binding)
        );
      }
    }
  }

  // Not a Promise type - return as-is
  return convertType(tArg, binding);
};

/**
 * Expand ConstructorParameters<C> by extracting constructor parameter types.
 */
export const expandConstructorParameters = (
  ctorArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(ctorArg, binding)) {
    return null;
  }

  const unwrapped = unwrapParens(ctorArg);
  if (ts.isUnionTypeNode(unwrapped)) {
    const members: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const expanded = expandConstructorParameters(
        member,
        binding,
        convertType
      );
      if (!expanded) return null;
      members.push(expanded);
    }
    if (members.length === 0) return { kind: "neverType" };
    if (members.length === 1) return members[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: members };
  }

  if (ts.isConstructorTypeNode(unwrapped)) {
    return {
      kind: "tupleType",
      elementTypes: unwrapped.parameters.map((param) =>
        param.type ? convertType(param.type, binding) : { kind: "unknownType" }
      ),
    };
  }

  if (
    ts.isTypeReferenceNode(unwrapped) &&
    ts.isIdentifier(unwrapped.typeName)
  ) {
    const declId = binding.resolveTypeReference(unwrapped);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;
      if (
        decl &&
        ts.isTypeAliasDeclaration(decl) &&
        ts.isConstructorTypeNode(decl.type)
      ) {
        return {
          kind: "tupleType",
          elementTypes: decl.type.parameters.map((param) =>
            param.type
              ? convertType(param.type, binding)
              : { kind: "unknownType" }
          ),
        };
      }
    }
  }

  if (ts.isTypeQueryNode(unwrapped) && ts.isIdentifier(unwrapped.exprName)) {
    const declId = binding.resolveIdentifier(unwrapped.exprName);
    if (!declId) return null;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const decl = declInfo?.declNode as ts.Declaration | undefined;
    if (!decl) return null;

    if (ts.isClassDeclaration(decl)) {
      const ctor = decl.members.find(ts.isConstructorDeclaration);
      const parameters = ctor?.parameters ?? [];
      return {
        kind: "tupleType",
        elementTypes: parameters.map((param) =>
          param.type
            ? convertType(param.type, binding)
            : { kind: "unknownType" }
        ),
      };
    }

    if (ts.isVariableDeclaration(decl) && decl.type) {
      return expandConstructorParameters(decl.type, binding, convertType);
    }
  }

  return null;
};

/**
 * Expand InstanceType<C> by extracting constructor instance result type.
 */
export const expandInstanceType = (
  ctorArg: ts.TypeNode,
  binding: Binding,
  convertType: (node: ts.TypeNode, binding: Binding) => IrType
): IrType | null => {
  if (isTypeParameterNode(ctorArg, binding)) {
    return null;
  }

  const unwrapped = unwrapParens(ctorArg);
  if (ts.isUnionTypeNode(unwrapped)) {
    const members: IrType[] = [];
    for (const member of flattenUnionTypeNodes(unwrapped)) {
      const expanded = expandInstanceType(member, binding, convertType);
      if (!expanded) return null;
      members.push(expanded);
    }
    if (members.length === 0) return { kind: "neverType" };
    if (members.length === 1) return members[0] ?? { kind: "neverType" };
    return { kind: "unionType", types: members };
  }

  if (ts.isConstructorTypeNode(unwrapped)) {
    return unwrapped.type
      ? convertType(unwrapped.type, binding)
      : { kind: "unknownType" };
  }

  if (
    ts.isTypeReferenceNode(unwrapped) &&
    ts.isIdentifier(unwrapped.typeName)
  ) {
    const declId = binding.resolveTypeReference(unwrapped);
    if (declId) {
      const declInfo = (binding as BindingInternal)
        ._getHandleRegistry()
        .getDecl(declId);
      const decl = declInfo?.declNode as ts.Declaration | undefined;
      if (
        decl &&
        ts.isTypeAliasDeclaration(decl) &&
        ts.isConstructorTypeNode(decl.type)
      ) {
        return decl.type.type
          ? convertType(decl.type.type, binding)
          : { kind: "unknownType" };
      }
    }
  }

  if (ts.isTypeQueryNode(unwrapped) && ts.isIdentifier(unwrapped.exprName)) {
    const declId = binding.resolveIdentifier(unwrapped.exprName);
    if (!declId) return null;
    const declInfo = (binding as BindingInternal)
      ._getHandleRegistry()
      .getDecl(declId);
    const decl = declInfo?.declNode as ts.Declaration | undefined;
    if (!decl) return null;

    if (ts.isClassDeclaration(decl)) {
      if (!decl.name) return { kind: "unknownType" };
      return { kind: "referenceType", name: decl.name.text };
    }

    if (ts.isVariableDeclaration(decl) && decl.type) {
      return expandInstanceType(decl.type, binding, convertType);
    }
  }

  return null;
};
