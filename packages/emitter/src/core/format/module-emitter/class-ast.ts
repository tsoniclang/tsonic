import {
  IrStatement,
  type IrAttribute,
  type IrClassMember,
  type IrParameter,
  type IrType,
} from "@tsonic/frontend";
import {
  EmitterContext,
  withAsync,
  withClassName,
  withStatic,
  indent,
} from "../../../types.js";
import {
  emitParameterType,
  emitType,
  emitTypeParameters,
} from "../../../type-emitter.js";
import { emitExpression } from "../../../expression-emitter.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { statementUsesPointer } from "../../semantic/unsafe.js";
import { emitCSharpName } from "../../../naming-policy.js";
import { emitAttributes } from "../attributes.js";
import { emitStatementAst } from "../backend-ast/statement-emitter.js";
import { parseLoweredStatements } from "../backend-ast/statement-emitter.js";
import { typeAstFromText } from "../backend-ast/type-factories.js";
import { allocateLocalName } from "../local-names.js";
import { substituteType } from "../../../specialization/substitution.js";
import { lowerParameterPattern } from "../../../patterns.js";
import type {
  CSharpAccessorDeclarationAst,
  CSharpClassMemberAst,
  CSharpConstructorDeclarationAst,
  CSharpExpressionAst,
  CSharpMethodDeclarationAst,
  CSharpParameterAst,
  CSharpStatementAst,
  CSharpTypeDeclarationAst,
} from "../backend-ast/types.js";

const getterAccessorList: readonly CSharpAccessorDeclarationAst[] = [
  { kind: "accessorDeclaration", accessorKind: "get" },
];
const getterSetterAccessorList: readonly CSharpAccessorDeclarationAst[] = [
  { kind: "accessorDeclaration", accessorKind: "get" },
  { kind: "accessorDeclaration", accessorKind: "set" },
];
const getterInitAccessorList: readonly CSharpAccessorDeclarationAst[] = [
  { kind: "accessorDeclaration", accessorKind: "get" },
  { kind: "accessorDeclaration", accessorKind: "init" },
];

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

