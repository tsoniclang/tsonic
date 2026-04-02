/**
 * Attribute emission helpers
 *
 * Emits C# attribute syntax from IrAttribute nodes as CSharpAttributeAst.
 *
 * Example:
 * ```typescript
 * A<User>().add(SerializableAttribute);
 * A<User>().add(DataContractAttribute, { Name: "UserDTO" });
 * A<User>().method((x) => x.foo).target("return").add(MarshalAsAttribute, UnmanagedType.Bool);
 * ```
 *
 * Emits:
 * ```csharp
 * [global::System.SerializableAttribute]
 * [global::System.Runtime.Serialization.DataContractAttribute(Name = "UserDTO")]
 * [return: global::System.Runtime.InteropServices.MarshalAsAttribute(global::System.Runtime.InteropServices.UnmanagedType.Bool)]
 * public class User { ... }
 * ```
 */

import { IrAttribute, IrAttributeArg } from "@tsonic/frontend";
import { EmitterContext } from "../../types.js";
import { emitTypeAst } from "../../type-emitter.js";
import {
  booleanLiteral,
  parseNumericLiteral,
  stringLiteral,
} from "./backend-ast/builders.js";
import type {
  CSharpAttributeAst,
  CSharpExpressionAst,
} from "./backend-ast/types.js";

/**
 * Emit a single attribute argument value as CSharpExpressionAst.
 */
const emitAttributeArgAst = (
  arg: IrAttributeArg,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  switch (arg.kind) {
    case "string":
      return [stringLiteral(arg.value), context];
    case "number":
      return [parseNumericLiteral(String(arg.value)), context];
    case "boolean":
      return [booleanLiteral(arg.value), context];
    case "typeof": {
      const [typeAst, newContext] = emitTypeAst(arg.type, context);
      return [{ kind: "typeofExpression", type: typeAst }, newContext];
    }
    case "enum": {
      const [typeAst, newContext] = emitTypeAst(arg.type, context);
      return [
        {
          kind: "memberAccessExpression",
          expression: { kind: "typeReferenceExpression", type: typeAst },
          memberName: arg.member,
        },
        newContext,
      ];
    }
    case "array": {
      const elements: CSharpExpressionAst[] = [];
      let currentContext = context;
      for (const el of arg.elements) {
        const [elAst, newContext] = emitAttributeArgAst(el, currentContext);
        elements.push(elAst);
        currentContext = newContext;
      }
      return [
        {
          kind: "arrayCreationExpression",
          elementType: { kind: "varType" },
          initializer: elements,
        },
        currentContext,
      ];
    }
  }
};

/**
 * Emit a single attribute as CSharpAttributeAst.
 */
const emitAttributeAst = (
  attr: IrAttribute,
  context: EmitterContext
): [CSharpAttributeAst, EmitterContext] => {
  const [typeAst, typeContext] = emitTypeAst(attr.attributeType, context);

  const args: CSharpExpressionAst[] = [];
  let currentContext = typeContext;

  // Emit positional arguments
  for (const arg of attr.positionalArgs) {
    const [argAst, newContext] = emitAttributeArgAst(arg, currentContext);
    args.push(argAst);
    currentContext = newContext;
  }

  // Emit named arguments as assignment expressions
  for (const [name, arg] of attr.namedArgs) {
    const [argAst, newContext] = emitAttributeArgAst(arg, currentContext);
    args.push({
      kind: "assignmentExpression",
      operatorToken: "=",
      left: { kind: "identifierExpression", identifier: name },
      right: argAst,
    });
    currentContext = newContext;
  }

  const result: CSharpAttributeAst = {
    type: typeAst,
    ...(args.length > 0 ? { arguments: args } : {}),
    ...(attr.target ? { target: attr.target } : {}),
  };

  return [result, currentContext];
};

/**
 * Emit all attributes for a declaration as CSharpAttributeAst[].
 *
 * @param attributes - Array of attributes (may be undefined)
 * @param context - Emitter context
 * @returns Tuple of [attribute ASTs, context]
 */
export const emitAttributes = (
  attributes: readonly IrAttribute[] | undefined,
  context: EmitterContext
): [readonly CSharpAttributeAst[], EmitterContext] => {
  if (!attributes || attributes.length === 0) {
    return [[], context];
  }

  const result: CSharpAttributeAst[] = [];
  let currentContext = context;

  for (const attr of attributes) {
    const [attrAst, newContext] = emitAttributeAst(attr, currentContext);
    currentContext = newContext;
    result.push(attrAst);
  }

  return [result, currentContext];
};

/**
 * Emit parameter-level attributes as CSharpAttributeAst[].
 *
 * @param attributes - Array of attributes (may be undefined)
 * @param context - Emitter context
 * @returns Tuple of [attribute ASTs, context]
 */
export const emitParameterAttributes = (
  attributes: readonly IrAttribute[] | undefined,
  context: EmitterContext
): [readonly CSharpAttributeAst[], EmitterContext] => {
  if (!attributes || attributes.length === 0) {
    return [[], context];
  }

  const result: CSharpAttributeAst[] = [];
  let currentContext = context;

  for (const attr of attributes) {
    const [attrAst, newContext] = emitAttributeAst(attr, currentContext);
    currentContext = newContext;
    result.push(attrAst);
  }

  return [result, currentContext];
};
