/**
 * Expression Emitter - IR expressions to C# code
 * Main dispatcher - delegates to specialized modules
 *
 * Primary entry point is emitExpressionAst which returns [CSharpExpressionAst, EmitterContext].
 */

import {
  IrExpression,
  IrType,
  IrNumericNarrowingExpression,
  IrTypeAssertionExpression,
  IrAsInterfaceExpression,
  IrTryCastExpression,
  IrStackAllocExpression,
  IrDefaultOfExpression,
  IrNameOfExpression,
  IrSizeOfExpression,
} from "@tsonic/frontend";
import { EmitterContext } from "./types.js";
import { emitTypeAst } from "./type-emitter.js";
import {
  substituteTypeArgs,
  resolveTypeAlias,
  stripNullish,
  getPropertyType,
  getAllPropertySignatures,
  resolveLocalTypeInfo,
} from "./core/semantic/type-resolution.js";
import type {
  CSharpExpressionAst,
  CSharpStatementAst,
  CSharpTypeAst,
} from "./core/format/backend-ast/types.js";
import {
  identifierExpression,
  identifierType,
  nullLiteral,
  stringLiteral,
} from "./core/format/backend-ast/builders.js";
import { getIdentifierTypeName } from "./core/format/backend-ast/utils.js";
import { allocateLocalName } from "./core/format/local-names.js";
import { emitCSharpName } from "./naming-policy.js";

// Import expression emitters from specialized modules
import { emitLiteral } from "./expressions/literals.js";
import { emitIdentifier } from "./expressions/identifiers.js";
import { emitArray, emitObject } from "./expressions/collections.js";
import { emitMemberAccess } from "./expressions/access.js";
import { emitCall } from "./expressions/calls/call-emitter.js";
import { emitNew } from "./expressions/calls/new-emitter.js";
import {
  emitBinary,
  emitLogical,
  emitUnary,
  emitUpdate,
  emitAssignment,
  emitConditional,
} from "./expressions/operators.js";
import {
  emitFunctionExpression,
  emitArrowFunction,
} from "./expressions/functions.js";
import {
  emitTemplateLiteral,
  emitSpread,
  emitAwait,
} from "./expressions/other.js";
import type { LocalTypeInfo } from "./emitter-types/core.js";

type StructuralPropertyInfo = {
  readonly name: string;
  readonly type: IrType;
  readonly isOptional: boolean;
};

const hasNullishBranch = (type: IrType | undefined): boolean => {
  if (!type || type.kind !== "unionType") return false;
  return type.types.some(
    (member) =>
      member.kind === "primitiveType" &&
      (member.name === "null" || member.name === "undefined")
  );
};

const buildDelegateType = (
  parameterTypes: readonly CSharpTypeAst[],
  returnType: CSharpTypeAst
): CSharpTypeAst =>
  identifierType("global::System.Func", [...parameterTypes, returnType]);

const collectLocalStructuralProperties = (
  info: LocalTypeInfo
): readonly StructuralPropertyInfo[] | undefined => {
  switch (info.kind) {
    case "interface": {
      if (info.members.some((member) => member.kind === "methodSignature")) {
        return undefined;
      }
      const props: StructuralPropertyInfo[] = [];
      for (const member of info.members) {
        if (member.kind !== "propertySignature") continue;
        props.push({
          name: member.name,
          type: member.type,
          isOptional: member.isOptional,
        });
      }
      return props;
    }

    case "class": {
      if (info.members.some((member) => member.kind === "methodDeclaration")) {
        return undefined;
      }
      const props: StructuralPropertyInfo[] = [];
      for (const member of info.members) {
        if (member.kind !== "propertyDeclaration") continue;
        if (!member.type) return undefined;
        props.push({
          name: member.name,
          type: member.type,
          isOptional: false,
        });
      }
      return props;
    }

    case "typeAlias": {
      const aliasType = info.type;
      if (aliasType.kind !== "objectType") return undefined;
      if (
        aliasType.members.some((member) => member.kind === "methodSignature")
      ) {
        return undefined;
      }
      return aliasType.members
        .filter(
          (
            member
          ): member is Extract<typeof member, { kind: "propertySignature" }> =>
            member.kind === "propertySignature"
        )
        .map((member) => ({
          name: member.name,
          type: member.type,
          isOptional: member.isOptional,
        }));
    }

    default:
      return undefined;
  }
};

