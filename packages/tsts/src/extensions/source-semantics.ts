import type { bool } from "../go/scalars.js";
import type { GoPtr } from "../go/compat.js";
import type { Node, SourceFile } from "../internal/ast/ast.js";
import type { Symbol } from "../internal/ast/symbol.js";
import {
  Node_Arguments,
  Node_Expression,
  Node_Elements,
  Node_ImportClause,
  Node_Initializer,
  Node_ModuleSpecifier,
  Node_PropertyName,
  Node_Properties,
  Node_Statements,
  Node_Symbol,
  Node_Text,
  Node_TypeArguments,
} from "../internal/ast/ast.js";
import { Node_ForEachChild, Node_Name } from "../internal/ast/spine.js";
import { AsExportDeclaration, AsExportSpecifier, AsImportClause, AsNamespaceImport, AsPropertyAccessExpression, AsQualifiedName, AsTypeReferenceNode } from "../internal/ast/generated/casts.js";
import {
  KindCallExpression,
  KindExportDeclaration,
  KindImportDeclaration,
  KindNamedImports,
  KindNamedExports,
  KindNamespaceImport,
  KindObjectLiteralExpression,
  KindPropertyAccessExpression,
  KindPropertyAssignment,
  KindPropertyDeclaration,
  KindQualifiedName,
  KindTypeKeyword,
  KindTypeReference,
  KindTupleType,
  KindVariableDeclaration,
} from "../internal/ast/generated/kinds.js";
import { IsLeftHandSideExpression } from "../internal/ast/utilities.js";
import {
  argumentPassingFactKey,
  attributeFactKey,
  canonicalIdentityFactKey,
  defaultValueFactKey,
  fieldFactKey,
  flowStateFactKey,
  functionPointerFactKey,
  pointerFactKey,
  sourcePrimitiveFactKey,
  structFactKey,
} from "./facts.js";
import type {
  ArgumentPassingFact,
  AttributeFact,
  DefaultValueFact,
  ExtensionCanonicalIdentity,
  ExtensionImportKind,
  FieldFact,
  FlowStateFact,
  FunctionPointerFact,
  PointerFact,
  SourcePrimitiveFact,
  SourcePrimitiveKind,
  StructFact,
} from "./facts.js";
import { ExtensionLifecycleEvent } from "./host.js";
import type {
  CompilerExtension,
  CompilerExtensionIdentity,
  ExtensionDiagnosticStore,
  ExtensionEvidence,
  ExtensionFactKey,
  ExtensionFactResolverContext,
  ExtensionFactSubject,
  ExtensionFactStore,
  SourceFileBoundLifecycleRequest,
} from "./host.js";

export interface SourceSemanticsExtensionOptions {
  readonly identity: CompilerExtensionIdentity;
  readonly modules: readonly SourceSemanticsModule[];
}

export type SourceSemanticsModuleCapability = "primitive" | "call-marker" | "type-marker";

export interface SourceSemanticsModuleIdentity {
  readonly moduleSpecifier: string;
  readonly packageName?: string;
  readonly packageVersion?: string;
  readonly subpath?: string;
  readonly capabilities?: readonly SourceSemanticsModuleCapability[];
}

export interface SourceSemanticsModule extends SourceSemanticsModuleIdentity {
  readonly exports: readonly SourceSemanticsExportDeclaration[];
}

export type SourceSemanticsExportDeclaration =
  | SourcePrimitiveDeclaration
  | SourceCallMarkerDeclaration
  | SourceTypeMarkerDeclaration;

export interface SourcePrimitiveDeclaration extends Omit<SourcePrimitiveFact, "kind"> {
  readonly kind: "source-primitive";
  readonly exportName: string;
  readonly primitive: SourcePrimitiveKind;
}

export type SourceCallMarkerKind =
  | "out"
  | "ref"
  | "inref"
  | "borrow"
  | "borrowMut"
  | "move"
  | "struct"
  | "field"
  | "attribute"
  | "defaultof";

type ArgumentPassingMarkerKind = Extract<SourceCallMarkerKind, "out" | "ref" | "inref">;

export interface SourceCallMarkerDeclaration {
  readonly kind: "call-marker";
  readonly exportName: string;
  readonly marker: SourceCallMarkerKind;
}

export type SourceTypeMarkerKind = "ptr" | "fnptr";

export interface SourceTypeMarkerDeclaration {
  readonly kind: "type-marker";
  readonly exportName: string;
  readonly marker: SourceTypeMarkerKind;
}

interface SourceSemanticsMarkerImportIndex {
  readonly primitivesByLocalName: ReadonlyMap<string, SourcePrimitiveImportBinding>;
  readonly callMarkersByLocalName: ReadonlyMap<string, SourceCallMarkerDeclaration>;
  readonly typeMarkersByLocalName: ReadonlyMap<string, SourceTypeMarkerDeclaration>;
  readonly namespacesByLocalName: ReadonlyMap<string, SourceSemanticsModuleRuntime>;
}

interface SourcePrimitiveImportBinding {
  readonly moduleIdentity: SourceSemanticsModuleRuntime;
  readonly exportName: string;
  readonly primitiveFact: SourcePrimitiveDeclaration;
}

interface SourceSemanticsModuleRuntime extends SourceSemanticsModuleIdentity {
  readonly primitivesByExportName: ReadonlyMap<string, SourcePrimitiveDeclaration>;
  readonly callMarkersByExportName: ReadonlyMap<string, SourceCallMarkerDeclaration>;
  readonly typeMarkersByExportName: ReadonlyMap<string, SourceTypeMarkerDeclaration>;
}

