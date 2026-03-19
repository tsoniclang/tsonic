export {
  mergeFrameworkReferences,
  mergeMsbuildProperties,
  mergePackageReferences,
} from "./manifest-parsing/dotnet.js";
export { resolveFromAikyaManifest } from "./manifest-parsing/aikya.js";
export { resolveFromLegacyBindingsManifest } from "./manifest-parsing/legacy.js";
