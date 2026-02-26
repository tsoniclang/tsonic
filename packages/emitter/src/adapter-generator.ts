/**
 * Adapter Generator - Generate C# adapters for structural constraints
 * Per spec/15-generics.md §4 - Structural Constraints & Adapters
 *
 * Returns CSharpTypeDeclarationAst[] (interface + wrapper class).
 */

import { IrTypeParameter } from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import { emitCSharpName } from "./naming-policy.js";
import type {
  CSharpTypeDeclarationAst,
  CSharpMemberAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";

/**
 * Generate adapter interface and wrapper class for a structural constraint
 */
export const generateStructuralAdapter = (
  typeParam: IrTypeParameter,
  context: EmitterContext
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  if (!typeParam.isStructuralConstraint || !typeParam.structuralMembers) {
    return [[], context];
  }

  let currentContext = context;
  const interfaceName = `__Constraint_${typeParam.name}`;
  const wrapperName = `__Wrapper_${typeParam.name}`;

  // Build interface members (readonly properties)
  const interfaceMembers: CSharpMemberAst[] = [];
  // Build wrapper members (read-write properties)
  const wrapperMembers: CSharpMemberAst[] = [];

  for (const member of typeParam.structuralMembers) {
    if (member.kind !== "propertySignature") continue;

    const [memberTypeAst, newContext] = emitTypeAst(
      member.type,
      currentContext
    );
    currentContext = newContext;

    const typeAst: CSharpTypeAst = member.isOptional
      ? { kind: "nullableType", underlyingType: memberTypeAst }
      : memberTypeAst;

    const propName = emitCSharpName(member.name, "properties", context);

    // Interface: get-only
    interfaceMembers.push({
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: [],
      type: typeAst,
      name: propName,
      hasGetter: true,
      hasSetter: false,
      isAutoProperty: true,
    });

    // Wrapper: public get/set
    wrapperMembers.push({
      kind: "propertyDeclaration",
      attributes: [],
      modifiers: ["public"],
      type: typeAst,
      name: propName,
      hasGetter: true,
      hasSetter: true,
      isAutoProperty: true,
    });
  }

  const interfaceDecl: CSharpTypeDeclarationAst = {
    kind: "interfaceDeclaration",
    attributes: [],
    modifiers: ["public"],
    name: interfaceName,
    interfaces: [],
    members: interfaceMembers,
  };

  const wrapperDecl: CSharpTypeDeclarationAst = {
    kind: "classDeclaration",
    attributes: [],
    modifiers: ["public", "sealed"],
    name: wrapperName,
    interfaces: [{ kind: "identifierType", name: interfaceName }],
    members: wrapperMembers,
  };

  return [[interfaceDecl, wrapperDecl], currentContext];
};

/**
 * Generate all structural adapters for a set of type parameters
 */
export const generateStructuralAdapters = (
  typeParams: readonly IrTypeParameter[] | undefined,
  context: EmitterContext
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  if (!typeParams || typeParams.length === 0) {
    return [[], context];
  }

  const adapters: CSharpTypeDeclarationAst[] = [];
  let currentContext = context;

  for (const tp of typeParams) {
    if (tp.isStructuralConstraint && tp.structuralMembers) {
      const [adapterDecls, newContext] = generateStructuralAdapter(
        tp,
        currentContext
      );
      adapters.push(...adapterDecls);
      currentContext = newContext;
    }
  }

  return [adapters, currentContext];
};