function createSourceSemanticsModules(modules: readonly SourceSemanticsModule[]): readonly SourceSemanticsModuleRuntime[] {
  return modules.map((module) => {
    const primitivesByExportName = new Map<string, SourcePrimitiveDeclaration>();
    const callMarkersByExportName = new Map<string, SourceCallMarkerDeclaration>();
    const typeMarkersByExportName = new Map<string, SourceTypeMarkerDeclaration>();
    for (const exportDeclaration of module.exports) {
      switch (exportDeclaration.kind) {
        case "source-primitive":
          primitivesByExportName.set(exportDeclaration.exportName, exportDeclaration);
          break;
        case "call-marker":
          callMarkersByExportName.set(exportDeclaration.exportName, exportDeclaration);
          break;
        case "type-marker":
          typeMarkersByExportName.set(exportDeclaration.exportName, exportDeclaration);
          break;
      }
    }
    return {
      moduleSpecifier: module.moduleSpecifier,
      ...(module.packageName !== undefined ? { packageName: module.packageName } : {}),
      ...(module.packageVersion !== undefined ? { packageVersion: module.packageVersion } : {}),
      ...(module.subpath !== undefined ? { subpath: module.subpath } : {}),
      ...(module.capabilities !== undefined ? { capabilities: module.capabilities } : {}),
      primitivesByExportName,
      callMarkersByExportName,
      typeMarkersByExportName,
    };
  });
}

export function createSourceSemanticsExtension(options: SourceSemanticsExtensionOptions): CompilerExtension {
  const modules = createSourceSemanticsModules(options.modules);
  return {
    identity: options.identity,
    composition: {
      kind: "source",
    },
    capabilities: {
      provides: [
        "source-semantics.primitives",
        "source-semantics.argument-passing",
        "source-semantics.pointer-types",
        "source-semantics.flow-markers",
        "source-semantics.structs",
        "source-semantics.attributes",
        "source-semantics.defaults",
      ],
    },
    initialize(context): void {
      context.factResolver.register(sourcePrimitiveFactKey, (subject, resolverContext) =>
        resolveSourcePrimitiveFact(subject, resolverContext, modules));
      context.registerLifecycleHook<SourceFileBoundLifecycleRequest>(ExtensionLifecycleEvent.afterSourceFileBound, (request) => {
        recordSourceSemanticsFacts(request, context.facts, context.diagnostics, options.identity.id, modules);
      });
    },
  };
}

function recordSourceSemanticsFacts(
  request: SourceFileBoundLifecycleRequest,
  facts: ExtensionFactStore,
  diagnostics: ExtensionDiagnosticStore,
  extensionId: string,
  modules: readonly SourceSemanticsModuleRuntime[],
): void {
  const sourceFile = getLifecycleSourceFile(request);
  if (sourceFile === undefined) {
    return;
  }

  for (const statement of Node_Statements(sourceFile) ?? []) {
    if (statement?.Kind === KindImportDeclaration) {
      const moduleIdentity = getSourceSemanticsModuleIdentity(statement, modules);
      if (moduleIdentity !== undefined) {
        recordSourceSemanticsImportClause(facts, statement, moduleIdentity);
      }
      continue;
    }
    if (statement?.Kind === KindExportDeclaration) {
      const moduleIdentity = getSourceSemanticsModuleIdentity(statement, modules);
      if (moduleIdentity !== undefined) {
        recordSourceSemanticsExportClause(facts, statement, moduleIdentity);
      }
    }
  }
  const markerImportIndex = createSourceSemanticsMarkerImportIndex(sourceFile, modules);
  recordSourceSemanticsCallMarkers(facts, diagnostics, extensionId, sourceFile, modules, markerImportIndex);
  recordSourceSemanticsTypeReferences(facts, sourceFile, modules, markerImportIndex);
}

function recordSourceSemanticsImportClause(
  facts: ExtensionFactStore,
  importDeclaration: GoPtr<Node>,
  moduleIdentity: SourceSemanticsModuleRuntime,
): void {
  const importClause = Node_ImportClause(importDeclaration);
  if (importClause === undefined) {
    return;
  }
  const typedImport = AsImportClause(importClause)!.PhaseModifier === KindTypeKeyword;
  const namedBindings = AsImportClause(importClause)!.NamedBindings;
  if (namedBindings === undefined) {
    return;
  }
  if (namedBindings.Kind === KindNamespaceImport) {
    recordNamespaceImportIdentity(facts, namedBindings, moduleIdentity, typedImport);
    return;
  }
  if (namedBindings.Kind !== KindNamedImports) {
    return;
  }
  for (const importSpecifier of Node_Elements(namedBindings) ?? []) {
    if (importSpecifier === undefined) {
      continue;
    }
    const localName = Node_Name(importSpecifier);
    if (localName === undefined) {
      continue;
    }
    const exportName = Node_Text(Node_PropertyName(importSpecifier) ?? localName);
    const primitiveFact = moduleIdentity.primitivesByExportName.get(exportName);
    if (primitiveFact !== undefined) {
      recordSourcePrimitiveImport(facts, importSpecifier, moduleIdentity, exportName, primitiveFact, typedImport);
      continue;
    }
    if (moduleIdentity.callMarkersByExportName.has(exportName)) {
      recordSourceSemanticsSymbolImport(facts, importSpecifier, moduleIdentity, exportName, typedImport ? "type" : "value");
      continue;
    }
    if (moduleIdentity.typeMarkersByExportName.has(exportName)) {
      recordSourceSemanticsSymbolImport(facts, importSpecifier, moduleIdentity, exportName, typedImport ? "type" : "value");
    }
  }
}

