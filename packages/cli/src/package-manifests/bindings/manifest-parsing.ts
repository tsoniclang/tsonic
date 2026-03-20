export {
  mergeFrameworkReferences,
  mergeMsbuildProperties,
  mergePackageReferences,
} from "./manifest-parsing/dotnet.js";
export { resolveFromPackageManifest } from "./manifest-parsing/package-manifest.js";
export { resolveFromLegacyBindingsManifest } from "./manifest-parsing/legacy.js";
