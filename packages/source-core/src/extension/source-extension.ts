import {
  fieldFactKey,
  sourceSemanticsExtensionId,
  structFactKey,
} from "@tsonic/tsts";
import type {
  AstReader,
  CompilerExtension,
  ExtensionEvidence,
  FieldFact,
  Node,
  SourceAnalysisFactAccess,
} from "@tsonic/tsts";
import {
  analyzeTsonicCompileTimeOperations,
} from "../compile-time/analysis.js";
import {
  tsonicCompileTimeProviderNames,
} from "../compile-time/declarations.js";
import {
  analyzeTsonicAttributeBuilders,
} from "../attributes/analysis.js";
import {
  sourceSafetySignatureIds,
  tsonicCoreSafetyProviderNames,
} from "../safety/declarations.js";
import {
  tsonicCoreNativePointerProviderNames,
} from "../pointers/provider-declarations.js";
import {
  tsonicNativePointerOperationFactKey,
} from "../pointers/facts.js";
import {
  tsonicSafetyBuilderFactKey,
  tsonicUnsafeContextFactKey,
} from "../safety/facts.js";
import {
  analyzeNativePointerOperations,
} from "../pointers/operations.js";
import {
  analyzeTsonicFixedArrayTypes,
} from "../fixed-arrays/analysis.js";
import {
  analyzeTsonicSourceMarkerEvidence,
} from "../analysis/marker-evidence.js";
import {
  analyzeSafetyBuilderCalls,
} from "../safety/builder-analysis.js";
import {
  analyzeUnsafeContextCalls,
} from "../safety/unsafe-context-analysis.js";
import {
  tsonicCoreLangModule,
  tsonicCoreProviderVersion,
  tsonicCoreSourceExtensionId,
  tsonicCoreTypesModule,
  tsonicCoreVirtualModulesProviderId,
} from "../identity.js";
import { tsonicCoreSourceSemanticsModules } from "./source-modules.js";
import { forEachTsonicSourceFile } from "../analysis/context.js";
import {
  createTsonicCoreVirtualModulesProvider,
} from "./virtual-modules.js";

import { analyzeTsonicMemoryOperations } from "../memory-layout/analysis.js";
import { tsonicMemorySignatureIds, tsonicMemoryTypeExports } from "../memory-layout/declarations.js";
import type { TsonicDataLayoutRegistration } from "../memory-layout/facts.js";
import { captureDataLayoutRegistrations } from "../memory-layout/registrations.js";

export interface TsonicCoreSourceExtensionOptions {
  readonly dataLayouts?: readonly TsonicDataLayoutRegistration[];
}

