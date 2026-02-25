import {
  IrStatement,
  NUMERIC_KIND_TO_CSHARP,
  type IrObjectPattern,
  type IrPattern,
  type IrExpression,
  type IrType,
} from "@tsonic/frontend";
import { EmitterContext } from "../../../types.js";
import { emitExpression } from "../../../expression-emitter.js";
import { emitType } from "../../../type-emitter.js";
import { emitCSharpName } from "../../../naming-policy.js";
import { getPropertyType } from "../../semantic/type-resolution.js";
import { escapeCSharpIdentifier } from "../../../emitter-types/index.js";
import { typeAstFromText } from "../backend-ast/type-factories.js";
import type {
  CSharpClassMemberAst,
  CSharpParameterAst,
  CSharpExpressionAst,
  CSharpStatementAst,
} from "../backend-ast/types.js";

const resolveFieldType = (
  decl: Extract<
    IrStatement,
    { kind: "variableDeclaration" }
  >["declarations"][number]
): IrType | undefined => {
  if (decl.type) return decl.type;
  if (!decl.initializer) return undefined;
  if (decl.initializer.inferredType) return decl.initializer.inferredType;
  if (decl.initializer.kind === "numericNarrowing") {
    return {
      kind: "referenceType",
      name: NUMERIC_KIND_TO_CSHARP.get(decl.initializer.targetKind) ?? "double",
      typeArguments: [],
    };
  }
  if (decl.initializer.kind === "typeAssertion") {
    return decl.initializer.targetType;
  }
  if (decl.initializer.kind === "asinterface") {
    return decl.initializer.targetType;
  }
  if (decl.initializer.kind === "literal") {
    if (
      decl.initializer.value === null ||
      decl.initializer.value === undefined
    ) {
      return { kind: "referenceType", name: "object", typeArguments: [] };
    }
    if (typeof decl.initializer.value === "number") {
      return Number.isInteger(decl.initializer.value)
        ? { kind: "primitiveType", name: "int" }
        : { kind: "primitiveType", name: "number" };
    }
    if (typeof decl.initializer.value === "boolean") {
      return { kind: "primitiveType", name: "boolean" };
    }
    if (typeof decl.initializer.value === "string") {
      return { kind: "primitiveType", name: "string" };
    }
  }
  return undefined;
};

const toRawExpression = (text: string): CSharpExpressionAst => ({
  kind: "rawExpression",
  text,
});

type StaticFieldInitializer = {
  readonly fieldName: string;
  readonly expressionText: string;
  readonly type: IrType | undefined;
};

type PatternLoweringResult = {
  readonly assignments: readonly StaticFieldInitializer[];
  readonly context: EmitterContext;
};

const resolveTupleRestType = (
  tuple: Extract<IrType, { kind: "tupleType" }>,
  startIndex: number
): IrType | undefined => {
  const remaining = tuple.elementTypes.slice(startIndex);
  if (remaining.length === 0)
    return { kind: "arrayType", elementType: { kind: "neverType" } };
  if (remaining.length === 1) {
    const only = remaining[0];
    if (!only) return { kind: "arrayType", elementType: { kind: "neverType" } };
    return { kind: "arrayType", elementType: only };
  }
  return {
    kind: "arrayType",
    elementType: { kind: "unionType", types: remaining },
  };
};

const resolveArrayElementType = (
  type: IrType | undefined,
  index: number,
  isRest: boolean
): IrType | undefined => {
  if (!type) return undefined;
  if (type.kind === "arrayType") {
    return isRest
      ? { kind: "arrayType", elementType: type.elementType }
      : type.elementType;
  }
  if (type.kind === "tupleType") {
    if (isRest) return resolveTupleRestType(type, index);
    return type.elementTypes[index];
  }
  return undefined;
};

const resolveObjectRestType = (
  pattern: Extract<IrObjectPattern["properties"][number], { kind: "rest" }>
): IrType | undefined => {
  if (!pattern.restSynthTypeName) return undefined;
  return {
    kind: "referenceType",
    name: pattern.restSynthTypeName,
    typeArguments: [],
  };
};

