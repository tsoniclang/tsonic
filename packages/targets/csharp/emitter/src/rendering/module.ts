import type {
  LoweringDeclarationPlan,
  LoweringExpressionPlan,
  LoweringStatementPlan,
  LoweringTypeRefPlan,
  LoweringVariablePlan,
} from "@tsonic/frontend";
import type {
  CSharpLoweringModulePlan,
  EmitterOptions,
  ModuleEmitResult,
  RenderContext,
} from "../types.js";
import { renderDeclaration, renderStaticContainerMember } from "./declarations.js";
import { renderStaticField, renderTopLevelBody } from "./statements.js";
import {
  isRecursiveRuntimeArrayArm,
  renderCSharpType,
  renderNullableCSharpType,
  renderRequiredCSharpType,
  renderStructuralTypeReference,
  renderTypeParameters,
  runtimeUnionCarrierArms,
  renderTypeMember,
  shouldEmitStructuralObjectType,
  shouldEmitAnonymousRuntimeUnionCarrier,
  shouldExpandNamedAliasTarget,
  structuralTypeName,
  structuralTypeParameterNames,
  externalBindingKey,
  sourceRuntimeNameKey,
  typePlanKey,
} from "./types.js";
import { sanitizeIdentifier } from "./names.js";

const hasNamespaceDeclarationShape = (
  declaration: LoweringDeclarationPlan
): boolean =>
  declaration.declarationKind === "class" ||
  declaration.declarationKind === "enum" ||
  declaration.declarationKind === "interface" ||
  declaration.declarationKind === "type-alias";

const isStaticTopLevelVariableStatement = (
  statement: CSharpLoweringModulePlan["topLevelStatements"][number]
): boolean =>
  statement.statementKind === "variable" &&
  statement.declarations.every(
    (declaration) => declaration.bindingElements.length === 0
  );

const topLevelVariableDeclarations = (
  module: CSharpLoweringModulePlan
): readonly LoweringVariablePlan[] =>
  module.topLevelStatements
    .filter(isStaticTopLevelVariableStatement)
    .flatMap((statement) => statement.declarations);

const renderExportAliasFields = (
  module: CSharpLoweringModulePlan,
  context: RenderContext
): readonly string[] => {
  const variables = new Map(
    topLevelVariableDeclarations(module).map((declaration) => [
      declaration.name,
      declaration,
    ])
  );
  return module.exports
    .filter(
      (binding) =>
        binding.kind === "named" &&
        !binding.isTypeOnly &&
        binding.localName !== undefined &&
        binding.exportedName !== undefined &&
        binding.localName !== binding.exportedName
    )
    .map((binding) => {
      const variable = variables.get(binding.localName ?? "");
      if (!variable) return undefined;
      return `    public static ${renderRequiredCSharpType(variable.storageType ?? variable.type, context, "export alias type", "Variable", variable.name)} ${sanitizeIdentifier(binding.exportedName)} => ${sanitizeIdentifier(binding.localName)};`;
    })
    .filter((rendered): rendered is string => rendered !== undefined);
};

type StructuralTypeTraversalState = {
  readonly types: ReadonlySet<LoweringTypeRefPlan>;
  readonly namedTypes: ReadonlySet<string>;
};

const createStructuralTypeTraversalState = (): StructuralTypeTraversalState => ({
  types: new Set<LoweringTypeRefPlan>(),
  namedTypes: new Set<string>(),
});

const structuralNamedTypeKey = (
  type: Extract<LoweringTypeRefPlan, { readonly kind: "named" }>
): string =>
  `${sourceRuntimeNameKey(type.sourceRuntimeName) ?? externalBindingKey(type.externalBinding) ?? type.name}<${type.typeArguments.length}>`;

const withStructuralType = (
  state: StructuralTypeTraversalState,
  type: LoweringTypeRefPlan
): StructuralTypeTraversalState | undefined => {
  if (state.types.has(type)) return undefined;
  const types = new Set(state.types);
  types.add(type);
  return { types, namedTypes: state.namedTypes };
};

const withStructuralNamedType = (
  state: StructuralTypeTraversalState,
  type: Extract<LoweringTypeRefPlan, { readonly kind: "named" }>
): StructuralTypeTraversalState | undefined => {
  const key = structuralNamedTypeKey(type);
  if (state.namedTypes.has(key)) return undefined;
  const namedTypes = new Set(state.namedTypes);
  namedTypes.add(key);
  return { types: state.types, namedTypes };
};

