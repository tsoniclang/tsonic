import type { SurfaceMode } from "../program/types.js";

type SurfaceProfile = {
  readonly mode: SurfaceMode;
  readonly extends: readonly SurfaceMode[];
  readonly requiredTypeRoots: readonly string[];
  readonly useStandardLib: boolean;
  readonly enableJsBuiltins: boolean;
  readonly enableNodeModuleAliases: boolean;
};

export type SurfaceCapabilities = {
  readonly mode: SurfaceMode;
  readonly requiredTypeRoots: readonly string[];
  readonly useStandardLib: boolean;
  readonly enableJsBuiltins: boolean;
  readonly enableNodeModuleAliases: boolean;
};

const SURFACE_PROFILES: Readonly<Record<SurfaceMode, SurfaceProfile>> = {
  clr: {
    mode: "clr",
    extends: [],
    requiredTypeRoots: ["node_modules/@tsonic/globals"],
    useStandardLib: false,
    enableJsBuiltins: false,
    enableNodeModuleAliases: false,
  },
  js: {
    mode: "js",
    extends: ["clr"],
    requiredTypeRoots: ["node_modules/@tsonic/js"],
    useStandardLib: true,
    enableJsBuiltins: true,
    enableNodeModuleAliases: false,
  },
  nodejs: {
    mode: "nodejs",
    extends: ["js"],
    requiredTypeRoots: ["node_modules/@tsonic/nodejs"],
    useStandardLib: true,
    enableJsBuiltins: true,
    enableNodeModuleAliases: true,
  },
};

const mergeUnique = <T>(buckets: readonly (readonly T[])[]): readonly T[] => {
  const merged = new Set<T>();
  for (const bucket of buckets) {
    for (const value of bucket) {
      merged.add(value);
    }
  }
  return Array.from(merged);
};

const isSurfaceMode = (value: unknown): value is SurfaceMode =>
  value === "clr" || value === "js" || value === "nodejs";

const toSurfaceMode = (mode: SurfaceMode | undefined): SurfaceMode =>
  mode && isSurfaceMode(mode) ? mode : "clr";

const resolveProfileChain = (mode: SurfaceMode): readonly SurfaceProfile[] => {
  const seen = new Set<SurfaceMode>();
  const chain: SurfaceProfile[] = [];

  const visit = (currentMode: SurfaceMode): void => {
    if (seen.has(currentMode)) return;
    seen.add(currentMode);
    const profile = SURFACE_PROFILES[currentMode];
    for (const parent of profile.extends) {
      visit(parent);
    }
    chain.push(profile);
  };

  visit(mode);
  return chain;
};

export const resolveSurfaceCapabilities = (
  mode: SurfaceMode | undefined
): SurfaceCapabilities => {
  const normalizedMode = toSurfaceMode(mode);
  const chain = resolveProfileChain(normalizedMode);
  return {
    mode: normalizedMode,
    requiredTypeRoots: mergeUnique(
      chain.map((profile) => profile.requiredTypeRoots)
    ),
    useStandardLib: chain.some((profile) => profile.useStandardLib),
    enableJsBuiltins: chain.some((profile) => profile.enableJsBuiltins),
    enableNodeModuleAliases: chain.some(
      (profile) => profile.enableNodeModuleAliases
    ),
  };
};
