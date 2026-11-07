// SourceSelectionFacts: per-use operation selections. Declarations come from the host-input witnesses (objects.ts);
// every descriptor comes from the value model (SourceValueFacts / SourceInstantiationFacts). No checker type here.
import type { AstReader, Node } from "@tsonic/tsts";
import type { SourceInstantiationFacts, SourceRefusal, SourceTypeOutcome, SourceValueFacts } from "../public/source/facts.js";
import type {
  SourceCallSelection, SourceCompletionSelection, SourceGeneratorSelection, SourceIterationSelection,
  SourceMemberAccessSelection, SourceObjectLiteralElementSelection, SourceResourceSelection, SourceSelectionFacts,
  SourceCallParameter, SourceResourceAlternative, SourceStorageSelection, SourceYieldSelection,
} from "../public/source/selections.js";
import type { SourceTypeDescriptor } from "../source-semantics/local-type-flow/types.js";
import { sourceTypeDescriptorStructure } from "../source-semantics/local-type-flow/terms.js";
import type { HostCheckerInput, HostWitnessRefusal } from "../host-input/objects.js";

export interface SourceSelectionInput {
  readonly ast: AstReader;
  readonly witnesses: HostCheckerInput;
  readonly values: SourceValueFacts;
  readonly instantiations: SourceInstantiationFacts;
  /** The native pointer operation records of the value model (writer A2, program-facts.ts). */
  readonly pointerOperation: SourceSelectionFacts["pointerOperation"];
}

const anyDescriptor: SourceTypeDescriptor = Object.freeze({ kind: "intrinsic", intrinsic: "any" });

/** A refused value outcome as a Source refusal (code, message, site unchanged). */
export function sourceRefusalOfOutcome(outcome: Extract<SourceTypeOutcome, { readonly kind: "refused" }>): SourceRefusal {
  return Object.freeze({
    kind: "refused", code: outcome.code, message: outcome.reason, site: outcome.site,
    ...(outcome.related === undefined ? {} : { related: outcome.related }),
  });
}

function sourceRefusalOfWitness(refusal: HostWitnessRefusal): SourceRefusal {
  return Object.freeze({ kind: "refused", code: refusal.code, message: refusal.message, site: refusal.site });
}

