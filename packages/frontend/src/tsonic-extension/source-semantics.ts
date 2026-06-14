import type {
  CompilerExtension,
  ExtensionCheckedSourceFileContext,
  ExtensionDiagnostic,
  TstsNode,
  TstsSignature,
  TstsSymbol,
  TstsType,
} from "@tsonic/tsts";
import {
  forEachTstsChild,
  getTstsCallExpressionDetails,
  getTstsDeclaredTypeNode,
  getTstsExpressionWithTypeArgumentsName,
  getTstsHeritageTypeNodes,
  getTstsIdentifierText,
  getTstsNodeNameText,
  getTstsNodeText,
  getTstsParameters,
  getTstsTypeParameterNodes,
  getTstsTypeArguments,
  getTstsTypeReferenceDetails,
  isTstsClassDeclaration,
  isTstsInterfaceDeclaration,
  isTstsParameterDeclaration,
  isTstsPropertyDeclarationLike,
  TstsSyntax,
  visitTstsSubtree,
} from "@tsonic/tsts";
import * as path from "node:path";
import type {
  FieldSemanticsFact,
  IntrinsicSemanticsFact,
  MarkerApiSemanticsFact,
  ParameterPassingFact,
  ParameterPassingMode,
  SourceTypeSemanticsFact,
} from "../source-frontend/source-facts.js";
import {
  collectImportedNamesByLocalName,
  coreLangModules,
  coreTypesModules,
} from "./core-imports.js";
import {
  fieldSemanticsFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  parameterPassingFactKey,
  sourceTypeSemanticsFactKey,
  extensionReceiverSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  numericPrimitiveFactKey,
  selectedSignatureFactKey,
} from "../source-frontend/source-facts.js";
import { getSourcePrimitiveFact } from "../source-frontend/source-primitive-taxonomy.js";

const fieldFact: FieldSemanticsFact = { storage: "field" };
const extensionReceiverFact = { kind: "extension-receiver" } as const;
const interfaceHeritageFact = { kind: "interface-erasure" } as const;

type TsonicSourceDiagnosticCode =
  | "TSN2001"
  | "TSN5001"
  | "TSN7106"
  | "TSN7401"
  | "TSN7403"
  | "TSN7405"
  | "TSN7413"
  | "TSN7430"
  | "TSN7432"
  | "TSN7440";

const coreSourceNames = new Set([
  "bool",
  "byte",
  "sbyte",
  "short",
  "ushort",
  "int",
  "uint",
  "long",
  "ulong",
  "nint",
  "nuint",
  "float",
  "double",
  "decimal",
  "char",
  "ptr",
  "out",
  "ref",
  "inref",
  "struct",
  "thisarg",
  "field",
  "Interface",
  "stackalloc",
  "trycast",
  "asinterface",
  "istype",
  "nameof",
  "sizeof",
  "defaultof",
  "attributes",
  "AttributeTargets",
  "overloads",
]);

const addSourceDiagnostic = (
  context: Pick<CheckedContext, "diagnostics" | "sourceFile">,
  code: TsonicSourceDiagnosticCode,
  node: TstsNode,
  message: string
): void => {
  const diagnostic: ExtensionDiagnostic = {
    extensionId: "tsonic.source-semantics",
    code,
    category: "error",
    message,
    sourceFile: context.sourceFile,
    node,
  };
  context.diagnostics.add(diagnostic);
};

const visitTstsSubtreeWithParent = (
  node: TstsNode | undefined,
  visit: (node: TstsNode, parent: TstsNode | undefined) => void,
  parent: TstsNode | undefined = undefined
): void => {
  if (!node) return;
  visit(node, parent);
  forEachTstsChild(node, (child): void =>
    visitTstsSubtreeWithParent(child, visit, node)
  );
};

const visitTstsSubtreeWithParents = (
  node: TstsNode | undefined,
  visit: (node: TstsNode, parents: readonly TstsNode[]) => void,
  parents: readonly TstsNode[] = []
): void => {
  if (!node) return;
  visit(node, parents);
  const nextParents = [...parents, node];
  forEachTstsChild(node, (child): void =>
    visitTstsSubtreeWithParents(child, visit, nextParents)
  );
};

const sourceTypeFact = (
  kind: SourceTypeSemanticsFact["kind"]
): SourceTypeSemanticsFact => ({ kind });

const passingFact = (mode: ParameterPassingMode): ParameterPassingFact => ({
  mode,
});

const typeWrapperPassingModes: ReadonlyMap<string, ParameterPassingMode> =
  new Map([
    ["out", "byref-writeonly-must-init"],
    ["ref", "byref-readwrite"],
    ["in", "byref-readonly"],
    ["inref", "byref-readonly"],
  ]);

const callMarkerPassingModes: ReadonlyMap<string, ParameterPassingMode> =
  new Map([
    ["out", "byref-writeonly-must-init"],
    ["ref", "byref-readwrite"],
    ["inref", "byref-readonly"],
  ]);

const intrinsicKindsBySourceName: ReadonlyMap<
  string,
  IntrinsicSemanticsFact["kind"]
> = new Map([
  ["asinterface", "asinterface"],
  ["defaultof", "defaultof"],
  ["istype", "istype"],
  ["nameof", "nameof"],
  ["sizeof", "sizeof"],
  ["stackalloc", "stackalloc"],
  ["trycast", "trycast"],
]);

const markerApiKindsBySourceName: ReadonlyMap<
  string,
  MarkerApiSemanticsFact["kind"]
> = new Map([
  ["attributes", "attributes"],
  ["AttributeTargets", "attribute-targets"],
  ["overloads", "overloads"],
]);

const typeWrapperPassingFact = (
  node: TstsNode | undefined,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): ParameterPassingFact | undefined => {
  const typeReference = getTstsTypeReferenceDetails(node);
  if (!typeReference || typeReference.typeArguments.length !== 1) {
    return undefined;
  }

  const importedName = coreTypesBindingByLocalName.get(
    typeReference.name
  )?.importedName;
  if (!importedName) return undefined;
  const mode = typeWrapperPassingModes.get(importedName);
  return mode ? passingFact(mode) : undefined;
};