const emitDefaultedExpression = (
  baseExpressionText: string,
  defaultExpr: IrExpression | undefined,
  context: EmitterContext,
  expectedType: IrType | undefined
): [string, EmitterContext] => {
  if (!defaultExpr) return [baseExpressionText, context];
  const [fallback, next] = emitExpression(defaultExpr, context, expectedType);
  return [`${baseExpressionText} ?? ${fallback.text}`, next];
};

const lowerPatternAssignments = (
  pattern: IrPattern,
  sourceExpressionText: string,
  sourceType: IrType | undefined,
  fieldNames: ReadonlyMap<string, string>,
  context: EmitterContext
): PatternLoweringResult => {
  if (pattern.kind === "identifierPattern") {
    const emittedField = fieldNames.get(pattern.name);
    if (!emittedField) {
      throw new Error(
        `ICE: Missing emitted static-field name for destructuring binding '${pattern.name}'.`
      );
    }
    return {
      assignments: [
        {
          fieldName: emittedField,
          expressionText: sourceExpressionText,
          type: pattern.type ?? sourceType,
        },
      ],
      context,
    };
  }

  if (pattern.kind === "arrayPattern") {
    let currentContext = context;
    const assignments: StaticFieldInitializer[] = [];
    let elementIndex = 0;

    for (const element of pattern.elements) {
      if (!element) {
        elementIndex++;
        continue;
      }

      if (element.isRest) {
        const elementType = resolveArrayElementType(
          sourceType,
          elementIndex,
          true
        );
        const restExpr = `global::Tsonic.Runtime.ArrayHelpers.Slice(${sourceExpressionText}, ${elementIndex})`;
        const [valueExpr, next] = emitDefaultedExpression(
          restExpr,
          element.defaultExpr,
          currentContext,
          elementType
        );
        currentContext = next;
        const lowered = lowerPatternAssignments(
          element.pattern,
          valueExpr,
          elementType,
          fieldNames,
          currentContext
        );
        assignments.push(...lowered.assignments);
        currentContext = lowered.context;
        break;
      }

      const elementType = resolveArrayElementType(
        sourceType,
        elementIndex,
        false
      );
      const baseExpr = `${sourceExpressionText}[${elementIndex}]`;
      const [valueExpr, next] = emitDefaultedExpression(
        baseExpr,
        element.defaultExpr,
        currentContext,
        elementType
      );
      currentContext = next;
      const lowered = lowerPatternAssignments(
        element.pattern,
        valueExpr,
        elementType,
        fieldNames,
        currentContext
      );
      assignments.push(...lowered.assignments);
      currentContext = lowered.context;
      elementIndex++;
    }

    return { assignments, context: currentContext };
  }

  let currentContext = context;
  const assignments: StaticFieldInitializer[] = [];
  for (const property of pattern.properties) {
    if (property.kind === "rest") {
      if (!property.restSynthTypeName || !property.restShapeMembers) {
        throw new Error(
          "Object rest destructuring requires synthesized rest-shape metadata from frontend."
        );
      }
      const initMembers = property.restShapeMembers
        .filter((member) => member.kind === "propertySignature")
        .map((member) => {
          const escapedMember = escapeCSharpIdentifier(member.name);
          return `${escapedMember} = ${sourceExpressionText}.${escapedMember}`;
        });
      const restExpr = `new ${property.restSynthTypeName} { ${initMembers.join(", ")} }`;
      const lowered = lowerPatternAssignments(
        property.pattern,
        restExpr,
        resolveObjectRestType(property),
        fieldNames,
        currentContext
      );
      assignments.push(...lowered.assignments);
      currentContext = lowered.context;
      continue;
    }

    const propType = getPropertyType(sourceType, property.key, currentContext);
    const escapedProperty = escapeCSharpIdentifier(property.key);
    const baseExpr = `${sourceExpressionText}.${escapedProperty}`;
    const [valueExpr, next] = emitDefaultedExpression(
      baseExpr,
      property.defaultExpr,
      currentContext,
      propType
    );
    currentContext = next;
    const lowered = lowerPatternAssignments(
      property.value,
      valueExpr,
      propType,
      fieldNames,
      currentContext
    );
    assignments.push(...lowered.assignments);
    currentContext = lowered.context;
  }
  return { assignments, context: currentContext };
};