const collectStructuralType = (
  types: Map<string, LoweringTypeRefPlan>,
  type: LoweringTypeRefPlan | undefined,
  state: StructuralTypeTraversalState = createStructuralTypeTraversalState()
): void => {
  if (!type) return;
  const typeState = withStructuralType(state, type);
  if (!typeState) return;
  switch (type.kind) {
    case "object":
      if (!shouldEmitStructuralObjectType(type)) {
        break;
      }
      types.set(typePlanKey(type), type);
      for (const member of type.members) {
        switch (member.kind) {
          case "property":
            collectStructuralType(types, member.type, typeState);
            break;
          case "method":
            for (const parameter of member.parameters) {
              collectStructuralType(types, parameter.type, typeState);
            }
            collectStructuralType(types, member.returnType, typeState);
            break;
        }
      }
      break;
    case "named": {
      const namedState = withStructuralNamedType(typeState, type);
      if (!namedState) return;
      if (shouldExpandNamedAliasTarget(type)) {
        collectStructuralType(types, type.aliasTarget, namedState);
      }
      for (const argument of type.typeArguments) {
        collectStructuralType(types, argument, namedState);
      }
      break;
    }
    case "array":
      collectStructuralType(types, type.elementType, typeState);
      break;
    case "record":
      collectStructuralType(types, type.keyType, typeState);
      collectStructuralType(types, type.valueType, typeState);
      break;
    case "tuple":
      for (const element of type.elements) {
        collectStructuralType(types, element, typeState);
      }
      break;
    case "union":
      if (shouldEmitAnonymousRuntimeUnionCarrier(type)) {
        types.set(typePlanKey(type), type);
      }
      for (const member of type.types) {
        collectStructuralType(types, member, typeState);
      }
      break;
    case "intersection":
      for (const member of type.types) {
        collectStructuralType(types, member, typeState);
      }
      break;
    case "function":
      for (const parameter of type.parameters) {
        collectStructuralType(types, parameter.type, typeState);
      }
      collectStructuralType(types, type.returnType, typeState);
      break;
    case "predicate":
      collectStructuralType(types, type.assertedType, typeState);
      break;
    case "intrinsic":
    case "source-primitive":
    case "literal":
    case "unsupported":
      break;
  }
};

type StructuralPlanTraversalState = {
  readonly expressions: ReadonlySet<LoweringExpressionPlan>;
  readonly statements: ReadonlySet<LoweringStatementPlan>;
  readonly declarations: ReadonlySet<LoweringDeclarationPlan>;
  readonly variables: ReadonlySet<LoweringVariablePlan>;
};

const createStructuralPlanTraversalState = (): StructuralPlanTraversalState => ({
  expressions: new Set<LoweringExpressionPlan>(),
  statements: new Set<LoweringStatementPlan>(),
  declarations: new Set<LoweringDeclarationPlan>(),
  variables: new Set<LoweringVariablePlan>(),
});

const withExpressionPlan = (
  state: StructuralPlanTraversalState,
  expression: LoweringExpressionPlan
): StructuralPlanTraversalState | undefined => {
  if (state.expressions.has(expression)) return undefined;
  const expressions = new Set(state.expressions);
  expressions.add(expression);
  return { ...state, expressions };
};

const withStatementPlan = (
  state: StructuralPlanTraversalState,
  statement: LoweringStatementPlan
): StructuralPlanTraversalState | undefined => {
  if (state.statements.has(statement)) return undefined;
  const statements = new Set(state.statements);
  statements.add(statement);
  return { ...state, statements };
};

const withDeclarationPlan = (
  state: StructuralPlanTraversalState,
  declaration: LoweringDeclarationPlan
): StructuralPlanTraversalState | undefined => {
  if (state.declarations.has(declaration)) return undefined;
  const declarations = new Set(state.declarations);
  declarations.add(declaration);
  return { ...state, declarations };
};

const withVariablePlan = (
  state: StructuralPlanTraversalState,
  declaration: LoweringVariablePlan
): StructuralPlanTraversalState | undefined => {
  if (state.variables.has(declaration)) return undefined;
  const variables = new Set(state.variables);
  variables.add(declaration);
  return { ...state, variables };
};

