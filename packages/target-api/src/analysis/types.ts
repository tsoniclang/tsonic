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
  | "argument"
  | "operator"
  | "iteration"
  | "spread"
  | "return";

export type TargetSourceAccessKind = "read" | "write" | "delete";

export interface TargetSourceReferenceRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly node: Node;
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

export interface TargetSourceCallsite {
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
  readonly returns: readonly Node[];
}

export interface TargetLazySourceAnalysis {
  referencesOf(symbol: Symbol | undefined): readonly TargetSourceReferenceRecord[];
  usesOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  mutationsOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  propertyWritesOn(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  elementWritesOn(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  callsitesOf(functionSymbol: Symbol | undefined): readonly TargetSourceCallsite[];
  argumentFlowOf(symbol: Symbol | undefined): readonly TargetArgumentFlowRecord[];
  escapesOf(symbol: Symbol | undefined): readonly TargetSourceEscapeRecord[];
  capturesOf(symbol: Symbol | undefined): readonly TargetSourceCaptureRecord[];
  summaryOf(functionNode: Node): TargetFunctionSummary;
}
