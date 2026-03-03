import type { SurfaceMode } from "../types.js";

type SurfaceProfile = {
  readonly mode: SurfaceMode;
  readonly extends: readonly SurfaceMode[];
  readonly requiredTypeRoots: readonly string[];
  readonly requiredNpmPackages: readonly string[];
  readonly useStandardLib: boolean;
};

export type SurfaceCapabilities = {
  readonly mode: SurfaceMode;
  readonly requiredTypeRoots: readonly string[];
  readonly requiredNpmPackages: readonly string[];
  readonly useStandardLib: boolean;
};

const SURFACE_PROFILES: Readonly<Record<SurfaceMode, SurfaceProfile>> = {
  clr: {
    mode: "clr",
    extends: [],
    requiredTypeRoots: ["node_modules/@tsonic/globals"],
    requiredNpmPackages: [],
    useStandardLib: false,
  },
  js: {
    mode: "js",
    extends: ["clr"],
    requiredTypeRoots: ["node_modules/@tsonic/js"],
    requiredNpmPackages: ["@tsonic/js"],
    useStandardLib: false,
  },
  nodejs: {
    mode: "nodejs",
    extends: ["js"],
    requiredTypeRoots: ["node_modules/@tsonic/nodejs"],
    requiredNpmPackages: ["@tsonic/nodejs"],
    useStandardLib: false,
  },
};

const mergeUnique = <T>(values: readonly (readonly T[])[]): readonly T[] => {
  const merged = new Set<T>();
  for (const bucket of values) {
    for (const value of bucket) {
      merged.add(value);
    }
  }
  return Array.from(merged);
};

const toSurfaceMode = (mode: SurfaceMode | undefined): SurfaceMode =>
  mode && isSurfaceMode(mode) ? mode : "clr";

const resolveProfileChain = (mode: SurfaceMode): readonly SurfaceProfile[] => {
  const seen = new Set<SurfaceMode>();
  const ordered: SurfaceProfile[] = [];

  const visit = (currentMode: SurfaceMode): void => {
    if (seen.has(currentMode)) return;
    seen.add(currentMode);
    const profile = SURFACE_PROFILES[currentMode];
    for (const parent of profile.extends) {
      visit(parent);
    }
    ordered.push(profile);
  };

  visit(mode);
  return ordered;
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
    requiredNpmPackages: mergeUnique(
      chain.map((profile) => profile.requiredNpmPackages)
    ),
    useStandardLib: chain.some((profile) => profile.useStandardLib),
  };
};

export const isSurfaceMode = (value: unknown): value is SurfaceMode =>
  value === "clr" || value === "js" || value === "nodejs";