const collectStructuralTypesFromExpression = (
  types: Map<string, LoweringTypeRefPlan>,
  expression: LoweringExpressionPlan | undefined,
  state: StructuralPlanTraversalState = createStructuralPlanTraversalState()
): void => {
  if (!expression) return;
  const expressionState = withExpressionPlan(state, expression);
  if (!expressionState) return;
  collectStructuralType(types, expression.type);
  collectStructuralType(types, expression.contextualTypePlan);
  collectStructuralType(types, expression.storageTypePlan);
  collectStructuralType(types, expression.receiverTypePlan);
  collectStructuralType(types, expression.callTargetTypePlan);
  collectStructuralType(types, expression.returnType);
  for (const typeArgument of expression.typeArguments) {
    collectStructuralType(types, typeArgument);
  }
  collectStructuralTypesFromExpression(types, expression.expression, expressionState);
  collectStructuralTypesFromExpression(types, expression.left, expressionState);
  collectStructuralTypesFromExpression(types, expression.right, expressionState);
  collectStructuralTypesFromExpression(types, expression.condition, expressionState);
  collectStructuralTypesFromExpression(types, expression.whenTrue, expressionState);
  collectStructuralTypesFromExpression(types, expression.whenFalse, expressionState);
  for (const argument of expression.arguments) {
    collectStructuralTypesFromExpression(types, argument, expressionState);
  }
  for (const element of expression.elements) {
    collectStructuralTypesFromExpression(types, element, expressionState);
  }
  for (const property of expression.properties) {
    collectStructuralTypesFromExpression(types, property.expression, expressionState);
  }
  for (const parameter of expression.parameters) {
    collectStructuralType(types, parameter.type);
    collectStructuralTypesFromExpression(
      types,
      parameter.initializer,
      expressionState
    );
  }
};

const collectStructuralTypesFromVariable = (
  types: Map<string, LoweringTypeRefPlan>,
  declaration: LoweringVariablePlan,
  state: StructuralPlanTraversalState = createStructuralPlanTraversalState()
): void => {
  const variableState = withVariablePlan(state, declaration);
  if (!variableState) return;
  collectStructuralType(types, declaration.type);
  collectStructuralTypesFromExpression(
    types,
    declaration.initializer,
    variableState
  );
  for (const binding of declaration.bindingElements) {
    collectStructuralTypesFromExpression(
      types,
      binding.initializer,
      variableState
    );
  }
};

const collectStructuralTypesFromStatement = (
  types: Map<string, LoweringTypeRefPlan>,
  statement: LoweringStatementPlan | undefined,
  state: StructuralPlanTraversalState = createStructuralPlanTraversalState()
): void => {
  if (!statement) return;
  if (statement.compileTimeOnly) return;
  const statementState = withStatementPlan(state, statement);
  if (!statementState) return;
  collectStructuralTypesFromExpression(types, statement.expression, statementState);
  collectStructuralTypesFromExpression(types, statement.condition, statementState);
  collectStructuralTypesFromExpression(
    types,
    statement.incrementor,
    statementState
  );
  collectStructuralTypesFromExpression(types, statement.iterable, statementState);
  if (statement.catchVariable) {
    collectStructuralTypesFromVariable(
      types,
      statement.catchVariable,
      statementState
    );
  }
  collectStructuralTypesFromStatement(types, statement.thenStatement, statementState);
  collectStructuralTypesFromStatement(types, statement.elseStatement, statementState);
  collectStructuralTypesFromStatement(types, statement.body, statementState);
  collectStructuralTypesFromStatement(types, statement.tryBlock, statementState);
  collectStructuralTypesFromStatement(types, statement.catchBlock, statementState);
  collectStructuralTypesFromStatement(types, statement.finallyBlock, statementState);
  for (const declaration of statement.declarations) {
    collectStructuralTypesFromVariable(types, declaration, statementState);
  }
  for (const child of statement.statements) {
    collectStructuralTypesFromStatement(types, child, statementState);
  }
  for (const switchCase of statement.cases) {
    collectStructuralTypesFromExpression(
      types,
      switchCase.expression,
      statementState
    );
    for (const child of switchCase.statements) {
      collectStructuralTypesFromStatement(types, child, statementState);
    }
  }
};

const collectStructuralTypesFromDeclaration = (
  types: Map<string, LoweringTypeRefPlan>,
  declaration: LoweringDeclarationPlan,
  state: StructuralPlanTraversalState = createStructuralPlanTraversalState()
): void => {
  const declarationState = withDeclarationPlan(state, declaration);
  if (!declarationState) return;
  collectStructuralType(types, declaration.declaredTypePlan);
  if (
    declaration.declarationKind === "type-alias" &&
    declaration.typeAliasTarget?.kind === "union"
  ) {
    for (const member of declaration.typeAliasTarget.types) {
      collectStructuralType(types, member);
    }
  } else {
    collectStructuralType(types, declaration.typeAliasTarget);
  }
  collectStructuralType(types, declaration.returnType);
  for (const heritage of declaration.heritageTypes) {
    collectStructuralType(types, heritage);
  }
  for (const parameter of declaration.parameters) {
    collectStructuralType(types, parameter.type);
    collectStructuralTypesFromExpression(
      types,
      parameter.initializer,
      declarationState
    );
  }
  collectStructuralTypesFromExpression(
    types,
    declaration.initializer,
    declarationState
  );
  collectStructuralTypesFromStatement(types, declaration.body, declarationState);
  for (const member of declaration.members) {
    collectStructuralTypesFromDeclaration(types, member, declarationState);
  }
};

