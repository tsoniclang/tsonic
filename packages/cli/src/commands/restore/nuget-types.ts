import type { PackageReferenceConfig } from "../../types.js";
import type { PackageTarget } from "./shared.js";

export type MetaPlan = {
  readonly outDir: string;
  readonly claimedLibKeys: ReadonlySet<string>;
  readonly seedDlls: readonly string[];
};

export type NugetRestorePlan = {
  readonly packageReferencesAll: readonly PackageReferenceConfig[];
  readonly packagesByLibKey: ReadonlyMap<string, PackageTarget>;
  readonly topo: readonly string[];
  readonly compileDirs: readonly string[];
  readonly transitiveDeps: ReadonlyMap<string, ReadonlySet<string>>;
  readonly typesFalsePkgIds: ReadonlySet<string>;
  readonly typesPackageByPkgId: ReadonlyMap<string, string>;
  readonly bindingsDirByLibKey: ReadonlyMap<string, string>;
  readonly metaPlanByLibKey: ReadonlyMap<string, MetaPlan>;
  readonly claimedByLibKey: ReadonlyMap<string, string>;
};
