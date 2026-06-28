import type {
  Node,
  SourceFile,
  Symbol,
} from "@tsonic/tsts";

export type TargetSourceUseOperation =
  | "reference"
  | "property"
  | "element"
  | "call"
  | "construct"
  | "argument"
  | "operator"
  | "iteration"
  | "spread"
  | "destructure"
  | "await"
  | "yield"
  | "return";

export type TargetSourceAccessKind = "read" | "write" | "delete";

export interface TargetSourceReferenceRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly node: Node;
}

export interface TargetSourceDeclarationRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly name?: Node;
}

export type TargetSourceImportKind = "default" | "named" | "namespace";

export interface TargetSourceImportRecord extends TargetSourceDeclarationRecord {
  readonly importDeclaration: Node;
  readonly moduleSpecifier?: Node;
  readonly importKind: TargetSourceImportKind;
  readonly isTypeOnly: boolean;
}

export type TargetSourceExportKind = "declaration" | "named" | "default";

export interface TargetSourceExportRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly exportNode: Node;
  readonly node: Node;
  readonly name?: Node;
  readonly moduleSpecifier?: Node;
  readonly exportKind: TargetSourceExportKind;
  readonly isTypeOnly: boolean;
}

export interface TargetSourceUseRecord extends TargetSourceReferenceRecord {
  readonly operation: TargetSourceUseOperation;
  readonly access: TargetSourceAccessKind;
  readonly parent?: Node;
  readonly expression?: Node;
  readonly propertyName?: string;
  readonly propertySymbol?: Symbol;
  readonly selectedDeclaration?: Node;
  readonly operator?: string;
  readonly iterationKind?: "for-in" | "for-of";
  readonly call?: Node;
  readonly argumentIndex?: number;
}

export type TargetSourceCallsiteKind = "call" | "construct";

export interface TargetSourceCallsite {
  readonly kind: TargetSourceCallsiteKind;
  readonly symbol?: Symbol;
  readonly sourceFile: SourceFile;
  readonly call: Node;
  readonly callee?: Node;
  readonly selectedSignatureDeclaration?: Node;
}

export interface TargetArgumentFlowRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly argument: Node;
  readonly call: Node;
  readonly argumentIndex: number;
  readonly selectedSignatureDeclaration?: Node;
}

export interface TargetReturnFlowRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly value: Node;
  readonly returnStatement: Node;
  readonly functionNode?: Node;
}

export interface TargetSourceEscapeRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly node: Node;
  readonly operation: TargetSourceUseOperation;
  readonly via?: Node;
}

export interface TargetSourceCaptureRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly node: Node;
  readonly functionNode: Node;
}

export interface TargetFunctionSummary {
  readonly functionNode: Node;
  readonly sourceFile?: SourceFile;
  readonly references: readonly TargetSourceReferenceRecord[];
  readonly calls: readonly TargetSourceCallsite[];
  readonly constructs: readonly TargetSourceCallsite[];
  readonly returns: readonly Node[];
}

export interface TargetLazySourceAnalysis {
  referencesOf(symbol: Symbol | undefined): readonly TargetSourceReferenceRecord[];
  declarationsOf(symbol: Symbol | undefined): readonly TargetSourceDeclarationRecord[];
  importsOf(symbol: Symbol | undefined): readonly TargetSourceImportRecord[];
  exportsOf(symbol: Symbol | undefined): readonly TargetSourceExportRecord[];
  usesOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  readsOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  writesOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  mutationsOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  propertyReadsOn(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  propertyWritesOn(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  elementReadsOn(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  elementWritesOn(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  callsitesOf(functionSymbol: Symbol | undefined): readonly TargetSourceCallsite[];
  constructSitesOf(functionSymbol: Symbol | undefined): readonly TargetSourceCallsite[];
  argumentFlowOf(symbol: Symbol | undefined): readonly TargetArgumentFlowRecord[];
  returnFlowOf(symbol: Symbol | undefined): readonly TargetReturnFlowRecord[];
  escapesOf(symbol: Symbol | undefined): readonly TargetSourceEscapeRecord[];
  capturesOf(symbol: Symbol | undefined): readonly TargetSourceCaptureRecord[];
  summaryOf(functionNode: Node): TargetFunctionSummary;
}
