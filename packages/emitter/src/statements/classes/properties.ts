/**
 * Interface member to property emission
 */

import { IrInterfaceMember } from "@tsonic/frontend";
import { EmitterContext, getIndent } from "../../types.js";
import { emitType } from "../../type-emitter.js";
import { capitalize } from "./helpers.js";
import { emitParameters } from "./parameters.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";

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

      // Property type
      if (member.type) {
        // If this is an inline object type, use the extracted class name
        let typeName: string;
        if (member.type.kind === "objectType") {
          // Use capitalized property name as the class name
          typeName = capitalize(member.name);
        } else {
          const [emittedType, newContext] = emitType(
            member.type,
            currentContext
          );
          currentContext = newContext;
          typeName = emittedType;
        }
        // Optional members become nullable (spec §2.1)
        const typeStr = member.isOptional ? `${typeName}?` : typeName;
        parts.push(typeStr);
      } else {
        const typeStr = member.isOptional ? "object?" : "object";
        parts.push(typeStr);
      }

      // Property name (escape C# keywords)
      parts.push(escapeCSharpIdentifier(member.name));

      // Getter/setter (readonly is get-only)
      const accessors = member.isReadonly ? "{ get; }" : "{ get; set; }";

      return [`${ind}${parts.join(" ")} ${accessors}`, currentContext];
    }

    case "methodSignature": {
      let currentContext = context;
      const parts: string[] = [];

      parts.push("public"); // All methods public

      // Return type
      if (member.returnType) {
        const [returnType, newContext] = emitType(
          member.returnType,
          currentContext
        );
        currentContext = newContext;
        parts.push(returnType);
      } else {
        parts.push("void");
      }

      // Method name (escape C# keywords)
      parts.push(escapeCSharpIdentifier(member.name));

      // Parameters
      const params = emitParameters(member.parameters, currentContext);
      currentContext = params[1];

      // Methods in interfaces are abstract declarations
      return [
        `${ind}${parts.join(" ")}(${params[0]}) => throw new NotImplementedException();`,
        currentContext,
      ];
    }

    default:
      return [`${ind}// TODO: unhandled interface member`, context];
  }
};
