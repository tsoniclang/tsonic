import { sourceSemanticsExtensionId } from "@tsonic/tsts";
import type { CompilerExtension } from "@tsonic/tsts";
import { analyzeTsonicCompileTimeOperations } from "../compile-time/analysis.js";

import { analyzeTsonicAttributeBuilders } from "../attributes/analysis.js";
import { sourceSafetySignatureIds, tsonicCoreSafetyProviderNames } from "../safety/declarations.js";
import { tsonicCoreNativePointerProviderNames } from "../pointers/provider-declarations.js";
import { tsonicNativePointerOperationFactKey } from "../pointers/facts.js";
import { tsonicSafetyBuilderFactKey, tsonicUnsafeContextFactKey } from "../safety/facts.js";
import { analyzeNativePointerOperations } from "../pointers/operations.js";
import { analyzeTsonicFixedArrayTypes } from "../fixed-arrays/analysis.js";
import { analyzeTsonicSourceMarkerEvidence } from "../analysis/marker-evidence.js";
import { analyzeSafetyBuilderCalls } from "../safety/builder-analysis.js";
import { analyzeUnsafeContextCalls } from "../safety/unsafe-context-analysis.js";
import { tsonicCoreLangModule, tsonicCoreProviderVersion, tsonicCoreSourceExtensionId, tsonicCoreVirtualModulesProviderId } from "../identity.js";

import { forEachTsonicSourceFile } from "../analysis/context.js";
import { visitPostOrder } from "../analysis/source-call.js";
import { createTsonicCoreVirtualModulesProvider } from "./virtual-modules.js";

import { analyzeTsonicMemoryOperations } from "../memory-layout/analysis.js";

import type { TsonicDataLayoutRegistration } from "@tsonic/target-api/provider";
import { captureDataLayoutRegistrations } from "../memory-layout/registrations.js";

import { recordUnsupportedTsonicCoreReExportDiagnostics } from "../analysis/source-module-admission.js";
import { validateTsonicStructFacts } from "../analysis/struct-admission.js";

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
      analyzeTsonicFixedArrayTypes(context);
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
      analyzeTsonicAttributeBuilders(context);
      forEachTsonicSourceFile(context, (sourceContext): void => {
        const { ast, checker } = sourceContext;
        visitPostOrder(sourceContext.sourceFile, sourceContext, node => {
          const selection = ast.is.IsPropertyAccessExpression(node)
            ? checker.getResolvedPropertyAccessInfo(node)
            : ast.is.IsElementAccessExpression(node)
              ? checker.getResolvedElementAccessInfo(node) : undefined;
          if (selection?.accessMode !== "write" && selection?.accessMode !== "read-write") return;
          const indexed = "argument" in selection
            ? sourceContext.typeShape.selectIndexedAccess(selection.receiver.type, selection.argument.type) : undefined;
          const members = indexed?.kind === "resolved"
            ? indexed.members.flatMap(member => member.kind === "property" ? [member.property] : [])
            : selection.selectedSymbol === undefined ? [] : [{ symbol: selection.selectedSymbol,
              rootSymbols: checker.getRootSymbols(selection.selectedSymbol), type: selection.sourceWriteType,
              name: checker.getSymbolName(selection.selectedSymbol) }];
          for (const member of members) {
            const declarations = [member.symbol, ...member.rootSymbols].flatMap(symbol => checker.getSymbolDeclarations(symbol));
            if (!declarations.some(declaration => ast.is.IsMethodDeclaration(declaration) ||
              ast.is.IsMethodSignatureDeclaration(declaration))) continue;
            sourceContext.diagnostics.append({
              extensionId: tsonicCoreSourceExtensionId,
              extensionCode: "TSONIC_METHOD_ASSIGNMENT_UNSUPPORTED",
              numericCode: 9901190,
              publicCode: "TSONIC_METHOD_ASSIGNMENT_UNSUPPORTED",
              category: "error",
              message: `Cannot assign to '${member.name}': it is declared as a method. Declare '${member.name}: ${checker.typeToString(member.type)}' for a replaceable function property.`,
              nodeOrSpan: node,
              evidence: [{ message: "Settled item 01: method syntax has a declaration-owned native method contract." }],
              identity: ["source-core-method-assignment", ast.getPath(sourceContext.sourceFile), ast.pos(node), ast.end(node), member.name].join(":"),
            });
          }
        });
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
