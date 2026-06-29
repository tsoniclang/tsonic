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

export interface TargetLazySourceAnalysis {
  referencesOf(symbol: Symbol | undefined): readonly TargetSourceReferenceRecord[];
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
  awaitsOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  forInSitesOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
  bindingUsesOf(symbol: Symbol | undefined): readonly TargetSourceUseRecord[];
}