function recordSourceSemanticsExportClause(
  facts: ExtensionFactStore,
  exportDeclaration: GoPtr<Node>,
  moduleIdentity: SourceSemanticsModuleRuntime,
): void {
  const exportClause = AsExportDeclaration(exportDeclaration)!.ExportClause;
  if (exportClause === undefined || exportClause.Kind !== KindNamedExports) {
    return;
  }
  const declarationIsTypeOnly = AsExportDeclaration(exportDeclaration)!.IsTypeOnly;
  for (const exportSpecifier of Node_Elements(exportClause) ?? []) {
    if (exportSpecifier === undefined) {
      continue;
    }
    const exportedName = Node_Name(exportSpecifier);
    if (exportedName === undefined) {
      continue;
    }
    const sourceName = Node_Text(Node_PropertyName(exportSpecifier) ?? exportedName);
    const primitiveFact = moduleIdentity.primitivesByExportName.get(sourceName);
    if (primitiveFact !== undefined) {
      const specifierIsTypeOnly = AsExportSpecifier(exportSpecifier)!.IsTypeOnly;
      recordSourcePrimitiveImport(facts, exportSpecifier, moduleIdentity, sourceName, primitiveFact, declarationIsTypeOnly || specifierIsTypeOnly);
      continue;
    }
    const specifierIsTypeOnly = AsExportSpecifier(exportSpecifier)!.IsTypeOnly;
    if (moduleIdentity.callMarkersByExportName.has(sourceName)) {
      recordSourceSemanticsSymbolImport(facts, exportSpecifier, moduleIdentity, sourceName, declarationIsTypeOnly || specifierIsTypeOnly ? "type" : "value");
      continue;
    }
    if (moduleIdentity.typeMarkersByExportName.has(sourceName)) {
      recordSourceSemanticsSymbolImport(facts, exportSpecifier, moduleIdentity, sourceName, declarationIsTypeOnly || specifierIsTypeOnly ? "type" : "value");
    }
  }
}

function recordSourceSemanticsCallMarkers(
  facts: ExtensionFactStore,
  diagnostics: ExtensionDiagnosticStore,
  extensionId: string,
  sourceFile: GoPtr<SourceFile>,
  modules: readonly SourceSemanticsModuleRuntime[],
  markerImportIndex: SourceSemanticsMarkerImportIndex,
): void {
  visitSourceSemanticsNodePost(sourceFile, (node) => {
    if (node?.Kind !== KindCallExpression) {
      return;
    }
    const marker = resolveSourceSemanticsCallMarkerReference(facts, Node_Expression(node), modules, markerImportIndex);
    if (marker === undefined) {
      return;
    }
    recordSourceSemanticsCallMarker(facts, diagnostics, extensionId, node, marker);
  });
}

function recordSourceSemanticsCallMarker(
  facts: ExtensionFactStore,
  diagnostics: ExtensionDiagnosticStore,
  extensionId: string,
  callExpression: Node,
  marker: SourceCallMarkerDeclaration,
): void {
  const evidence = createMarkerEvidence(marker.exportName);
  switch (marker.marker) {
    case "out":
    case "ref":
    case "inref": {
      const argument = (Node_Arguments(callExpression) ?? [])[0];
      if (argument === undefined) {
        return;
      }
      recordArgumentPassingMarker(facts, diagnostics, extensionId, callExpression, argument, marker, evidence);
      return;
    }
    case "borrow": {
      const argument = (Node_Arguments(callExpression) ?? [])[0];
      if (argument === undefined) {
        return;
      }
      recordFlowMarker(facts, callExpression, argument, { state: "borrowed-shared" }, evidence);
      return;
    }
    case "borrowMut": {
      const argument = (Node_Arguments(callExpression) ?? [])[0];
      if (argument === undefined) {
        return;
      }
      recordFlowMarker(facts, callExpression, argument, { state: "borrowed-mut" }, evidence);
      return;
    }
    case "move": {
      const argument = (Node_Arguments(callExpression) ?? [])[0];
      if (argument === undefined) {
        return;
      }
      recordFlowMarker(facts, callExpression, argument, { state: "moved" }, evidence);
      return;
    }
    case "field":
      recordFieldMarker(facts, callExpression, evidence);
      return;
    case "struct":
      recordStructMarker(facts, callExpression, evidence);
      return;
    case "attribute":
      recordAttributeMarker(facts, callExpression, evidence);
      return;
    case "defaultof":
      recordDefaultValueMarker(facts, callExpression, evidence);
      return;
  }
}

function recordArgumentPassingMarker(
  facts: ExtensionFactStore,
  diagnostics: ExtensionDiagnosticStore,
  extensionId: string,
  callExpression: Node,
  target: Node,
  marker: SourceCallMarkerDeclaration,
  evidence: readonly ExtensionEvidence[],
): void {
  const fact = {
    mode: getArgumentPassingMode(marker.marker as ArgumentPassingMarkerKind),
    targetExpression: target,
  } satisfies ArgumentPassingFact;
  facts.set(callExpression, argumentPassingFactKey, fact, evidence);
  if (IsLeftHandSideExpression(target)) {
    facts.set(target, argumentPassingFactKey, fact, evidence);
    return;
  }
  diagnostics.append({
    extensionId,
    extensionCode: "SOURCE_SEMANTICS_NON_STORAGE_ARGUMENT",
    numericCode: 9901101,
    publicCode: "TSTS_SOURCE_SEMANTICS_0001",
    category: "error",
    message: `${marker.exportName}(...) requires a storage expression.`,
    nodeOrSpan: target,
    evidence,
    identity: `source-semantics-non-storage:${marker.exportName}:${String(target?.id ?? "unknown")}`,
  });
}

function getArgumentPassingMode(kind: ArgumentPassingMarkerKind): ArgumentPassingFact["mode"] {
  switch (kind) {
    case "out":
      return "byref-writeonly-must-init";
    case "ref":
      return "byref-readwrite";
    case "inref":
      return "byref-readonly";
  }
}

