import type { CheckedSourceProgram } from "../../../packages/tsts/dist/src/index.js";

export type GateCode = "unknown-module" | "forbidden-import" | "source-cycle" | "impure-component" | "module-state" | "class"
  | "unsafe-type-escape" | "removed-concept" | "contract-shape" | "loaded-source-escape"
  | "coverage-empty" | "coverage-line" | "coverage-branch" | "coverage-function";

export interface GateFinding {
  readonly code: GateCode;
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

export type ModuleName = "ids" | "diag" | "ir-types" | "ir-hir" | "ir-infer" | "ir-tir" | "ir-mir" | "ir-facts" | "ir-program"
  | "dataflow" | "query" | "libraries" | "snapshot" | "front" | "decls" | "rules" | "infer" | "elaborate" | "validate"
  | "lower-mir" | "evaluate" | "metadata" | "analyses/liveness" | "analyses/initialization" | "analyses/refinements"
  | "analyses/origins" | "analyses/suspension" | "analyses/errorStorage" | "analyses/pointerBacking" | "summaries"
  | "pipeline" | "project" | "packages" | "plugins" | "artifacts" | "orchestration" | "cli" | "create-tsonic";

export interface HostModule {
  readonly name: ModuleName;
  readonly kind: "library" | "component" | "pipeline" | "driver" | "orchestration" | "cli";
  readonly directory: string;
  readonly contract: string;
  readonly entry: string;
  readonly imports: readonly ModuleName[];
  readonly implementationOwners: readonly ModuleName[];
}

export interface ImportEdge {
  readonly source: string;
  readonly specifier: string | null;
  readonly target: string | null;
  readonly start: number;
  readonly line: number;
  readonly column: number;
}

export interface InspectionDeps {
  readonly quarantineRoots: readonly string[];
  readonly readText: (path: string) => string;
  readonly canonical: (path: string) => string;
  readonly parse: (files: ReadonlyMap<string, string>) => CheckedSourceProgram;
  readonly graph: (source: CheckedSourceProgram, files: ReadonlyMap<string, string>) => readonly ImportEdge[];
}

export interface InspectionInputs {
  readonly root: string;
  readonly files: readonly string[];
  readonly catalogue: readonly HostModule[];
  readonly loadedFiles: readonly string[];
  readonly configurations: readonly string[];
}

export type InspectHost = (deps: InspectionDeps, inputs: InspectionInputs) => readonly GateFinding[];

export interface CompilerResult {
  readonly status: number;
  readonly diagnostics: string;
  readonly loadedFiles: readonly string[];
}

export interface IsolationDeps {
  readonly compiler: string;
  readonly platform: {
    readonly language: readonly string[];
    readonly node: readonly string[];
    readonly sdk: readonly string[];
  };
  readonly nodeTypes: string;
  readonly sdkEntry: string;
  readonly admitted: () => boolean;
  readonly canonical: (path: string) => string;
  readonly readText: (path: string) => string;
  readonly writeText: (path: string, text: string) => void;
  readonly fresh: (directory: string) => string;
  readonly discard: (directory: string) => void;
  readonly enumerate: (directory: string) => readonly string[];
  readonly inspect: (root: string, files: readonly string[]) => readonly GateFinding[];
  readonly run: (directory: string, config: string) => CompilerResult;
}

export interface IsolationInputs {
  readonly root: string;
  readonly sourceFiles: readonly string[];
  readonly interfaceSources: readonly string[];
  readonly outputDirectory: string;
}

export interface DeclarationProvenance {
  readonly source: string;
  readonly sourceHash: string;
  readonly declaration: string;
  readonly declarationHash: string;
}

export interface IsolationReport {
  readonly status: "passed" | "failed";
  readonly diagnostics: readonly string[];
  readonly findings: readonly GateFinding[];
  readonly expectedInventory: readonly string[];
  readonly loadedInventory: readonly string[];
  readonly provenance: readonly DeclarationProvenance[];
}

export type CompileIsolated = (deps: IsolationDeps, module: HostModule, inputs: IsolationInputs) => Promise<IsolationReport>;

export interface V8Range {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly count: number;
}

export interface V8Function {
  readonly functionName: string;
  readonly isBlockCoverage: boolean;
  readonly ranges: readonly V8Range[];
}

export interface V8Script {
  readonly scriptId: string;
  readonly url: string;
  readonly functions: readonly V8Function[];
}

export interface CoverageCapture {
  readonly result: readonly V8Script[];
  readonly sources: readonly {
    readonly scriptId: string;
    readonly url: string;
    readonly text: string;
  }[];
}

export interface CoverageDeps {
  readonly canonical: (path: string) => string;
  readonly readText: (path: string) => string;
  readonly parse: (files: ReadonlyMap<string, string>) => CheckedSourceProgram;
  readonly project: (url: string, text: string) => { readonly path: string; readonly text: string } | null;
}

export interface CoverageFile {
  readonly path: string;
  readonly sourceHash: string;
  readonly status: "not-applicable" | "missing" | "covered" | "uncovered";
  readonly lines: number | null;
  readonly branches: number | null;
  readonly functions: number | null;
}

export interface CoverageReport {
  readonly status: "passed" | "failed";
  readonly files: readonly CoverageFile[];
  readonly findings: readonly GateFinding[];
  readonly rawV8: readonly CoverageCapture[];
}

export type CheckCoverage = (deps: CoverageDeps, productFiles: readonly string[], rawV8: readonly CoverageCapture[]) => CoverageReport;

export declare const hostCatalogue: readonly HostModule[];
export declare function createInspectionDeps(quarantineRoots: readonly string[]): InspectionDeps;
export declare function inspectHost(deps: InspectionDeps, inputs: InspectionInputs): readonly GateFinding[];
export declare function isolationDeps(toolingRoot: string, quarantineRoots: readonly string[]): IsolationDeps;
export declare function compileIsolated(deps: IsolationDeps, module: HostModule, inputs: IsolationInputs): Promise<IsolationReport>;
export declare function checkCoverage(deps: CoverageDeps, productFiles: readonly string[], rawV8: readonly CoverageCapture[]): CoverageReport;
