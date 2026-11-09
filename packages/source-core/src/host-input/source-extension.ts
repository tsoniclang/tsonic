import { sourceSemanticsExtensionId } from "@tsonic/tsts";
import type { CompilerExtension } from "@tsonic/tsts";
import { analyzeTsonicCompileTimeOperations } from "./compile-time-analysis.js";

import { analyzeTsonicAttributeBuilders } from "./attribute-analysis.js";
import { tsonicCoreNativePointerProviderNames } from "../pointers/provider-declarations.js";
import { tsonicNativePointerOperationFactKey } from "./native-pointer-facts.js";
import { analyzeNativePointerOperations } from "./native-pointer-operations.js";
import { analyzeTsonicFixedArrayTypes } from "./fixed-array-analysis.js";
import { analyzeTsonicSourceMarkerEvidence } from "./marker-evidence.js";
import { tsonicCoreLangModule, tsonicCoreProviderVersion, tsonicCoreSourceExtensionId, tsonicCoreVirtualModulesProviderId } from "../identity.js";

import { forEachTsonicSourceFile } from "./source-context.js";
import { createTsonicCoreVirtualModulesProvider } from "../extension/virtual-modules.js";

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
      analyzeTsonicSourceMarkerEvidence(context);
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