function recordFieldMarker(
  facts: ExtensionFactStore,
  callExpression: Node,
  evidence: readonly ExtensionEvidence[],
): void {
  const fieldType = (Node_TypeArguments(callExpression) ?? [])[0];
  if (fieldType === undefined) {
    return;
  }
  const propertyAssignment = callExpression?.Parent?.Kind === KindPropertyAssignment ? callExpression.Parent : undefined;
  const nameNode = propertyAssignment === undefined ? undefined : (Node_Name(propertyAssignment) ?? Node_PropertyName(propertyAssignment));
  const name = Node_Text(nameNode);
  const fact = {
    name,
    type: fieldType,
  } satisfies FieldFact;
  facts.set(callExpression, fieldFactKey, fact, evidence);
  if (propertyAssignment !== undefined) {
    facts.set(propertyAssignment, fieldFactKey, fact, evidence);
    if (nameNode !== undefined) {
      facts.set(nameNode, fieldFactKey, fact, evidence);
    }
  }
}

function recordStructMarker(
  facts: ExtensionFactStore,
  callExpression: Node,
  evidence: readonly ExtensionEvidence[],
): void {
  const shape = (Node_Arguments(callExpression) ?? [])[0];
  const fields: FieldFact[] = [];
  if (shape?.Kind === KindObjectLiteralExpression) {
    for (const property of Node_Properties(shape) ?? []) {
      if (property?.Kind !== KindPropertyAssignment) {
        continue;
      }
      const initializer = Node_Initializer(property);
      const field = facts.get(property, fieldFactKey) ?? (initializer === undefined ? undefined : facts.get(initializer, fieldFactKey));
      if (field !== undefined) {
        fields.push(field);
      }
    }
  }
  const fact = {
    valueType: true,
    fields,
  } satisfies StructFact;
  facts.set(callExpression, structFactKey, fact, evidence);
  recordInitializerOwnerFact(facts, callExpression, structFactKey, fact, evidence);
}

function recordAttributeMarker(
  facts: ExtensionFactStore,
  callExpression: Node,
  evidence: readonly ExtensionEvidence[],
): void {
  const target = (Node_TypeArguments(callExpression) ?? [])[0];
  if (target === undefined) {
    return;
  }
  const fact = {
    target,
    attributeName: getTypeReferenceNameText(target),
    arguments: definedFactSubjects(Node_Arguments(callExpression) ?? []),
  } satisfies AttributeFact;
  facts.set(callExpression, attributeFactKey, fact, evidence);
  recordInitializerOwnerFact(facts, callExpression, attributeFactKey, fact, evidence);
}

function recordDefaultValueMarker(
  facts: ExtensionFactStore,
  callExpression: Node,
  evidence: readonly ExtensionEvidence[],
): void {
  const type = (Node_TypeArguments(callExpression) ?? [])[0];
  if (type === undefined) {
    return;
  }
  const fact = { type } satisfies DefaultValueFact;
  facts.set(callExpression, defaultValueFactKey, fact, evidence);
  recordInitializerOwnerFact(facts, callExpression, defaultValueFactKey, fact, evidence);
}

function recordInitializerOwnerFact<TFact>(
  facts: ExtensionFactStore,
  callExpression: Node,
  key: ExtensionFactKey<TFact>,
  fact: TFact,
  evidence: readonly ExtensionEvidence[],
): void {
  const parent = callExpression?.Parent;
  if (parent === undefined || !isInitializerOwner(parent) || Node_Initializer(parent) !== callExpression) {
    return;
  }
  facts.set(parent, key, fact, evidence);
  const symbol = Node_Symbol(parent);
  if (symbol !== undefined) {
    facts.set(symbol, key, fact, evidence);
  }
}

function isInitializerOwner(node: GoPtr<Node>): boolean {
  return node?.Kind === KindVariableDeclaration || node?.Kind === KindPropertyDeclaration || node?.Kind === KindPropertyAssignment;
}

function recordFlowMarker(
  facts: ExtensionFactStore,
  callExpression: Node,
  target: Node,
  fact: FlowStateFact,
  evidence: readonly ExtensionEvidence[],
): void {
  facts.set(callExpression, flowStateFactKey, fact, evidence);
  facts.set(target, flowStateFactKey, fact, evidence);
  const symbol = Node_Symbol(target);
  if (symbol !== undefined) {
    facts.set(symbol, flowStateFactKey, fact, evidence);
  }
}

function resolveSourcePrimitiveFact(
  subject: ExtensionFactSubject,
  context: ExtensionFactResolverContext,
  modules: readonly SourceSemanticsModuleRuntime[],
): { readonly value: SourcePrimitiveFact; readonly evidence?: readonly ExtensionEvidence[] } | undefined {
  if (subject === null || subject === undefined || typeof subject !== "object") {
    return undefined;
  }
  const node = subject as GoPtr<Node>;
  if (node?.Kind !== KindTypeReference) {
    return undefined;
  }
  const typeName = AsTypeReferenceNode(node)?.TypeName;
  const primitive = resolvePrimitiveTypeReference(context.facts, typeName, modules);
  if (primitive === undefined) {
    return undefined;
  }
  return {
    value: stripExportName(primitive.primitiveFact),
    evidence: createPrimitiveEvidence(primitive.moduleIdentity, primitive.exportName),
  };
}

