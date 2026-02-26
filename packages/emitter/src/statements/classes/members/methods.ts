/**
 * Method member emission — returns CSharpMemberAst (method declaration)
 */

import { IrClassMember, IrType, type IrParameter } from "@tsonic/frontend";
import {
  EmitterContext,
  indent,
  dedent,
  withAsync,
  withScoped,
} from "../../../types.js";
import { emitTypeAst, emitTypeParametersAst } from "../../../type-emitter.js";
import { emitBlockStatementAst } from "../../../statement-emitter.js";
import {
  emitParametersWithDestructuring,
  generateParameterDestructuringAst,
} from "../parameters.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { emitAttributes } from "../../../core/format/attributes.js";
import { emitCSharpName } from "../../../naming-policy.js";
import type {
  CSharpMemberAst,
  CSharpBlockStatementAst,
  CSharpExpressionAst,
  CSharpTypeAst,
  CSharpStatementAst,
} from "../../../core/format/backend-ast/types.js";

const getAsyncBodyReturnType = (
  isAsync: boolean,
  returnType: IrType | undefined
): IrType | undefined => {
  if (!isAsync || !returnType) return returnType;
  if (
    returnType.kind === "referenceType" &&
    (returnType.name === "Promise" ||
      returnType.name === "Task" ||
      returnType.name === "ValueTask") &&
    returnType.typeArguments?.length === 1
  ) {
    return returnType.typeArguments[0];
  }
  return returnType;
};

const seedLocalNameMapFromParameters = (
  params: readonly IrParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  const used = new Set<string>();
  for (const p of params) {
    if (p.pattern.kind === "identifierPattern") {
      const emitted = escapeCSharpIdentifier(p.pattern.name);
      map.set(p.pattern.name, emitted);
      used.add(emitted);
    }
  }
  return { ...context, localNameMap: map, usedLocalNames: used };
};

/**
 * Emit a method declaration as CSharpMemberAst
 */
export const emitMethodMember = (
  member: IrClassMember & { kind: "methodDeclaration" },
  context: EmitterContext
): [CSharpMemberAst, EmitterContext] => {
  const savedScoped = {
    typeParameters: context.typeParameters,
    typeParamConstraints: context.typeParamConstraints,
    typeParameterNameMap: context.typeParameterNameMap,
    returnType: context.returnType,
    localNameMap: context.localNameMap,
    usedLocalNames: context.usedLocalNames,
  };

  let currentContext = context;

  // Build method type parameter names FIRST
  const methodTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(member.typeParameters?.map((tp) => tp.name) ?? []),
  ]);

  const signatureContext: EmitterContext = {
    ...context,
    typeParameters: methodTypeParams,
  };

  // Emit type parameters and constraints as AST
  const [typeParamAsts, constraintAsts, typeParamContext] =
    emitTypeParametersAst(member.typeParameters, signatureContext);
  currentContext = typeParamContext;

  // Modifiers
  const modifiers: string[] = [];
  const accessibility = member.accessibility ?? "public";
  modifiers.push(accessibility);

  if (member.isStatic) {
    modifiers.push("static");
  }
  if (!member.isStatic && !member.isOverride && member.isShadow) {
    modifiers.push("new");
  }
  if (member.isOverride) {
    modifiers.push("override");
  }
  if (!member.isStatic && !member.isOverride && member.isVirtual) {
    modifiers.push("virtual");
  }
  if (member.isAsync) {
    modifiers.push("async");
  }

  // Return type
  let returnTypeAst: CSharpTypeAst;
  if (member.returnType) {
    const [rAst, newContext] = emitTypeAst(member.returnType, currentContext);
    currentContext = newContext;
    if (
      member.isAsync &&
      member.returnType.kind === "referenceType" &&
      member.returnType.name === "Promise"
    ) {
      returnTypeAst = rAst; // Already Task<T> from emitType
    } else {
      returnTypeAst = member.isAsync
        ? {
            kind: "identifierType",
            name: "global::System.Threading.Tasks.Task",
            typeArguments: [rAst],
          }
        : rAst;
    }
  } else {
    returnTypeAst = member.isAsync
      ? {
          kind: "identifierType",
          name: "global::System.Threading.Tasks.Task",
        }
      : { kind: "predefinedType", keyword: "void" };
  }

  // Method name
  const name = emitCSharpName(member.name, "methods", context);

  // Parameters
  const paramsResult = emitParametersWithDestructuring(
    member.parameters,
    currentContext
  );
  currentContext = paramsResult.context;

  // Attributes
  const [attrs, attrContext] = emitAttributes(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  // No body → abstract/interface method
  if (!member.body) {
    const methodAst: CSharpMemberAst = {
      kind: "methodDeclaration",
      attributes: attrs,
      modifiers,
      returnType: returnTypeAst,
      name,
      typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
      parameters: paramsResult.parameters,
      constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
    };
    return [methodAst, { ...currentContext, ...savedScoped }];
  }

  // Method body
  const baseBodyContext = seedLocalNameMapFromParameters(
    member.parameters,
    withAsync(indent(currentContext), member.isAsync)
  );

  // Generate parameter destructuring statements BEFORE body
  const [paramDestructuringStmts, destructuringContext] =
    paramsResult.destructuringParams.length > 0
      ? generateParameterDestructuringAst(
          paramsResult.destructuringParams,
          baseBodyContext
        )
      : [[] as readonly CSharpStatementAst[], baseBodyContext];

  // Emit body with scoped typeParameters and returnType
  const body = member.body;
  const [bodyBlockAst, finalContext] = withScoped(
    destructuringContext,
    {
      typeParameters: methodTypeParams,
      returnType: getAsyncBodyReturnType(member.isAsync, member.returnType),
    },
    (scopedCtx) => emitBlockStatementAst(body, scopedCtx)
  );

  // Collect out parameters that need initialization
  const outParamStmts: CSharpStatementAst[] = [];
  for (const param of member.parameters) {
    if (param.passing === "out" && param.pattern.kind === "identifierPattern") {
      let defaultExpr: CSharpExpressionAst = { kind: "defaultExpression" };
      if (param.type) {
        const [typeAst] = emitTypeAst(param.type, currentContext);
        defaultExpr = { kind: "defaultExpression", type: typeAst };
      }
      outParamStmts.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: {
            kind: "identifierExpression",
            identifier: escapeCSharpIdentifier(param.pattern.name),
          },
          right: defaultExpr,
        },
      });
    }
  }

  // Merge preamble statements into body block
  const preamble: CSharpStatementAst[] = [
    ...paramDestructuringStmts,
    ...outParamStmts,
  ];
  const mergedBody: CSharpBlockStatementAst =
    preamble.length > 0
      ? {
          kind: "blockStatement",
          statements: [...preamble, ...bodyBlockAst.statements],
        }
      : bodyBlockAst;

  const methodAst: CSharpMemberAst = {
    kind: "methodDeclaration",
    attributes: attrs,
    modifiers,
    returnType: returnTypeAst,
    name,
    typeParameters: typeParamAsts.length > 0 ? typeParamAsts : undefined,
    parameters: paramsResult.parameters,
    body: mergedBody,
    constraints: constraintAsts.length > 0 ? constraintAsts : undefined,
  };

  return [methodAst, { ...dedent(finalContext), ...savedScoped }];
};
