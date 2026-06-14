/**
 * Static Safety Validation Rules
 *
 * Contains the main validation visitor and rule implementations for:
 * - TSN7401: 'any' type usage
 * - TSN7402: reserved historical code; JsValue is now the dynamic JSON carrier
 * - TSN7403: Object literal without contextual nominal type
 * - TSN7405: Untyped function/arrow/lambda parameter
 * - TSN5001: deterministic native-safe JSON and broad Array.isArray limitations
 * - TSN7413: Dictionary key must be string, number, or symbol
 * - TSN7419: 'never' cannot be used as a generic type argument
 * - TSN7430: Arrow function requires explicit types (escape hatch)
 * - TSN7432: Generic function value restrictions
 */

import type { TstsNode, TstsSourceFile } from "@tsonic/tsts";
import { forEachTstsChild, TstsSyntax } from "@tsonic/tsts";
import { TsonicProgram } from "../program.js";
import {
  DiagnosticsCollector,
  addDiagnostic,
  createDiagnostic,
  type Diagnostic,
} from "../types/diagnostic.js";
import {
  capability,
  isCapabilityUnavailable,
  type FeatureKey,
} from "../capabilities/backend-capabilities.js";
import { getNodeLocation } from "./helpers.js";
import {
  collectWrittenSymbols,
  collectSupportedGenericFunctionValueSymbols,
  getSupportedGenericFunctionDeclarationSymbol,
  getSupportedGenericFunctionValueSymbol,
  isGenericFunctionDeclarationNode,
  isGenericFunctionValueNode,
} from "./generic-function-values.js";
import type { TstsFrontendSourceSemanticView } from "../source-frontend/index.js";
import {
  checkBasicSynthesisEligibility,
  lambdaHasExpectedTypeContext,
  objectLiteralHasContextualType,
  objectLiteralHasBroadContextualType,
  isAllowedGenericFunctionValueIdentifierUse,
  getReferencedIdentifierSymbol,
} from "./contextual-type-analysis.js";
import { isAllowedKeyType } from "./static-safety-dictionary-keys.js";
import { validateArrowEscapeHatch } from "./static-safety-arrow-rules.js";
import {
  getCallArguments,
  getNodeElements,
  getNodeExpression,
  getNodeInitializer,
  getNodeParameters,
  getNodeType,
  getTypeArguments,
  identifierText,
  isIdentifier,
  isIdentifierNamed,
  nodeParent,
  staticPropertyNameText,
  type SourceSymbol,
  type SourceType,
  unwrapExpression,
} from "./tsts-helpers.js";

const createBackendCapabilityDiagnostic = (
  program: TsonicProgram,
  capabilityName: FeatureKey,
  baseDiagnostic: Diagnostic
): Diagnostic | undefined => {
  if (
    !isCapabilityUnavailable(
      program.options.backendCapabilities,
      capabilityName
    )
  ) {
    return undefined;
  }
  const backendCapability = capability(
    program.options.backendCapabilities,
    capabilityName
  );
  return {
    ...baseDiagnostic,
    code: backendCapability?.diagnosticCode ?? baseDiagnostic.code,
    message: backendCapability?.diagnosticMessage ?? baseDiagnostic.message,
    hint: backendCapability?.remediation ?? baseDiagnostic.hint,
  };
};

const nodeIsWithin = (
  node: TstsNode,
  container: TstsNode | undefined
): boolean =>
  !!container && node.Loc.pos >= container.Loc.pos && node.Loc.end <= container.Loc.end;

const hasFunctionBody = (node: TstsNode): boolean =>
  TstsSyntax.Node_Body(node) !== undefined;

const propertyNameText = (node: TstsNode | undefined): string | undefined =>
  staticPropertyNameText(node);

const isOverloadSurfaceDeclaration = (node: TstsNode): boolean =>
  (node.Kind === TstsSyntax.KindFunctionDeclaration ||
    node.Kind === TstsSyntax.KindMethodDeclaration) &&
  !hasFunctionBody(node);