function recordSourceSemanticsTypeReferences(
  facts: ExtensionFactStore,
  sourceFile: GoPtr<SourceFile>,
  modules: readonly SourceSemanticsModuleRuntime[],
  markerImportIndex: SourceSemanticsMarkerImportIndex,
): void {
  visitSourceSemanticsNode(sourceFile, (node) => {
    if (node?.Kind !== KindTypeReference) {
      return;
    }
    const typeName = AsTypeReferenceNode(node)!.TypeName;
    if (typeName === undefined) {
      return;
    }
    const marker = resolveSourceSemanticsTypeMarkerReference(facts, typeName, modules, markerImportIndex);
    if (marker !== undefined) {
      recordSourceSemanticsTypeMarker(facts, node, typeName, marker);
    }
    const primitive = resolvePrimitiveTypeReference(facts, typeName, modules, markerImportIndex);
    if (primitive === undefined) {
      return;
    }
    const evidence = createPrimitiveEvidence(primitive.moduleIdentity, primitive.exportName);
    facts.set(node, canonicalIdentityFactKey, primitive.identity, evidence);
    facts.set(node, sourcePrimitiveFactKey, stripExportName(primitive.primitiveFact), evidence);
    facts.set(typeName, canonicalIdentityFactKey, primitive.identity, evidence);
    facts.set(typeName, sourcePrimitiveFactKey, stripExportName(primitive.primitiveFact), evidence);
    if (typeName.Kind === KindQualifiedName) {
      const right = AsQualifiedName(typeName)!.Right;
      if (right === undefined) {
        return;
      }
      facts.set(right, canonicalIdentityFactKey, primitive.identity, evidence);
      facts.set(right, sourcePrimitiveFactKey, stripExportName(primitive.primitiveFact), evidence);
    }
  });
}

function recordSourceSemanticsTypeMarker(
  facts: ExtensionFactStore,
  typeReference: Node,
  typeName: Node,
  marker: SourceTypeMarkerDeclaration,
): void {
  const typeArguments = Node_TypeArguments(typeReference) ?? [];
  const evidence = createMarkerEvidence(marker.exportName);
  if (marker.marker === "ptr") {
    const pointee = typeArguments[0];
    if (pointee === undefined) {
      return;
    }
    const fact = {
      pointee,
      mutability: "target-defined",
      unsafeRequired: true,
    } satisfies PointerFact;
    facts.set(typeReference, pointerFactKey, fact, evidence);
    facts.set(typeName, pointerFactKey, fact, evidence);
    return;
  }
  const result = typeArguments[1];
  if (result === undefined) {
    return;
  }
  const parameters = getFunctionPointerParameters(typeArguments[0]);
  const fact = {
    parameters,
    result,
    abi: ["target-default"],
  } satisfies FunctionPointerFact;
  facts.set(typeReference, functionPointerFactKey, fact, evidence);
  facts.set(typeName, functionPointerFactKey, fact, evidence);
}

function getFunctionPointerParameters(parameterList: GoPtr<Node>): readonly ExtensionFactSubject[] {
  if (parameterList === undefined) {
    return [];
  }
  if (parameterList.Kind === KindTupleType) {
    return definedFactSubjects(Node_Elements(parameterList) ?? []);
  }
  return [parameterList];
}

function resolveSourceSemanticsCallMarkerReference(
  facts: ExtensionFactStore,
  node: GoPtr<Node>,
  modules: readonly SourceSemanticsModuleRuntime[],
  markerImportIndex: SourceSemanticsMarkerImportIndex,
): SourceCallMarkerDeclaration | undefined {
  return resolveSourceSemanticsMarkerFromImportIndex(node, markerImportIndex.callMarkersByLocalName, markerImportIndex.namespacesByLocalName, "call-marker")
    ?? resolveSourceSemanticsMarkerReference(facts, node, modules, "call-marker");
}

function resolveSourceSemanticsTypeMarkerReference(
  facts: ExtensionFactStore,
  node: GoPtr<Node>,
  modules: readonly SourceSemanticsModuleRuntime[],
  markerImportIndex: SourceSemanticsMarkerImportIndex,
): SourceTypeMarkerDeclaration | undefined {
  return resolveSourceSemanticsMarkerFromImportIndex(node, markerImportIndex.typeMarkersByLocalName, markerImportIndex.namespacesByLocalName, "type-marker")
    ?? resolveSourceSemanticsMarkerReference(facts, node, modules, "type-marker");
}

function resolveSourceSemanticsMarkerFromImportIndex<TMarker extends { readonly exportName: string }>(
  node: GoPtr<Node>,
  markersByLocalName: ReadonlyMap<string, TMarker>,
  namespacesByLocalName: ReadonlyMap<string, SourceSemanticsModuleRuntime>,
  capability: SourceSemanticsModuleCapability,
): TMarker | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (node.Kind === KindPropertyAccessExpression) {
    const receiverName = Node_Text(AsPropertyAccessExpression(node)?.Expression);
    const namespaceModule = namespacesByLocalName.get(receiverName);
    const propertyName = Node_Text(Node_Name(node));
    const marker = getModuleMarker(namespaceModule, capability, propertyName);
    return marker as TMarker | undefined;
  }
  if (node.Kind === KindQualifiedName) {
    const qualifiedName = AsQualifiedName(node);
    const namespaceModule = namespacesByLocalName.get(Node_Text(qualifiedName?.Left));
    const marker = getModuleMarker(namespaceModule, capability, Node_Text(qualifiedName?.Right));
    return marker as TMarker | undefined;
  }
  return markersByLocalName.get(Node_Text(node));
}

