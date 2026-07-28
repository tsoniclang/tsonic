import {
  createSourceSemanticsExtension,
  fieldFactKey,
  structFactKey,
} from "@tsonic/tsts";
import type {
  AstReader,
  CompilerExtension,
  ExtensionEvidence,
  ExtensionFactStore,
  FieldFact,
  Node,
} from "@tsonic/tsts";
import {
  analyzeTsonicAttributeBuilders,
} from "./attribute-builder-analysis.js";
import {
  analyzeTsonicSourceMarkerEvidence,
} from "./marker-evidence-analysis.js";
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
    },
    analyzeSource(context): void {
      sourceSemantics.analyzeSource?.(context);
      analyzeTsonicSourceMarkerEvidence(context);
      analyzeTsonicAttributeBuilders(context);
      for (const sourceFile of context.sourceFiles) {
        if (sourceFile === undefined || context.ast.getFileName(sourceFile).endsWith(".d.ts")) {
          continue;
        }
        recordUnsupportedTsonicCoreLangReExportDiagnostics(
          sourceFile,
          context.ast,
          context.diagnostics,
        );
        validateTsonicStructFacts(
          sourceFile,
          context.ast,
          context.facts,
          context.diagnostics,
        );
      }
    },
  };
}

const structFieldDiagnostics = {
  duplicateField: {
    extensionCode: "SOURCE_SEMANTICS_STRUCT_DUPLICATE_FIELD",
    numericCode: 9901107,
    message: "struct(...) field shape contains a duplicate static field name.",
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
  sourceFile: Node,
  ast: AstReader,
  diagnostics: DiagnosticSink,
): void {
  let exportDeclarationIndex = 0;
  for (const statement of ast.statements(sourceFile)) {
    if (statement === undefined || !ast.is.IsExportDeclaration(statement)) {
      continue;
    }
    const statementIdentity = exportDeclarationIndex;
    exportDeclarationIndex += 1;
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
      identity: `source-core-lang-reexport:${statementIdentity}:${exportedNames.join(",")}`,
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
    if (specifier === undefined || !ast.is.IsExportSpecifier(specifier)) {
      continue;
    }
    const exportNameNode = ast.as.AsExportSpecifier(specifier)?.PropertyName ??
      ast.name(specifier);
    const exportName = exportNameNode === undefined ? undefined : ast.text(exportNameNode);
    if (exportName !== undefined && sourceCoreLangExportNames.has(exportName)) {
      exportedNames.push(exportName);
    }
  }
  return exportedNames;
}

function validateTsonicStructFacts(
  sourceFile: Node,
  ast: AstReader,
  facts: ExtensionFactStore,
  diagnostics: DiagnosticSink,
): void {
  visitSourceFile(sourceFile, ast, (node): void => {
    if (!ast.is.IsCallExpression(node) || facts.get(node, structFactKey) === undefined) {
      return;
    }
    validateSourceCoreStructShape(node, ast, facts, diagnostics);
  });
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
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.structMember, property ?? shape, ast, [
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
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.structMember, property, ast, [
        { message: "Struct shape property lacks finalized field name/type evidence.", details: { hasStaticName: name !== undefined, hasFieldFact: field !== undefined } },
      ]);
      continue;
    }
    const previous = seenFields.get(name);
    if (previous !== undefined) {
      appendStructFieldDiagnostic(diagnostics, structFieldDiagnostics.duplicateField, property, ast, [
        { message: "Duplicate static struct field name.", details: { name } },
      ]);
      continue;
    }
    seenFields.set(name, property);
  }
}

function appendStructFieldDiagnostic(
  diagnostics: DiagnosticSink,
  diagnostic: typeof structFieldDiagnostics[keyof typeof structFieldDiagnostics],
  node: Node,
  ast: AstReader,
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
    identity: `source-core-struct-field:${diagnostic.extensionCode}:${ast.getPath(ast.getSourceFile(node))}:${ast.pos(node)}:${ast.end(node)}`,
  });
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
