import type { LibraryModuleIdentity } from '../model/contract.js';

export const coreTypesIdentity: LibraryModuleIdentity = Object.freeze<LibraryModuleIdentity>({
  providerId: "tsonic.source-core.virtual-modules",
  providerVersion: "0.0.1",
  packageName: "@tsonic/core",
  moduleSpecifier: "@tsonic/core/types.js",
  providerModuleId: "@tsonic/core/types.js",
});

export const coreLangIdentity: LibraryModuleIdentity = Object.freeze<LibraryModuleIdentity>({
  providerId: "tsonic.source-core.virtual-modules",
  providerVersion: "0.0.1",
  packageName: "@tsonic/core",
  moduleSpecifier: "@tsonic/core/lang.js",
  providerModuleId: "@tsonic/core/lang.js",
});

export const jsTypesIdentity: LibraryModuleIdentity = Object.freeze<LibraryModuleIdentity>({
  providerId: "tsonic.js.source-virtual-modules",
  providerVersion: "0.0.1",
  packageName: "@tsonic/js",
  moduleSpecifier: "@tsonic/js/types.js",
  providerModuleId: "@tsonic/js/types.js",
});

export const jsLangIdentity: LibraryModuleIdentity = Object.freeze<LibraryModuleIdentity>({
  providerId: "tsonic.js.source-virtual-modules",
  providerVersion: "0.0.1",
  packageName: "@tsonic/js",
  moduleSpecifier: "@tsonic/js/lang.js",
  providerModuleId: "@tsonic/js/lang.js",
});
