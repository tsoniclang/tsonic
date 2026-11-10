export interface TargetSourcePackageExport {
  readonly specifier: string;
  readonly sourceFile: string;
}

export interface TargetSourcePackage {
  readonly id: string;
  readonly name?: string;
  readonly packageRoot: string;
  readonly sourceRoot: string;
  readonly sourceFiles: readonly string[];
  readonly dependencies: readonly string[];
  readonly exports: readonly TargetSourcePackageExport[];
  readonly componentId: string;
}

export interface TargetSourcePackageComponent {
  readonly id: string;
  readonly packages: readonly string[];
  readonly dependencies: readonly string[];
}

export interface TargetSourcePackageGraph {
  readonly fingerprint: string;
  readonly rootPackageId: string;
  readonly packages: readonly TargetSourcePackage[];
  readonly components: readonly TargetSourcePackageComponent[];
}
