import type {
  CompilerExtension,
  ExtensionCheckedSourceFileContext,
  ExtensionDiagnostic,
  TstsNode,
  TstsSymbol,
  TstsType,
} from "@tsonic/tsts";
import {
  forEachTstsChild,
  getTstsCallExpressionDetails,
  getTstsContainingSourceFile,
  getTstsDeclaredTypeNode,
  getTstsExpressionWithTypeArgumentsName,
  getTstsHeritageTypeNodes,
  getTstsIdentifierText,
  getTstsNodeNameText,
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
import type { FeatureKey } from "../capabilities/backend-capabilities.js";
import type {
  FieldSemanticsFact,
  IntrinsicSemanticsFact,
  MarkerApiSemanticsFact,
  ParameterPassingFact,
  ParameterPassingMode,
  SourceAttributeApplicationFact,
  SourceAttributeDescriptorFact,
  SourceAttributeTargetKind,
  SourceAttributeTargetSpecifier,
  SourceBindingDeclarationKind,
  SourceBindingIdentityFact,
  SourceRuntimeVisibilityFact,
  SourceRuntimeOperationOwner,
  SourceRuntimeOperationFact,
  SourceTypeSemanticsFact,
} from "../source-frontend/source-facts.js";
import {
  collectImportedNamesByLocalName,
  coreLangModules,
  coreTypesModules,
} from "./core-imports.js";
import {
  expressionSemanticsFactKey,
  fieldSemanticsFactKey,
  genericFunctionAliasFactKey,
  intrinsicSemanticsFactKey,
  markerApiSemanticsFactKey,
  parameterPassingFactKey,
  sourceAttributeApplicationsFactKey,
  sourceAttributeDescriptorFactKey,
  sourceBindingIdentityFactKey,
  sourceRuntimeVisibilityFactKey,
  sourceRuntimeOperationFactKey,
  sourceTypeSemanticsFactKey,
  extensionReceiverSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  wellKnownComputedNameFactKey,
} from "../source-frontend/source-facts.js";

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
  message: string,
  options: { readonly capabilityFeatureKey?: FeatureKey } = {}
): void => {
  const diagnostic: ExtensionDiagnostic = {
    extensionId: "tsonic.source-semantics",
    code,
    category: "error",
    message,
    sourceFile: context.sourceFile,
    node,
    metadata: options.capabilityFeatureKey
      ? { capabilityFeatureKey: options.capabilityFeatureKey }
      : undefined,
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
    .find(
      (parent) =>
        parent.Kind === TstsSyntax.KindMethodDeclaration &&
        parent.Parent?.Kind === TstsSyntax.KindObjectLiteralExpression
    );

const isIdentifierNamed = (
  node: TstsNode | undefined,
  name: string
): boolean => getTstsIdentifierText(node) === name;

const isPropertyAccessNamed = (
  node: TstsNode | undefined,
  receiverName: string,
  memberName: string
): boolean =>
  node?.Kind === TstsSyntax.KindPropertyAccessExpression &&
  isIdentifierNamed(TstsSyntax.Node_Expression(node), receiverName) &&
  isIdentifierNamed(TstsSyntax.Node_Name(node), memberName);

const isExternalSupportDeclaration = (
  declaration: TstsNode | undefined,
  sourceDiagnosticFileNames?: ReadonlySet<string>
): boolean => {
  let current = declaration;
  while (current) {
    if (
      (Number(TstsSyntax.Node_ModifierFlags(current)) &
        TstsSyntax.ModifierFlagsAmbient) !==
      0
    ) {
      return true;
    }
    current = current.Parent;
  }
  const sourceFile = getTstsContainingSourceFile(declaration);
  if (sourceFile?.IsDeclarationFile === true) return true;
  const fileName = sourceFile?.FileName();
  if (fileName === undefined) return false;
  if (
    sourceDiagnosticFileNames !== undefined &&
    !sourceDiagnosticFileNames.has(normalizeSourceFileName(fileName))
  ) {
    return true;
  }
  return isDependencySupportSourceFile(fileName);
};

const isAmbientGlobalIdentifier = (
  context: CheckedContext,
  node: TstsNode | undefined,
  name: string,
  sourceDiagnosticFileNames?: ReadonlySet<string>
): boolean => {
  if (!isIdentifierNamed(node, name)) return false;
  if (context.imports.resolveLocalName(name)) return false;
  const symbol = symbolForName(context, node);
  if (!symbol) return true;
  const declarations = context.checker.getSymbolDeclarations(symbol);
  return (
    declarations.length === 0 ||
    declarations.every((declaration) =>
      isExternalSupportDeclaration(declaration, sourceDiagnosticFileNames)
    )
  );
};

const isWellKnownSymbolName = (
  context: CheckedContext,
  node: TstsNode | undefined,
  sourceDiagnosticFileNames?: ReadonlySet<string>
):
  | "symbol-iterator"
  | "symbol-async-iterator"
  | "symbol-to-string-tag"
  | undefined => {
  const expression =
    node?.Kind === TstsSyntax.KindComputedPropertyName
      ? TstsSyntax.Node_Expression(node)
      : node;
  if (expression?.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return undefined;
  }
  if (
    !isAmbientGlobalIdentifier(
      context,
      TstsSyntax.Node_Expression(expression),
      "Symbol",
      sourceDiagnosticFileNames
    )
  ) {
    return undefined;
  }
  const memberName = getTstsIdentifierText(TstsSyntax.Node_Name(expression));
  switch (memberName) {
    case "iterator":
      return "symbol-iterator";
    case "asyncIterator":
      return "symbol-async-iterator";
    case "toStringTag":
      return "symbol-to-string-tag";
    default:
      return undefined;
  }
};

const expressionSemanticsKind = (
  context: CheckedContext,
  node: TstsNode,
  sourceDiagnosticFileNames?: ReadonlySet<string>
): "undefined-value" | undefined =>
  isAmbientGlobalIdentifier(context, node, "undefined", sourceDiagnosticFileNames)
    ? "undefined-value"
    : undefined;

const stringReceiverRuntimeMembers = new Set([
  "charAt",
  "endsWith",
  "includes",
  "indexOf",
  "lastIndexOf",
  "replace",
  "replaceAll",
  "slice",
  "split",
  "startsWith",
  "substring",
  "toString",
  "toLowerCase",
  "toUpperCase",
  "trim",
  "trimEnd",
  "trimLeft",
  "trimRight",
  "trimStart",
]);

const arrayReceiverRuntimeMembers = new Set([
  "at",
  "concat",
  "entries",
  "every",
  "filter",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "forEach",
  "includes",
  "indexOf",
  "join",
  "lastIndexOf",
  "map",
  "pop",
  "push",
  "reverse",
  "shift",
  "slice",
  "some",
  "sort",
  "splice",
  "toReversed",
  "toSorted",
  "toSpliced",
  "toString",
  "unshift",
  "values",
  "with",
]);

const consoleRuntimeMembers = new Set([
  "debug",
  "error",
  "info",
  "log",
  "warn",
]);

const stringStaticRuntimeMembers = new Set([
  "fromCharCode",
  "fromCodePoint",
]);

const arrayStaticRuntimeMembers = new Set(["from", "isArray", "of"]);

const objectStaticRuntimeMembers = new Set([
  "entries",
  "fromEntries",
  "is",
  "keys",
  "values",
]);

const jsonStaticRuntimeMembers = new Set(["parse", "stringify"]);
const promiseStaticRuntimeMembers = new Set(["resolve", "reject", "all", "race"]);
const mapReceiverRuntimeMembers = new Set(["delete", "get", "has", "set"]);
const typedArrayRuntimeConstructors = [
  "Uint8Array",
  "Uint8ClampedArray",
  "Int8Array",
  "Uint16Array",
  "Int16Array",
  "Uint32Array",
  "Int32Array",
  "Float32Array",
  "Float64Array",
] as const;
const typedArrayRuntimeConstructorSet: ReadonlySet<SourceRuntimeOperationOwner> =
  new Set(typedArrayRuntimeConstructors);
const ambientRuntimeConstructors: ReadonlyMap<
  string,
  SourceRuntimeOperationOwner
> = new Map([
  ["DataView", "DataView"],
  ["Error", "Error"],
  ["Float32Array", "Float32Array"],
  ["Float64Array", "Float64Array"],
  ["Int16Array", "Int16Array"],
  ["Int32Array", "Int32Array"],
  ["Int8Array", "Int8Array"],
  ["Map", "Map"],
  ["RegExp", "RegExp"],
  ["Uint16Array", "Uint16Array"],
  ["Uint32Array", "Uint32Array"],
  ["Uint8Array", "Uint8Array"],
  ["Uint8ClampedArray", "Uint8ClampedArray"],
]);
const globalRuntimeMembers = new Set([
  "clearInterval",
  "clearTimeout",
  "setInterval",
  "setTimeout",
]);

const runtimeConstructorOperationForIdentifier = (
  context: CheckedContext,
  node: TstsNode | undefined,
  sourceDiagnosticFileNames?: ReadonlySet<string>
): SourceRuntimeOperationFact | undefined => {
  const memberName = getTstsIdentifierText(node);
  if (!memberName) return undefined;
  const owner = ambientRuntimeConstructors.get(memberName);
  return owner &&
    isAmbientGlobalIdentifier(
      context,
      node,
      memberName,
      sourceDiagnosticFileNames
    )
    ? { owner, member: "constructor", dispatch: "constructor" }
    : undefined;
};

const typeRuntimeOwnerName = (
  context: CheckedContext,
  type: TstsType | undefined
): SourceRuntimeOperationOwner | undefined => {
  const name =
    context.checker.getTypeSymbolName(type) ??
    context.checker.getTypeAliasSymbolName(type);
  return name && ambientRuntimeConstructors.has(name)
    ? ambientRuntimeConstructors.get(name)
    : undefined;
};

const uniqueTypedArrayRuntimeOwner = (
  context: CheckedContext,
  type: TstsType | undefined
): SourceRuntimeOperationOwner | undefined => {
  const members = context.checker.getNonNullishUnionMembers(type);
  if (members) {
    const memberOwners = members.map((member) =>
      typeRuntimeOwnerName(context, member)
    );
    if (
      memberOwners.some(
        (owner) => !owner || !typedArrayRuntimeConstructorSet.has(owner)
      )
    ) {
      return undefined;
    }
    const owners = new Set(memberOwners);
    return owners.size === 1 ? [...owners][0] : undefined;
  }
  const owner = typeRuntimeOwnerName(context, type);
  const owners = new Set(
    owner && typedArrayRuntimeConstructorSet.has(owner) ? [owner] : []
  );
  return owners.size === 1 ? [...owners][0] : undefined;
};

const isLengthCarrierType = (
  context: CheckedContext,
  type: TstsType | undefined
): boolean =>
  type !== undefined &&
  (context.checker.isStringLikeType(type) ||
    context.checker.isArrayType(type) ||
    context.checker.isTupleType(type) ||
    uniqueTypedArrayRuntimeOwner(context, type) !== undefined ||
    context.checker.getCallSignatures(type).length > 0);

const isLengthCarrierUnionType = (
  context: CheckedContext,
  type: TstsType | undefined
): boolean => {
  const members = context.checker.getNonNullishUnionMembers(type);
  return (
    members !== undefined &&
    members.length > 1 &&
    members.every((member) => isLengthCarrierType(context, member))
  );
};

const sourceRuntimeOperation = (
  context: CheckedContext,
  node: TstsNode,
  sourceDiagnosticFileNames?: ReadonlySet<string>
): SourceRuntimeOperationFact | undefined => {
  if (node.Kind === TstsSyntax.KindElementAccessExpression) {
    const receiver = TstsSyntax.Node_Expression(node);
    const argument = TstsSyntax.AsElementAccessExpression(node)?.ArgumentExpression;
    const computedName = isWellKnownSymbolName(
      context,
      argument,
      sourceDiagnosticFileNames
    );
    if (computedName === "symbol-to-string-tag") {
      return { owner: "Object", member: "toStringTag", dispatch: "property" };
    }
    const receiverType =
      context.checker.getNarrowedTypeAtLocation(receiver) ??
      context.checker.getTypeAtLocation(receiver);
    if (receiverType && context.checker.isStringLikeType(receiverType)) {
      return { owner: "String", member: "charAt", dispatch: "index" };
    }
    if (
      receiverType &&
      (context.checker.isArrayType(receiverType) ||
        context.checker.isTupleType(receiverType))
    ) {
      return { owner: "Array", member: "element", dispatch: "index" };
    }
    return undefined;
  }

  if (node.Kind === TstsSyntax.KindNewExpression) {
    const expression = TstsSyntax.Node_Expression(node);
    return runtimeConstructorOperationForIdentifier(
      context,
      expression,
      sourceDiagnosticFileNames
    );
  }

  if (node.Kind === TstsSyntax.KindIdentifier) {
    const constructorOperation = runtimeConstructorOperationForIdentifier(
      context,
      node,
      sourceDiagnosticFileNames
    );
    if (constructorOperation) return constructorOperation;
    const memberName = getTstsIdentifierText(node);
    if (!memberName) return undefined;
    if (
      memberName === "String" &&
      isAmbientGlobalIdentifier(
        context,
        node,
        "String",
        sourceDiagnosticFileNames
      )
    ) {
      return { owner: "String", member: "coerce", dispatch: "static-call" };
    }
    return globalRuntimeMembers.has(memberName) &&
      isAmbientGlobalIdentifier(
        context,
        node,
        memberName,
        sourceDiagnosticFileNames
      )
      ? { owner: "Global", member: memberName, dispatch: "static-call" }
      : undefined;
  }

  if (node.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return undefined;
  }

  const receiver = TstsSyntax.Node_Expression(node);
  const memberName = getTstsIdentifierText(TstsSyntax.Node_Name(node));
  if (!memberName) return undefined;

  if (
    isAmbientGlobalIdentifier(
      context,
      receiver,
      "console",
      sourceDiagnosticFileNames
    ) &&
    consoleRuntimeMembers.has(memberName)
  ) {
    return { owner: "Console", member: memberName, dispatch: "static-call" };
  }

  if (
    isAmbientGlobalIdentifier(
      context,
      receiver,
      "String",
      sourceDiagnosticFileNames
    ) &&
    stringStaticRuntimeMembers.has(memberName)
  ) {
    return { owner: "String", member: memberName, dispatch: "static-call" };
  }

  if (
    isAmbientGlobalIdentifier(
      context,
      receiver,
      "Array",
      sourceDiagnosticFileNames
    ) &&
    arrayStaticRuntimeMembers.has(memberName)
  ) {
    return { owner: "Array", member: memberName, dispatch: "static-call" };
  }

  if (
    isAmbientGlobalIdentifier(
      context,
      receiver,
      "Object",
      sourceDiagnosticFileNames
    ) &&
    objectStaticRuntimeMembers.has(memberName)
  ) {
    return { owner: "Object", member: memberName, dispatch: "static-call" };
  }

  if (
    isAmbientGlobalIdentifier(
      context,
      receiver,
      "JSON",
      sourceDiagnosticFileNames
    ) &&
    jsonStaticRuntimeMembers.has(memberName)
  ) {
    return { owner: "JSON", member: memberName, dispatch: "static-call" };
  }

  if (
    isAmbientGlobalIdentifier(
      context,
      receiver,
      "Promise",
      sourceDiagnosticFileNames
    ) &&
    promiseStaticRuntimeMembers.has(memberName)
  ) {
    return { owner: "Promise", member: memberName, dispatch: "static-call" };
  }

  const receiverType =
    context.checker.getNarrowedTypeAtLocation(receiver) ??
    context.checker.getTypeAtLocation(receiver);
  if (memberName === "length") {
    if (receiverType && context.checker.isStringLikeType(receiverType)) {
      return { owner: "String", member: "length", dispatch: "property" };
    }
    if (
      receiverType &&
      (context.checker.isArrayType(receiverType) ||
        context.checker.isTupleType(receiverType))
    ) {
      return { owner: "Array", member: "length", dispatch: "property" };
    }
    const typedArrayOwner = uniqueTypedArrayRuntimeOwner(context, receiverType);
    if (typedArrayOwner) {
      return {
        owner: typedArrayOwner,
        member: "length",
        dispatch: "property",
      };
    }
    if (isLengthCarrierUnionType(context, receiverType)) {
      return { owner: "Object", member: "length", dispatch: "property" };
    }
    if (context.checker.getCallSignatures(receiverType).length > 0) {
      return { owner: "Function", member: "length", dispatch: "property" };
    }
  }
  if (
    memberName === "message" &&
    receiverType &&
    (context.checker.getTypeSymbolName(receiverType) === "Error" ||
      context.checker.getTypeAliasSymbolName(receiverType) === "Error")
  ) {
    return { owner: "Error", member: "message", dispatch: "property" };
  }

  if (
    receiverType &&
    context.checker.isStringLikeType(receiverType) &&
    stringReceiverRuntimeMembers.has(memberName)
  ) {
    return { owner: "String", member: memberName, dispatch: "receiver-call" };
  }

  if (
    receiverType &&
    (context.checker.isArrayType(receiverType) ||
      context.checker.isTupleType(receiverType)) &&
    arrayReceiverRuntimeMembers.has(memberName)
  ) {
    return { owner: "Array", member: memberName, dispatch: "receiver-call" };
  }

  if (
    receiverType &&
    (context.checker.getTypeSymbolName(receiverType) === "Map" ||
      context.checker.getTypeAliasSymbolName(receiverType) === "Map" ||
      context.checker.getTypeSymbolName(receiverType) === "ReadonlyMap" ||
      context.checker.getTypeAliasSymbolName(receiverType) === "ReadonlyMap") &&
    mapReceiverRuntimeMembers.has(memberName)
  ) {
    return { owner: "Map", member: memberName, dispatch: "receiver-call" };
  }

  if (memberName === "toString" && receiverType) {
    return { owner: "Object", member: "toString", dispatch: "receiver-call" };
  }

  return undefined;
};

const isAllowedDictionaryKeyTypeNode = (
  node: TstsNode | undefined
): boolean => {
  if (!node) return false;
  switch (node.Kind) {
    case TstsSyntax.KindStringKeyword:
    case TstsSyntax.KindNumberKeyword:
      return true;
    case TstsSyntax.KindParenthesizedType:
      return isAllowedDictionaryKeyTypeNode(
        TstsSyntax.AsParenthesizedTypeNode(node)?.Type
      );
    default:
      return false;
  }
};

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

const isJsValueType = (
  checker: CheckedContext["checker"],
  type: TstsType | undefined
): boolean =>
  checker.getTypeAliasSymbolName(type) === "JsValue" ||
  checker.getTypeSymbolName(type) === "JsValue";

const hasDictionaryIndexShape = (
  checker: CheckedContext["checker"],
  type: TstsType | undefined
): boolean =>
  checker.getStringIndexType(type) !== undefined ||
  (!checker.isArrayType(type) && checker.getNumberIndexType(type) !== undefined);

const isBroadJsonType = (
  checker: CheckedContext["checker"],
  type: TstsType | undefined
): boolean => {
  if (!type || isJsValueType(checker, type)) return false;
  if (checker.getUnionMembers(type)?.length) return true;
  if (checker.isAnyUnknownOrTypeParameter(type)) return true;
  if (hasDictionaryIndexShape(checker, type)) return true;
  const aliasName = checker.getTypeAliasSymbolName(type);
  const symbolName = checker.getTypeSymbolName(type);
  if (aliasName === "Record" || symbolName === "Record") return true;
  return (
    !aliasName &&
    !symbolName &&
    !checker.isSourceScalarLikeType(type) &&
    checker.getProperties(type).length === 0 &&
    checker.getCallSignatures(type).length === 0 &&
    checker.getConstructSignatures(type).length === 0
  );
};

const isClosedStructuralUnionType = (
  checker: CheckedContext["checker"],
  type: TstsType | undefined
): boolean => {
  if (!type) return false;
  const members = checker.getNonNullishUnionMembers(type);
  return (
    members !== undefined &&
    members.length > 1 &&
    members.every((member) => checker.getProperties(member).length > 0)
  );
};

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

const overloadableFunctionLikeKinds = new Set([
  TstsSyntax.KindFunctionDeclaration,
  TstsSyntax.KindMethodDeclaration,
  TstsSyntax.KindConstructor,
]);

const overloadCountForFunctionLike = (
  node: TstsNode | undefined,
  topLevelFunctionDeclarationCounts: ReadonlyMap<string, number>
): number => {
  if (!node || !overloadableFunctionLikeKinds.has(node.Kind)) return 0;
  const name = getTstsNodeNameText(node);
  if (!name) return 0;
  if (node.Kind === TstsSyntax.KindFunctionDeclaration) {
    return topLevelFunctionDeclarationCounts.get(name) ?? 0;
  }
  const parent = node.Parent;
  if (!parent) return 0;
  return (TstsSyntax.Node_Members(parent) ?? []).filter(
    (member) =>
      member?.Kind === node.Kind && getTstsNodeNameText(member) === name
  ).length;
};

const parameterHasCheckerProvenType = (
  context: CheckedContext,
  parameter: TstsNode
): boolean => {
  const name = TstsSyntax.Node_Name(parameter);
  const symbol = symbolForName(context, name);
  if (!symbol) return false;
  const type = context.checker.getTypeOfSymbolAtLocation(symbol, parameter);
  return isConcreteCallableParameterType(context, type);
};

const isConcreteCallableParameterType = (
  context: CheckedContext,
  type: TstsType | undefined
): boolean =>
  type !== undefined &&
  !context.checker.isAnyOrUnknownType(type) &&
  !context.checker.isVoidType(type) &&
  !context.checker.isNeverType(type);

const parameterHasContextualSignatureType = (
  context: CheckedContext,
  parameter: TstsNode
): boolean => {
  const functionLike = parameter.Parent;
  if (!functionLike) return false;
  const parameterIndex = getTstsParameters(functionLike).indexOf(parameter);
  if (parameterIndex < 0) return false;
  const contextualType = context.checker.getContextualType(functionLike);
  const signatures = contextualType
    ? context.checker.getCallSignatures(contextualType)
    : [];
  return signatures.some((signature) => {
    const signatureParameter =
      context.checker.getSignatureParameters(signature)[parameterIndex];
    if (!signatureParameter) return false;
    return isConcreteCallableParameterType(
      context,
      context.checker.getTypeOfSymbolAtLocation(signatureParameter, parameter)
    );
  });
};

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

const sourceBindingDeclarationKind = (
  declaration: TstsNode | undefined
): SourceBindingDeclarationKind | undefined => {
  switch (declaration?.Kind) {
    case TstsSyntax.KindClassDeclaration:
      return "class";
    case TstsSyntax.KindEnumDeclaration:
      return "enum";
    case TstsSyntax.KindFunctionDeclaration:
      return "function";
    case TstsSyntax.KindInterfaceDeclaration:
      return "interface";
    case TstsSyntax.KindTypeAliasDeclaration:
      return "type-alias";
    case TstsSyntax.KindVariableDeclaration:
      return "variable";
    default:
      return undefined;
  }
};

const isTopLevelStaticValueDeclaration = (declaration: TstsNode): boolean => {
  if (declaration.Kind === TstsSyntax.KindFunctionDeclaration) {
    return declaration.Parent?.Kind === TstsSyntax.KindSourceFile;
  }
  if (declaration.Kind !== TstsSyntax.KindVariableDeclaration) {
    return false;
  }
  const list = declaration.Parent;
  const statement = list?.Parent;
  return (
    statement?.Kind === TstsSyntax.KindVariableStatement &&
    statement.Parent?.Kind === TstsSyntax.KindSourceFile
  );
};

const sourceBindingIdentityFact = (
  context: CheckedContext,
  symbol: TstsSymbol | undefined
): SourceBindingIdentityFact | undefined => {
  if (!symbol) return undefined;
  const valueDeclaration = context.checker.getSymbolValueDeclaration(symbol);
  const declarations = context.checker.getSymbolDeclarations(symbol);
  const declaration =
    valueDeclaration ??
    declarations.find(
      (candidate): candidate is TstsNode =>
        sourceBindingDeclarationKind(candidate) !== undefined
    );
  const declarationKind = sourceBindingDeclarationKind(declaration);
  if (!declaration || !declarationKind) return undefined;
  const sourceFile = getTstsContainingSourceFile(declaration);
  if (!sourceFile || sourceFile.IsDeclarationFile === true) return undefined;
  const name =
    getTstsNodeNameText(declaration) ?? context.checker.getSymbolName(symbol);
  if (!name) return undefined;
  return {
    sourceFileName: sourceFile.FileName(),
    name,
    declarationKind,
    topLevelStaticValue: isTopLevelStaticValueDeclaration(declaration),
  };
};

const sourceFileNameSegments = (fileName: string): readonly string[] =>
  fileName.replace(/\\/g, "/").split("/").filter(Boolean);

const sourceRuntimeVisibilityFactForBinding = (
  fact: SourceBindingIdentityFact
): SourceRuntimeVisibilityFact | undefined =>
  fact.name === "_" ||
  fact.name.includes("\uFFFD") ||
  sourceFileNameSegments(fact.sourceFileName).includes("_")
    ? { visibility: "opaque" }
    : undefined;

const sourceRuntimeVisibilityFactForUnboundName = (
  name: string | undefined
): SourceRuntimeVisibilityFact | undefined =>
  name === "_" || name?.startsWith("_") === true || name?.includes("\uFFFD")
    ? { visibility: "opaque" }
    : undefined;

const setSourceRuntimeVisibilityFact = (
  context: CheckedContext,
  subject: TstsNode,
  fact: SourceRuntimeVisibilityFact | undefined
): void => {
  if (fact) {
    context.facts.set(sourceRuntimeVisibilityFactKey, subject, fact);
  }
};

const setSourceBindingIdentityFact = (
  context: CheckedContext,
  subject: TstsNode,
  symbol: TstsSymbol | undefined
): SourceBindingIdentityFact | undefined => {
  const fact = sourceBindingIdentityFact(context, symbol);
  if (fact) {
    context.facts.set(sourceBindingIdentityFactKey, subject, fact);
    setSourceRuntimeVisibilityFact(
      context,
      subject,
      sourceRuntimeVisibilityFactForBinding(fact)
    );
  }
  return fact;
};

const setDeclarationBindingFacts = (
  context: CheckedContext,
  declaration: TstsNode
): void => {
  if (sourceBindingDeclarationKind(declaration) === undefined) return;
  const name = TstsSyntax.Node_Name(declaration);
  const symbol = symbolForName(context, name);
  setSourceBindingIdentityFact(context, declaration, symbol);
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

const genericTargetSymbolForIdentifier = (
  context: CheckedContext,
  node: TstsNode | undefined,
  genericSymbols: ReadonlySet<TstsSymbol>,
  genericAliasTargets: ReadonlyMap<TstsSymbol, TstsSymbol>
): TstsSymbol | undefined => {
  if (!node || !TstsSyntax.IsIdentifier(node)) return undefined;
  const symbol = symbolForName(context, node);
  if (!symbol) return undefined;
  return genericAliasTargets.get(symbol) ?? (genericSymbols.has(symbol) ? symbol : undefined);
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

type CheckedContext = ExtensionCheckedSourceFileContext;

const isCompileTimeMarkerApiExpression = (
  node: TstsNode | undefined,
  context: Pick<CheckedContext, "facts">
): boolean => {
  if (!node) return false;
  if (context.facts.get(markerApiSemanticsFactKey, node)) {
    return true;
  }
  switch (node.Kind) {
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindNewExpression:
    case TstsSyntax.KindPropertyAccessExpression:
      return isCompileTimeMarkerApiExpression(
        TstsSyntax.Node_Expression(node),
        context
      );
    case TstsSyntax.KindParenthesizedExpression:
      return isCompileTimeMarkerApiExpression(
        TstsSyntax.Node_Expression(node),
        context
      );
    default:
      return false;
  }
};

type AttributeBuilderTarget = {
  readonly targetKind: SourceAttributeTargetKind;
  readonly declaration: TstsNode;
  readonly targetSpecifier?: SourceAttributeTargetSpecifier;
};

const unwrapParenthesizedExpression = (
  node: TstsNode | undefined
): TstsNode | undefined => {
  let current = node;
  while (current?.Kind === TstsSyntax.KindParenthesizedExpression) {
    current = TstsSyntax.Node_Expression(current);
  }
  return current;
};

const isImportedCoreLangIdentifier = (
  node: TstsNode | undefined,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >,
  importedName: string
): boolean => {
  const identifier = getTstsIdentifierText(node);
  return (
    identifier !== undefined &&
    coreLangBindingByLocalName.get(identifier)?.importedName === importedName
  );
};

const isAttributesRootCall = (
  node: TstsNode | undefined,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  const call = getTstsCallExpressionDetails(node);
  return (
    call !== undefined &&
    call.calleeName !== undefined &&
    coreLangBindingByLocalName.get(call.calleeName)?.importedName ===
      "attributes"
  );
};

const attributeTypeTargetDeclaration = (
  context: CheckedContext,
  typeNode: TstsNode | undefined
): TstsNode | undefined => {
  if (!typeNode) return undefined;
  const directSymbol = context.checker.getSymbolAtLocation(typeNode);
  const type = context.checker.getTypeFromTypeNode(typeNode);
  const typeSymbol = type ? context.checker.getTypeAliasOrSymbol(type) : undefined;
  const symbol = directSymbol
    ? context.checker.resolveAlias(directSymbol)
    : typeSymbol;
  return symbol
    ? context.checker
        .getSymbolDeclarations(symbol)
        .find(
          (declaration): declaration is TstsNode =>
            declaration !== undefined &&
            [
              TstsSyntax.KindClassDeclaration,
              TstsSyntax.KindInterfaceDeclaration,
              TstsSyntax.KindEnumDeclaration,
              TstsSyntax.KindTypeAliasDeclaration,
            ].includes(declaration.Kind)
        )
    : undefined;
};

const constructorDeclarationForType = (
  declaration: TstsNode
): TstsNode | undefined =>
  (TstsSyntax.Node_Members(declaration) ?? []).find(
    (member): member is TstsNode =>
      member !== undefined && member.Kind === TstsSyntax.KindConstructor
  );

const memberDeclarationByName = (
  owner: TstsNode,
  name: string,
  targetKind: Extract<SourceAttributeTargetKind, "method" | "property">
): TstsNode | undefined =>
  (TstsSyntax.Node_Members(owner) ?? []).find((member): member is TstsNode => {
    if (!member || getTstsNodeNameText(member) !== name) return false;
    return targetKind === "method"
      ? member.Kind === TstsSyntax.KindMethodDeclaration
      : [
          TstsSyntax.KindPropertyDeclaration,
          TstsSyntax.KindGetAccessor,
          TstsSyntax.KindSetAccessor,
        ].includes(member.Kind);
  });

const selectedMemberDeclaration = (
  context: CheckedContext,
  owner: TstsNode,
  selector: TstsNode | undefined,
  targetKind: Extract<SourceAttributeTargetKind, "method" | "property">
): TstsNode | undefined => {
  if (!selector || selector.Kind !== TstsSyntax.KindArrowFunction) {
    return undefined;
  }
  const body = unwrapParenthesizedExpression(TstsSyntax.Node_Body(selector));
  if (body?.Kind !== TstsSyntax.KindPropertyAccessExpression) return undefined;
  const name = TstsSyntax.Node_Name(body);
  const symbol = symbolForName(context, name);
  const declaration = symbol
    ? context.checker
        .getSymbolDeclarations(symbol)
        .find((candidate): candidate is TstsNode => candidate !== undefined)
    : undefined;
  return (
    declaration ??
    memberDeclarationByName(
      owner,
      getTstsIdentifierText(name) ?? "",
      targetKind
    )
  );
};

const attributeTargetSpecifier = (
  context: CheckedContext,
  node: TstsNode | undefined
): SourceAttributeTargetSpecifier | undefined => {
  const expression = unwrapParenthesizedExpression(node);
  if (!expression) return undefined;
  if (expression.Kind === TstsSyntax.KindStringLiteral) {
    const text = TstsSyntax.AsStringLiteral(expression)?.Text;
    return isSourceAttributeTargetSpecifier(text) ? text : undefined;
  }
  if (expression.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return undefined;
  }
  const receiver = TstsSyntax.Node_Expression(expression);
  const marker = receiver
    ? context.facts.get(markerApiSemanticsFactKey, receiver)
    : undefined;
  if (marker?.kind !== "attribute-targets") return undefined;
  const text = getTstsIdentifierText(TstsSyntax.Node_Name(expression));
  return isSourceAttributeTargetSpecifier(text) ? text : undefined;
};

const isSourceAttributeTargetSpecifier = (
  value: string | undefined
): value is SourceAttributeTargetSpecifier =>
  value === "assembly" ||
  value === "module" ||
  value === "type" ||
  value === "method" ||
  value === "property" ||
  value === "field" ||
  value === "event" ||
  value === "param" ||
  value === "return";

const parseAttributeBuilderTarget = (
  context: CheckedContext,
  node: TstsNode | undefined,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): AttributeBuilderTarget | undefined => {
  const expression = unwrapParenthesizedExpression(node);
  if (!expression) return undefined;

  if (isAttributesRootCall(expression, coreLangBindingByLocalName)) {
    const typeArgument = getTstsTypeArguments(expression)[0];
    const declaration = attributeTypeTargetDeclaration(context, typeArgument);
    return declaration ? { targetKind: "type", declaration } : undefined;
  }

  if (expression.Kind === TstsSyntax.KindPropertyAccessExpression) {
    const memberName = getTstsIdentifierText(TstsSyntax.Node_Name(expression));
    const base = parseAttributeBuilderTarget(
      context,
      TstsSyntax.Node_Expression(expression),
      coreLangBindingByLocalName
    );
    if (memberName === "ctor" && base) {
      return {
        targetKind: "constructor",
        declaration: constructorDeclarationForType(base.declaration) ?? base.declaration,
        targetSpecifier: base.targetSpecifier,
      };
    }
    return base;
  }

  if (expression.Kind !== TstsSyntax.KindCallExpression) return undefined;
  const callee = TstsSyntax.Node_Expression(expression);
  if (callee?.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return undefined;
  }
  const memberName = getTstsIdentifierText(TstsSyntax.Node_Name(callee));
  const base = parseAttributeBuilderTarget(
    context,
    TstsSyntax.Node_Expression(callee),
    coreLangBindingByLocalName
  );
  if (!base) return undefined;

  const args = TstsSyntax.Node_Arguments(expression) ?? [];
  if (memberName === "target") {
    return {
      ...base,
      targetSpecifier: attributeTargetSpecifier(context, args[0]),
    };
  }
  if (memberName === "method" || memberName === "prop") {
    const targetKind = memberName === "method" ? "method" : "property";
    const declaration = selectedMemberDeclaration(
      context,
      base.declaration,
      args[0],
      targetKind
    );
    return declaration
      ? {
          targetKind,
          declaration,
          targetSpecifier: base.targetSpecifier,
        }
      : undefined;
  }
  return undefined;
};

const isAttributesAttrCall = (
  node: TstsNode,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  if (node.Kind !== TstsSyntax.KindCallExpression) return false;
  const callee = TstsSyntax.Node_Expression(node);
  if (callee?.Kind !== TstsSyntax.KindPropertyAccessExpression) return false;
  if (getTstsIdentifierText(TstsSyntax.Node_Name(callee)) !== "attr") {
    return false;
  }
  return isImportedCoreLangIdentifier(
    TstsSyntax.Node_Expression(callee),
    coreLangBindingByLocalName,
    "attributes"
  );
};

const attributeDescriptorForExpression = (
  context: CheckedContext,
  node: TstsNode | undefined
): SourceAttributeDescriptorFact | undefined => {
  if (!node) return undefined;
  const direct = context.facts.get(sourceAttributeDescriptorFactKey, node);
  if (direct) return direct;
  const symbol = symbolForName(context, node);
  const declarations = symbol ? context.checker.getSymbolDeclarations(symbol) : [];
  for (const declaration of declarations) {
    if (!declaration) continue;
    const declared = context.facts.get(
      sourceAttributeDescriptorFactKey,
      declaration
    );
    if (declared) return declared;
    const initializer = TstsSyntax.Node_Initializer(declaration);
    const initialized = initializer
      ? context.facts.get(sourceAttributeDescriptorFactKey, initializer)
      : undefined;
    if (initialized) return initialized;
  }
  return undefined;
};

const appendAttributeApplicationFact = (
  context: CheckedContext,
  target: TstsNode,
  application: SourceAttributeApplicationFact
): void => {
  const existing =
    context.facts.get(sourceAttributeApplicationsFactKey, target)
      ?.applications ?? [];
  context.facts.set(sourceAttributeApplicationsFactKey, target, {
    applications: [...existing, application],
  });
};

const collectAttributeDescriptorFacts = (
  context: CheckedContext,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): void => {
  visitTstsSubtree(context.sourceFile, (node): void => {
    if (!node || !isAttributesAttrCall(node, coreLangBindingByLocalName)) {
      return;
    }
    const args = TstsSyntax.Node_Arguments(node) ?? [];
    const attributeType = args[0];
    if (!attributeType) return;
    const descriptor: SourceAttributeDescriptorFact = {
      attributeType,
      arguments: args.slice(1).filter((arg): arg is TstsNode => arg !== undefined),
    };
    context.facts.set(sourceAttributeDescriptorFactKey, node, descriptor);
    if (
      node.Parent?.Kind === TstsSyntax.KindVariableDeclaration &&
      TstsSyntax.Node_Initializer(node.Parent) === node
    ) {
      context.facts.set(
        sourceAttributeDescriptorFactKey,
        node.Parent,
        descriptor
      );
      const name = TstsSyntax.Node_Name(node.Parent);
      if (name) {
        context.facts.set(sourceAttributeDescriptorFactKey, name, descriptor);
      }
    }
  });
};

const collectAttributeApplicationFacts = (
  context: CheckedContext,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): void => {
  visitTstsSubtree(context.sourceFile, (node): void => {
    if (!node || node.Kind !== TstsSyntax.KindCallExpression) return;
    const callee = TstsSyntax.Node_Expression(node);
    if (callee?.Kind !== TstsSyntax.KindPropertyAccessExpression) return;
    if (getTstsIdentifierText(TstsSyntax.Node_Name(callee)) !== "add") {
      return;
    }
    const target = parseAttributeBuilderTarget(
      context,
      TstsSyntax.Node_Expression(callee),
      coreLangBindingByLocalName
    );
    if (!target) return;
    const args = TstsSyntax.Node_Arguments(node) ?? [];
    const firstArg = args[0];
    if (!firstArg) return;
    const descriptor = attributeDescriptorForExpression(context, firstArg) ?? {
      attributeType: firstArg,
      arguments: args.slice(1).filter((arg): arg is TstsNode => arg !== undefined),
    };
    appendAttributeApplicationFact(context, target.declaration, {
      ...descriptor,
      targetKind: target.targetKind,
      targetSpecifier: target.targetSpecifier,
    });
  });
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
    const genericAliasTargets = new Map<TstsSymbol, TstsSymbol>();
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
        const targetSymbol = genericTargetSymbolForIdentifier(
          context,
          initializer,
          genericSymbols,
          genericAliasTargets
        );
        if (!targetSymbol) {
          continue;
        }
        const symbol = symbolForName(context, TstsSyntax.Node_Name(declaration));
        if (symbol && !genericSymbols.has(symbol)) {
          genericSymbols.add(symbol);
          genericAliasTargets.set(symbol, targetSymbol);
          addedGenericAlias = true;
        }
      }
    }

    for (const declaration of variableDeclarations) {
      const symbol = symbolForName(context, TstsSyntax.Node_Name(declaration));
      const targetSymbol = symbol ? genericAliasTargets.get(symbol) : undefined;
      if (!targetSymbol) continue;
      context.facts.set(genericFunctionAliasFactKey, declaration, {
        resolvedName: context.checker.getSymbolName(targetSymbol),
      });
    }

    collectAttributeDescriptorFacts(context, coreLangBindingByLocalName);
    collectAttributeApplicationFacts(context, coreLangBindingByLocalName);

    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node) return;

      setDeclarationBindingFacts(context, node);

      if (TstsSyntax.IsIdentifier(node)) {
        const symbol = symbolForName(context, node);
        const bindingFact = setSourceBindingIdentityFact(context, node, symbol);
        if (!bindingFact) {
          setSourceRuntimeVisibilityFact(
            context,
            node,
            sourceRuntimeVisibilityFactForUnboundName(
              getTstsIdentifierText(node)
            )
          );
        }
        const targetSymbol = symbol ? genericAliasTargets.get(symbol) : undefined;
        if (targetSymbol) {
          context.facts.set(genericFunctionAliasFactKey, node, {
            resolvedName: context.checker.getSymbolName(targetSymbol),
          });
        }
      }

      if (
        node.Kind === TstsSyntax.KindTypeReference ||
        node.Kind === TstsSyntax.KindExpressionWithTypeArguments
      ) {
        const symbol =
          context.checker.getSymbolAtLocation(node) ??
          symbolForName(context, TstsSyntax.Node_Name(node));
        const bindingFact = setSourceBindingIdentityFact(
          context,
          node,
          symbol ? context.checker.resolveAlias(symbol) : undefined
        );
        if (!bindingFact) {
          const typeReference = getTstsTypeReferenceDetails(node);
          setSourceRuntimeVisibilityFact(
            context,
            node,
            sourceRuntimeVisibilityFactForUnboundName(
              typeReference?.name ?? getTstsExpressionWithTypeArgumentsName(node)
            )
          );
        }
      }

      const computedName =
        node.Kind === TstsSyntax.KindComputedPropertyName
          ? isWellKnownSymbolName(context, node, sourceDiagnosticFileNames)
          : undefined;
      if (computedName) {
        context.facts.set(wellKnownComputedNameFactKey, node, {
          kind: computedName,
        });
      }

      const expressionKind = expressionSemanticsKind(
        context,
        node,
        sourceDiagnosticFileNames
      );
      if (expressionKind) {
        context.facts.set(expressionSemanticsFactKey, node, {
          kind: expressionKind,
        });
      }

      const runtimeOperation = sourceRuntimeOperation(
        context,
        node,
        sourceDiagnosticFileNames
      );
      if (runtimeOperation) {
        context.facts.set(sourceRuntimeOperationFactKey, node, runtimeOperation);
      }
    });

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
        if (
          !functionParent ||
          overloadCountForFunctionLike(functionParent, functionDeclarationCounts) <=
            1
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
        const inCompileTimeMarkerExpression = parents.some((parent) =>
          isCompileTimeMarkerApiExpression(parent, context)
        );
        if (
          !parameterType &&
          !inCompileTimeMarkerExpression &&
          !contextualType &&
          !parameterHasCheckerProvenType(context, node) &&
          !parameterHasContextualSignatureType(context, node)
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
        const callee = TstsSyntax.Node_Expression(node);
        if (callee?.Kind === TstsSyntax.KindImportKeyword) {
          addSourceDiagnostic(
            context,
            "TSN2001",
            node,
            "Dynamic import is not supported."
          );
        }
        if (isIdentifierNamed(callee, "Array")) {
          addSourceDiagnostic(
            context,
            "TSN2001",
            node,
            "Array constructor inference is not supported; use an array literal or explicit collection type."
          );
        }
        if (isPropertyAccessNamed(callee, "Array", "isArray")) {
          const [argument] = call?.arguments ?? [];
          const argumentType = context.checker.getTypeAtLocation(argument);
          if (
            argumentType &&
            context.checker.isUnknownType(argumentType) &&
            nodeHasAncestorKind(parents, TstsSyntax.KindIfStatement)
          ) {
            addSourceDiagnostic(
              context,
              "TSN5001",
              node,
              "Array.isArray cannot narrow a broad runtime value.",
              { capabilityFeatureKey: "broad-array-narrowing" }
            );
          }
        }
        if (isPropertyAccessNamed(callee, "JSON", "parse")) {
          const explicitTypeArguments = getTstsTypeArguments(node);
          const resultContext = context.checker.getContextualType(node);
          const resultType =
            explicitTypeArguments.length > 0
              ? context.checker.getTypeFromTypeNode(explicitTypeArguments[0])
              : resultContext;
          if (isBroadJsonType(context.checker, resultType)) {
            addSourceDiagnostic(
              context,
              "TSN5001",
              node,
              "JSON.parse target must be a concrete DTO or JsValue carrier.",
              { capabilityFeatureKey: "broad-json-targets" }
            );
          }
        }
        if (isPropertyAccessNamed(callee, "JSON", "stringify")) {
          const [argument] = call?.arguments ?? [];
          const argumentType = context.checker.getTypeAtLocation(argument);
          if (isBroadJsonType(context.checker, argumentType)) {
            addSourceDiagnostic(
              context,
              "TSN5001",
              node,
              "JSON.stringify source must be a concrete DTO, closed object literal, or JsValue carrier.",
              { capabilityFeatureKey: "broad-json-stringify-source" }
            );
          }
        }
      }

      if (node.Kind === TstsSyntax.KindBinaryExpression) {
        const binary = TstsSyntax.AsBinaryExpression(node);
        if (binary?.OperatorToken?.Kind === TstsSyntax.KindInKeyword) {
          const rightType = context.checker.getTypeAtLocation(binary.Right);
          if (!isClosedStructuralUnionType(context.checker, rightType)) {
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
        if (!isAllowedDictionaryKeyTypeNode(keyType)) {
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
        if (!isAllowedDictionaryKeyTypeNode(keyType)) {
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
        isIdentifierNamed(TstsSyntax.Node_Expression(node), "arguments") &&
        !parents.some((parent) => isCompileTimeMarkerApiExpression(parent, context))
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
        nearestObjectLiteralMethodParent(parents) &&
        !parents.some((parent) => isCompileTimeMarkerApiExpression(parent, context))
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

    },
  };
};
