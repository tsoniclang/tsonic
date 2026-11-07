// The Host program as target-analysis reads it (invariant I3, nextgen plan §2).
// target-analysis is Host-internal but never reads the checker: checker selections arrive only through the Node-keyed
// navigation witnesses (`navigation.call`, `memberAccess`, `mergedDeclarations`, `declaredParameters`, `classConstructors`,
// references), and Source meaning only through the published facts (`facts.values`, `selections`, `objects`, `navigation`).
// `semantics` (the checker-backed services) is not part of this view, so the compiler rejects any checker query here.
import type { Node, SourceFile } from "@tsonic/tsts";
import type { HostSourceProgram } from "../source-semantics/types.js";
import type { SourceTypeDescriptor } from "../source-semantics/local-type-flow/types.js";
import { sourceTypeDescriptorStructure } from "../source-semantics/local-type-flow/terms.js";

export type SourceAnalysisProgram = Omit<HostSourceProgram, "semantics">;

/** Whether a source file is one of the program's checked files (project and library files). */
export function sourceAnalysisIncludesFile(source: Pick<SourceAnalysisProgram, "sourceFiles">, sourceFile: SourceFile | undefined): boolean {
  return sourceFile !== undefined && source.sourceFiles.includes(sourceFile);
}

/** Whether a node lies in one of the program's checked files. */
export function sourceAnalysisIncludesNode(source: Pick<SourceAnalysisProgram, "ast" | "sourceFiles">, node: Node): boolean {
  return sourceAnalysisIncludesFile(source, source.ast.getSourceFile(node));
}

/** The Host descriptor of a value node, or undefined when the Host refused the value (the refusal is in facts.refusals()). */
export function sourceAnalysisValueType(source: Pick<SourceAnalysisProgram, "facts">, node: Node): SourceTypeDescriptor | undefined {
  const outcome = source.facts.values.type(node);
  return outcome.kind === "refused" ? undefined : outcome.type;
}

/** The Host result descriptor of a callable declaration (awaited payload for async non-generator callables), or undefined when refused. */
export function sourceAnalysisCallableResult(source: Pick<SourceAnalysisProgram, "ast" | "facts">, declaration: Node): SourceTypeDescriptor | undefined {
  // An async generator result is its declared AsyncGenerator, not an awaited payload.
  const awaited = source.ast.hasModifierKind(declaration, "async") && source.facts.selections.generator(declaration) === undefined;
  const outcome = awaited ? source.facts.values.awaited(declaration) : source.facts.values.callableReturn(declaration);
  return outcome.kind === "refused" ? undefined : outcome.type;
}

/** The descriptor with alias/declared definitions followed and `optional` kept (structure of one arm). */
export function sourceAnalysisStructure(type: SourceTypeDescriptor): SourceTypeDescriptor {
  return sourceTypeDescriptorStructure(type);
}

/** The arms of a descriptor: union members (flattened), the value and absence of an optional, else the descriptor. */
export function sourceAnalysisArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] {
  const structure = sourceTypeDescriptorStructure(type);
  if (structure.kind === "union") return structure.types.flatMap(sourceAnalysisArms);
  if (structure.kind === "optional") return [...sourceAnalysisArms(structure.value), absenceDescriptor];
  return [type];
}

const absenceDescriptor: SourceTypeDescriptor = Object.freeze({ kind: "intrinsic", intrinsic: "absence" });

/** An arm that is only null/undefined/void (checker isNullish || isVoidLike). */
export function sourceAnalysisIsAbsentArm(type: SourceTypeDescriptor): boolean {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "intrinsic" && (structure.intrinsic === "absence" || structure.intrinsic === "void");
}

/** An arm that admits any value (any / unknown). */
export function sourceAnalysisIsOpenArm(type: SourceTypeDescriptor): boolean {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "intrinsic" && (structure.intrinsic === "any" || structure.intrinsic === "unknown");
}

/** An arm with no values. */
export function sourceAnalysisIsNeverArm(type: SourceTypeDescriptor): boolean {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "intrinsic" && structure.intrinsic === "never";
}

/** The whole value is absent: every arm is absence/void (a never type is not absent). */
export function sourceAnalysisIsAbsent(type: SourceTypeDescriptor): boolean {
  const arms = sourceAnalysisArms(type).filter(arm => !sourceAnalysisIsNeverArm(arm));
  return arms.length !== 0 && arms.every(sourceAnalysisIsAbsentArm);
}

/** The value may be absent at runtime: an absence/void arm, an optional, or an any/unknown arm. */
export function sourceAnalysisMayBeAbsent(type: SourceTypeDescriptor): boolean {
  return sourceAnalysisArms(type).some(arm => sourceAnalysisIsAbsentArm(arm) || sourceAnalysisIsOpenArm(arm));
}

/** The present arms: absence, void and never arms removed. Empty when the value is never present. */
export function sourceAnalysisPresentArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] {
  return sourceAnalysisArms(type).filter(arm => !sourceAnalysisIsAbsentArm(arm) && !sourceAnalysisIsNeverArm(arm));
}

/**
 * A scalar arm: a primitive (number family, bool, char), string, bigint, symbol, or an enum (checker
 * isStringLike / isNumberLike / isBooleanLike / isBigIntLike / isSymbolLike on a non-union type).
 */
export function sourceAnalysisIsScalar(type: SourceTypeDescriptor, isEnumDeclaration: (node: Node) => boolean): boolean {
  const structure = sourceTypeDescriptorStructure(type);
  if (structure.kind === "primitive" || structure.kind === "string") return true;
  if (structure.kind === "intrinsic") return structure.intrinsic === "bigint" || structure.intrinsic === "symbol";
  return structure.kind === "declared" && isEnumDeclaration(structure.declaration);
}

/** The callable signatures a descriptor arm carries (call signatures of a callable or shape). */
export function sourceAnalysisCallSignatures(type: SourceTypeDescriptor) {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "callable" || structure.kind === "shape" ? structure.calls : [];
}

/** The construct signatures a descriptor arm carries. */
export function sourceAnalysisConstructSignatures(type: SourceTypeDescriptor) {
  const structure = sourceTypeDescriptorStructure(type);
  return structure.kind === "callable" || structure.kind === "shape" ? structure.constructs : [];
}
