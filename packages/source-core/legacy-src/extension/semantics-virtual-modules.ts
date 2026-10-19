import {
  TstsSourceProviderContractVersion,
} from "@tsonic/tsts";
import type {
  ExtensionDiagnostic,
  ProviderDeclarationModel,
  ProviderIdentity,
  ProviderImportDeclaration,
  ProviderModuleContext,
  ProviderModuleResolution,
  ProviderOwnership,
  SourceDeclarationProvider,
  SourceSemanticsModule,
} from "@tsonic/tsts";
import {
  providerExportDeclarationsForSemanticsModule,
} from "../providers/declarations.js";

export interface SourceSemanticsVirtualModuleProviderOptions {
  readonly id: string;
  readonly version: string;
  readonly displayName: string;
  readonly virtualDirectory: string;
  readonly modules: readonly SourceSemanticsModule[];
  readonly importsForModule?: (
    module: SourceSemanticsModule,
  ) => readonly ProviderImportDeclaration[];
  readonly exportsForModule?: (
    module: SourceSemanticsModule,
  ) => ProviderDeclarationModel["exports"];
  readonly evidenceMessage: string;
  readonly diagnostics?: {
    readonly unowned: SourceSemanticsProviderDiagnosticIdentity;
    readonly declarationMissing: SourceSemanticsProviderDiagnosticIdentity;
  };
}

export interface SourceSemanticsProviderDiagnosticIdentity {
  readonly extensionCode: string;
  readonly numericCode: number;
}

export function createSourceSemanticsVirtualModuleProvider(
  options: SourceSemanticsVirtualModuleProviderOptions,
): SourceDeclarationProvider {
  validateVirtualDirectory(options.virtualDirectory);
  const modules = indexModules(options.modules);
  const identity: ProviderIdentity = {
    id: options.id,
    version: options.version,
    extensionContractVersion: TstsSourceProviderContractVersion,
    displayName: options.displayName,
  };
  return {
    identity,
    declarationMaterialization: "complete",
    ownsModule(specifier: string, _context: ProviderModuleContext): ProviderOwnership {
      return modules.has(specifier) ? { kind: "owned" } : { kind: "unowned" };
    },
    resolveModule(
      specifier: string,
      _context: ProviderModuleContext,
    ): ProviderModuleResolution | ExtensionDiagnostic {
      const module = modules.get(specifier);
      if (module === undefined) {
        return providerDiagnostic(
          identity.id,
          options.diagnostics?.unowned.extensionCode ??
            "SOURCE_SEMANTICS_MODULE_UNOWNED",
          options.diagnostics?.unowned.numericCode ?? 9200190,
          `Source-semantics provider '${identity.id}' does not own '${specifier}'.`,
        );
      }
      return {
        kind: "virtual",
        moduleSpecifier: specifier,
        virtualFileName: `tsts-provider://${options.virtualDirectory}/${encodeURIComponent(specifier)}.d.ts`,
        providerModuleId: specifier,
        ...(module.packageName === undefined
          ? {}
          : { packageName: module.packageName }),
        ...(module.packageVersion === undefined
          ? {}
          : { packageVersion: module.packageVersion }),
        evidence: [{ message: options.evidenceMessage }],
      };
    },
    getDeclarationModel(
      resolution: ProviderModuleResolution,
    ): ProviderDeclarationModel | ExtensionDiagnostic {
      const module = modules.get(resolution.moduleSpecifier);
      if (module === undefined) {
        return providerDiagnostic(
          identity.id,
          options.diagnostics?.declarationMissing.extensionCode ??
            "SOURCE_SEMANTICS_DECLARATION_MISSING",
          options.diagnostics?.declarationMissing.numericCode ?? 9200191,
          `Source-semantics provider '${identity.id}' has no declaration model for '${resolution.moduleSpecifier}'.`,
        );
      }
      const imports = options.importsForModule?.(module) ?? [];
      return {
        moduleSpecifier: resolution.moduleSpecifier,
        providerModuleId: resolution.providerModuleId,
        ...(imports.length === 0 ? {} : { imports }),
        exports: options.exportsForModule?.(module) ??
          providerExportDeclarationsForSemanticsModule(module),
        evidence: [{ message: options.evidenceMessage }],
      };
    },
  };
}

function indexModules(
  modules: readonly SourceSemanticsModule[],
): ReadonlyMap<string, SourceSemanticsModule> {
  const indexed = new Map<string, SourceSemanticsModule>();
  for (const module of modules) {
    if (indexed.has(module.moduleSpecifier)) {
      throw new Error(
        `Source-semantics module '${module.moduleSpecifier}' is declared more than once.`,
      );
    }
    indexed.set(module.moduleSpecifier, module);
  }
  return indexed;
}

function validateVirtualDirectory(directory: string): void {
  if (!/^[A-Za-z0-9._-]+$/u.test(directory)) {
    throw new Error(
      `Source-semantics virtual directory '${directory}' must be one non-empty URI path segment.`,
    );
  }
}

function providerDiagnostic(
  extensionId: string,
  extensionCode: string,
  numericCode: number,
  message: string,
): ExtensionDiagnostic {
  return {
    extensionId,
    extensionCode,
    numericCode,
    category: "error",
    message,
  };
}