const splitAttributeLines = (text: string): readonly string[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const emitAttributeList = (
  attributes: readonly IrAttribute[] | undefined,
  context: EmitterContext
): [readonly string[], EmitterContext] => {
  const [text, next] = emitAttributes(attributes, {
    ...context,
    indentLevel: 0,
  });
  return [splitAttributeLines(text), next];
};

const restoreScopedContext = (
  outer: EmitterContext,
  inner: EmitterContext
): EmitterContext => ({
  ...inner,
  narrowedBindings: outer.narrowedBindings,
  typeParameters: outer.typeParameters,
  typeParamConstraints: outer.typeParamConstraints,
  typeParameterNameMap: outer.typeParameterNameMap,
  returnType: outer.returnType,
  localNameMap: outer.localNameMap,
  usedLocalNames: outer.usedLocalNames,
  isAsync: outer.isAsync,
  isStatic: outer.isStatic,
});

const seedLocalNameMapFromParameters = (
  params: readonly IrParameter[],
  context: EmitterContext
): EmitterContext => {
  const map = new Map(context.localNameMap ?? []);
  const used = new Set<string>(context.usedLocalNames ?? []);
  for (const parameter of params) {
    if (parameter.pattern.kind !== "identifierPattern") continue;
    const emitted = escapeCSharpIdentifier(parameter.pattern.name);
    map.set(parameter.pattern.name, emitted);
    used.add(emitted);
  }
  return { ...context, localNameMap: map, usedLocalNames: used };
};

const emitDefaultValueExpression = (
  initializer: Exclude<IrParameter["initializer"], undefined>,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  const [frag, next] = emitExpression(initializer, context, expectedType);
  return [{ kind: "rawExpression", text: frag.text }, next];
};

const emitParameterAst = (
  parameter: IrParameter,
  context: EmitterContext,
  explicitName?: string
): [CSharpParameterAst | undefined, EmitterContext] => {
  const name =
    explicitName ??
    (parameter.pattern.kind === "identifierPattern"
      ? escapeCSharpIdentifier(parameter.pattern.name)
      : undefined);
  if (!name) return [undefined, context];

  const modifiers = [
    ...(parameter.isExtensionReceiver ? ["this"] : []),
    ...(parameter.passing !== "value" ? [parameter.passing] : []),
  ];

  const [typeText, typeContext] = emitParameterType(
    parameter.type,
    parameter.isOptional,
    context
  );
  let currentContext = typeContext;

  const [attributes, attrContext] = emitAttributeList(
    parameter.attributes,
    currentContext
  );
  currentContext = attrContext;

  let defaultValue: CSharpExpressionAst | undefined;
  if (parameter.initializer) {
    const [initializerAst, next] = emitDefaultValueExpression(
      parameter.initializer,
      currentContext,
      parameter.type
    );
    currentContext = next;
    defaultValue = initializerAst;
  } else if (parameter.isOptional && !parameter.isRest) {
    defaultValue = { kind: "literalExpression", text: "default" };
  }

  return [
    {
      kind: "parameter",
      attributes,
      modifiers,
      type: typeAstFromText(typeText),
      name,
      defaultValue,
    },
    currentContext,
  ];
};

const emitMethodMemberAst = (
  member: Extract<IrClassMember, { kind: "methodDeclaration" }>,
  context: EmitterContext
): [CSharpMethodDeclarationAst | undefined, EmitterContext] => {
  if (member.isGenerator) {
    return [undefined, context];
  }

  const methodTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(member.typeParameters?.map((tp) => tp.name) ?? []),
  ]);
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: methodTypeParams,
  };

  const [, whereClauses, typeParamContext] = emitTypeParameters(
    member.typeParameters,
    currentContext
  );
  currentContext = typeParamContext;

  const emittedTypeParameters =
    member.typeParameters?.map(
      (tp) => currentContext.typeParameterNameMap?.get(tp.name) ?? tp.name
    ) ?? [];

  const modifiers = [
    member.accessibility ?? "public",
    ...(member.isStatic ? ["static"] : []),
    ...(!member.isStatic && !member.isOverride && member.isShadow
      ? ["new"]
      : []),
    ...(member.isOverride ? ["override"] : []),
    ...(!member.isStatic && !member.isOverride && member.isVirtual
      ? ["virtual"]
      : []),
    ...(member.isAsync ? ["async"] : []),
  ];

  let returnTypeText = member.isAsync
    ? "global::System.Threading.Tasks.Task"
    : "void";
  if (member.returnType) {
    const [returnType, next] = emitType(member.returnType, currentContext);
    currentContext = next;
    if (
      member.isAsync &&
      member.returnType.kind === "referenceType" &&
      member.returnType.name === "Promise"
    ) {
      returnTypeText = returnType;
    } else {
      returnTypeText = member.isAsync
        ? `global::System.Threading.Tasks.Task<${returnType}>`
        : returnType;
    }
  }

  const [methodAttributes, methodAttrContext] = emitAttributeList(
    member.attributes,
    currentContext
  );
  currentContext = methodAttrContext;

  const parameters: CSharpParameterAst[] = [];
  const destructuringParams: Array<{
    readonly syntheticName: string;
    readonly pattern: IrParameter["pattern"];
    readonly type: IrType | undefined;
  }> = [];
  let syntheticIndex = 0;
  for (const parameter of member.parameters) {
    const isComplexPattern =
      parameter.pattern.kind === "arrayPattern" ||
      parameter.pattern.kind === "objectPattern";
    const explicitName = isComplexPattern
      ? `__param${syntheticIndex++}`
      : undefined;
    const [parameterAst, next] = emitParameterAst(
      parameter,
      currentContext,
      explicitName
    );
    if (!parameterAst) return [undefined, next];
    parameters.push(parameterAst);
    currentContext = next;
    if (isComplexPattern) {
      if (!explicitName) {
        throw new Error(
          "ICE: missing synthetic parameter name for complex method pattern"
        );
      }
      destructuringParams.push({
        syntheticName: explicitName,
        pattern: parameter.pattern,
        type: parameter.type,
      });
    }
  }

  if (!member.body) {
    return [
      {
        kind: "methodDeclaration",
        attributes: methodAttributes,
        modifiers,
        returnType: typeAstFromText(returnTypeText),
        name: emitCSharpName(member.name, "methods", context),
        typeParameters: emittedTypeParameters,
        parameters,
        whereClauses,
      },
      restoreScopedContext(context, currentContext),
    ];
  }

  let bodyContext = withAsync(
    withStatic(currentContext, false),
    member.isAsync
  );
  bodyContext = seedLocalNameMapFromParameters(member.parameters, bodyContext);
  bodyContext = {
    ...bodyContext,
    typeParameters: methodTypeParams,
    returnType: getAsyncBodyReturnType(member.isAsync, member.returnType),
  };

  const destructuringInitializers: CSharpStatementAst[] = [];
  if (destructuringParams.length > 0) {
    let destructuringContext = bodyContext;
    for (const info of destructuringParams) {
      const lowered = lowerParameterPattern(
        info.pattern,
        info.syntheticName,
        info.type,
        "",
        destructuringContext
      );
      destructuringInitializers.push(
        ...parseLoweredStatements(lowered.statements)
      );
      destructuringContext = lowered.context;
    }
    bodyContext = destructuringContext;
  }

  const [bodyAst, nextBodyContext] = emitStatementAst(member.body, bodyContext);
  const blockBody =
    bodyAst.kind === "blockStatement"
      ? bodyAst
      : ({ kind: "blockStatement", statements: [bodyAst] } as const);

  const outInitializers: CSharpStatementAst[] = [];
  for (const parameter of member.parameters) {
    if (parameter.pattern.kind !== "identifierPattern") continue;
    if (parameter.passing !== "out") continue;
    outInitializers.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "identifierExpression",
          identifier: escapeCSharpIdentifier(parameter.pattern.name),
        },
        right: { kind: "literalExpression", text: "default" },
      },
    });
  }

  return [
    {
      kind: "methodDeclaration",
      attributes: methodAttributes,
      modifiers,
      returnType: typeAstFromText(returnTypeText),
      name: emitCSharpName(member.name, "methods", context),
      typeParameters: emittedTypeParameters,
      parameters,
      whereClauses,
      body: {
        kind: "blockStatement",
        statements: [
          ...destructuringInitializers,
          ...outInitializers,
          ...blockBody.statements,
        ],
      },
    },
    restoreScopedContext(context, nextBodyContext),
  ];
};