function resolveSourceSemanticsMarkerReference<TMarker extends { readonly exportName: string }>(
  facts: ExtensionFactStore,
  node: GoPtr<Node>,
  modules: readonly SourceSemanticsModuleRuntime[],
  capability: SourceSemanticsModuleCapability,
): TMarker | undefined {
  if (node === undefined) {
    return undefined;
  }
  if (node.Kind === KindPropertyAccessExpression) {
    const propertyName = Node_Text(Node_Name(node));
    const receiverSymbol = Node_Symbol(AsPropertyAccessExpression(node)?.Expression);
    const receiverIdentity = receiverSymbol === undefined ? undefined : facts.get(receiverSymbol, canonicalIdentityFactKey);
    if (receiverIdentity?.kind !== "module") {
      return undefined;
    }
    const module = modules.find((candidate) => candidate.moduleSpecifier === receiverIdentity.id);
    return getModuleMarker(module, capability, propertyName) as TMarker | undefined;
  }
  if (node.Kind === KindQualifiedName) {
    const qualifiedName = AsQualifiedName(node);
    const exportName = Node_Text(qualifiedName?.Right);
    const leftSymbol = Node_Symbol(qualifiedName?.Left);
    const leftIdentity = leftSymbol === undefined ? undefined : facts.get(leftSymbol, canonicalIdentityFactKey);
    if (leftIdentity?.kind !== "module") {
      return undefined;
    }
    const module = modules.find((candidate) => candidate.moduleSpecifier === leftIdentity.id);
    return getModuleMarker(module, capability, exportName) as TMarker | undefined;
  }
  const symbol = Node_Symbol(node);
  const identity = symbol === undefined ? undefined : facts.get(symbol, canonicalIdentityFactKey);
  if (identity?.exportName === undefined) {
    return undefined;
  }
  const module = modules.find((candidate) => identity.id === `${candidate.moduleSpecifier}::${identity.exportName}`);
  return getModuleMarker(module, capability, identity.exportName) as TMarker | undefined;
}

function createSourceSemanticsMarkerImportIndex(
  sourceFile: GoPtr<SourceFile>,
  modules: readonly SourceSemanticsModuleRuntime[],
): SourceSemanticsMarkerImportIndex {
  const primitivesByLocalName = new Map<string, SourcePrimitiveImportBinding>();
  const callMarkersByLocalName = new Map<string, SourceCallMarkerDeclaration>();
  const typeMarkersByLocalName = new Map<string, SourceTypeMarkerDeclaration>();
  const namespacesByLocalName = new Map<string, SourceSemanticsModuleRuntime>();
  for (const statement of Node_Statements(sourceFile) ?? []) {
    if (statement?.Kind !== KindImportDeclaration) {
      continue;
    }
    const moduleIdentity = getSourceSemanticsModuleIdentity(statement, modules);
    if (moduleIdentity === undefined) {
      continue;
    }
    const namedBindings = AsImportClause(Node_ImportClause(statement))?.NamedBindings;
    if (namedBindings === undefined) {
      continue;
    }
    if (namedBindings.Kind === KindNamespaceImport) {
      const namespaceName = Node_Text(Node_Name(namedBindings));
      if (namespaceName !== "") {
        namespacesByLocalName.set(namespaceName, moduleIdentity);
      }
      continue;
    }
    if (namedBindings.Kind !== KindNamedImports) {
      continue;
    }
    for (const importSpecifier of Node_Elements(namedBindings) ?? []) {
      const localName = Node_Text(Node_Name(importSpecifier));
      const exportName = Node_Text(Node_PropertyName(importSpecifier) ?? Node_Name(importSpecifier));
      const primitive = moduleIdentity.primitivesByExportName.get(exportName);
      if (primitive !== undefined) {
        primitivesByLocalName.set(localName, { moduleIdentity, exportName, primitiveFact: primitive });
      }
      const callMarker = moduleIdentity.callMarkersByExportName.get(exportName);
      if (callMarker !== undefined) {
        callMarkersByLocalName.set(localName, callMarker);
      }
      const typeMarker = moduleIdentity.typeMarkersByExportName.get(exportName);
      if (typeMarker !== undefined) {
        typeMarkersByLocalName.set(localName, typeMarker);
      }
    }
  }
  return { primitivesByLocalName, callMarkersByLocalName, typeMarkersByLocalName, namespacesByLocalName };
}

function resolvePrimitiveTypeReference(
  facts: ExtensionFactStore,
  typeName: GoPtr<Node>,
  modules: readonly SourceSemanticsModuleRuntime[],
  importIndex?: SourceSemanticsMarkerImportIndex,
): { readonly moduleIdentity: SourceSemanticsModuleRuntime; readonly exportName: string; readonly primitiveFact: SourcePrimitiveDeclaration; readonly identity: ExtensionCanonicalIdentity } | undefined {
  if (typeName === undefined) {
    return undefined;
  }
  if (typeName.Kind === KindQualifiedName) {
    return resolveQualifiedPrimitiveFromImportIndex(typeName, importIndex)
      ?? resolveQualifiedPrimitiveReference(facts, typeName, modules);
  }

  const indexedPrimitive = resolvePrimitiveFromImportIndex(typeName, importIndex);
  if (indexedPrimitive !== undefined) {
    return indexedPrimitive;
  }

  const typeNameSymbol = Node_Symbol(typeName);
  if (typeNameSymbol === undefined) {
    return undefined;
  }
  const primitiveFact = facts.get(typeNameSymbol, sourcePrimitiveFactKey);
  const identity = facts.get(typeNameSymbol, canonicalIdentityFactKey);
  if (primitiveFact === undefined || identity === undefined || identity.exportName === undefined) {
    return undefined;
  }
  const moduleIdentity = modules.find((candidate) => identity.id === `${candidate.moduleSpecifier}::${identity.exportName}`);
  if (moduleIdentity === undefined) {
    return undefined;
  }
  const declaration = moduleIdentity.primitivesByExportName.get(identity.exportName);
  if (declaration === undefined) {
    return undefined;
  }
  return { moduleIdentity, exportName: identity.exportName, primitiveFact: declaration, identity };
}