const importedTypeReferenceName = (
  node: TstsNode | undefined,
  bindingsByLocalName: ReadonlyMap<string, { readonly importedName: string }>
): string | undefined => {
  const typeReference = getTstsTypeReferenceDetails(node);
  return typeReference
    ? bindingsByLocalName.get(typeReference.name)?.importedName
    : undefined;
};

const containsImportedTypeReference = (
  node: TstsNode | undefined,
  bindingsByLocalName: ReadonlyMap<string, { readonly importedName: string }>,
  importedName: string
): boolean => {
  let found = false;
  visitTstsSubtree(node, (current): void => {
    if (found || !current) return;
    found =
      importedTypeReferenceName(current, bindingsByLocalName) === importedName;
  });
  return found;
};

const nearestFunctionLikeParent = (
  parents: readonly TstsNode[]
): TstsNode | undefined =>
  [...parents]
    .reverse()
    .find((parent) =>
      [
        TstsSyntax.KindFunctionDeclaration,
        TstsSyntax.KindMethodDeclaration,
        TstsSyntax.KindConstructor,
        TstsSyntax.KindGetAccessor,
        TstsSyntax.KindSetAccessor,
        TstsSyntax.KindFunctionExpression,
        TstsSyntax.KindArrowFunction,
      ].includes(parent.Kind)
    );

const nearestObjectLiteralMethodParent = (
  parents: readonly TstsNode[]
): TstsNode | undefined =>
  [...parents]
    .reverse()
    .find((parent) => parent.Kind === TstsSyntax.KindMethodDeclaration);

const typeText = (node: TstsNode | undefined): string =>
  node ? (getTstsNodeText(node) ?? "") : "";

const hasForbiddenDictionaryKeyTypeText = (text: string): boolean =>
  /\bsymbol\b/.test(text) ||
  /\bobject\b/.test(text) ||
  /\bPropertyKey\b/.test(text) ||
  /Record\s*<\s*[^,{}()[\]<>]+\s*,/.test(text) === false &&
    !/^\s*(?:string|number)\s*$/.test(text);

const expressionText = (node: TstsNode | undefined): string =>
  (node ? getTstsNodeText(node) : undefined)?.replace(/\s+/g, "") ?? "";

const isCorePackageSourceFile = (fileName: string): boolean =>
  fileName.replace(/\\/g, "/").includes("/node_modules/@tsonic/core/");

const isDependencySupportSourceFile = (fileName: string): boolean => {
  const normalized = fileName.replace(/\\/g, "/");
  return (
    normalized.includes("/node_modules/") || normalized.includes("/type-roots/")
  );
};

const normalizeSourceFileName = (fileName: string): string =>
  path.resolve(fileName).replace(/\\/g, "/");

const nodeHasAncestorKind = (
  parents: readonly TstsNode[],
  kind: number
): boolean => parents.some((parent) => parent.Kind === kind);

const isBroadJsonTypeText = (text: string): boolean =>
  text === "unknown" ||
  text === "object" ||
  /\|/.test(text) ||
  /^Record\s*</.test(text) ||
  /^[A-Z]$/.test(text);

const isGenericFunctionNode = (node: TstsNode | undefined): boolean =>
  Boolean(
    node &&
      [
        TstsSyntax.KindFunctionDeclaration,
        TstsSyntax.KindFunctionExpression,
        TstsSyntax.KindArrowFunction,
      ].includes(node.Kind) &&
      getTstsTypeParameterNodes(node).length > 0
  );

const symbolForName = (
  context: CheckedContext,
  node: TstsNode | undefined
): TstsSymbol | undefined => {
  if (!node) return undefined;
  const symbol = context.checker.getSymbolAtLocation(node);
  return symbol ? context.checker.resolveAlias(symbol) : undefined;
};

const variableDeclarationKind = (
  declaration: TstsNode
): "const" | "let" | "var" | undefined => {
  const list = declaration.Parent;
  if (!list || !TstsSyntax.IsVariableDeclarationList(list)) return undefined;
  const flags = TstsSyntax.AsVariableDeclarationList(list)?.Flags ?? 0;
  if ((flags & TstsSyntax.NodeFlagsConst) !== 0) return "const";
  if ((flags & TstsSyntax.NodeFlagsLet) !== 0) return "let";
  return "var";
};

const isIdentifierGenericSymbol = (
  context: CheckedContext,
  node: TstsNode | undefined,
  genericSymbols: ReadonlySet<TstsSymbol>
): boolean => {
  if (!node || !TstsSyntax.IsIdentifier(node)) return false;
  const symbol = symbolForName(context, node);
  return symbol ? genericSymbols.has(symbol) : false;
};

const isMonomorphicCallableType = (
  context: CheckedContext,
  type: TstsType | undefined
): boolean => {
  if (!type) return false;
  const signatures = context.checker.getCallSignatures(type);
  if (
    signatures.length > 0 &&
    signatures.every(
      (signature) => !context.checker.signatureHasTypeParameters(signature)
    )
  ) {
    return true;
  }

  const nonNullishMembers = context.checker.getNonNullishUnionMembers(type);
  return (
    nonNullishMembers !== undefined &&
    nonNullishMembers.length > 0 &&
    nonNullishMembers.every((member) => {
      const memberSignatures = context.checker.getCallSignatures(member);
      return (
        memberSignatures.length > 0 &&
        memberSignatures.every(
          (signature) => !context.checker.signatureHasTypeParameters(signature)
        )
      );
    })
  );
};

const hasMonomorphicCallableContext = (
  context: CheckedContext,
  node: TstsNode | undefined
): boolean =>
  isMonomorphicCallableType(context, context.checker.getContextualType(node));

const isFieldWrapper = (
  node: TstsNode | undefined,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const typeReference = getTstsTypeReferenceDetails(node);
  return (
    typeReference?.typeArguments.length === 1 &&
    coreLangBindingByLocalName.get(typeReference.name)?.importedName === "field"
  );
};

const isExtensionReceiverWrapper = (
  node: TstsNode | undefined,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const typeReference = getTstsTypeReferenceDetails(node);
  return (
    typeReference?.typeArguments.length === 1 &&
    coreLangBindingByLocalName.get(typeReference.name)?.importedName ===
      "thisarg"
  );
};