const collectStructuralTypes = (
  module: CSharpLoweringModulePlan
): readonly LoweringTypeRefPlan[] => {
  const types = new Map<string, LoweringTypeRefPlan>();
  const state = createStructuralPlanTraversalState();
  for (const declaration of module.declarations) {
    collectStructuralTypesFromDeclaration(types, declaration, state);
  }
  for (const statement of module.statements) {
    collectStructuralTypesFromStatement(types, statement, state);
  }
  for (const statement of module.topLevelStatements) {
    collectStructuralTypesFromStatement(types, statement, state);
  }
  return [...types.values()];
};

const renderStructuralType = (
  type: LoweringTypeRefPlan,
  context: RenderContext
): string | undefined => {
  if (type.kind === "union") {
    const arms = runtimeUnionCarrierArms(type, context);
    if (arms.length < 2) return undefined;
    const name = context.getStructuralTypeName(type);
    const typeParameterList = renderTypeParameters(
      structuralTypeParameterNames(type)
    );
    const typeReference = renderStructuralTypeReference(type, context);
    return [
      `public sealed class ${name}${typeParameterList}`,
      "{",
      "    private readonly object? value;",
      `    private ${name}(object? value)`,
      "    {",
      "        this.value = value;",
      "    }",
      "",
      "    public object? Value => this.value;",
      "",
      ...arms.flatMap((arm, index) => {
        const armNumber = index + 1;
        const armType = renderCSharpType(arm, context);
        const nullableArmType = renderNullableCSharpType(arm, context);
        const recursiveArrayArm = isRecursiveRuntimeArrayArm(
          arm,
          type,
          context
        );
        return [
          `    public static ${typeReference} From${armNumber}(${armType} value) => new ${typeReference}(value);`,
          ...(recursiveArrayArm
            ? [
                `    public static ${typeReference} From${armNumber}(object?[] value) => From${armNumber}(global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Select(value, FromValue)));`,
                `    public static ${typeReference} From${armNumber}(global::System.Collections.Generic.List<object?> value) => From${armNumber}(global::System.Linq.Enumerable.ToArray(global::System.Linq.Enumerable.Select(value, FromValue)));`,
              ]
            : []),
          `    public ${nullableArmType} As${armNumber}() => this.value is ${armType} value ? value : default;`,
          "",
        ];
      }),
      `    public static ${typeReference} FromNull() => new ${typeReference}(null);`,
      `    public static ${typeReference} FromValue(object? value)`,
      "    {",
      "        if (value == null) return FromNull();",
      ...arms.flatMap((arm, index) => {
        const armNumber = index + 1;
        const armType = renderCSharpType(arm, context);
        const recursiveArrayArm = isRecursiveRuntimeArrayArm(
          arm,
          type,
          context
        );
        return [
          ...(recursiveArrayArm
            ? [
                `        if (value is object?[] array${armNumber}) return From${armNumber}(array${armNumber});`,
                `        if (value is global::System.Collections.Generic.List<object?> list${armNumber}) return From${armNumber}(list${armNumber});`,
              ]
            : []),
          `        if (value is ${armType} value${armNumber}) return From${armNumber}(value${armNumber});`,
        ];
      }),
      `        throw new global::System.InvalidCastException("Value cannot be converted to ${name}.");`,
      "    }",
      "    public bool IsNull => this.value == null;",
      "}",
    ].join("\n");
  }
  if (type.kind !== "object") return undefined;
  const name = context.getStructuralTypeName(type);
  const typeParameterList = renderTypeParameters(
    structuralTypeParameterNames(type)
  );
  const hasMethods = type.members.some((member) => member.kind === "method");
  if (hasMethods) {
    return [
      `public interface ${name}${typeParameterList}`,
      "{",
      ...type.members.map((member) => `    ${renderTypeMember(member, context)}`),
      "}",
    ].join("\n");
  }
  return [
    `public sealed class ${name}${typeParameterList}`,
    "{",
    ...type.members.map(
      (member) => `    public ${renderTypeMember(member, context)}`
    ),
    "}",
  ].join("\n");
};

