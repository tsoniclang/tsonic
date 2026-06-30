import {
  attributeFactKey,
  canonicalIdentityFactKey,
  createSourceSemanticsExtension,
  ExtensionLifecycleEvent,
  fieldFactKey,
} from "@tsonic/tsts";
import type {
  AstReader,
  AttributeFact,
  CompilerExtension,
  ExtensionEvidence,
  ExtensionFactSubject,
  ExtensionFactStore,
  FieldFact,
  Node,
  SourceFileBoundLifecycleRequest,
  TypeCheckerQueries,
} from "@tsonic/tsts";
import {
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
} from "./identity.js";
import {
  tsonicCoreSourceSemanticsModules,
} from "./source-modules.js";
import {
  createTsonicCoreVirtualModulesProvider,
} from "./virtual-modules.js";

export function createTsonicCoreSourceExtension(): CompilerExtension {
  const sourceSemantics = createSourceSemanticsExtension({
    identity: {
      id: tsonicCoreSourceExtensionId,
      version: tsonicCoreProviderVersion,
      capabilityNamespace: "tsonic.source-core",
    },
    modules: tsonicCoreSourceSemanticsModules(),
  });
  return {
    ...sourceSemantics,
    initialize(context): void {
      context.registerTargetBindingProvider(createTsonicCoreVirtualModulesProvider());
      sourceSemantics.initialize?.(context);
      context.registerLifecycleHook<SourceFileBoundLifecycleRequest>(ExtensionLifecycleEvent.afterSourceFileBound, (request, lifecycleContext): void => {
        recordUnsupportedTsonicCoreLangReExportDiagnostics(request, lifecycleContext.compiler.ast, lifecycleContext.host.diagnostics);
        recordTsonicAttributeBuilderFacts(request, lifecycleContext.compiler.ast, lifecycleContext.host.facts);
        recordTsonicStructFieldFactsAndDiagnostics(request, lifecycleContext.compiler.ast, lifecycleContext.compiler.checker, lifecycleContext.host.facts, lifecycleContext.host.diagnostics);
        recordTsonicMissingTypeEvidenceDiagnostics(request, lifecycleContext.compiler.ast, lifecycleContext.compiler.checker, lifecycleContext.host.facts, lifecycleContext.host.diagnostics);
      });
    },
  };
}

const attributeBuilderChainMethods = new Set([
  "constructor",
  "method",
  "parameter",
  "property",
  "target",
]);

const attributeBuilderEvidence = [{
  message: "Tsonic source-core attribute builder chain",
}] satisfies readonly ExtensionEvidence[];

const missingTypeEvidenceDiagnostics = {
  attribute: {
    extensionCode: "SOURCE_SEMANTICS_MISSING_ATTRIBUTE_TARGET_EVIDENCE",
    numericCode: 9901105,
    message: "attribute<T>() requires explicit target type evidence.",
  },
  defaultof: {
    extensionCode: "SOURCE_SEMANTICS_MISSING_DEFAULT_TYPE_EVIDENCE",
    numericCode: 9901106,
    message: "defaultof<T>() requires explicit type evidence.",
  },
  field: {
    extensionCode: "SOURCE_SEMANTICS_MISSING_FIELD_TYPE_EVIDENCE",
    numericCode: 9901102,
    message: "field<T>() requires explicit field type evidence.",
  },
} as const;

const structFieldDiagnostics = {
  duplicateField: {
    extensionCode: "SOURCE_SEMANTICS_STRUCT_DUPLICATE_FIELD",
    numericCode: 9901107,
    message: "struct(...) field shape contains a duplicate static field name.",
  },
  fieldContext: {
    extensionCode: "SOURCE_SEMANTICS_FIELD_CONTEXT_NOT_PROVEN",
    numericCode: 9901108,
    message: "field<T>() requires a proven static field-containing context.",
  },
  structMember: {
    extensionCode: "SOURCE_SEMANTICS_STRUCT_FIELD_NOT_PROVEN",
    numericCode: 9901109,
    message: "struct(...) field shape members require finalized field<T>() facts.",
  },
} as const;