const isInterfaceHeritageWrapper = (
  heritageType: TstsNode,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const heritageName = getTstsExpressionWithTypeArgumentsName(heritageType);
  return (
    heritageName !== undefined &&
    getTstsTypeArguments(heritageType).length === 1 &&
    coreLangBindingByLocalName.get(heritageName)?.importedName === "Interface"
  );
};

const isStructHeritageType = (
  heritageType: TstsNode,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const heritageName = getTstsExpressionWithTypeArgumentsName(heritageType);
  return (
    heritageName !== undefined &&
    coreTypesBindingByLocalName.get(heritageName)?.importedName === "struct"
  );
};

const structHeritageTypes = (
  node: TstsNode,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): readonly TstsNode[] =>
  getTstsHeritageTypeNodes(node).filter(
    (heritageType): heritageType is TstsNode =>
      heritageType
        ? isStructHeritageType(heritageType, coreTypesBindingByLocalName)
        : false
  );

type ScalarProfile = "string" | "number" | "boolean" | "bigint";
type IterableProfileMode = "sync" | "async";

type SourceTypeProfile = {
  readonly sourcePrimitiveName?: string | undefined;
  readonly scalar?: ScalarProfile | undefined;
  readonly shapeKey?: string | undefined;
  readonly isTypeParameter?: boolean | undefined;
  readonly iterableMode?: IterableProfileMode | undefined;
};

type CheckedContext = ExtensionCheckedSourceFileContext;

const scalarForSourcePrimitive = (
  sourcePrimitiveName: string | undefined
): ScalarProfile | undefined => {
  if (!sourcePrimitiveName) return undefined;
  const fact = getSourcePrimitiveFact(sourcePrimitiveName);
  switch (fact?.runtimeBase) {
    case "boolean":
      return "boolean";
    case "string":
      return "string";
    case "number":
    case "decimal":
      return "number";
    case "bigint":
      return "bigint";
    default:
      return undefined;
  }
};

const iterableModeFromTypeName = (
  typeName: string | undefined
): IterableProfileMode | undefined => {
  if (!typeName) return undefined;
  const normalized = typeName.replace(/\$instance\b/g, "");
  if (/\b(?:AsyncIterable|AsyncIterableIterator|AsyncGenerator)\b/.test(normalized)) {
    return "async";
  }
  if (/\b(?:Iterable|IterableIterator|Iterator|Generator)\b/.test(normalized)) {
    return "sync";
  }
  return undefined;
};

const mergeIterableModes = (
  left: IterableProfileMode | undefined,
  right: IterableProfileMode | undefined
): IterableProfileMode | undefined => (left === right ? left : left ?? right);

const iterableModeFromSemanticType = (
  type: TstsType | undefined,
  checker: CheckedContext["checker"]
): IterableProfileMode | undefined => {
  if (!type) return undefined;

  const direct = iterableModeFromTypeName(checker.typeToString(type));
  if (direct) return direct;

  let discovered: IterableProfileMode | undefined;
  for (const property of checker
    .getProperties(type)
    .filter((candidate): candidate is TstsSymbol => candidate !== undefined)) {
    const propertyName = property.Name.toLowerCase();
    const propertyNameMode = propertyName.includes("asynciterator")
      ? "async"
      : propertyName.includes("iterator")
        ? "sync"
        : undefined;
    discovered = mergeIterableModes(discovered, propertyNameMode);

    const [declaration] = checker.getSymbolDeclarations(property);
    const propertyType = declaration
      ? checker.getTypeOfSymbolAtLocation(property, declaration)
      : undefined;
    for (const signature of checker.getCallSignatures(propertyType)) {
      const returnType = checker.getReturnTypeOfSignature(signature);
      discovered = mergeIterableModes(
        discovered,
        iterableModeFromTypeName(checker.typeToString(returnType))
      );
    }
  }

  return discovered;
};

const profileFromSemanticType = (
  type: TstsType | undefined,
  checker: CheckedContext["checker"],
  seen: WeakSet<object> = new WeakSet<object>()
): SourceTypeProfile | undefined => {
  if (!type) return undefined;
  if (seen.has(type)) return undefined;
  seen.add(type);

  const nonNullishMembers = checker.getNonNullishUnionMembers(type);
  if (nonNullishMembers && nonNullishMembers.length > 0) {
    return nonNullishMembers
      .map((member) => profileFromSemanticType(member, checker, seen))
      .reduce<SourceTypeProfile | undefined>(
        (profile, memberProfile) =>
          mergeConditionalProfiles(profile, memberProfile),
        undefined
      );
  }

  const scalar = checker.isStringLikeType(type)
    ? "string"
    : checker.isNumberLikeType(type)
      ? "number"
      : checker.isBooleanLikeType(type)
        ? "boolean"
        : checker.isBigIntLikeType(type)
          ? "bigint"
          : undefined;
  if (scalar) return { scalar };

  if (checker.isTypeParameter(type)) {
    return { isTypeParameter: true, shapeKey: checker.typeToString(type) };
  }

  const shapeKey = checker.typeToString(type);
  const iterableMode = iterableModeFromSemanticType(type, checker);
  return shapeKey && !["any", "unknown", "void", "never"].includes(shapeKey)
    ? { shapeKey, iterableMode }
    : undefined;
};

const profileFromTypeNode = (
  node: TstsNode | undefined,
  context: CheckedContext
): SourceTypeProfile | undefined => {
  if (!node) return undefined;
  const sourcePrimitiveName = context.facts.get(
    numericPrimitiveFactKey,
    node
  )?.sourceName;
  const sourceProfile = sourcePrimitiveName
    ? {
        sourcePrimitiveName,
        scalar: scalarForSourcePrimitive(sourcePrimitiveName),
      }
    : undefined;
  return mergeProfiles(
    sourceProfile,
    profileFromSemanticType(
      context.checker.getTypeFromTypeNode(node),
      context.checker
    )
  );
};

