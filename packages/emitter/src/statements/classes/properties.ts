/**
 * Interface member to property emission
 */

import { IrInterfaceMember } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  printType,
  printParameter,
} from "../../core/format/backend-ast/printer.js";
import { emitParameters } from "./parameters.js";
import { emitCSharpName, getCSharpName } from "../../naming-policy.js";

/**
 * Emit interface member as C# auto-property (for classes)
 * Per spec/16-types-and-interfaces.md §2.1
 */
export const emitInterfaceMemberAsProperty = (
  member: IrInterfaceMember,
  context: EmitterContext
): [string, EmitterContext] => {
  const ind = getIndent(context);

  switch (member.kind) {
    case "propertySignature": {
      let currentContext = context;
      const parts: string[] = [];

      parts.push("public"); // All properties public

      // Required modifier for non-optional properties (C# 11)
      if (!member.isOptional) {
        parts.push("required");
      }

      // Property type
      if (member.type) {
        // If this is an inline object type, use the extracted class name
        let typeName: string;
        if (member.type.kind === "objectType") {
          // Use naming policy for generated type names
          typeName = getCSharpName(member.name, "classes", context);
        } else {
          const [emittedTypeAst, newContext] = emitTypeAst(
            member.type,
            currentContext
          );
          currentContext = newContext;
          typeName = printType(emittedTypeAst);
        }
        // Optional members become nullable (spec §2.1)
        const typeStr = member.isOptional ? `${typeName}?` : typeName;
        parts.push(typeStr);
      } else {
        const typeStr = member.isOptional ? "object?" : "object";
        parts.push(typeStr);
      }

      // Property name (escape C# keywords)
      parts.push(emitCSharpName(member.name, "properties", context));

      // Getter/setter. For "readonly" in TS, use init-only to preserve immutability
      // while still allowing object-initializer assignment (and `required` in C# 11).
      const accessors = member.isReadonly ? "{ get; init; }" : "{ get; set; }";

      return [`${ind}${parts.join(" ")} ${accessors}`, currentContext];
    }

    case "methodSignature": {
      let currentContext = context;
      const parts: string[] = [];

      parts.push("public"); // All methods public

      // Return type
      if (member.returnType) {
        const [returnTypeAst, newContext] = emitTypeAst(
          member.returnType,
          currentContext
        );
        currentContext = newContext;
        parts.push(printType(returnTypeAst));
      } else {
        parts.push("void");
      }

      // Method name (escape C# keywords)
      parts.push(emitCSharpName(member.name, "methods", context));

      // Parameters
      const [paramAsts, paramContext] = emitParameters(
        member.parameters,
        currentContext
      );
      currentContext = paramContext;
      const paramList = paramAsts.map(printParameter).join(", ");

      // Methods in interfaces are abstract declarations
      return [
        `${ind}${parts.join(" ")}(${paramList}) => throw new NotImplementedException();`,
        currentContext,
      ];
    }

    default:
      throw new Error(
        `Unhandled IR interface member kind: ${String((member as { kind?: unknown }).kind)}`
      );
  }
};
