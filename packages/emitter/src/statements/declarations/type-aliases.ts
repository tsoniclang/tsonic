/**
 * Type alias declaration emission
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "../../types.js";
import { emitType, emitTypeParameters } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

/**
 * Emit a type alias declaration
 */
export const emitTypeAliasDeclaration = (
  stmt: Extract<IrStatement, { kind: "typeAliasDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
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

    const accessibility = stmt.isExported ? "public" : "internal";
    parts.push(accessibility);
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
      const [typeParamsStr, whereClauses, typeParamContext] =
        emitTypeParameters(stmt.typeParameters, currentContext);
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

          propParts.push(escapeCSharpIdentifier(member.name));

          // Readonly uses get-only, writable uses get; set;
          const accessors = member.isReadonly ? "{ get; }" : "{ get; set; }";

          properties.push(
            `${getIndent(bodyContext)}${propParts.join(" ")} ${accessors}`
          );
        }
      }
    }

    const signature = parts.join(" ");
    const propsCode = properties.join("\n");
    const code = `${ind}${signature}\n${ind}{\n${propsCode}\n${ind}}`;

    return [code, currentContext];
  }

  // For non-structural aliases, emit as comment (C# using aliases are limited)
  // Use currentContext which has type parameters in scope
  const [typeName, newContext] = emitType(stmt.type, currentContext);
  const code = `${ind}// type ${stmt.name} = ${typeName}`;
  return [code, newContext];
};