const mergeProfiles = (
  preferred: SourceTypeProfile | undefined,
  secondary: SourceTypeProfile | undefined
): SourceTypeProfile | undefined => {
  if (!preferred) return secondary;
  if (!secondary) return preferred;
  return {
    sourcePrimitiveName:
      preferred.sourcePrimitiveName ?? secondary.sourcePrimitiveName,
    scalar: preferred.scalar ?? secondary.scalar,
    shapeKey: preferred.shapeKey ?? secondary.shapeKey,
    isTypeParameter:
      preferred.isTypeParameter ?? secondary.isTypeParameter,
    iterableMode:
      preferred.iterableMode ?? secondary.iterableMode,
  };
};

const mergeConditionalProfiles = (
  whenTrue: SourceTypeProfile | undefined,
  whenFalse: SourceTypeProfile | undefined
): SourceTypeProfile | undefined => {
  if (!whenTrue) return whenFalse;
  if (!whenFalse) return whenTrue;
  if (
    whenTrue.sourcePrimitiveName &&
    whenTrue.sourcePrimitiveName === whenFalse.sourcePrimitiveName
  ) {
    return whenTrue;
  }
  if (whenTrue.scalar && whenTrue.scalar === whenFalse.scalar) {
    return { scalar: whenTrue.scalar };
  }
  if (whenTrue.shapeKey && whenTrue.shapeKey === whenFalse.shapeKey) {
    return {
      shapeKey: whenTrue.shapeKey,
      iterableMode: whenTrue.iterableMode ?? whenFalse.iterableMode,
    };
  }
  if (whenTrue.isTypeParameter && whenFalse.isTypeParameter) {
    return { isTypeParameter: true };
  }
  return mergeProfiles(whenTrue, whenFalse);
};

const profileFromSymbolDeclaration = (
  symbol: TstsSymbol | undefined,
  context: CheckedContext
): SourceTypeProfile | undefined => {
  if (!symbol) return undefined;
  const resolved = context.checker.resolveAlias(symbol);
  for (const declaration of context.checker.getSymbolDeclarations(resolved)) {
    const declaredType = getTstsDeclaredTypeNode(declaration);
    const profile = profileFromTypeNode(declaredType, context);
    if (profile) return profile;
  }
  return undefined;
};

const profileFromSignatureReturn = (
  signature: TstsSignature | undefined,
  context: CheckedContext
): SourceTypeProfile | undefined => {
  if (!signature) return undefined;
  const declaration = context.checker.getSignatureDeclaration(signature);
  return mergeProfiles(
    profileFromTypeNode(getTstsDeclaredTypeNode(declaration), context),
    profileFromSemanticType(
      context.checker.getReturnTypeOfSignature(signature),
      context.checker
    )
  );
};

const profileFromExpression = (
  expression: TstsNode | undefined,
  context: CheckedContext
): SourceTypeProfile | undefined => {
  if (!expression) return undefined;

  if (
    expression.Kind === TstsSyntax.KindStringLiteral ||
    expression.Kind === TstsSyntax.KindNoSubstitutionTemplateLiteral
  ) {
    return (getTstsNodeText(expression) ?? "").length === 1
      ? { sourcePrimitiveName: "char", scalar: "string" }
      : { scalar: "string" };
  }

  if (
    expression.Kind === TstsSyntax.KindAsExpression ||
    expression.Kind === TstsSyntax.KindTypeAssertionExpression
  ) {
    const assertedType = TstsSyntax.Node_Type(expression);
    const assertedProfile = profileFromTypeNode(assertedType, context);
    if (assertedProfile) return assertedProfile;
    return profileFromExpression(TstsSyntax.Node_Expression(expression), context);
  }

  if (expression.Kind === TstsSyntax.KindParenthesizedExpression) {
    return profileFromExpression(TstsSyntax.Node_Expression(expression), context);
  }

  if (expression.Kind === TstsSyntax.KindConditionalExpression) {
    const conditional = TstsSyntax.AsConditionalExpression(expression);
    return mergeConditionalProfiles(
      profileFromExpression(conditional?.WhenTrue, context),
      profileFromExpression(conditional?.WhenFalse, context)
    );
  }

  if (expression.Kind === TstsSyntax.KindCallExpression) {
    return profileFromSignatureReturn(
      context.facts.get(selectedSignatureFactKey, expression)?.signature ??
        context.checker.getResolvedSignature(expression),
      context
    );
  }

  const symbolProfile = profileFromSymbolDeclaration(
    context.checker.getSymbolAtLocation(expression),
    context
  );
  const semanticProfile = profileFromSemanticType(
    context.checker.getNarrowedTypeAtLocation(expression) ??
      context.checker.getTypeAtLocation(expression),
    context.checker
  );
  return mergeProfiles(symbolProfile, semanticProfile);
};

const isOptionalParameter = (parameter: TstsNode | undefined): boolean =>
  parameter ? TstsSyntax.Node_QuestionToken(parameter) !== undefined : false;

const isRestParameter = (parameter: TstsNode | undefined): boolean =>
  parameter
    ? TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken !== undefined
    : false;

const isArityCompatible = (
  parameters: readonly (TstsNode | undefined)[],
  argumentCount: number
): boolean => {
  const requiredCount = parameters.filter(
    (parameter) => !isOptionalParameter(parameter) && !isRestParameter(parameter)
  ).length;
  if (argumentCount < requiredCount) return false;
  if (parameters.some(isRestParameter)) return true;
  return argumentCount <= parameters.length;
};

const parameterForArgumentIndex = (
  parameters: readonly (TstsNode | undefined)[],
  index: number
): TstsNode | undefined => {
  const direct = parameters[index];
  if (direct) return direct;
  const rest = parameters.find(isRestParameter);
  return rest;
};

const profileFromSignatureParameter = (
  signature: TstsSignature,
  argumentIndex: number,
  callNode: TstsNode,
  context: CheckedContext
): SourceTypeProfile | undefined => {
  const declaration = context.checker.getSignatureDeclaration(signature);
  const parameterDeclarations = getTstsParameters(declaration);
  const parameterDeclaration = parameterForArgumentIndex(
    parameterDeclarations,
    argumentIndex
  );
  const parameterSymbols = context.checker.getSignatureParameters(signature);
  const parameterSymbol =
    parameterSymbols[
      Math.min(argumentIndex, Math.max(parameterSymbols.length - 1, 0))
    ];
  const declaredProfile = profileFromTypeNode(
    getTstsDeclaredTypeNode(parameterDeclaration),
    context
  );
  if (declaredProfile?.isTypeParameter) {
    return declaredProfile;
  }

  return mergeProfiles(
    declaredProfile,
    profileFromSemanticType(
      parameterSymbol
        ? context.checker.getTypeOfSymbolAtLocation(parameterSymbol, callNode)
        : undefined,
      context.checker
    )
  );
};