const parseEmitterClrTypeString = (clrType: string): IrType => {
  if (clrType === "System.Void" || clrType === "void") {
    return { kind: "voidType" };
  }

  const primitiveMap: Record<string, IrType> = {
    "System.String": { kind: "primitiveType", name: "string" },
    string: { kind: "primitiveType", name: "string" },
    "System.Int32": { kind: "primitiveType", name: "int" },
    int: { kind: "primitiveType", name: "int" },
    "System.Double": { kind: "primitiveType", name: "number" },
    double: { kind: "primitiveType", name: "number" },
    "System.Boolean": { kind: "primitiveType", name: "boolean" },
    bool: { kind: "primitiveType", name: "boolean" },
    "System.Char": { kind: "primitiveType", name: "char" },
    char: { kind: "primitiveType", name: "char" },
    "System.Int64": { kind: "referenceType", name: "long" },
    long: { kind: "referenceType", name: "long" },
    "System.Object": { kind: "referenceType", name: "object" },
    object: { kind: "referenceType", name: "object" },
  };

  const primitive = primitiveMap[clrType];
  if (primitive) return primitive;

  if (clrType.endsWith("[]")) {
    return {
      kind: "arrayType",
      elementType: parseEmitterClrTypeString(clrType.slice(0, -2)),
    };
  }

  if (clrType.endsWith("*")) {
    return parseEmitterClrTypeString(clrType.slice(0, -1));
  }

  if (clrType.startsWith("System.Nullable`1")) {
    const innerMatch = clrType.match(/System\.Nullable`1\[\[([^\]]+)\]\]/);
    if (innerMatch?.[1]) {
      return {
        kind: "unionType",
        types: [
          parseEmitterClrTypeString(innerMatch[1]),
          { kind: "primitiveType", name: "undefined" },
        ],
      };
    }
  }

  if (/^T\d*$/.test(clrType) || /^T[A-Z][a-zA-Z]*$/.test(clrType)) {
    return { kind: "typeParameterType", name: clrType };
  }

  const underscoreInstantiationMatch = clrType.match(
    /^(.+?)_(\d+)\[\[(.+)\]\]$/
  );
  if (
    underscoreInstantiationMatch?.[1] &&
    underscoreInstantiationMatch[2] &&
    underscoreInstantiationMatch[3]
  ) {
    const baseName = underscoreInstantiationMatch[1];
    const arity = Number.parseInt(underscoreInstantiationMatch[2], 10);
    const args = splitEmitterTypeArguments(underscoreInstantiationMatch[3]);
    return {
      kind: "referenceType",
      name: `${baseName}_${arity}`,
      typeArguments:
        args.length === arity
          ? args.map((arg) => parseEmitterClrTypeString(arg.trim()))
          : undefined,
      resolvedClrType: clrType,
    };
  }

  const genericMatch = clrType.match(/^(.+)`(\d+)(?:\[\[(.+)\]\])?$/);
  if (genericMatch?.[1] && genericMatch[2]) {
    const baseName = genericMatch[1];
    const arity = Number.parseInt(genericMatch[2], 10);
    const typeArguments = genericMatch[3]
      ? splitEmitterTypeArguments(genericMatch[3]).map((arg) =>
          parseEmitterClrTypeString(arg.trim())
        )
      : Array.from({ length: arity }, (_, index) => ({
          kind: "typeParameterType" as const,
          name: index === 0 ? "T" : `T${index + 1}`,
        }));

    return {
      kind: "referenceType",
      name: baseName,
      typeArguments,
      resolvedClrType: clrType,
    };
  }

  return {
    kind: "referenceType",
    name: clrType,
    resolvedClrType: clrType,
  };
};

const splitEmitterTypeArguments = (text: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of text) {
    if (char === "[") {
      depth++;
      current += char;
      continue;
    }
    if (char === "]") {
      depth--;
      current += char;
      continue;
    }
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
};

const addUndefinedToBindingType = (type: IrType): IrType => {
  if (
    type.kind === "unionType" &&
    type.types.some(
      (candidate) =>
        candidate.kind === "primitiveType" && candidate.name === "undefined"
    )
  ) {
    return type;
  }

  return {
    kind: "unionType",
    types: [type, { kind: "primitiveType", name: "undefined" }],
  };
};

const parseBindingPropertyType = (
  normalizedSignature: string | undefined
): IrType => {
  if (!normalizedSignature) {
    return { kind: "unknownType" };
  }

  const indexerMatch = normalizedSignature.match(/\|\[[^\]]*\]:([^|]+)\|/);
  if (indexerMatch?.[1]) {
    return parseEmitterClrTypeString(indexerMatch[1]);
  }

  const propertyMatch = normalizedSignature.match(/\|:([^|]+)\|/);
  if (propertyMatch?.[1]) {
    return parseEmitterClrTypeString(propertyMatch[1]);
  }

  const fieldParts = normalizedSignature.split("|");
  if (fieldParts.length >= 2 && fieldParts[1]) {
    return parseEmitterClrTypeString(fieldParts[1]);
  }

  return { kind: "unknownType" };
};

const collectBindingStructuralProperties = (
  type: Extract<IrType, { kind: "referenceType" }>,
  context: EmitterContext
): readonly StructuralPropertyInfo[] | undefined => {
  const registry = context.bindingsRegistry;
  if (!registry || registry.size === 0) {
    return undefined;
  }

  const candidates = new Set<string>();
  const add = (value: string | undefined): void => {
    if (value && value.length > 0) {
      candidates.add(value);
      if (value.includes(".")) {
        candidates.add(value.split(".").pop() ?? value);
      }
    }
  };

  add(type.name);
  add(type.resolvedClrType);
  add(type.typeId?.tsName);
  add(type.typeId?.clrName);

  for (const candidate of candidates) {
    const binding = registry.get(candidate);
    if (!binding) continue;
    if (binding.members.some((member) => member.kind === "method")) {
      return undefined;
    }

    const props = binding.members
      .filter(
        (
          member
        ): member is (typeof binding.members)[number] & {
          kind: "property";
        } => member.kind === "property"
      )
      .map((member) => ({
        name: member.alias,
        type:
          member.semanticType !== undefined
            ? member.semanticOptional === true
              ? addUndefinedToBindingType(member.semanticType)
              : member.semanticType
            : parseBindingPropertyType(member.signature),
        isOptional: member.semanticOptional === true,
      }));

    if (props.length > 0) {
      return props;
    }
  }

  return undefined;
};

const collectStructuralProperties = (
  type: IrType | undefined,
  context: EmitterContext
): readonly StructuralPropertyInfo[] | undefined => {
  if (!type) return undefined;

  const resolved = resolveTypeAlias(stripNullish(type), context);

  if (resolved.kind === "objectType") {
    if (resolved.members.some((member) => member.kind === "methodSignature")) {
      return undefined;
    }
    return resolved.members
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        type: member.type,
        isOptional: member.isOptional,
      }));
  }

  if (resolved.kind !== "referenceType") {
    return undefined;
  }

  const inheritedInterfaceProps = getAllPropertySignatures(resolved, context);
  if (inheritedInterfaceProps && inheritedInterfaceProps.length > 0) {
    return inheritedInterfaceProps.map((member) => ({
      name: member.name,
      type: member.type,
      isOptional: member.isOptional,
    }));
  }

  const localInfo = resolveLocalTypeInfo(resolved, context)?.info;
  if (localInfo) {
    return collectLocalStructuralProperties(localInfo);
  }

  if (resolved.structuralMembers && resolved.structuralMembers.length > 0) {
    if (
      resolved.structuralMembers.some(
        (member) => member.kind === "methodSignature"
      )
    ) {
      return undefined;
    }
    return resolved.structuralMembers
      .filter(
        (
          member
        ): member is Extract<typeof member, { kind: "propertySignature" }> =>
          member.kind === "propertySignature"
      )
      .map((member) => ({
        name: member.name,
        type: member.type,
        isOptional: member.isOptional,
      }));
  }

  return collectBindingStructuralProperties(resolved, context);
};