const emitPropertyMemberAst = (
  member: Extract<IrClassMember, { kind: "propertyDeclaration" }>,
  context: EmitterContext
): [CSharpClassMemberAst, EmitterContext] => {
  const hasAccessors = !!(member.getterBody || member.setterBody);
  const shouldEmitField = !!member.emitAsField && !hasAccessors;
  let currentContext = context;

  const [attributes, attrContext] = emitAttributeList(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  let typeText = "object";
  if (member.type) {
    const [emittedType, next] = emitType(member.type, currentContext);
    currentContext = next;
    typeText = emittedType;
  }

  const memberName = emitCSharpName(
    member.name,
    shouldEmitField ? "fields" : "properties",
    context
  );

  if (shouldEmitField) {
    let initializer: CSharpExpressionAst | undefined;
    if (member.initializer) {
      const [initExpr, next] = emitExpression(
        member.initializer,
        currentContext,
        member.type
      );
      currentContext = next;
      initializer = { kind: "rawExpression", text: initExpr.text };
    }

    return [
      {
        kind: "fieldDeclaration",
        attributes,
        modifiers: [
          member.accessibility ?? "public",
          ...(member.isStatic ? ["static"] : []),
          ...(member.isReadonly ? ["readonly"] : []),
          ...(!member.isStatic && !member.isOverride && member.isShadow
            ? ["new"]
            : []),
        ],
        type: typeAstFromText(typeText),
        name: memberName,
        initializer,
      },
      currentContext,
    ];
  }

  let initializer: CSharpExpressionAst | undefined;
  if (member.initializer) {
    const [initExpr, next] = emitExpression(
      member.initializer,
      currentContext,
      member.type
    );
    currentContext = next;
    initializer = { kind: "rawExpression", text: initExpr.text };
  }

  if (!hasAccessors) {
    return [
      {
        kind: "propertyDeclaration",
        attributes,
        modifiers: [
          member.accessibility ?? "public",
          ...(member.isStatic ? ["static"] : []),
          ...(!member.isStatic && !member.isOverride && member.isShadow
            ? ["new"]
            : []),
          ...(member.isOverride ? ["override"] : []),
          ...(!member.isStatic && !member.isOverride && member.isVirtual
            ? ["virtual"]
            : []),
          ...(!member.isStatic && member.isRequired ? ["required"] : []),
        ],
        type: typeAstFromText(typeText),
        name: memberName,
        accessorList: member.isReadonly
          ? member.isStatic
            ? getterAccessorList
            : getterInitAccessorList
          : getterSetterAccessorList,
        initializer,
      },
      currentContext,
    ];
  }

  const accessorList: CSharpAccessorDeclarationAst[] = [];
  if (member.getterBody) {
    const getterContext: EmitterContext = {
      ...indent(currentContext),
      returnType: member.type,
    };
    const [getterAst, next] = emitStatementAst(
      member.getterBody,
      getterContext
    );
    const getterBlock =
      getterAst.kind === "blockStatement"
        ? getterAst
        : ({ kind: "blockStatement", statements: [getterAst] } as const);
    currentContext = {
      ...next,
      localNameMap: currentContext.localNameMap,
      usedLocalNames: currentContext.usedLocalNames,
      returnType: currentContext.returnType,
    };
    accessorList.push({
      kind: "accessorDeclaration",
      accessorKind: "get",
      body: getterBlock,
    });
  }

  if (member.setterBody) {
    let setterEmitContext: EmitterContext = {
      ...indent(currentContext),
      usedLocalNames: new Set<string>(["value"]),
    };
    let scopedLocalNameMap: ReadonlyMap<string, string> | undefined =
      setterEmitContext.localNameMap;
    let aliasDeclaration: CSharpStatementAst | undefined;

    const setterParamName = member.setterParamName;
    if (setterParamName && setterParamName !== "value") {
      const alloc = allocateLocalName(setterParamName, setterEmitContext);
      setterEmitContext = alloc.context;
      const nextMap = new Map(setterEmitContext.localNameMap ?? []);
      nextMap.set(setterParamName, alloc.emittedName);
      scopedLocalNameMap = nextMap;
      aliasDeclaration = {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "identifierType", name: "var" },
        declarators: [
          {
            kind: "variableDeclarator",
            name: alloc.emittedName,
            initializer: { kind: "identifierExpression", identifier: "value" },
          },
        ],
      };
    }

    const [setterAst, next] = emitStatementAst(member.setterBody, {
      ...setterEmitContext,
      localNameMap: scopedLocalNameMap,
    });
    const setterBlock =
      setterAst.kind === "blockStatement"
        ? setterAst
        : ({ kind: "blockStatement", statements: [setterAst] } as const);
    accessorList.push({
      kind: "accessorDeclaration",
      accessorKind: "set",
      body: {
        kind: "blockStatement",
        statements: [
          ...(aliasDeclaration ? [aliasDeclaration] : []),
          ...setterBlock.statements,
        ],
      },
    });
    currentContext = {
      ...next,
      localNameMap: currentContext.localNameMap,
      usedLocalNames: currentContext.usedLocalNames,
      returnType: currentContext.returnType,
    };
  }

  return [
    {
      kind: "propertyDeclaration",
      attributes,
      modifiers: [
        member.accessibility ?? "public",
        ...(member.isStatic ? ["static"] : []),
        ...(!member.isStatic && !member.isOverride && member.isShadow
          ? ["new"]
          : []),
        ...(member.isOverride ? ["override"] : []),
        ...(!member.isStatic && !member.isOverride && member.isVirtual
          ? ["virtual"]
          : []),
        ...(!member.isStatic && member.isRequired ? ["required"] : []),
      ],
      type: typeAstFromText(typeText),
      name: memberName,
      accessorList,
      initializer,
    },
    currentContext,
  ];
};

