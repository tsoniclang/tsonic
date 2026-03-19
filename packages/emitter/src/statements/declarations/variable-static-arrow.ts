/**
 * Static arrow function field emission helpers
 */

import {
  getAwaitedIrType,
  IrBlockStatement,
  IrExpression,
  IrParameter,
  IrStatement,
  IrType,
} from "@tsonic/frontend";
import { EmitterContext, indent, withAsync, withStatic } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitBlockStatementAst } from "../../statements/blocks.js";
import { emitTypeAst } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import { emitCSharpName } from "../../naming-policy.js";
import {
  identifierExpression,
  identifierType,
} from "../../core/format/backend-ast/builders.js";
import type {
  CSharpTypeAst,
  CSharpMemberAst,
  CSharpParameterAst,
} from "../../core/format/backend-ast/types.js";
import { shouldEmitReadonlyStaticField } from "./variable-type-resolution.js";

export const getAsyncBodyReturnType = (
  isAsync: boolean,
  returnType: IrType | undefined
): IrType | undefined => {
  if (!isAsync || !returnType) return returnType;
  return getAwaitedIrType(returnType) ?? returnType;
};

export const seedLocalNameMapFromParameters = (
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
 * Validate that an arrow function's type parameters are in scope.
 * Throws ICE if an out-of-scope type parameter is found.
 */
export const validateArrowTypeScope = (
  arrowFunc: { parameters: readonly IrParameter[]; returnType?: IrType },
  arrowReturnType: IrType,
  inScopeTypeParams: ReadonlySet<string>
): void => {
  const findOutOfScopeTypeParam = (type: IrType): string | undefined => {
    switch (type.kind) {
      case "typeParameterType":
        return inScopeTypeParams.has(type.name) ? undefined : type.name;
      case "arrayType":
        return findOutOfScopeTypeParam(type.elementType);
      case "dictionaryType": {
        const key = findOutOfScopeTypeParam(type.keyType);
        return key ?? findOutOfScopeTypeParam(type.valueType);
      }
      case "referenceType":
        if (type.typeArguments) {
          for (const arg of type.typeArguments) {
            const hit = findOutOfScopeTypeParam(arg);
            if (hit) return hit;
          }
        }
        return undefined;
      case "unionType":
        for (const t of type.types) {
          const hit = findOutOfScopeTypeParam(t);
          if (hit) return hit;
        }
        return undefined;
      case "tupleType":
        for (const e of type.elementTypes) {
          const hit = findOutOfScopeTypeParam(e);
          if (hit) return hit;
        }
        return undefined;
      case "functionType": {
        for (const p of type.parameters) {
          if (!p.type) continue;
          const hit = findOutOfScopeTypeParam(p.type);
          if (hit) return hit;
        }
        return type.returnType
          ? findOutOfScopeTypeParam(type.returnType)
          : undefined;
      }
      default:
        return undefined;
    }
  };

  for (const param of arrowFunc.parameters) {
    if (!param.type) continue;
    const hit = findOutOfScopeTypeParam(param.type);
    if (hit) {
      throw new Error(
        `ICE: Generic function value reached emitter (type parameter '${hit}' is not in scope). Validation should have emitted TSN7432.`
      );
    }
  }

  const retHit = findOutOfScopeTypeParam(arrowReturnType);
  if (retHit) {
    throw new Error(
      `ICE: Generic function value reached emitter (type parameter '${retHit}' is not in scope). Validation should have emitted TSN7432.`
    );
  }
};

/**
 * Resolve the return type for a static arrow function.
 */
export const resolveArrowReturnType = (arrowFunc: {
  returnType?: IrType;
  inferredType?: IrType;
}): IrType => {
  const result =
    arrowFunc.returnType ??
    (arrowFunc.inferredType?.kind === "functionType"
      ? arrowFunc.inferredType.returnType
      : undefined);
  if (!result) {
    throw new Error(
      "ICE: Arrow function without return type reached emitter - neither explicit nor inferred type available"
    );
  }
  return result;
};

/**
 * Emit a static arrow function as field + companion __Impl method.
 *
 * Returns:
 * - For optional-arg arrows: [delegate decl, field, __Impl method]
 * - For regular arrows: [field, __Impl method]
 */
export const emitStaticArrowFieldMembers = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  decl: {
    readonly name: { readonly kind: string; readonly name?: string };
    readonly initializer: {
      readonly kind: "arrowFunction";
      readonly parameters: readonly IrParameter[];
      readonly returnType?: IrType;
      readonly inferredType?: IrType;
      readonly isAsync: boolean;
      readonly body: IrBlockStatement | IrExpression;
    };
    readonly type?: IrType;
  },
  context: EmitterContext
): [readonly CSharpMemberAst[], EmitterContext] => {
  const arrowFunc = decl.initializer;
  let currentContext = context;

  // Resolve and validate return type
  const arrowReturnType = resolveArrowReturnType(arrowFunc);
  const inScopeTypeParams = currentContext.typeParameters ?? new Set<string>();
  validateArrowTypeScope(arrowFunc, arrowReturnType, inScopeTypeParams);

  // Emit parameter types
  const paramTypeAsts: CSharpTypeAst[] = [];
  for (const param of arrowFunc.parameters) {
    if (param.type) {
      const [paramTypeAst, newCtx] = emitTypeAst(param.type, currentContext);
      paramTypeAsts.push(paramTypeAst);
      currentContext = newCtx;
    } else {
      const paramName =
        param.pattern.kind === "identifierPattern"
          ? param.pattern.name
          : "unknown";
      throw new Error(
        `ICE: Untyped parameter '${paramName}' reached emitter - validation missed TSN7405`
      );
    }
  }

  // Emit return type AST
  const [returnTypeAst, retCtx] = emitTypeAst(arrowReturnType, currentContext);
  currentContext = retCtx;

  const members: CSharpMemberAst[] = [];
  if (decl.name.kind !== "identifierPattern") {
    throw new Error(
      "ICE: Arrow function value declarations must use identifier bindings."
    );
  }
  const declName = decl.name.name;
  if (!declName) {
    throw new Error(
      "ICE: Identifier-pattern variable declaration missing name in static arrow lowering."
    );
  }
  const fieldName = emitCSharpName(declName, "fields", context);
  const implName = `${fieldName}__Impl`;

  // Determine field type: delegate, Func<>, or Action<>
  const needsOptionalArgs = arrowFunc.parameters.some(
    (p) => p.isOptional || !!p.initializer
  );

  let fieldTypeAst: CSharpTypeAst;

  if (needsOptionalArgs) {
    // Custom delegate type for optional parameters
    const hasInitializer = arrowFunc.parameters.some((p) => !!p.initializer);
    if (hasInitializer) {
      throw new Error(
        "ICE: Arrow function values with default parameter initializers are not supported. Use a named function declaration instead."
      );
    }
    if (decl.name.kind !== "identifierPattern") {
      throw new Error(
        "ICE: Arrow function value with optional params must use an identifier binding."
      );
    }

    const delegateTypeName = `${fieldName}__Delegate`;
    const access = stmt.isExported ? "public" : "internal";

    // Build delegate parameter ASTs
    const delegateParams: CSharpParameterAst[] = [];
    for (let i = 0; i < arrowFunc.parameters.length; i++) {
      const param = arrowFunc.parameters[i];
      if (!param?.type) continue;
      const pTypeAst = paramTypeAsts[i];
      if (!pTypeAst) {
        throw new Error(
          "ICE: Parameter type AST missing while emitting arrow delegate signature."
        );
      }
      const paramName =
        param.pattern.kind === "identifierPattern"
          ? escapeCSharpIdentifier(param.pattern.name)
          : `p${i}`;
      delegateParams.push({
        name: paramName,
        type: param.isOptional
          ? { kind: "nullableType", underlyingType: pTypeAst }
          : pTypeAst,
        defaultValue: param.isOptional
          ? { kind: "defaultExpression" }
          : undefined,
      });
    }

    members.push({
      kind: "delegateDeclaration",
      modifiers: [access],
      returnType: returnTypeAst,
      name: delegateTypeName,
      parameters: delegateParams,
    });

    fieldTypeAst = identifierType(delegateTypeName);
  } else {
    // Func<> or Action<>
    const isVoidReturn =
      (returnTypeAst.kind === "identifierType" &&
        returnTypeAst.name === "void") ||
      (returnTypeAst.kind === "predefinedType" &&
        returnTypeAst.keyword === "void");
    if (isVoidReturn) {
      fieldTypeAst =
        paramTypeAsts.length === 0
          ? identifierType("global::System.Action")
          : identifierType("global::System.Action", paramTypeAsts);
    } else {
      fieldTypeAst = identifierType("global::System.Func", [
        ...paramTypeAsts,
        returnTypeAst,
      ]);
    }
  }

  // Field: public/internal static FieldType fieldName = implName;
  const fieldModifiers = [
    stmt.isExported ? "public" : "internal",
    "static",
    ...(shouldEmitReadonlyStaticField(stmt, decl, context) ? ["readonly"] : []),
  ];

  members.push({
    kind: "fieldDeclaration",
    attributes: [],
    modifiers: fieldModifiers,
    type: fieldTypeAst,
    name: fieldName,
    initializer: identifierExpression(implName),
  });

  // __Impl method: private static ReturnType implName(params) { ... }
  const methodParams: CSharpParameterAst[] = [];
  let paramCtx = currentContext;
  for (let i = 0; i < arrowFunc.parameters.length; i++) {
    const param = arrowFunc.parameters[i];
    if (!param?.type) continue;
    const mTypeAst = paramTypeAsts[i];
    if (!mTypeAst) {
      throw new Error(
        "ICE: Parameter type AST missing while emitting arrow implementation method."
      );
    }
    const paramName =
      param.pattern.kind === "identifierPattern"
        ? escapeCSharpIdentifier(param.pattern.name)
        : `p${i}`;
    methodParams.push({
      name: paramName,
      type: param.isOptional
        ? { kind: "nullableType", underlyingType: mTypeAst }
        : mTypeAst,
      defaultValue: param.isOptional
        ? { kind: "defaultExpression" }
        : undefined,
    });
  }

  const bodyBaseContext = seedLocalNameMapFromParameters(
    arrowFunc.parameters,
    withAsync(withStatic(indent(paramCtx), false), arrowFunc.isAsync)
  );

  const bodyReturnType = getAsyncBodyReturnType(
    arrowFunc.isAsync,
    arrowReturnType
  );

  const methodModifiers = [
    "private",
    "static",
    ...(arrowFunc.isAsync ? ["async"] : []),
  ];

  // Build method body AST
  const bodyResult = (() => {
    if (arrowFunc.body.kind === "blockStatement") {
      return emitBlockStatementAst(arrowFunc.body, {
        ...bodyBaseContext,
        returnType: bodyReturnType,
      });
    }
    const [exprAst, bodyCtx] = emitExpressionAst(
      arrowFunc.body,
      bodyBaseContext,
      bodyReturnType
    );
    const isVoidReturn =
      !bodyReturnType ||
      bodyReturnType.kind === "voidType" ||
      (bodyReturnType.kind === "primitiveType" &&
        bodyReturnType.name === "undefined");
    const blockAst = {
      kind: "blockStatement" as const,
      statements: isVoidReturn
        ? [{ kind: "expressionStatement" as const, expression: exprAst }]
        : [{ kind: "returnStatement" as const, expression: exprAst }],
    };
    return [blockAst, bodyCtx] as const;
  })();
  const bodyAst = bodyResult[0];
  paramCtx = bodyResult[1];

  members.push({
    kind: "methodDeclaration",
    attributes: [],
    modifiers: methodModifiers,
    returnType: returnTypeAst,
    name: implName,
    parameters: methodParams,
    body: bodyAst,
  });

  return [
    members,
    {
      ...context,
      ...paramCtx,
      indentLevel: context.indentLevel,
      isStatic: context.isStatic,
      isAsync: context.isAsync,
      className: context.className,
      returnType: context.returnType,
      typeParameters: context.typeParameters,
      typeParamConstraints: context.typeParamConstraints,
      typeParameterNameMap: context.typeParameterNameMap,
      localNameMap: context.localNameMap,
      usedLocalNames: context.usedLocalNames,
    },
  ];
};