const resolveAnonymousStructuralReferenceType = (
  type: IrType,
  context: EmitterContext
): IrType | undefined => {
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "objectType") return undefined;

  const propertyNames = resolved.members
    .filter(
      (
        member
      ): member is Extract<
        typeof member,
        { kind: "propertySignature"; name: string }
      > => member.kind === "propertySignature"
    )
    .map((member) => member.name)
    .sort();

  if (propertyNames.length === 0) return undefined;

  const candidateMaps: ReadonlyMap<string, LocalTypeInfo>[] = [];
  if (context.localTypes) {
    candidateMaps.push(context.localTypes);
  }
  if (context.options.moduleMap) {
    for (const module of context.options.moduleMap.values()) {
      if (module.localTypes) {
        candidateMaps.push(module.localTypes);
      }
    }
  }

  const matches = new Set<string>();
  for (const localTypes of candidateMaps) {
    for (const [typeName, info] of localTypes.entries()) {
      if (info.kind !== "class" || !typeName.startsWith("__Anon_")) continue;
      const candidateProps = info.members
        .filter(
          (
            member
          ): member is Extract<
            typeof member,
            { kind: "propertyDeclaration"; name: string }
          > => member.kind === "propertyDeclaration"
        )
        .map((member) => member.name)
        .sort();
      if (
        candidateProps.length === propertyNames.length &&
        candidateProps.every((name, index) => name === propertyNames[index])
      ) {
        matches.add(typeName);
      }
    }
  }

  if (matches.size !== 1) return undefined;
  const onlyMatch = [...matches][0];
  return onlyMatch
    ? ({ kind: "referenceType", name: onlyMatch } satisfies IrType)
    : undefined;
};

const isSameNominalType = (
  sourceType: IrType | undefined,
  targetType: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!sourceType || !targetType) return false;

  const sourceBase = stripNullish(sourceType);
  const targetBase = stripNullish(targetType);

  if (
    sourceBase.kind === "referenceType" &&
    targetBase.kind === "referenceType"
  ) {
    if (sourceBase.name === targetBase.name) {
      return true;
    }

    if (
      sourceBase.typeId?.stableId !== undefined &&
      sourceBase.typeId.stableId === targetBase.typeId?.stableId
    ) {
      return true;
    }

    if (
      sourceBase.resolvedClrType !== undefined &&
      sourceBase.resolvedClrType === targetBase.resolvedClrType
    ) {
      return true;
    }
  }

  const sourceResolved = resolveTypeAlias(sourceBase, context);
  const targetResolved = resolveTypeAlias(targetBase, context);
  if (
    sourceResolved.kind !== "referenceType" ||
    targetResolved.kind !== "referenceType"
  ) {
    return false;
  }

  return (
    sourceResolved.name === targetResolved.name ||
    (sourceResolved.resolvedClrType !== undefined &&
      sourceResolved.resolvedClrType === targetResolved.resolvedClrType)
  );
};

const buildStructuralSourceAccess = (
  sourceExpression: CSharpExpressionAst,
  sourceType: IrType,
  propertyName: string,
  context: EmitterContext
): CSharpExpressionAst => {
  const resolvedSource = resolveTypeAlias(stripNullish(sourceType), context);
  if (resolvedSource.kind === "dictionaryType") {
    return {
      kind: "elementAccessExpression",
      expression: sourceExpression,
      arguments: [stringLiteral(propertyName)],
    };
  }

  return {
    kind: "memberAccessExpression",
    expression: sourceExpression,
    memberName: emitCSharpName(propertyName, "properties", context),
  };
};

const isDirectlyReusableExpression = (
  expression: CSharpExpressionAst
): boolean =>
  expression.kind === "identifierExpression" ||
  expression.kind === "memberAccessExpression" ||
  expression.kind === "elementAccessExpression";

const getArrayElementType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind === "arrayType") return resolved.elementType;
  if (resolved.kind === "tupleType") {
    if (resolved.elementTypes.length === 1) return resolved.elementTypes[0];
    return undefined;
  }
  if (
    resolved.kind === "referenceType" &&
    (resolved.name === "Array" ||
      resolved.name === "ReadonlyArray" ||
      resolved.name === "JSArray") &&
    resolved.typeArguments?.length === 1
  ) {
    return resolved.typeArguments[0];
  }
  return undefined;
};

const getDictionaryValueType = (
  type: IrType | undefined,
  context: EmitterContext
): IrType | undefined => {
  if (!type) return undefined;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  if (resolved.kind !== "dictionaryType") return undefined;
  return resolved.valueType;
};

