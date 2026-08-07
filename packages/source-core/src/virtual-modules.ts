import type {
  SourceDeclarationProvider,
} from "@tsonic/tsts";
import {
  tsonicCoreProviderVersion,
  tsonicCoreLangModule,
  tsonicCoreTypesModule,
  tsonicCoreVirtualModulesProviderId,
} from "./identity.js";
import {
  providerExportDeclarationsForSourceModule,
} from "./provider-declarations.js";
import {
  tsonicCoreSourceSemanticsModules,
} from "./source-modules.js";
import {
  createSourceSemanticsVirtualModuleProvider,
} from "./semantics-virtual-modules.js";

export function createTsonicCoreVirtualModulesProvider(): SourceDeclarationProvider {
  return createSourceSemanticsVirtualModuleProvider({
    id: tsonicCoreVirtualModulesProviderId,
    version: tsonicCoreProviderVersion,
    displayName: "Tsonic source-core virtual modules",
    virtualDirectory: "tsonic-source-core",
    modules: tsonicCoreSourceSemanticsModules(),
    importsForModule(module) {
      return module.moduleSpecifier === tsonicCoreLangModule
        ? [{
            moduleSpecifier: tsonicCoreTypesModule,
            namedImports: [{ exportedName: "Pointer", kind: "type" }],
            typeOnly: true,
          }]
        : [];
    },
    exportsForModule: providerExportDeclarationsForSourceModule,
    evidenceMessage:
      "Tsonic source-core supplies target-neutral source semantics as a complete virtual module.",
    diagnostics: {
      unowned: {
        extensionCode: "TSONIC_SOURCE_CORE_MODULE_UNOWNED",
        numericCode: 9200001,
      },
      declarationMissing: {
        extensionCode: "TSONIC_SOURCE_CORE_DECLARATION_MISSING",
        numericCode: 9200002,
      },
    },
  });
}
