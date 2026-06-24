import {
  TstsProviderContractVersion,
} from "@tsonic/tsts";
import type {
  ExtensionDiagnostic,
  ProviderDeclarationModel,
  ProviderIdentity,
  ProviderModuleContext,
  ProviderModuleResolution,
  ProviderOwnership,
  TargetBindingProvider,
} from "@tsonic/tsts";
import {
  tsonicCoreProviderVersion,
} from "./identity.js";
import {
  providerExportDeclarationsForSourceModule,
} from "./provider-declarations.js";
import {
  tsonicCoreSourceSemanticsModules,
} from "./source-modules.js";

export function createTsonicCoreVirtualModulesProvider(): TargetBindingProvider {
  const modules = new Map(tsonicCoreSourceSemanticsModules().map((module) => [module.moduleSpecifier, module]));
  const identity: ProviderIdentity = {
    id: "tsonic.source-core.virtual-modules",
    version: tsonicCoreProviderVersion,
    target: "source",
    extensionContractVersion: TstsProviderContractVersion,
    providerKind: "binding",
    displayName: "Tsonic source-core virtual modules",
  };
  return {
    identity,
    ownsModule(specifier: string, _context: ProviderModuleContext): ProviderOwnership {
      return modules.has(specifier) ? { kind: "owned" } : { kind: "unowned" };
    },
    resolveModule(specifier: string, _context: ProviderModuleContext): ProviderModuleResolution | ExtensionDiagnostic {
      const module = modules.get(specifier);
      if (module === undefined) {
        return sourceCoreDiagnostic(identity.id, "TSONIC_SOURCE_CORE_MODULE_UNOWNED", 9200001, `Tsonic source-core provider does not own '${specifier}'.`);
      }
      return {
        kind: "virtual",
        moduleSpecifier: specifier,
        virtualFileName: sourceCoreVirtualDeclarationFileName(specifier),
        providerModuleId: specifier,
        ...(module.packageName !== undefined ? { packageName: module.packageName } : {}),
        ...(module.packageVersion !== undefined ? { packageVersion: module.packageVersion } : {}),
        evidence: [{ message: "Tsonic source-core supplies target-neutral source module as provider virtual module." }],
      };
    },
    getDeclarationModel(resolution: ProviderModuleResolution): ProviderDeclarationModel | ExtensionDiagnostic {
      const module = modules.get(resolution.moduleSpecifier);
      if (module === undefined) {
        return sourceCoreDiagnostic(identity.id, "TSONIC_SOURCE_CORE_DECLARATION_MISSING", 9200002, `No Tsonic source-core declaration model exists for '${resolution.moduleSpecifier}'.`);
      }
      return {
        moduleSpecifier: resolution.moduleSpecifier,
        providerModuleId: resolution.providerModuleId,
        exports: providerExportDeclarationsForSourceModule(module),
        evidence: [{ message: "Declaration model is generated from target-neutral Tsonic source semantics." }],
      };
    },
    getTargetIdentity() {
      return undefined;
    },
  };
}

function sourceCoreVirtualDeclarationFileName(specifier: string): string {
  return `tsts-provider://tsonic-source-core/${encodeURIComponent(specifier)}.d.ts`;
}

function sourceCoreDiagnostic(
  extensionId: string,
  code: string,
  numericCode: number,
  message: string,
): ExtensionDiagnostic {
  return {
    extensionId,
    extensionCode: code,
    numericCode,
    category: "error",
    message,
  };
}