const unsupportedCoreLangReExportDiagnostic = {
  extensionCode: "SOURCE_SEMANTICS_CORE_LANG_REEXPORT_UNSUPPORTED",
  numericCode: 9901110,
  message: "Re-exporting @tsonic/core/lang.js intrinsics through a local barrel is unsupported; import source-core intrinsics directly so provider ownership remains proven.",
} as const;

const sourceCoreLangExportNames = new Set(
  tsonicCoreSourceSemanticsModules()
    .find((module) => module.moduleSpecifier === tsonicCoreLangModule)
    ?.exports.map((entry) => entry.exportName) ?? [],
);

type DiagnosticSink = {
  append(diagnostic: {
    readonly extensionId: string;
    readonly extensionCode: string;
    readonly numericCode: number;
    readonly publicCode?: string;
    readonly category: "error";
    readonly message: string;
    readonly nodeOrSpan?: unknown;
    readonly evidence?: readonly ExtensionEvidence[];
    readonly identity?: string;
  }): void;
};

function recordUnsupportedTsonicCoreLangReExportDiagnostics(
  request: SourceFileBoundLifecycleRequest,
  ast: AstReader,
  diagnostics: DiagnosticSink,
): void {
  const sourceFile = request.sourceFile as Node | undefined;
  if (sourceFile === undefined) {
    return;
  }
  for (const statement of ast.statements(sourceFile)) {
    if (statement === undefined || !ast.is.IsExportDeclaration(statement)) {
      continue;
    }
    const moduleSpecifier = ast.as.AsExportDeclaration(statement)?.ModuleSpecifier;
    if (moduleSpecifier === undefined || ast.text(moduleSpecifier) !== tsonicCoreLangModule) {
      continue;
    }
    const exportedNames = exportedCoreLangIntrinsicNames(statement, ast);
    if (exportedNames.length === 0) {
      continue;
    }
    diagnostics.append({
      extensionId: tsonicCoreSourceExtensionId,
      extensionCode: unsupportedCoreLangReExportDiagnostic.extensionCode,
      numericCode: unsupportedCoreLangReExportDiagnostic.numericCode,
      publicCode: `TSONIC_SOURCE_CORE_${unsupportedCoreLangReExportDiagnostic.numericCode}`,
      category: "error",
      message: unsupportedCoreLangReExportDiagnostic.message,
      nodeOrSpan: statement,
      evidence: [{
        message: "Source-core portable intrinsic ownership does not flow through local re-export barrels.",
        details: {
          moduleSpecifier: tsonicCoreLangModule,
          exportedNames,
        },
      }],
      identity: `source-core-lang-reexport:${String((statement as { readonly id?: unknown }).id ?? "unknown")}`,
    });
  }
}

function exportedCoreLangIntrinsicNames(exportDeclaration: Node, ast: AstReader): readonly string[] {
  const exportClause = ast.as.AsExportDeclaration(exportDeclaration)?.ExportClause;
  if (exportClause === undefined) {
    return ["*"];
  }
  if (!ast.is.IsNamedExports(exportClause)) {
    return ["*"];
  }
  const exportedNames: string[] = [];
  for (const specifier of ast.elements(exportClause)) {
    if (specifier === undefined) {
      continue;
    }
    const exportNameNode = (specifier as { readonly PropertyName?: Node }).PropertyName ?? ast.name(specifier);
    const exportName = exportNameNode === undefined ? undefined : ast.text(exportNameNode);
    if (exportName !== undefined && sourceCoreLangExportNames.has(exportName)) {
      exportedNames.push(exportName);
    }
  }
  return exportedNames;
}

