import type { Result } from "../diag/contract.js";
import type { PackageId } from "../ids/contract.js";
import type { EffectFailure, PackageLibraryData, PackageSnapshot, PhysicalFile } from "../snapshot/contract.js";

export interface CapturedDirectory {
  readonly path: string;
  readonly realPath: string;
  readonly entries: readonly DirectoryEntry[];
}

export interface DirectoryEntry {
  readonly name: string;
  readonly kind: "file" | "directory" | "symlink";
}

export interface PackageInput {
  readonly projectDirectory: string;
  readonly sourceRoot: string;
  readonly rootFilePaths: readonly string[];
  readonly outputRoot: string;
  readonly cacheRoot: string;
}

export interface PackageInventory {
  readonly entries: readonly PackageCapture[];
}

export type CaptureRequest =
  | { readonly kind: "file"; readonly path: string }
  | { readonly kind: "directory"; readonly path: string };

export type PackageCapture =
  | { readonly kind: "file"; readonly file: PhysicalFile }
  | { readonly kind: "directory"; readonly directory: CapturedDirectory }
  | { readonly kind: "absent"; readonly request: CaptureRequest }
  | { readonly kind: "failed"; readonly request: CaptureRequest; readonly failure: EffectFailure };

export type PackagePlan =
  | { readonly kind: "capture"; readonly requests: readonly [CaptureRequest, ...CaptureRequest[]] }
  | { readonly kind: "complete"; readonly snapshot: PackageSnapshot };

export interface PackageLimits {
  readonly maximumPackages: number;
  readonly maximumCapturedFiles: number;
}

export interface PackageDeps {
  readonly pathStyle: "posix" | "windows";
  readonly rootDevelopmentDependencies: boolean;
  readonly limits: PackageLimits;
}

export type PlanPackages = (
  deps: PackageDeps,
  input: PackageInput,
  inventory: PackageInventory,
) => Result<PackagePlan>;

export type ParsePackageLibraryData = (
  owner: PackageId,
  file: PhysicalFile,
) => Result<PackageLibraryData>;

export interface PackageEffects {
  readonly capture: (requests: readonly CaptureRequest[]) => Promise<PackageInventory>;
}