const scoreParameterAgainstArgument = (
  parameter: SourceTypeProfile | undefined,
  argument: SourceTypeProfile | undefined
): number | undefined => {
  if (!parameter || !argument) return 0;

  if (parameter.isTypeParameter) {
    return 0;
  }

  if (parameter.iterableMode) {
    if (!argument.iterableMode) return undefined;
    return parameter.iterableMode === argument.iterableMode ? 18 : undefined;
  }

  if (parameter.sourcePrimitiveName && argument.sourcePrimitiveName) {
    return parameter.sourcePrimitiveName === argument.sourcePrimitiveName
      ? 20
      : undefined;
  }

  if (parameter.sourcePrimitiveName && argument.scalar) {
    const parameterScalar = scalarForSourcePrimitive(
      parameter.sourcePrimitiveName
    );
    if (parameterScalar !== argument.scalar) return undefined;
    return argument.sourcePrimitiveName ? 0 : -1;
  }

  if (parameter.scalar && argument.sourcePrimitiveName) {
    return parameter.scalar === argument.scalar ? 4 : undefined;
  }

  if (parameter.scalar && argument.shapeKey) return undefined;
  if (parameter.shapeKey && argument.scalar) return undefined;

  if (parameter.shapeKey && argument.shapeKey) {
    return parameter.shapeKey === argument.shapeKey ? 12 : 1;
  }

  if (parameter.shapeKey) {
    return 1;
  }

  if (parameter.scalar && argument.scalar) {
    return parameter.scalar === argument.scalar ? 2 : undefined;
  }

  return 0;
};

const selectSourceSignature = (
  callNode: TstsNode,
  context: CheckedContext
): TstsSignature | undefined => {
  const call = getTstsCallExpressionDetails(callNode);
  if (!call?.expression) return undefined;

  const calleeType = context.checker.getTypeAtLocation(call.expression);
  const candidates = context.checker
    .getCallSignatures(calleeType)
    .filter((signature): signature is TstsSignature => signature !== undefined);
  if (candidates.length < 2) return undefined;

  const argumentProfiles = call.arguments.map((argument) =>
    profileFromExpression(argument, context)
  );
  const viable: { readonly signature: TstsSignature; readonly score: number }[] =
    [];

  for (const candidate of candidates) {
    const declaration = context.checker.getSignatureDeclaration(candidate);
    const parameters = getTstsParameters(declaration);
    if (!isArityCompatible(parameters, call.arguments.length)) {
      continue;
    }

    const hasRestParameter = parameters.some(isRestParameter);
    let score =
      !hasRestParameter && parameters.length === call.arguments.length ? 2 : 0;
    let rejected = false;
    for (let index = 0; index < call.arguments.length; index += 1) {
      const parameterProfile = profileFromSignatureParameter(
        candidate,
        index,
        callNode,
        context
      );
      const parameterScore = scoreParameterAgainstArgument(
        parameterProfile,
        argumentProfiles[index]
      );
      if (parameterScore === undefined) {
        rejected = true;
        break;
      }
      score += parameterScore;
    }

    if (!rejected && score > 0) {
      viable.push({ signature: candidate, score });
    }
  }

  if (viable.length === 0) return undefined;
  viable.sort((left, right) => right.score - left.score);
  const [best, second] = viable;
  return best && best.score > (second?.score ?? -1) ? best.signature : undefined;
};

export type TsonicSourceSemanticsExtensionOptions = {
  readonly sourceDiagnosticFileNames?: readonly string[];
};

