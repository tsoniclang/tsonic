/**
 * Variable declaration emission
 */

import {
  IrBlockStatement,
  IrExpression,
  IrParameter,
  IrStatement,
  IrType,
  NumericKind,
  NUMERIC_KIND_TO_CSHARP,
} from "@tsonic/frontend";
import { EmitterContext, indent, withStatic } from "../../types.js";
import { emitExpressionAst } from "../../expression-emitter.js";
import { emitBlockStatementAst } from "../../statements/blocks.js";
import { emitTypeAst } from "../../type-emitter.js";
import { escapeCSharpIdentifier } from "../../emitter-types/index.js";
import {
  lowerPatternAst,
  lowerPatternToStaticMembersAst,
} from "../../patterns.js";
import {
  allocateLocalName,
  registerLocalName,
} from "../../core/format/local-names.js";
import {
  resolveTypeAlias,
  stripNullish,
} from "../../core/semantic/type-resolution.js";
import { emitCSharpName } from "../../naming-policy.js";
import { extractCalleeNameFromAst } from "../../core/format/backend-ast/utils.js";
import type {
  CSharpStatementAst,
  CSharpTypeAst,
  CSharpExpressionAst,
  CSharpMemberAst,
  CSharpParameterAst,
} from "../../core/format/backend-ast/types.js";

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

/**
 * Types that require explicit LHS type because C# has no literal suffix for them.
 * For these types, `var x = 200;` would infer `int`, not the intended type.
 */
const TYPES_NEEDING_EXPLICIT_DECL = new Set([
  "byte",
  "sbyte",
  "short",
  "ushort",
]);

/**
 * Check if a type can be explicitly emitted as a C# type.
 * Returns false for types that cannot be named in C# (any, unknown, anonymous).
 */
const canEmitTypeExplicitly = (type: IrType): boolean => {
  // Reject any/unknown (these are separate type kinds, not primitive names)
  if (type.kind === "anyType" || type.kind === "unknownType") {
    return false;
  }

  // Accept primitives
  if (type.kind === "primitiveType") {
    return true;
  }

  // Accept arrays, functions, references, tuples, dictionaries
  if (
    type.kind === "arrayType" ||
    type.kind === "functionType" ||
    type.kind === "referenceType" ||
    type.kind === "tupleType" ||
    type.kind === "dictionaryType"
  ) {
    return true;
  }

  // Reject anonymous object types (no CLR backing)
  if (type.kind === "objectType") {
    return false;
  }

  // Reject unions containing any/unknown
  if (type.kind === "unionType") {
    return type.types.every(canEmitTypeExplicitly);
  }

  return false;
};

/**
 * Check if a type requires explicit local variable declaration.
 * Returns true for types like byte, sbyte, short, ushort that have no C# suffix.
 * Resolves type aliases to get the underlying type.
 */
const needsExplicitLocalType = (
  type: IrType,
  context: EmitterContext
): boolean => {
  // Resolve aliases (e.g., local type aliases)
  const resolved = resolveTypeAlias(stripNullish(type), context);

  // Check primitive types
  if (resolved.kind === "primitiveType") {
    return TYPES_NEEDING_EXPLICIT_DECL.has(resolved.name);
  }

  // Check reference types - these may be CLR types from @tsonic/core
  // (byte, sbyte, short, ushort are imported as reference types, not primitives)
  if (resolved.kind === "referenceType") {
    return TYPES_NEEDING_EXPLICIT_DECL.has(resolved.name);
  }

  return false;
};

/**
 * Resolve a C#-emittable runtime type for `asinterface<T>(x)` locals.
 *
 * `T` may be a type alias or an intersection type (e.g. extension-method overlays).
 * We must pick a nominal/runtime constituent that has a CLR representation.
 */