const isOverloadStubImplementation = (node: TstsNode): boolean => {
  if (!hasFunctionBody(node)) {
    return false;
  }

  if (node.Kind === TstsSyntax.KindFunctionDeclaration) {
    const name = identifierText(TstsSyntax.Node_Name(node));
    if (!name || node.Parent?.Kind !== TstsSyntax.KindSourceFile) {
      return false;
    }

    return (
      TstsSyntax.Node_Statements(node.Parent)?.some(
        (statement) =>
          statement?.Kind === TstsSyntax.KindFunctionDeclaration &&
          statement !== node &&
          identifierText(TstsSyntax.Node_Name(statement)) === name &&
          isOverloadSurfaceDeclaration(statement)
      ) ?? false
    );
  }

  if (
    node.Kind !== TstsSyntax.KindMethodDeclaration ||
    !node.Parent ||
    (node.Parent.Kind !== TstsSyntax.KindClassDeclaration &&
      node.Parent.Kind !== TstsSyntax.KindClassExpression)
  ) {
    return false;
  }

  const memberName = propertyNameText(TstsSyntax.Node_Name(node));
  if (!memberName) {
    return false;
  }

  return (
    TstsSyntax.Node_Members(node.Parent)?.some(
      (member) =>
        member?.Kind === TstsSyntax.KindMethodDeclaration &&
        member !== node &&
        propertyNameText(TstsSyntax.Node_Name(member)) === memberName &&
        isOverloadSurfaceDeclaration(member)
    ) ?? false
  );
};

const isInsideOverloadStubSignatureType = (node: TstsNode): boolean => {
  for (
    let current: TstsNode | undefined = node.Parent;
    current;
    current = current.Parent
  ) {
    if (
      current.Kind !== TstsSyntax.KindFunctionDeclaration &&
      current.Kind !== TstsSyntax.KindMethodDeclaration
    ) {
      continue;
    }

    if (!isOverloadStubImplementation(current)) {
      return false;
    }

    if (nodeIsWithin(node, getNodeType(current))) {
      return true;
    }

    return getNodeParameters(current).some((parameter) =>
      nodeIsWithin(node, getNodeType(parameter))
    );
  }

  return false;
};

const getAssertionTargetTypeNode = (
  node: TstsNode
): TstsNode | undefined => {
  if (
    node.Kind === TstsSyntax.KindAsExpression ||
    node.Kind === TstsSyntax.KindTypeAssertionExpression
  ) {
    return getNodeType(node);
  }
  return undefined;
};

const isPropertyCall = (
  node: TstsNode,
  objectName: string,
  memberName: string
): boolean => {
  if (node.Kind !== TstsSyntax.KindCallExpression) {
    return false;
  }

  const expression = TstsSyntax.AsCallExpression(node)?.Expression;
  if (expression?.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return false;
  }

  const access = TstsSyntax.AsPropertyAccessExpression(expression);
  return (
    isIdentifierNamed(access?.Expression, objectName) &&
    isIdentifierNamed(access?.name, memberName)
  );
};

const isJsonParseCall = (node: TstsNode): boolean =>
  isPropertyCall(node, "JSON", "parse");

const isJsonStringifyCall = (node: TstsNode): boolean =>
  isPropertyCall(node, "JSON", "stringify");

const isArrayIsArrayCall = (node: TstsNode): boolean =>
  isPropertyCall(node, "Array", "isArray");

const unwrapContextualJsonParseParent = (node: TstsNode): TstsNode | undefined => {
  let current = node;
  while (
    current.Parent?.Kind === TstsSyntax.KindParenthesizedExpression ||
    current.Parent?.Kind === TstsSyntax.KindNonNullExpression
  ) {
    current = current.Parent;
  }
  return current.Parent;
};

const getJsonParseContextualTargetTypeNode = (
  node: TstsNode
): TstsNode | undefined => {
  const parent = unwrapContextualJsonParseParent(node);

  if (
    parent?.Kind === TstsSyntax.KindVariableDeclaration &&
    getNodeInitializer(parent) === node
  ) {
    return getNodeType(parent);
  }

  if (
    (parent?.Kind === TstsSyntax.KindAsExpression ||
      parent?.Kind === TstsSyntax.KindTypeAssertionExpression) &&
    getNodeExpression(parent) === node
  ) {
    return getNodeType(parent);
  }

  return undefined;
};