function recordTsonicAttributeBuilderFacts(
  request: SourceFileBoundLifecycleRequest,
  ast: AstReader,
  facts: ExtensionFactStore,
): void {
  const sourceFile = request.sourceFile as Node | undefined;
  visitSourceFile(sourceFile, ast, (node): void => {
    if (!ast.is.IsCallExpression(node)) {
      return;
    }
    const call = ast.as.AsCallExpression(node);
    const callee = call?.Expression;
    if (!ast.is.IsPropertyAccessExpression(callee) || ast.text(ast.name(callee)) !== "add") {
      return;
    }
    const attributeArguments = ast.arguments(node);
    const attributeExpression = attributeArguments[0];
    if (attributeExpression === undefined) {
      return;
    }
    const applicationTarget = resolveAttributeBuilderTarget(ast.as.AsPropertyAccessExpression(callee)?.Expression, ast, facts);
    if (applicationTarget === undefined) {
      return;
    }
    const attributeFactArguments: ExtensionFactSubject[] = [];
    for (const argument of attributeArguments.slice(1)) {
      if (argument !== undefined) {
        attributeFactArguments.push(argument);
      }
    }
    facts.set(node, attributeFactKey, {
      target: attributeExpression,
      attributeName: staticExpressionName(attributeExpression, ast),
      arguments: attributeFactArguments,
    } satisfies AttributeFact, attributeBuilderEvidence);
  });
}

function recordTsonicStructFieldFactsAndDiagnostics(
  request: SourceFileBoundLifecycleRequest,
  ast: AstReader,
  checker: TypeCheckerQueries,
  facts: ExtensionFactStore,
  diagnostics: DiagnosticSink,
): void {
  const sourceFile = request.sourceFile as Node | undefined;
  visitSourceFile(sourceFile, ast, (node): void => {
    if (!ast.is.IsCallExpression(node) || ast.typeArguments(node).length === 0) {
      return;
    }
    const callee = ast.as.AsCallExpression(node)?.Expression;
    if (resolveSourceCoreLangExportName(callee, ast, checker, facts) === "field") {
      recordSourceCoreFieldContextFact(node, ast, facts, diagnostics);
    }
  });
  visitSourceFile(sourceFile, ast, (node): void => {
    if (!ast.is.IsCallExpression(node)) {
      return;
    }
    const callee = ast.as.AsCallExpression(node)?.Expression;
    if (resolveSourceCoreLangExportName(callee, ast, checker, facts) === "struct") {
      validateSourceCoreStructShape(node, ast, facts, diagnostics);
    }
  });
}

function recordSourceCoreFieldContextFact(
  callExpression: Node,
  ast: AstReader,
  facts: ExtensionFactStore,
  diagnostics: DiagnosticSink,
): void {
  if (facts.get<FieldFact>(callExpression, fieldFactKey) !== undefined) {
    return;
  }
  const fieldType = ast.typeArguments(callExpression)[0];
  if (fieldType === undefined) {
    return;
  }
  const context = fieldContainingContext(callExpression, ast);
  if (context === undefined) {
    appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.fieldContext, callExpression, [
      { message: "Source-core field marker was not the initializer of a static field declaration or struct-shape property." },
    ]);
    return;
  }
  const fact = {
    name: context.name,
    type: fieldType,
  } satisfies FieldFact;
  const evidence = [{ message: "Tsonic source-core field fact from proven static field-containing context." }];
  facts.set(callExpression, fieldFactKey, fact, evidence);
  facts.set(context.owner, fieldFactKey, fact, evidence);
  if (context.nameNode !== undefined) {
    facts.set(context.nameNode, fieldFactKey, fact, evidence);
  }
}

