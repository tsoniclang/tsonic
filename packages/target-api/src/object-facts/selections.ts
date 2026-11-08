// SourceSelectionFacts: per-use operation selections. Declarations come from the host-input witnesses (objects.ts);
// every descriptor comes from the value model (SourceValueFacts / SourceInstantiationFacts). No checker type here.
import type { AstReader, Node } from "@tsonic/tsts";
import type {
  SourceInstantiationFacts, SourceRefusal, SourceSumFacts, SourceTypeOutcome, SourceValueFacts,
} from "../public/source/facts.js";
import type {
  SourceCallSelection, SourceCompletionSelection, SourceGeneratorSelection, SourceIterationSelection,
  SourceMemberAccessSelection, SourceObjectLiteralElementSelection, SourceResourceSelection, SourceSelectionFacts,
  SourceCallParameter, SourceCallSignatureParameter, SourceResourceAlternative, SourceStorageSelection, SourceTupleLiteralSelection, SourceUnresolvedIterationSelection, SourceYieldSelection,
} from "../public/source/selections.js";
import type { SourceTypeDescriptor } from "../source-semantics/descriptor-model.js";
import { sourceTypeDescriptorStructure, sourceTypeDescriptorsEqual } from "../source-semantics/descriptor-model.js";
import type { HostCheckerInput, HostParameterWitness, HostWitnessRefusal } from "../host-input/objects.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import { sourceTypeDescriptorPresentArms } from "../source-semantics/descriptor-arms.js";
import { isSourceCallableSignatureDeclaration } from "../source-model/callable-boundaries.js";

export interface SourceSelectionInput {
  readonly ast: AstReader;
  readonly witnesses: HostCheckerInput;
  readonly values: SourceValueFacts;
  readonly instantiations: SourceInstantiationFacts;
  /** The native pointer operation records of the value model (writer A2, program-facts.ts). */
  readonly pointerOperation: SourceSelectionFacts["pointerOperation"];
  /** The one union builder and the sole substitution of the value model (I6). */
  readonly sums: Pick<SourceSumFacts, "join" | "substitute">;
  readonly navigation: Pick<SourceProgramNavigation, "isProjectDeclaration" | "mergedDeclarations" | "declaredHeritage">;
}

