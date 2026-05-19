/**
 * Type alias declaration emission — returns CSharpTypeDeclarationAst | null
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { typeUsesPointer } from "../../core/semantic/unsafe.js";
import { emitCSharpName } from "../../naming-policy.js";
import { identifierType } from "../../core/format/backend-ast/builders.js";
import { normalizeValueSlotType } from "../../core/semantic/value-slot-types.js";
import type {
  CSharpTypeDeclarationAst,
  CSharpMemberAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";

const isNominalMarkerProperty = (name: string): boolean => {
  return (
    name === "__brand" ||
    name.startsWith("__tsonic_type_") ||
    name.startsWith("__tsonic_iface_") ||
    name.startsWith("__tsonic_binding_alias_")
  );
};

/**
 * Emit a type alias declaration as CSharpTypeDeclarationAst | null.
 *
 * Returns null for non-structural aliases (type-only, erased in C#). For structural (object) type aliases,
 * returns a sealed class or struct declaration.
 */
export const emitTypeAliasDeclaration = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  context: EmitterContext
): [CSharpTypeDeclarationAst | null, EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
  };

  // Build type parameter names set FIRST - needed when emitting member types
  const aliasTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Create context with type parameters in scope for member emission
  const baseContext: EmitterContext = {
    ...context,
    typeParameters: aliasTypeParams,
  };

  // Check if this is a structural (object) type alias
  if (stmt.type.kind === "objectType") {
    const result = emitStructuralTypeAlias(stmt, baseContext);
    return [result[0], { ...result[1], ...savedScoped }];
  }

  return [null, { ...baseContext, ...savedScoped }];
};

/**
 * Build CSharpTypeDeclarationAst for a structural (object) type alias
 */
const emitStructuralTypeAlias = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  context: EmitterContext
): [CSharpTypeDeclarationAst, EmitterContext] => {
  const needsUnsafe = typeUsesPointer(stmt.type);

  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";

  const modifiers: string[] = [accessibility];
  if (needsUnsafe) modifiers.push("unsafe");
  if (!stmt.isStruct) modifiers.push("sealed");

  const aliasName = `${escapeCSharpIdentifier(stmt.name)}__Alias`;

  // Type parameters (if any)
  const reservedTypeParamNames = new Set<string>();
  if (stmt.type.kind === "objectType") {
    for (const member of stmt.type.members) {
      if (member.kind !== "propertySignature") continue;
      if (isNominalMarkerProperty(member.name)) continue;
      reservedTypeParamNames.add(
        emitCSharpName(member.name, "properties", context)
      );
    }
  }

  const [typeParamAsts, constraintAsts, typeParamContext] =
    emitTypeParametersAst(stmt.typeParameters, context, reservedTypeParamNames);

  // Generate member properties from object type members
  const members: CSharpMemberAst[] = [];
  let currentContext = typeParamContext;

  if (stmt.type.kind === "objectType") {
    for (const member of stmt.type.members) {
      if (member.kind !== "propertySignature") continue;
      if (isNominalMarkerProperty(member.name)) continue;

      const propModifiers: string[] = ["public"];
      if (!member.isOptional) {
        propModifiers.push("required");
      }

      // Property type
      const [baseTypeAst, typeContext] = (() => {
        if (member.type) {
          return emitTypeAst(
            normalizeValueSlotType(member.type),
            currentContext
          );
        }
        const objType: CSharpTypeAst = identifierType("object");
        return [objType, currentContext] as const;
      })();
      currentContext = typeContext;

      const typeAst: CSharpTypeAst = member.isOptional
        ? { kind: "nullableType", underlyingType: baseTypeAst }
        : baseTypeAst;

      const propName = emitCSharpName(member.name, "properties", context);

      members.push({
        kind: "propertyDeclaration",
        attributes: [],
        modifiers: propModifiers,
        type: typeAst,
        name: propName,
        hasGetter: true,
        hasSetter: !member.isReadonly,
        hasInit: member.isReadonly ? true : undefined,
        isAutoProperty: true,
      });
    }
  }

  const hasRequiredMembers = members.some(
    (m) => m.kind === "propertyDeclaration" && m.modifiers.includes("required")
  );
  if (!stmt.isStruct && hasRequiredMembers) {
    members.unshift({
      kind: "constructorDeclaration",
      attributes: [
        {
          type: identifierType(
            "global::System.Diagnostics.CodeAnalysis.SetsRequiredMembersAttribute"
          ),
        },
      ],
      modifiers: ["public"],
      name: aliasName,
      parameters: [],
      body: { kind: "blockStatement", statements: [] },
    });
  }

  const declAst: CSharpTypeDeclarationAst = stmt.isStruct
    ? {
        kind: "structDeclaration",
        attributes: [],
        modifiers,
        name: aliasName,
        typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
        interfaces: [],
        members,
        constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
      }
    : {
        kind: "classDeclaration",
        attributes: [],
        modifiers,
        name: aliasName,
        typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
        interfaces: [],
        members,
        constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
      };

  return [declAst, currentContext];
};