const isBroadJsonTargetTypeNode = (node: TstsNode): boolean => {
  if (
    node.Kind === TstsSyntax.KindUnknownKeyword ||
    node.Kind === TstsSyntax.KindAnyKeyword ||
    node.Kind === TstsSyntax.KindObjectKeyword
  ) {
    return true;
  }

  if (
    node.Kind === TstsSyntax.KindUnionType ||
    node.Kind === TstsSyntax.KindIntersectionType
  ) {
    return true;
  }

  if (node.Kind === TstsSyntax.KindArrayType) {
    const elementType = TstsSyntax.AsArrayTypeNode(node)?.ElementType;
    return elementType ? isBroadJsonTargetTypeNode(elementType) : false;
  }

  if (node.Kind === TstsSyntax.KindTupleType) {
    return getNodeElements(node).some((element) =>
      isBroadJsonTargetTypeNode(element)
    );
  }

  if (node.Kind === TstsSyntax.KindParenthesizedType) {
    const inner = getNodeType(node);
    return inner ? isBroadJsonTargetTypeNode(inner) : false;
  }

  if (node.Kind === TstsSyntax.KindTypeReference) {
    const typeName = TstsSyntax.AsTypeReferenceNode(node)?.TypeName;
    if (identifierText(typeName) === "JsValue") {
      return false;
    }

    return getTypeArguments(node).some((typeArg) =>
      isBroadJsonTargetTypeNode(typeArg)
    );
  }

  return false;
};

const getJsonParseTargetTypeNode = (
  node: TstsNode
): TstsNode | undefined =>
  getTypeArguments(node)[0] ?? getJsonParseContextualTargetTypeNode(node);

const isBroadJsonSourceType = (
  type: SourceType,
  sourceSemantics: TstsFrontendSourceSemanticView,
  seen: ReadonlySet<SourceType> = new Set<SourceType>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(type);

  if (sourceSemantics.isAnyUnknownVoidNeverOrTypeParameter(type)) {
    return true;
  }

  if (sourceSemantics.isSourceScalarLikeType(type)) {
    return false;
  }

  if (sourceSemantics.getUnionOrIntersectionMembers(type)) {
    return true;
  }

  if (sourceSemantics.getCallSignatures(type).length > 0) {
    return true;
  }

  if (sourceSemantics.isArrayType(type) || sourceSemantics.isTupleType(type)) {
    const typeArguments = sourceSemantics.getTypeArguments(type);
    return typeArguments.some((typeArgument) =>
      isBroadJsonSourceType(typeArgument, sourceSemantics, nextSeen)
    );
  }

  if (sourceSemantics.typeToString(type) === "object") {
    return true;
  }

  if (
    sourceSemantics.getStringIndexType(type) ||
    sourceSemantics.getNumberIndexType(type)
  ) {
    return true;
  }

  return sourceSemantics.getProperties(type).some((property) => {
    const declaration =
      sourceSemantics.getSymbolValueDeclaration(property) ??
      sourceSemantics.getSymbolDeclarations(property)[0];
    if (!declaration) {
      return true;
    }
    const propertyType = sourceSemantics.getTypeOfSymbolAtLocation(
      property,
      declaration
    );
    return isBroadJsonSourceType(propertyType, sourceSemantics, nextSeen);
  });
};

const isDynamicJsonCarrierType = (
  type: SourceType,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  const displayName = sourceSemantics.typeToString(type);
  const aliasName = sourceSemantics.getTypeAliasSymbolName(type);
  const symbolName = sourceSemantics.getTypeSymbolName(type);
  return (
    displayName === "JsValue" ||
    displayName === "JsPrimitive" ||
    aliasName === "JsValue" ||
    aliasName === "JsPrimitive" ||
    symbolName === "JsValue" ||
    symbolName === "JsPrimitive"
  );
};

const typeHasDynamicJsonCarrierStringIndex = (
  type: SourceType,
  sourceSemantics: TstsFrontendSourceSemanticView
): boolean => {
  const stringIndexType = sourceSemantics.getStringIndexType(type);
  if (
    stringIndexType &&
    isDynamicJsonCarrierType(stringIndexType, sourceSemantics)
  ) {
    return true;
  }

  if (sourceSemantics.getTypeAliasSymbolName(type) !== "Record") {
    return false;
  }

  const [keyType, valueType] = sourceSemantics.getAliasTypeArguments(type);
  return (
    !!keyType &&
    !!valueType &&
    sourceSemantics.isStringLikeType(keyType) &&
    isDynamicJsonCarrierType(valueType, sourceSemantics)
  );
};