const tryAdaptStructuralExpressionAst = (
  emittedAst: CSharpExpressionAst,
  sourceType: IrType | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] | undefined => {
  if (!expectedType || !sourceType) return undefined;
  if (isSameNominalType(sourceType, expectedType, context)) {
    return undefined;
  }

  const strippedExpectedType = stripNullish(expectedType);
  const anonymousStructuralTarget = resolveAnonymousStructuralReferenceType(
    expectedType,
    context
  );
  const targetStructuralType =
    anonymousStructuralTarget ??
    resolveTypeAlias(strippedExpectedType, context);
  const targetEmissionType =
    anonymousStructuralTarget ??
    (strippedExpectedType.kind === "referenceType"
      ? strippedExpectedType
      : undefined);
  const targetProps = collectStructuralProperties(
    targetStructuralType,
    context
  );
  if (targetProps && targetProps.length > 0) {
    if (!targetEmissionType && targetStructuralType.kind === "objectType") {
      return undefined;
    }

    const sourceProps = collectStructuralProperties(sourceType, context);
    if (!sourceProps || sourceProps.length === 0) return undefined;

    const sourcePropNames = new Set(sourceProps.map((prop) => prop.name));
    const materializedProps = targetProps.filter(
      (prop) => prop.isOptional || sourcePropNames.has(prop.name)
    );
    if (materializedProps.length === 0) return undefined;

    for (const prop of targetProps) {
      if (!prop.isOptional && !sourcePropNames.has(prop.name)) {
        return undefined;
      }
      if (!sourcePropNames.has(prop.name)) continue;
      if (!getPropertyType(sourceType, prop.name, context)) {
        return undefined;
      }
    }

    let currentContext = context;
    const [targetTypeAst, withType] = emitTypeAst(
      targetEmissionType ?? targetStructuralType,
      currentContext
    );
    currentContext = withType;
    const safeTargetTypeAst =
      targetTypeAst.kind === "nullableType"
        ? targetTypeAst.underlyingType
        : targetTypeAst;

    const sourcePropMap = new Map(sourceProps.map((prop) => [prop.name, prop]));

    const buildInitializer = (
      sourceExpression: CSharpExpressionAst,
      initContext: EmitterContext
    ): [CSharpExpressionAst, EmitterContext] => {
      let currentInitContext = initContext;
      const assignments = materializedProps
        .filter((prop) => sourcePropNames.has(prop.name))
        .map((prop) => {
          const sourceProp = sourcePropMap.get(prop.name);
          const sourceAccess = buildStructuralSourceAccess(
            sourceExpression,
            sourceType,
            prop.name,
            currentInitContext
          );
          const [adaptedValueAst, adaptedValueContext] =
            tryAdaptStructuralExpressionAst(
              sourceAccess,
              sourceProp?.type,
              currentInitContext,
              prop.type
            ) ?? [sourceAccess, currentInitContext];
          currentInitContext = adaptedValueContext;

          return {
            kind: "assignmentExpression" as const,
            operatorToken: "=" as const,
            left: {
              kind: "identifierExpression" as const,
              identifier: emitCSharpName(
                prop.name,
                "properties",
                currentInitContext
              ),
            },
            right: adaptedValueAst,
          };
        });

      return [
        {
          kind: "objectCreationExpression",
          type: safeTargetTypeAst,
          arguments: [],
          initializer: assignments,
        },
        currentInitContext,
      ];
    };

    const sourceMayBeNullish = hasNullishBranch(sourceType);
    if (emittedAst.kind === "identifierExpression") {
      const [initializer, initializerContext] = buildInitializer(
        emittedAst,
        currentContext
      );
      if (!sourceMayBeNullish) {
        return [initializer, initializerContext];
      }
      return [
        {
          kind: "conditionalExpression",
          condition: {
            kind: "binaryExpression",
            operatorToken: "==",
            left: emittedAst,
            right: nullLiteral(),
          },
          whenTrue: {
            kind: "defaultExpression",
            type: safeTargetTypeAst,
          },
          whenFalse: initializer,
        },
        initializerContext,
      ];
    }

    const temp = allocateLocalName("__struct", currentContext);
    currentContext = temp.context;
    const tempIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: temp.emittedName,
    };

    const statements: CSharpStatementAst[] = [
      {
        kind: "localDeclarationStatement",
        modifiers: [],
        type: { kind: "varType" },
        declarators: [{ name: temp.emittedName, initializer: emittedAst }],
      },
    ];

    if (sourceMayBeNullish) {
      statements.push({
        kind: "ifStatement",
        condition: {
          kind: "binaryExpression",
          operatorToken: "==",
          left: tempIdentifier,
          right: nullLiteral(),
        },
        thenStatement: {
          kind: "blockStatement",
          statements: [
            {
              kind: "returnStatement",
              expression: {
                kind: "defaultExpression",
                type: safeTargetTypeAst,
              },
            },
          ],
        },
      });
    }

    const [initializer, initializerContext] = buildInitializer(
      tempIdentifier,
      currentContext
    );
    currentContext = initializerContext;

    statements.push({
      kind: "returnStatement",
      expression: initializer,
    });

    const lambdaAst: CSharpExpressionAst = {
      kind: "lambdaExpression",
      isAsync: false,
      parameters: [],
      body: {
        kind: "blockStatement",
        statements,
      },
    };

    return [
      {
        kind: "invocationExpression",
        expression: {
          kind: "parenthesizedExpression",
          expression: {
            kind: "castExpression",
            type: buildDelegateType([], safeTargetTypeAst),
            expression: {
              kind: "parenthesizedExpression",
              expression: lambdaAst,
            },
          },
        },
        arguments: [],
      },
      currentContext,
    ];
  }

  const targetElementType = getArrayElementType(expectedType, context);
  const sourceElementType = getArrayElementType(sourceType, context);
  if (targetElementType && sourceElementType) {
    const item = allocateLocalName("__item", context);
    let currentContext = item.context;
    const itemIdentifier: CSharpExpressionAst = {
      kind: "identifierExpression",
      identifier: item.emittedName,
    };
    const [adaptedElementAst, adaptedContext] = tryAdaptStructuralExpressionAst(
      itemIdentifier,
      sourceElementType,
      currentContext,
      targetElementType
    ) ?? [undefined, currentContext];
    currentContext = adaptedContext;
    if (adaptedElementAst !== undefined) {
      const selectAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          ...identifierExpression("global::System.Linq.Enumerable.Select"),
        },
        arguments: [
          emittedAst,
          {
            kind: "lambdaExpression",
            isAsync: false,
            parameters: [{ name: item.emittedName }],
            body: adaptedElementAst,
          },
        ],
      };
      const toArrayAst: CSharpExpressionAst = {
        kind: "invocationExpression",
        expression: {
          ...identifierExpression("global::System.Linq.Enumerable.ToArray"),
        },
        arguments: [selectAst],
      };

      if (!hasNullishBranch(sourceType)) {
        return [toArrayAst, currentContext];
      }

      if (isDirectlyReusableExpression(emittedAst)) {
        return [
          {
            kind: "conditionalExpression",
            condition: {
              kind: "binaryExpression",
              operatorToken: "==",
              left: emittedAst,
              right: nullLiteral(),
            },
            whenTrue: { kind: "defaultExpression" },
            whenFalse: toArrayAst,
          },
          currentContext,
        ];
      }
    }
  }

  const targetValueType = getDictionaryValueType(expectedType, context);
  const sourceValueType = getDictionaryValueType(sourceType, context);
  if (targetValueType && sourceValueType) {
    let currentContext = context;
    const [targetValueTypeAst, valueTypeContext] = emitTypeAst(
      targetValueType,
      currentContext
    );
    currentContext = valueTypeContext;
    const dictTypeAst: CSharpTypeAst = identifierType(
      "global::System.Collections.Generic.Dictionary",
      [{ kind: "predefinedType", keyword: "string" }, targetValueTypeAst]
    );
    const sourceTemp = allocateLocalName("__dict", currentContext);
    currentContext = sourceTemp.context;
    const entryTemp = allocateLocalName("__entry", currentContext);
    currentContext = entryTemp.context;
    const resultTemp = allocateLocalName("__result", currentContext);
    currentContext = resultTemp.context;

    const entryValueAst: CSharpExpressionAst = {
      kind: "memberAccessExpression",
      expression: {
        kind: "identifierExpression",
        identifier: entryTemp.emittedName,
      },
      memberName: "Value",
    };
    const [adaptedValueAst, adaptedContext] = tryAdaptStructuralExpressionAst(
      entryValueAst,
      sourceValueType,
      currentContext,
      targetValueType
    ) ?? [undefined, currentContext];
    currentContext = adaptedContext;
    if (adaptedValueAst !== undefined) {
      const statements: CSharpStatementAst[] = [
        {
          kind: "localDeclarationStatement",
          modifiers: [],
          type: { kind: "varType" },
          declarators: [
            {
              name: sourceTemp.emittedName,
              initializer: emittedAst,
            },
          ],
        },
        {
          kind: "ifStatement",
          condition: {
            kind: "binaryExpression",
            operatorToken: "==",
            left: {
              kind: "identifierExpression",
              identifier: sourceTemp.emittedName,
            },
            right: nullLiteral(),
          },
          thenStatement: {
            kind: "blockStatement",
            statements: [
              {
                kind: "returnStatement",
                expression: { kind: "defaultExpression", type: dictTypeAst },
              },
            ],
          },
        },
        {
          kind: "localDeclarationStatement",
          modifiers: [],
          type: { kind: "varType" },
          declarators: [
            {
              name: resultTemp.emittedName,
              initializer: {
                kind: "objectCreationExpression",
                type: dictTypeAst,
                arguments: [],
              },
            },
          ],
        },
        {
          kind: "foreachStatement",
          isAwait: false,
          type: { kind: "varType" },
          identifier: entryTemp.emittedName,
          expression: {
            kind: "identifierExpression",
            identifier: sourceTemp.emittedName,
          },
          body: {
            kind: "blockStatement",
            statements: [
              {
                kind: "expressionStatement",
                expression: {
                  kind: "assignmentExpression",
                  operatorToken: "=",
                  left: {
                    kind: "elementAccessExpression",
                    expression: {
                      kind: "identifierExpression",
                      identifier: resultTemp.emittedName,
                    },
                    arguments: [
                      {
                        kind: "memberAccessExpression",
                        expression: {
                          kind: "identifierExpression",
                          identifier: entryTemp.emittedName,
                        },
                        memberName: "Key",
                      },
                    ],
                  },
                  right: adaptedValueAst,
                },
              },
            ],
          },
        },
        {
          kind: "returnStatement",
          expression: {
            kind: "identifierExpression",
            identifier: resultTemp.emittedName,
          },
        },
      ];

      return [
        {
          kind: "invocationExpression",
          expression: {
            kind: "parenthesizedExpression",
            expression: {
              kind: "castExpression",
              type: buildDelegateType([], dictTypeAst),
              expression: {
                kind: "parenthesizedExpression",
                expression: {
                  kind: "lambdaExpression",
                  isAsync: false,
                  parameters: [],
                  body: {
                    kind: "blockStatement",
                    statements,
                  },
                },
              },
            },
          },
          arguments: [],
        },
        currentContext,
      ];
    }
  }

  return undefined;
};

