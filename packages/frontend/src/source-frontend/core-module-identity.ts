export type CoreModule = "types" | "lang";

export const CORE_PACKAGE_NAME = "@tsonic/core";

export const GLOBALS_PACKAGE_NAME = "@tsonic/globals";

export const CORE_TYPES_MODULE_SPECIFIERS: ReadonlySet<string> = new Set([
  "@tsonic/core/types.js",
  "@tsonic/core/types",
]);

export const CORE_LANG_MODULE_SPECIFIERS: ReadonlySet<string> = new Set([
  "@tsonic/core/lang.js",
  "@tsonic/core/lang",
]);

export const coreDeclarationFileBaseName = (module: CoreModule): string =>
  module === "types" ? "types.d.ts" : "lang.d.ts";

export const canonicalCoreModuleSpecifier = (module: CoreModule): string =>
  module === "types" ? "@tsonic/core/types.js" : "@tsonic/core/lang.js";
