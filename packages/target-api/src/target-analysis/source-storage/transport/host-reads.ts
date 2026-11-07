// Syntax and witness reads the storage scoped and transport modules share (I3): generator callables from authored syntax,
// member-call receivers from the navigation call witness, pointer records, indexes and signatures from Host facts.
import type { AstReader, Node } from "@tsonic/tsts";
import { Node_Expression } from "../../../source-navigation/index.js";
import { sourceStorageCallReceiver } from "../graph/invocation-inputs.js";
import {
  sourceAnalysisCallSignatures, sourceAnalysisConstructSignatures, sourceAnalysisIsOpenArm, sourceAnalysisPresentArms,
  type SourceAnalysisProgram,
} from "../../analysis-program.js";
import type { SourceTypeDescriptor } from "../../../source-semantics/local-type-flow/types.js";
import { sourceTypeDescriptorStructure } from "../../../source-semantics/local-type-flow/terms.js";
import type { SourceCompletionSelection } from "../../../public/source/selections.js";

/** A generator callable: a function declaration, function expression or method with an authored `*`. */
export function sourceStorageIsGenerator(ast: AstReader, callable: Node): boolean {
  const value = (ast.is.IsFunctionDeclaration(callable) ? ast.as.AsFunctionDeclaration(callable)
    : ast.is.IsFunctionExpression(callable) ? ast.as.AsFunctionExpression(callable)
    : ast.is.IsMethodDeclaration(callable) ? ast.as.AsMethodDeclaration(callable) : undefined) as
    { readonly AsteriskToken?: unknown } | undefined;
  return value?.AsteriskToken !== undefined;
}

/** The member access a call selects its callee through (`r.m()`, `r[k]()`, parentheses skipped); undefined otherwise. */
export function sourceStorageCalleeAccess(source: Pick<SourceAnalysisProgram, "ast" | "navigation">, invocation: Node): Node | undefined {
  const { ast } = source;
  let callee = source.navigation.call(invocation)?.callee;
  while (callee !== undefined && ast.is.IsParenthesizedExpression(callee)) callee = Node_Expression(ast, callee);
  return callee !== undefined && (ast.is.IsPropertyAccessExpression(callee) || ast.is.IsElementAccessExpression(callee))
    ? callee : undefined;
}

/** The receiver expression of a member call at an invocation node (sourceStorageCallReceiver over its call witness). */
export function sourceStorageInvocationReceiver(source: Pick<SourceAnalysisProgram, "ast" | "navigation">, invocation: Node): Node | undefined {
  const call = source.navigation.call(invocation);
  return call === undefined ? undefined : sourceStorageCallReceiver(source, call);
}

interface PointerBase {
  readonly call: Node;
  /** Host descriptor of the selected pointee (the marker's pointee type argument). */
  readonly pointee: SourceTypeDescriptor;
  readonly result: SourceTypeDescriptor;
  readonly location?: Node;
}

/** A native pointer operation with its operands named by role (from facts.selections.pointerOperation, I1/I3). */
export type SourceStoragePointerOperation = PointerBase & (
  | { readonly operation: "address-of"; readonly storageExpression: Node; readonly storageDeclaration?: Node }
  | { readonly operation: "allocate"; readonly initialExpression: Node }
  | { readonly operation: "load" | "hash-pointer"; readonly pointerExpression: Node }
  | { readonly operation: "store"; readonly pointerExpression: Node; readonly valueExpression: Node }
  | { readonly operation: "equal-pointer"; readonly leftExpression: Node; readonly rightExpression: Node }
  | { readonly operation: "bind-pointer"; readonly identityExpression: Node; readonly readExpression: Node; readonly writeExpression: Node }
  | { readonly operation: "project-pointer"; readonly pointerExpression: Node; readonly fromSourceExpression: Node;
      readonly toSourceExpression: Node });

/**
 * The pointer operation of a marker call, operands by role (the record's operand order is the marker parameter order).
 * undefined: the node is no pointer marker call, or the Host refused it (the refusal is in facts.refusals()).
 */