function resolvePrimitiveFromImportIndex(
  typeName: GoPtr<Node>,
  importIndex: SourceSemanticsMarkerImportIndex | undefined,
): { readonly moduleIdentity: SourceSemanticsModuleRuntime; readonly exportName: string; readonly primitiveFact: SourcePrimitiveDeclaration; readonly identity: ExtensionCanonicalIdentity } | undefined {
  if (typeName === undefined || importIndex === undefined) {
    return undefined;
  }
  const binding = importIndex.primitivesByLocalName.get(Node_Text(typeName));
  if (binding === undefined) {
    return undefined;
  }
  const symbol = Node_Symbol(typeName);
  return {
    ...binding,
    identity: createExportIdentity(binding.moduleIdentity, binding.exportName, "type", symbol === undefined ? `${binding.moduleIdentity.moduleSpecifier}::${binding.exportName}` : getSymbolFactId(symbol)),
  };
}

function resolveQualifiedPrimitiveFromImportIndex(
  typeName: GoPtr<Node>,
  importIndex: SourceSemanticsMarkerImportIndex | undefined,
): { readonly moduleIdentity: SourceSemanticsModuleRuntime; readonly exportName: string; readonly primitiveFact: SourcePrimitiveDeclaration; readonly identity: ExtensionCanonicalIdentity } | undefined {
  if (typeName === undefined || importIndex === undefined) {
    return undefined;
  }
  const qualifiedName = AsQualifiedName(typeName);
  const moduleIdentity = importIndex.namespacesByLocalName.get(Node_Text(qualifiedName?.Left));
  if (moduleIdentity === undefined) {
    return undefined;
  }
  const right = qualifiedName!.Right;
  const exportName = Node_Text(right);
  const primitiveFact = moduleIdentity.primitivesByExportName.get(exportName);
  if (primitiveFact === undefined) {
    return undefined;
  }
  const symbol = Node_Symbol(right);
  return {
    moduleIdentity,
    exportName,
    primitiveFact,
    identity: createExportIdentity(moduleIdentity, exportName, "type", symbol === undefined ? `${moduleIdentity.moduleSpecifier}::${exportName}` : getSymbolFactId(symbol)),
  };
}

function resolveQualifiedPrimitiveReference(
  facts: ExtensionFactStore,
  typeName: GoPtr<Node>,
  modules: readonly SourceSemanticsModuleRuntime[],
): { readonly moduleIdentity: SourceSemanticsModuleRuntime; readonly exportName: string; readonly primitiveFact: SourcePrimitiveDeclaration; readonly identity: ExtensionCanonicalIdentity } | undefined {
  const qualifiedName = AsQualifiedName(typeName);
  const leftSymbol = Node_Symbol(qualifiedName?.Left);
  if (leftSymbol === undefined) {
    return undefined;
  }
  const moduleIdentityFact = facts.get(leftSymbol, canonicalIdentityFactKey);
  if (moduleIdentityFact?.kind !== "module") {
    return undefined;
  }
  const moduleIdentity = modules.find((candidate) => candidate.moduleSpecifier === moduleIdentityFact.id);
  if (moduleIdentity === undefined) {
    return undefined;
  }
  const right = qualifiedName!.Right;
  const exportName = Node_Text(right);
  const primitiveFact = moduleIdentity.primitivesByExportName.get(exportName);
  if (primitiveFact === undefined) {
    return undefined;
  }
  const rightSymbol = Node_Symbol(right);
  const identity = createExportIdentity(moduleIdentity, exportName, "type", rightSymbol === undefined ? `${moduleIdentity.moduleSpecifier}::${exportName}` : getSymbolFactId(rightSymbol));
  return { moduleIdentity, exportName, primitiveFact, identity };
}

function visitSourceSemanticsNode(node: GoPtr<Node>, visit: (node: GoPtr<Node>) => void): void {
  if (node === undefined) {
    return;
  }
  visit(node);
  Node_ForEachChild(node, (child: GoPtr<Node>) => {
    visitSourceSemanticsNode(child, visit);
    return false as bool;
  });
}

function visitSourceSemanticsNodePost(node: GoPtr<Node>, visit: (node: GoPtr<Node>) => void): void {
  if (node === undefined) {
    return;
  }
  Node_ForEachChild(node, (child: GoPtr<Node>) => {
    visitSourceSemanticsNodePost(child, visit);
    return false as bool;
  });
  visit(node);
}

function definedFactSubjects<T extends object>(subjects: readonly (T | undefined)[]): readonly ExtensionFactSubject[] {
  return subjects.filter((subject): subject is T => subject !== undefined);
}

function recordNamespaceImportIdentity(
  facts: ExtensionFactStore,
  namespaceImport: Node,
  moduleIdentity: SourceSemanticsModuleIdentity,
  typedImport: boolean,
): void {
  const namespaceSymbol = Node_Symbol(namespaceImport);
  if (namespaceSymbol === undefined) {
    return;
  }
  facts.set(namespaceImport, canonicalIdentityFactKey, createModuleIdentity(moduleIdentity, "namespace", getSymbolFactId(namespaceSymbol)), createModuleEvidence(moduleIdentity));
  facts.set(namespaceSymbol, canonicalIdentityFactKey, createModuleIdentity(moduleIdentity, typedImport ? "type" : "namespace", getSymbolFactId(namespaceSymbol)), createModuleEvidence(moduleIdentity));
}

function getSourceSemanticsModuleIdentity(node: GoPtr<Node>, modules: readonly SourceSemanticsModuleRuntime[]): SourceSemanticsModuleRuntime | undefined {
  const moduleSpecifier = Node_ModuleSpecifier(node);
  return moduleSpecifier === undefined
    ? undefined
    : modules.find((candidate) => candidate.moduleSpecifier === Node_Text(moduleSpecifier));
}

