import type {
  LoweringBindingAccessPlan,
  LoweringParameterPlan,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
  LoweringVariablePlan,
} from "@tsonic/frontend";
import type { RenderContext } from "../types.js";
import { requiredIdentifier, sanitizeIdentifier, sanitizeTypeName } from "./names.js";
import {
  isCompileTimeOnlyExpression,
  isFunctionExpressionPlan,
  isGenericFunctionExpression,
  renderConditionExpression,
  renderExpression,
  renderExpressionWithUseSiteCast,
  renderFunctionExpressionMethodDeclaration,
  renderFunctionExpressionType,
} from "./expressions.js";
import {
  isOpaqueRuntimeTypePlan,
  isTaskLikeTypePlan,
  isVoidLikeTypePlan,
  nonNullishUnionTypes,
  renderCSharpType,
  renderFunctionReturnType,
  renderRequiredCSharpType,
  renderRequiredNullableCSharpType,
  runtimeUnionCarrierArms,
  sameRuntimeTypePlan,
  shouldEmitStructuralObjectType,
  unwrapAliasTarget,
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

const singleRuntimeUnionInstanceofArm = (
  source: LoweringTypeRefPlan | undefined,
  target: LoweringTypeRefPlan | undefined,
  targetRuntimeOwner: string | undefined
): { readonly index: number; readonly arm: LoweringTypeRefPlan } | undefined => {
  if (!target && !targetRuntimeOwner) return undefined;
  const arms = runtimeUnionCarrierArms(source);
  const exactMatches = arms
    .map((arm, index) =>
      target && sameRuntimeTypePlan(arm, target)
        ? { index: index + 1, arm }
        : undefined
    )
    .filter(
      (
        match
      ): match is { readonly index: number; readonly arm: LoweringTypeRefPlan } =>
        match !== undefined
    );
  if (exactMatches.length === 1) return exactMatches[0];
  const runtimeOwnerMatches: {
    readonly index: number;
    readonly arm: LoweringTypeRefPlan;
  }[] = [];
  arms.forEach((arm, index) => {
    if (
      targetRuntimeOwner &&
      arm.kind === "named" &&
      arm.sourceQualifiedName?.namespace === "js" &&
      arm.sourceQualifiedName.name === targetRuntimeOwner
    ) {
      runtimeOwnerMatches.push({ index: index + 1, arm });
    }
  });
  if (runtimeOwnerMatches.length === 1) return runtimeOwnerMatches[0];
  if (target?.kind !== "named") return undefined;
  const concreteMatches = arms
    .map((arm, index) => ({ arm, index: index + 1 }))
    .filter(({ arm }) => {
      const unwrapped = unwrapAliasTarget(arm);
      return (
        arm.kind === "named" &&
        unwrapped?.kind !== "function" &&
        (arm.declarationKind === "class" ||
          arm.declarationKind === "interface" ||
          arm.sourceQualifiedName !== undefined ||
        arm.externalBinding !== undefined)
      );
    });
  return concreteMatches.length === 1 ? concreteMatches[0] : undefined;
};

const jsConstructorInstanceOwners = new Set([
  "DataView",
  "Error",
  "Float32Array",
  "Float64Array",
  "Int16Array",
  "Int32Array",
  "Int8Array",
  "Map",
  "RegExp",
  "Uint16Array",
  "Uint32Array",
  "Uint8Array",
  "Uint8ClampedArray",
]);

const jsConstructorInstanceType = (
  owner: string | undefined
): LoweringTypeRefPlan | undefined =>
  owner && jsConstructorInstanceOwners.has(owner)
    ? {
        kind: "named",
        name: owner,
        typeArguments: [],
        sourceQualifiedName: { namespace: "js._", name: owner },
        declarationKind: "class",
      }
    : undefined;

const hasRuntimeUnionCarrier = (type: LoweringTypeRefPlan | undefined): boolean =>
  runtimeUnionCarrierArms(type).length > 1;

const renderInstanceofNarrowingCondition = (
  condition: LoweringStatementPlan["condition"],
  context: RenderContext
):
  | {
      readonly conditionText: string;
      readonly sourceName: string;
      readonly sourceBindingId: string | undefined;
      readonly aliasName: string;
      readonly aliasType: LoweringTypeRefPlan;
    }
  | undefined => {
  if (
    condition?.expressionKind !== "binary" ||
    condition.binaryOperator !== "instanceof" ||
    condition.left?.expressionKind !== "identifier"
  ) {
    return undefined;
  }
  const sourceName = condition.left.name ?? condition.left.literalText;
  if (!sourceName) return undefined;
  const target = condition.right?.storageTypePlan ?? condition.right?.type;
  const leftAliasType =
    (condition.left.bindingId
      ? context.currentIdentifierBindingAliasTypes?.get(condition.left.bindingId)
      : undefined) ?? context.currentIdentifierAliasTypes?.get(sourceName);
  const leftCarrier = leftAliasType
    ? hasRuntimeUnionCarrier(leftAliasType)
    : hasRuntimeUnionCarrier(condition.left.storageTypePlan ?? condition.left.type);
  const matchedArm = singleRuntimeUnionInstanceofArm(
    leftAliasType ?? condition.left.storageTypePlan ?? condition.left.type,
    target,
    condition.right?.sourceOperation?.dispatch === "constructor"
      ? condition.right.sourceOperation.owner
      : undefined
  );
  const runtimeConstructorType =
    condition.right?.sourceOperation?.dispatch === "constructor"
      ? jsConstructorInstanceType(condition.right.sourceOperation.owner)
      : undefined;
  const narrowedType = runtimeConstructorType ?? target ?? matchedArm?.arm;
  if (!narrowedType || isOpaqueRuntimeTypePlan(narrowedType)) {
    return undefined;
  }
  const aliasPrefix = sanitizeIdentifier(sourceName).replace(/^@/u, "");
  const aliasName = context.allocateTempName(`${aliasPrefix}__is`);
  const sourceQualifiedName =
    narrowedType.kind === "named" ? narrowedType.sourceQualifiedName : undefined;
  const patternType =
    narrowedType.kind === "named" &&
    sourceQualifiedName !== undefined &&
    sourceQualifiedName?.namespace === context.currentNamespace &&
    sourceQualifiedName.container === undefined
      ? sanitizeTypeName(narrowedType.name)
      : renderCSharpType(narrowedType, context);
  const leftExpression = renderExpression(condition.left, context);
  const conditionText = matchedArm && leftCarrier
    ? `(${leftExpression}.As${matchedArm.index}()) is ${patternType} ${aliasName}`
    : `${leftExpression} is ${patternType} ${aliasName}`;
    return {
      conditionText,
      sourceName,
      sourceBindingId: condition.left.bindingId,
      aliasName,
      aliasType: narrowedType,
    };
};

const renderBindingName = (
  name: string,
  bindingId: string | undefined,
  context: RenderContext
): string =>
  (bindingId ? context.currentBindingNames?.get(bindingId) : undefined) ??
  sanitizeIdentifier(name);

const renderWithIdentifierAlias = (
  context: RenderContext,
  sourceName: string,
  sourceBindingId: string | undefined,
  aliasName: string,
  aliasType: LoweringTypeRefPlan,
  render: () => string
): string => {
  const previousReadNames = context.currentIdentifierReadNames;
  const previousReadBindingNames = context.currentIdentifierReadBindingNames;
  const previousAliasTypes = context.currentIdentifierAliasTypes;
  const previousBindingAliasTypes = context.currentIdentifierBindingAliasTypes;
  context.currentIdentifierReadNames = new Map([
    ...(previousReadNames?.entries() ?? []),
    [sourceName, aliasName],
  ]);
  context.currentIdentifierReadBindingNames = sourceBindingId
    ? new Map([
        ...(previousReadBindingNames?.entries() ?? []),
        [sourceBindingId, aliasName],
      ])
    : previousReadBindingNames;
  context.currentIdentifierAliasTypes = new Map([
    ...(previousAliasTypes?.entries() ?? []),
    [sourceName, aliasType],
  ]);
  context.currentIdentifierBindingAliasTypes = sourceBindingId
    ? new Map([
        ...(previousBindingAliasTypes?.entries() ?? []),
        [sourceBindingId, aliasType],
      ])
    : previousBindingAliasTypes;
  try {
    return render();
  } finally {
    context.currentIdentifierReadNames = previousReadNames;
    context.currentIdentifierReadBindingNames = previousReadBindingNames;
    context.currentIdentifierAliasTypes = previousAliasTypes;
    context.currentIdentifierBindingAliasTypes = previousBindingAliasTypes;
  }
};

const singleMatchingType = (
  types: readonly LoweringTypeRefPlan[],
  predicate: (type: LoweringTypeRefPlan) => boolean
): LoweringTypeRefPlan | undefined => {
  const matches = types.filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
};

const tupleBindingType = (
  type: LoweringTypeRefPlan | undefined
): { readonly type: LoweringTypeRefPlan; readonly nullable: boolean } | undefined => {
  if (!type) return undefined;
  const unwrapped = unwrapAliasTarget(type);
  if (!unwrapped) return undefined;
  if (unwrapped.kind === "tuple") {
    return { type: unwrapped, nullable: false };
  }
  const tuple = singleMatchingType(
    nonNullishUnionTypes(unwrapped)
      .map((member) => unwrapAliasTarget(member))
      .filter(
        (member): member is LoweringTypeRefPlan => member !== undefined
      ),
    (member) => member.kind === "tuple"
  );
  return tuple ? { type: tuple, nullable: true } : undefined;
};

const renderBindingAccess = (
  rootName: string,
  accessPath: readonly LoweringBindingAccessPlan[],
  rootStorageType?: LoweringTypeRefPlan,
  rootType?: LoweringTypeRefPlan
): string => {
  let currentStorageType = rootStorageType;
  let currentType = rootType ?? rootStorageType;
  let currentDictionaryCarrier =
    unwrapAliasTarget(rootStorageType)?.kind === "record";
  const dictionaryValueAccess = (
    current: string,
    key: string,
    direct: boolean
  ): string => {
    const escapedKey = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return direct
      ? `${current}["${escapedKey}"]`
      : `((global::System.Collections.Generic.Dictionary<string, object?>)(${current}))["${escapedKey}"]`;
  };
  return accessPath.reduce((current, access) => {
    switch (access.kind) {
      case "element": {
        const tuple = tupleBindingType(currentType);
        if (tuple?.type.kind === "tuple") {
          const nextType = tuple.type.elements[access.index];
          currentType = nextType;
          currentStorageType = nextType;
          currentDictionaryCarrier = false;
          return `${current}${tuple.nullable ? ".Value" : ""}.Item${access.index + 1}`;
        }
        const unwrapped = currentStorageType
          ? unwrapAliasTarget(currentStorageType)
          : currentType
            ? unwrapAliasTarget(currentType)
            : undefined;
        if (unwrapped?.kind === "array") {
          currentStorageType = unwrapped.elementType;
          currentType = unwrapped.elementType;
        } else {
          currentStorageType = undefined;
          currentType = undefined;
        }
        currentDictionaryCarrier = false;
        return `${current}[${access.index}]`;
      }
      case "property": {
        const unwrapped = currentType ? unwrapAliasTarget(currentType) : undefined;
        const unwrappedStorage = currentStorageType
          ? unwrapAliasTarget(currentStorageType)
          : undefined;
        const matchingMembers =
          unwrapped?.kind === "object"
            ? unwrapped.members.filter(
                (candidate) =>
                  candidate.kind === "property" && candidate.name === access.name
              )
            : [];
        const member =
          matchingMembers.length === 1 ? matchingMembers[0] : undefined;
        currentType = member?.kind === "property" ? member.type : undefined;
        const dictionaryCarrier =
          currentDictionaryCarrier || unwrappedStorage?.kind === "record";
        currentStorageType =
          unwrappedStorage?.kind === "record"
            ? unwrappedStorage.valueType
            : currentType;
        currentDictionaryCarrier =
          dictionaryCarrier &&
          (unwrapAliasTarget(currentType)?.kind === "object" ||
            unwrapAliasTarget(currentType)?.kind === "record");
        return dictionaryCarrier
          ? dictionaryValueAccess(
              current,
              access.name,
              unwrappedStorage?.kind === "record"
            )
          : `${current}.${sanitizeIdentifier(access.name)}`;
      }
      default:
        currentStorageType = undefined;
        currentType = undefined;
        currentDictionaryCarrier = false;
        return current;
    }
  }, rootName);
};

const stringTypePlan: LoweringTypeRefPlan = {
  kind: "intrinsic",
  name: "string",
};

const objectTypePlan: LoweringTypeRefPlan = {
  kind: "intrinsic",
  name: "object",
};

const dictionaryStorageTypePlan = (): LoweringTypeRefPlan => ({
  kind: "record",
  keyType: stringTypePlan,
  valueType: objectTypePlan,
});

const renderObjectRestBinding = (
  access: string,
  excludeProperties: readonly string[]
): string => {
  const dictionary = `((global::System.Collections.Generic.Dictionary<string, object?>)(${access}))`;
  if (excludeProperties.length === 0) {
    return `new global::System.Collections.Generic.Dictionary<string, object?>(${dictionary})`;
  }
  const predicate = excludeProperties
    .map(
      (name) =>
        `__tsonic_kvp.Key != "${name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    )
    .join(" && ");
  return `global::System.Linq.Enumerable.ToDictionary(global::System.Linq.Enumerable.Where(${dictionary}, __tsonic_kvp => ${predicate}), __tsonic_kvp => __tsonic_kvp.Key, __tsonic_kvp => __tsonic_kvp.Value)`;
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
  rootStorageType: LoweringTypeRefPlan | undefined,
  rootType: LoweringTypeRefPlan | undefined,
  context: RenderContext,
  declare = true
): string => {
  const bindingStorageType = binding.storageType ?? binding.type;
  const bindingType = bindingStorageType
    ? renderCSharpType(bindingStorageType, context)
    : "var";
  const access = renderBindingAccess(
    rootName,
    binding.accessPath,
    rootStorageType,
    rootType
  );
  const restValue =
    binding.restExcludes !== undefined
      ? renderObjectRestBinding(access, binding.restExcludes)
      : undefined;
  const value = restValue
    ? renderBindingInitializer(restValue, bindingStorageType, context)
    : binding.initializer
    ? `((object?)(${access}) == null ? ${renderExpressionWithUseSiteCast(
        binding.initializer,
        context,
        bindingStorageType
      )} : ${renderBindingInitializer(access, bindingStorageType, context)})`
    : renderBindingInitializer(access, bindingStorageType, context);
  const name = renderBindingName(binding.name, binding.bindingId, context);
  return declare ? `${bindingType} ${name} = ${value};` : `${name} = ${value};`;
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

const isElementAccessInitializer = (
  initializer: LoweringVariablePlan["initializer"]
): boolean => {
  switch (initializer?.expressionKind) {
    case "element-access":
      return true;
    case "erased-wrapper":
    case "non-null":
    case "parenthesized":
      return isElementAccessInitializer(initializer.expression);
    default:
      return false;
  }
};

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
    ? renderRequiredCSharpType(
        declaration.storageType,
        context,
        "variable storage type",
        "Variable",
        declaration.name
      )
    : undefined;
  if (
    defaultType === "var" &&
    declaration.initializer &&
    !functionExpressionType &&
    !declaredType &&
    (!storageType || isElementAccessInitializer(declaration.initializer))
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
    case "record":
    case "source-primitive":
    case "tuple":
      return true;
    case "intrinsic":
      return (
        type.name === "string" ||
        type.name === "number" ||
        type.name === "boolean" ||
        type.name === "bigint"
      );
    case "literal":
      return (
        type.literalKind === "string" ||
        type.literalKind === "number" ||
        type.literalKind === "boolean" ||
        type.literalKind === "bigint"
      );
    case "object":
      return shouldEmitStructuralObjectType(type);
    case "union":
      return type.types.some(shouldRenderVariableStorageType);
    case "named":
      return type.aliasTarget?.kind === "function" || type.declarationKind === "class";
    case "intersection":
    case "predicate":
    case "unsupported":
    case undefined:
      return false;
  }
};

const renderDelegateParameter = (
  parameter: LoweringParameterPlan,
  context: RenderContext
): string => {
  const parameterName = requiredIdentifier(
    parameter.name,
    context,
    "delegate parameter name",
    parameter.sourceKindName,
    parameter.nameSourceText ?? parameter.sourceText
  );
  const type =
    parameter.rest && parameter.type?.kind === "array"
      ? `${renderCSharpType(parameter.type.elementType, context)}[]`
      : parameter.optional
        ? renderRequiredNullableCSharpType(
            parameter.type,
            context,
            "delegate parameter type",
            parameter.sourceKindName,
            parameter.sourceText
          )
        : renderRequiredCSharpType(
            parameter.type,
            context,
            "delegate parameter type",
            parameter.sourceKindName,
            parameter.sourceText
          );
  const initializer = parameter.initializer
    ? ` = ${renderExpression(parameter.initializer, context)}`
    : parameter.optional
      ? " = null"
      : "";
  return `${parameter.rest ? "params " : ""}${type} ${parameterName}${initializer}`;
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
  if (
    isFunctionExpressionPlan(declaration.initializer) &&
    isGenericFunctionExpression(declaration.initializer)
  ) {
    return renderFunctionExpressionMethodDeclaration(
      declaration.name,
      declaration.initializer,
      context
    );
  }
  const type = variableRenderType(declaration, context, "var");
  const initializer = declaration.initializer
    ? ` = ${renderExpressionWithUseSiteCast(
        declaration.initializer,
        context,
        declaration.type ?? declaration.storageType
      )}`
    : "";
  return `${type} ${renderBindingName(declaration.name, declaration.bindingId, context)}${initializer}`;
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
    isFunctionExpressionPlan(declaration.initializer) &&
    isGenericFunctionExpression(declaration.initializer)
  ) {
    return renderFunctionExpressionMethodDeclaration(
      declaration.name,
      declaration.initializer,
      context,
      "public static "
    );
  }
  if (
    declaration.initializer &&
    isFunctionExpressionPlan(declaration.initializer) &&
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
      context,
      declaration.initializer.sourceKindName,
      declaration.initializer.sourceText
    );
    return [
      `public delegate ${returnType} ${delegateName}(${parameters});`,
      `public static ${delegateName} ${sanitizeIdentifier(declaration.name)} = ${renderExpression(
        declaration.initializer,
        context
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

export const renderStaticFieldDeclaration = (
  declaration: LoweringVariablePlan,
  context: RenderContext
): string => {
  if (declaration.compileTimeOnly) return "";
  if (
    isFunctionExpressionPlan(declaration.initializer) &&
    isGenericFunctionExpression(declaration.initializer)
  ) {
    return renderFunctionExpressionMethodDeclaration(
      declaration.name,
      declaration.initializer,
      context,
      "public static "
    );
  }
  const type = variableRenderType(
    {
      ...declaration,
      initializer: undefined,
      bindingElements: [],
      type: declaration.storageType ?? declaration.type,
    },
    context,
    "object?"
  );
  return `public static ${type} ${sanitizeIdentifier(declaration.name)} = default!;`;
};

const bindingRootStorageType = (
  declaration: LoweringVariablePlan
): LoweringTypeRefPlan | undefined => {
  if (declaration.initializer?.expressionKind !== "object-literal") {
    return undefined;
  }
  const bindingTarget = declaration.type ?? declaration.storageType;
  return isOpaqueRuntimeTypePlan(bindingTarget)
    ? dictionaryStorageTypePlan()
    : undefined;
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

const uniqueBindingName = (baseName: string, usedNames: Set<string>): string => {
  if (!usedNames.has(baseName)) {
    usedNames.add(baseName);
    return baseName;
  }
  let index = 1;
  while (usedNames.has(`${baseName}__${index}`)) {
    index += 1;
  }
  const name = `${baseName}__${index}`;
  usedNames.add(name);
  return name;
};

const collectVariableBindingAlias = (
  aliases: Map<string, string>,
  usedNames: Set<string>,
  name: string,
  bindingId: string | undefined
): void => {
  if (!bindingId) return;
  const baseName = sanitizeIdentifier(name);
  const emittedName = uniqueBindingName(baseName, usedNames);
  if (emittedName !== baseName) {
    aliases.set(bindingId, emittedName);
  }
};

const collectStatementBindingAliases = (
  statement: LoweringStatementPlan | undefined,
  aliases: Map<string, string>,
  usedNames: Set<string>
): void => {
  if (!statement) return;
  for (const declaration of statement.declarations) {
    collectVariableBindingAlias(
      aliases,
      usedNames,
      declaration.name,
      declaration.bindingId
    );
    for (const binding of declaration.bindingElements) {
      collectVariableBindingAlias(
        aliases,
        usedNames,
        binding.name,
        binding.bindingId
      );
    }
  }
  if (statement.catchVariable) {
    collectVariableBindingAlias(
      aliases,
      usedNames,
      statement.catchVariable.name,
      statement.catchVariable.bindingId
    );
  }
  for (const nested of statement.statements) {
    collectStatementBindingAliases(nested, aliases, usedNames);
  }
  for (const switchCase of statement.cases) {
    for (const nested of switchCase.statements) {
      collectStatementBindingAliases(nested, aliases, usedNames);
    }
  }
  collectStatementBindingAliases(statement.thenStatement, aliases, usedNames);
  collectStatementBindingAliases(statement.elseStatement, aliases, usedNames);
  collectStatementBindingAliases(statement.body, aliases, usedNames);
  collectStatementBindingAliases(statement.tryBlock, aliases, usedNames);
  collectStatementBindingAliases(statement.catchBlock, aliases, usedNames);
  collectStatementBindingAliases(statement.finallyBlock, aliases, usedNames);
};

const functionBodyBindingAliases = (
  body: LoweringStatementPlan | undefined,
  parameters: readonly LoweringParameterPlan[]
): ReadonlyMap<string, string> => {
  const aliases = new Map<string, string>();
  const usedNames = new Set<string>();
  for (const parameter of parameters) {
    usedNames.add(sanitizeIdentifier(parameter.name));
  }
  collectStatementBindingAliases(body, aliases, usedNames);
  return aliases;
};

const generatorYieldExpression = (
  expression: LoweringStatementPlan["expression"]
) => (expression?.expressionKind === "yield" ? expression : undefined);

const renderGeneratorReceivedValue = (context: RenderContext): string => {
  const generator = context.currentGenerator;
  return generator ? `${generator.exchangeName}.Input` : "default!";
};

const renderGeneratorYield = (
  expression: NonNullable<ReturnType<typeof generatorYieldExpression>>,
  context: RenderContext
): readonly string[] => {
  const generator = context.currentGenerator;
  if (!generator) {
    context.reportUnsupported(
      "yield expression outside generator",
      expression.sourceKindName,
      expression.sourceText
    );
    return [];
  }
  if (expression.yieldDelegates) {
    context.reportUnsupported(
      "yield delegation",
      expression.sourceKindName,
      expression.sourceText
    );
    return [];
  }
  const output = expression.expression
    ? renderExpressionWithUseSiteCast(
        expression.expression,
        context,
        generator.yieldType
      )
    : "default!";
  return [
    `${generator.exchangeName}.Output = ${output};`,
    `yield return ${generator.exchangeName};`,
  ];
};

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
          context.currentTopLevelBody &&
          isFunctionExpressionPlan(declaration.initializer) &&
          isGenericFunctionExpression(declaration.initializer)
        ) {
          return [];
        }
        const yieldInitializer = generatorYieldExpression(
          declaration.initializer
        );
        if (yieldInitializer && context.currentGenerator) {
          const type = variableRenderType(declaration, context, "var");
          return [
            ...renderGeneratorYield(yieldInitializer, context),
            `${type} ${renderBindingName(declaration.name, declaration.bindingId, context)} = ${renderGeneratorReceivedValue(context)};`,
          ];
        }
        if (
          declaration.initializerReferencesDeclaration === true &&
          declaration.initializer &&
          (declaration.initializer.expressionKind === "arrow-function" ||
            declaration.initializer.expressionKind === "function-expression")
        ) {
          const name = renderBindingName(
            declaration.name,
            declaration.bindingId,
            context
          );
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
        if (context.currentTopLevelBody) {
          const name = renderBindingName(
            declaration.name,
            declaration.bindingId,
            context
          );
          return [
            `${name} = ${
              declaration.initializer
                ? renderExpressionWithUseSiteCast(
                    declaration.initializer,
                    context,
                    declaration.type ?? declaration.storageType
                  )
                : "default!"
            };`,
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
      const rootType =
        declaration.type ?? declaration.initializer.type ?? declaration.storageType;
      const rootStorageType =
        bindingRootStorageType(declaration) ??
        declaration.initializer.storageTypePlan ??
        declaration.storageType ??
        declaration.initializer.type;
      for (const binding of declaration.bindingElements) {
        lines.push(
          renderBindingElementDeclaration(
            binding,
            tempName,
            rootStorageType,
            rootType,
            context,
            context.currentTopLevelBody !== true
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

const renderGeneratorReturnStatement = (
  plan: LoweringStatementPlan,
  context: RenderContext
): string | undefined => {
  const generator = context.currentGenerator;
  if (!generator || plan.statementKind !== "return") return undefined;
  const yieldExpression = generatorYieldExpression(plan.expression);
  const lines: string[] = [];
  if (yieldExpression) {
    lines.push(...renderGeneratorYield(yieldExpression, context));
    if (generator.returnValueName) {
      lines.push(
        `${generator.returnValueName} = ${renderGeneratorReceivedValue(context)};`
      );
    }
    lines.push("yield break;");
    return lines.join("\n");
  }
  if (plan.expression && generator.returnValueName && generator.returnType) {
    lines.push(
      `${generator.returnValueName} = ${renderExpressionWithUseSiteCast(
        plan.expression,
        context,
        generator.returnType
      )};`
    );
  }
  lines.push("yield break;");
  return lines.join("\n");
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
  const expectedType = context.currentReturnType;
  if (
    (expression?.semantic === "undefined-value" ||
      expression?.literalKind === "undefined") &&
    isTaskReturnTypePlan(expectedType, context)
  ) {
    return "global::System.Threading.Tasks.Task.CompletedTask";
  }
  const rendered = renderExpressionWithUseSiteCast(
    expression,
    context,
    expectedType
  );
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

const isUndefinedOrVoidLikeTypePlan = (
  type: LoweringTypeRefPlan | undefined
): boolean =>
  isVoidLikeTypePlan(type) ||
  (type?.kind === "intrinsic" && type.name === "undefined") ||
  (type?.kind === "literal" && type.literalKind === "undefined");

const isTaskReturnTypePlan = (
  type: LoweringTypeRefPlan | undefined,
  context: RenderContext
): boolean => {
  if (isTaskLikeTypePlan(type, context)) return true;
  if (type?.kind !== "union") return false;
  const members = nonNullishUnionTypes(type);
  return (
    members.some((member) => isTaskLikeTypePlan(member, context)) &&
    members.every(
      (member) =>
        isTaskLikeTypePlan(member, context) ||
        isUndefinedOrVoidLikeTypePlan(member)
    )
  );
};

export const renderStatement = (
  plan: LoweringStatementPlan | undefined,
  context: RenderContext
): string => {
  if (!plan) return "";

  switch (plan.statementKind) {
    case "block":
      return renderBlockLike(plan.statements, context);
    case "return": {
      const generatorReturn = renderGeneratorReturnStatement(plan, context);
      if (generatorReturn !== undefined) return generatorReturn;
      return plan.expression
        ? `return ${renderReturnExpression(plan.expression, context)};`
        : "return;";
    }
    case "expression":
      if (isCompileTimeOnlyExpression(plan.expression)) {
        return "";
      }
      if (isParameterlessSuperConstructorCall(plan.expression)) {
        return "";
      }
      if (plan.expression?.expressionKind === "yield") {
        return renderGeneratorYield(plan.expression, context).join("\n");
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
      const narrowing = renderInstanceofNarrowingCondition(
        plan.condition,
        context
      );
      const thenBody = narrowing
        ? renderWithIdentifierAlias(
            context,
            narrowing.sourceName,
            narrowing.sourceBindingId,
            narrowing.aliasName,
            narrowing.aliasType,
            () => renderStatement(plan.thenStatement, context)
          )
        : renderStatement(plan.thenStatement, context);
      const elseBody = plan.elseStatement
        ? `\nelse ${renderStatement(plan.elseStatement, context)}`
        : "";
      return `if (${narrowing?.conditionText ?? renderConditionExpression(plan.condition, context)}) ${thenBody}${elseBody}`;
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
        const rootType = declaration.type ?? declaration.storageType;
        const rootStorageType = declaration.storageType ?? declaration.type;
        const bindingLines = declaration.bindingElements.map((binding) =>
          renderBindingElementDeclaration(
            binding,
            tempName,
            rootStorageType,
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
      return `foreach (${type} ${renderBindingName(declaration.name, declaration.bindingId, context)} in ${renderExpression(plan.iterable, context)}) ${renderStatement(plan.body, context)}`;
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
        ? `\ncatch${plan.catchVariable ? ` (Exception ${renderBindingName(plan.catchVariable.name, plan.catchVariable.bindingId, context)})` : ""} ${renderStatement(plan.catchBlock, context)}`
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
  const previousDefaultedParameterBindings =
    context.currentDefaultedParameterBindings;
  const previousBindingNames = context.currentBindingNames;
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
  const defaultedParameterBindingAliases =
    defaultedParameters.length > 0
      ? new Map(
          defaultedParameters
            .filter((parameter) => parameter.bindingId !== undefined)
            .map((parameter) => [
              parameter.bindingId as string,
              defaultedParameterAliases?.get(parameter.name) ??
                defaultedParameterAlias(parameter.name),
            ])
        )
      : undefined;
  const defaultedParameterPrologue = defaultedParameters.map((parameter) => {
    const parameterName = requiredIdentifier(
      parameter.name,
      context,
      "defaulted parameter name",
      parameter.sourceKindName,
      parameter.nameSourceText ?? parameter.sourceText
    );
    const alias =
      defaultedParameterAliases?.get(parameter.name) ??
      defaultedParameterAlias(parameter.name);
    return `${renderRequiredCSharpType(parameter.type, context, "defaulted parameter type", parameter.sourceKindName, parameter.sourceText)} ${alias} = ${parameterName} ?? ${renderExpression(parameter.initializer, context)};`;
  });
  const bodyAliases = functionBodyBindingAliases(body, parameters);
  context.currentDefaultedParameters = defaultedParameterAliases;
  context.currentDefaultedParameterBindings = defaultedParameterBindingAliases
    ? new Map([
        ...(previousDefaultedParameterBindings?.entries() ?? []),
        ...defaultedParameterBindingAliases.entries(),
      ])
    : previousDefaultedParameterBindings;
  context.currentBindingNames =
    bodyAliases.size > 0
      ? new Map([
          ...(previousBindingNames?.entries() ?? []),
          ...bodyAliases.entries(),
        ])
      : previousBindingNames;
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
    context.currentDefaultedParameterBindings =
      previousDefaultedParameterBindings;
    context.currentBindingNames = previousBindingNames;
  }
};

export const renderTopLevelBody = (
  statements: readonly LoweringStatementPlan[],
  context: RenderContext
): string => {
  const previousTopLevelBody = context.currentTopLevelBody;
  context.currentTopLevelBody = true;
  try {
    return renderBlockLike(
      statements.filter((statement) => statement.statementKind !== "declaration"),
      context
    );
  } finally {
    context.currentTopLevelBody = previousTopLevelBody;
  }
};