const isBroadArrayIsArraySourceType = (
  type: SourceType,
  sourceSemantics: TstsFrontendSourceSemanticView,
  seen: ReadonlySet<SourceType> = new Set<SourceType>()
): boolean => {
  if (seen.has(type)) {
    return false;
  }

  const nextSeen = new Set(seen);
  nextSeen.add(type);

  if (isDynamicJsonCarrierType(type, sourceSemantics)) {
    return false;
  }

  const displayName = sourceSemantics.typeToString(type);
  if (sourceSemantics.isAnyUnknownOrTypeParameter(type)) {
    return true;
  }

  if (displayName === "object") {
    return true;
  }

  const members = sourceSemantics.getUnionOrIntersectionMembers(type);
  if (members) {
    return members.some((member) =>
      isBroadArrayIsArraySourceType(member, sourceSemantics, nextSeen)
    );
  }

  return false;
};

const isDirectBooleanReturnExpression = (node: TstsNode): boolean => {
  let current = node;
  for (
    let parent: TstsNode | undefined = current.Parent;
    parent;
    current = parent, parent = parent.Parent
  ) {
    if (parent.Kind === TstsSyntax.KindParenthesizedExpression) {
      continue;
    }

    return (
      parent.Kind === TstsSyntax.KindReturnStatement &&
      getNodeExpression(parent) === current
    );
  }

  return false;
};

const resolveSymbolDeclaration = (
  expr: TstsNode,
  program: TsonicProgram
): { readonly symbol: SourceSymbol; readonly declaration: TstsNode } | undefined => {
  const symbol = program.sourceSemantics.getSymbol(expr);
  const declaration = symbol
    ? (program.sourceSemantics.getSymbolValueDeclaration(symbol) ??
      program.sourceSemantics.getSymbolDeclarations(symbol)[0])
    : undefined;
  return symbol && declaration ? { symbol, declaration } : undefined;
};

const isJsonParseInitializedSymbol = (
  expr: TstsNode,
  program: TsonicProgram
): boolean => {
  const unwrapped = unwrapExpression(expr);
  if (!unwrapped || !isIdentifier(unwrapped)) {
    return false;
  }

  const resolved = resolveSymbolDeclaration(unwrapped, program);
  if (
    !resolved ||
    resolved.declaration.Kind !== TstsSyntax.KindVariableDeclaration
  ) {
    return false;
  }

  const initializer = unwrapExpression(getNodeInitializer(resolved.declaration));
  return !!initializer && isJsonParseCall(initializer);
};

const isDeclaredDynamicJsonCarrierSymbol = (
  expr: TstsNode,
  program: TsonicProgram
): boolean => {
  const unwrapped = unwrapExpression(expr);
  if (!unwrapped || !isIdentifier(unwrapped)) {
    return false;
  }

  const resolved = resolveSymbolDeclaration(unwrapped, program);
  if (!resolved) {
    return false;
  }

  return isDynamicJsonCarrierType(
    program.sourceSemantics.getTypeOfSymbolAtLocation(
      resolved.symbol,
      resolved.declaration
    ),
    program.sourceSemantics
  );
};

const getObjectEntriesSource = (
  expr: TstsNode,
  program: TsonicProgram
): TstsNode | undefined => {
  const unwrapped = unwrapExpression(expr);

  if (unwrapped?.Kind === TstsSyntax.KindCallExpression) {
    const callee = TstsSyntax.AsCallExpression(unwrapped)?.Expression;
    if (callee?.Kind !== TstsSyntax.KindPropertyAccessExpression) {
      return undefined;
    }
    const access = TstsSyntax.AsPropertyAccessExpression(callee);
    return isIdentifierNamed(access?.Expression, "Object") &&
      isIdentifierNamed(access?.name, "entries")
      ? getCallArguments(unwrapped)[0]
      : undefined;
  }

  if (unwrapped?.Kind !== TstsSyntax.KindElementAccessExpression) {
    return undefined;
  }

  const collection = unwrapExpression(
    TstsSyntax.AsElementAccessExpression(unwrapped)?.Expression
  );
  if (collection?.Kind === TstsSyntax.KindCallExpression) {
    return getObjectEntriesSource(collection, program);
  }

  if (!collection || !isIdentifier(collection)) {
    return undefined;
  }

  const resolved = resolveSymbolDeclaration(collection, program);
  if (
    !resolved ||
    resolved.declaration.Kind !== TstsSyntax.KindVariableDeclaration
  ) {
    return undefined;
  }

  const initializer = unwrapExpression(getNodeInitializer(resolved.declaration));
  return initializer ? getObjectEntriesSource(initializer, program) : undefined;
};