export function createSourceSelectionFacts(input: SourceSelectionInput): SourceSelectionFacts & {
  /** Every selection refusal raised so far, in first-request order (B's share of SourceProgramFacts.refusals()). */
  refusals(): readonly SourceRefusal[];
} {
  const { ast, witnesses, values, instantiations } = input;
  const raised: SourceRefusal[] = [];
  const raisedSites = new Set<string>();
  const raise = (refusal: SourceRefusal): SourceRefusal => {
    const key = `${refusal.code}\u0000${ast.pos(refusal.site)}\u0000${ast.getFileName(ast.getSourceFile(refusal.site)!)}`;
    if (!raisedSites.has(key)) { raisedSites.add(key); raised.push(refusal); }
    return refusal;
  };
  const calls = new WeakMap<Node, SourceCallSelection | SourceRefusal | null>();
  const members = new WeakMap<Node, SourceMemberAccessSelection | null>();
  const iterations = new WeakMap<Node, SourceIterationSelection | SourceRefusal | null>();

  /** Descriptor of a value outcome, or the refusal that withholds it. */
  const typeOf = (node: Node): SourceTypeDescriptor | SourceRefusal => {
    const outcome = values.type(node);
    return outcome.kind === "refused" ? sourceRefusalOfOutcome(outcome) : outcome.type;
  };
  const isRefusal = (value: SourceTypeDescriptor | SourceRefusal): value is SourceRefusal =>
    (value as { readonly kind: string }).kind === "refused";

  const call = (use: Node): SourceCallSelection | SourceRefusal | undefined => {
    const known = calls.get(use);
    if (known !== undefined) return known ?? undefined;
    const witness = witnesses.call(use);
    if (witness === undefined) { calls.set(use, null); return undefined; }
    if (witness.kind === "refused") { const refused = raise(sourceRefusalOfWitness(witness)); calls.set(use, refused); return refused; }
    const instantiation = instantiations.at(use);
    if (instantiation?.kind === "refused") { const refused = raise(instantiation); calls.set(use, refused); return refused; }
    const parameters: SourceCallParameter[] = [];
    for (const [index, parameter] of witness.parameters.entries()) {
      const selected = instantiation?.parameters[index] ?? typeOf(parameter.declaration);
      if (isRefusal(selected)) { const refused = raise(selected); calls.set(use, refused); return refused; }
      parameters.push(Object.freeze({ declaration: parameter.declaration, kind: parameter.kind, name: parameter.name, type: selected }));
    }
    const result = instantiation?.result ?? typeOf(use);
    if (isRefusal(result)) { const refused = raise(result); calls.set(use, refused); return refused; }
    const selection: SourceCallSelection = Object.freeze({
      use,
      kind: witness.callKind,
      callee: witness.callee,
      ...(witness.declaration === undefined ? {} : { declaration: witness.declaration }),
      signature: witness.signature,
      overloadIndex: witness.overloadIndex,
      ...(witness.receiver === undefined ? {} : { receiver: witness.receiver }),
      arguments: witness.arguments,
      signatureParameters: Object.freeze(witness.parameters.map(parameter =>
        Object.freeze({ declaration: parameter.declaration, kind: parameter.kind }))),
      parameters: Object.freeze(parameters),
      result,
      optionalChain: witness.optionalChain,
    });
    calls.set(use, selection);
    return selection;
  };

  const memberAccess = (use: Node): SourceMemberAccessSelection | undefined => {
    const known = members.get(use);
    if (known !== undefined) return known ?? undefined;
    const witness = witnesses.memberAccess(use);
    const receiverType = witness === undefined ? undefined : typeOf(witness.receiver);
    const result = witness === undefined ? undefined : typeOf(use);
    // A refused receiver or result is published in refusals() by its value owner; the access has no selection.
    if (witness === undefined || receiverType === undefined || result === undefined || isRefusal(receiverType) || isRefusal(result)) {
      members.set(use, null);
      return undefined;
    }
    const selection: SourceMemberAccessSelection = Object.freeze({
      use, receiver: witness.receiver, receiverType,
      ...(witness.receiverValue === undefined ? {} : { receiverValue: witness.receiverValue }),
      name: witness.name, selected: witness.selected, result, access: witness.access, optionalChain: witness.optionalChain,
    });
    members.set(use, selection);
    return selection;
  };

  const objectLiteralElement = (element: Node): SourceObjectLiteralElementSelection | undefined => {
    const witness = witnesses.objectLiteralElement(element);
    if (witness === undefined) return undefined;
    const value = typeOf(witness.value);
    if (isRefusal(value)) return undefined;
    const destinationDeclaration = witness.destinations[0];
    const destinationType = destinationDeclaration === undefined ? undefined : typeOf(destinationDeclaration);
    if (destinationType !== undefined && isRefusal(destinationType)) return undefined;
    return Object.freeze({
      objectLiteral: witness.objectLiteral, element, elementKind: witness.elementKind,
      ...(destinationType === undefined ? {} : { destination: Object.freeze({ declarations: witness.destinations, type: destinationType }) }),
      value,
    });
  };

  const iteration = (statement: Node): SourceIterationSelection | SourceRefusal | undefined => {
    const known = iterations.get(statement);
    if (known !== undefined) return known ?? undefined;
    const witness = witnesses.iteration(statement);
    if (witness === undefined) { iterations.set(statement, null); return undefined; }
    if (witness.kind === "refused") { const refused = raise(sourceRefusalOfWitness(witness)); iterations.set(statement, refused); return refused; }
    const iterable = typeOf(witness.iterable);
    const element = typeOf(iterationElementSite(ast, statement));
    if (isRefusal(iterable) || isRefusal(element)) {
      const refused = raise(isRefusal(iterable) ? iterable : element as SourceRefusal);
      iterations.set(statement, refused);
      return refused;
    }
    const selection: SourceIterationSelection = Object.freeze({
      statement, protocol: witness.protocol, iterable, element,
      ...(witness.iteratorMethod === undefined ? {} : { iteratorMethod: witness.iteratorMethod }),
    });
    iterations.set(statement, selection);
    return selection;
  };

  const generator = (callable: Node): SourceGeneratorSelection | undefined => {
    const witness = witnesses.generator(callable);
    if (witness === undefined) return undefined;
    const returned = values.callableReturn(callable);
    if (returned.kind === "refused") return undefined;
    const arguments_ = returned.type.kind === "declared" ? returned.type.typeArguments : [];
    return Object.freeze({
      callable, kind: witness.async ? "async-generator" : "generator",
      yieldType: arguments_[0] ?? anyDescriptor,
      returnType: arguments_[1] ?? anyDescriptor,
      nextType: arguments_[2] ?? anyDescriptor,
    });
  };

  const completion = (callable: Node): SourceCompletionSelection | undefined => {
    const reachability = witnesses.completion(callable);
    if (reachability === undefined) return undefined;
    const returned = values.callableReturn(callable);
    if (returned.kind === "refused") return undefined;
    const asynchronous = ast.hasModifierKind(callable, "async");
    const generating = callableIsGenerator(ast, callable);
    return Object.freeze({
      callable,
      kind: generating ? asynchronous ? "async-generator" : "generator" : asynchronous ? "async" : "sync",
      result: returned.type,
      canFallThrough: reachability.canFallThrough,
    });
  };

  const resources = new WeakMap<Node, SourceResourceSelection | SourceRefusal | null>();
  /**
   * A `using` declaration: one alternative per present arm of its Host type (Host arm order). Each arm is paired with the
   * checker alternative whose selected dispose member is a member of that arm (facts.objects members by declaration);
   * a single arm with a single alternative pairs directly. An unpaired arm or alternative is an invariant failure.
   */
  const resource = (declaration: Node): SourceResourceSelection | SourceRefusal | undefined => {
    const known = resources.get(declaration);
    if (known !== undefined) return known ?? undefined;
    const witness = witnesses.resource(declaration);
    if (witness === undefined) { resources.set(declaration, null); return undefined; }
    if (witness.kind === "refused") { const refused = raise(sourceRefusalOfWitness(witness)); resources.set(declaration, refused); return refused; }
    const declared = typeOf(declaration);
    if (isRefusal(declared)) { const refused = raise(declared); resources.set(declaration, refused); return refused; }
    const arms = presentArms(declared);
    const alternatives: SourceResourceAlternative[] = arms.map(arm => {
      const candidates = witness.alternatives.length === 1 && arms.length === 1 ? witness.alternatives
        : witness.alternatives.filter(alternative => armDeclaresMember(arm, alternative.dispose));
      const kinds = new Set(candidates.map(candidate => candidate.kind));
      if (candidates.length === 0 || kinds.size !== 1) {
        throw new Error("A resource arm requires exactly one selected disposal kind (checker alternatives vs Host arms).");
      }
      return Object.freeze({ type: arm, kind: candidates[0]!.kind, dispose: candidates[0]!.dispose });
    });
    const selection: SourceResourceSelection = Object.freeze({ declaration, async: witness.async, alternatives: Object.freeze(alternatives) });
    resources.set(declaration, selection);
    return selection;
  };

  const storage = (expression: Node): SourceStorageSelection | undefined => {
    const witness = witnesses.storage(expression);
    if (witness === undefined) return undefined;
    const type = typeOf(witness.storageExpression);
    return isRefusal(type) ? undefined : Object.freeze({
      expression, storageExpression: witness.storageExpression,
      ...(witness.declaration === undefined ? {} : { declaration: witness.declaration }), type, writable: witness.writable,
    });
  };

  const yieldSelection = (expression: Node): SourceYieldSelection | SourceRefusal | undefined => {
    const witness = witnesses.yield(expression);
    if (witness === undefined) return undefined;
    const delegated = witness.delegation;
    if (delegated?.kind === "refused") return raise(sourceRefusalOfWitness(delegated));
    if (witness.kind === "delegate" && (delegated === undefined || witness.operand === undefined)) {
      throw new Error("A yield* expression requires its operand and delegated iteration protocol.");
    }
    // The delegated values flow into the delegating generator's yield slot: that slot is the element.
    let delegation: SourceIterationSelection | undefined;
    if (delegated !== undefined && witness.operand !== undefined) {
      const iterable = typeOf(witness.operand);
      if (isRefusal(iterable)) return raise(iterable);
      const outer = generator(witness.generator);
      if (outer === undefined) throw new Error("A yield* expression requires its generator selection.");
      delegation = Object.freeze({ statement: expression, protocol: delegated.protocol, iterable, element: outer.yieldType,
        ...(delegated.iteratorMethod === undefined ? {} : { iteratorMethod: delegated.iteratorMethod }) });
    }
    return Object.freeze({
      expression, generator: witness.generator, kind: witness.kind,
      ...(witness.operand === undefined ? {} : { operand: witness.operand }),
      ...(delegation === undefined ? {} : { delegation }),
    });
  };

  return Object.freeze({
    call, memberAccess, objectLiteralElement, iteration, generator, completion, resource, storage, yield: yieldSelection,
    wellKnownSymbol: (node: Node) => witnesses.wellKnownSymbol(node),
    pointerOperation: input.pointerOperation,
    refusals: () => Object.freeze([...raised]),
  });
}