export function sourceStoragePointerOperation(source: Pick<SourceAnalysisProgram, "facts">, call: Node | undefined):
  SourceStoragePointerOperation | undefined {
  if (call === undefined) return undefined;
  const record = source.facts.selections.pointerOperation(call);
  if (record === undefined || "kind" in record) return undefined;
  const operand = (index: number): Node => {
    const selected = record.operands[index];
    if (selected === undefined) throw new Error(`Source storage: the ${record.operation} pointer record has no operand ${index}.`);
    return selected;
  };
  const base: PointerBase = { call: record.call, pointee: record.pointee, result: record.result,
    ...(record.location === undefined ? {} : { location: record.location }) };
  switch (record.operation) {
    case "address-of": return Object.freeze({ ...base, operation: record.operation, storageExpression: operand(0),
      ...(record.storageDeclaration === undefined ? {} : { storageDeclaration: record.storageDeclaration }) });
    case "allocate": return Object.freeze({ ...base, operation: record.operation, initialExpression: operand(0) });
    case "load": case "hash-pointer": return Object.freeze({ ...base, operation: record.operation, pointerExpression: operand(0) });
    case "store": return Object.freeze({ ...base, operation: record.operation, pointerExpression: operand(0), valueExpression: operand(1) });
    case "equal-pointer": return Object.freeze({ ...base, operation: record.operation, leftExpression: operand(0), rightExpression: operand(1) });
    case "bind-pointer": return Object.freeze({ ...base, operation: record.operation, identityExpression: operand(0),
      readExpression: operand(1), writeExpression: operand(2) });
    case "project-pointer": return Object.freeze({ ...base, operation: record.operation, pointerExpression: operand(0),
      fromSourceExpression: operand(1), toSourceExpression: operand(2) });
  }
}

/** The source pointee of a `project-pointer` call: the first selected method type argument. */
export function sourceStorageProjectedSourcePointee(source: Pick<SourceAnalysisProgram, "facts">, call: Node): SourceTypeDescriptor | undefined {
  const instantiation = source.facts.instantiations.at(call);
  return instantiation === undefined || instantiation.kind === "refused" ? undefined : instantiation.method[0]?.type;
}

/**
 * Whether a callable body can complete normally (fall off its end): the checker reachability witness. Request R-B4-9:
 * `SourceCompletionSelection.canFallThrough` (host-input/objects.ts witness + object-facts/selections.ts). Until it is
 * published, reading it is an invariant failure, never a guess.
 */
export function sourceStorageCompletionFallsThrough(completion: SourceCompletionSelection): boolean {
  const witness = (completion as SourceCompletionSelection & { readonly canFallThrough?: boolean }).canFallThrough;
  if (witness === undefined) {
    throw new Error("Source storage: the completion selection carries no fall-through witness (request R-B4-9: SourceCompletionSelection.canFallThrough).");
  }
  return witness;
}

/**
 * The indexed element slots of every present arm of a storage type, as their read-only flags: the element index of an
 * array or tuple arm (checker number index) and the index signatures of a shape arm (facts.objects.indexes).
 */
export function sourceStorageIndexes(source: Pick<SourceAnalysisProgram, "facts">, type: SourceTypeDescriptor):
  readonly { readonly readonly: boolean }[] {
  return sourceAnalysisPresentArms(type).filter(arm => !sourceAnalysisIsOpenArm(arm)).flatMap(arm => {
    const structure = sourceTypeDescriptorStructure(arm);
    return structure.kind === "array" || structure.kind === "tuple" ? [{ readonly: structure.readonly }]
      : source.facts.objects.indexes(arm).map(index => ({ readonly: index.readonly }));
  });
}

/** The call and construct signature declarations of every present arm of a storage type (descriptor signatures). */
export function sourceStorageSignatureDeclarations(type: SourceTypeDescriptor): readonly Node[] {
  return sourceAnalysisPresentArms(type).flatMap(arm => [...sourceAnalysisCallSignatures(arm), ...sourceAnalysisConstructSignatures(arm)])
    .flatMap(signature => signature.declaration === undefined ? [] : [signature.declaration]);
}

/** Whether a storage type has a call or construct signature in some present arm. */
export function sourceStorageHasSignatures(type: SourceTypeDescriptor): boolean {
  return sourceAnalysisPresentArms(type).some(arm =>
    sourceAnalysisCallSignatures(arm).length !== 0 || sourceAnalysisConstructSignatures(arm).length !== 0);
}