function recordSourcePrimitiveImport(
  facts: ExtensionFactStore,
  importSpecifier: Node,
  moduleIdentity: SourceSemanticsModuleIdentity,
  exportName: string,
  primitiveFact: SourcePrimitiveDeclaration,
  typedImport: boolean,
): void {
  const localSymbol = Node_Symbol(importSpecifier);
  if (localSymbol === undefined) {
    return;
  }
  const identity = createExportIdentity(moduleIdentity, exportName, typedImport ? "type" : "value", getSymbolFactId(localSymbol));
  const evidence = createPrimitiveEvidence(moduleIdentity, exportName);
  facts.set(importSpecifier, canonicalIdentityFactKey, identity, evidence);
  facts.set(importSpecifier, sourcePrimitiveFactKey, stripExportName(primitiveFact), evidence);
  facts.set(localSymbol, canonicalIdentityFactKey, identity, evidence);
  facts.set(localSymbol, sourcePrimitiveFactKey, stripExportName(primitiveFact), evidence);
}

function recordSourceSemanticsSymbolImport(
  facts: ExtensionFactStore,
  importSpecifier: Node,
  moduleIdentity: SourceSemanticsModuleIdentity,
  exportName: string,
  importKind: ExtensionImportKind,
): void {
  const localSymbol = Node_Symbol(importSpecifier);
  if (localSymbol === undefined) {
    return;
  }
  const identity = createExportIdentity(moduleIdentity, exportName, importKind, getSymbolFactId(localSymbol));
  facts.set(importSpecifier, canonicalIdentityFactKey, identity, createModuleEvidence(moduleIdentity));
  facts.set(localSymbol, canonicalIdentityFactKey, identity, createModuleEvidence(moduleIdentity));
}

function createModuleIdentity(moduleIdentity: SourceSemanticsModuleIdentity, importKind: ExtensionImportKind, canonicalSymbolId: string): ExtensionCanonicalIdentity {
  return {
    kind: "module",
    id: moduleIdentity.moduleSpecifier,
    ...(moduleIdentity.packageName !== undefined ? { packageName: moduleIdentity.packageName } : {}),
    ...(moduleIdentity.packageVersion !== undefined ? { packageVersion: moduleIdentity.packageVersion } : {}),
    subpath: moduleIdentity.subpath ?? moduleIdentity.moduleSpecifier,
    importKind,
    canonicalSymbolId,
  };
}

function createExportIdentity(moduleIdentity: SourceSemanticsModuleIdentity, exportName: string, importKind: ExtensionImportKind, canonicalSymbolId: string): ExtensionCanonicalIdentity {
  return {
    kind: "export",
    id: `${moduleIdentity.moduleSpecifier}::${exportName}`,
    ...(moduleIdentity.packageName !== undefined ? { packageName: moduleIdentity.packageName } : {}),
    ...(moduleIdentity.packageVersion !== undefined ? { packageVersion: moduleIdentity.packageVersion } : {}),
    subpath: moduleIdentity.subpath ?? moduleIdentity.moduleSpecifier,
    exportName,
    importKind,
    canonicalSymbolId,
  };
}

function createPrimitiveEvidence(moduleIdentity: SourceSemanticsModuleIdentity, exportName: string): readonly ExtensionEvidence[] {
  return [{
    message: "source primitive import",
    details: {
      moduleSpecifier: moduleIdentity.moduleSpecifier,
      exportName,
    },
  }];
}

function createModuleEvidence(moduleIdentity: SourceSemanticsModuleIdentity): readonly ExtensionEvidence[] {
  return [{
    message: "source semantics module import",
    details: {
      moduleSpecifier: moduleIdentity.moduleSpecifier,
    },
  }];
}

function createMarkerEvidence(exportName: string): readonly ExtensionEvidence[] {
  return [{
    message: "source semantics marker",
    details: { exportName },
  }];
}

function getTypeReferenceNameText(node: GoPtr<Node>): string {
  if (node?.Kind === KindTypeReference) {
    return getTypeReferenceNameText(AsTypeReferenceNode(node)?.TypeName);
  }
  if (node?.Kind === KindQualifiedName) {
    const qualifiedName = AsQualifiedName(node);
    const left = getTypeReferenceNameText(qualifiedName?.Left);
    const right = getTypeReferenceNameText(qualifiedName?.Right);
    return left === "" ? right : `${left}.${right}`;
  }
  return Node_Text(node);
}

function getModuleMarker(moduleIdentity: SourceSemanticsModuleRuntime | undefined, capability: SourceSemanticsModuleCapability, exportName: string): SourceCallMarkerDeclaration | SourceTypeMarkerDeclaration | undefined {
  if (moduleIdentity === undefined) {
    return undefined;
  }
  switch (capability) {
    case "call-marker":
      return moduleIdentity.callMarkersByExportName.get(exportName);
    case "type-marker":
      return moduleIdentity.typeMarkersByExportName.get(exportName);
    case "primitive":
      return undefined;
  }
}

function stripExportName(declaration: SourcePrimitiveDeclaration): SourcePrimitiveFact {
  return {
    kind: declaration.primitive,
    runtimeBase: declaration.runtimeBase,
    ...(declaration.signed !== undefined ? { signed: declaration.signed } : {}),
    ...(declaration.width !== undefined ? { width: declaration.width } : {}),
  };
}

export function sourcePrimitive(
  exportName: string,
  primitiveKind: SourcePrimitiveKind,
  runtimeBase: SourcePrimitiveFact["runtimeBase"],
  signed?: boolean,
  width?: number,
): SourcePrimitiveDeclaration {
  return {
    kind: "source-primitive",
    exportName,
    primitive: primitiveKind,
    runtimeBase,
    ...(signed !== undefined ? { signed } : {}),
    ...(width !== undefined ? { width } : {}),
  };
}

function getSymbolFactId(symbol: Symbol): string {
  return `${symbol.Name}:${String(symbol.id)}`;
}

function getLifecycleSourceFile(request: SourceFileBoundLifecycleRequest): GoPtr<SourceFile> {
  if (typeof request.sourceFile !== "object" || request.sourceFile === null) {
    return undefined;
  }
  return request.sourceFile as SourceFile;
}
