export const tsonicCoreTypesModule = "@tsonic/core/types.js";
export const tsonicCoreLangModule = "@tsonic/core/lang.js";
export const tsonicCoreSourceExtensionId = "tsonic.source-core";
export const tsonicCoreProviderVersion = "0.0.1";
export const tsonicCoreVirtualModulesProviderId = "tsonic.source-core.virtual-modules";

export function sourcePrimitiveBindingId(primitive: string): string {
  return `tsonic.source.${primitive}`;
}