const stringDescriptor: SourceTypeDescriptor = Object.freeze({ kind: "string" });

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
  /**
   * The Source refusal of the iteration protocol at a for-of statement or spread element (the checker witness: untyped
   * or per-arm-mixed iteration), raised into refusals(); undefined when the protocol is admitted. Asks no value fact,
   * so the eager census never queries a node outside the value domain (a SpreadElement is not a value node).
   */
  iterationProtocolRefusal(site: Node): SourceRefusal | undefined;
  /**
   * The value-parameter slots of a signature declaration (analyses.signatureParameters, FX-CC #13): the same slots, by
   * the same translation, as SourceCallSelection.signatureParameters of every call selecting it; undefined for a node
   * that is not a signature declaration.
   */
  signatureParameters(signature: Node): readonly SourceCallSignatureParameter[] | undefined;
} {
  const { ast, witnesses, values, instantiations, sums, navigation } = input;
  const raised: SourceRefusal[] = [];
  const raisedSites = new Set<string>();
  const raise = (refusal: SourceRefusal): SourceRefusal => {
    const key = `${refusal.code}\u0000${ast.pos(refusal.site)}\u0000${ast.getFileName(ast.getSourceFile(refusal.site)!)}`;
    if (!raisedSites.has(key)) { raisedSites.add(key); raised.push(refusal); }
    return refusal;
  };
  const calls = new WeakMap<Node, SourceCallSelection | SourceRefusal | null>();
  const members = new WeakMap<Node, SourceMemberAccessSelection | null>();
  const iterations = new WeakMap<Node, SourceIterationSelection | SourceUnresolvedIterationSelection | SourceRefusal | null>();
  const signatures = new WeakMap<Node, readonly SourceCallSignatureParameter[] | null>();

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
    if (instantiation !== undefined && instantiation.parameters.length < witness.parameters.length) {
      throw new Error(`The instantiation of '${ast.text(use)}' has ${instantiation.parameters.length} parameter types for ` +
        `${witness.parameters.length} selected parameters (I4).`);
    }
    for (const [index, parameter] of witness.parameters.entries()) {
      const selected = instantiation === undefined ? typeOf(parameter.declaration) : instantiation.parameters[index]!;
      if (isRefusal(selected)) { const refused = raise(selected); calls.set(use, refused); return refused; }
      parameters.push(Object.freeze({ declaration: parameter.declaration, kind: parameter.kind, name: parameter.name, type: selected }));
    }
    const result = instantiation === undefined ? typeOf(use) : instantiation.result;
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
      signatureParameters: signatureSlots(witness.parameters),
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
      // FX-CC #7: the access is not writable (readonly modifier, getter-only member, readonly index signature, mapped
      // readonly modifier, const / enum / import binding, readonly array or tuple), for every receiver kind.
      readonly: accessIsReadonly(witness, receiverType),
    });
    members.set(use, selection);
    return selection;
  };

  /**
   * Whether a member access is read-only at its use (baseline: `!writable` of the checker property-access record), from
   * the selected declarations and the receiver's Host descriptor: a `readonly` property or index signature, a getter
   * with no setter, a const variable, an enum member or an import binding, a readonly-flagged member of a receiver arm
   * (mapped `readonly` modifier), or an element of a readonly array or tuple arm.
   */
  const accessIsReadonly = (witness: NonNullable<ReturnType<HostCheckerInput["memberAccess"]>>,
    receiverType: SourceTypeDescriptor): boolean => {
    if (witness.selected.kind === "index-signature") return ast.hasModifierKind(witness.selected.declaration, "readonly");
    const declarations = witness.selected.declarations;
    if (declarations.some(declaration => declarationIsReadonly(declaration))) return true;
    return sourceTypeDescriptorPresentArms(receiverType).some(arm => {
      const structure = sourceTypeDescriptorStructure(arm);
      if (structure.kind === "array" || structure.kind === "tuple") return structure.readonly && ast.is.IsElementAccessExpression(witness.use);
      return structure.kind === "shape" && structure.members.some(member => member.name === witness.name && member.readonly === true);
    });
  };
  const declarationIsReadonly = (declaration: Node): boolean => {
    if (ast.is.IsEnumMember(declaration) || ast.is.IsImportSpecifier(declaration) || ast.is.IsNamespaceImport(declaration) ||
      ast.is.IsImportClause(declaration)) return true;
    if (ast.is.IsVariableDeclaration(declaration)) return ast.variableDeclarationKind(declaration) === "const";
    if (ast.is.IsGetAccessorDeclaration(declaration)) {
      const owner = ast.parent(declaration);
      const name = ast.name(declaration);
      if (owner === undefined || name === undefined) return false;
      const text = ast.text(name);
      const statics = ast.hasModifierKind(declaration, "static");
      const siblings = ast.is.IsObjectLiteralExpression(owner) ? ast.properties(owner) : ast.members(owner);
      return !siblings.some(member => member !== undefined && ast.is.IsSetAccessorDeclaration(member) &&
        ast.hasModifierKind(member, "static") === statics && ast.name(member) !== undefined && ast.text(ast.name(member)!) === text);
    }
    return (ast.is.IsPropertyDeclaration(declaration) || ast.is.IsPropertySignatureDeclaration(declaration) ||
      ast.is.IsParameterDeclaration(declaration)) && ast.hasModifierKind(declaration, "readonly");
  };

  /**
   * The value parameters of a callable or signature declaration from its declaration syntax (declaration input, R3):
   * declaration order, a leading `this` parameter excluded; "rest" for `...p`, "optional" for `p?` or a default,
   * else "required". undefined for a node that is no callable signature declaration.
   */
  const declaredParameterWitnesses = (signature: Node): readonly HostParameterWitness[] | undefined => {
    if (!isSourceCallableSignatureDeclaration(ast, signature)) return undefined;
    return Object.freeze(ast.parameters(signature).flatMap((parameter): HostParameterWitness[] => {
      if (parameter === undefined) return [];
      const name = ast.name(parameter);
      const text = name === undefined ? "" : ast.text(name);
      if (text === "this") return [];
      const value = ast.as.AsParameterDeclaration(parameter);
      const kind = value?.DotDotDotToken !== undefined ? "rest" as const
        : value?.QuestionToken !== undefined || value?.Initializer !== undefined ? "optional" as const : "required" as const;
      return [Object.freeze({ declaration: parameter, name: text, kind })];
    }));
  };

  const objectLiteralElement = (element: Node): SourceObjectLiteralElementSelection | undefined => {
    const witness = witnesses.objectLiteralElement(element);
    if (witness === undefined) return undefined;
    // An accessor element has no value of its own: a getter supplies its Host result, a setter accepts its parameter's
    // Host type (the member's read and write types).
    const setterParameter = witness.elementKind === "set" ? ast.parameters(witness.value)[0] : undefined;
    const getterResult = witness.elementKind === "get" ? values.callableReturn(witness.value) : undefined;
    const value = getterResult !== undefined
      ? getterResult.kind === "refused" ? sourceRefusalOfOutcome(getterResult) : getterResult.type
      : witness.elementKind === "set"
        ? setterParameter === undefined ? undefined : typeOf(setterParameter)
        : typeOf(witness.value);
    if (value === undefined) return undefined;
    if (isRefusal(value)) return undefined;
    const destinationDeclaration = witness.destinations[0];
    const destinationType = destinationDeclaration === undefined ? undefined
      : literalDestinationMember(witness.objectLiteral, destinationDeclaration) ?? typeOf(destinationDeclaration);
    if (destinationType !== undefined && isRefusal(destinationType)) return undefined;
    return Object.freeze({
      objectLiteral: witness.objectLiteral, element, elementKind: witness.elementKind,
      ...(destinationType === undefined ? {} : { destination: Object.freeze({ declarations: witness.destinations, type: destinationType }) }),
      value,
    });
  };

  const iteration = (statement: Node): SourceIterationSelection | SourceUnresolvedIterationSelection | SourceRefusal | undefined => {
    const known = iterations.get(statement);
    if (known !== undefined) return known ?? undefined;
    const witness = witnesses.iteration(statement);
    if (witness === undefined) { iterations.set(statement, null); return undefined; }
    if (witness.kind === "refused") { const refused = raise(sourceRefusalOfWitness(witness)); iterations.set(statement, refused); return refused; }
    const iterable = typeOf(witness.iterable);
    if (witness.kind === "for-await-unresolved") {
      if (isRefusal(iterable)) { const refused = raise(iterable); iterations.set(statement, refused); return refused; }
      const unresolved: SourceUnresolvedIterationSelection = Object.freeze({
        kind: "unresolved-protocol", statement, iterable, reason: witness.reason,
        alternatives: Object.freeze(witness.alternatives.map(alternative => Object.freeze({ protocol: alternative.protocol,
          ...(alternative.iteratorMethod === undefined ? {} : { iteratorMethod: alternative.iteratorMethod }) }))),
      });
      iterations.set(statement, unresolved);
      return unresolved;
    }
    const declared = iterationDeclaration(ast, statement);
    const element = declared !== undefined ? typeOf(declared)
      : isRefusal(iterable) ? iterable : iterationElement(statement, iterable, witness.protocol, witness.iteratorMethod);
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
    const protocol = protocolArguments(returned.type);
    if (protocol === undefined || !Array.isArray(protocol)) return undefined;
    const [yieldType, returnType, nextType] = protocol;
    if (yieldType === undefined || returnType === undefined || nextType === undefined) {
      throw new Error(`The generator '${ast.text(callable)}' returns a library iteration protocol with fewer than three binders (I4).`);
    }
    return Object.freeze({ callable, kind: witness.async ? "async-generator" : "generator", yieldType, returnType, nextType });
  };

  /**
   * The type arguments of the library iteration-protocol interface a descriptor names (Generator, AsyncGenerator,
   * Iterator, IterableIterator, Iterable, SetIterator ...), followed through alias definitions (which the value model
   * publishes already applied): one per binder of that interface, in the interface's own binder order (yield, return,
   * next for every library protocol interface), the applied argument else the binder's authored default with the earlier
   * bindings substituted (the sole substitution, I6). A project interface names the protocol its `extends` clauses name
   * (`interface Steps<T> extends Generator<T, void, unknown> {}`, FX-HS #29); the clauses that name a protocol must name
   * the same one. undefined when the descriptor names no library interface.
   */
  const protocolArguments = (type: SourceTypeDescriptor, depth = 0): readonly SourceTypeDescriptor[] | SourceRefusal | undefined => {
    let current: SourceTypeDescriptor | undefined = type;
    const seen = new Set<SourceTypeDescriptor>();
    while (current?.kind === "declared" && !seen.has(current)) {
      seen.add(current);
      if (ast.is.IsInterfaceDeclaration(current.declaration)) return interfaceProtocol(current.declaration, current.typeArguments, depth);
      current = current.definition;
    }
    return undefined;
  };
  /**
   * The protocol arguments of an interface applied to `typeArguments`. A library interface is the protocol itself. A
   * project interface names the protocol of its `extends` clauses: each clause's target (an interface, or an alias
   * through its Host type) applied to the clause's type arguments, with the project interface's binders bound to
   * `typeArguments` (the sole substitution, I6).
   */
  const interfaceProtocol = (declaration: Node, typeArguments: readonly SourceTypeDescriptor[], depth: number):
    readonly SourceTypeDescriptor[] | SourceRefusal | undefined => {
    const binders = ast.typeParameters(declaration).filter((binder): binder is Node => binder !== undefined);
    if (!navigation.isProjectDeclaration(declaration)) {
      const bindings = new Map<Node, SourceTypeDescriptor>();
      const applied: SourceTypeDescriptor[] = [];
      for (const [index, binder] of binders.entries()) {
        let argument = typeArguments[index];
        if (argument === undefined) {
          const authored = ast.as.AsTypeParameterDeclaration(binder)?.DefaultType;
          if (authored === undefined) return undefined;
          const selected = typeOf(authored);
          if (isRefusal(selected)) return selected;
          argument = sums.substitute(selected, bindings);
        }
        bindings.set(binder, argument);
        applied.push(argument);
      }
      return Object.freeze(applied);
    }
    if (depth > 32) return undefined;
    const heritage = navigation.declaredHeritage(declaration);
    if (heritage.kind !== "resolved") return undefined;
    const own = new Map<Node, SourceTypeDescriptor>();
    for (const [index, binder] of binders.entries()) {
      const argument = typeArguments[index];
      if (argument !== undefined) own.set(binder, argument);
    }
    let selected: readonly SourceTypeDescriptor[] | undefined;
    for (const edge of heritage.edges) {
      const target = edge.target.declaration;
      const applied: SourceTypeDescriptor[] = [];
      for (const argument of edge.typeArguments) {
        const described = typeOf(argument);
        if (isRefusal(described)) return described;
        applied.push(own.size === 0 ? described : sums.substitute(described, own));
      }
      let protocol: readonly SourceTypeDescriptor[] | SourceRefusal | undefined;
      if (ast.is.IsInterfaceDeclaration(target)) protocol = interfaceProtocol(target, applied, depth + 1);
      else if (ast.is.IsTypeAliasDeclaration(target)) {
        const alias = typeOf(target);
        if (isRefusal(alias)) return alias;
        const bindings = new Map<Node, SourceTypeDescriptor>();
        for (const [index, binder] of ast.typeParameters(target).entries()) {
          const argument = applied[index];
          if (binder !== undefined && argument !== undefined) bindings.set(binder, argument);
        }
        protocol = protocolArguments(bindings.size === 0 ? alias : sums.substitute(alias, bindings), depth + 1);
      } else continue;
      if (protocol === undefined) continue;
      if (!Array.isArray(protocol)) return protocol as SourceRefusal;
      const arguments_ = protocol as readonly SourceTypeDescriptor[];
      if (selected !== undefined && (selected.length !== arguments_.length ||
        selected.some((argument, index) => !sourceTypeDescriptorsEqual(argument, arguments_[index]!)))) return undefined;
      selected = arguments_;
    }
    return selected;
  };

  /**
   * The element an iteration yields from its iterable's Host descriptor: an array's element, a tuple's elements joined
   * by the one union builder, a string's character (string), or the yield binder of the library iterator protocol the
   * selected [Symbol.iterator] / [Symbol.asyncIterator] method returns, with the iterable's own binders substituted.
   * A supported iteration whose element no rule names is an invariant failure (I4).
   */
  const iterationElement = (site: Node, iterable: SourceTypeDescriptor, protocol: SourceIterationSelection["protocol"],
    iteratorMethod: Node | undefined): SourceTypeDescriptor | SourceRefusal => {
    const structure = sourceTypeDescriptorStructure(iterable);
    if (structure.kind === "array") return structure.element;
    if (structure.kind === "tuple") {
      const joined = sums.join(structure.elements.map(element => element.type));
      if (joined !== undefined) return joined;
    }
    if (structure.kind === "string" || protocol === "string") return stringDescriptor;
    if (iteratorMethod !== undefined) {
      const returned = values.callableReturn(iteratorMethod);
      if (returned.kind === "refused") return sourceRefusalOfOutcome(returned);
      const owner = ast.parent(iteratorMethod);
      const bindings = new Map<Node, SourceTypeDescriptor>();
      for (let current: SourceTypeDescriptor | undefined = iterable; current?.kind === "declared"; current = current.definition) {
        const declaration = current.declaration;
        if (owner !== undefined && (declaration === owner || navigation.mergedDeclarations(declaration).includes(owner))) {
          const binders = ast.typeParameters(owner).filter((binder): binder is Node => binder !== undefined);
          for (const [index, binder] of binders.entries()) {
            const argument = current.typeArguments[index];
            if (argument !== undefined) bindings.set(binder, argument);
          }
          break;
        }
      }
      const iterator = protocolArguments(bindings.size === 0 ? returned.type : sums.substitute(returned.type, bindings));
      if (iterator !== undefined && !Array.isArray(iterator)) return iterator as SourceRefusal;
      const element = (iterator as readonly SourceTypeDescriptor[] | undefined)?.[0];
      if (element !== undefined) return element;
    }
    throw new Error(`The iteration at '${ast.text(site)}' has no Host element type for its iterable (I4).`);
  };

  /** The member type the literal's Host destination gives the destination declaration (instantiated, e.g. Box<number>). */
  const literalDestinationMember = (objectLiteral: Node, declaration: Node): SourceTypeDescriptor | undefined => {
    const destination = values.contextual(objectLiteral);
    if (destination === undefined || destination.kind === "refused") return undefined;
    const structure = sourceTypeDescriptorStructure(destination.type);
    return structure.kind === "shape" ? structure.members.find(member =>
      member.origin.kind === "declared" && member.origin.declaration === declaration)?.type : undefined;
  };

  const tupleUnavailable: SourceTupleLiteralSelection = Object.freeze({ kind: "unavailable" });
  const tupleLiteral = (literal: Node): SourceTupleLiteralSelection => {
    if (!ast.is.IsArrayLiteralExpression(literal)) throw new Error("A tuple-literal selection requires an array literal.");
    const present = ast.elements(literal);
    if (present.some(element => element !== undefined && ast.is.IsSpreadElement(element))) return tupleUnavailable;
    const destination = values.contextual(literal);
    if (destination === undefined || destination.kind === "refused") return tupleUnavailable;
    const structure = sourceTypeDescriptorStructure(destination.type);
    const tuple = structure.kind === "optional" ? sourceTypeDescriptorStructure(structure.value) : structure;
    if (tuple.kind !== "tuple" || present.length > tuple.elements.length ||
      tuple.elements.some(element => element.kind === "rest")) return tupleUnavailable;
    const omitted = tuple.elements.flatMap((element, index) => index >= present.length && element.kind === "optional" ? [index] : []);
    if (omitted.length !== tuple.elements.length - present.length) return tupleUnavailable;
    return Object.freeze({ kind: "selected", literal, type: tuple, elements: tuple.elements,
      omittedOptionalElementIndexes: Object.freeze(omitted) });
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
    const arms = sourceTypeDescriptorPresentArms(declared);
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
    call, memberAccess, objectLiteralElement, iteration, generator, tupleLiteral, completion, resource, storage, yield: yieldSelection,
    wellKnownSymbol: (node: Node) => witnesses.wellKnownSymbol(node),
    pointerOperation: input.pointerOperation,
    refusals: () => Object.freeze([...raised]),
    signatureParameters(signature: Node): readonly SourceCallSignatureParameter[] | undefined {
      const known = signatures.get(signature);
      if (known !== undefined) return known ?? undefined;
      const witness = declaredParameterWitnesses(signature);
      const selected = witness === undefined ? undefined : signatureSlots(witness);
      signatures.set(signature, selected ?? null);
      return selected;
    },
    iterationProtocolRefusal(site: Node): SourceRefusal | undefined {
      const witness = witnesses.iteration(site);
      return witness?.kind === "refused" ? raise(sourceRefusalOfWitness(witness)) : undefined;
    },
  });
}


