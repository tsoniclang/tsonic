import {
  attributeFactKey,
  canonicalIdentityFactKey,
  createSourceSemanticsExtension,
  ExtensionLifecycleEvent,
} from "@tsonic/tsts";
import type {
  AstReader,
  AttributeFact,
  CompilerExtension,
  ExtensionEvidence,
  ExtensionFactSubject,
  ExtensionFactStore,
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
        recordTsonicAttributeBuilderFacts(request, lifecycleContext.compiler.ast, lifecycleContext.host.facts);
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

function recordTsonicMissingTypeEvidenceDiagnostics(
  request: SourceFileBoundLifecycleRequest,
  ast: AstReader,
  checker: TypeCheckerQueries,
  facts: ExtensionFactStore,
  diagnostics: {
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
  },
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

function visitSourceFile(
  node: Node | undefined,
  ast: AstReader,
  visitor: (node: Node) => void,
): void {
  if (node === undefined) {
    return;
  }
  visitor(node);
  for (const child of ast.children(node)) {
    visitSourceFile(child ?? undefined, ast, visitor);
  }
}
