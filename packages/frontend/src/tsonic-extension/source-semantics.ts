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
  getTstsContainingSourceFile,
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
import type { FeatureKey } from "../capabilities/backend-capabilities.js";
import { hasExternalBindingDeclaration } from "../program/external-binding-source-identity.js";
import { sourceFileBelongsToPackage } from "../program/package-identity.js";
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
  SourceCallArgumentTypesFact,
  SourceDeclarationTypeProjectionFact,
  SourceBindingProjectedObjectMember,
  SourceBindingIdentityFact,
  SourceBindingProjectedType,
  SourceDictionaryTypeFact,
  SourceIntrinsicTypeName,
  SourceOverloadFamilyFact,
  SourceOverloadCallImplementationFact,
  SourceProjectedDeclarationKind,
  SourceRuntimeVisibilityFact,
  SourceRuntimeOperationOwner,
  SourceRuntimeOperationFact,
  SourceParameterTypeProjection,
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
  numericPrimitiveFactKey,
  parameterPassingFactKey,
  sourceAttributeApplicationsFactKey,
  sourceAttributeDescriptorFactKey,
  sourceBindingIdentityFactKey,
  sourceBindingTypeProjectionFactKey,
  sourceCallArgumentTypesFactKey,
  sourceDeclarationTypeProjectionFactKey,
  sourceDictionaryTypeFactKey,
  sourceExpressionTypeProjectionFactKey,
  sourceInitializerReferencesDeclarationFactKey,
  sourceOverloadFamilyFactKey,
  sourceOverloadCallImplementationFactKey,
  sourceRuntimeVisibilityFactKey,
  sourceRuntimeOperationFactKey,
  sourceTypeNodeProjectionFactKey,
  sourceTypeSemanticsFactKey,
  extensionReceiverSemanticsFactKey,
  heritageWrapperSemanticsFactKey,
  wellKnownComputedNameFactKey,
} from "../source-frontend/source-facts.js";

const fieldFact: FieldSemanticsFact = { storage: "field" };
const extensionReceiverFact = { kind: "extension-receiver" } as const;
const interfaceHeritageFact = { kind: "interface-erasure" } as const;
const recordDictionaryFact: SourceDictionaryTypeFact = { kind: "record" };

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

const isExternalSupportDeclaration = (
  declaration: TstsNode | undefined,
  sourceDiagnosticRoots: readonly string[]
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
  if (!isSourceDiagnosticFile(fileName, sourceDiagnosticRoots)) {
    return true;
  }
  return isDependencySupportSourceFile(fileName);
};

const isAmbientGlobalIdentifier = (
  context: CheckedContext,
  node: TstsNode | undefined,
  name: string,
  sourceDiagnosticRoots: readonly string[]
): boolean => {
  if (!isIdentifierNamed(node, name)) return false;
  if (context.imports.resolveLocalName(name)) return false;
  const symbol = symbolForName(context, node);
  if (!symbol) return true;
  const declarations = context.checker.getSymbolDeclarations(symbol);
  return (
    declarations.length === 0 ||
    declarations.every((declaration) =>
      isExternalSupportDeclaration(declaration, sourceDiagnosticRoots)
    )
  );
};

const isAmbientGlobalPropertyAccess = (
  context: CheckedContext,
  node: TstsNode | undefined,
  receiverName: string,
  memberName: string,
  sourceDiagnosticRoots: readonly string[]
): boolean =>
  node?.Kind === TstsSyntax.KindPropertyAccessExpression &&
  isIdentifierNamed(TstsSyntax.Node_Name(node), memberName) &&
  isAmbientGlobalIdentifier(
    context,
    TstsSyntax.Node_Expression(node),
    receiverName,
    sourceDiagnosticRoots
  );