/** The one translation of signature parameter witnesses into published slots (call selections and signatures alike). */
function signatureSlots(parameters: readonly HostParameterWitness[]): readonly SourceCallSignatureParameter[] {
  return Object.freeze(parameters.map(parameter => Object.freeze({ declaration: parameter.declaration, kind: parameter.kind })));
}

/** Whether a member of the arm's structure (own or inherited, as published on the descriptor) is `declaration`. */
function armDeclaresMember(arm: SourceTypeDescriptor, declaration: Node): boolean {
  const structure = sourceTypeDescriptorStructure(arm);
  return structure.kind === "shape" && structure.members.some(member =>
    member.origin.kind === "declared" && member.origin.declaration === declaration);
}

/**
 * The declaration a for-of / for-in statement binds each element to (the value model types it with the element), or
 * undefined for a spread element and a for-of over an existing binding, whose element comes from the iterable.
 */
function iterationDeclaration(ast: AstReader, statement: Node): Node | undefined {
  if (!ast.is.IsForOfStatement(statement) && !ast.is.IsForInStatement(statement)) return undefined;
  const initializer = ast.as.AsForInOrOfStatement(statement)?.Initializer;
  if (initializer === undefined) throw new Error("A for-of statement requires its initializer.");
  if (!ast.is.IsVariableDeclarationList(initializer)) return undefined;
  const declaration = ast.as.AsVariableDeclarationList(initializer)?.Declarations?.Nodes?.[0];
  if (declaration === undefined) throw new Error("A for-of declaration list requires one declaration.");
  return declaration;
}

function callableIsGenerator(ast: AstReader, callable: Node): boolean {
  const value = (ast.is.IsFunctionDeclaration(callable) ? ast.as.AsFunctionDeclaration(callable)
    : ast.is.IsFunctionExpression(callable) ? ast.as.AsFunctionExpression(callable)
    : ast.is.IsMethodDeclaration(callable) ? ast.as.AsMethodDeclaration(callable) : undefined) as
    { readonly AsteriskToken?: unknown } | undefined;
  return value?.AsteriskToken !== undefined;
}