const createRenderContext = (
  options: Partial<EmitterOptions>
): RenderContext => {
  const diagnostics: RenderContext["diagnostics"] = [];
  diagnostics.push(...(options.externalBindingMetadata?.diagnostics ?? []));
  let nextTempId = 0;
  return {
    diagnostics,
    getStructuralTypeName: structuralTypeName,
    externalBindingTargetName: (binding) =>
      options.externalBindingMetadata?.resolveTargetName(binding),
    overrideMemberAccessibility: (heritageTypes, member) =>
      options.externalBindingMetadata?.resolveOverrideAccessibility(
        heritageTypes,
        member
      ),
    allocateTempName: (prefix) => {
      const name = `__tsonic_${prefix}_${nextTempId}`;
      nextTempId += 1;
      return name;
    },
    reportUnsupported: (feature, sourceKindName, sourceText) => {
      diagnostics.push({
        code: "TSN2001",
        severity: "error",
        message: `C# lowering does not yet support ${feature} '${sourceKindName}'.`,
        hint: sourceText.replace(/\s+/g, " ").slice(0, 240),
      });
    },
  };
};

export const emitModule = (
  module: CSharpLoweringModulePlan,
  options: Partial<EmitterOptions> = {}
): ModuleEmitResult => {
  const context = createRenderContext(options);
  const namespaceDeclarations = module.declarations
    .filter(
      (declaration) =>
        hasNamespaceDeclarationShape(declaration) && !declaration.compileTimeOnly
    )
    .map((declaration) => renderDeclaration(declaration, context))
    .filter((rendered): rendered is string => rendered !== undefined);
  const staticMembers = module.declarations
    .filter(
      (declaration) =>
        !hasNamespaceDeclarationShape(declaration) && !declaration.compileTimeOnly
    )
    .map((declaration) => renderStaticContainerMember(declaration, context))
    .filter((rendered): rendered is string => rendered !== undefined);
  const topLevelFields = module.topLevelStatements
    .filter(isStaticTopLevelVariableStatement)
    .flatMap((statement) => statement.declarations)
    .filter((declaration) => !declaration.compileTimeOnly)
    .map((declaration) => renderStaticField(declaration, context))
    .filter((rendered) => rendered.length > 0)
    .map((rendered) => `    ${rendered}`);
  const exportAliasFields = renderExportAliasFields(module, context);
  const structuralDeclarations = collectStructuralTypes(module)
    .map((type) => renderStructuralType(type, context))
    .filter((rendered): rendered is string => rendered !== undefined);
  const executableTopLevelStatements = module.topLevelStatements.filter(
    (statement) =>
      statement.statementKind !== "declaration" &&
      !isStaticTopLevelVariableStatement(statement)
  );
  const topLevelMethod =
    executableTopLevelStatements.length > 0
      ? [
          "    public static void __TopLevel()",
          renderTopLevelBody(executableTopLevelStatements, context)
            .split("\n")
            .map((line) => `    ${line}`)
            .join("\n"),
        ]
      : [];

  const lines: string[] = [
    "#nullable enable",
    "using System;",
    "using System.Collections.Concurrent;",
    "using System.Collections.Generic;",
    "using System.Globalization;",
    "using System.Text;",
    "using System.Text.RegularExpressions;",
    "using System.Threading;",
    "using System.Threading.Tasks;",
    "",
    `namespace ${module.identity.namespace};`,
    "",
  ];

  lines.push(...namespaceDeclarations);
  if (structuralDeclarations.length > 0) {
    if (namespaceDeclarations.length > 0) lines.push("");
    lines.push(...structuralDeclarations);
  }

  if (
    staticMembers.length > 0 ||
    topLevelFields.length > 0 ||
    exportAliasFields.length > 0 ||
    topLevelMethod.length > 0 ||
    (namespaceDeclarations.length === 0 && structuralDeclarations.length === 0)
  ) {
    if (namespaceDeclarations.length > 0 || structuralDeclarations.length > 0) {
      lines.push("");
    }
    lines.push(`public static class ${module.identity.className}`);
    lines.push("{");
    lines.push(...staticMembers);
    lines.push(...topLevelFields);
    lines.push(...exportAliasFields);
    if (topLevelMethod.length > 0) {
      if (
        staticMembers.length > 0 ||
        topLevelFields.length > 0 ||
        exportAliasFields.length > 0
      ) {
        lines.push("");
      }
      lines.push(...topLevelMethod);
    }
    lines.push("}");
  }

  if (context.diagnostics.length > 0) {
    return { ok: false, errors: context.diagnostics };
  }
  return { ok: true, code: `${lines.join("\n")}\n` };
};