const containsSuperCall = (statement: IrStatement): boolean => {
  if (
    statement.kind === "expressionStatement" &&
    statement.expression.kind === "call" &&
    statement.expression.callee.kind === "identifier" &&
    statement.expression.callee.name === "super"
  ) {
    return true;
  }
  if (statement.kind === "blockStatement") {
    return statement.statements.some(containsSuperCall);
  }
  if (statement.kind === "ifStatement") {
    return (
      containsSuperCall(statement.thenStatement) ||
      (statement.elseStatement
        ? containsSuperCall(statement.elseStatement)
        : false)
    );
  }
  if (
    statement.kind === "forStatement" ||
    statement.kind === "forOfStatement" ||
    statement.kind === "forInStatement" ||
    statement.kind === "whileStatement"
  ) {
    return containsSuperCall(statement.body);
  }
  if (statement.kind === "switchStatement") {
    return statement.cases.some((switchCase) =>
      switchCase.statements.some(containsSuperCall)
    );
  }
  if (statement.kind === "tryStatement") {
    return (
      containsSuperCall(statement.tryBlock) ||
      (statement.catchClause
        ? containsSuperCall(statement.catchClause.body)
        : false) ||
      (statement.finallyBlock
        ? containsSuperCall(statement.finallyBlock)
        : false)
    );
  }
  return false;
};

