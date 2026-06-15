import type {
  LoweringBindingAccessPlan,
  LoweringExpressionPlan,
  LoweringParameterPlan,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
  LoweringVariablePlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { sanitizeIdentifier, sanitizeTypeName } from "./names.js";
import {
  isCompileTimeOnlyExpression,
  renderConditionExpression,
  renderExpression,
  renderExpressionWithUseSiteCast,
  renderFunctionExpressionType,
} from "./expressions.js";
import {
  arrayTypeFromTypePlan,
  isOpaqueRuntimeTypePlan,
  isVoidLikeTypePlan,
  renderCSharpType,
  renderFunctionReturnType,
  renderNullableCSharpType,
  runtimeUnionCarrierArms,
  runtimeUnionTarget,
  sameRuntimeTypePlan,
  shouldEmitStructuralObjectType,
} from "./types.js";

const indent = (text: string, spaces: number): string => {
  const prefix = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
    .join("\n");
};

const unsupportedStatement = (
  context: RenderContext,
  plan: LoweringStatementPlan
): string => {
  context.reportUnsupported("statement", plan.sourceKindName, plan.sourceText);
  return "";
};

const renderBindingAccess = (
  rootName: string,
  accessPath: readonly LoweringBindingAccessPlan[],
  rootType?: LoweringTypeRefPlan
): string => {
  let currentType = rootType;
  return accessPath.reduce((current, access) => {
    switch (access.kind) {
      case "element": {
        const nullableTuple =
          currentType?.kind === "union"
            ? currentType.types.find((member) => member.kind === "tuple")
            : undefined;
        const tupleType =
          currentType?.kind === "tuple" ? currentType : nullableTuple;
        if (tupleType?.kind === "tuple") {
          const nextType = tupleType.elements[access.index];
          currentType = nextType;
          return `${current}${nullableTuple ? ".Value" : ""}.Item${access.index + 1}`;
        }
        if (currentType?.kind === "array") {
          currentType = currentType.elementType;
        } else {
          currentType = undefined;
        }
        return `${current}[${access.index}]`;
      }
      case "property": {
        const member =
          currentType?.kind === "object"
            ? currentType.members.find(
                (candidate) =>
                  candidate.kind === "property" && candidate.name === access.name
              )
            : undefined;
        currentType = member?.kind === "property" ? member.type : undefined;
        return `${current}.${sanitizeIdentifier(access.name)}`;
      }
      default:
        currentType = undefined;
        return current;
    }
  }, rootName);
};

const renderBindingInitializer = (
  expression: string,
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string => {
  const renderedType = type ? renderCSharpType(type, context) : undefined;
  if (
    !renderedType ||
    isOpaqueRuntimeTypePlan(type) ||
    isVoidLikeTypePlan(type)
  ) {
    return expression;
  }
  return `((${renderedType})(${expression}))`;
};

const renderBindingElementDeclaration = (
  binding: LoweringVariablePlan["bindingElements"][number],
  rootName: string,
  rootType: LoweringTypeRefPlan | undefined,
  context: RenderContext
): string => {
  const bindingType = binding.type
    ? renderCSharpType(binding.type, context)
    : "var";
  return `${bindingType} ${sanitizeIdentifier(binding.name)} = ${renderBindingInitializer(
    renderBindingAccess(rootName, binding.accessPath, rootType),
    binding.type,
    context
  )};`;
};

const variableFunctionExpressionType = (
  declaration: LoweringVariablePlan,
  context: RenderContext
): string | undefined =>
  renderFunctionExpressionType(declaration.initializer, context);

const variableDeclaredType = (
  declaration: LoweringVariablePlan,
  context: RenderContext
): string | undefined =>
  declaration.type ? renderCSharpType(declaration.type, context) : undefined;

const variableRenderType = (
  declaration: LoweringVariablePlan,
  context: RenderContext,
  defaultType: string
): string => {
  const functionExpressionType = variableFunctionExpressionType(
    declaration,
    context
  );
  const declaredType = variableDeclaredType(declaration, context);
  const storageType = shouldRenderVariableStorageType(declaration.storageType)
    ? renderCSharpType(declaration.storageType, context)
    : undefined;
  if (
    defaultType === "var" &&
    declaration.initializer &&
    !functionExpressionType &&
    !declaredType
  ) {
    return "var";
  }
  return functionExpressionType &&
    (!declaration.type || isOpaqueRuntimeTypePlan(declaration.type))
    ? functionExpressionType
    : declaredType ?? storageType ?? defaultType;
};

const shouldRenderVariableStorageType = (
  type: LoweringTypeRefPlan | undefined
): boolean => {
  switch (type?.kind) {
    case "array":
    case "function":
    case "tuple":
      return true;
    case "object":
      return shouldEmitStructuralObjectType(type);
    case "union":
      return type.types.some(shouldRenderVariableStorageType);
    case "named":
      return type.aliasTarget?.kind === "function" || type.declarationKind === "class";
    case "intersection":
    case "intrinsic":
    case "literal":
    case "predicate":
    case "source-primitive":
    case "unsupported":
    case undefined:
      return false;
  }
};

const renderDelegateParameter = (
  parameter: LoweringParameterPlan,
  context: RenderContext
): string => {
  const type =
    parameter.rest && parameter.type?.kind === "array"
      ? `${renderCSharpType(parameter.type.elementType, context)}[]`
      : parameter.optional
        ? renderNullableCSharpType(parameter.type, context)
        : renderCSharpType(parameter.type, context);
  const initializer = parameter.initializer
    ? ` = ${renderExpression(parameter.initializer, context)}`
    : parameter.optional
      ? " = null"
      : "";
  return `${parameter.rest ? "params " : ""}${type} ${sanitizeIdentifier(parameter.name)}${initializer}`;
};

export const renderVariableFragment = (
  declaration: LoweringVariablePlan,
  context: RenderContext
): string => {
  if (declaration.compileTimeOnly) return "";
  if (declaration.bindingElements.length > 0) {
    context.reportUnsupported("variable fragment binding pattern", "BindingPattern", declaration.name);
    return "";
  }
  const type = variableRenderType(declaration, context, "var");
  const initializer = declaration.initializer
    ? ` = ${renderExpressionWithUseSiteCast(
        declaration.initializer,
        context,
        declaration.type ?? declaration.storageType
      )}`
    : "";
  return `${type} ${sanitizeIdentifier(declaration.name)}${initializer}`;
};

export const renderStaticField = (
  declaration: LoweringVariablePlan,
  context: RenderContext
): string => {
  if (declaration.compileTimeOnly) return "";
  if (declaration.bindingElements.length > 0) {
    context.reportUnsupported("top-level binding pattern", "BindingPattern", declaration.name);
    return "";
  }
  if (
    declaration.initializer &&
    (declaration.initializer.expressionKind === "arrow-function" ||
      declaration.initializer.expressionKind === "function-expression") &&
    declaration.initializer.parameters.some(
      (parameter) => parameter.initializer !== undefined || parameter.optional
    )
  ) {
    const delegateName = `${sanitizeTypeName(declaration.name)}__Delegate`;
    const parameters = declaration.initializer.parameters
      .map((parameter) => renderDelegateParameter(parameter, context))
      .join(", ");
    const returnType = renderFunctionReturnType(
      declaration.initializer.returnType,
      declaration.initializer.async ?? false,
      context
    );
    return [
      `public delegate ${returnType} ${delegateName}(${parameters});`,
      `public static ${delegateName} ${sanitizeIdentifier(declaration.name)} = ${renderExpressionWithUseSiteCast(
        declaration.initializer,
        context,
        declaration.type ?? declaration.storageType
      )};`,
    ].join("\n");
  }
  const type = variableRenderType(declaration, context, "object?");
  const initializer = declaration.initializer
    ? ` = ${renderExpressionWithUseSiteCast(
        declaration.initializer,
        context,
        declaration.type ?? declaration.storageType
      )}`
    : "";
  return `public static ${type} ${sanitizeIdentifier(declaration.name)}${initializer};`;
};

const renderBlockLike = (
  statements: readonly LoweringStatementPlan[],
  context: RenderContext
): string =>
  [
    "{",
    ...statements
      .map((statement) => renderStatement(statement, context))
      .filter((line) => line.length > 0)
      .map((line) => indent(line, 4)),
    "}",
  ].join("\n");

const endsControlFlow = (statement: LoweringStatementPlan | undefined): boolean => {
  if (!statement) return false;
  switch (statement.statementKind) {
    case "return":
    case "throw":
    case "break":
    case "continue":
      return true;
    case "block":
      return endsControlFlow(statement.statements.at(-1));
    default:
      return false;
  }
};

const renderSwitch = (
  plan: LoweringStatementPlan,
  context: RenderContext
): string => {
  const lines = [`switch (${renderExpression(plan.expression, context)})`, "{"];
  for (const switchCase of plan.cases) {
    lines.push(
      switchCase.isDefault
        ? "    default:"
        : `    case ${renderExpression(switchCase.expression, context)}:`
    );
    for (const statement of switchCase.statements) {
      lines.push(indent(renderStatement(statement, context), 8));
    }
    if (
      switchCase.statements.length > 0 &&
      !endsControlFlow(switchCase.statements.at(-1))
    ) {
      context.reportUnsupported(
        "switch fallthrough",
        plan.sourceKindName,
        plan.sourceText
      );
    }
  }
  lines.push("}");
  return lines.join("\n");
};

const defaultedParameterAlias = (name: string): string =>
  `__defaulted_${sanitizeIdentifier(name).replace(/^@/, "")}`;

const renderVariableStatement = (
  declarations: readonly LoweringVariablePlan[],
  context: RenderContext
): string =>
  declarations
    .flatMap((declaration): readonly string[] => {
      if (declaration.compileTimeOnly) {
        return [];
      }
      if (declaration.bindingElements.length === 0) {
        if (
          declaration.initializerReferencesDeclaration === true &&
          declaration.initializer &&
          (declaration.initializer.expressionKind === "arrow-function" ||
            declaration.initializer.expressionKind === "function-expression")
        ) {
          const name = sanitizeIdentifier(declaration.name);
          const type = variableRenderType(declaration, context, "object?");
          return [
            `${type} ${name} = default!;`,
            `${name} = ${renderExpressionWithUseSiteCast(
              declaration.initializer,
              context,
              declaration.type ?? declaration.storageType
            )};`,
          ];
        }
        return [`${renderVariableFragment(declaration, context)};`];
      }
      if (!declaration.initializer) {
        context.reportUnsupported(
          "binding pattern without initializer",
          "BindingPattern",
          declaration.name
        );
        return [];
      }
      const tempName = context.allocateTempName("binding");
      const lines = [
        `var ${tempName} = ${renderExpressionWithUseSiteCast(
          declaration.initializer,
          context,
          declaration.type ?? declaration.storageType
        )};`,
      ];
      const rootType = declaration.storageType ?? declaration.initializer.type;
      for (const binding of declaration.bindingElements) {
        if (binding.initializer) {
          context.reportUnsupported(
            "binding pattern default initializer",
            "BindingElement",
            binding.name
          );
          continue;
        }
        lines.push(
          renderBindingElementDeclaration(
            binding,
            tempName,
            rootType,
            context
          )
        );
      }
      return lines;
    })
    .join("\n");

const renderVoidExpressionStatement = (
  expression: LoweringStatementPlan["expression"],
  context: RenderContext
): string => {
  const inner = expression?.expression;
  if (!inner) return "";
  const rendered = renderExpression(inner, context);
  switch (inner.expressionKind) {
    case "call":
    case "new":
    case "postfix-unary":
    case "prefix-unary":
    case "await":
      return `${rendered};`;
    default:
      return `_ = ${rendered};`;
  }
};

const namedTypeFromExpression = (
  expression: LoweringExpressionPlan | undefined
): LoweringTypeRefPlan | undefined =>
  expression?.literalText
    ? {
        kind: "named",
        name: expression.literalText,
        typeArguments: [],
        qualifiedRuntimeName: expression.qualifiedRuntimeName,
      }
    : undefined;

const instanceofIdentifierNarrowing = (
  condition: LoweringStatementPlan["condition"],
  context: RenderContext
):
  | {
      readonly name: string;
      readonly type: LoweringTypeRefPlan;
      readonly aliasName?: string;
      readonly condition?: string;
    }
  | undefined =>
  condition?.expressionKind === "binary" &&
  condition.binaryOperator === "instanceof" &&
  condition.left?.expressionKind === "identifier" &&
  condition.left.literalText
    ? (() => {
        const narrowedType =
          namedTypeFromExpression(condition.right) ??
          condition.right?.type ?? { kind: "intrinsic", name: "object" };
        const carrier =
          runtimeUnionTarget(condition.left?.type)
            ? condition.left?.type
            : runtimeUnionTarget(condition.left?.storageTypePlan)
              ? condition.left?.storageTypePlan
              : undefined;
        const arms = runtimeUnionCarrierArms(carrier, context);
        const exactArmIndex = arms.findIndex(
          (arm) => sameRuntimeTypePlan(arm, narrowedType)
        );
        const compatibleArmIndex =
          exactArmIndex >= 0
            ? exactArmIndex
            : narrowedType.kind === "named"
              ? arms.findIndex(
                  (arm) =>
                    arm.kind === "named" &&
                    (arm.declarationKind === "class" ||
                      arm.declarationKind === "interface")
                )
              : -1;
        if (carrier && compatibleArmIndex >= 0) {
          const narrowedRendered = renderCSharpType(narrowedType, context);
          const name = condition.left.literalText;
          const aliasName = `${sanitizeIdentifier(name)}__is_1`;
          return {
            name,
            type: narrowedType,
            aliasName,
            condition: `(${renderExpression(condition.left, context)}.As${compatibleArmIndex + 1}()) is ${narrowedRendered} ${aliasName}`,
          };
        }
        return {
          name: condition.left.literalText,
          type: narrowedType,
        };
      })()
    : condition?.expressionKind === "call" &&
        condition.expression?.sourceOperation?.dispatch === "static-call" &&
        condition.expression.sourceOperation.owner === "Array" &&
        condition.expression.sourceOperation.member === "isArray" &&
        condition.arguments[0]?.expressionKind === "identifier" &&
        condition.arguments[0].literalText
      ? (() => {
          const argument = condition.arguments[0];
          if (
            argument?.expressionKind !== "identifier" ||
            !argument.literalText
          ) {
            return undefined;
          }
          const carrier =
            runtimeUnionTarget(argument.storageTypePlan)
              ? argument.storageTypePlan
              : runtimeUnionTarget(argument.type)
                ? argument.type
                : undefined;
          const arms = runtimeUnionCarrierArms(carrier, context);
          const armIndex = arms.findIndex(
            (arm) => arrayTypeFromTypePlan(arm) !== undefined
          );
          const arm = arms[armIndex];
          if (!carrier || armIndex < 0 || !arm) return undefined;
          const name = argument.literalText;
          const aliasName = `${renderExpression(argument, context)}.As${armIndex + 1}()`;
          return {
            name,
            type: arm,
            aliasName,
            condition: `${aliasName} != null`,
          };
        })()
    : undefined;

const renderWithIdentifierNarrowing = (
  narrowing: ReturnType<typeof instanceofIdentifierNarrowing>,
  context: RenderContext,
  render: () => string
): string => {
  if (!narrowing) return render();
  const previousTypes = context.currentNarrowedIdentifiers;
  const previousNames = context.currentNarrowedIdentifierNames;
  const nextTypes = new Map(previousTypes ?? []);
  nextTypes.set(narrowing.name, narrowing.type);
  context.currentNarrowedIdentifiers = nextTypes;
  if (narrowing.aliasName) {
    const nextNames = new Map(previousNames ?? []);
    nextNames.set(narrowing.name, narrowing.aliasName);
    context.currentNarrowedIdentifierNames = nextNames;
  }
  try {
    return render();
  } finally {
    context.currentNarrowedIdentifiers = previousTypes;
    context.currentNarrowedIdentifierNames = previousNames;
  }
};

const isCSharpStatementExpression = (
  expression: LoweringStatementPlan["expression"]
): boolean => {
  switch (expression?.expressionKind) {
    case "call":
    case "new":
    case "postfix-unary":
    case "prefix-unary":
    case "await":
      return true;
    case "binary":
      return expression.binaryOperator?.endsWith("assign") === true;
    default:
      return false;
  }
};

const isParameterlessSuperConstructorCall = (
  expression: LoweringStatementPlan["expression"]
): boolean =>
  expression?.expressionKind === "call" &&
  expression.arguments.length === 0 &&
  expression.expression?.expressionKind === "super";

const isBroadExpressionType = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  type === undefined ||
  (type.kind === "intrinsic" &&
    (type.name === "any" || type.name === "unknown" || type.name === "object")) ||
  type.kind === "union" ||
  type.kind === "unsupported";

const needsReturnCast = (
  expectedType: LoweringTypeRefPlan,
  expression: LoweringStatementPlan["expression"],
  _context: RenderContext
): boolean => {
  const actualType = expression?.type;
  if (
    expectedType.kind === "named" &&
    expression?.expressionKind === "call" &&
    expression.expression?.expressionKind === "property-access" &&
    expression.expression.expression?.expressionKind === "super"
  ) {
    return true;
  }
  if (isBroadExpressionType(actualType)) return true;
  if (
    expectedType.kind === "named" &&
    expectedType.aliasTarget?.kind === "function" &&
    actualType?.kind === "function"
  ) {
    return true;
  }
  return (
    expectedType.kind === "named" &&
    actualType?.kind === "named" &&
    !sameRuntimeTypePlan(expectedType, actualType)
  );
};

const renderReturnExpression = (
  expression: LoweringStatementPlan["expression"],
  context: RenderContext
): string => {
  const rendered = renderExpression(expression, context);
  const expectedType = context.currentReturnType;
  if (
    expectedType &&
    !(
      expectedType.kind === "intrinsic" &&
      (expectedType.name === "void" || expectedType.name === "unknown" || expectedType.name === "object")
    ) &&
    needsReturnCast(expectedType, expression, context)
  ) {
    return `((${renderCSharpType(expectedType, context)})(${rendered}))`;
  }
  return rendered;
};

export const renderStatement = (
  plan: LoweringStatementPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";

  switch (plan.statementKind) {
    case "block":
      return renderBlockLike(plan.statements, context);
    case "return":
      return plan.expression
        ? `return ${renderReturnExpression(plan.expression, context)};`
        : "return;";
    case "expression":
      if (isCompileTimeOnlyExpression(plan.expression)) {
        return "";
      }
      if (isParameterlessSuperConstructorCall(plan.expression)) {
        return "";
      }
      if (plan.expression?.expressionKind === "yield") {
        if (plan.expression.yieldDelegates) {
          context.reportUnsupported(
            "yield delegation",
            plan.expression.sourceKindName,
            plan.expression.sourceText
          );
          return "";
        }
        return `yield return ${renderExpression(plan.expression.expression, context)};`;
      }
      if (plan.expression?.expressionKind === "void") {
        return renderVoidExpressionStatement(plan.expression, context);
      }
      return isCSharpStatementExpression(plan.expression)
        ? `${renderExpression(plan.expression, context)};`
        : `_ = ${renderExpression(plan.expression, context)};`;
    case "variable":
      return renderVariableStatement(plan.declarations, context);
    case "if": {
      const narrowing = instanceofIdentifierNarrowing(plan.condition, context);
      const thenBody = renderWithIdentifierNarrowing(narrowing, context, () =>
        renderStatement(plan.thenStatement, context)
      );
      const elseBody = plan.elseStatement
        ? `\nelse ${renderStatement(plan.elseStatement, context)}`
        : "";
      return `if (${narrowing?.condition ?? renderConditionExpression(plan.condition, context)}) ${thenBody}${elseBody}`;
    }
    case "while":
      return `while (${renderConditionExpression(plan.condition, context)}) ${renderStatement(plan.body, context)}`;
    case "for": {
      const initializer =
        plan.declarations.length > 0
          ? plan.declarations
              .map((declaration) => renderVariableFragment(declaration, context))
              .join(", ")
          : plan.expression
            ? renderExpression(plan.expression, context)
            : "";
      const condition = plan.condition
        ? renderConditionExpression(plan.condition, context)
        : "";
      const incrementor = plan.incrementor
        ? renderExpression(plan.incrementor, context)
        : "";
      return `for (${initializer}; ${condition}; ${incrementor}) ${renderStatement(plan.body, context)}`;
    }
    case "for-of": {
      if (plan.declarations.length !== 1 || plan.expression) {
        return unsupportedStatement(context, plan);
      }
      const declaration = plan.declarations[0];
      if (!declaration) return unsupportedStatement(context, plan);
      if (declaration.bindingElements.length > 0) {
        const tempName = context.allocateTempName("binding");
        const rootType = declaration.storageType ?? declaration.type;
        const bindingLines = declaration.bindingElements.map((binding) =>
          renderBindingElementDeclaration(
            binding,
            tempName,
            rootType,
            context
          )
        );
        const body = renderStatement(plan.body, context);
        const innerBody =
          plan.body?.statementKind === "block"
            ? plan.body.statements
                .map((statement) => renderStatement(statement, context))
                .filter((line) => line.length > 0)
            : [body].filter((line) => line.length > 0);
        return [
          `foreach (var ${tempName} in ${renderExpression(plan.iterable, context)})`,
          "{",
          ...[...bindingLines, ...innerBody].map((line) => indent(line, 4)),
          "}",
        ].join("\n");
      }
      const type = declaration.type
        ? renderCSharpType(declaration.type, context)
        : "var";
      return `foreach (${type} ${sanitizeIdentifier(declaration.name)} in ${renderExpression(plan.iterable, context)}) ${renderStatement(plan.body, context)}`;
    }
    case "for-in":
      return unsupportedStatement(context, plan);
    case "break":
      return "break;";
    case "continue":
      return "continue;";
    case "switch":
      return renderSwitch(plan, context);
    case "try": {
      const catchBlock = plan.catchBlock
        ? `\ncatch${plan.catchVariable ? ` (Exception ${sanitizeIdentifier(plan.catchVariable.name)})` : ""} ${renderStatement(plan.catchBlock, context)}`
        : "";
      const finallyBlock = plan.finallyBlock
        ? `\nfinally ${renderStatement(plan.finallyBlock, context)}`
        : "";
      return `try ${renderStatement(plan.tryBlock, context)}${catchBlock}${finallyBlock}`;
    }
    case "throw":
      return `throw ${renderExpression(plan.expression, context)};`;
    case "empty":
    case "declaration":
      return "";
    case "unsupported":
      return unsupportedStatement(context, plan);
  }
};

export const renderFunctionBody = (
  body: LoweringStatementPlan | undefined,
  context: RenderContext,
  returnType?: LoweringTypeRefPlan,
  parameters: readonly LoweringParameterPlan[] = []
): string => {
  const previousReturnType = context.currentReturnType;
  const previousDefaultedParameters = context.currentDefaultedParameters;
  context.currentReturnType = returnType;
  const defaultedParameters = parameters.filter(
    (parameter) => parameter.initializer !== undefined
  );
  const defaultedParameterAliases =
    defaultedParameters.length > 0
      ? new Map(
          defaultedParameters.map((parameter) => [
            parameter.name,
            defaultedParameterAlias(parameter.name),
          ])
        )
      : undefined;
  const defaultedParameterPrologue = defaultedParameters.map((parameter) => {
    const alias =
      defaultedParameterAliases?.get(parameter.name) ??
      defaultedParameterAlias(parameter.name);
    return `${renderCSharpType(parameter.type, context)} ${alias} = ${sanitizeIdentifier(parameter.name)} ?? ${renderExpression(parameter.initializer, context)};`;
  });
  context.currentDefaultedParameters = defaultedParameterAliases;
  try {
  const rendered =
    !body
      ? "{\n}"
      : body.statementKind === "block"
        ? renderStatement(body, context)
        : renderBlockLike([body], context);
  if (defaultedParameterPrologue.length === 0) return rendered;
  const lines = rendered.split("\n");
  return [
    lines[0] ?? "{",
    ...defaultedParameterPrologue.map((line) => indent(line, 4)),
    ...lines.slice(1),
  ].join("\n");
  } finally {
    context.currentReturnType = previousReturnType;
    context.currentDefaultedParameters = previousDefaultedParameters;
  }
};

export const renderTopLevelBody = (
  statements: readonly LoweringStatementPlan[],
  context: RenderContext
): string =>
  renderBlockLike(
    statements.filter((statement) => statement.statementKind !== "declaration"),
    context
  );