function validateSourceCoreStructShape(
  callExpression: Node,
  ast: AstReader,
  facts: ExtensionFactStore,
  diagnostics: DiagnosticSink,
): void {
  const shape = ast.arguments(callExpression)[0];
  if (shape === undefined || !ast.is.IsObjectLiteralExpression(shape)) {
    return;
  }
  const seenFields = new Map<string, Node>();
  for (const property of ast.properties(shape)) {
    if (property === undefined || !ast.is.IsPropertyAssignment(property)) {
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.structMember, property ?? shape, [
        { message: "Struct shape member is not a property assignment with a field<T>() initializer." },
      ]);
      continue;
    }
    const nameNode = ast.name(property);
    const name = staticSourcePropertyName(nameNode, ast);
    const initializer = ast.as.AsPropertyAssignment(property)?.Initializer;
    const field = facts.get<FieldFact>(property, fieldFactKey) ??
      facts.get<FieldFact>(initializer, fieldFactKey) ??
      facts.get<FieldFact>(nameNode, fieldFactKey);
    if (name === undefined || field === undefined) {
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.structMember, property, [
        { message: "Struct shape property lacks finalized field name/type evidence.", details: { hasStaticName: name !== undefined, hasFieldFact: field !== undefined } },
      ]);
      continue;
    }
    const previous = seenFields.get(name);
    if (previous !== undefined) {
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.duplicateField, property, [
        { message: "Duplicate static struct field name.", details: { name } },
      ]);
      continue;
    }
    seenFields.set(name, property);
  }
}

function recordTsonicMissingTypeEvidenceDiagnostics(
  request: SourceFileBoundLifecycleRequest,
  ast: AstReader,
  checker: TypeCheckerQueries,
  facts: ExtensionFactStore,
  diagnostics: DiagnosticSink,
): void {
  const sourceFile = request.sourceFile as Node | undefined;
  visitSourceFile(sourceFile, ast, (node): void => {
    if (!ast.is.IsCallExpression(node) || ast.typeArguments(node).length > 0) {
      return;
    }
    const callee = ast.as.AsCallExpression(node)?.Expression;
    const marker = resolveSourceCoreLangExportName(callee, ast, checker, facts);
    if (marker !== "attribute" && marker !== "defaultof" && marker !== "field") {
      return;
    }
    const diagnostic = missingTypeEvidenceDiagnostics[marker];
    diagnostics.append({
      extensionId: tsonicCoreSourceExtensionId,
      extensionCode: diagnostic.extensionCode,
      numericCode: diagnostic.numericCode,
      publicCode: `TSONIC_SOURCE_CORE_${diagnostic.numericCode}`,
      category: "error",
      message: diagnostic.message,
      nodeOrSpan: node,
      evidence: [{ message: "Tsonic source-core marker requires explicit type evidence.", details: { marker } }],
      identity: `source-core-missing-type-evidence:${marker}:${String((node as { readonly id?: unknown }).id ?? "unknown")}`,
    });
  });
}

function appendStructFieldDiagnostic(
  diagnostics: DiagnosticSink,
  diagnostic: typeof structFieldDiagnostics[keyof typeof structFieldDiagnostics],
  node: Node,
  evidence: readonly ExtensionEvidence[],
): void {
  diagnostics.append({
    extensionId: tsonicCoreSourceExtensionId,
    extensionCode: diagnostic.extensionCode,
    numericCode: diagnostic.numericCode,
    publicCode: `TSONIC_SOURCE_CORE_${diagnostic.numericCode}`,
    category: "error",
    message: diagnostic.message,
    nodeOrSpan: node,
    evidence,
    identity: `source-core-struct-field:${diagnostic.extensionCode}:${String((node as { readonly id?: unknown }).id ?? "unknown")}`,
  });
}

function resolveSourceCoreLangExportName(
  node: Node | undefined,
  ast: AstReader,
  checker: TypeCheckerQueries,
  facts: ExtensionFactStore,
): string | undefined {
  if (node === undefined) {
    return undefined;
  }
  const symbol = getSymbolAtLocationIfAvailable(checker, node);
  const symbolIdentity = facts.get(symbol, canonicalIdentityFactKey);
  if (symbolIdentity?.kind === "export" && symbolIdentity.id === `${tsonicCoreLangModule}::${symbolIdentity.exportName}`) {
    return symbolIdentity.exportName;
  }
  if (!ast.is.IsPropertyAccessExpression(node)) {
    return undefined;
  }
  const receiver = ast.as.AsPropertyAccessExpression(node)?.Expression;
  const receiverSymbol = getSymbolAtLocationIfAvailable(checker, receiver);
  const receiverIdentity = facts.get(receiverSymbol, canonicalIdentityFactKey);
  if (receiverIdentity?.kind !== "module" || receiverIdentity.id !== tsonicCoreLangModule) {
    return undefined;
  }
  const propertyName = ast.text(ast.name(node));
  return propertyName === "" ? undefined : propertyName;
}