const extractSuperCall = (
  statements: readonly IrStatement[],
  context: EmitterContext
): [
  CSharpConstructorDeclarationAst["initializer"] | undefined,
  readonly IrStatement[],
  EmitterContext,
] => {
  if (statements.length === 0) return [undefined, statements, context];
  const first = statements[0];
  if (
    !first ||
    first.kind !== "expressionStatement" ||
    first.expression.kind !== "call" ||
    first.expression.callee.kind !== "identifier" ||
    first.expression.callee.name !== "super"
  ) {
    return [undefined, statements, context];
  }

  let currentContext = context;
  const args: CSharpExpressionAst[] = [];
  for (const argument of first.expression.arguments) {
    const [argExpr, next] = emitExpression(argument, currentContext);
    currentContext = next;
    args.push({ kind: "rawExpression", text: argExpr.text });
  }

  return [
    {
      kind: "constructorInitializer",
      initializerKind: "base",
      arguments: args,
    },
    statements.slice(1),
    currentContext,
  ];
};

const emitConstructorMemberAst = (
  member: Extract<IrClassMember, { kind: "constructorDeclaration" }>,
  context: EmitterContext
): [CSharpConstructorDeclarationAst | undefined, EmitterContext] => {
  let currentContext = context;
  const [attributes, attrContext] = emitAttributeList(
    member.attributes,
    currentContext
  );
  currentContext = attrContext;

  const parameters: CSharpParameterAst[] = [];
  const destructuringParams: Array<{
    readonly syntheticName: string;
    readonly pattern: IrParameter["pattern"];
    readonly type: IrType | undefined;
  }> = [];
  let syntheticIndex = 0;
  for (const parameter of member.parameters) {
    const isComplexPattern =
      parameter.pattern.kind === "arrayPattern" ||
      parameter.pattern.kind === "objectPattern";
    const explicitName = isComplexPattern
      ? `__param${syntheticIndex++}`
      : undefined;
    const [parameterAst, next] = emitParameterAst(
      parameter,
      currentContext,
      explicitName
    );
    if (!parameterAst) return [undefined, next];
    parameters.push(parameterAst);
    currentContext = next;
    if (isComplexPattern) {
      if (!explicitName) {
        throw new Error(
          "ICE: missing synthetic parameter name for complex constructor pattern"
        );
      }
      destructuringParams.push({
        syntheticName: explicitName,
        pattern: parameter.pattern,
        type: parameter.type,
      });
    }
  }

  if (!member.body) {
    return [
      {
        kind: "constructorDeclaration",
        attributes,
        modifiers: [member.accessibility ?? "public"],
        name: context.className ?? "UnknownClass",
        parameters,
        body: { kind: "blockStatement", statements: [] },
      },
      currentContext,
    ];
  }

  const [initializer, remainingStatements, superContext] = extractSuperCall(
    member.body.statements,
    currentContext
  );
  currentContext = superContext;

  if (remainingStatements.some(containsSuperCall)) {
    throw new Error(
      "Unsupported constructor semantics: super() must be the first statement to preserve JavaScript initialization order."
    );
  }

  const bodyBlock = {
    ...member.body,
    statements: remainingStatements,
  };

  let bodyContext = withStatic(indent(currentContext), false);
  bodyContext = seedLocalNameMapFromParameters(member.parameters, bodyContext);
  const destructuringInitializers: CSharpStatementAst[] = [];
  if (destructuringParams.length > 0) {
    let destructuringContext = bodyContext;
    for (const info of destructuringParams) {
      const lowered = lowerParameterPattern(
        info.pattern,
        info.syntheticName,
        info.type,
        "",
        destructuringContext
      );
      destructuringInitializers.push(
        ...parseLoweredStatements(lowered.statements)
      );
      destructuringContext = lowered.context;
    }
    bodyContext = destructuringContext;
  }
  const [bodyAst, bodyNext] = emitStatementAst(bodyBlock, bodyContext);
  const blockBody =
    bodyAst.kind === "blockStatement"
      ? bodyAst
      : ({ kind: "blockStatement", statements: [bodyAst] } as const);

  const outInitializers: CSharpStatementAst[] = [];
  for (const parameter of member.parameters) {
    if (parameter.pattern.kind !== "identifierPattern") continue;
    if (parameter.passing !== "out") continue;
    outInitializers.push({
      kind: "expressionStatement",
      expression: {
        kind: "assignmentExpression",
        operatorToken: "=",
        left: {
          kind: "identifierExpression",
          identifier: escapeCSharpIdentifier(parameter.pattern.name),
        },
        right: { kind: "literalExpression", text: "default" },
      },
    });
  }

  return [
    {
      kind: "constructorDeclaration",
      attributes,
      modifiers: [member.accessibility ?? "public"],
      name: context.className ?? "UnknownClass",
      parameters,
      initializer,
      body: {
        kind: "blockStatement",
        statements: [
          ...destructuringInitializers,
          ...outInitializers,
          ...blockBody.statements,
        ],
      },
    },
    restoreScopedContext(context, bodyNext),
  ];
};