const getBareTypeParameterName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind === "typeParameterType") return type.name;
  if (
    type.kind === "referenceType" &&
    (context.typeParameters?.has(type.name) ?? false) &&
    (!type.typeArguments || type.typeArguments.length === 0)
  ) {
    return type.name;
  }
  return undefined;
};

const getUnconstrainedNullishTypeParamName = (
  type: IrType,
  context: EmitterContext
): string | undefined => {
  if (type.kind !== "unionType") return undefined;

  const nonNullTypes = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullTypes.length !== 1) return undefined;

  const nonNull = nonNullTypes[0];
  if (!nonNull) return undefined;

  const typeParamName = getBareTypeParameterName(nonNull, context);
  if (!typeParamName) return undefined;

  const constraintKind =
    context.typeParamConstraints?.get(typeParamName) ?? "unconstrained";
  return constraintKind === "unconstrained" ? typeParamName : undefined;
};

const maybeCastNullishTypeParamAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) return [ast, context];
  if (!expr.inferredType) return [ast, context];

  const expectedTypeParam = getBareTypeParameterName(expectedType, context);
  if (!expectedTypeParam) return [ast, context];

  const unionTypeParam = getUnconstrainedNullishTypeParamName(
    expr.inferredType,
    context
  );
  if (!unionTypeParam) return [ast, context];
  if (unionTypeParam !== expectedTypeParam) return [ast, context];

  const [typeAst, newContext] = emitTypeAst(expectedType, context);
  return [
    {
      kind: "castExpression",
      type: typeAst,
      expression: ast,
    },
    newContext,
  ];
};

const getNullableUnionBaseType = (type: IrType): IrType | undefined => {
  if (type.kind !== "unionType") return undefined;

  const nonNullTypes = type.types.filter(
    (t) =>
      !(
        t.kind === "primitiveType" &&
        (t.name === "null" || t.name === "undefined")
      )
  );
  if (nonNullTypes.length !== 1) return undefined;
  return nonNullTypes[0];
};

const isNonNullableValueType = (type: IrType): boolean => {
  if (type.kind === "primitiveType") {
    return (
      type.name === "number" ||
      type.name === "int" ||
      type.name === "boolean" ||
      type.name === "char"
    );
  }

  if (type.kind === "referenceType") {
    return (
      type.name === "sbyte" ||
      type.name === "short" ||
      type.name === "int" ||
      type.name === "long" ||
      type.name === "nint" ||
      type.name === "int128" ||
      type.name === "byte" ||
      type.name === "ushort" ||
      type.name === "uint" ||
      type.name === "ulong" ||
      type.name === "nuint" ||
      type.name === "uint128" ||
      type.name === "half" ||
      type.name === "float" ||
      type.name === "double" ||
      type.name === "decimal" ||
      type.name === "bool" ||
      type.name === "char"
    );
  }

  return false;
};

const isSameTypeForNullableUnwrap = (
  base: IrType,
  expected: IrType
): boolean => {
  if (base.kind !== expected.kind) return false;

  if (base.kind === "primitiveType" && expected.kind === "primitiveType") {
    return base.name === expected.name;
  }

  if (base.kind === "referenceType" && expected.kind === "referenceType") {
    return (
      base.name === expected.name &&
      (base.typeArguments?.length ?? 0) === 0 &&
      (expected.typeArguments?.length ?? 0) === 0
    );
  }

  return false;
};

const maybeUnwrapNullableValueTypeAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType) return [ast, context];
  if (!expr.inferredType) return [ast, context];

  // Only unwrap direct nullable values.
  if (expr.kind !== "identifier" && expr.kind !== "memberAccess") {
    return [ast, context];
  }

  const getMemberAccessNarrowKey = (
    m: Extract<IrExpression, { kind: "memberAccess" }>
  ): string | undefined => {
    if (m.isComputed) return undefined;
    if (typeof m.property !== "string") return undefined;

    const obj = m.object;
    if (obj.kind === "identifier") return `${obj.name}.${m.property}`;
    if (obj.kind === "memberAccess") {
      const prefix = getMemberAccessNarrowKey(obj);
      return prefix ? `${prefix}.${m.property}` : undefined;
    }
    return undefined;
  };

  if (
    context.narrowedBindings &&
    ((expr.kind === "identifier" && context.narrowedBindings.has(expr.name)) ||
      (expr.kind === "memberAccess" &&
        (() => {
          const key = getMemberAccessNarrowKey(expr);
          return key ? context.narrowedBindings.has(key) : false;
        })()))
  ) {
    return [ast, context];
  }

  const nullableBase = getNullableUnionBaseType(expr.inferredType);
  if (!nullableBase) return [ast, context];

  if (!isNonNullableValueType(expectedType)) return [ast, context];
  if (!isSameTypeForNullableUnwrap(nullableBase, expectedType)) {
    return [ast, context];
  }

  // Append .Value
  return [
    {
      kind: "memberAccessExpression",
      expression: ast,
      memberName: "Value",
    },
    context,
  ];
};

const normalizeComparableType = (
  type: IrType,
  context: EmitterContext
): IrType => resolveTypeAlias(stripNullish(type), context);

const areIrTypesEquivalent = (
  left: IrType,
  right: IrType,
  context: EmitterContext
): boolean => {
  const a = normalizeComparableType(left, context);
  const b = normalizeComparableType(right, context);

  if (a.kind !== b.kind) return false;

  switch (a.kind) {
    case "primitiveType":
      return a.name === (b as typeof a).name;
    case "literalType":
      return a.value === (b as typeof a).value;
    case "referenceType": {
      const rb = b as typeof a;
      if (a.name !== rb.name) return false;
      const aArgs = a.typeArguments ?? [];
      const bArgs = rb.typeArguments ?? [];
      if (aArgs.length !== bArgs.length) return false;
      for (let i = 0; i < aArgs.length; i++) {
        const aa = aArgs[i];
        const bb = bArgs[i];
        if (!aa || !bb || !areIrTypesEquivalent(aa, bb, context)) return false;
      }
      return true;
    }
    case "arrayType":
      return areIrTypesEquivalent(
        a.elementType,
        (b as typeof a).elementType,
        context
      );
    case "dictionaryType":
      return (
        areIrTypesEquivalent(a.keyType, (b as typeof a).keyType, context) &&
        areIrTypesEquivalent(a.valueType, (b as typeof a).valueType, context)
      );
    case "tupleType": {
      const rb = b as typeof a;
      if (a.elementTypes.length !== rb.elementTypes.length) return false;
      for (let i = 0; i < a.elementTypes.length; i++) {
        const ae = a.elementTypes[i];
        const be = rb.elementTypes[i];
        if (!ae || !be || !areIrTypesEquivalent(ae, be, context)) return false;
      }
      return true;
    }
    case "functionType": {
      const rb = b as typeof a;
      if (a.parameters.length !== rb.parameters.length) return false;
      for (let i = 0; i < a.parameters.length; i++) {
        const ap = a.parameters[i];
        const bp = rb.parameters[i];
        if (!ap || !bp) return false;
        if (!ap.type && !bp.type) continue;
        if (!ap.type || !bp.type) return false;
        if (!areIrTypesEquivalent(ap.type, bp.type, context)) return false;
      }
      return areIrTypesEquivalent(a.returnType, rb.returnType, context);
    }
    case "unionType":
    case "intersectionType": {
      const rb = b as typeof a;
      if (a.types.length !== rb.types.length) return false;
      const used = new Set<number>();
      for (const at of a.types) {
        if (!at) return false;
        let matched = false;
        for (let i = 0; i < rb.types.length; i++) {
          if (used.has(i)) continue;
          const bt = rb.types[i];
          if (!bt) continue;
          if (areIrTypesEquivalent(at, bt, context)) {
            used.add(i);
            matched = true;
            break;
          }
        }
        if (!matched) return false;
      }
      return true;
    }
    case "typeParameterType":
      return a.name === (b as typeof a).name;
    case "voidType":
    case "anyType":
    case "unknownType":
    case "neverType":
      return true;
    case "objectType": {
      const rb = b as typeof a;
      if (a.members.length !== rb.members.length) return false;
      for (let i = 0; i < a.members.length; i++) {
        const am = a.members[i];
        const bm = rb.members[i];
        if (!am || !bm || am.kind !== bm.kind) return false;
        if (
          am.kind === "propertySignature" &&
          bm.kind === "propertySignature"
        ) {
          if (am.name !== bm.name) return false;
          if (!areIrTypesEquivalent(am.type, bm.type, context)) return false;
          continue;
        }
        if (am.kind === "methodSignature" && bm.kind === "methodSignature") {
          if (am.name !== bm.name) return false;
          if (am.parameters.length !== bm.parameters.length) return false;
          for (let j = 0; j < am.parameters.length; j++) {
            const ap = am.parameters[j];
            const bp = bm.parameters[j];
            if (!ap || !bp) return false;
            if (!ap.type || !bp.type) return false;
            if (!areIrTypesEquivalent(ap.type, bp.type, context)) return false;
          }
          if (!am.returnType || !bm.returnType) return false;
          if (!areIrTypesEquivalent(am.returnType, bm.returnType, context))
            return false;
          continue;
        }
        return false;
      }
      return true;
    }
  }
};

const maybeUpcastDictionaryUnionValueAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectedType || !expr.inferredType) return [ast, context];

  const expected = normalizeComparableType(expectedType, context);
  const actual = normalizeComparableType(expr.inferredType, context);
  if (expected.kind !== "dictionaryType" || actual.kind !== "dictionaryType") {
    return [ast, context];
  }

  if (!areIrTypesEquivalent(expected.keyType, actual.keyType, context)) {
    return [ast, context];
  }

  const expectedValue = normalizeComparableType(expected.valueType, context);
  if (expectedValue.kind !== "unionType") return [ast, context];

  const actualValue = normalizeComparableType(actual.valueType, context);
  if (areIrTypesEquivalent(expectedValue, actualValue, context)) {
    return [ast, context];
  }

  let matchingMemberIndex = -1;
  for (let i = 0; i < expectedValue.types.length; i++) {
    const member = expectedValue.types[i];
    if (!member) continue;
    if (areIrTypesEquivalent(member, actualValue, context)) {
      matchingMemberIndex = i + 1;
      break;
    }
  }
  if (matchingMemberIndex === -1) return [ast, context];

  const [unionValueTypeAst, ctx1] = emitTypeAst(expected.valueType, context);
  const kvpId = "kvp";
  const keySelector: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [{ name: kvpId }],
    body: {
      kind: "memberAccessExpression",
      expression: { kind: "identifierExpression", identifier: kvpId },
      memberName: "Key",
    },
  };
  const valueSelector: CSharpExpressionAst = {
    kind: "lambdaExpression",
    isAsync: false,
    parameters: [{ name: kvpId }],
    body: {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: {
          kind: "typeReferenceExpression",
          type: unionValueTypeAst,
        },
        memberName: `From${matchingMemberIndex}`,
      },
      arguments: [
        {
          kind: "memberAccessExpression",
          expression: { kind: "identifierExpression", identifier: kvpId },
          memberName: "Value",
        },
      ],
    },
  };

  const converted: CSharpExpressionAst = {
    kind: "invocationExpression",
    expression: {
      kind: "memberAccessExpression",
      expression: {
        ...identifierExpression("global::System.Linq.Enumerable"),
      },
      memberName: "ToDictionary",
    },
    arguments: [ast, keySelector, valueSelector],
  };

  return [converted, ctx1];
};

const isCharIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "char") ||
    (resolved.kind === "referenceType" && resolved.name === "char")
  );
};

const expectsStringIrType = (
  type: IrType | undefined,
  context: EmitterContext
): boolean => {
  if (!type) return false;
  const resolved = resolveTypeAlias(stripNullish(type), context);
  return (
    (resolved.kind === "primitiveType" && resolved.name === "string") ||
    (resolved.kind === "referenceType" &&
      (resolved.name === "string" || resolved.name === "String"))
  );
};

const isParameterlessToStringInvocation = (ast: CSharpExpressionAst): boolean =>
  ast.kind === "invocationExpression" &&
  ast.arguments.length === 0 &&
  ast.expression.kind === "memberAccessExpression" &&
  ast.expression.memberName === "ToString";

const maybeConvertCharToStringAst = (
  expr: IrExpression,
  ast: CSharpExpressionAst,
  context: EmitterContext,
  expectedType: IrType | undefined
): [CSharpExpressionAst, EmitterContext] => {
  if (!expectsStringIrType(expectedType, context)) return [ast, context];
  if (!isCharIrType(expr.inferredType, context)) return [ast, context];
  if (isParameterlessToStringInvocation(ast)) return [ast, context];

  return [
    {
      kind: "invocationExpression",
      expression: {
        kind: "memberAccessExpression",
        expression: ast,
        memberName: "ToString",
      },
      arguments: [],
    },
    context,
  ];
};

/**
 * Emit a numeric narrowing expression as CSharpExpressionAst.
 */
const emitNumericNarrowing = (
  expr: IrNumericNarrowingExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  if (expr.proof !== undefined) {
    if (expr.proof.source.type === "literal") {
      const [innerAst, newContext] = emitExpressionAst(
        expr.expression,
        context,
        expr.inferredType
      );
      return [innerAst, newContext];
    }

    const [innerAst, ctx1] = emitExpressionAst(expr.expression, context);
    const [typeAst, ctx2] = emitTypeAst(expr.inferredType, ctx1);
    return [
      {
        kind: "castExpression",
        type: typeAst,
        expression: innerAst,
      },
      ctx2,
    ];
  }

  throw new Error(
    `Internal error: numericNarrowing without proof reached emitter. ` +
      `Target: ${expr.targetKind}, Expression kind: ${expr.expression.kind}. ` +
      `This indicates a bug in the numeric proof pass - it should have ` +
      `emitted a diagnostic and aborted compilation.`
  );
};

/**
 * Emit a type assertion expression as CSharpExpressionAst.
 *
 * TypeScript `x as T` becomes C# `(T)x` (throwing cast).
 */
const emitTypeAssertion = (
  expr: IrTypeAssertionExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [innerAst, ctx1] = emitExpressionAst(
    expr.expression,
    context,
    expr.targetType
  );

  const resolveLocalTypeAliases = (target: IrType): IrType => {
    if (target.kind === "referenceType" && ctx1.localTypes) {
      const typeInfo = ctx1.localTypes.get(target.name);
      if (typeInfo?.kind === "typeAlias") {
        const substituted =
          target.typeArguments && target.typeArguments.length > 0
            ? substituteTypeArgs(
                typeInfo.type,
                typeInfo.typeParameters,
                target.typeArguments
              )
            : typeInfo.type;
        return resolveLocalTypeAliases(substituted);
      }
    }
    return target;
  };

  const shouldEraseTypeAssertion = (target: IrType): boolean => {
    const resolved = resolveLocalTypeAliases(target);

    if (resolved.kind === "unknownType") {
      return true;
    }

    if (resolved.kind === "referenceType" && resolved.typeArguments?.length) {
      const importBinding = ctx1.importBindings?.get(resolved.name);
      const clrName =
        importBinding?.kind === "type"
          ? (getIdentifierTypeName(importBinding.typeAst) ?? "")
          : "";
      if (clrName.endsWith(".ExtensionMethods")) {
        return true;
      }
    }

    if (resolved.kind === "intersectionType") {
      return resolved.types.some(
        (t) => t.kind === "referenceType" && t.name.startsWith("__Ext_")
      );
    }

    return false;
  };

  if (shouldEraseTypeAssertion(expr.targetType)) {
    return [innerAst, ctx1];
  }

  const resolveRuntimeCastTarget = (
    target: IrType,
    ctx: EmitterContext
  ): IrType => {
    if (target.kind === "referenceType" && ctx.localTypes) {
      const typeInfo = ctx.localTypes.get(target.name);
      if (typeInfo?.kind === "typeAlias") {
        if (typeInfo.type.kind !== "objectType") {
          const substituted =
            target.typeArguments && target.typeArguments.length > 0
              ? substituteTypeArgs(
                  typeInfo.type,
                  typeInfo.typeParameters,
                  target.typeArguments
                )
              : typeInfo.type;
          return resolveRuntimeCastTarget(substituted, ctx);
        }
        return target;
      }
    }

    if (target.kind === "referenceType" && target.typeArguments?.length) {
      const importBinding = ctx.importBindings?.get(target.name);
      const clrName =
        importBinding?.kind === "type"
          ? (getIdentifierTypeName(importBinding.typeAst) ?? "")
          : "";
      if (clrName.endsWith(".ExtensionMethods")) {
        const shape = target.typeArguments[0];
        if (shape) return resolveRuntimeCastTarget(shape, ctx);
      }
    }

    if (target.kind === "intersectionType") {
      for (const part of target.types) {
        const resolved = resolveRuntimeCastTarget(part, ctx);
        if (
          resolved.kind !== "intersectionType" &&
          resolved.kind !== "objectType"
        ) {
          return resolved;
        }
      }
      const fallback = target.types[0];
      return fallback ? resolveRuntimeCastTarget(fallback, ctx) : target;
    }

    return target;
  };

  const runtimeTarget = resolveRuntimeCastTarget(expr.targetType, ctx1);
  const [typeAst, ctx2] = emitTypeAst(runtimeTarget, ctx1);
  return [
    {
      kind: "castExpression",
      type: typeAst,
      expression: innerAst,
    },
    ctx2,
  ];
};

