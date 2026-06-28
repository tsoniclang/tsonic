import type {
  Node,
  Signature,
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

export type TargetSourceOccurrence = "value" | "type" | "namespace" | "import" | "export";

export type TargetSourceUseKind =
  | "read"
  | "write"
  | "compound-write"
  | "call"
  | "construct"
  | "property-read"
  | "property-write"
  | "property-call"
  | "property-delete"
  | "element-read"
  | "element-write"
  | "element-delete"
  | "argument"
  | "return"
  | "yield"
  | "await"
  | "iteration"
  | "spread"
  | "destructure"
  | "capture"
  | "escape"
  | "operator";

export interface TargetSourceReferenceRecord {
  readonly symbol: Symbol;
  readonly resolvedSymbol?: Symbol;
  readonly sourceFile: SourceFile;
  readonly node: Node;
  readonly occurrence?: TargetSourceOccurrence;
  readonly enclosingFunction?: Node;
  readonly enclosingDeclaration?: Node;
}

export interface TargetSourceDeclarationRecord {
  readonly symbol: Symbol;
  readonly sourceFile?: SourceFile;
  readonly node: Node;
  readonly occurrence?: TargetSourceOccurrence;
  readonly enclosingFunction?: Node;
  readonly enclosingDeclaration?: Node;
}

export type TargetSourceImportKind = "default" | "named" | "namespace";

export interface TargetSourceImportRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly binding: Node;
  readonly moduleSpecifier: Node;
  readonly importKind: TargetSourceImportKind;
  readonly importedName?: string;
  readonly localName: string;
  readonly isTypeOnly: boolean;
  readonly importedSymbol?: Symbol;
}

export type TargetSourceExportKind = "local" | "named" | "default" | "assignment";

export interface TargetSourceExportRecord {
  readonly symbol: Symbol;
  readonly sourceFile: SourceFile;
  readonly declaration: Node;
  readonly node: Node;
  readonly exportKind: TargetSourceExportKind;
  readonly exportedName: string;
  readonly localName?: string;
  readonly moduleSpecifier?: Node;
  readonly isTypeOnly: boolean;
  readonly exportedSymbol?: Symbol;
}

export interface TargetSourceUseRecord extends TargetSourceReferenceRecord {
  readonly kind?: TargetSourceUseKind;
  readonly operation: TargetSourceUseOperation;
  readonly access: TargetSourceAccessKind;
  readonly parent?: Node;
  readonly expression?: Node;
  readonly base?: Node;
  readonly valueExpression?: Node;
  readonly elementArgument?: Node;
  readonly propertyName?: string;
  readonly propertySymbol?: Symbol;
  readonly selectedDeclaration?: Node;
  readonly selectedSignature?: Signature;
  readonly selectedSignatureDeclaration?: Node;
  readonly typeArguments?: readonly Node[];
  readonly arguments?: readonly Node[];
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
  readonly receiver?: Node;
  readonly propertyName?: string;
  readonly propertySymbol?: Symbol;
  readonly selectedSignature?: Signature;
  readonly selectedSignatureDeclaration?: Node;
  readonly arguments?: readonly Node[];
  readonly typeArguments?: readonly Node[];
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
  readonly sourceFile?: SourceFile;
  readonly functionNode: Node;
  readonly returnStatement: Node;
  readonly expression?: Node;
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
  readonly returnFlows?: readonly TargetReturnFlowRecord[];
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
  returnFlowOf(functionNode: Node): readonly TargetReturnFlowRecord[];
  escapesOf(symbol: Symbol | undefined): readonly TargetSourceEscapeRecord[];
  capturesOf(symbol: Symbol | undefined): readonly TargetSourceCaptureRecord[];
  summaryOf(functionNode: Node): TargetFunctionSummary;
}