const emitClassMemberAst = (
  member: IrClassMember,
  context: EmitterContext
): [readonly CSharpClassMemberAst[], EmitterContext] => {
  switch (member.kind) {
    case "propertyDeclaration": {
      const [propertyMember, next] = emitPropertyMemberAst(member, context);
      return [[propertyMember], next];
    }
    case "methodDeclaration": {
      const [methodMember, next] = emitMethodMemberAst(member, context);
      if (!methodMember) {
        throw new Error(
          `ICE: AST class-method lowering is incomplete for member '${member.name}'`
        );
      }
      return [[methodMember], next];
    }
    case "constructorDeclaration": {
      const [constructorMember, next] = emitConstructorMemberAst(
        member,
        context
      );
      if (!constructorMember) {
        throw new Error("ICE: AST constructor lowering failed for class.");
      }
      return [[constructorMember], next];
    }
  }

  const _exhaustive: never = member;
  throw new Error(
    `ICE: Unhandled class member kind in AST emitter: ${String(
      (_exhaustive as { kind?: unknown }).kind
    )}`
  );
};

const withMemberSpacing = (
  members: readonly CSharpClassMemberAst[]
): readonly CSharpClassMemberAst[] =>
  members.flatMap((member, index) =>
    index < members.length - 1
      ? [member, { kind: "blankLine" as const }]
      : [member]
  );

const buildReservedTypeParameterNames = (
  members: readonly IrClassMember[],
  context: EmitterContext
): ReadonlySet<string> => {
  const reserved = new Set<string>();
  for (const member of members) {
    if (member.kind === "methodDeclaration") {
      reserved.add(emitCSharpName(member.name, "methods", context));
      continue;
    }
    if (member.kind === "propertyDeclaration") {
      const name = emitCSharpName(
        member.name,
        member.emitAsField ? "fields" : "properties",
        context
      );
      reserved.add(name);
    }
  }
  return reserved;
};