const resolveAsInterfaceTargetType = (
  type: IrType,
  context: EmitterContext
): IrType => {
  const resolved = resolveTypeAlias(stripNullish(type), context);

  // Unwrap tsbindgen's `ExtensionMethods<TShape>` wrapper (type-only).
  if (resolved.kind === "referenceType" && resolved.typeArguments?.length) {
    const importBinding = context.importBindings?.get(resolved.name);
    const clrName = importBinding?.kind === "type" ? importBinding.clrName : "";
    if (clrName.endsWith(".ExtensionMethods")) {
      const shape = resolved.typeArguments[0];
      if (shape) return resolveAsInterfaceTargetType(shape, context);
    }
  }

  if (resolved.kind === "intersectionType") {
    for (const part of resolved.types) {
      const candidate = resolveAsInterfaceTargetType(part, context);
      if (
        candidate.kind === "referenceType" &&
        candidate.name.startsWith("__Ext_")
      ) {
        continue;
      }
      if (
        candidate.kind === "objectType" ||
        candidate.kind === "intersectionType"
      ) {
        continue;
      }
      return candidate;
    }
  }

  return resolved;
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
 * Resolve the C# type AST for a static field declaration.
 *
 * Priority:
 * 1) numericNarrowing initializer (e.g., `1000 as int`) - use CLR type
 * 2) typeAssertion initializer (e.g., `obj as Person`) - use target type
 * 3) asinterface initializer (e.g., `asinterface<IQueryable<T>>(db.Events)`) - use target type
 * 4) Explicit/inferred IR type
 * 5) Infer from initializer (new, literal, inferredType)
 * 6) Fallback to object
 *
 * Arrow function types are handled separately in emitStaticArrowFieldMembers.
 */
const resolveStaticFieldType = (
  decl: {
    readonly type?: IrType;
    readonly initializer?: {
      readonly kind: string;
      readonly targetKind?: NumericKind;
      readonly targetType?: IrType;
      readonly callee?: unknown;
      readonly typeArguments?: readonly IrType[];
      readonly value?: unknown;
      readonly numericIntent?: NumericKind;
      readonly inferredType?: IrType;
    };
  },
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  const init = decl.initializer;

  // numericNarrowing
  if (init?.kind === "numericNarrowing" && init.targetKind) {
    const csharpType = NUMERIC_KIND_TO_CSHARP.get(init.targetKind) ?? "double";
    return [{ kind: "identifierType", name: csharpType }, context];
  }

  // typeAssertion
  if (init?.kind === "typeAssertion" && init.targetType) {
    return emitTypeAst(init.targetType, context);
  }

  // asinterface
  if (init?.kind === "asinterface" && init.targetType) {
    const targetType = resolveAsInterfaceTargetType(init.targetType, context);
    return emitTypeAst(targetType, context);
  }

  // Explicit type annotation
  if (decl.type) {
    return emitTypeAst(decl.type, context);
  }

  // Infer from new expression
  if (init?.kind === "new") {
    // Type is inferred from the new expression callee + type args.
    // We emit the callee as expression AST and construct a type from it.
    const newExpr = init as {
      callee: Parameters<typeof emitExpressionAst>[0];
      typeArguments?: readonly IrType[];
    };
    const [calleeAst, calleeContext] = emitExpressionAst(
      newExpr.callee,
      context
    );
    let currentContext = calleeContext;
    const calleeText = extractCalleeNameFromAst(calleeAst);

    if (newExpr.typeArguments && newExpr.typeArguments.length > 0) {
      const typeArgs: CSharpTypeAst[] = [];
      for (const typeArg of newExpr.typeArguments) {
        const [typeArgAst, newCtx] = emitTypeAst(typeArg, currentContext);
        typeArgs.push(typeArgAst);
        currentContext = newCtx;
      }
      return [
        { kind: "identifierType", name: calleeText, typeArguments: typeArgs },
        currentContext,
      ];
    }
    return [{ kind: "identifierType", name: calleeText }, currentContext];
  }

  // Infer from literal
  if (init?.kind === "literal") {
    const lit = init as { value: unknown; numericIntent?: NumericKind };
    if (typeof lit.value === "string") {
      return [{ kind: "identifierType", name: "string" }, context];
    }
    if (typeof lit.value === "number") {
      const csharpType = lit.numericIntent
        ? (NUMERIC_KIND_TO_CSHARP.get(lit.numericIntent) ?? "double")
        : "double";
      return [{ kind: "identifierType", name: csharpType }, context];
    }
    if (typeof lit.value === "boolean") {
      return [{ kind: "identifierType", name: "bool" }, context];
    }
    return [{ kind: "identifierType", name: "object" }, context];
  }

  // Infer from initializer's inferred type
  if (init?.inferredType && canEmitTypeExplicitly(init.inferredType)) {
    return emitTypeAst(init.inferredType, context);
  }

  return [{ kind: "identifierType", name: "object" }, context];
};

/**
 * Validate that an arrow function's type parameters are in scope.
 * Throws ICE if an out-of-scope type parameter is found.
 */
