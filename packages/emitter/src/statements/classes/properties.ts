/**
 * Interface member to property emission — returns CSharpMemberAst
 */

import { IrInterfaceMember } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import { emitParameters } from "./parameters.js";
import { emitCSharpName, getCSharpName } from "../../naming-policy.js";
import type {
  CSharpMemberAst,
  CSharpTypeAst,
} from "../../core/format/backend-ast/types.js";

/**
 * Emit interface member as CSharpMemberAst (property or method declaration)
 * Per spec/16-types-and-interfaces.md §2.1
 */
export const emitInterfaceMemberAsProperty = (
  member: IrInterfaceMember,
  context: EmitterContext
): [CSharpMemberAst, EmitterContext] => {
  switch (member.kind) {
    case "propertySignature": {
      const currentContext = context;

      const modifiers: string[] = ["public"];

      // Required modifier for non-optional properties (C# 11)
      if (!member.isOptional) {
        modifiers.push("required");
      }

      // Property type
      const [baseTypeAst, typeContext] = (() => {
        if (member.type) {
          // If this is an inline object type, use the extracted class name
          if (member.type.kind === "objectType") {
            const typeName = getCSharpName(member.name, "classes", context);
            const typeAst: CSharpTypeAst = {
              kind: "identifierType",
              name: typeName,
            };
            return [typeAst, currentContext] as const;
          }
          return emitTypeAst(member.type, currentContext);
        }
        const typeAst: CSharpTypeAst = {
          kind: "identifierType",
          name: "object",
        };
        return [typeAst, currentContext] as const;
      })();

      // Optional members become nullable (spec §2.1)
      const typeAst: CSharpTypeAst = member.isOptional
        ? { kind: "nullableType", underlyingType: baseTypeAst }
        : baseTypeAst;

      // Property name (escape C# keywords)
      const name = emitCSharpName(member.name, "properties", context);

      // Getter/setter. For "readonly" in TS, use init-only to preserve immutability
      // while still allowing object-initializer assignment (and `required` in C# 11).
      const memberAst: CSharpMemberAst = {
        kind: "propertyDeclaration",
        attributes: [],
        modifiers,
        type: typeAst,
        name,
        hasGetter: true,
        hasSetter: !member.isReadonly,
        hasInit: member.isReadonly ? true : undefined,
        isAutoProperty: true,
      };

      return [memberAst, typeContext];
    }

    case "methodSignature": {
      const currentContext = context;

      const modifiers: string[] = ["public"];

      // Return type
      const [returnTypeAst, returnTypeContext] = (() => {
        if (member.returnType) {
          return emitTypeAst(member.returnType, currentContext);
        }
        const voidType: CSharpTypeAst = {
          kind: "identifierType",
          name: "void",
        };
        return [voidType, currentContext] as const;
      })();

      // Method name (escape C# keywords)
      const name = emitCSharpName(member.name, "methods", context);

      // Parameters
      const [paramAsts, paramContext] = emitParameters(
        member.parameters,
        returnTypeContext
      );

      // Methods in interfaces are expression-bodied with throw
      const memberAst: CSharpMemberAst = {
        kind: "methodDeclaration",
        attributes: [],
        modifiers,
        returnType: returnTypeAst,
        name,
        parameters: paramAsts,
        expressionBody: {
          kind: "throwExpression",
          expression: {
            kind: "objectCreationExpression",
            type: {
              kind: "identifierType",
              name: "global::System.NotImplementedException",
            },
            arguments: [],
          },
        },
      };

      return [memberAst, paramContext];
    }

    default:
      throw new Error(
        `Unhandled IR interface member kind: ${String((member as { kind?: unknown }).kind)}`
      );
  }
};