const synthesizeConstructorsForBaseForwarding = (
  stmt: Extract<IrStatement, { kind: "classDeclaration" }>,
  members: readonly IrClassMember[],
  context: EmitterContext
): readonly IrClassMember[] => {
  const hasOwnCtor = members.some(
    (member) => member.kind === "constructorDeclaration"
  );
  if (hasOwnCtor) return [];
  if (!stmt.superClass || stmt.superClass.kind !== "referenceType") return [];
  if (!context.localTypes) return [];

  const baseName =
    stmt.superClass.name.split(".").pop() ?? stmt.superClass.name;
  const baseInfo = context.localTypes.get(baseName);
  if (!baseInfo || baseInfo.kind !== "class") return [];

  const baseCtors = baseInfo.members.filter(
    (member) => member.kind === "constructorDeclaration"
  );
  if (baseCtors.length === 0) return [];

  const baseTypeArgs = stmt.superClass.typeArguments ?? [];
  const substitutions = new Map<string, IrType>();
  for (let i = 0; i < baseInfo.typeParameters.length; i++) {
    const paramName = baseInfo.typeParameters[i];
    const argType = baseTypeArgs[i];
    if (paramName && argType) substitutions.set(paramName, argType);
  }

  return baseCtors.map((baseCtor) => {
    const forwardedParams = baseCtor.parameters.map((parameter) => ({
      ...parameter,
      type: parameter.type
        ? substituteType(parameter.type, substitutions)
        : undefined,
    }));

    const superArgs = forwardedParams.map((parameter) => {
      const name =
        parameter.pattern.kind === "identifierPattern"
          ? parameter.pattern.name
          : "arg";
      return { kind: "identifier" as const, name };
    });

    return {
      kind: "constructorDeclaration" as const,
      accessibility: baseCtor.accessibility ?? "public",
      parameters: forwardedParams,
      body: {
        kind: "blockStatement" as const,
        statements: [
          {
            kind: "expressionStatement" as const,
            expression: {
              kind: "call" as const,
              callee: { kind: "identifier" as const, name: "super" },
              arguments: superArgs,
              isOptional: false,
            },
          },
        ],
      },
    };
  });
};