function getSymbolAtLocationIfAvailable(checker: TypeCheckerQueries, node: Node | undefined): ExtensionFactSubject | undefined {
  if (node === undefined) {
    return undefined;
  }
  try {
    return checker.getSymbolAtLocation(node);
  } catch {
    return undefined;
  }
}

function resolveAttributeBuilderTarget(
  expression: Node | undefined,
  ast: AstReader,
  facts: ExtensionFactStore,
): ExtensionFactSubject | undefined {
  if (expression === undefined || !ast.is.IsCallExpression(expression)) {
    return undefined;
  }
  const rootFact = facts.get<AttributeFact>(expression, attributeFactKey);
  if (rootFact !== undefined) {
    return rootFact.target;
  }
  const callee = ast.as.AsCallExpression(expression)?.Expression;
  if (!ast.is.IsPropertyAccessExpression(callee)) {
    return undefined;
  }
  const methodName = ast.text(ast.name(callee));
  if (!attributeBuilderChainMethods.has(methodName)) {
    return undefined;
  }
  return resolveAttributeBuilderTarget(ast.as.AsPropertyAccessExpression(callee)?.Expression, ast, facts);
}

function staticExpressionName(node: Node, ast: AstReader): string {
  if (ast.is.IsPropertyAccessExpression(node)) {
    const access = ast.as.AsPropertyAccessExpression(node);
    const receiver = access?.Expression === undefined ? "" : staticExpressionName(access.Expression, ast);
    const name = ast.text(ast.name(node));
    return receiver === "" ? name : `${receiver}.${name}`;
  }
  return ast.text(ast.name(node) ?? node);
}

function fieldContainingContext(
  callExpression: Node,
  ast: AstReader,
): { readonly owner: Node; readonly nameNode: Node | undefined; readonly name: string } | undefined {
  const parent = ast.parent(callExpression);
  if (parent === undefined) {
    return undefined;
  }
  const propertyAssignment = ast.is.IsPropertyAssignment(parent)
    ? ast.as.AsPropertyAssignment(parent)
    : undefined;
  if (propertyAssignment?.Initializer === callExpression) {
    const nameNode = ast.name(parent);
    const name = staticSourcePropertyName(nameNode, ast);
    return name === undefined ? undefined : { owner: parent, nameNode, name };
  }
  const propertyDeclaration = ast.is.IsPropertyDeclaration(parent)
    ? ast.as.AsPropertyDeclaration(parent)
    : undefined;
  if (propertyDeclaration?.Initializer === callExpression) {
    const nameNode = ast.name(parent);
    const name = staticSourcePropertyName(nameNode, ast);
    return name === undefined ? undefined : { owner: parent, nameNode, name };
  }
  return undefined;
}

function staticSourcePropertyName(node: Node | undefined, ast: AstReader): string | undefined {
  if (node === undefined) {
    return undefined;
  }
  switch (ast.kindName(node)) {
    case "KindIdentifier":
    case "KindStringLiteral":
    case "KindNumericLiteral":
      return ast.text(node);
    case "KindComputedPropertyName": {
      const expression = ast.as.AsComputedPropertyName(node)?.Expression;
      if (expression === undefined) {
        return undefined;
      }
      switch (ast.kindName(expression)) {
        case "KindStringLiteral":
        case "KindNumericLiteral":
          return ast.text(expression);
        default:
          return undefined;
      }
    }
    default:
      return undefined;
  }
}

function visitSourceFile(
  node: Node | undefined,
  ast: AstReader,
  visitor: (node: Node) => void,
  seen: Set<Node> = new Set(),
): void {
  if (node === undefined) {
    return;
  }
  if (seen.has(node)) {
    return;
  }
  seen.add(node);
  visitor(node);
  for (const child of ast.children(node)) {
    visitSourceFile(child ?? undefined, ast, visitor, seen);
  }
}
