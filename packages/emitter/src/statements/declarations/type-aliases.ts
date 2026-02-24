/**
 * Type alias declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "../../types.js";
import { emitType, emitTypeParameters } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { typeUsesPointer } from "../../core/semantic/unsafe.js";
import { emitCSharpName } from "../../naming-policy.js";

/**
 * Emit a type alias declaration
 */
export const emitTypeAliasDeclaration = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
  };

  // Per spec/16-types-and-interfaces.md §3:
  // - Structural type aliases generate C# classes with __Alias suffix
  // - Simple aliases (primitives, references) emit as comments or using aliases

  const ind = getIndent(context);

  // Build type parameter names set FIRST - needed when emitting member types
  // Type parameters must be in scope before we emit types that reference them
  const aliasTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Create context with type parameters in scope for member emission
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: aliasTypeParams,
  };

  // Check if this is a structural (object) type alias
  if (stmt.type.kind === "objectType") {
    // Generate a sealed class (or struct) for structural type alias
    const parts: string[] = [];
    const needsUnsafe = typeUsesPointer(stmt.type);

    const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
    const accessibility =
      stmt.isExported || promotedToPublic ? "public" : "internal";
    parts.push(accessibility);
    if (needsUnsafe) parts.push("unsafe");
    // Emit struct or sealed class based on isStruct flag
    if (stmt.isStruct) {
      parts.push("struct");
    } else {
      parts.push("sealed");
      parts.push("class");
    }
    parts.push(`${escapeCSharpIdentifier(stmt.name)}__Alias`); // Add __Alias suffix per spec §3.4

    // Type parameters (if any)
    if (stmt.typeParameters && stmt.typeParameters.length > 0) {
      const reservedTypeParamNames = new Set<string>();
      for (const member of stmt.type.members) {
        if (member.kind !== "propertySignature") continue;
        reservedTypeParamNames.add(
          emitCSharpName(member.name, "properties", context)
        );
      }
      const [typeParamsStr, whereClauses, typeParamContext] =
        emitTypeParameters(
          stmt.typeParameters,
          currentContext,
          reservedTypeParamNames
        );
      parts.push(typeParamsStr);
      currentContext = typeParamContext;

      if (whereClauses.length > 0) {
        parts.push(
          "\n" + ind + "    " + whereClauses.join("\n" + ind + "    ")
        );
      }
    }

    // Generate properties from object type members
    const bodyContext = indent(currentContext);
    const properties: string[] = [];

    if (stmt.type.kind === "objectType") {
      for (const member of stmt.type.members) {
        if (member.kind === "propertySignature") {
          const propParts: string[] = [];
          propParts.push("public");

          // Required modifier for non-optional properties (C# 11)
          if (!member.isOptional) {
            propParts.push("required");
          }

          // Property type
          if (member.type) {
            const [propType, newContext] = emitType(
              member.type,
              currentContext
            );
            currentContext = newContext;
            // Optional members become nullable
            const typeStr = member.isOptional ? `${propType}?` : propType;
            propParts.push(typeStr);
          } else {
            propParts.push(member.isOptional ? "object?" : "object");
          }

          propParts.push(emitCSharpName(member.name, "properties", context));

          // Readonly uses init-only, writable uses get; set;
          // This preserves TS readonly semantics while still allowing object initializers
          // (and `required` for non-optional properties in C# 11).
          const accessors = member.isReadonly
            ? "{ get; init; }"
            : "{ get; set; }";

          properties.push(
            `${getIndent(bodyContext)}${propParts.join(" ")} ${accessors}`
          );
        }
      }
    }

    const signature = parts.join(" ");
    const propsCode = properties.join("\n");
    const code = `${ind}${signature}\n${ind}{\n${propsCode}\n${ind}}`;

    return [code, { ...currentContext, ...savedScoped }];
  }

  // For non-structural aliases, emit as comment (C# using aliases are limited)
  // Use currentContext which has type parameters in scope
  const [typeName, newContext] = emitType(stmt.type, currentContext);
  const code = `${ind}// type ${stmt.name} = ${typeName}`;
  return [code, { ...newContext, ...savedScoped }];
};