const collectPatternBindings = (pattern: IrPattern): readonly string[] => {
  if (pattern.kind === "identifierPattern") return [pattern.name];
  if (pattern.kind === "arrayPattern") {
    const names: string[] = [];
    for (const element of pattern.elements) {
      if (!element) continue;
      names.push(...collectPatternBindings(element.pattern));
    }
    return names;
  }
  const names: string[] = [];
  for (const property of pattern.properties) {
    if (property.kind === "rest") {
      names.push(...collectPatternBindings(property.pattern));
      continue;
    }
    names.push(...collectPatternBindings(property.value));
  }
  return names;
};

export type StaticVariableDeclarationAstResult = {
  readonly members: readonly CSharpClassMemberAst[];
  readonly initializerStatements: readonly CSharpStatementAst[];
};

const emitDelegateParameters = (
  parameters: Extract<IrExpression, { kind: "arrowFunction" }>["parameters"],
  context: EmitterContext
): [readonly CSharpParameterAst[], EmitterContext] => {
  let currentContext = context;
  const result: CSharpParameterAst[] = [];

  for (let i = 0; i < parameters.length; i++) {
    const parameter = parameters[i];
    if (!parameter?.type) {
      throw new Error(
        "ICE: Arrow function parameter without type reached emitter."
      );
    }
    const [parameterType, next] = emitType(parameter.type, currentContext);
    currentContext = next;

    const parameterName =
      parameter.pattern.kind === "identifierPattern"
        ? escapeCSharpIdentifier(parameter.pattern.name)
        : `p${i}`;

    const parameterTypeAst = parameter.isOptional
      ? typeAstFromText(
          parameterType.trimEnd().endsWith("?")
            ? parameterType
            : `${parameterType}?`
        )
      : typeAstFromText(parameterType);

    result.push({
      kind: "parameter",
      attributes: [],
      modifiers: parameter.passing !== "value" ? [parameter.passing] : [],
      type: parameterTypeAst,
      name: parameterName,
      defaultValue: parameter.isOptional
        ? { kind: "literalExpression", text: "default" }
        : undefined,
    });
  }

  return [result, currentContext];
};