/** The present (non-absent, non-never) arms of a descriptor, in Host arm order. */
function presentArms(type: SourceTypeDescriptor): readonly SourceTypeDescriptor[] {
  const structure = sourceTypeDescriptorStructure(type);
  if (structure.kind === "optional") return presentArms(structure.value);
  if (structure.kind === "union") return structure.types.flatMap(presentArms);
  return structure.kind === "intrinsic" && (structure.intrinsic === "absence" || structure.intrinsic === "void" ||
    structure.intrinsic === "never") ? [] : [type];
}

/** Whether a member of the arm's structure (own or inherited, as published on the descriptor) is `declaration`. */
function armDeclaresMember(arm: SourceTypeDescriptor, declaration: Node): boolean {
  const structure = sourceTypeDescriptorStructure(arm);
  return structure.kind === "shape" && structure.members.some(member =>
    member.origin.kind === "declared" && member.origin.declaration === declaration);
}

/** The node whose value type is the element: the for-of binding, the spread element itself, or the yield* operand. */
function iterationElementSite(ast: AstReader, statement: Node): Node {
  if (ast.is.IsForOfStatement(statement) || ast.is.IsForInStatement(statement)) {
    const initializer = ast.as.AsForInOrOfStatement(statement)?.Initializer;
    if (initializer === undefined) throw new Error("A for-of statement requires its initializer.");
    if (ast.is.IsVariableDeclarationList(initializer)) {
      const declaration = ast.as.AsVariableDeclarationList(initializer)?.Declarations?.Nodes?.[0];
      if (declaration === undefined) throw new Error("A for-of declaration list requires one declaration.");
      return declaration;
    }
    return initializer;
  }
  return statement;
}

function callableIsGenerator(ast: AstReader, callable: Node): boolean {
  const value = (ast.is.IsFunctionDeclaration(callable) ? ast.as.AsFunctionDeclaration(callable)
    : ast.is.IsFunctionExpression(callable) ? ast.as.AsFunctionExpression(callable)
    : ast.is.IsMethodDeclaration(callable) ? ast.as.AsMethodDeclaration(callable) : undefined) as
    { readonly AsteriskToken?: unknown } | undefined;
  return value?.AsteriskToken !== undefined;
}