const validateArrowTypeScope = (
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
const resolveArrowReturnType = (arrowFunc: {
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
const emitStaticArrowFieldMembers = (
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

    fieldTypeAst = { kind: "identifierType", name: delegateTypeName };
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
          ? { kind: "identifierType", name: "global::System.Action" }
          : {
              kind: "identifierType",
              name: "global::System.Action",
              typeArguments: paramTypeAsts,
            };
    } else {
      fieldTypeAst = {
        kind: "identifierType",
        name: "global::System.Func",
        typeArguments: [...paramTypeAsts, returnTypeAst],
      };
    }
  }

  // Field: public/internal static FieldType fieldName = implName;
  const fieldModifiers = [
    stmt.isExported ? "public" : "internal",
    "static",
    ...(stmt.declarationKind === "const" ? ["readonly"] : []),
  ];

  members.push({
    kind: "fieldDeclaration",
    attributes: [],
    modifiers: fieldModifiers,
    type: fieldTypeAst,
    name: fieldName,
    initializer: { kind: "identifierExpression", identifier: implName },
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
    withStatic(indent(paramCtx), false)
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

/**
 * Emit a static variable declaration as AST members (fields, methods, delegates).
 */
export const emitVariableDeclaration = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  context: EmitterContext
): [readonly CSharpMemberAst[], EmitterContext] => {
  let currentContext = context;
  const members: CSharpMemberAst[] = [];

  for (const decl of stmt.declarations) {
    // Handle destructuring patterns as static field AST members.
    if (
      decl.name.kind === "arrayPattern" ||
      decl.name.kind === "objectPattern"
    ) {
      if (!decl.initializer) {
        throw new Error(
          "Destructuring declaration requires an initializer in static context."
        );
      }

      const [initAst, newContext] = emitExpressionAst(
        decl.initializer,
        currentContext,
        decl.type
      );
      currentContext = newContext;
      const patternType = decl.type ?? decl.initializer.inferredType;
      const result = lowerPatternToStaticMembersAst(
        decl.name,
        initAst,
        patternType,
        currentContext
      );
      members.push(...result.members);
      currentContext = result.context;
      continue;
    }

    // Arrow function in static context → field + __Impl method (+ optional delegate)
    if (context.isStatic && decl.initializer?.kind === "arrowFunction") {
      const [arrowMembers, arrowCtx] = emitStaticArrowFieldMembers(
        stmt,
        decl as Parameters<typeof emitStaticArrowFieldMembers>[1],
        currentContext
      );
      members.push(...arrowMembers);
      currentContext = arrowCtx;
      continue;
    }

    // Simple identifier field declaration
    if (decl.name.kind === "identifierPattern") {
      const originalName = decl.name.name;
      const fieldName = emitCSharpName(originalName, "fields", context);

      // Determine type
      const [typeAst, typeCtx] = resolveStaticFieldType(decl, currentContext);
      currentContext = typeCtx;

      // Determine modifiers
      const modifiers = [
        stmt.isExported ? "public" : "internal",
        "static",
        ...(stmt.declarationKind === "const" ? ["readonly"] : []),
      ];

      // Emit initializer
      let initializerAst: CSharpExpressionAst | undefined;
      if (decl.initializer) {
        const [initAst, newContext] = emitExpressionAst(
          decl.initializer,
          currentContext,
          decl.type
        );
        currentContext = newContext;
        initializerAst = initAst;
      }

      members.push({
        kind: "fieldDeclaration",
        attributes: [],
        modifiers,
        type: typeAst,
        name: fieldName,
        initializer: initializerAst,
      });
    } else {
      throw new Error(
        "Unsupported variable declaration pattern in static context."
      );
    }
  }

  return [
    members,
    {
      ...context,
      ...currentContext,
      indentLevel: context.indentLevel,
      isStatic: context.isStatic,
      isAsync: context.isAsync,
      className: context.className,
      returnType: context.returnType,
      narrowedBindings: context.narrowedBindings,
      voidResolveNames: context.voidResolveNames,
      typeParameters: context.typeParameters,
      typeParamConstraints: context.typeParamConstraints,
      typeParameterNameMap: context.typeParameterNameMap,
      localNameMap: context.localNameMap,
      usedLocalNames: context.usedLocalNames,
    },
  ];
};

/**
 * Helper: check if an initializer is a nullish expression (undefined/null literal or identifier).
 */
const isNullishInitializer = (init: {
  kind: string;
  value?: unknown;
  name?: string;
}): boolean =>
  (init.kind === "literal" &&
    ((init as { value: unknown }).value === undefined ||
      (init as { value: unknown }).value === null)) ||
  (init.kind === "identifier" &&
    ((init as { name: string }).name === "undefined" ||
      (init as { name: string }).name === "null"));

/**
 * Determine the C# type AST for a local variable declaration.
 *
 * Priority:
 * 1) asinterface initializer - use target type
 * 2) Explicit/inferred IR type (if C#-emittable)
 * 3) Nullish initializer with annotation - use explicit type
 * 4) Nullish initializer without annotation - use inferred or object?
 * 5) Types needing explicit declaration (byte, sbyte, short, ushort)
 * 6) stackalloc - target-typed to produce Span<T>
 * 7) var
 */
const resolveLocalTypeAst = (
  decl: {
    readonly type?: IrType;
    readonly initializer?: {
      readonly kind: string;
      readonly value?: unknown;
      readonly name?: string;
      readonly targetType?: IrType;
      readonly inferredType?: IrType;
    };
  },
  context: EmitterContext
): [CSharpTypeAst, EmitterContext] => {
  // asinterface<T>(x) - preserve target type in LHS
  if (!decl.type && decl.initializer?.kind === "asinterface") {
    const targetType = resolveAsInterfaceTargetType(
      (decl.initializer as { targetType: IrType }).targetType,
      context
    );
    return emitTypeAst(targetType, context);
  }

  // Explicit TypeScript annotation that is C#-emittable
  if (decl.type && canEmitTypeExplicitly(decl.type)) {
    return emitTypeAst(decl.type, context);
  }

  // Nullish initializer with explicit annotation → must use explicit type
  if (decl.type && decl.initializer && isNullishInitializer(decl.initializer)) {
    return emitTypeAst(decl.type, context);
  }

  // Nullish initializer without annotation → use inferred type or object?
  if (
    !decl.type &&
    decl.initializer &&
    isNullishInitializer(decl.initializer)
  ) {
    const fallbackType = decl.initializer.inferredType;
    if (fallbackType && canEmitTypeExplicitly(fallbackType)) {
      return emitTypeAst(fallbackType, context);
    }
    return [{ kind: "identifierType", name: "object?" }, context];
  }

  // Types that need explicit declaration (byte, sbyte, short, ushort)
  if (
    decl.type &&
    decl.initializer?.kind !== "stackalloc" &&
    needsExplicitLocalType(decl.type, context)
  ) {
    return emitTypeAst(decl.type, context);
  }

  // stackalloc - must be target-typed to produce Span<T>
  if (decl.initializer?.kind === "stackalloc") {
    const targetType = decl.type ?? decl.initializer.inferredType;
    if (!targetType) {
      throw new Error(
        "ICE: stackalloc initializer missing target type (no decl.type and no inferredType)"
      );
    }
    return emitTypeAst(targetType, context);
  }

  // Default: var
  return [{ kind: "varType" }, context];
};

/**
 * Emit a local (non-static) variable declaration as AST.
 *
 * Static variable declarations (module-level fields) are handled by the
 * text-based emitVariableDeclaration above.
 */
export const emitVariableDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  context: EmitterContext
): [readonly CSharpStatementAst[], EmitterContext] => {
  let currentContext = context;
  const statements: CSharpStatementAst[] = [];

  for (const decl of stmt.declarations) {
    // Handle destructuring patterns with AST lowering
    if (
      decl.name.kind === "arrayPattern" ||
      decl.name.kind === "objectPattern"
    ) {
      if (!decl.initializer) {
        // Destructuring requires an initializer
        statements.push({ kind: "emptyStatement" });
        continue;
      }

      const [initAst, newContext] = emitExpressionAst(
        decl.initializer,
        currentContext,
        decl.type
      );
      currentContext = newContext;

      const patternType = decl.type ?? decl.initializer.inferredType;
      const result = lowerPatternAst(
        decl.name,
        initAst,
        patternType,
        currentContext
      );
      statements.push(...result.statements);
      currentContext = result.context;
      continue;
    }

    // Simple identifier pattern
    if (decl.name.kind === "identifierPattern") {
      const originalName = decl.name.name;

      // Determine type AST (may update context)
      const [typeAst, typeContext] = resolveLocalTypeAst(decl, currentContext);
      currentContext = typeContext;

      // Allocate local name
      const alloc = allocateLocalName(originalName, currentContext);
      const localName = alloc.emittedName;
      currentContext = alloc.context;

      // Emit initializer (after allocation, before registration - C# scoping)
      let initAst = undefined;
      if (decl.initializer) {
        const [exprAst, newContext] = emitExpressionAst(
          decl.initializer,
          currentContext,
          decl.type
        );
        currentContext = newContext;
        initAst = exprAst;
      }

      // Register local name after initializer emission
      currentContext = registerLocalName(
        originalName,
        localName,
        currentContext
      );

      statements.push({
        kind: "localDeclarationStatement",
        modifiers: [],
        type: typeAst,
        declarators: [{ name: localName, initializer: initAst }],
      });
    }
  }

  return [statements, currentContext];
};