const isObjectEntriesValueFromDynamicJsonCarrier = (
  expr: TstsNode,
  program: TsonicProgram
): boolean => {
  const unwrapped = unwrapExpression(expr);
  if (!unwrapped || !isIdentifier(unwrapped)) {
    return false;
  }

  const resolved = resolveSymbolDeclaration(unwrapped, program);
  const declaration = resolved?.declaration;
  if (
    !declaration ||
    declaration.Kind !== TstsSyntax.KindBindingElement ||
    declaration.Parent?.Kind !== TstsSyntax.KindArrayBindingPattern
  ) {
    return false;
  }

  const arrayElements = TstsSyntax.Node_Elements(declaration.Parent) ?? [];
  if (arrayElements.indexOf(declaration) !== 1) {
    return false;
  }

  const variableDeclaration = declaration.Parent.Parent;
  if (
    variableDeclaration?.Kind !== TstsSyntax.KindVariableDeclaration ||
    !getNodeInitializer(variableDeclaration)
  ) {
    return false;
  }

  const entriesSource = getObjectEntriesSource(
    getNodeInitializer(variableDeclaration)!,
    program
  );
  return entriesSource
    ? isDeclaredDynamicJsonCarrierSymbol(entriesSource, program) ||
        typeHasDynamicJsonCarrierStringIndex(
          program.sourceSemantics.getExpressionType(entriesSource),
          program.sourceSemantics
        )
    : false;
};