export const emitClassDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "classDeclaration" }>,
  context: EmitterContext,
  indentLevel: number
): [readonly CSharpTypeDeclarationAst[], EmitterContext] => {
  const hasTypeParameters = (stmt.typeParameters?.length ?? 0) > 0;
  const staticMembers = hasTypeParameters
    ? stmt.members.filter(
        (member) =>
          (member.kind === "methodDeclaration" ||
            member.kind === "propertyDeclaration") &&
          member.isStatic
      )
    : [];
  const instanceMembers: readonly IrClassMember[] = hasTypeParameters
    ? stmt.members.filter(
        (member) =>
          member.kind === "constructorDeclaration" ||
          ((member.kind === "methodDeclaration" ||
            member.kind === "propertyDeclaration") &&
            !member.isStatic)
      )
    : stmt.members;

  const synthesizedConstructors = synthesizeConstructorsForBaseForwarding(
    stmt,
    instanceMembers,
    context
  );
  const membersToEmitBase: readonly IrClassMember[] =
    synthesizedConstructors.length > 0
      ? [...synthesizedConstructors, ...instanceMembers]
      : instanceMembers;

  const ctorAttributes = stmt.ctorAttributes ?? [];
  const ensureCtorForAttributes =
    ctorAttributes.length > 0 &&
    !stmt.isStruct &&
    !membersToEmitBase.some(
      (member) => member.kind === "constructorDeclaration"
    );
  const membersToEmitWithCtor: readonly IrClassMember[] =
    ensureCtorForAttributes
      ? [
          {
            kind: "constructorDeclaration",
            accessibility: "public",
            parameters: [],
            body: { kind: "blockStatement", statements: [] },
          },
          ...membersToEmitBase,
        ]
      : membersToEmitBase;
  const membersToEmit = membersToEmitWithCtor.map((member): IrClassMember => {
    if (member.kind !== "constructorDeclaration") return member;
    if (ctorAttributes.length === 0) return member;
    const existing = member.attributes ?? [];
    return {
      ...member,
      attributes: [...ctorAttributes, ...existing],
    };
  });

  const classTypeParams = new Set<string>([
    ...(context.typeParameters ?? []),
    ...(stmt.typeParameters?.map((tp) => tp.name) ?? []),
  ]);
  let currentContext: EmitterContext = {
    ...context,
    typeParameters: classTypeParams,
  };

  const reservedTypeParamNames = buildReservedTypeParameterNames(
    membersToEmit,
    context
  );
  const [, whereClauses, typeParamContext] = emitTypeParameters(
    stmt.typeParameters,
    currentContext,
    reservedTypeParamNames
  );
  currentContext = typeParamContext;

  const emittedTypeParameters =
    stmt.typeParameters?.map(
      (tp) => currentContext.typeParameterNameMap?.get(tp.name) ?? tp.name
    ) ?? [];

  const heritage: string[] = [];
  if (stmt.superClass) {
    const [superClassType, next] = emitType(stmt.superClass, currentContext);
    currentContext = next;
    heritage.push(superClassType);
  }

  const implementedInterfaces: string[] = [];
  for (const impl of stmt.implements) {
    if (impl.kind !== "referenceType") continue;

    const localInfo = context.localTypes?.get(impl.name);
    const isLocalCSharpInterface =
      localInfo?.kind === "interface" &&
      localInfo.members.some((member) => member.kind === "methodSignature");

    const bindingKeyCandidates: string[] = [impl.name];
    if (impl.typeId?.tsName) bindingKeyCandidates.push(impl.typeId.tsName);
    if (impl.name.endsWith("$instance")) {
      bindingKeyCandidates.push(impl.name.slice(0, -"$instance".length));
    }
    if (impl.name.startsWith("__") && impl.name.endsWith("$views")) {
      bindingKeyCandidates.push(impl.name.slice("__".length, -"$views".length));
    }

    const regBinding = bindingKeyCandidates
      .map((key) => context.bindingsRegistry?.get(key))
      .find((binding): binding is NonNullable<typeof binding> => !!binding);
    const isClrInterface = regBinding?.kind === "interface";

    if (!isLocalCSharpInterface && !isClrInterface) continue;
    const [implType, next] = emitType(impl, currentContext);
    currentContext = next;
    implementedInterfaces.push(implType);
  }
  heritage.push(...implementedInterfaces);

  const [classAttributes, classAttrContext] = emitAttributeList(
    stmt.attributes,
    currentContext
  );
  currentContext = classAttrContext;

  const needsUnsafe = statementUsesPointer(stmt);
  const promotedToPublic = context.publicLocalTypes?.has(stmt.name) ?? false;
  const accessibility =
    stmt.isExported || promotedToPublic ? "public" : "internal";
  const escapedClassName = escapeCSharpIdentifier(stmt.name);

  const buildClassMembers = (
    classMembers: readonly IrClassMember[],
    inputContext: EmitterContext,
    hasSuperClass: boolean
  ): [readonly CSharpClassMemberAst[], EmitterContext] => {
    let memberContext: EmitterContext = withClassName(
      {
        ...indent(inputContext),
        hasSuperClass: hasSuperClass ? true : undefined,
      },
      escapedClassName
    );
    const emittedMembers: CSharpClassMemberAst[] = [];
    for (const member of classMembers) {
      const [loweredMembers, next] = emitClassMemberAst(member, memberContext);
      emittedMembers.push(...loweredMembers);
      memberContext = next;
    }
    return [withMemberSpacing(emittedMembers), memberContext];
  };

  const declarations: CSharpTypeDeclarationAst[] = [];

  if (staticMembers.length > 0) {
    const [companionMembers, companionContext] = buildClassMembers(
      staticMembers,
      currentContext,
      false
    );
    currentContext = companionContext;
    declarations.push({
      kind: "classDeclaration",
      indentLevel,
      attributes: [],
      modifiers: [accessibility, "static", ...(needsUnsafe ? ["unsafe"] : [])],
      name: escapedClassName,
      members: companionMembers,
    });
  }

  const [mainMembers, finalContext] = buildClassMembers(
    membersToEmit,
    currentContext,
    !!stmt.superClass
  );
  currentContext = finalContext;

  declarations.push({
    kind: stmt.isStruct ? "structDeclaration" : "classDeclaration",
    indentLevel,
    attributes: classAttributes,
    modifiers: [accessibility, ...(needsUnsafe ? ["unsafe"] : [])],
    name: escapedClassName,
    typeParameters:
      emittedTypeParameters.length > 0 ? emittedTypeParameters : undefined,
    baseTypes: heritage.length > 0 ? heritage : undefined,
    whereClauses: whereClauses.length > 0 ? whereClauses : undefined,
    members: mainMembers,
  });

  return [declarations, restoreScopedContext(context, currentContext)];
};