const isWellKnownSymbolName = (
  context: CheckedContext,
  node: TstsNode | undefined,
  sourceDiagnosticRoots: readonly string[]
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
      sourceDiagnosticRoots
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
  sourceDiagnosticRoots: readonly string[]
): "undefined-value" | undefined =>
  isAmbientGlobalIdentifier(context, node, "undefined", sourceDiagnosticRoots)
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
  sourceDiagnosticRoots: readonly string[]
): SourceRuntimeOperationFact | undefined => {
  const memberName = getTstsIdentifierText(node);
  if (!memberName) return undefined;
  const owner = ambientRuntimeConstructors.get(memberName);
  return owner &&
    isAmbientGlobalIdentifier(
      context,
      node,
      memberName,
      sourceDiagnosticRoots
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

const sourceRuntimeOwnerFromResolvedMemberDeclaration = (
  context: CheckedContext,
  node: TstsNode
): SourceRuntimeOperationOwner | undefined => {
  if (node.Kind !== TstsSyntax.KindPropertyAccessExpression) return undefined;
  const name = TstsSyntax.Node_Name(node);
  const symbol = name ? context.checker.getSymbolAtLocation(name) : undefined;
  if (!symbol) return undefined;
  const owners = new Set<SourceRuntimeOperationOwner>();
  for (const declaration of context.checker.getSymbolDeclarations(symbol)) {
    if (!declaration) continue;
    const owner = declaration.Parent;
    const ownerName = getTstsNodeNameText(owner);
    const sourceFile = getTstsContainingSourceFile(owner);
    if (
      !sourceFile ||
      !sourceFileBelongsToPackage(sourceFile.FileName(), "@tsonic/js")
    ) {
      continue;
    }
    switch (ownerName) {
      case "Array":
      case "ReadonlyArray":
        owners.add("Array");
        break;
      case "String":
        owners.add("String");
        break;
      case "Map":
      case "ReadonlyMap":
        owners.add("Map");
        break;
      case "Function":
        owners.add("Function");
        break;
      case "Error":
        owners.add("Error");
        break;
    }
  }
  return owners.size === 1 ? [...owners][0] : undefined;
};

const sourceRuntimeOperationFromResolvedMemberOwner = (
  owner: SourceRuntimeOperationOwner | undefined,
  memberName: string
): SourceRuntimeOperationFact | undefined => {
  if (!owner) return undefined;
  if (owner === "String") {
    if (memberName === "length") {
      return { owner: "String", member: "length", dispatch: "property" };
    }
    return stringReceiverRuntimeMembers.has(memberName)
      ? { owner: "String", member: memberName, dispatch: "receiver-call" }
      : undefined;
  }
  if (owner === "Array") {
    if (memberName === "length") {
      return { owner: "Array", member: "length", dispatch: "property" };
    }
    return arrayReceiverRuntimeMembers.has(memberName)
      ? { owner: "Array", member: memberName, dispatch: "receiver-call" }
      : undefined;
  }
  if (owner === "Map") {
    return mapReceiverRuntimeMembers.has(memberName)
      ? { owner: "Map", member: memberName, dispatch: "receiver-call" }
      : undefined;
  }
  if (owner === "Function" && memberName === "length") {
    return { owner: "Function", member: "length", dispatch: "property" };
  }
  if (owner === "Error" && memberName === "message") {
    return { owner: "Error", member: "message", dispatch: "property" };
  }
  return undefined;
};

const sourceRuntimeOperation = (
  context: CheckedContext,
  node: TstsNode,
  sourceDiagnosticRoots: readonly string[]
): SourceRuntimeOperationFact | undefined => {
  if (node.Kind === TstsSyntax.KindElementAccessExpression) {
    const receiver = TstsSyntax.Node_Expression(node);
    const argument = TstsSyntax.AsElementAccessExpression(node)?.ArgumentExpression;
    const computedName = isWellKnownSymbolName(
      context,
      argument,
      sourceDiagnosticRoots
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
      sourceDiagnosticRoots
    );
  }

  if (node.Kind === TstsSyntax.KindIdentifier) {
    if (
      node.Parent?.Kind === TstsSyntax.KindNewExpression &&
      TstsSyntax.Node_Expression(node.Parent) === node
    ) {
      return undefined;
    }

    const constructorOperation = runtimeConstructorOperationForIdentifier(
      context,
      node,
      sourceDiagnosticRoots
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
        sourceDiagnosticRoots
      )
    ) {
      return { owner: "String", member: "coerce", dispatch: "static-call" };
    }
    return globalRuntimeMembers.has(memberName) &&
      isAmbientGlobalIdentifier(
        context,
        node,
        memberName,
        sourceDiagnosticRoots
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
      sourceDiagnosticRoots
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
      sourceDiagnosticRoots
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
      sourceDiagnosticRoots
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
      sourceDiagnosticRoots
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
      sourceDiagnosticRoots
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
      sourceDiagnosticRoots
    ) &&
    promiseStaticRuntimeMembers.has(memberName)
  ) {
    return { owner: "Promise", member: memberName, dispatch: "static-call" };
  }

  const resolvedMemberOperation = sourceRuntimeOperationFromResolvedMemberOwner(
    sourceRuntimeOwnerFromResolvedMemberDeclaration(context, node),
    memberName
  );
  if (resolvedMemberOperation) return resolvedMemberOperation;

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
  sourceFileBelongsToPackage(fileName, "@tsonic/core");

const isDependencySupportSourceFile = (fileName: string): boolean => {
  const normalized = fileName.replace(/\\/g, "/");
  return (
    normalized.includes("/node_modules/") || normalized.includes("/type-roots/")
  );
};

const normalizeSourceFileName = (fileName: string): string =>
  path.resolve(fileName).replace(/\\/g, "/");

const normalizeSourceDiagnosticRoots = (
  roots: readonly string[]
): readonly string[] => roots.map((root) => normalizeSourceFileName(root));

const isSourceDiagnosticFile = (
  fileName: string,
  sourceDiagnosticRoots: readonly string[]
): boolean => {
  const normalizedFileName = normalizeSourceFileName(fileName);
  return sourceDiagnosticRoots.some((root) => {
    const relative = path.relative(root, normalizedFileName);
    return (
      relative === "" ||
      (!relative.startsWith("..") && !path.isAbsolute(relative))
    );
  });
};

const nodeHasAncestorKind = (
  parents: readonly TstsNode[],
  kind: number
): boolean => parents.some((parent) => parent.Kind === kind);

const isCoreJsValueTypeNode = (
  node: TstsNode | undefined,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean =>
  importedTypeReferenceName(node, coreTypesBindingByLocalName) === "JsValue";

const typeResolvesToCoreJsValue = (
  checker: CheckedContext["checker"],
  type: TstsType | undefined
): boolean => {
  if (!type) return false;
  const symbol = checker.getTypeAliasOrSymbol(type);
  if (!symbol) return false;
  return checker.getSymbolDeclarations(symbol).some((declaration) => {
    const sourceFile = getTstsContainingSourceFile(declaration);
    return (
      getTstsNodeNameText(declaration) === "JsValue" &&
      sourceFile !== undefined &&
      isCorePackageSourceFile(sourceFile.FileName())
    );
  });
};

const isJsValueCarrier = (
  checker: CheckedContext["checker"],
  type: TstsType | undefined,
  typeNode: TstsNode | undefined,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean =>
  isCoreJsValueTypeNode(typeNode, coreTypesBindingByLocalName) ||
  typeResolvesToCoreJsValue(checker, type);

const declaredTypeNodeForExpression = (
  context: CheckedContext,
  expression: TstsNode | undefined
): TstsNode | undefined => {
  const parent = expression?.Parent;
  if (
    parent?.Kind === TstsSyntax.KindVariableDeclaration &&
    TstsSyntax.Node_Initializer(parent) === expression
  ) {
    return getTstsDeclaredTypeNode(parent);
  }
  if (TstsSyntax.IsIdentifier(expression)) {
    const shorthandValueSymbol =
      parent?.Kind === TstsSyntax.KindShorthandPropertyAssignment
        ? context.checker.getShorthandAssignmentValueSymbol(parent)
        : undefined;
    const symbol =
      shorthandValueSymbol ?? context.checker.getSymbolAtLocation(expression);
    const resolved = symbol ? context.checker.resolveAlias(symbol) : undefined;
    const valueDeclaration = resolved
      ? context.checker.getSymbolValueDeclaration(resolved)
      : undefined;
    return getTstsDeclaredTypeNode(valueDeclaration);
  }
  return undefined;
};

const hasDictionaryIndexShape = (
  checker: CheckedContext["checker"],
  type: TstsType | undefined
): boolean =>
  checker.getStringIndexType(type) !== undefined ||
  (!checker.isArrayType(type) && checker.getNumberIndexType(type) !== undefined);

const isBroadJsonType = (
  checker: CheckedContext["checker"],
  type: TstsType | undefined,
  typeNode: TstsNode | undefined,
  coreTypesBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): boolean => {
  if (!type || isJsValueCarrier(checker, type, typeNode, coreTypesBindingByLocalName)) {
    return false;
  }
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

const typeReferenceNameNode = (node: TstsNode): TstsNode | undefined =>
  TstsSyntax.AsTypeReferenceNode(node)?.TypeName ??
  TstsSyntax.AsExpressionWithTypeArguments(node)?.Expression ??
  TstsSyntax.Node_Name(node);

const symbolForTypeReference = (
  context: CheckedContext,
  node: TstsNode
): TstsSymbol | undefined => symbolForName(context, typeReferenceNameNode(node));

const singleDeclaration = (
  declarations: readonly (TstsNode | undefined)[],
  predicate: (declaration: TstsNode) => boolean
): TstsNode | undefined => {
  const matches = declarations
    .filter((declaration): declaration is TstsNode => declaration !== undefined)
    .filter(predicate);
  return matches.length === 1 ? matches[0] : undefined;
};

type SourceBindingAccessSegment =
  | {
      readonly kind: "element";
      readonly index: number;
    }
  | {
      readonly kind: "property";
      readonly name: string;
    };

type SourceTypeSubstitutionMap = ReadonlyMap<string, SourceBindingProjectedType>;

const emptySourceTypeSubstitutions: SourceTypeSubstitutionMap = new Map();

const bindingPatternPropertyName = (
  propertyName: TstsNode | undefined,
  nameNode: TstsNode | undefined,
  index: number
): string | undefined =>
  propertyName
    ? getTstsIdentifierText(propertyName) ??
      getTstsNodeNameText(propertyName) ??
      getTstsNodeText(propertyName)
    : getTstsIdentifierText(nameNode) ??
      getTstsNodeNameText(nameNode) ??
      (nameNode === undefined ? `item${index}` : undefined);

const projectedTypeKey = (
  type: SourceBindingProjectedType,
  seen: ReadonlySet<SourceBindingProjectedType> = new Set()
): string => {
  if (seen.has(type)) return "cycle";
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  switch (type.kind) {
    case "type-node":
      return `node:${type.node.Kind}:${getTstsNodeText(type.node) ?? getTstsNodeNameText(type.node) ?? ""}`;
    case "intrinsic":
      return `intrinsic:${type.name}`;
    case "source-primitive":
      return `source-primitive:${type.fact.kind}:${type.fact.sourceName}`;
    case "named":
      return `named:${type.name}<${type.typeArguments.map((argument) => projectedTypeKey(argument, nextSeen)).join(",")}>:${type.declarationKind ?? ""}:${type.aliasTarget ? projectedTypeKey(type.aliasTarget, nextSeen) : ""}`;
    case "record":
      return `record:${projectedTypeKey(type.keyType, nextSeen)}:${projectedTypeKey(type.valueType, nextSeen)}`;
    case "function":
      return `function:<${type.typeParameters.join(",")}>(${type.parameters.map((parameter) => `${parameter.name}:${parameter.optional}:${parameter.rest}:${parameter.type ? projectedTypeKey(parameter.type, nextSeen) : ""}`).join(",")}):${type.returnType ? projectedTypeKey(type.returnType, nextSeen) : ""}`;
    case "array":
      return `array:${type.readonly}:${projectedTypeKey(type.elementType, nextSeen)}`;
    case "tuple":
      return `tuple:${type.readonly}:${type.elements.map((element) => projectedTypeKey(element, nextSeen)).join(",")}`;
    case "object":
      return `object:${type.members
        .map(
          (member) =>
            `${member.name}:${member.optional}:${member.type ? projectedTypeKey(member.type, nextSeen) : "unknown"}`
        )
        .sort()
        .join(",")}`;
    case "union":
      return `union:${type.types.map((member) => projectedTypeKey(member, nextSeen)).sort().join("|")}`;
    case "intersection":
      return `intersection:${type.types.map((member) => projectedTypeKey(member, nextSeen)).sort().join("&")}`;
  }
};

const uniqueProjectedTypes = (
  types: readonly (SourceBindingProjectedType | undefined)[]
): readonly SourceBindingProjectedType[] => {
  const result: SourceBindingProjectedType[] = [];
  const namedAliasTargetKey = (
    type: SourceBindingProjectedType
  ): string | undefined =>
    type.kind === "named" && type.aliasTarget
      ? projectedTypeKey(type.aliasTarget)
      : undefined;
  for (const type of types) {
    if (!type) continue;
    const key = projectedTypeKey(type);
    if (result.some((item) => projectedTypeKey(item) === key)) continue;
    const aliasTargetKey = namedAliasTargetKey(type);
    if (aliasTargetKey) {
      const existingTargetIndex = result.findIndex(
        (item) =>
          item.kind !== "named" && projectedTypeKey(item) === aliasTargetKey
      );
      if (existingTargetIndex >= 0) {
        result[existingTargetIndex] = type;
        continue;
      }
    } else if (
      result.some((item) => namedAliasTargetKey(item) === key)
    ) {
      continue;
    }
    result.push(type);
  }
  return result;
};

const combinedProjectedType = (
  kind: "union" | "intersection",
  types: readonly (SourceBindingProjectedType | undefined)[],
  sourceNode?: TstsNode
): SourceBindingProjectedType | undefined => {
  const unique = uniqueProjectedTypes(
    kind === "union"
      ? types.flatMap((type) =>
          type?.kind === "union" ? type.types : type ? [type] : []
        )
      : types
  );
  if (unique.length === 0) return undefined;
  if (unique.length === 1) return unique[0];
  return kind === "union"
    ? { kind: "union", types: unique, sourceNode }
    : { kind: "intersection", types: unique, sourceNode };
};

const isNullishProjection = (type: SourceBindingProjectedType): boolean =>
  type.kind === "intrinsic" && (type.name === "null" || type.name === "undefined");

const nonNullishProjection = (
  type: SourceBindingProjectedType | undefined,
  sourceNode?: TstsNode
): SourceBindingProjectedType | undefined => {
  if (!type) return undefined;
  if (isNullishProjection(type)) return undefined;
  if (type.kind !== "union") return type;
  return combinedProjectedType(
    "union",
    type.types.filter((member) => !isNullishProjection(member)),
    sourceNode
  );
};

const projectionUnionMembers = (
  type: SourceBindingProjectedType | undefined
): readonly SourceBindingProjectedType[] => {
  if (!type) return [];
  if (type.kind === "union") return type.types.filter((member) => !isNullishProjection(member));
  if (type.kind === "named" && type.aliasTarget?.kind === "union") {
    return type.aliasTarget.types.filter((member) => !isNullishProjection(member));
  }
  return [type];
};

const projectionAssignableTo = (
  source: SourceBindingProjectedType | undefined,
  target: SourceBindingProjectedType | undefined,
  seen: ReadonlySet<string> = new Set()
): boolean => {
  if (!source || !target) return false;
  if (projectedTypeKey(source) === projectedTypeKey(target)) return true;
  const key = `${projectedTypeKey(source)}=>${projectedTypeKey(target)}`;
  if (seen.has(key)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(key);
  const targetMembers = projectionUnionMembers(target);
  if (targetMembers.length > 1) {
    return targetMembers.some((member) =>
      projectionAssignableTo(source, member, nextSeen)
    );
  }
  if (
    source.kind === "named" &&
    source.aliasTarget &&
    projectionAssignableTo(source.aliasTarget, target, nextSeen)
  ) {
    return true;
  }
  if (
    target.kind === "named" &&
    target.aliasTarget &&
    projectionAssignableTo(source, target.aliasTarget, nextSeen)
  ) {
    return true;
  }
  return false;
};

const callableProjectionTarget = (
  type: SourceBindingProjectedType | undefined
): SourceBindingProjectedType | undefined => {
  if (!type) return undefined;
  if (type.kind === "function") return type;
  return type.kind === "named" && type.aliasTarget?.kind === "function"
    ? type.aliasTarget
    : undefined;
};

const isCallableProjection = (
  type: SourceBindingProjectedType | undefined
): boolean => callableProjectionTarget(type) !== undefined;

const isBroadProjection = (
  type: SourceBindingProjectedType | undefined
): boolean =>
  type?.kind === "intrinsic" &&
  (type.name === "any" || type.name === "unknown" || type.name === "object");

const declaredArmForNarrowedProjection = (
  declared: SourceBindingProjectedType | undefined,
  narrowed: SourceBindingProjectedType | undefined
): SourceBindingProjectedType | undefined => {
  if (!declared || !narrowed) return narrowed ?? declared;
  if (projectedTypeKey(declared) === projectedTypeKey(narrowed)) return declared;
  if (isBroadProjection(narrowed)) return declared;
  const arms = projectionUnionMembers(declared);
  const matches = arms.filter((arm) => projectionAssignableTo(narrowed, arm));
  if (matches.length === 1) return matches[0];
  if (isCallableProjection(narrowed)) {
    const callableArms = arms.filter(isCallableProjection);
    if (callableArms.length === 1) return callableArms[0];
  }
  return projectionAssignableTo(narrowed, declared) ? declared : narrowed;
};

type TypeofFunctionGuard = {
  readonly expression: TstsNode | undefined;
  readonly trueBranchIsCallable: boolean;
};

const stringLiteralText = (node: TstsNode | undefined): string | undefined =>
  node?.Kind === TstsSyntax.KindStringLiteral
    ? TstsSyntax.AsStringLiteral(node)?.Text
    : undefined;

const typeofFunctionGuard = (
  node: TstsNode | undefined
): TypeofFunctionGuard | undefined => {
  const binary = TstsSyntax.AsBinaryExpression(node);
  if (!binary) return undefined;
  const leftIsTypeof = binary.Left?.Kind === TstsSyntax.KindTypeOfExpression;
  const rightIsTypeof = binary.Right?.Kind === TstsSyntax.KindTypeOfExpression;
  const typeofNode = leftIsTypeof ? binary.Left : rightIsTypeof ? binary.Right : undefined;
  const literal = leftIsTypeof
    ? stringLiteralText(binary.Right)
    : rightIsTypeof
      ? stringLiteralText(binary.Left)
      : undefined;
  if (!typeofNode || literal !== "function") return undefined;
  const operatorKind = binary.OperatorToken?.Kind;
  if (
    operatorKind !== TstsSyntax.KindEqualsEqualsEqualsToken &&
    operatorKind !== TstsSyntax.KindEqualsEqualsToken &&
    operatorKind !== TstsSyntax.KindExclamationEqualsEqualsToken &&
    operatorKind !== TstsSyntax.KindExclamationEqualsToken
  ) {
    return undefined;
  }
  const trueBranchIsCallable =
    operatorKind === TstsSyntax.KindEqualsEqualsEqualsToken ||
    operatorKind === TstsSyntax.KindEqualsEqualsToken;
  return {
    expression: TstsSyntax.Node_Expression(typeofNode),
    trueBranchIsCallable,
  };
};

const sameResolvedSymbol = (
  context: CheckedContext,
  left: TstsNode | undefined,
  right: TstsNode | undefined
): boolean => {
  if (!left || !right) return false;
  const leftSymbol = context.checker.resolveAlias(
    context.checker.getSymbolAtLocation(left)
  );
  const rightSymbol = context.checker.resolveAlias(
    context.checker.getSymbolAtLocation(right)
  );
  return leftSymbol !== undefined && leftSymbol === rightSymbol;
};

const singleCallableArmForExpression = (
  context: CheckedContext,
  expression: TstsNode | undefined
): SourceBindingProjectedType | undefined => {
  const declared = declaredProjectionForExpression(context, expression);
  const callableArms = projectionUnionMembers(declared).filter(isCallableProjection);
  return callableArms.length === 1 ? callableArms[0] : undefined;
};

const sourceTypeParameterNames = (
  node: TstsNode | undefined
): readonly string[] =>
  node
    ? getTstsTypeParameterNodes(node)
        .map((typeParameter) => getTstsNodeNameText(typeParameter))
        .filter((name): name is string => name !== undefined && name.length > 0)
    : [];

const intrinsicProjectionFromTypeNode = (
  node: TstsNode
): SourceBindingProjectedType | undefined => {
  switch (node.Kind) {
    case TstsSyntax.KindAnyKeyword:
      return intrinsicProjection("any");
    case TstsSyntax.KindUnknownKeyword:
      return intrinsicProjection("unknown");
    case TstsSyntax.KindVoidKeyword:
      return intrinsicProjection("void");
    case TstsSyntax.KindNeverKeyword:
      return intrinsicProjection("never");
    case TstsSyntax.KindUndefinedKeyword:
      return intrinsicProjection("undefined");
    case TstsSyntax.KindNullKeyword:
      return intrinsicProjection("null");
    case TstsSyntax.KindStringKeyword:
      return intrinsicProjection("string");
    case TstsSyntax.KindNumberKeyword:
      return intrinsicProjection("number");
    case TstsSyntax.KindBooleanKeyword:
      return intrinsicProjection("boolean");
    case TstsSyntax.KindBigIntKeyword:
      return intrinsicProjection("bigint");
    case TstsSyntax.KindSymbolKeyword:
      return intrinsicProjection("symbol");
    case TstsSyntax.KindObjectKeyword:
      return intrinsicProjection("object");
    case TstsSyntax.KindThisType:
      return intrinsicProjection("this");
    default:
      return undefined;
  }
};

const mergeTypeReferenceSubstitutions = (
  context: CheckedContext,
  typeReferenceNode: TstsNode,
  declaration: TstsNode,
  substitutions: SourceTypeSubstitutionMap,
  seen: Set<TstsNode>,
  checkerState: CheckerTypeProjectionState = createCheckerTypeProjectionState()
): SourceTypeSubstitutionMap => {
  const parameters = sourceTypeParameterNames(declaration);
  const argumentsList = getTstsTypeArguments(typeReferenceNode);
  if (parameters.length === 0 || argumentsList.length === 0) {
    return substitutions;
  }
  const merged = new Map(substitutions);
  parameters.forEach((parameter, index) => {
    const argument = argumentsList[index];
    const projected = projectedTypeFromTypeNode(
      context,
      argument,
      substitutions,
      seen,
      checkerState
    );
    if (projected) merged.set(parameter, projected);
  });
  return merged;
};

const projectedTypeFromTypeNode = (
  context: CheckedContext,
  node: TstsNode | undefined,
  substitutions: SourceTypeSubstitutionMap = emptySourceTypeSubstitutions,
  seen: Set<TstsNode> = new Set(),
  checkerState: CheckerTypeProjectionState = createCheckerTypeProjectionState()
): SourceBindingProjectedType | undefined => {
  if (!node) return undefined;
  const typeReference = getTstsTypeReferenceDetails(node);
  if (typeReference && typeReference.typeArguments.length === 0) {
    const replacement = substitutions.get(typeReference.name);
    if (replacement) return replacement;
  }
  const numericPrimitive = context.facts.get(numericPrimitiveFactKey, node);
  if (numericPrimitive) {
    return { kind: "source-primitive", fact: numericPrimitive, sourceNode: node };
  }
  if (seen.has(node)) return undefined;
  seen.add(node);
  try {
    switch (node.Kind) {
      case TstsSyntax.KindParenthesizedType:
        return projectedTypeFromTypeNode(
          context,
          TstsSyntax.AsParenthesizedTypeNode(node)?.Type,
          substitutions,
          seen,
          checkerState
        );
      case TstsSyntax.KindTypeOperator: {
        const typeOperator = TstsSyntax.AsTypeOperatorNode(node);
        const projected = projectedTypeFromTypeNode(
          context,
          typeOperator?.Type,
          substitutions,
          seen,
          checkerState
        );
        if (
          typeOperator?.Operator !== TstsSyntax.KindReadonlyKeyword ||
          !projected
        ) {
          return projected;
        }
        if (projected.kind === "array" || projected.kind === "tuple") {
          return { ...projected, readonly: true, sourceNode: node };
        }
        return projected;
      }
      case TstsSyntax.KindArrayType: {
        const arrayType = TstsSyntax.AsArrayTypeNode(node);
        const elementType = projectedTypeFromTypeNode(
          context,
          arrayType?.ElementType,
          substitutions,
          seen,
          checkerState
        );
        return elementType
          ? { kind: "array", elementType, readonly: false, sourceNode: node }
          : undefined;
      }
      case TstsSyntax.KindTupleType: {
        const tupleType = TstsSyntax.AsTupleTypeNode(node);
        return {
          kind: "tuple",
          elements: (tupleType?.Elements?.Nodes ?? [])
            .map((element) =>
              projectedTypeFromTypeNode(
                context,
                TstsSyntax.Node_Type(element) ?? element,
                substitutions,
                seen,
                checkerState
              )
            )
            .filter(
              (element): element is SourceBindingProjectedType =>
                element !== undefined
            ),
          readonly: false,
          sourceNode: node,
        };
      }
      case TstsSyntax.KindUnionType: {
        const unionType = TstsSyntax.AsUnionTypeNode(node);
        return combinedProjectedType(
          "union",
          (unionType?.Types?.Nodes ?? []).map((part) =>
            projectedTypeFromTypeNode(
              context,
              part,
              substitutions,
              seen,
              checkerState
            )
          ),
          node
        );
      }
      case TstsSyntax.KindIntersectionType: {
        const intersectionType = TstsSyntax.AsIntersectionTypeNode(node);
        return combinedProjectedType(
          "intersection",
          (intersectionType?.Types?.Nodes ?? []).map((part) =>
            projectedTypeFromTypeNode(
              context,
              part,
              substitutions,
              seen,
              checkerState
            )
          ),
          node
        );
      }
      case TstsSyntax.KindTypeReference:
      case TstsSyntax.KindExpressionWithTypeArguments:
        return projectedNamedTypeFromTypeReference(
          context,
          node,
          typeReference,
          substitutions,
          seen,
          checkerState
        );
      case TstsSyntax.KindFunctionType:
      case TstsSyntax.KindConstructorType:
        return {
          kind: "function",
          parameters: getTstsParameters(node)
            .map((parameter) => sourceParameterTypeProjection(context, parameter))
            .filter(
              (parameter): parameter is SourceParameterTypeProjection =>
                parameter !== undefined
            ),
          returnType: projectedTypeFromTypeNode(
            context,
            TstsSyntax.Node_Type(node),
            substitutions,
            seen,
            checkerState
          ),
          typeParameters: sourceTypeParameterNames(node),
          sourceNode: node,
        };
      case TstsSyntax.KindTypeLiteral:
        return {
          kind: "object",
          members: (TstsSyntax.Node_Members(node) ?? [])
            .filter((member): member is TstsNode => member !== undefined)
            .map((member) => ({
              name: getTstsNodeNameText(member) ?? "",
              optional: TstsSyntax.Node_QuestionToken(member) !== undefined,
              type: projectedTypeFromMemberDeclaration(
                context,
                member,
                substitutions,
                seen
              ),
            }))
            .filter((member) => member.name.length > 0),
          sourceNode: node,
        };
      case TstsSyntax.KindIndexedAccessType:
      case TstsSyntax.KindTypeQuery:
      case TstsSyntax.KindConditionalType:
      case TstsSyntax.KindMappedType:
      case TstsSyntax.KindImportType:
      case TstsSyntax.KindInferType:
      case TstsSyntax.KindOptionalType:
      case TstsSyntax.KindRestType:
        return checkerTypeProjection(
          context,
          context.checker.getTypeFromTypeNode(node),
          checkerState
        );
      default:
        return intrinsicProjectionFromTypeNode(node) ?? { kind: "type-node", node };
    }
  } finally {
    seen.delete(node);
  }
};

const typeReferenceDeclarations = (
  context: CheckedContext,
  node: TstsNode
): readonly TstsNode[] => {
  const symbol = symbolForTypeReference(context, node);
  const resolved = symbol ? context.checker.resolveAlias(symbol) : undefined;
  return resolved
    ? context.checker
        .getSymbolDeclarations(resolved)
        .filter((declaration): declaration is TstsNode => declaration !== undefined)
    : [];
};

const projectedTypeFromMemberDeclaration = (
  context: CheckedContext,
  member: TstsNode,
  substitutions: SourceTypeSubstitutionMap,
  seen: Set<TstsNode>,
  checkerState: CheckerTypeProjectionState = createCheckerTypeProjectionState()
): SourceBindingProjectedType | undefined => {
  const memberType = TstsSyntax.Node_Type(member);
  if (memberType) {
    return projectedTypeFromTypeNode(
      context,
      memberType,
      substitutions,
      seen,
      checkerState
    );
  }
  const name = TstsSyntax.Node_Name(member);
  const symbol = symbolForName(context, name);
  const type =
    symbol && name
      ? context.checker.getTypeOfSymbolAtLocation(symbol, name)
      : undefined;
  return checkerTypeProjection(context, type, checkerState);
};

const projectedMemberTypesFromOwner = (
  context: CheckedContext,
  owner: TstsNode,
  name: string,
  substitutions: SourceTypeSubstitutionMap,
  seen: Set<TstsNode>,
  checkerState: CheckerTypeProjectionState = createCheckerTypeProjectionState()
): readonly SourceBindingProjectedType[] =>
  uniqueProjectedTypes(
    (TstsSyntax.Node_Members(owner) ?? [])
      .filter((member): member is TstsNode => member !== undefined)
      .filter((member) => getTstsNodeNameText(member) === name)
      .map((member) =>
        projectedTypeFromMemberDeclaration(
          context,
          member,
          substitutions,
          seen,
          checkerState
        )
      )
  );

const projectedTypesFromPropertySymbol = (
  context: CheckedContext,
  symbol: TstsSymbol | undefined,
  location: TstsNode
): readonly SourceBindingProjectedType[] => {
  if (!symbol) return [];
  const declarations = context.checker
    .getSymbolDeclarations(symbol)
    .filter((declaration): declaration is TstsNode => declaration !== undefined);
  const declared = uniqueProjectedTypes(
    declarations.map((declaration) =>
      projectedTypeFromMemberDeclaration(
        context,
        declaration,
        emptySourceTypeSubstitutions,
        new Set()
      )
    )
  );
  if (declared.length > 0) return declared;
  const type = context.checker.getTypeOfSymbolAtLocation(symbol, location);
  const projected = checkerTypeProjection(context, type);
  return projected ? [projected] : [];
};

const projectTypeNodeByBindingSegment = (
  context: CheckedContext,
  node: TstsNode,
  segment: SourceBindingAccessSegment,
  substitutions: SourceTypeSubstitutionMap,
  seen: Set<TstsNode>
): readonly SourceBindingProjectedType[] => {
  const typeReference = getTstsTypeReferenceDetails(node);
  if (typeReference && typeReference.typeArguments.length === 0) {
    const replacement = substitutions.get(typeReference.name);
    if (replacement) {
      return projectSourceBindingTypeBySegment(
        context,
        replacement,
        segment,
        seen
      );
    }
  }

  switch (node.Kind) {
    case TstsSyntax.KindParenthesizedType:
      return projectTypeNodeByBindingSegment(
        context,
        TstsSyntax.AsParenthesizedTypeNode(node)?.Type ?? node,
        segment,
        substitutions,
        seen
      );
    case TstsSyntax.KindTypeOperator:
      return projectTypeNodeByBindingSegment(
        context,
        TstsSyntax.AsTypeOperatorNode(node)?.Type ?? node,
        segment,
        substitutions,
        seen
      );
    case TstsSyntax.KindArrayType: {
      if (segment.kind !== "element") return [];
      const elementType = TstsSyntax.AsArrayTypeNode(node)?.ElementType;
      const projected = projectedTypeFromTypeNode(
        context,
        elementType,
        substitutions,
        seen
      );
      return projected ? [projected] : [];
    }
    case TstsSyntax.KindTupleType: {
      if (segment.kind !== "element") return [];
      const element = TstsSyntax.AsTupleTypeNode(node)?.Elements?.Nodes?.[
        segment.index
      ];
      const projected = projectedTypeFromTypeNode(
        context,
        TstsSyntax.Node_Type(element) ?? element,
        substitutions,
        seen
      );
      return projected ? [projected] : [];
    }
    case TstsSyntax.KindUnionType: {
      const unionType = TstsSyntax.AsUnionTypeNode(node);
      return uniqueProjectedTypes(
        (unionType?.Types?.Nodes ?? [])
          .filter((part): part is TstsNode => part !== undefined)
          .flatMap((part) =>
            projectTypeNodeByBindingSegment(
              context,
              part,
              segment,
              substitutions,
              seen
            )
          )
      );
    }
    case TstsSyntax.KindIntersectionType: {
      const intersectionType = TstsSyntax.AsIntersectionTypeNode(node);
      return uniqueProjectedTypes(
        (intersectionType?.Types?.Nodes ?? [])
          .filter((part): part is TstsNode => part !== undefined)
          .flatMap((part) =>
            projectTypeNodeByBindingSegment(
              context,
              part,
              segment,
              substitutions,
              seen
            )
          )
      );
    }
    case TstsSyntax.KindTypeLiteral:
      return segment.kind === "property"
        ? projectedMemberTypesFromOwner(
            context,
            node,
            segment.name,
            substitutions,
            seen
          )
        : [];
    case TstsSyntax.KindTypeReference:
    case TstsSyntax.KindExpressionWithTypeArguments: {
      if (
        segment.kind === "element" &&
        typeReference &&
        ["Array", "ReadonlyArray"].includes(typeReference.name)
      ) {
        const [elementType] = typeReference.typeArguments;
        const projected = projectedTypeFromTypeNode(
          context,
          elementType,
          substitutions,
          seen
        );
        return projected ? [projected] : [];
      }
      return uniqueProjectedTypes(
        typeReferenceDeclarations(context, node).flatMap((declaration) => {
          const nestedSubstitutions = mergeTypeReferenceSubstitutions(
            context,
            node,
            declaration,
            substitutions,
            seen
          );
          const aliasTarget =
            declaration.Kind === TstsSyntax.KindTypeAliasDeclaration
              ? TstsSyntax.Node_Type(declaration)
              : undefined;
          if (aliasTarget) {
            return projectTypeNodeByBindingSegment(
              context,
              aliasTarget,
              segment,
              nestedSubstitutions,
              seen
            );
          }
          return segment.kind === "property"
            ? projectedMemberTypesFromOwner(
                context,
                declaration,
                segment.name,
                nestedSubstitutions,
                seen
              )
            : [];
        })
      );
    }
    default: {
      const type = context.checker.getTypeFromTypeNode(node);
      if (segment.kind === "property") {
        return projectedTypesFromPropertySymbol(
          context,
          context.checker.getPropertyOfType(type, segment.name),
          node
        );
      }
      const elementType =
        context.checker.getElementTypeOfArrayType(type) ??
        context.checker.getNumberIndexType(type);
      const projected = checkerTypeProjection(context, elementType);
      return projected ? [projected] : [];
    }
  }
};

const projectSourceBindingTypeBySegment = (
  context: CheckedContext,
  type: SourceBindingProjectedType,
  segment: SourceBindingAccessSegment,
  seen: Set<TstsNode>
): readonly SourceBindingProjectedType[] => {
  switch (type.kind) {
    case "type-node":
      if (seen.has(type.node)) return [];
      seen.add(type.node);
      try {
        return projectTypeNodeByBindingSegment(
          context,
          type.node,
          segment,
          emptySourceTypeSubstitutions,
          seen
        );
      } finally {
        seen.delete(type.node);
      }
    case "intrinsic":
    case "source-primitive":
      return [];
    case "named": {
      const viaAlias = type.aliasTarget
        ? projectSourceBindingTypeBySegment(
            context,
            type.aliasTarget,
            segment,
            seen
          )
        : [];
      if (viaAlias.length > 0) return viaAlias;
      if (!type.declaration || segment.kind !== "property") return [];
      const substitutions = new Map<string, SourceBindingProjectedType>();
      sourceTypeParameterNames(type.declaration).forEach((parameter, index) => {
        const argument = type.typeArguments[index];
        if (argument) substitutions.set(parameter, argument);
      });
      return projectedMemberTypesFromOwner(
        context,
        type.declaration,
        segment.name,
        substitutions,
        seen
      );
    }
    case "record":
      return segment.kind === "element" ? [type.valueType] : [];
    case "function":
      return [];
    case "array":
      return segment.kind === "element" ? [type.elementType] : [];
    case "tuple":
      return segment.kind === "element"
        ? [type.elements[segment.index]].filter(
            (element): element is SourceBindingProjectedType =>
              element !== undefined
          )
        : [];
    case "object":
      return segment.kind === "property"
        ? type.members
            .filter((member) => member.name === segment.name)
            .map((member) => member.type)
            .filter(
              (member): member is SourceBindingProjectedType =>
                member !== undefined
            )
        : [];
    case "union":
    case "intersection":
      return uniqueProjectedTypes(
        type.types.flatMap((member) =>
          projectSourceBindingTypeBySegment(context, member, segment, seen)
        )
      );
  }
};

const sourceBindingTypeAtPath = (
  context: CheckedContext,
  rootType: SourceBindingProjectedType,
  accessPath: readonly SourceBindingAccessSegment[]
): SourceBindingProjectedType | undefined => {
  let current: SourceBindingProjectedType | undefined = rootType;
  for (const segment of accessPath) {
    if (!current) return undefined;
    current = combinedProjectedType(
      "union",
      projectSourceBindingTypeBySegment(
        context,
        current,
        segment,
        new Set()
      )
    );
  }
  return current;
};

type SourceExpressionProjectionCache = WeakMap<
  TstsNode,
  SourceBindingProjectedType | false
>;

const sourceExpressionProjectionKinds = new Set([
  TstsSyntax.KindIdentifier,
  TstsSyntax.KindStringLiteral,
  TstsSyntax.KindNoSubstitutionTemplateLiteral,
  TstsSyntax.KindNumericLiteral,
  TstsSyntax.KindBigIntLiteral,
  TstsSyntax.KindTrueKeyword,
  TstsSyntax.KindFalseKeyword,
  TstsSyntax.KindNullKeyword,
  TstsSyntax.KindThisKeyword,
  TstsSyntax.KindSuperKeyword,
  TstsSyntax.KindArrayLiteralExpression,
  TstsSyntax.KindObjectLiteralExpression,
  TstsSyntax.KindPropertyAccessExpression,
  TstsSyntax.KindElementAccessExpression,
  TstsSyntax.KindCallExpression,
  TstsSyntax.KindNewExpression,
  TstsSyntax.KindAsExpression,
  TstsSyntax.KindSatisfiesExpression,
  TstsSyntax.KindTypeAssertionExpression,
  TstsSyntax.KindNonNullExpression,
  TstsSyntax.KindConditionalExpression,
  TstsSyntax.KindArrowFunction,
  TstsSyntax.KindFunctionExpression,
]);

const nonExpressionProjectionParentKinds = new Set([
  TstsSyntax.KindTypeReference,
  TstsSyntax.KindTypeParameter,
  TstsSyntax.KindLiteralType,
  TstsSyntax.KindPropertySignature,
  TstsSyntax.KindExpressionWithTypeArguments,
  TstsSyntax.KindImportDeclaration,
  TstsSyntax.KindImportClause,
  TstsSyntax.KindNamespaceImport,
  TstsSyntax.KindNamedImports,
  TstsSyntax.KindImportSpecifier,
  TstsSyntax.KindExportDeclaration,
  TstsSyntax.KindExportSpecifier,
  TstsSyntax.KindHeritageClause,
]);

const isSourceExpressionProjectionNode = (node: TstsNode): boolean => {
  if (!sourceExpressionProjectionKinds.has(node.Kind)) return false;
  const parent = node.Parent;
  if (!parent) return true;
  if (nonExpressionProjectionParentKinds.has(parent.Kind)) return false;
  if (parent.Kind !== TstsSyntax.KindShorthandPropertyAssignment) {
    if (TstsSyntax.Node_Name(parent) === node) return false;
    if (TstsSyntax.Node_PropertyNameOrName(parent) === node) return false;
  }
  if (getTstsDeclaredTypeNode(parent) === node) return false;
  if (
    parent.Kind === TstsSyntax.KindPropertyAccessExpression &&
    TstsSyntax.Node_Name(parent) === node
  ) {
    return false;
  }
  if (
    parent.Kind === TstsSyntax.KindPropertyAssignment &&
    TstsSyntax.Node_PropertyNameOrName(parent) === node
  ) {
    return false;
  }
  return true;
};

const sourceTypeProjectionKinds = new Set([
  TstsSyntax.KindConditionalType,
  TstsSyntax.KindImportType,
  TstsSyntax.KindIndexedAccessType,
  TstsSyntax.KindInferType,
  TstsSyntax.KindMappedType,
  TstsSyntax.KindOptionalType,
  TstsSyntax.KindRestType,
  TstsSyntax.KindTypePredicate,
  TstsSyntax.KindTypeQuery,
]);

const isSourceTypeProjectionNode = (node: TstsNode): boolean =>
  sourceTypeProjectionKinds.has(node.Kind);

type CheckerTypeProjectionState = {
  readonly types: Set<TstsType>;
  readonly aliasDeclarations: Set<TstsNode>;
};

const createCheckerTypeProjectionState = (): CheckerTypeProjectionState => ({
  types: new Set<TstsType>(),
  aliasDeclarations: new Set<TstsNode>(),
});

const intrinsicProjection = (
  name: SourceIntrinsicTypeName
): SourceBindingProjectedType => ({
  kind: "intrinsic",
  name,
});

const sourceProjectedDeclarationKind = (
  declaration: TstsNode | undefined
): SourceProjectedDeclarationKind | undefined => {
  switch (declaration?.Kind) {
    case TstsSyntax.KindClassDeclaration:
      return "class";
    case TstsSyntax.KindEnumDeclaration:
      return "enum";
    case TstsSyntax.KindInterfaceDeclaration:
      return "interface";
    case TstsSyntax.KindTypeAliasDeclaration:
      return "type-alias";
    case TstsSyntax.KindTypeParameter:
      return "type-parameter";
    default:
      return undefined;
  }
};

const projectedTypeDeclarationForSymbol = (
  context: CheckedContext,
  symbol: TstsSymbol | undefined
): TstsNode | undefined => {
  if (!symbol) return undefined;
  return singleDeclaration(context.checker.getSymbolDeclarations(symbol), (node) =>
    sourceProjectedDeclarationKind(node) !== undefined
  );
};

const isProjectedStructuralMemberDeclaration = (
  declaration: TstsNode | undefined
): boolean => {
  const parentKind = declaration?.Parent?.Kind;
  return (
    parentKind === TstsSyntax.KindTypeLiteral ||
    parentKind === TstsSyntax.KindObjectLiteralExpression
  );
};

const projectedNamedTypeFromTypeReference = (
  context: CheckedContext,
  node: TstsNode,
  typeReference:
    | ReturnType<typeof getTstsTypeReferenceDetails>
    | undefined,
  substitutions: SourceTypeSubstitutionMap,
  seen: Set<TstsNode>,
  checkerState: CheckerTypeProjectionState = createCheckerTypeProjectionState()
): SourceBindingProjectedType | undefined => {
  if (!typeReference) return undefined;
  const typeArguments = typeReference.typeArguments
    .map((argument) =>
      projectedTypeFromTypeNode(
        context,
        argument,
        substitutions,
        seen,
        checkerState
      )
    )
    .filter(
      (argument): argument is SourceBindingProjectedType =>
        argument !== undefined
    );

  if (
    typeArguments.length === 1 &&
    (typeReference.name === "Array" || typeReference.name === "ReadonlyArray")
  ) {
    return {
      kind: "array",
      elementType: typeArguments[0]!,
      readonly: typeReference.name === "ReadonlyArray",
      sourceNode: node,
    };
  }

  const symbol = symbolForTypeReference(context, node);
  const resolved = symbol ? context.checker.resolveAlias(symbol) : undefined;
  const declaration = projectedTypeDeclarationForSymbol(context, resolved);
  const [recordKeyType, recordValueType] = typeArguments;
  if (
    declaration &&
    context.facts.has(sourceDictionaryTypeFactKey, declaration) &&
    recordKeyType &&
    recordValueType
  ) {
    return {
      kind: "record",
      keyType: recordKeyType,
      valueType: recordValueType,
      sourceNode: node,
    };
  }

  return {
    kind: "named",
    name: typeReference.name,
    typeArguments,
    declaration,
    declarationKind: sourceProjectedDeclarationKind(declaration),
    aliasTarget: checkerTypeAliasTargetProjection(
      context,
      declaration,
      typeArguments,
      seen,
      checkerState
    ),
    runtimeVisibility: declaration
      ? context.facts.get(sourceRuntimeVisibilityFactKey, declaration)?.visibility
      : undefined,
    sourceNode: node,
  };
};

const checkerSignatureProjection = (
  context: CheckedContext,
  signature: TstsSignature,
  state: CheckerTypeProjectionState
): SourceBindingProjectedType => ({
  kind: "function",
  parameters: context.checker.getSignatureParameters(signature).map((parameter) => {
    const declaration = context.checker.getSymbolValueDeclaration(parameter);
    const declaredType = TstsSyntax.Node_Type(declaration);
    return {
      name: context.checker.getSymbolName(parameter),
      type:
        projectedTypeFromTypeNode(
          context,
          declaredType,
          emptySourceTypeSubstitutions,
          new Set(),
          state
        ) ??
        checkerTypeProjection(
          context,
          context.checker.getTypeOfSignatureParameter(parameter),
          state
        ),
      optional: false,
      rest: false,
    };
  }),
  returnType: (() => {
    const declaration = context.checker.getSignatureDeclaration(signature);
    return (
      projectedTypeFromTypeNode(
        context,
        TstsSyntax.Node_Type(declaration),
        emptySourceTypeSubstitutions,
        new Set(),
        state
      ) ??
      checkerTypeProjection(
        context,
        context.checker.getReturnTypeOfSignature(signature),
        state
      )
    );
  })(),
  typeParameters: [],
});

const checkerTypeAliasTargetProjection = (
  context: CheckedContext,
  declaration: TstsNode | undefined,
  typeArguments: readonly SourceBindingProjectedType[],
  seen: Set<TstsNode> = new Set(),
  checkerState: CheckerTypeProjectionState = createCheckerTypeProjectionState()
): SourceBindingProjectedType | undefined => {
  if (declaration?.Kind !== TstsSyntax.KindTypeAliasDeclaration) {
    return undefined;
  }
  if (seen.has(declaration)) return undefined;
  const target = TstsSyntax.Node_Type(declaration);
  if (!target) return undefined;
  seen.add(declaration);
  try {
    const substitutions = new Map<string, SourceBindingProjectedType>();
    sourceTypeParameterNames(declaration).forEach((parameter, index) => {
      const argument = typeArguments[index];
      if (argument) substitutions.set(parameter, argument);
    });
    return projectedTypeFromTypeNode(
      context,
      target,
      substitutions,
      seen,
      checkerState
    );
  } finally {
    seen.delete(declaration);
  }
};

const checkerTypeProjection = (
  context: CheckedContext,
  type: TstsType | undefined,
  state: CheckerTypeProjectionState = createCheckerTypeProjectionState()
): SourceBindingProjectedType | undefined => {
  if (!type) return undefined;
  if (state.types.has(type)) return undefined;
  state.types.add(type);
  try {
    const checker = context.checker;
    const unionMembers = checker.getUnionMembers(type);
    if (unionMembers && unionMembers.length > 0) {
      return combinedProjectedType(
        "union",
        unionMembers.map((member) => checkerTypeProjection(context, member, state))
      );
    }

    const intersectionMembers = checker.getIntersectionMembers(type);
    if (intersectionMembers && intersectionMembers.length > 0) {
      return combinedProjectedType(
        "intersection",
        intersectionMembers.map((member) =>
          checkerTypeProjection(context, member, state)
        )
      );
    }

    const arrayElement = checker.getElementTypeOfArrayType(type);
    if (arrayElement) {
      const elementType = checkerTypeProjection(context, arrayElement, state);
      return elementType
        ? { kind: "array", elementType, readonly: false }
        : undefined;
    }

    if (checker.isAnyType(type)) return intrinsicProjection("any");
    if (checker.isUnknownType(type)) return intrinsicProjection("unknown");
    if (checker.isVoidType(type)) return intrinsicProjection("void");
    if (checker.isNeverType(type)) return intrinsicProjection("never");
    if (checker.isUndefinedType(type)) return intrinsicProjection("undefined");
    if (checker.isNullType(type)) return intrinsicProjection("null");
    if (checker.isStringLikeType(type)) return intrinsicProjection("string");
    if (checker.isNumberLikeType(type)) return intrinsicProjection("number");
    if (checker.isBooleanLikeType(type)) return intrinsicProjection("boolean");
    if (checker.isBigIntLikeType(type)) return intrinsicProjection("bigint");

    const signatures = checker.getCallSignatures(type);
    const signature = signatures.length === 1 ? signatures[0] : undefined;
    if (signature) {
      return checkerSignatureProjection(context, signature, state);
    }

    const symbol = checker.getTypeAliasOrSymbol(type);
    const declaration = projectedTypeDeclarationForSymbol(context, symbol);
    const name =
      checker.getTypeAliasSymbolName(type) ??
      checker.getTypeSymbolName(type) ??
      (symbol ? checker.getSymbolName(symbol) : undefined);
    if (name) {
      const typeArguments = [
        ...checker.getAliasTypeArguments(type),
        ...checker.getReferenceTypeArguments(type),
      ]
        .map((argument) => checkerTypeProjection(context, argument, state))
        .filter(
          (argument): argument is SourceBindingProjectedType =>
            argument !== undefined
        );

      const [recordKeyType, recordValueType] = typeArguments;
      if (
        declaration &&
        context.facts.has(sourceDictionaryTypeFactKey, declaration) &&
        recordKeyType &&
        recordValueType
      ) {
        return {
          kind: "record",
          keyType: recordKeyType,
          valueType: recordValueType,
          sourceNode: declaration,
        };
      }

      return {
        kind: "named",
        name,
        typeArguments,
        declaration,
        declarationKind: sourceProjectedDeclarationKind(declaration),
        aliasTarget: checkerTypeAliasTargetProjection(
          context,
          declaration,
          typeArguments,
          state.aliasDeclarations,
          state
        ),
        runtimeVisibility: declaration
          ? context.facts.get(sourceRuntimeVisibilityFactKey, declaration)
              ?.visibility
          : undefined,
        sourceNode: declaration,
      };
    }

    const properties = checker.getProperties(type).filter((property) =>
      isProjectedStructuralMemberDeclaration(
        context.checker.getSymbolValueDeclaration(property)
      )
    );
    if (properties.length > 0) {
      return {
        kind: "object",
        members: properties
          .map((property) => {
            const declaration =
              context.checker.getSymbolValueDeclaration(property);
            const declaredType = TstsSyntax.Node_Type(declaration);
            return {
              name: checker.getSymbolName(property),
              optional: declaration
                ? TstsSyntax.Node_QuestionToken(declaration) !== undefined
                : false,
              type:
                projectedTypeFromTypeNode(
                  context,
                  declaredType,
                  emptySourceTypeSubstitutions,
                  new Set(),
                  state
                ) ??
                checkerTypeProjection(
                  context,
                  declaration
                    ? checker.getTypeOfSymbolAtLocation(property, declaration)
                    : undefined,
                  state
                ),
            };
          })
          .filter(
            (member, index, members) =>
              members.findIndex((candidate) => candidate.name === member.name) ===
              index
          ),
      };
    }

    return undefined;
  } finally {
    state.types.delete(type);
  }
};

const staticElementAccessIndex = (
  indexExpression: TstsNode | undefined
): number | undefined => {
  if (indexExpression?.Kind !== TstsSyntax.KindNumericLiteral) return undefined;
  const text = getTstsNodeText(indexExpression);
  if (!text || !/^(?:0|[1-9]\d*)$/u.test(text)) return undefined;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : undefined;
};

const containsTupleProjection = (type: SourceBindingProjectedType): boolean => {
  switch (type.kind) {
    case "tuple":
      return true;
    case "union":
    case "intersection":
      return type.types.some(containsTupleProjection);
    default:
      return false;
  }
};

const containsArrayProjection = (type: SourceBindingProjectedType): boolean => {
  switch (type.kind) {
    case "array":
      return true;
    case "union":
    case "intersection":
      return type.types.some(containsArrayProjection);
    case "named":
      return type.aliasTarget
        ? containsArrayProjection(type.aliasTarget)
        : false;
    default:
      return false;
  }
};

const containsTypeParameterProjection = (
  type: SourceBindingProjectedType | undefined,
  seen: ReadonlySet<SourceBindingProjectedType> = new Set()
): boolean => {
  if (!type || seen.has(type)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  switch (type.kind) {
    case "named":
      return (
        type.declarationKind === "type-parameter" ||
        type.typeArguments.some((argument) =>
          containsTypeParameterProjection(argument, nextSeen)
        ) ||
        containsTypeParameterProjection(type.aliasTarget, nextSeen)
      );
    case "record":
      return (
        containsTypeParameterProjection(type.keyType, nextSeen) ||
        containsTypeParameterProjection(type.valueType, nextSeen)
      );
    case "function":
      return (
        type.typeParameters.length > 0 ||
        type.parameters.some((parameter) =>
          containsTypeParameterProjection(parameter.type, nextSeen)
        ) ||
        containsTypeParameterProjection(type.returnType, nextSeen)
      );
    case "array":
      return containsTypeParameterProjection(type.elementType, nextSeen);
    case "tuple":
      return type.elements.some((element) =>
        containsTypeParameterProjection(element, nextSeen)
      );
    case "object":
      return type.members.some((member) =>
        containsTypeParameterProjection(member.type, nextSeen)
      );
    case "union":
    case "intersection":
      return type.types.some((member) =>
        containsTypeParameterProjection(member, nextSeen)
      );
    case "source-primitive":
    case "intrinsic":
    case "type-node":
      return false;
  }
};

const containsSourcePrimitiveProjection = (
  type: SourceBindingProjectedType | undefined,
  seen: ReadonlySet<SourceBindingProjectedType> = new Set()
): boolean => {
  if (!type || seen.has(type)) return false;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  switch (type.kind) {
    case "source-primitive":
      return true;
    case "named":
      return (
        type.typeArguments.some((argument) =>
          containsSourcePrimitiveProjection(argument, nextSeen)
        ) || containsSourcePrimitiveProjection(type.aliasTarget, nextSeen)
      );
    case "record":
      return (
        containsSourcePrimitiveProjection(type.keyType, nextSeen) ||
        containsSourcePrimitiveProjection(type.valueType, nextSeen)
      );
    case "function":
      return (
        type.parameters.some((parameter) =>
          containsSourcePrimitiveProjection(parameter.type, nextSeen)
        ) || containsSourcePrimitiveProjection(type.returnType, nextSeen)
      );
    case "array":
      return containsSourcePrimitiveProjection(type.elementType, nextSeen);
    case "tuple":
      return type.elements.some((element) =>
        containsSourcePrimitiveProjection(element, nextSeen)
      );
    case "object":
      return type.members.some((member) =>
        containsSourcePrimitiveProjection(member.type, nextSeen)
      );
    case "union":
    case "intersection":
      return type.types.some((member) =>
        containsSourcePrimitiveProjection(member, nextSeen)
      );
    case "intrinsic":
    case "type-node":
      return false;
  }
};

const declaredProjectionForExpression = (
  context: CheckedContext,
  expression: TstsNode | undefined
): SourceBindingProjectedType | undefined => {
  const declaredType = declaredTypeNodeForExpression(context, expression);
  return declaredType ? projectedTypeFromTypeNode(context, declaredType) : undefined;
};

const identifierDeclarationProjection = (
  context: CheckedContext,
  node: TstsNode,
  cache: SourceExpressionProjectionCache,
  sourceDiagnosticRoots: readonly string[]
): SourceBindingProjectedType | undefined => {
  const declared = declaredProjectionForExpression(context, node);
  if (declared) return declared;
  const shorthandValueSymbol =
    node.Parent?.Kind === TstsSyntax.KindShorthandPropertyAssignment
      ? context.checker.getShorthandAssignmentValueSymbol(node.Parent)
      : undefined;
  const symbol = shorthandValueSymbol ?? context.checker.getSymbolAtLocation(node);
  const resolved = symbol ? context.checker.resolveAlias(symbol) : undefined;
  const declaration = resolved
    ? context.checker.getSymbolValueDeclaration(resolved)
    : undefined;
  const initializer = TstsSyntax.AsVariableDeclaration(declaration)?.Initializer;
  return initializer && initializer !== node
    ? sourceExpressionTypeProjection(
        context,
        initializer,
        cache,
        sourceDiagnosticRoots
      )
    : undefined;
};

const sourceExpressionStorageProjection = (
  context: CheckedContext,
  node: TstsNode | undefined,
  cache: SourceExpressionProjectionCache,
  sourceDiagnosticRoots: readonly string[]
): SourceBindingProjectedType | undefined => {
  if (!node) return undefined;
  if (TstsSyntax.IsIdentifier(node)) {
    return declaredProjectionForExpression(context, node);
  }
  switch (node.Kind) {
    case TstsSyntax.KindPropertyAccessExpression: {
      const receiverStorage = sourceExpressionStorageProjection(
        context,
        TstsSyntax.Node_Expression(node),
        cache,
        sourceDiagnosticRoots
      );
      const name = getTstsIdentifierText(TstsSyntax.Node_Name(node));
      if (!receiverStorage || !name) return declaredProjectionForExpression(context, node);
      return combinedProjectedType(
        "union",
        projectSourceBindingTypeBySegment(
          context,
          receiverStorage,
          { kind: "property", name },
          new Set()
        ),
        node
      );
    }
    case TstsSyntax.KindElementAccessExpression: {
      const element = TstsSyntax.AsElementAccessExpression(node);
      const receiverStorage = sourceExpressionStorageProjection(
        context,
        element?.Expression,
        cache,
        sourceDiagnosticRoots
      );
      return arrayElementProjection(
        context,
        receiverStorage,
        staticElementAccessIndex(element?.ArgumentExpression),
        node
      );
    }
    case TstsSyntax.KindNonNullExpression:
      return nonNullishProjection(
        sourceExpressionStorageProjection(
          context,
          TstsSyntax.Node_Expression(node),
          cache,
          sourceDiagnosticRoots
        ),
        node
      );
    case TstsSyntax.KindAsExpression:
    case TstsSyntax.KindTypeAssertionExpression:
    case TstsSyntax.KindSatisfiesExpression:
      return (
        projectedTypeFromTypeNode(context, TstsSyntax.Node_Type(node)) ??
        sourceExpressionStorageProjection(
          context,
          TstsSyntax.Node_Expression(node),
          cache,
          sourceDiagnosticRoots
        )
      );
    default:
      return undefined;
  }
};

const resolvedSignatureReturnProjection = (
  context: CheckedContext,
  call: TstsNode
): SourceBindingProjectedType | undefined => {
  const signature = context.checker.getResolvedSignature(call);
  const declaration = context.checker.getSignatureDeclaration(signature);
  const declarationReturnType = TstsSyntax.Node_Type(declaration);
  return (
    projectedTypeFromTypeNode(context, declarationReturnType) ??
    checkerTypeProjection(
      context,
      context.checker.getReturnTypeOfSignature(signature)
    )
  );
};

const signatureParameterProjection = (
  context: CheckedContext,
  parameter: TstsSymbol | undefined,
  substitutions: SourceTypeSubstitutionMap = emptySourceTypeSubstitutions,
  checkerState: CheckerTypeProjectionState = createCheckerTypeProjectionState()
): SourceBindingProjectedType | undefined => {
  if (!parameter) return undefined;
  const declaration = context.checker.getSymbolValueDeclaration(parameter);
  const declaredType = TstsSyntax.Node_Type(declaration);
  return (
    projectedTypeFromTypeNode(
      context,
      declaredType,
      substitutions,
      new Set(),
      checkerState
    ) ??
    checkerTypeProjection(
      context,
      context.checker.getTypeOfSignatureParameter(parameter),
      checkerState
    )
  );
};

const signatureTargetProjection = (
  context: CheckedContext,
  signature: TstsSignature | undefined,
  call: TstsNode | undefined = undefined
): SourceBindingProjectedType | undefined => {
  if (!signature) return undefined;
  const callee = call ? TstsSyntax.Node_Expression(call) : undefined;
  const receiver =
    callee?.Kind === TstsSyntax.KindPropertyAccessExpression
      ? TstsSyntax.Node_Expression(callee)
      : undefined;
  const receiverType = receiver
    ? checkerTypeProjection(context, context.checker.getTypeAtLocation(receiver))
    : undefined;
  if (receiverType) return receiverType;
  const declaration = context.checker.getSignatureDeclaration(signature);
  for (
    let owner = declaration?.Parent;
    owner !== undefined;
    owner = owner.Parent
  ) {
    if (
      owner.Kind === TstsSyntax.KindInterfaceDeclaration ||
      owner.Kind === TstsSyntax.KindTypeAliasDeclaration
    ) {
      return (
        projectedTypeFromTypeNode(context, TstsSyntax.Node_Type(owner)) ??
        checkerTypeProjection(context, context.checker.getTypeAtLocation(owner))
      );
    }
  }
  return projectedTypeFromTypeNode(context, TstsSyntax.Node_Type(declaration));
};

const findNamedProjectedTypeForDeclaration = (
  type: SourceBindingProjectedType | undefined,
  declaration: TstsNode | undefined,
  seen: ReadonlySet<SourceBindingProjectedType> = new Set()
): Extract<SourceBindingProjectedType, { readonly kind: "named" }> | undefined => {
  if (!type || !declaration || seen.has(type)) return undefined;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  switch (type.kind) {
    case "named":
      return type.declaration === declaration
        ? type
        : findNamedProjectedTypeForDeclaration(
            type.aliasTarget,
            declaration,
            nextSeen
          );
    case "record":
      return (
        findNamedProjectedTypeForDeclaration(type.keyType, declaration, nextSeen) ??
        findNamedProjectedTypeForDeclaration(type.valueType, declaration, nextSeen)
      );
    case "function":
      for (const parameter of type.parameters) {
        const match = findNamedProjectedTypeForDeclaration(
          parameter.type,
          declaration,
          nextSeen
        );
        if (match) return match;
      }
      return findNamedProjectedTypeForDeclaration(
        type.returnType,
        declaration,
        nextSeen
      );
    case "array":
      return findNamedProjectedTypeForDeclaration(
        type.elementType,
        declaration,
        nextSeen
      );
    case "tuple":
      for (const element of type.elements) {
        const match = findNamedProjectedTypeForDeclaration(
          element,
          declaration,
          nextSeen
        );
        if (match) return match;
      }
      return undefined;
    case "object":
      for (const member of type.members) {
        const match = findNamedProjectedTypeForDeclaration(
          member.type,
          declaration,
          nextSeen
        );
        if (match) return match;
      }
      return undefined;
    case "union":
    case "intersection":
      for (const member of type.types) {
        const match = findNamedProjectedTypeForDeclaration(
          member,
          declaration,
          nextSeen
        );
        if (match) return match;
      }
      return undefined;
    case "intrinsic":
    case "source-primitive":
    case "type-node":
      return undefined;
  }
};

const receiverTypeSubstitutionsForCall = (
  context: CheckedContext,
  call: TstsNode,
  signatureDeclaration: TstsNode | undefined
): SourceTypeSubstitutionMap => {
  const owner = signatureDeclaration?.Parent;
  if (!owner) return emptySourceTypeSubstitutions;
  const parameters = sourceTypeParameterNames(owner);
  if (parameters.length === 0) return emptySourceTypeSubstitutions;
  const callee = TstsSyntax.Node_Expression(call);
  const receiver =
    callee?.Kind === TstsSyntax.KindPropertyAccessExpression
      ? TstsSyntax.Node_Expression(callee)
      : undefined;
  const receiverType = receiver
    ? checkerTypeProjection(context, context.checker.getTypeAtLocation(receiver))
    : undefined;
  const namedReceiver = findNamedProjectedTypeForDeclaration(receiverType, owner);
  if (!namedReceiver) return emptySourceTypeSubstitutions;
  const substitutions = new Map<string, SourceBindingProjectedType>();
  parameters.forEach((parameter, index) => {
    const argument = namedReceiver.typeArguments[index];
    if (argument) substitutions.set(parameter, argument);
  });
  return substitutions;
};

const explicitSignatureTypeSubstitutionsForCall = (
  context: CheckedContext,
  call: TstsNode,
  signatureDeclaration: TstsNode | undefined,
  substitutions: SourceTypeSubstitutionMap,
  checkerState: CheckerTypeProjectionState
): SourceTypeSubstitutionMap => {
  if (!signatureDeclaration) return substitutions;
  const parameters = sourceTypeParameterNames(signatureDeclaration);
  const argumentsList = getTstsTypeArguments(call);
  if (parameters.length === 0 || argumentsList.length === 0) {
    return substitutions;
  }
  const merged = new Map(substitutions);
  parameters.forEach((parameter, index) => {
    const argument = argumentsList[index];
    const projected = projectedTypeFromTypeNode(
      context,
      argument,
      substitutions,
      new Set(),
      checkerState
    );
    if (projected) merged.set(parameter, projected);
  });
  return merged;
};

const signatureTypeSubstitutionsForCall = (
  context: CheckedContext,
  call: TstsNode,
  signature: TstsSignature,
  checkerState: CheckerTypeProjectionState
): SourceTypeSubstitutionMap => {
  const declaration = context.checker.getSignatureDeclaration(signature);
  const receiverSubstitutions = receiverTypeSubstitutionsForCall(
    context,
    call,
    declaration
  );
  return explicitSignatureTypeSubstitutionsForCall(
    context,
    call,
    declaration,
    receiverSubstitutions,
    checkerState
  );
};

const callArgumentTypesFact = (
  context: CheckedContext,
  node: TstsNode
): SourceCallArgumentTypesFact | undefined => {
  const signature = context.checker.getResolvedSignature(node);
  if (!signature) return undefined;
  const checkerState = createCheckerTypeProjectionState();
  const substitutions = signatureTypeSubstitutionsForCall(
    context,
    node,
    signature,
    checkerState
  );
  return {
    argumentTypes: context.checker
      .getSignatureParameters(signature)
      .map((parameter) =>
        signatureParameterProjection(
          context,
          parameter,
          substitutions,
          checkerState
        )
      ),
    targetType: signatureTargetProjection(context, signature, node),
  };
};

const sourceParameterTypeProjection = (
  context: CheckedContext,
  parameter: TstsSymbol | TstsNode | undefined
): SourceParameterTypeProjection | undefined => {
  const declaration =
    typeof parameter === "object" && parameter !== undefined && "Kind" in parameter
      ? parameter
      : context.checker.getSymbolValueDeclaration(parameter);
  const name =
    getTstsNodeNameText(declaration) ??
    getTstsIdentifierText(TstsSyntax.Node_Name(declaration)) ??
    (typeof parameter === "object" && parameter !== undefined && !("Kind" in parameter)
      ? context.checker.getSymbolName(parameter)
      : undefined);
  if (!name) return undefined;
  const type =
    projectedTypeFromTypeNode(context, TstsSyntax.Node_Type(declaration)) ??
    (typeof parameter === "object" && parameter !== undefined && !("Kind" in parameter)
      ? checkerTypeProjection(
          context,
          context.checker.getTypeOfSignatureParameter(parameter)
        )
      : undefined);
  return {
    name,
    type,
    optional: declaration
      ? TstsSyntax.Node_QuestionToken(declaration) !== undefined
      : false,
    rest:
      TstsSyntax.AsParameterDeclaration(declaration)?.DotDotDotToken !==
      undefined,
  };
};

const sourceFunctionLikeDeclaration = (node: TstsNode): boolean =>
  node.Kind === TstsSyntax.KindFunctionDeclaration ||
  node.Kind === TstsSyntax.KindMethodDeclaration ||
  node.Kind === TstsSyntax.KindConstructor ||
  node.Kind === TstsSyntax.KindGetAccessor ||
  node.Kind === TstsSyntax.KindSetAccessor ||
  node.Kind === TstsSyntax.KindArrowFunction ||
  node.Kind === TstsSyntax.KindFunctionExpression ||
  node.Kind === TstsSyntax.KindCallSignature ||
  node.Kind === TstsSyntax.KindConstructSignature;

const isTstsDeclarationLikeNode = (node: TstsNode): boolean =>
  sourceFunctionLikeDeclaration(node) ||
  node.Kind === TstsSyntax.KindClassDeclaration ||
  node.Kind === TstsSyntax.KindInterfaceDeclaration ||
  node.Kind === TstsSyntax.KindEnumDeclaration ||
  node.Kind === TstsSyntax.KindTypeAliasDeclaration ||
  node.Kind === TstsSyntax.KindVariableDeclaration ||
  node.Kind === TstsSyntax.KindParameter ||
  node.Kind === TstsSyntax.KindPropertyDeclaration ||
  node.Kind === TstsSyntax.KindPropertySignature ||
  node.Kind === TstsSyntax.KindIndexSignature ||
  node.Kind === TstsSyntax.KindEnumMember;

const runtimeHeritageTypeNodesForSourceFacts = (
  context: CheckedContext,
  declaration: TstsNode
): readonly TstsNode[] =>
  getTstsHeritageTypeNodes(declaration).filter(
    (heritage): heritage is TstsNode =>
      heritage !== undefined &&
      context.facts.get(sourceTypeSemanticsFactKey, heritage)?.kind ===
        undefined &&
      context.facts.get(heritageWrapperSemanticsFactKey, heritage)?.kind !==
        "interface-erasure"
  );

const baseConstructorParameterProjections = (
  context: CheckedContext,
  node: TstsNode
): readonly SourceParameterTypeProjection[] | undefined => {
  if (node.Kind !== TstsSyntax.KindClassDeclaration) return undefined;
  const runtimeHeritages = runtimeHeritageTypeNodesForSourceFacts(context, node);
  const heritage = runtimeHeritages.length === 1 ? runtimeHeritages[0] : undefined;
  if (!heritage) return undefined;
  const heritageType = context.checker.getTypeFromTypeNode(heritage);
  const signatures = heritageType
    ? context.checker.getConstructSignatures(heritageType)
    : [];
  const signature = signatures.length === 1 ? signatures[0] : undefined;
  if (!signature) return undefined;
  const parameters = context.checker
    .getSignatureParameters(signature)
    .map((parameter) => sourceParameterTypeProjection(context, parameter))
    .filter(
      (parameter): parameter is SourceParameterTypeProjection =>
        parameter !== undefined
    );
  return parameters.length > 0 ? parameters : undefined;
};

const declarationTypeProjectionFact = (
  context: CheckedContext,
  node: TstsNode
): SourceDeclarationTypeProjectionFact | undefined => {
  const signature = sourceFunctionLikeDeclaration(node)
    ? context.checker.getSignatureFromDeclaration(node)
    : undefined;
  const fact: SourceDeclarationTypeProjectionFact = {
    returnType:
      projectedTypeFromTypeNode(context, TstsSyntax.Node_Type(node)) ??
      checkerTypeProjection(
        context,
        signature
          ? context.checker.getReturnTypeOfSignature(signature)
          : undefined
      ),
    baseConstructorParameters: baseConstructorParameterProjections(context, node),
  };
  return fact.returnType || fact.baseConstructorParameters
    ? fact
    : undefined;
};

const sameSourceSymbol = (
  context: CheckedContext,
  left: TstsSymbol | undefined,
  right: TstsSymbol | undefined
): boolean => {
  if (!left || !right) return false;
  if (left === right) return true;
  const leftDeclarations = context.checker.getSymbolDeclarations(left);
  const rightDeclarations = context.checker.getSymbolDeclarations(right);
  return leftDeclarations.some((leftDeclaration) =>
    rightDeclarations.includes(leftDeclaration)
  );
};

const nodeReferencesSourceSymbol = (
  context: CheckedContext,
  node: TstsNode | undefined,
  symbol: TstsSymbol | undefined
): boolean => {
  if (!node || !symbol) return false;
  let referenced = false;
  const visit = (current: TstsNode | undefined): void => {
    if (!current || referenced) return;
    if (current.Kind === TstsSyntax.KindIdentifier) {
      referenced = sameSourceSymbol(
        context,
        context.checker.getSymbolAtLocation(current),
        symbol
      );
      if (referenced) return;
    }
    forEachTstsChild(current, visit);
  };
  visit(node);
  return referenced;
};

const setInitializerReferencesDeclarationFact = (
  context: CheckedContext,
  node: TstsNode
): void => {
  if (node.Kind !== TstsSyntax.KindVariableDeclaration) return;
  const name = TstsSyntax.Node_Name(node);
  const initializer = TstsSyntax.Node_Initializer(node);
  if (!name || !initializer) return;
  const symbol = context.checker.getSymbolAtLocation(name);
  if (!nodeReferencesSourceSymbol(context, initializer, symbol)) return;
  context.facts.set(sourceInitializerReferencesDeclarationFactKey, node, {
    referencesDeclaration: true,
  });
};

const callableReturnProjection = (
  context: CheckedContext,
  node: TstsNode | undefined,
  cache: SourceExpressionProjectionCache,
  sourceDiagnosticRoots: readonly string[]
): SourceBindingProjectedType | undefined => {
  if (!node) return undefined;
  const declaredReturnType = TstsSyntax.Node_Type(node);
  if (declaredReturnType) {
    return projectedTypeFromTypeNode(context, declaredReturnType);
  }
  const projected = sourceExpressionTypeProjection(
    context,
    node,
    cache,
    sourceDiagnosticRoots
  );
  if (projected?.kind === "function") {
    return projected.returnType;
  }
  const type = context.checker.getTypeAtLocation(node);
  const signatures = context.checker.getCallSignatures(type);
  return signatures.length === 1
    ? checkerTypeProjection(
        context,
        context.checker.getReturnTypeOfSignature(signatures[0])
      )
    : undefined;
};

const arrayElementProjection = (
  context: CheckedContext,
  type: SourceBindingProjectedType | undefined,
  index: number | undefined,
  location: TstsNode
): SourceBindingProjectedType | undefined => {
  if (!type) return undefined;
  if (index === undefined && containsTupleProjection(type)) return undefined;
  const element = combinedProjectedType(
    "union",
    projectSourceBindingTypeBySegment(
      context,
      type,
      { kind: "element", index: index ?? 0 },
      new Set()
    ),
    location
  );
  return containsArrayProjection(type)
    ? combinedProjectedType("union", [element, intrinsicProjection("undefined")], location)
    : element;
};

const arrayProjection = (
  elementType: SourceBindingProjectedType | undefined,
  sourceNode: TstsNode
): SourceBindingProjectedType | undefined =>
  elementType
    ? { kind: "array", elementType, readonly: false, sourceNode }
    : undefined;

const recordValueProjection = (
  type: SourceBindingProjectedType | undefined,
  seen: ReadonlySet<SourceBindingProjectedType> = new Set()
): SourceBindingProjectedType | undefined => {
  if (!type || seen.has(type)) return undefined;
  const nextSeen = new Set(seen);
  nextSeen.add(type);
  switch (type.kind) {
    case "record":
      return type.valueType;
    case "named":
      return recordValueProjection(type.aliasTarget, nextSeen);
    case "union":
    case "intersection":
      return combinedProjectedType(
        type.kind,
        type.types.map((member) => recordValueProjection(member, nextSeen))
      );
    default:
      return undefined;
  }
};

const sourceRuntimeArrayCallProjection = (
  context: CheckedContext,
  call: TstsNode,
  callee: TstsNode,
  operation: SourceRuntimeOperationFact,
  cache: SourceExpressionProjectionCache,
  sourceDiagnosticRoots: readonly string[]
): SourceBindingProjectedType | undefined => {
  if (operation.dispatch !== "receiver-call" || operation.owner !== "Array") {
    return undefined;
  }
  const receiver = TstsSyntax.Node_Expression(callee);
  const receiverProjection = sourceExpressionTypeProjection(
    context,
    receiver,
    cache,
    sourceDiagnosticRoots
  );
  const elementType = arrayElementProjection(
    context,
    receiverProjection,
    0,
    receiver ?? call
  );
  switch (operation.member) {
    case "map": {
      const callback = getTstsCallExpressionDetails(call)?.arguments[0];
      return arrayProjection(
        callableReturnProjection(context, callback, cache, sourceDiagnosticRoots) ??
          elementType,
        call
      );
    }
    case "filter":
    case "slice":
      return arrayProjection(elementType, call);
    default:
      return undefined;
  }
};

const sourceRuntimeObjectCallProjection = (
  context: CheckedContext,
  call: TstsNode,
  operation: SourceRuntimeOperationFact,
  cache: SourceExpressionProjectionCache,
  sourceDiagnosticRoots: readonly string[]
): SourceBindingProjectedType | undefined => {
  if (
    operation.dispatch !== "static-call" ||
    operation.owner !== "Object" ||
    operation.member !== "entries"
  ) {
    return undefined;
  }
  const [source] = TstsSyntax.Node_Arguments(call) ?? [];
  const sourceProjection = sourceExpressionTypeProjection(
    context,
    source,
    cache,
    sourceDiagnosticRoots
  );
  const valueType = recordValueProjection(sourceProjection);
  return valueType
    ? arrayProjection(
        {
          kind: "tuple",
          elements: [intrinsicProjection("string"), valueType],
          readonly: false,
          sourceNode: call,
        },
        call
      )
    : undefined;
};

const sourceObjectLiteralProjection = (
  context: CheckedContext,
  node: TstsNode,
  cache: SourceExpressionProjectionCache,
  sourceDiagnosticRoots: readonly string[]
): SourceBindingProjectedType | undefined => {
  const members: SourceBindingProjectedObjectMember[] = [];
  for (const property of TstsSyntax.Node_Properties(node) ?? []) {
    if (!property) return undefined;
    if (
      property.Kind !== TstsSyntax.KindPropertyAssignment &&
      property.Kind !== TstsSyntax.KindShorthandPropertyAssignment
    ) {
      return undefined;
    }
    const nameNode =
      property.Kind === TstsSyntax.KindShorthandPropertyAssignment
        ? TstsSyntax.Node_Name(property)
        : TstsSyntax.Node_PropertyNameOrName(property);
    const name =
      getTstsIdentifierText(nameNode) ??
      getTstsNodeNameText(nameNode) ??
      getTstsNodeText(nameNode);
    if (!name) return undefined;
    const valueNode =
      property.Kind === TstsSyntax.KindShorthandPropertyAssignment
        ? TstsSyntax.Node_Name(property)
        : TstsSyntax.Node_Initializer(property);
    members.push({
      name,
      optional: false,
      type: sourceExpressionTypeProjection(
        context,
        valueNode,
        cache,
        sourceDiagnosticRoots
      ),
    });
  }
  return { kind: "object", members, sourceNode: node };
};

const sourceFunctionExpressionProjection = (
  context: CheckedContext,
  node: TstsNode
): SourceBindingProjectedType | undefined => {
  const signature = context.checker.getSignatureFromDeclaration(node);
  return signature
    ? checkerSignatureProjection(
        context,
        signature,
        createCheckerTypeProjectionState()
      )
    : checkerTypeProjection(
        context,
        context.checker.getNarrowedTypeAtLocation(node) ??
          context.checker.getTypeAtLocation(node)
      );
};

const sourceExpressionTypeProjection = (
  context: CheckedContext,
  node: TstsNode | undefined,
  cache: SourceExpressionProjectionCache,
  sourceDiagnosticRoots: readonly string[]
): SourceBindingProjectedType | undefined => {
  if (!node) return undefined;
  if (!isSourceExpressionProjectionNode(node)) return undefined;
  const cached = cache.get(node);
  if (cached !== undefined) return cached === false ? undefined : cached;
  cache.set(node, false);
  const set = (
    value: SourceBindingProjectedType | undefined
  ): SourceBindingProjectedType | undefined => {
    cache.set(node, value ?? false);
    return value;
  };

  switch (node.Kind) {
    case TstsSyntax.KindIdentifier: {
      const declared = identifierDeclarationProjection(
        context,
        node,
        cache,
        sourceDiagnosticRoots
      );
      const narrowed = checkerTypeProjection(
        context,
        context.checker.getNarrowedTypeAtLocation(node)
      );
      return set(
        containsSourcePrimitiveProjection(declared)
          ? declared
          : declaredArmForNarrowedProjection(declared, narrowed) ?? declared
      );
    }
    case TstsSyntax.KindObjectLiteralExpression:
      return set(
        sourceObjectLiteralProjection(
          context,
          node,
          cache,
          sourceDiagnosticRoots
        )
      );
    case TstsSyntax.KindArrowFunction:
    case TstsSyntax.KindFunctionExpression:
      return set(sourceFunctionExpressionProjection(context, node));
    case TstsSyntax.KindPropertyAccessExpression: {
      const name = getTstsIdentifierText(TstsSyntax.Node_Name(node));
      const receiver = TstsSyntax.Node_Expression(node);
      const receiverProjection = sourceExpressionTypeProjection(
        context,
        receiver,
        cache,
        sourceDiagnosticRoots
      );
      const projectedFromReceiver =
        name && receiverProjection
          ? combinedProjectedType(
              "union",
              projectSourceBindingTypeBySegment(
                context,
                receiverProjection,
                { kind: "property", name },
                new Set()
              ),
              node
            )
          : undefined;
      return set(
        projectedFromReceiver ??
          declaredProjectionForExpression(context, node) ??
          checkerTypeProjection(
            context,
            context.checker.getNarrowedTypeAtLocation(node) ??
              context.checker.getTypeAtLocation(node)
          )
      );
    }
    case TstsSyntax.KindElementAccessExpression: {
      const element = TstsSyntax.AsElementAccessExpression(node);
      const receiverProjection = sourceExpressionTypeProjection(
        context,
        element?.Expression,
        cache,
        sourceDiagnosticRoots
      );
      return set(
        arrayElementProjection(
          context,
          receiverProjection,
          staticElementAccessIndex(element?.ArgumentExpression),
          node
        ) ??
          checkerTypeProjection(
            context,
            context.checker.getNarrowedTypeAtLocation(node) ??
              context.checker.getTypeAtLocation(node)
          )
      );
    }
    case TstsSyntax.KindAsExpression:
    case TstsSyntax.KindSatisfiesExpression:
    case TstsSyntax.KindTypeAssertionExpression:
    case TstsSyntax.KindNonNullExpression:
      return set(
        projectedTypeFromTypeNode(context, TstsSyntax.Node_Type(node)) ??
          sourceExpressionTypeProjection(
            context,
            TstsSyntax.Node_Expression(node),
            cache,
            sourceDiagnosticRoots
          )
      );
    case TstsSyntax.KindCallExpression:
    case TstsSyntax.KindNewExpression: {
      const callee = TstsSyntax.Node_Expression(node);
      const operation = callee
        ? sourceRuntimeOperation(context, callee, sourceDiagnosticRoots)
        : undefined;
      const signatureReturnProjection = resolvedSignatureReturnProjection(
        context,
        node
      );
      const checkerReturnProjection = checkerTypeProjection(
        context,
        context.checker.getNarrowedTypeAtLocation(node) ??
          context.checker.getTypeAtLocation(node)
      );
      return set(
        (callee && operation
          ? sourceRuntimeArrayCallProjection(
              context,
              node,
              callee,
              operation,
              cache,
              sourceDiagnosticRoots
            ) ??
            sourceRuntimeObjectCallProjection(
              context,
              node,
              operation,
              cache,
              sourceDiagnosticRoots
            )
          : undefined) ??
          (signatureReturnProjection &&
          !containsTypeParameterProjection(signatureReturnProjection)
            ? signatureReturnProjection
            : checkerReturnProjection) ??
          signatureReturnProjection
      );
    }
    case TstsSyntax.KindConditionalExpression: {
      const conditional = TstsSyntax.AsConditionalExpression(node);
      let whenTrue = sourceExpressionTypeProjection(
        context,
        conditional?.WhenTrue,
        cache,
        sourceDiagnosticRoots
      );
      let whenFalse = sourceExpressionTypeProjection(
        context,
        conditional?.WhenFalse,
        cache,
        sourceDiagnosticRoots
      );
      const guard = typeofFunctionGuard(conditional?.Condition);
      const callableArm = guard
        ? singleCallableArmForExpression(context, guard.expression)
        : undefined;
      if (guard && callableArm) {
        if (
          guard.trueBranchIsCallable &&
          sameResolvedSymbol(context, guard.expression, conditional?.WhenTrue)
        ) {
          whenTrue = callableArm;
        } else if (
          !guard.trueBranchIsCallable &&
          sameResolvedSymbol(context, guard.expression, conditional?.WhenFalse)
        ) {
          whenFalse = callableArm;
        }
      }
      return set(combinedProjectedType("union", [whenTrue, whenFalse], node));
    }
    default:
      return set(
        checkerTypeProjection(
          context,
          context.checker.getNarrowedTypeAtLocation(node) ??
            context.checker.getTypeAtLocation(node)
        )
      );
  }
};

const initializerSourceProjectionRoot = (
  context: CheckedContext,
  initializer: TstsNode | undefined
): SourceBindingProjectedType | undefined => {
  if (!initializer) return undefined;
  if (
    initializer.Kind === TstsSyntax.KindArrowFunction ||
    initializer.Kind === TstsSyntax.KindFunctionExpression
  ) {
    return sourceFunctionExpressionProjection(context, initializer);
  }
  const symbol = context.checker.getSymbolAtLocation(initializer);
  const resolved = symbol ? context.checker.resolveAlias(symbol) : undefined;
  const declaration = resolved
    ? context.checker.getSymbolValueDeclaration(resolved)
    : undefined;
  const declaredType = getTstsDeclaredTypeNode(declaration);
  if (declaredType) {
    return projectedTypeFromTypeNode(context, declaredType);
  }
  const checkerType =
    context.checker.getNarrowedTypeAtLocation(initializer) ??
    context.checker.getTypeAtLocation(initializer);
  return checkerTypeProjection(context, checkerType);
};

const variableSourceProjectionRoot = (
  context: CheckedContext,
  declaration: TstsNode
): SourceBindingProjectedType | undefined => {
  const variable = TstsSyntax.AsVariableDeclaration(declaration);
  const declaredType = variable?.Type ?? TstsSyntax.Node_Type(declaration);
  return (
    projectedTypeFromTypeNode(context, declaredType) ??
    initializerSourceProjectionRoot(
      context,
      variable?.Initializer ?? TstsSyntax.Node_Initializer(declaration)
    )
  );
};

const setBindingProjectionFactsForName = (
  context: CheckedContext,
  node: TstsNode | undefined,
  rootType: SourceBindingProjectedType,
  accessPath: readonly SourceBindingAccessSegment[] = []
): void => {
  if (!node) return;
  if (node.Kind === TstsSyntax.KindIdentifier) {
    if (accessPath.length === 0) return;
    const projected = sourceBindingTypeAtPath(context, rootType, accessPath);
    if (projected) {
      context.facts.set(sourceBindingTypeProjectionFactKey, node, {
        type: projected,
      });
    }
    return;
  }

  const bindingPattern = TstsSyntax.AsBindingPattern(node);
  if (!bindingPattern?.Elements) return;
  bindingPattern.Elements.Nodes?.forEach((elementNode, index) => {
    if (!elementNode) return;
    const bindingElement = TstsSyntax.AsBindingElement(elementNode);
    const nameNode = TstsSyntax.Node_Name(elementNode);
    const propertyName =
      bindingElement?.PropertyName ??
      TstsSyntax.Node_PropertyNameOrName(elementNode);
    const segment: SourceBindingAccessSegment | undefined =
      node.Kind === TstsSyntax.KindArrayBindingPattern
        ? { kind: "element", index }
        : (() => {
            const name = bindingPatternPropertyName(propertyName, nameNode, index);
            return name ? { kind: "property", name } : undefined;
          })();
    if (!segment) return;
    setBindingProjectionFactsForName(
      context,
      nameNode,
      rootType,
      [...accessPath, segment]
    );
  });
};

const collectBindingTypeProjectionFacts = (context: CheckedContext): void => {
  visitTstsSubtree(context.sourceFile, (node): void => {
    if (!node || node.Kind !== TstsSyntax.KindVariableDeclaration) return;
    const name = TstsSyntax.Node_Name(node);
    if (
      name?.Kind !== TstsSyntax.KindObjectBindingPattern &&
      name?.Kind !== TstsSyntax.KindArrayBindingPattern
    ) {
      return;
    }
    const rootType = variableSourceProjectionRoot(context, node);
    if (!rootType) return;
    setBindingProjectionFactsForName(context, name, rootType);
  });
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
    singleDeclaration(
      declarations,
      (candidate) => sourceBindingDeclarationKind(candidate) !== undefined
    );
  const declarationKind = sourceBindingDeclarationKind(declaration);
  if (!declaration || !declarationKind) return undefined;
  const sourceFile = getTstsContainingSourceFile(declaration);
  const name =
    getTstsNodeNameText(declaration) ?? context.checker.getSymbolName(symbol);
  if (!name) return undefined;
  if (
    !sourceFile ||
    (sourceFile.IsDeclarationFile === true &&
      !isCorePackageSourceFile(sourceFile.FileName()) &&
      !hasExternalBindingDeclaration(sourceFile.FileName(), name))
  ) {
    return undefined;
  }
  return {
    sourceFileName: sourceFile.FileName(),
    name,
    declarationKind,
    topLevelStaticValue: isTopLevelStaticValueDeclaration(declaration),
    declaration,
  };
};

const sourceRuntimeVisibilityFactForBinding = (
  fact: SourceBindingIdentityFact
): SourceRuntimeVisibilityFact | undefined =>
  fact.name === "JsValue" && isCorePackageSourceFile(fact.sourceFileName)
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

const isAmbientRecordDeclaration = (
  declaration: TstsNode,
  sourceDiagnosticRoots: readonly string[]
): boolean =>
  getTstsNodeNameText(declaration) === "Record" &&
  isExternalSupportDeclaration(declaration, sourceDiagnosticRoots);

const isAmbientRecordTypeReference = (
  context: CheckedContext,
  node: TstsNode,
  sourceDiagnosticRoots: readonly string[]
): boolean => {
  if (getTstsTypeReferenceDetails(node)?.name !== "Record") return false;
  const type = context.checker.getTypeFromTypeNode(node);
  const symbols = [
    symbolForTypeReference(context, node),
    type ? context.checker.getTypeAliasOrSymbol(type) : undefined,
  ]
    .filter((symbol): symbol is TstsSymbol => symbol !== undefined)
    .map((symbol) => context.checker.resolveAlias(symbol) ?? symbol);

  return symbols.some((symbol) => {
    const declarations = context.checker.getSymbolDeclarations(symbol);
    return (
      declarations.length > 0 &&
      declarations.every((declaration) =>
        isExternalSupportDeclaration(declaration, sourceDiagnosticRoots)
      )
    );
  });
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
    ? singleDeclaration(
        context.checker.getSymbolDeclarations(symbol),
        (declaration) =>
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
  singleDeclaration(
    TstsSyntax.Node_Members(declaration) ?? [],
    (member) => member.Kind === TstsSyntax.KindConstructor
  );

const memberDeclarationByName = (
  owner: TstsNode,
  name: string,
  targetKind: Extract<SourceAttributeTargetKind, "method" | "property">
): TstsNode | undefined =>
  singleDeclaration(TstsSyntax.Node_Members(owner) ?? [], (member) => {
    if (getTstsNodeNameText(member) !== name) return false;
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
    ? singleDeclaration(
        context.checker.getSymbolDeclarations(symbol),
        () => true
      )
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

const isOverloadsRootCall = (
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
      "overloads"
  );
};

const selectedMemberName = (selector: TstsNode | undefined): string | undefined => {
  if (!selector || selector.Kind !== TstsSyntax.KindArrowFunction) {
    return undefined;
  }
  const body = unwrapParenthesizedExpression(TstsSyntax.Node_Body(selector));
  return body?.Kind === TstsSyntax.KindPropertyAccessExpression
    ? getTstsIdentifierText(TstsSyntax.Node_Name(body))
    : undefined;
};

const memberDeclarationsByName = (
  owner: TstsNode,
  name: string
): readonly TstsNode[] =>
  (TstsSyntax.Node_Members(owner) ?? []).filter(
    (member): member is TstsNode =>
      member !== undefined &&
      getTstsNodeNameText(member) === name &&
      member.Kind === TstsSyntax.KindMethodDeclaration
  );

type OverloadBuilderTarget = {
  readonly owner: TstsNode;
  readonly implementation?: TstsNode;
};

const parseOverloadBuilderTarget = (
  context: CheckedContext,
  node: TstsNode | undefined,
  coreLangBindingByLocalName: ReadonlyMap<
    string,
    { readonly importedName: string }
  >
): OverloadBuilderTarget | undefined => {
  const expression = unwrapParenthesizedExpression(node);
  if (!expression) return undefined;

  if (isOverloadsRootCall(expression, coreLangBindingByLocalName)) {
    const typeArgument = getTstsTypeArguments(expression)[0];
    const owner = attributeTypeTargetDeclaration(context, typeArgument);
    return owner ? { owner } : undefined;
  }

  if (expression.Kind !== TstsSyntax.KindCallExpression) return undefined;
  const callee = TstsSyntax.Node_Expression(expression);
  if (callee?.Kind !== TstsSyntax.KindPropertyAccessExpression) {
    return undefined;
  }
  const memberName = getTstsIdentifierText(TstsSyntax.Node_Name(callee));
  const base = parseOverloadBuilderTarget(
    context,
    TstsSyntax.Node_Expression(callee),
    coreLangBindingByLocalName
  );
  if (!base) return undefined;
  if (memberName !== "method") return base;
  const implementation = selectedMemberDeclaration(
    context,
    base.owner,
    (TstsSyntax.Node_Arguments(expression) ?? [])[0],
    "method"
  );
  return implementation ? { ...base, implementation } : base;
};

const appendOverloadFamilyFact = (
  context: CheckedContext,
  declaration: TstsNode,
  implementation: TstsNode
): void => {
  const existing =
    context.facts.get(sourceOverloadFamilyFactKey, declaration)
      ?.implementations ?? [];
  if (existing.includes(implementation)) return;
  const fact: SourceOverloadFamilyFact = {
    implementations: [...existing, implementation],
  };
  context.facts.set(sourceOverloadFamilyFactKey, declaration, fact);
};

const overloadFamilyImplementationMatchesDeclaration = (
  context: CheckedContext,
  declaration: TstsNode,
  implementation: TstsNode
): boolean => {
  const declarationSignature = context.checker.getSignatureFromDeclaration(
    declaration
  );
  const implementationSignature = context.checker.getSignatureFromDeclaration(
    implementation
  );
  const declarationParameters =
    context.checker.getSignatureParameters(declarationSignature);
  const implementationParameters =
    context.checker.getSignatureParameters(implementationSignature);
  if (declarationParameters.length !== implementationParameters.length) {
    return false;
  }
  return declarationParameters.every((declarationParameter, index) => {
    const implementationParameter = implementationParameters[index];
    if (!implementationParameter) return false;
    const declarationType =
      context.checker.getTypeOfSignatureParameter(declarationParameter);
    const implementationType =
      context.checker.getTypeOfSignatureParameter(implementationParameter);
    return (
      context.checker.isTypeIdenticalTo(declarationType, implementationType) ||
      (context.checker.isTypeAssignableTo(declarationType, implementationType) &&
        context.checker.isTypeAssignableTo(implementationType, declarationType))
    );
  });
};

const collectOverloadFamilyFacts = (
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
    if (getTstsIdentifierText(TstsSyntax.Node_Name(callee)) !== "family") {
      return;
    }
    const base = parseOverloadBuilderTarget(
      context,
      TstsSyntax.Node_Expression(callee),
      coreLangBindingByLocalName
    );
    if (!base?.implementation) return;
    const familyName = selectedMemberName((TstsSyntax.Node_Arguments(node) ?? [])[0]);
    if (!familyName) return;
    for (const declaration of memberDeclarationsByName(base.owner, familyName)) {
      if (
        overloadFamilyImplementationMatchesDeclaration(
          context,
          declaration,
          base.implementation
        )
      ) {
        appendOverloadFamilyFact(context, declaration, base.implementation);
      }
    }
  });
};

const selectedOverloadCallImplementationFact = (
  context: CheckedContext,
  node: TstsNode
): SourceOverloadCallImplementationFact | undefined => {
  const signature = context.checker.getResolvedSignature(node);
  const declaration = context.checker.getSignatureDeclaration(signature);
  if (!declaration) return undefined;
  const family = context.facts.get(sourceOverloadFamilyFactKey, declaration);
  const implementation =
    family?.implementations.length === 1 ? family.implementations[0] : undefined;
  return implementation ? { implementation } : undefined;
};

const collectOverloadCallImplementationFacts = (
  context: CheckedContext
): void => {
  visitTstsSubtree(context.sourceFile, (node): void => {
    if (
      !node ||
      (node.Kind !== TstsSyntax.KindCallExpression &&
        node.Kind !== TstsSyntax.KindNewExpression)
    ) {
      return;
    }
    const fact = selectedOverloadCallImplementationFact(context, node);
    if (fact) {
      context.facts.set(sourceOverloadCallImplementationFactKey, node, fact);
    }
  });
};

export type TsonicSourceSemanticsExtensionOptions = {
  readonly sourceDiagnosticRoots: readonly string[];
};

export const createTsonicSourceSemanticsExtension = (
  options: TsonicSourceSemanticsExtensionOptions
): CompilerExtension => {
  const sourceDiagnosticRoots = normalizeSourceDiagnosticRoots(
    options.sourceDiagnosticRoots
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
      if (isAmbientRecordDeclaration(node, sourceDiagnosticRoots)) {
        context.facts.set(sourceDictionaryTypeFactKey, node, recordDictionaryFact);
      }

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
    const shouldProjectSourceTypes =
      context.sourceFile.IsDeclarationFile !== true && !isCoreSourceFile;
    const shouldValidateSourceDiagnostics =
      shouldProjectSourceTypes &&
      isSourceDiagnosticFile(sourceFileName, sourceDiagnosticRoots);
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
    collectOverloadFamilyFacts(context, coreLangBindingByLocalName);
    collectOverloadCallImplementationFacts(context);
    collectBindingTypeProjectionFacts(context);
    const expressionProjectionCache: SourceExpressionProjectionCache =
      new WeakMap();

    visitTstsSubtree(context.sourceFile, (node): void => {
      if (!node) return;

      setDeclarationBindingFacts(context, node);
      if (isAmbientRecordDeclaration(node, sourceDiagnosticRoots)) {
        context.facts.set(sourceDictionaryTypeFactKey, node, recordDictionaryFact);
      }

      if (TstsSyntax.IsIdentifier(node)) {
        const symbol = symbolForName(context, node);
        setSourceBindingIdentityFact(context, node, symbol);
        const targetSymbol = symbol ? genericAliasTargets.get(symbol) : undefined;
        if (targetSymbol) {
          context.facts.set(genericFunctionAliasFactKey, node, {
            resolvedName: context.checker.getSymbolName(targetSymbol),
          });
        }
      }

      if (shouldProjectSourceTypes && isTstsDeclarationLikeNode(node)) {
        const declarationProjection = declarationTypeProjectionFact(context, node);
        if (declarationProjection) {
          context.facts.set(
            sourceDeclarationTypeProjectionFactKey,
            node,
            declarationProjection
          );
        }
      }

      if (
        node.Kind === TstsSyntax.KindTypeReference ||
        node.Kind === TstsSyntax.KindExpressionWithTypeArguments
      ) {
        const symbol = symbolForTypeReference(context, node);
        setSourceBindingIdentityFact(
          context,
          node,
          symbol ? context.checker.resolveAlias(symbol) : undefined
        );
        if (isAmbientRecordTypeReference(context, node, sourceDiagnosticRoots)) {
          context.facts.set(sourceDictionaryTypeFactKey, node, recordDictionaryFact);
        }
      }

      if (shouldProjectSourceTypes && isSourceTypeProjectionNode(node)) {
        const typeProjection = projectedTypeFromTypeNode(context, node);
        if (typeProjection && typeProjection.kind !== "type-node") {
          context.facts.set(sourceTypeNodeProjectionFactKey, node, {
            type: typeProjection,
          });
        }
      }

      const computedName =
        node.Kind === TstsSyntax.KindComputedPropertyName
          ? isWellKnownSymbolName(context, node, sourceDiagnosticRoots)
          : undefined;
      if (computedName) {
        context.facts.set(wellKnownComputedNameFactKey, node, {
          kind: computedName,
        });
      }

      const expressionKind = expressionSemanticsKind(
        context,
        node,
        sourceDiagnosticRoots
      );
      if (expressionKind) {
        context.facts.set(expressionSemanticsFactKey, node, {
          kind: expressionKind,
        });
      }

      const runtimeOperation = sourceRuntimeOperation(
        context,
        node,
        sourceDiagnosticRoots
      );
      if (runtimeOperation) {
        context.facts.set(sourceRuntimeOperationFactKey, node, runtimeOperation);
      }

      if (
        shouldProjectSourceTypes &&
        (node.Kind === TstsSyntax.KindCallExpression ||
          node.Kind === TstsSyntax.KindNewExpression)
      ) {
        const argumentTypes = callArgumentTypesFact(context, node);
        if (argumentTypes) {
          context.facts.set(sourceCallArgumentTypesFactKey, node, argumentTypes);
        }
      }

      setInitializerReferencesDeclarationFact(context, node);

      if (shouldProjectSourceTypes && isSourceExpressionProjectionNode(node)) {
        const expressionProjection = sourceExpressionTypeProjection(
          context,
          node,
          expressionProjectionCache,
          sourceDiagnosticRoots
        );
        if (expressionProjection) {
          const contextualProjection = checkerTypeProjection(
            context,
            context.checker.getContextualType(node)
          );
          const storageProjection = sourceExpressionStorageProjection(
            context,
            node,
            expressionProjectionCache,
            sourceDiagnosticRoots
          );
          context.facts.set(sourceExpressionTypeProjectionFactKey, node, {
            type: expressionProjection,
            ...(storageProjection ? { storageType: storageProjection } : {}),
            ...(contextualProjection
              ? { contextualType: contextualProjection }
              : {}),
          });
        }
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
          TstsSyntax.KindFunctionDeclaration,
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
	        const inCompileTimeMarkerExpression = parents.some((parent) =>
	          isCompileTimeMarkerApiExpression(parent, context)
	        );
	        if (
	          !parameterType &&
	          !inCompileTimeMarkerExpression
	        ) {
	          const contextualType = functionParent
	            ? context.checker.getContextualType(functionParent)
	            : undefined;
	          if (
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
        if (
          isAmbientGlobalIdentifier(
            context,
            callee,
            "Array",
            sourceDiagnosticRoots
          )
        ) {
          addSourceDiagnostic(
            context,
            "TSN2001",
            node,
            "Array constructor inference is not supported; use an array literal or explicit collection type."
          );
        }
        if (
          isAmbientGlobalPropertyAccess(
            context,
            callee,
            "Array",
            "isArray",
            sourceDiagnosticRoots
          )
        ) {
          const [argument] = call?.arguments ?? [];
          const argumentType = context.checker.getTypeAtLocation(argument);
          const argumentDeclaredType = declaredTypeNodeForExpression(
            context,
            argument
          );
          if (
            argumentType &&
            context.checker.isUnknownType(argumentType) &&
            !isJsValueCarrier(
              context.checker,
              argumentType,
              argumentDeclaredType,
              coreTypesBindingByLocalName
            ) &&
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
        if (
          isAmbientGlobalPropertyAccess(
            context,
            callee,
            "JSON",
            "parse",
            sourceDiagnosticRoots
          )
        ) {
          const explicitTypeArguments = getTstsTypeArguments(node);
          const resultContext = context.checker.getContextualType(node);
          const resultType =
            explicitTypeArguments.length > 0
              ? context.checker.getTypeFromTypeNode(explicitTypeArguments[0])
              : resultContext;
          const resultTypeNode =
            explicitTypeArguments[0] ??
            declaredTypeNodeForExpression(context, node);
          if (
            isBroadJsonType(
              context.checker,
              resultType,
              resultTypeNode,
              coreTypesBindingByLocalName
            )
          ) {
            addSourceDiagnostic(
              context,
              "TSN5001",
              node,
              "JSON.parse target must be a concrete DTO or JsValue carrier.",
              { capabilityFeatureKey: "broad-json-targets" }
            );
          }
        }
        if (
          isAmbientGlobalPropertyAccess(
            context,
            callee,
            "JSON",
            "stringify",
            sourceDiagnosticRoots
          )
        ) {
          const [argument] = call?.arguments ?? [];
          const argumentType = context.checker.getTypeAtLocation(argument);
          if (
            isBroadJsonType(
              context.checker,
              argumentType,
              declaredTypeNodeForExpression(context, argument),
              coreTypesBindingByLocalName
            )
          ) {
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
        context.facts.has(sourceDictionaryTypeFactKey, node)
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
	        const parameters = getTstsParameters(node);
	        const hasExplicitParameterTypes = parameters.every((parameter) =>
	          Boolean(getTstsDeclaredTypeNode(parameter))
	        );
	        const hasExplicitReturnType = Boolean(getTstsDeclaredTypeNode(node));
	        if (
	          !hasExplicitParameterTypes ||
	          !hasExplicitReturnType
	        ) {
	          const contextualType = context.checker.getContextualType(node);
	          if (!contextualType) {
	            addSourceDiagnostic(
	              context,
	              "TSN7430",
	              node,
	              "Arrow functions without contextual typing require explicit parameter and return types."
	            );
	          }
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