export const validateStaticSafety = (
  sourceFile: TstsSourceFile,
  program: TsonicProgram,
  collector: DiagnosticsCollector
): DiagnosticsCollector => {
  const writtenSymbols = collectWrittenSymbols(
    sourceFile,
    program.sourceSemantics
  );
  const supportedGenericFunctionValueSymbols =
    collectSupportedGenericFunctionValueSymbols(
      sourceFile,
      program.sourceSemantics,
      writtenSymbols
    );

  const visitor = (
    node: TstsNode | undefined,
    accCollector: DiagnosticsCollector
  ): DiagnosticsCollector => {
    if (!node) return accCollector;
    let currentCollector = accCollector;

    const isBroadOverloadStubType = isInsideOverloadStubSignatureType(node);

    if (isJsonParseCall(node)) {
      const targetTypeNode = getJsonParseTargetTypeNode(node);
      if (targetTypeNode && isBroadJsonTargetTypeNode(targetTypeNode)) {
        const diagnostic = createBackendCapabilityDiagnostic(
          program,
          "broad-json-targets",
          createDiagnostic(
            "TSN5001",
            "error",
            "JSON.parse cannot target a broad compile-time type for deterministic native-safe code.",
            getNodeLocation(sourceFile, node),
            "Use untyped JSON.parse for the JsValue dynamic carrier, JSON.parse<T>(json) for a closed DTO, or assign to a concrete typed variable. Broad targets such as unknown, any, object, and unions are not supported."
          )
        );
        if (diagnostic) {
          currentCollector = addDiagnostic(currentCollector, diagnostic);
        }
      }
    }

    if (isJsonStringifyCall(node)) {
      const sourceExpression = getCallArguments(node)[0];
      if (
        !sourceExpression ||
        sourceExpression.Kind === TstsSyntax.KindSpreadElement ||
        isBroadJsonSourceType(
          program.sourceSemantics.getExpressionType(sourceExpression),
          program.sourceSemantics
        )
      ) {
        const diagnostic = createBackendCapabilityDiagnostic(
          program,
          "broad-json-stringify-source",
          createDiagnostic(
            "TSN5001",
            "error",
            "JSON.stringify requires a closed compile-time source type for deterministic native-safe code.",
            getNodeLocation(sourceFile, node),
            "Pass a concrete DTO, primitive, array of concrete values, or object literal with fully known property types. Broad sources such as unknown, any, object, unions, dictionaries, and generic type parameters are not supported for global JSON.stringify."
          )
        );
        if (diagnostic) {
          currentCollector = addDiagnostic(currentCollector, diagnostic);
        }
      }
    }

    if (isArrayIsArrayCall(node)) {
      const sourceExpression = getCallArguments(node)[0];
      if (
        !sourceExpression ||
        sourceExpression.Kind === TstsSyntax.KindSpreadElement ||
        (!isJsonParseInitializedSymbol(sourceExpression, program) &&
          !isDeclaredDynamicJsonCarrierSymbol(sourceExpression, program) &&
          !isObjectEntriesValueFromDynamicJsonCarrier(
            sourceExpression,
            program
          ) &&
          !isDirectBooleanReturnExpression(node) &&
          isBroadArrayIsArraySourceType(
            program.sourceSemantics.getExpressionType(sourceExpression),
            program.sourceSemantics
          ))
      ) {
        const diagnostic = createBackendCapabilityDiagnostic(
          program,
          "broad-array-narrowing",
          createDiagnostic(
            "TSN5001",
            "error",
            "Array.isArray cannot narrow a broad runtime value without a closed carrier.",
            getNodeLocation(sourceFile, node),
            "Use Array.isArray only on values whose possible runtime carriers are known at compile time, such as concrete arrays or unions with concrete array arms. Broad unknown, any, object, and unconstrained generic values cannot be materialized as arrays in deterministic native-safe code."
          )
        );
        if (diagnostic) {
          currentCollector = addDiagnostic(currentCollector, diagnostic);
        }
      }
    }

    if (node.Kind === TstsSyntax.KindAnyKeyword && !isBroadOverloadStubType) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7401",
          "error",
          "'any' type is not supported. Provide a concrete type, or use a broad overload stub signature that is erased before emission.",
          getNodeLocation(sourceFile, node),
          "Replace 'any' with a specific type, or keep it only on an erased overload stub implementation signature."
        )
      );
    }

    const assertionTargetType = getAssertionTargetTypeNode(node);
    if (assertionTargetType?.Kind === TstsSyntax.KindAnyKeyword) {
      currentCollector = addDiagnostic(
        currentCollector,
        createDiagnostic(
          "TSN7401",
          "error",
          "'any' type assertion is not supported. Use a specific type assertion.",
          getNodeLocation(sourceFile, node),
          "Replace this assertion with a specific type like 'as object' or 'as YourType'."
        )
      );
    }

    if (node.Kind === TstsSyntax.KindParameter && !getNodeType(node)) {
      const parent = nodeParent(node);
      const isLambda =
        parent?.Kind === TstsSyntax.KindArrowFunction ||
        parent?.Kind === TstsSyntax.KindFunctionExpression;

      if (isLambda) {
        const hasExpectedTypeContext = lambdaHasExpectedTypeContext(parent);

        if (!hasExpectedTypeContext) {
          const paramName = identifierText(TstsSyntax.Node_Name(node)) ?? "param";
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7405",
              "error",
              `Parameter '${paramName}' must have an explicit type annotation.`,
              getNodeLocation(sourceFile, node),
              "Add a type annotation to this parameter, or use the lambda in a context that provides type inference (e.g., array.sort, array.map)."
            )
          );
        }
      } else {
        const isFunctionLike =
          parent?.Kind === TstsSyntax.KindFunctionDeclaration ||
          parent?.Kind === TstsSyntax.KindMethodDeclaration ||
          parent?.Kind === TstsSyntax.KindConstructor ||
          parent?.Kind === TstsSyntax.KindGetAccessor ||
          parent?.Kind === TstsSyntax.KindSetAccessor;

        if (isFunctionLike) {
          const paramName = identifierText(TstsSyntax.Node_Name(node)) ?? "param";
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7405",
              "error",
              `Parameter '${paramName}' must have an explicit type annotation.`,
              getNodeLocation(sourceFile, node),
              "Add a type annotation to this parameter."
            )
          );
        }
      }
    }

    if (node.Kind === TstsSyntax.KindObjectLiteralExpression) {
      if (objectLiteralHasBroadContextualType(node)) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7403",
            "error",
            "Object literal cannot target a broad runtime object type deterministically.",
            getNodeLocation(sourceFile, node),
            "Use a concrete object type, dictionary type, or expression-tree projection context."
          )
        );
      }

      const hasContextualType = objectLiteralHasContextualType(node);

      if (!hasContextualType) {
        const eligibility = checkBasicSynthesisEligibility(node, program);
        if (!eligibility.eligible) {
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7403",
              "error",
              `Object literal cannot be synthesized: ${eligibility.reason}`,
              getNodeLocation(sourceFile, node),
              "Use an explicit type annotation, or restructure to use only identifier keys and arrow functions."
            )
          );
        }
      }
    }

    if (node.Kind === TstsSyntax.KindTypeReference) {
      const typeName = TstsSyntax.AsTypeReferenceNode(node)?.TypeName;
      const name = identifierText(typeName);
      if (name) {
        const typeArgs = getTypeArguments(node);
        const hasTypeArgs = typeArgs.length > 0;

        if (
          hasTypeArgs &&
          typeArgs.some((argument) => argument.Kind === TstsSyntax.KindNeverKeyword)
        ) {
          currentCollector = addDiagnostic(
            currentCollector,
            createDiagnostic(
              "TSN7419",
              "error",
              "'never' cannot be used as a generic type argument.",
              getNodeLocation(sourceFile, node),
              "Rewrite the type to avoid never. For Result-like types, model explicit variants (Ok<T> | Err<E>) and have helpers return the specific variant type."
            )
          );
        }

        if (name === "Record") {
          const keyTypeNode = typeArgs[0];
          if (keyTypeNode !== undefined && !isAllowedKeyType(keyTypeNode)) {
            currentCollector = addDiagnostic(
              currentCollector,
              createDiagnostic(
                "TSN7413",
                "error",
                "Dictionary key type must be 'string' or 'number'. Other key types are not supported.",
                getNodeLocation(sourceFile, keyTypeNode),
                "Use Record<string, V> or Record<number, V>."
              )
            );
          }
        }
      }
    }

    if (node.Kind === TstsSyntax.KindIndexSignature) {
      const keyParam = getNodeParameters(node)[0];
      const keyType = keyParam ? getNodeType(keyParam) : undefined;
      if (keyType && !isAllowedKeyType(keyType)) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7413",
            "error",
            "Index signature key type must be 'string' or 'number'. Other key types are not supported.",
            getNodeLocation(sourceFile, keyType),
            "Use { [key: string]: V } or { [key: number]: V }."
          )
        );
      }
    }

    if (isGenericFunctionValueNode(node)) {
      const symbol = getSupportedGenericFunctionValueSymbol(
        node,
        program.sourceSemantics,
        writtenSymbols
      );
      const isSupported =
        symbol !== undefined &&
        supportedGenericFunctionValueSymbols.has(symbol);

      if (!isSupported) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7432",
            "error",
            "Generic function values are only supported in deterministic declaration/alias forms that can lower to native generic methods.",
            getNodeLocation(sourceFile, node),
            "Use `const f = <T>(...) => ...`, `let f = <T>(...) => ...` with no reassignments, or deterministic aliases like `const g = f`."
          )
        );
      }
    }

    if (isGenericFunctionDeclarationNode(node)) {
      const symbol = getSupportedGenericFunctionDeclarationSymbol(
        node,
        program.sourceSemantics
      );
      const isSupported =
        symbol !== undefined &&
        supportedGenericFunctionValueSymbols.has(symbol);
      if (!isSupported) {
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7432",
            "error",
            "Generic function declarations are only supported when their symbol remains deterministic in value positions and lowers to native generic methods.",
            getNodeLocation(sourceFile, node),
            "Use a direct generic call (e.g., `f<T>(...)`) or deterministic const/never-reassigned let aliases."
          )
        );
      }
    }

    if (isIdentifier(node)) {
      const symbol = getReferencedIdentifierSymbol(
        program.sourceSemantics,
        node
      );
      if (
        symbol &&
        supportedGenericFunctionValueSymbols.has(symbol) &&
        !isAllowedGenericFunctionValueIdentifierUse(
          node,
          program.sourceSemantics
        )
      ) {
        const name = identifierText(node) ?? "";
        currentCollector = addDiagnostic(
          currentCollector,
          createDiagnostic(
            "TSN7432",
            "error",
            `Generic function value '${name}' is only supported in direct call or monomorphic callable-context position where lowering is deterministic.`,
            getNodeLocation(sourceFile, node),
            "Call the function directly (e.g., `name<T>(...)`), or use it where a concrete callable type is contextually known (e.g., function argument typed as `(x: number) => number`)."
          )
        );
      }
    }

    if (node.Kind === TstsSyntax.KindArrowFunction) {
      currentCollector = validateArrowEscapeHatch(
        node,
        sourceFile,
        currentCollector
      );
    }

    forEachTstsChild(node, (child) => {
      currentCollector = visitor(child, currentCollector);
    });

    return currentCollector;
  };

  return visitor(sourceFile, collector);
};
