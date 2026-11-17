import type { SourceSemanticsModule } from "@tsonic/tsts";
import {
  jsLangModule,
  jsSourcePackageName,
  jsSourceSemanticsIdentity,
  jsTypesModule,
} from "../identities/source.js";

const jsTypeMarkers = Object.freeze([
  Object.freeze({
    kind: "type-marker" as const,
    exportName: jsSourceSemanticsIdentity.typeExport,
    marker: "js-string" as const,
  }),
]);

const jsCallMarkers = Object.freeze([
  Object.freeze({
    kind: "call-marker" as const,
    exportName: jsSourceSemanticsIdentity.conversionExport,
    marker: "js-string" as const,
  }),
]);

export function jsSourceSemanticsModules(): readonly SourceSemanticsModule[] {
  return Object.freeze([
    Object.freeze({
      moduleSpecifier: jsTypesModule,
      packageName: jsSourcePackageName,
      subpath: "types.js",
      capabilities: Object.freeze(["type-marker" as const]),
      exports: jsTypeMarkers,
    }),
    Object.freeze({
      moduleSpecifier: jsLangModule,
      packageName: jsSourcePackageName,
      subpath: "lang.js",
      capabilities: Object.freeze(["call-marker" as const]),
      exports: jsCallMarkers,
    }),
  ]);
}