export const emitStaticVariableDeclarationAst = (
  stmt: Extract<IrStatement, { kind: "variableDeclaration" }>,
  context: EmitterContext
): [StaticVariableDeclarationAstResult, EmitterContext] => {
  let currentContext = context;
  const members: CSharpClassMemberAst[] = [];
  const initializerStatements: CSharpStatementAst[] = [];

  for (const decl of stmt.declarations) {
    if (decl.name.kind === "identifierPattern") {
      const fieldName = emitCSharpName(decl.name.name, "fields", context);
      let typeText = "object";
      const arrowInitializer =
        decl.initializer?.kind === "arrowFunction"
          ? decl.initializer
          : undefined;

      if (arrowInitializer) {
        const needsOptionalDelegate = arrowInitializer.parameters.some(
          (parameter) => parameter.isOptional || !!parameter.initializer
        );

        if (needsOptionalDelegate) {
          const hasInitializer = arrowInitializer.parameters.some(
            (parameter) => !!parameter.initializer
          );
          if (hasInitializer) {
            throw new Error(
              "ICE: Arrow function values with default parameter initializers are not supported. Use a named function declaration instead."
            );
          }

          const arrowReturnType =
            arrowInitializer.returnType ??
            (arrowInitializer.inferredType?.kind === "functionType"
              ? arrowInitializer.inferredType.returnType
              : undefined);
          if (!arrowReturnType) {
            throw new Error(
              "ICE: Arrow function without return type reached emitter - neither explicit nor inferred type available"
            );
          }

          const [delegateReturnType, returnContext] = emitType(
            arrowReturnType,
            currentContext
          );
          currentContext = returnContext;

          const [delegateParameters, delegateContext] = emitDelegateParameters(
            arrowInitializer.parameters,
            currentContext
          );
          currentContext = delegateContext;

          const delegateName = `${fieldName}__Delegate`;
          members.push({
            kind: "delegateDeclaration",
            attributes: [],
            modifiers: [stmt.isExported ? "public" : "internal"],
            returnType: typeAstFromText(delegateReturnType),
            name: delegateName,
            parameters: delegateParameters,
          });

          typeText = delegateName;
        }
      }

      if (typeText === "object") {
        const targetType = resolveFieldType(decl);
        if (targetType) {
          const [emittedType, next] = emitType(targetType, currentContext);
          currentContext = next;
          typeText = emittedType;
        }
      }
      if (decl.initializer) {
        const [initExpr, next] = emitExpression(
          decl.initializer,
          currentContext,
          decl.type
        );
        currentContext = next;
        initializerStatements.push({
          kind: "expressionStatement",
          expression: {
            kind: "assignmentExpression",
            operatorToken: "=",
            left: toRawExpression(fieldName),
            right: toRawExpression(initExpr.text),
          },
        });
      }

      members.push({
        kind: "fieldDeclaration",
        attributes: [],
        modifiers: [
          stmt.isExported ? "public" : "internal",
          "static",
          ...(stmt.declarationKind === "const" ? ["readonly"] : []),
        ],
        type: typeAstFromText(typeText),
        name: fieldName,
      });
      continue;
    }

    if (!decl.initializer) {
      throw new Error(
        "ICE: Destructuring static declarations require an initializer."
      );
    }

    const bindingNames = collectPatternBindings(decl.name);
    const fieldNames = new Map<string, string>();
    for (const bindingName of bindingNames) {
      if (fieldNames.has(bindingName)) continue;
      fieldNames.set(
        bindingName,
        emitCSharpName(bindingName, "fields", context)
      );
    }

    const [initExpr, initCtx] = emitExpression(
      decl.initializer,
      currentContext,
      decl.type
    );
    currentContext = initCtx;

    const tempName = `__tsonic_static_pattern_${initializerStatements.length}`;
    initializerStatements.push({
      kind: "localDeclarationStatement",
      modifiers: [],
      type: { kind: "identifierType", name: "var" },
      declarators: [
        {
          kind: "variableDeclarator",
          name: tempName,
          initializer: toRawExpression(initExpr.text),
        },
      ],
    });

    const lowered = lowerPatternAssignments(
      decl.name,
      tempName,
      decl.type ?? decl.initializer.inferredType,
      fieldNames,
      currentContext
    );
    currentContext = lowered.context;

    for (const [sourceName, fieldName] of fieldNames.entries()) {
      const match = lowered.assignments.find(
        (entry) => entry.fieldName === fieldName
      );
      const bindingType = match?.type;
      let typeText = "object";
      if (bindingType) {
        const [emittedType, next] = emitType(bindingType, currentContext);
        currentContext = next;
        typeText = emittedType;
      }
      members.push({
        kind: "fieldDeclaration",
        attributes: [],
        modifiers: [
          stmt.isExported ? "public" : "internal",
          "static",
          ...(stmt.declarationKind === "const" ? ["readonly"] : []),
        ],
        type: typeAstFromText(typeText),
        name: fieldName,
      });

      if (!match) {
        throw new Error(
          `ICE: Failed to lower destructuring binding '${sourceName}' into a static initializer.`
        );
      }
    }

    for (const assignment of lowered.assignments) {
      initializerStatements.push({
        kind: "expressionStatement",
        expression: {
          kind: "assignmentExpression",
          operatorToken: "=",
          left: toRawExpression(assignment.fieldName),
          right: toRawExpression(assignment.expressionText),
        },
      });
    }
  }

  return [{ members, initializerStatements }, currentContext];
};