export function createTsonicCoreSourceExtension(options: TsonicCoreSourceExtensionOptions = {}): CompilerExtension {
  const dataLayouts = captureDataLayoutRegistrations(options.dataLayouts ?? []);
  return {
    identity: {
      id: tsonicCoreSourceExtensionId,
      version: tsonicCoreProviderVersion,
    },
    dependencies: {
      dependsOn: [sourceSemanticsExtensionId],
      runsAfter: [sourceSemanticsExtensionId],
    },
    initialize(context): void {
      context.registerSourceDeclarationProvider(createTsonicCoreVirtualModulesProvider());
    },
    analyzeSource(context): void {
      analyzeTsonicMemoryOperations(context, dataLayouts);
      analyzeTsonicCompileTimeOperations(context);
      analyzeNativePointerOperations(context, {
        providerId: tsonicCoreVirtualModulesProviderId,
        providerVersion: tsonicCoreProviderVersion,
        providerModuleId: tsonicCoreLangModule,
        names: tsonicCoreNativePointerProviderNames,
        factKey: tsonicNativePointerOperationFactKey,
        extensionId: tsonicCoreSourceExtensionId,
        diagnosticPrefix: "SOURCE_CORE_NATIVE_POINTER",
        diagnosticNumberBase: 9901150,
      });
      analyzeUnsafeContextCalls(context, {
        blockSelector: {
          kind: "export-signature",
          providerId: tsonicCoreVirtualModulesProviderId,
          providerVersion: tsonicCoreProviderVersion,
          providerModuleId: tsonicCoreLangModule,
          exportId: tsonicCoreSafetyProviderNames.unsafeContextExport,
          signatureId: sourceSafetySignatureIds.unsafeContextBlock,
        },
        expressionSelector: {
          kind: "export-signature",
          providerId: tsonicCoreVirtualModulesProviderId,
          providerVersion: tsonicCoreProviderVersion,
          providerModuleId: tsonicCoreLangModule,
          exportId: tsonicCoreSafetyProviderNames.unsafeContextExport,
          signatureId: sourceSafetySignatureIds.unsafeContextExpression,
        },
        factKey: tsonicUnsafeContextFactKey,
        extensionId: tsonicCoreSourceExtensionId,
        invalidPositionCode: "SOURCE_CORE_UNSAFE_CONTEXT_BLOCK_POSITION_INVALID",
        invalidPositionNumber: 9901131,
        factWriteCode: "SOURCE_CORE_UNSAFE_CONTEXT_FACT_WRITE_FAILED",
        factWriteNumber: 9901132,
      });
      analyzeSafetyBuilderCalls(context, {
        providerId: tsonicCoreVirtualModulesProviderId,
        providerVersion: tsonicCoreProviderVersion,
        providerModuleId: tsonicCoreLangModule,
        names: tsonicCoreSafetyProviderNames,
        factKey: tsonicSafetyBuilderFactKey,
        extensionId: tsonicCoreSourceExtensionId,
        diagnosticPrefix: "SOURCE_CORE_SAFETY",
        diagnosticNumberBase: 9901140,
      });
      analyzeTsonicSourceMarkerEvidence(context);
      analyzeTsonicFixedArrayTypes(context);
      analyzeTsonicAttributeBuilders(context);
      forEachTsonicSourceFile(context, (sourceContext): void => {
        recordUnsupportedTsonicCoreReExportDiagnostics(
          sourceContext.sourceFile,
          sourceContext.ast,
          sourceContext.diagnostics,
        );
        validateTsonicStructFacts(
          sourceContext.sourceFile,
          sourceContext.ast,
          sourceContext.facts,
          sourceContext.diagnostics,
        );
      });
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

const unsupportedCoreReExportDiagnostic = {
  extensionCode: "SOURCE_SEMANTICS_CORE_REEXPORT_UNSUPPORTED",
  numericCode: 9901110,
  message: "Re-exporting @tsonic/core intrinsics through a local barrel is unsupported; import source-core intrinsics directly so provider ownership remains proven.",
} as const;

const sourceCoreExportNamesByModule = new Map(
  tsonicCoreSourceSemanticsModules().map((module) => [
    module.moduleSpecifier,
    new Set([
      ...module.exports.map((entry) => entry.exportName),
      ...(module.moduleSpecifier === tsonicCoreTypesModule
        ? [tsonicCoreNativePointerProviderNames.nativePointerExport, ...tsonicMemoryTypeExports]
        : module.moduleSpecifier === tsonicCoreLangModule
        ? [
            tsonicCoreNativePointerProviderNames.loadExport,
            tsonicCoreNativePointerProviderNames.storeExport,
            tsonicCoreNativePointerProviderNames.offsetExport,
            tsonicCoreSafetyProviderNames.unsafeContextExport,
            tsonicCoreSafetyProviderNames.safetyExport,
            ...Object.keys(tsonicMemorySignatureIds),
            ...Object.values(tsonicCompileTimeProviderNames),
          ]
        : []),
    ]),
  ]),
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

function recordUnsupportedTsonicCoreReExportDiagnostics(
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
    const moduleSpecifierNode = ast.as.AsExportDeclaration(statement)?.ModuleSpecifier;
    const moduleSpecifier = moduleSpecifierNode === undefined ? undefined : ast.text(moduleSpecifierNode);
    const sourceCoreExportNames = moduleSpecifier === undefined
      ? undefined
      : sourceCoreExportNamesByModule.get(moduleSpecifier);
    if (moduleSpecifier === undefined || sourceCoreExportNames === undefined) {
      continue;
    }
    const exportedNames = exportedSourceCoreIntrinsicNames(statement, ast, sourceCoreExportNames);
    if (exportedNames.length === 0) {
      continue;
    }
    diagnostics.append({
      extensionId: tsonicCoreSourceExtensionId,
      extensionCode: unsupportedCoreReExportDiagnostic.extensionCode,
      numericCode: unsupportedCoreReExportDiagnostic.numericCode,
      publicCode: `TSONIC_SOURCE_CORE_${unsupportedCoreReExportDiagnostic.numericCode}`,
      category: "error",
      message: unsupportedCoreReExportDiagnostic.message,
      nodeOrSpan: statement,
      evidence: [{
        message: "Source-core portable intrinsic ownership does not flow through local re-export barrels.",
        details: {
          moduleSpecifier,
          exportedNames,
        },
      }],
      identity: `source-core-reexport:${statementIdentity}:${moduleSpecifier}:${exportedNames.join(",")}`,
    });
  }
}

function exportedSourceCoreIntrinsicNames(
  exportDeclaration: Node,
  ast: AstReader,
  sourceCoreExportNames: ReadonlySet<string>,
): readonly string[] {
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
    if (exportName !== undefined && sourceCoreExportNames.has(exportName)) {
      exportedNames.push(exportName);
    }
  }
  return exportedNames;
}

function validateTsonicStructFacts(
  sourceFile: Node,
  ast: AstReader,
  facts: SourceAnalysisFactAccess,
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
  facts: SourceAnalysisFactAccess,
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
