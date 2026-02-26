/**
 * Interface declaration emission (as C# classes)
 */

import { IrStatement } from "@tsonic/frontend";
import { EmitterContext, getIndent, indent } from "../../types.js";
import { emitTypeAst, emitTypeParameters } from "../../type-emitter.js";
import {
  printType,
  printMember,
} from "../../core/format/backend-ast/printer.js";
import {
  extractInlineObjectTypes,
  emitExtractedType,
  emitInterfaceMemberAsProperty,
} from "../classes.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { statementUsesPointer } from "../../core/semantic/unsafe.js";
import { emitCSharpName } from "../../naming-policy.js";

/**
 * Emit an interface declaration (as C# class)
 */
export const emitInterfaceDeclaration = (
  stmt: Extract<IrStatement, { kind: "interfaceDeclaration" }>,
  context: EmitterContext
): [string, EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
  };

  // Per spec/16-types-and-interfaces.md §2.1:
  // - Property-only TS interfaces map to C# classes (instantiable for object literals).
  // - Interfaces with method signatures map to C# interfaces so classes can implement
  //   multiple constraints/implements safely in C# (and so generic constraints can be expressed).

  const ind = getIndent(context);

  const hasMethodSignatures = stmt.members.some(
    (m) => m.kind === "methodSignature"
  );

  // Build type parameter names set FIRST - needed when emitting member types
  // Type parameters must be in scope before we emit types that reference them
  const ifaceTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  // Create context with type parameters in scope for member emission
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: ifaceTypeParams,
  };

  // Extract inline object types and emit them as separate classes
  const extractedTypes = extractInlineObjectTypes(stmt.members, currentContext);
  const extractedClassCodes: string[] = [];

  for (const extracted of extractedTypes) {
    const [classCode, newContext] = emitExtractedType(
      extracted,
      currentContext
    );
    extractedClassCodes.push(classCode);
    currentContext = newContext;
  }

  const parts: string[] = [];
  const needsUnsafe = statementUsesPointer(stmt);

  // Access modifier
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";
  parts.push(accessibility);
  if (needsUnsafe) parts.push("unsafe");
  // Emit as C# interface when methods exist; otherwise keep class/struct for object literals.
  parts.push(
    hasMethodSignatures ? "interface" : stmt.isStruct ? "struct" : "class"
  );
  parts.push(escapeCSharpIdentifier(stmt.name));

  // Type parameters (if any)
  if (stmt.typeParameters && stmt.typeParameters.length > 0) {
    const reservedTypeParamNames = new Set<string>();
    for (const member of stmt.members) {
      if (member.kind === "methodSignature") {
        reservedTypeParamNames.add(
          emitCSharpName(member.name, "methods", context)
        );
        continue;
      }
      if (member.kind === "propertySignature") {
        reservedTypeParamNames.add(
          emitCSharpName(member.name, "properties", context)
        );
      }
    }
    const [typeParamsStr, whereClauses, typeParamContext] = emitTypeParameters(
      stmt.typeParameters,
      currentContext,
      reservedTypeParamNames
    );
    parts.push(typeParamsStr);
    currentContext = typeParamContext;

    // Extended interfaces/classes
    if (stmt.extends && stmt.extends.length > 0) {
      const extended: string[] = [];
      for (const ext of stmt.extends) {
        const [extTypeAst, newContext] = emitTypeAst(ext, currentContext);
        currentContext = newContext;
        extended.push(printType(extTypeAst));
      }
      parts.push(":");
      parts.push(extended.join(", "));
    }

    // Where clauses for type parameters
    if (whereClauses.length > 0) {
      parts.push("\n" + ind + "    " + whereClauses.join("\n" + ind + "    "));
    }
  } else {
    // Extended interfaces/classes (no generics)
    if (stmt.extends && stmt.extends.length > 0) {
      const extended: string[] = [];
      for (const ext of stmt.extends) {
        const [extTypeAst, newContext] = emitTypeAst(ext, currentContext);
        currentContext = newContext;
        extended.push(printType(extTypeAst));
      }
      parts.push(":");
      parts.push(extended.join(", "));
    }
  }

  // Class body with auto-properties
  const bodyContext = indent(currentContext);
  const members: string[] = [];

  const memberInd = getIndent(bodyContext);

  for (const member of stmt.members) {
    if (!hasMethodSignatures) {
      const [memberAst, newContext] = emitInterfaceMemberAsProperty(
        member,
        bodyContext
      );
      members.push(printMember(memberAst, memberInd));
      currentContext = newContext;
      continue;
    }

    // C# interface member emission
    if (member.kind === "propertySignature") {
      const [typeAst, newContext] = emitTypeAst(member.type, currentContext);
      currentContext = newContext;
      const typeName = printType(typeAst);
      const typeStr = member.isOptional ? `${typeName}?` : typeName;
      const accessors = member.isReadonly ? "{ get; }" : "{ get; set; }";
      members.push(
        `${getIndent(bodyContext)}${typeStr} ${emitCSharpName(member.name, "properties", context)} ${accessors}`
      );
      continue;
    }

    if (member.kind === "methodSignature") {
      const returnType = member.returnType
        ? (() => {
            const [rtAst, newContext] = emitTypeAst(
              member.returnType,
              currentContext
            );
            currentContext = newContext;
            return printType(rtAst);
          })()
        : "void";

      // NOTE: methodSignature.typeParameters are not supported in emitter yet (rare in TS interface surface).
      // If needed, they should be lowered to a generic method on the interface.
      const params = member.parameters
        .map((p) => {
          const paramName =
            p.pattern.kind === "identifierPattern"
              ? escapeCSharpIdentifier(p.pattern.name)
              : "param";

          if (!p.type) return `object ${paramName}`;
          const [ptAst, newContext] = emitTypeAst(p.type, currentContext);
          currentContext = newContext;
          return `${printType(ptAst)} ${paramName}`;
        })
        .join(", ");

      members.push(
        `${getIndent(bodyContext)}${returnType} ${emitCSharpName(member.name, "methods", context)}(${params});`
      );
      continue;
    }
  }

  const signature = parts.join(" ");
  const memberCode = members.join("\n\n");
  const mainClassCode = `${ind}${signature}\n${ind}{\n${memberCode}\n${ind}}`;

  // Combine main interface and extracted classes (extracted classes come after)
  const allParts: string[] = [];
  allParts.push(mainClassCode);
  if (extractedClassCodes.length > 0) {
    allParts.push(...extractedClassCodes);
  }

  const code = allParts.join("\n");

  return [code, { ...currentContext, ...savedScoped }];
};