export const createTsonicSourceSemanticsExtension = (
  options: TsonicSourceSemanticsExtensionOptions = {}
): CompilerExtension => {
  const sourceDiagnosticFileNames =
    options.sourceDiagnosticFileNames === undefined
      ? undefined
      : new Set(
          options.sourceDiagnosticFileNames.map((fileName) =>
            normalizeSourceFileName(fileName)
          )
        );

  return {
    id: "tsonic.source-semantics",
    runsAfter: ["tsonic.numeric-primitives"],
    afterParseSourceFile: (context): void => {
    const coreTypesBindingByLocalName = collectImportedNamesByLocalName(
      context.imports,
      coreTypesModules
    );
    const coreLangBindingByLocalName = collectImportedNamesByLocalName(
      context.imports,
      coreLangModules
    );

    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node) return;

      const identifierText = getTstsIdentifierText(node);
      const importedIdentifierName = identifierText
        ? coreLangBindingByLocalName.get(identifierText)?.importedName
        : undefined;
      const markerApiKind = importedIdentifierName
        ? markerApiKindsBySourceName.get(importedIdentifierName)
        : undefined;
      if (markerApiKind) {
        context.facts.set(markerApiSemanticsFactKey, node, {
          kind: markerApiKind,
        });
      }

      if (isTstsClassDeclaration(node)) {
        const structMarkers = structHeritageTypes(
          node,
          coreTypesBindingByLocalName
        );
        context.facts.set(
          sourceTypeSemanticsFactKey,
          node,
          sourceTypeFact(structMarkers.length > 0 ? "struct" : "class")
        );
        for (const marker of structMarkers) {
          context.facts.set(
            sourceTypeSemanticsFactKey,
            marker,
            sourceTypeFact("struct")
          );
        }
        for (const heritageType of getTstsHeritageTypeNodes(node)) {
          if (
            heritageType &&
            isInterfaceHeritageWrapper(heritageType, coreLangBindingByLocalName)
          ) {
            context.facts.set(
              heritageWrapperSemanticsFactKey,
              heritageType,
              interfaceHeritageFact
            );
          }
        }
        return;
      }

      if (isTstsInterfaceDeclaration(node)) {
        const structMarkers = structHeritageTypes(
          node,
          coreTypesBindingByLocalName
        );
        context.facts.set(
          sourceTypeSemanticsFactKey,
          node,
          sourceTypeFact(structMarkers.length > 0 ? "struct" : "interface")
        );
        for (const marker of structMarkers) {
          context.facts.set(
            sourceTypeSemanticsFactKey,
            marker,
            sourceTypeFact("struct")
          );
        }
        for (const heritageType of getTstsHeritageTypeNodes(node)) {
          if (
            heritageType &&
            isInterfaceHeritageWrapper(heritageType, coreLangBindingByLocalName)
          ) {
            context.facts.set(
              heritageWrapperSemanticsFactKey,
              heritageType,
              interfaceHeritageFact
            );
          }
        }
        return;
      }

      const declaredType = getTstsDeclaredTypeNode(node);
      const declarationPassingFact = typeWrapperPassingFact(
        declaredType,
        coreTypesBindingByLocalName
      );
      if (declarationPassingFact && isTstsParameterDeclaration(node)) {
        context.facts.set(
          parameterPassingFactKey,
          node,
          declarationPassingFact
        );
      }
      if (declarationPassingFact && declaredType) {
        context.facts.set(
          parameterPassingFactKey,
          declaredType,
          declarationPassingFact
        );
      }

      if (
        declaredType &&
        isTstsParameterDeclaration(node) &&
        isExtensionReceiverWrapper(declaredType, coreLangBindingByLocalName)
      ) {
        context.facts.set(
          extensionReceiverSemanticsFactKey,
          node,
          extensionReceiverFact
        );
        context.facts.set(
          extensionReceiverSemanticsFactKey,
          declaredType,
          extensionReceiverFact
        );
      }

      if (
        declaredType &&
        isTstsPropertyDeclarationLike(node) &&
        isFieldWrapper(declaredType, coreLangBindingByLocalName)
      ) {
        context.facts.set(fieldSemanticsFactKey, node, fieldFact);
        context.facts.set(fieldSemanticsFactKey, declaredType, fieldFact);
      }

      const typeReferencePassingFact = typeWrapperPassingFact(
        node,
        coreTypesBindingByLocalName
      );
      if (typeReferencePassingFact) {
        context.facts.set(
          parameterPassingFactKey,
          node,
          typeReferencePassingFact
        );
      }

      if (isFieldWrapper(node, coreLangBindingByLocalName)) {
        context.facts.set(fieldSemanticsFactKey, node, fieldFact);
      }

      if (isExtensionReceiverWrapper(node, coreLangBindingByLocalName)) {
        context.facts.set(
          extensionReceiverSemanticsFactKey,
          node,
          extensionReceiverFact
        );
      }

      const call = getTstsCallExpressionDetails(node);
      if (!call?.calleeName) return;
      const importedCallName = coreLangBindingByLocalName.get(
        call.calleeName
      )?.importedName;
      if (!importedCallName) return;

      const callPassingMode = callMarkerPassingModes.get(importedCallName);
      if (
        callPassingMode &&
        call.arguments.length === 1 &&
        call.typeArguments.length === 0
      ) {
        context.facts.set(
          parameterPassingFactKey,
          node,
          passingFact(callPassingMode)
        );
      }

      const intrinsicKind = intrinsicKindsBySourceName.get(importedCallName);
      if (intrinsicKind) {
        context.facts.set(intrinsicSemanticsFactKey, node, {
          kind: intrinsicKind,
        });
      }
    });
    },
    afterCheckSourceFile: (context): void => {
    if (!context.sourceFile) return;
    const sourceFileName = context.sourceFile.FileName();
    const isCoreSourceFile = isCorePackageSourceFile(sourceFileName);
    const shouldValidateSourceDiagnostics =
      context.sourceFile.IsDeclarationFile !== true &&
      !isCoreSourceFile &&
      (sourceDiagnosticFileNames === undefined
        ? !isDependencySupportSourceFile(sourceFileName)
        : sourceDiagnosticFileNames.has(
            normalizeSourceFileName(sourceFileName)
          ));
    const coreTypesBindingByLocalName = collectImportedNamesByLocalName(
      context.imports,
      coreTypesModules
    );
    const coreLangBindingByLocalName = collectImportedNamesByLocalName(
      context.imports,
      coreLangModules
    );
    const functionDeclarationCounts = new Map<string, number>();
    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node || node.Kind !== TstsSyntax.KindFunctionDeclaration) return;
      const name = getTstsNodeNameText(node);
      if (!name) return;
      functionDeclarationCounts.set(
        name,
        (functionDeclarationCounts.get(name) ?? 0) + 1
      );
    });

    const variableDeclarations: TstsNode[] = [];
    const genericSymbols = new Set<TstsSymbol>();
    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node) return;
      if (TstsSyntax.IsFunctionDeclaration(node) && isGenericFunctionNode(node)) {
        const symbol = symbolForName(context, TstsSyntax.Node_Name(node));
        if (symbol) genericSymbols.add(symbol);
      }
      if (TstsSyntax.IsVariableDeclaration(node)) {
        variableDeclarations.push(node);
        const initializer = TstsSyntax.Node_Initializer(node);
        if (isGenericFunctionNode(initializer)) {
          const symbol = symbolForName(context, TstsSyntax.Node_Name(node));
          if (symbol) genericSymbols.add(symbol);
        }
      }
    });

    let addedGenericAlias = true;
    while (addedGenericAlias) {
      addedGenericAlias = false;
      for (const declaration of variableDeclarations) {
        const initializer = TstsSyntax.Node_Initializer(declaration);
        if (!isIdentifierGenericSymbol(context, initializer, genericSymbols)) {
          continue;
        }
        const symbol = symbolForName(context, TstsSyntax.Node_Name(declaration));
        if (symbol && !genericSymbols.has(symbol)) {
          genericSymbols.add(symbol);
          addedGenericAlias = true;
        }
      }
    }

    if (shouldValidateSourceDiagnostics) {
      visitTstsSubtreeWithParents(context.sourceFile, (node, parents): void => {
      const directParent = parents[parents.length - 1];
      const declaredType = getTstsDeclaredTypeNode(node);

      if (
        declaredType &&
        isTstsParameterDeclaration(node) &&
        containsImportedTypeReference(
          declaredType,
          coreLangBindingByLocalName,
          "thisarg"
        )
      ) {
        const parentParameters = directParent
          ? getTstsParameters(directParent)
          : [];
        const parameterIndex = parentParameters.findIndex(
          (parameter) => parameter === node
        );
        if (directParent?.Kind !== TstsSyntax.KindFunctionDeclaration) {
          addSourceDiagnostic(
            context,
            "TSN7106",
            node,
            "thisarg<T> is only valid on top-level function declarations."
          );
        } else if (parameterIndex !== 0) {
          addSourceDiagnostic(
            context,
            "TSN7106",
            node,
            "thisarg<T> must be the first parameter."
          );
        }
      }

      if (
        declaredType &&
        isTstsParameterDeclaration(node) &&
        typeWrapperPassingFact(
          declaredType,
          coreTypesBindingByLocalName
        )?.mode === "byref-writeonly-must-init" &&
        containsImportedTypeReference(
          declaredType,
          coreLangBindingByLocalName,
          "thisarg"
        )
      ) {
        addSourceDiagnostic(
          context,
          "TSN7106",
          node,
          "thisarg<T> extension receivers cannot be `out` parameters."
        );
      }

      if (
        !isCoreSourceFile &&
        [
          TstsSyntax.KindTypeAliasDeclaration,
          TstsSyntax.KindFunctionDeclaration,
          TstsSyntax.KindInterfaceDeclaration,
          TstsSyntax.KindClassDeclaration,
        ].includes(node.Kind)
      ) {
        const name = getTstsNodeNameText(node);
        if (name && coreSourceNames.has(name)) {
          addSourceDiagnostic(
            context,
            "TSN7440",
            node,
            `Core intrinsic '${name}' must resolve to @tsonic/core.`
          );
        }
      }

      if (node.Kind === TstsSyntax.KindAnyKeyword) {
        const functionParent = nearestFunctionLikeParent(parents);
        const functionParentName = getTstsNodeNameText(functionParent);
        if (
          !functionParent ||
          !(
            functionParentName &&
            (functionDeclarationCounts.get(functionParentName) ?? 0) > 1
          )
        ) {
          addSourceDiagnostic(
            context,
            "TSN7401",
            node,
            "'any' type assertion is not supported; 'any' type is not supported."
          );
        }
      }

      if (node.Kind === TstsSyntax.KindParameter) {
        const parameterType = getTstsDeclaredTypeNode(node);
        const functionParent = nearestFunctionLikeParent(parents);
        const contextualType = functionParent
          ? context.checker.getContextualType(functionParent)
          : undefined;
        if (
          !parameterType &&
          !isMonomorphicCallableType(context, contextualType)
        ) {
          addSourceDiagnostic(
            context,
            "TSN7405",
            node,
            "Function parameters require explicit type annotations unless contextual typing proves them."
          );
        }
      }

      if (node.Kind === TstsSyntax.KindWithStatement) {
        addSourceDiagnostic(
          context,
          "TSN2001",
          node,
          "The JavaScript 'with' statement is not supported."
        );
      }

      if (node.Kind === TstsSyntax.KindMetaProperty) {
        addSourceDiagnostic(
          context,
          "TSN2001",
          node,
          "import.meta is not supported in deterministic native source."
        );
      }

      const call = getTstsCallExpressionDetails(node);
      if (
        node.Kind === TstsSyntax.KindCallExpression ||
        node.Kind === TstsSyntax.KindNewExpression
      ) {
        const calleeText = expressionText(TstsSyntax.Node_Expression(node));
        if (calleeText === "import") {
          addSourceDiagnostic(
            context,
            "TSN2001",
            node,
            "Dynamic import is not supported."
          );
        }
        if (calleeText === "Array") {
          addSourceDiagnostic(
            context,
            "TSN2001",
            node,
            "Array constructor inference is not supported; use an array literal or explicit collection type."
          );
        }
        if (calleeText === "Array.isArray") {
          const [argument] = call?.arguments ?? [];
          const argumentType = context.checker.getTypeAtLocation(argument);
          if (
            argumentType &&
            context.checker.typeToString(argumentType) === "unknown" &&
            nodeHasAncestorKind(parents, TstsSyntax.KindIfStatement)
          ) {
            addSourceDiagnostic(
              context,
              "TSN5001",
              node,
              "Array.isArray cannot narrow a broad runtime value."
            );
          }
        }
        if (calleeText === "JSON.parse") {
          const explicitTypeArguments = getTstsTypeArguments(node);
          const resultContext = context.checker.getContextualType(node);
          const resultText =
            explicitTypeArguments.length > 0
              ? typeText(explicitTypeArguments[0])
              : context.checker.typeToString(resultContext);
          if (isBroadJsonTypeText(resultText)) {
            addSourceDiagnostic(
              context,
              "TSN5001",
              node,
              "JSON.parse target must be a concrete DTO or JsValue carrier."
            );
          }
        }
        if (calleeText === "JSON.stringify") {
          const [argument] = call?.arguments ?? [];
          const argumentText = context.checker.typeToString(
            context.checker.getTypeAtLocation(argument)
          );
          if (isBroadJsonTypeText(argumentText)) {
            addSourceDiagnostic(
              context,
              "TSN5001",
              node,
              "JSON.stringify source must be a concrete DTO, closed object literal, or JsValue carrier."
            );
          }
        }
      }

      if (node.Kind === TstsSyntax.KindBinaryExpression) {
        const binary = TstsSyntax.AsBinaryExpression(node);
        if (binary?.OperatorToken?.Kind === TstsSyntax.KindInKeyword) {
          const rightType = context.checker.getTypeAtLocation(binary.Right);
          const rightText = context.checker.typeToString(rightType);
          if (!/\|/.test(rightText) || rightText.trim().startsWith("{")) {
            addSourceDiagnostic(
              context,
              "TSN2001",
              node,
              "The JavaScript 'in' operator is only supported for closed structural unions."
            );
          }
        }
      }

      if (
        node.Kind === TstsSyntax.KindTypeReference &&
        getTstsTypeReferenceDetails(node)?.name === "Record"
      ) {
        const [keyType] = getTstsTypeArguments(node);
        if (hasForbiddenDictionaryKeyTypeText(typeText(keyType))) {
          addSourceDiagnostic(
            context,
            "TSN7413",
            node,
            "Dictionary key type must be string or number."
          );
        }
      }

      if (node.Kind === TstsSyntax.KindIndexSignature) {
        const [parameter] = getTstsParameters(node);
        const keyType = getTstsDeclaredTypeNode(parameter);
        if (hasForbiddenDictionaryKeyTypeText(typeText(keyType))) {
          addSourceDiagnostic(
            context,
            "TSN7413",
            node,
            "Dictionary key type must be string or number."
          );
        }
      }

      if (node.Kind === TstsSyntax.KindArrowFunction) {
        const contextualType = context.checker.getContextualType(node);
        const parameters = getTstsParameters(node);
        const hasExplicitParameterTypes = parameters.every((parameter) =>
          Boolean(getTstsDeclaredTypeNode(parameter))
        );
        const hasExplicitReturnType = Boolean(getTstsDeclaredTypeNode(node));
        if (
          !contextualType &&
          (!hasExplicitParameterTypes || !hasExplicitReturnType)
        ) {
          addSourceDiagnostic(
            context,
            "TSN7430",
            node,
            "Arrow functions without contextual typing require explicit parameter and return types."
          );
        }
      }

      if (node.Kind === TstsSyntax.KindObjectLiteralExpression) {
        const parentType = directParent
          ? getTstsDeclaredTypeNode(directParent)
          : undefined;
        if (parentType?.Kind === TstsSyntax.KindObjectKeyword) {
          addSourceDiagnostic(
            context,
            "TSN7403",
            node,
            "Object literals assigned to broad runtime object type require a concrete structural type."
          );
        }
      }

      if (TstsSyntax.IsVariableDeclaration(node)) {
        const name = TstsSyntax.Node_Name(node);
        const symbol = symbolForName(context, name);
        if (symbol && genericSymbols.has(symbol)) {
          const declarationKind = variableDeclarationKind(node);
          const initializer = TstsSyntax.Node_Initializer(node);
          if (
            declarationKind === "var" ||
            (declarationKind === "let" &&
              !isGenericFunctionNode(initializer) &&
              !isIdentifierGenericSymbol(context, initializer, genericSymbols))
          ) {
            addSourceDiagnostic(
              context,
              "TSN7432",
              node,
              "Generic function values may only flow through deterministic const or unreassigned let call-only bindings."
            );
          }
        }
      }

      if (
        TstsSyntax.IsBinaryExpression(node) &&
        TstsSyntax.AsBinaryExpression(node)?.OperatorToken?.Kind ===
          TstsSyntax.KindEqualsToken
      ) {
        const target = TstsSyntax.AsBinaryExpression(node)?.Left;
        if (isIdentifierGenericSymbol(context, target, genericSymbols)) {
          addSourceDiagnostic(
            context,
            "TSN7432",
            node,
            "Generic function values cannot be reassigned."
          );
        }
      }

      if (node.Kind === TstsSyntax.KindShorthandPropertyAssignment) {
        const valueSymbol = context.checker.resolveAlias(
          context.checker.getShorthandAssignmentValueSymbol(node)
        );
        if (
          valueSymbol &&
          genericSymbols.has(valueSymbol) &&
          !hasMonomorphicCallableContext(context, TstsSyntax.Node_Name(node))
        ) {
          addSourceDiagnostic(
            context,
            "TSN7432",
            node,
            "Generic function values cannot be used as runtime object properties outside monomorphic callable contexts."
          );
        }
      }

      if (TstsSyntax.IsIdentifier(node) && isIdentifierGenericSymbol(context, node, genericSymbols)) {
        if (
          directParent &&
          TstsSyntax.IsCallExpression(directParent) &&
          TstsSyntax.AsCallExpression(directParent)?.Expression === node
        ) {
          return;
        }
        if (
          directParent?.Kind === TstsSyntax.KindTypeQuery ||
          directParent?.Kind === TstsSyntax.KindImportSpecifier ||
          directParent?.Kind === TstsSyntax.KindExportSpecifier ||
          directParent?.Kind === TstsSyntax.KindExportAssignment ||
          directParent?.Kind === TstsSyntax.KindVariableDeclaration ||
          directParent?.Kind === TstsSyntax.KindFunctionDeclaration
        ) {
          return;
        }

        if (hasMonomorphicCallableContext(context, node)) {
          return;
        }

        addSourceDiagnostic(
          context,
          "TSN7432",
          node,
          "Generic function values cannot be used as runtime values outside direct calls or monomorphic callable contexts."
        );
      }

      if (
        node.Kind === TstsSyntax.KindElementAccessExpression &&
        expressionText(TstsSyntax.Node_Expression(node)) === "arguments"
      ) {
        const methodParent = nearestObjectLiteralMethodParent(parents);
        if (methodParent) {
          const parameters = getTstsParameters(methodParent);
          const parametersAreFixedIdentifiers = parameters.every(
            (parameter) =>
              parameter !== undefined &&
              getTstsIdentifierText(TstsSyntax.Node_Name(parameter)) !==
                undefined &&
              TstsSyntax.Node_QuestionToken(parameter) === undefined &&
              TstsSyntax.AsParameterDeclaration(parameter)?.DotDotDotToken ===
                undefined
          );
          if (!parametersAreFixedIdentifiers) {
            addSourceDiagnostic(
              context,
              "TSN7403",
              node,
              "Object literal method shorthand cannot use unsupported arguments patterns."
            );
          }
        }
      }

      if (
        node.Kind === TstsSyntax.KindSuperKeyword &&
        nearestObjectLiteralMethodParent(parents)
      ) {
        addSourceDiagnostic(
          context,
          "TSN7403",
          node,
          "Object literal method shorthand cannot use super."
        );
      }
      });
    }

    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node || node.Kind !== TstsSyntax.KindCallExpression) return;
      const selected = selectSourceSignature(node, context);
      if (!selected) return;
      context.facts.set(selectedSignatureFactKey, node, { signature: selected });
    });
    },
  };
};