/**
 * Emit an asinterface expression as CSharpExpressionAst.
 */
const emitAsInterface = (
  expr: IrAsInterfaceExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const expected = expectedType ?? expr.targetType;
  return emitExpressionAst(expr.expression, context, expected);
};

/**
 * Emit a trycast expression as CSharpExpressionAst.
 *
 * TypeScript `trycast<T>(x)` becomes C# `x as T` (safe cast).
 */
const emitTryCast = (
  expr: IrTryCastExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [innerAst, ctx1] = emitExpressionAst(expr.expression, context);
  const [typeAst, ctx2] = emitTypeAst(expr.targetType, ctx1);
  return [
    {
      kind: "asExpression",
      expression: innerAst,
      type: typeAst,
    },
    ctx2,
  ];
};

/**
 * Emit a stackalloc expression as CSharpExpressionAst.
 */
const emitStackAlloc = (
  expr: IrStackAllocExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [elementTypeAst, ctx1] = emitTypeAst(expr.elementType, context);
  const [sizeAst, ctx2] = emitExpressionAst(expr.size, ctx1, {
    kind: "primitiveType",
    name: "int",
  });
  return [
    {
      kind: "stackAllocArrayCreationExpression",
      elementType: elementTypeAst,
      sizeExpression: sizeAst,
    },
    ctx2,
  ];
};

/**
 * Emit a defaultof expression as CSharpExpressionAst.
 */
const emitDefaultOf = (
  expr: IrDefaultOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [typeAst, ctx1] = emitTypeAst(expr.targetType, context);
  return [
    {
      kind: "defaultExpression",
      type: typeAst,
    },
    ctx1,
  ];
};

/**
 * Emit a nameof expression as a compile-time string literal using the authored TS name.
 */
const emitNameOf = (
  expr: IrNameOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => [stringLiteral(expr.name), context];

/**
 * Emit a sizeof expression as C# sizeof(T).
 */
const emitSizeOf = (
  expr: IrSizeOfExpression,
  context: EmitterContext
): [CSharpExpressionAst, EmitterContext] => {
  const [typeAst, ctx1] = emitTypeAst(expr.targetType, context);
  return [
    {
      kind: "sizeOfExpression",
      type: typeAst,
    },
    ctx1,
  ];
};

/**
 * Emit a C# expression AST from an IR expression.
 * Primary entry point for expression emission.
 *
 * @param expr The IR expression to emit
 * @param context The emitter context
 * @param expectedType Optional expected type for contextual typing
 */
export const emitExpressionAst = (
  expr: IrExpression,
  context: EmitterContext,
  expectedType?: IrType
): [CSharpExpressionAst, EmitterContext] => {
  const [ast, newContext] = (() => {
    switch (expr.kind) {
      case "literal":
        return emitLiteral(expr, context, expectedType);

      case "identifier":
        return emitIdentifier(expr, context, expectedType);

      case "array":
        return emitArray(expr, context, expectedType);

      case "object":
        return emitObject(expr, context, expectedType);

      case "memberAccess":
        return emitMemberAccess(expr, context, "value", expectedType);

      case "call":
        return emitCall(expr, context);

      case "new":
        return emitNew(expr, context);

      case "binary":
        return emitBinary(expr, context, expectedType);

      case "logical":
        return emitLogical(expr, context);

      case "unary":
        return emitUnary(expr, context, expectedType);

      case "update":
        return emitUpdate(expr, context);

      case "assignment":
        return emitAssignment(expr, context);

      case "conditional":
        return emitConditional(expr, context, expectedType);

      case "functionExpression":
        return emitFunctionExpression(expr, context);

      case "arrowFunction":
        return emitArrowFunction(expr, context);

      case "templateLiteral":
        return emitTemplateLiteral(expr, context);

      case "spread":
        return emitSpread(expr, context);

      case "await":
        return emitAwait(expr, context);

      case "this":
        return [
          {
            kind: "identifierExpression" as const,
            identifier: context.objectLiteralThisIdentifier ?? "this",
          },
          context,
        ];

      case "numericNarrowing":
        return emitNumericNarrowing(expr, context);

      case "asinterface":
        return emitAsInterface(expr, context, expectedType);

      case "typeAssertion":
        return emitTypeAssertion(expr, context);

      case "trycast":
        return emitTryCast(expr, context);

      case "stackalloc":
        return emitStackAlloc(expr, context);

      case "defaultof":
        return emitDefaultOf(expr, context);

      case "nameof":
        return emitNameOf(expr, context);

      case "sizeof":
        return emitSizeOf(expr, context);

      default:
        throw new Error(
          `Unhandled IR expression kind: ${String((expr as { kind?: unknown }).kind)}`
        );
    }
  })();

  const [castedAst, castedContext] = maybeCastNullishTypeParamAst(
    expr,
    ast,
    newContext,
    expectedType
  );
  const [dictUpcastAst, dictUpcastContext] = maybeUpcastDictionaryUnionValueAst(
    expr,
    castedAst,
    castedContext,
    expectedType
  );
  const [materializedAst, materializedContext] =
    tryAdaptStructuralExpressionAst(
      dictUpcastAst,
      expr.inferredType,
      dictUpcastContext,
      expectedType
    ) ?? [dictUpcastAst, dictUpcastContext];
  const [stringAdjustedAst, stringAdjustedContext] =
    maybeConvertCharToStringAst(
      expr,
      materializedAst,
      materializedContext,
      expectedType
    );
  return maybeUnwrapNullableValueTypeAst(
    expr,
    stringAdjustedAst,
    stringAdjustedContext,
    expectedType
  );
};

// Re-export commonly used functions from barrel
export { generateSpecializedName } from "./expressions/identifiers.js";
