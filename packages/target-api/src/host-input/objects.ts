// host-input/objects: the checker selection witnesses behind the role model, object facts and selections (I3).
// Node-only records; no checker Type, Signature or Symbol leaves this file. The call witness is a projection of the one
// call translator (SourceNavigationCall, host-input/navigation.ts) and the member witness a projection of the one
// member-access translator (through `SourceHostInput.member`, index.ts); this module adds only what those records do
// not carry (call kind, overload position, index signature, receiver value) and the other operation witnesses.
import type { AstReader, Node, Type } from "@tsonic/tsts";
import { isSourceCallableSignatureDeclaration } from "../source-model/callable-boundaries.js";
import type { SourceNavigationInput } from "../source-model/navigation-records.js";
import type { SourceProgramSemantics } from "./semantics-types.js";
import type { SourceHostInput } from "./index.js";

export interface HostCheckerServices {
  readonly ast: AstReader;
  /**
   * The navigation witnesses this translator reads: merged declarations and the one call witness (host-input
   * navigation input, forwarded by the program navigation), and the reference a callee identifier selects.
   */
  readonly navigation: Pick<SourceNavigationInput, "mergedDeclarations" | "call"> & {
    sourceReferenceFor(node: Node): { readonly declaration: Node } | undefined;
  };
  readonly semantics: SourceProgramSemantics;
  /** The program's host-input adapter; its member witness is reused, never re-implemented. */
  readonly input: SourceHostInput;
}

export type HostWitnessRefusal = { readonly kind: "refused"; readonly code: string; readonly message: string; readonly site: Node };

export interface HostCallWitness {
  readonly kind: "call-witness";
  readonly use: Node;
  readonly callKind: "call" | "construction" | "tagged-template" | "super-call";
  readonly callee: Node;
  readonly declaration?: Node;
  readonly signature: Node;
  readonly overloadIndex: number;
  readonly receiver?: Node;
  /** One entry per checker argument binding, in effective order (spread elements expanded). */
  readonly arguments: readonly HostArgumentWitness[];
  /** The selected signature parameters: declaration, authored name and arity kind. */
  readonly parameters: readonly HostParameterWitness[];
  readonly optionalChain: boolean;
}

export interface HostArgumentWitness {
  readonly argument: Node;
  readonly argumentIndex: number;
  readonly effectiveIndex: number;
  readonly parameterIndex: number;
  readonly mode: "positional" | "rest-element" | "spread";
  readonly form: "value" | "spread-element" | "spread-sequence";
  readonly spreadElement?: number;
}

export interface HostParameterWitness {
  readonly declaration: Node;
  readonly name: string;
  readonly kind: "required" | "optional" | "rest";
}

export interface HostMemberAccessWitness {
  readonly use: Node;
  readonly receiver: Node;
  readonly receiverValue?: { readonly declaration?: Node; readonly intrinsic?: "global-object" };
  readonly name: string;
  readonly selected:
    | { readonly kind: "member"; readonly declarations: readonly Node[] }
    | { readonly kind: "index-signature"; readonly declaration: Node };
  readonly access: "read" | "write" | "read-write" | "call";
  readonly optionalChain: boolean;
}

export interface HostObjectLiteralElementWitness {
  readonly objectLiteral: Node;
  readonly element: Node;
  readonly elementKind: "property" | "shorthand" | "method" | "get" | "set" | "spread";
  readonly destinations: readonly Node[];
  readonly value: Node;
}

export type HostIterationWitness =
  | { readonly kind: "iteration-witness"; readonly statement: Node; readonly iterable: Node;
      readonly protocol: "array" | "string" | "iterator" | "async-iterator"; readonly iteratorMethod?: Node }
  /**
   * A for-await whose iterable has no single protocol (Q94): the per-arm protocols of a union, or no typed protocol.
   * The Host raises no code here; the target refuses it with its own baseline code and texts.
   */
  | { readonly kind: "for-await-unresolved"; readonly statement: Node; readonly iterable: Node;
      readonly reason: "mixed" | "untyped"; readonly alternatives: readonly HostIterationProtocol[] }
  | HostWitnessRefusal;

export interface HostResourceWitness {
  readonly kind: "resource-witness";
  readonly async: boolean;
  /** Checker alternatives in checker order; the Host pairs each with an arm of the declaration's Host type. */
  readonly alternatives: readonly { readonly kind: "sync" | "async"; readonly dispose: Node }[];
}

export interface HostYieldWitness {
  readonly expression: Node;
  readonly generator: Node;
  readonly kind: "value" | "delegate";
  readonly operand?: Node;
  /** `yield*` only: the protocol the checker selected over the operand, or its refusal. */
  readonly delegation?: HostIterationProtocol | HostWitnessRefusal;
}

export interface HostIterationProtocol {
  readonly kind: "iteration-protocol";
  readonly protocol: "array" | "string" | "iterator" | "async-iterator";
  readonly iteratorMethod?: Node;
}

export interface HostCheckerInput {
  mergedDeclarations(declaration: Node): readonly Node[];
  call(use: Node): HostCallWitness | HostWitnessRefusal | undefined;
  memberAccess(use: Node): HostMemberAccessWitness | undefined;
  objectLiteralElement(element: Node): HostObjectLiteralElementWitness | undefined;
  iteration(statement: Node): HostIterationWitness | undefined;
  generator(callable: Node): { readonly async: boolean } | undefined;
  /** The checker reachability witness of a callable body; undefined for a callable without a body. */
  completion(callable: Node): { readonly canFallThrough: boolean } | undefined;
  /** A `using` declaration: per-alternative disposal kind and dispose member, or the untyped-disposal refusal. */
  resource(declaration: Node): HostResourceWitness | HostWitnessRefusal | undefined;
  storage(expression: Node): { readonly storageExpression: Node; readonly declaration?: Node; readonly writable: boolean } | undefined;
  /** A yield expression: its generator declaration, kind and operand. */
  yield(expression: Node): HostYieldWitness | undefined;
  wellKnownSymbol(node: Node): string | undefined;
}

const wellKnownSymbolNames: Readonly<Record<string, string>> = Object.freeze({
  "async-dispose": "Symbol.asyncDispose", "async-iterator": "Symbol.asyncIterator", dispose: "Symbol.dispose",
  "has-instance": "Symbol.hasInstance", "is-concat-spreadable": "Symbol.isConcatSpreadable", iterator: "Symbol.iterator",
  match: "Symbol.match", "match-all": "Symbol.matchAll", replace: "Symbol.replace", search: "Symbol.search",
  species: "Symbol.species", split: "Symbol.split", "to-primitive": "Symbol.toPrimitive",
  "to-string-tag": "Symbol.toStringTag", unscopables: "Symbol.unscopables",
});

/**
 * The one translation of a checker iteration mechanism (for-of, for-await-of, spread, yield*) into a Host protocol, or
 * the Source refusal of an untyped or per-arm-mixed iteration. `awaited`: the iteration is a for-await or an async
 * delegation, whose refusals carry the for-await codes (baseline messages).
 */
type IterationMechanism = { readonly kind: string; readonly protocol?: {
  readonly resolutionKind: string; readonly iteratorMethodValueDeclaration?: Node }; readonly alternatives?: readonly unknown[] };

/** A for-await mechanism without one protocol (Q94): its per-arm protocols (a union) or none (untyped). */
function forAwaitUnresolved(mechanismInput: unknown, site: Node):
  { readonly reason: "mixed" | "untyped"; readonly alternatives: readonly HostIterationProtocol[] } | undefined {
  const mechanism = mechanismInput as IterationMechanism;
  if (mechanism.kind === "untyped-dynamic-iteration") return Object.freeze({ reason: "untyped", alternatives: Object.freeze([]) });
  if (mechanism.kind !== "union" || mechanism.alternatives === undefined) return undefined;
  const alternatives = mechanism.alternatives.map(alternative => iterationProtocol(alternative, site, true))
    .filter((alternative): alternative is HostIterationProtocol => alternative.kind === "iteration-protocol");
  return Object.freeze({ reason: "mixed", alternatives: Object.freeze(alternatives) });
}

function iterationProtocol(mechanismInput: unknown, site: Node, awaited: boolean): HostIterationProtocol | HostWitnessRefusal {
  const mechanism = mechanismInput as IterationMechanism;
  const protocol = mechanism.kind === "array-like-index" || mechanism.kind === "array-like-index-adapted-to-async" ? "array" as const
    : mechanism.kind === "string-code-unit-index" || mechanism.kind === "string-code-unit-index-adapted-to-async" ? "string" as const
    : mechanism.kind === "synchronous-iterator-protocol" || mechanism.kind === "synchronous-iterator-adapted-to-async"
      ? "iterator" as const
    : mechanism.kind === "asynchronous-iterator-protocol" ? "async-iterator" as const : undefined;
  if (protocol === undefined) {
    const untyped = mechanism.kind === "untyped-dynamic-iteration";
    const code = `TSONIC_SOURCE_${awaited ? "FOR_AWAIT" : "ITERATION"}_${untyped ? "UNTYPED" : "MIXED"}`;
    const message = untyped
      ? awaited ? "for-await over an untyped value has no closed async iteration protocol."
        : "The iterated value has no typed iteration protocol."
      : awaited ? "for-await over a union selects different async iteration protocols per union arm."
        : "The iterated value selects different iteration protocols per union arm.";
    return Object.freeze({ kind: "refused", code, message, site });
  }
  const iteratorMethod = mechanism.protocol?.resolutionKind === "selected-iterator-member"
    ? mechanism.protocol.iteratorMethodValueDeclaration : undefined;
  return Object.freeze({ kind: "iteration-protocol", protocol, ...(iteratorMethod === undefined ? {} : { iteratorMethod }) });
}

export function createHostCheckerInput(services: HostCheckerServices): HostCheckerInput {
  const { ast, navigation, semantics, input } = services;
  const refusal = (code: string, site: Node, message: string): HostWitnessRefusal =>
    Object.freeze({ kind: "refused", code, message, site });

  // The iteration protocol of a spread over its iterable type (declaration input): an array-like value indexes, a string
  // indexes code units, and any other value iterates through the one [Symbol.iterator] member declaration of its type.
  // An untyped (any/unknown) operand or one with no single iterator member takes the for-of refusals.
  function spreadProtocol(site: Node, iterable: Type): HostIterationProtocol | HostWitnessRefusal {
    const queries = semantics.forNode(site);
    const { types, declarations, operations } = queries;
    if (types.isAny(iterable) || types.isUnknown(iterable)) {
      return refusal("TSONIC_SOURCE_ITERATION_UNTYPED", site, "The iterated value has no typed iteration protocol.");
    }
    if (types.isArrayLike(iterable) || types.isTuple(iterable)) return Object.freeze({ kind: "iteration-protocol", protocol: "array" });
    if (types.isStringLike(iterable)) return Object.freeze({ kind: "iteration-protocol", protocol: "string" });
    const members = new Set<Node>();
    for (const property of types.propertyInfos(iterable)) {
      for (const declaration of declarations.symbolDeclarations(property.symbol)) {
        const name = ast.name(declaration);
        if (name !== undefined && ast.is.IsComputedPropertyName(name) && operations.wellKnownSymbol(name)?.kind === "iterator") {
          members.add(declaration);
        }
      }
    }
    if (members.size === 0) return refusal("TSONIC_SOURCE_ITERATION_UNTYPED", site, "The iterated value has no typed iteration protocol.");
    if (members.size > 1) {
      return refusal("TSONIC_SOURCE_ITERATION_MIXED", site, "The iterated value selects different iteration protocols per union arm.");
    }
    return Object.freeze({ kind: "iteration-protocol", protocol: "iterator", iteratorMethod: [...members][0]! });
  }

  function superClass(callee: Node): Node | undefined {
    const queries = semantics.forNode(callee);
    const type = queries.types.expressionType(callee);
    const symbol = type === undefined ? undefined : queries.declarations.typeSymbol(type);
    return symbol === undefined ? undefined : queries.declarations.symbolDeclarations(symbol)
      .find(selected => ast.is.IsClassDeclaration(selected) || ast.is.IsClassExpression(selected));
  }

  // The entity of a declaration: the navigation input witness (one translator, host-input/navigation.ts).
  const mergedDeclarations = navigation.mergedDeclarations;

  return Object.freeze({
    mergedDeclarations,
    call(use: Node) {
      const info = navigation.call(use);
      if (info === undefined) return undefined;
      if (info.selection !== "resolved") {
        return refusal("TSONIC_SOURCE_CALL_UNTYPED", use, "The call has no selected typed signature (untyped callee).");
      }
      const callee = info.callee;
      const kind = ast.kindName(use);
      const callKind = kind === "KindNewExpression" ? "construction" : kind === "KindTaggedTemplateExpression"
        ? "tagged-template" : ast.kindName(callee) === "KindSuperKeyword" ? "super-call" : "call";
      const declaration = info.calleeAccess?.kind === "property" ? info.calleeAccess.declaration
        : navigation.sourceReferenceFor(callee)?.declaration;
      // The implicit default constructor of a class with no constructor declaration in its chain has no signature
      // declaration; its selected signature is keyed by the class declaration that owns it (the key C# construction
      // catalogs use, analysis/project-types/catalog/resolution.ts). It takes no parameters.
      // A `super()` callee names no declaration: its class is the base class, the declaration of the checked `super`
      // value's symbol (declaration identity only).
      const constructed = declaration ?? (callKind === "super-call" && info.signature === undefined ? superClass(callee) : undefined);
      const implicitConstructor = info.signature === undefined && (callKind === "construction" || callKind === "super-call") &&
        constructed !== undefined && (ast.is.IsClassDeclaration(constructed) || ast.is.IsClassExpression(constructed)) &&
        info.parameters.length === 0 ? constructed : undefined;
      const signature = info.signature ?? implicitConstructor;
      if (signature === undefined) {
        return refusal("TSONIC_SOURCE_CALL_SIGNATURE_UNDECLARED", use,
          "The selected signature of this call has no declaration (a synthesized signature).");
      }
      // Overload position: the authored position among the signature's merged callable-signature declarations
      // (overloads first, then the implementation). A signature that merges with nothing (a call signature member,
      // an arrow) is its own single overload.
      const overloads = mergedDeclarations(signature).filter(entry => isSourceCallableSignatureDeclaration(ast, entry));
      const overloadIndex = overloads.indexOf(signature);
      if (overloads.length > 0 && overloadIndex < 0) throw new Error("A selected signature must be one of its merged declarations.");
      const bindings = [...info.bindings].sort((left, right) => left.effectiveArgumentIndex - right.effectiveArgumentIndex);
      const arguments_ = bindings.map((binding, effectiveIndex) => {
        const argument = info.arguments[binding.sourceArgumentIndex];
        if (argument === undefined) throw new Error("A call argument binding requires its source argument.");
        if (binding.effectiveArgumentIndex !== effectiveIndex) throw new Error("Call argument bindings must cover every effective position once.");
        const mode = binding.sourceForm === "spread-sequence" ? "spread" as const
          : binding.sourceParameterForm === "parameter" ? "positional" as const : "rest-element" as const;
        return Object.freeze({
          argument, argumentIndex: binding.sourceArgumentIndex, effectiveIndex,
          parameterIndex: binding.sourceParameterIndex, mode, form: binding.sourceForm,
          ...(binding.sourceForm === "spread-element" && binding.spreadElementIndex !== undefined
            ? { spreadElement: binding.spreadElementIndex } : {}),
        });
      });
      const parameters = info.parameters.map((parameter, index) => {
        const declaration = parameter.parameterDeclaration;
        if (declaration === undefined) throw new Error("A declared signature parameter requires its declaration.");
        const nameNode = ast.name(declaration);
        const name = nameNode !== undefined && ast.is.IsIdentifier(nameNode) ? ast.text(nameNode) : `arg${index}`;
        const kind = parameter.rest ? "rest" as const : parameter.acceptsOmission ? "optional" as const : "required" as const;
        return Object.freeze({ declaration, name, kind });
      });
      return Object.freeze({
        kind: "call-witness" as const,
        use, callKind, callee,
        ...(declaration === undefined ? {} : { declaration }),
        signature,
        overloadIndex: Math.max(0, overloadIndex),
        ...(info.receiver === undefined ? {} : { receiver: info.receiver }),
        arguments: Object.freeze(arguments_),
        parameters: Object.freeze(parameters),
        optionalChain: info.optionalChain,
      });
    },
    memberAccess(use: Node) {
      if (!ast.is.IsPropertyAccessExpression(use)) return undefined;
      const shared = input.member(use);
      if (shared === undefined) return undefined;
      // The fields the member witness does not carry: the selected index signature, the receiver value and whether
      // the access is a call's callee.
      const info = semantics.forNode(use).operations.propertyAccess(use);
      if (info === undefined) throw new Error("A selected member access requires its checker access record.");
      const declarations = shared.declarations;
      const index = info.selectedIndex?.declaration;
      const selected = declarations.length > 0
        ? Object.freeze({ kind: "member" as const, declarations })
        : index !== undefined ? Object.freeze({ kind: "index-signature" as const, declaration: index }) : undefined;
      if (selected === undefined) throw new Error("A selected member access requires a member or index declaration.");
      const nameNode = ast.name(use);
      const receiverValue = info.receiver.valueDeclaration !== undefined || info.receiver.intrinsic !== undefined
        ? Object.freeze({
            ...(info.receiver.valueDeclaration === undefined ? {} : { declaration: info.receiver.valueDeclaration }),
            ...(info.receiver.intrinsic === undefined ? {} : { intrinsic: info.receiver.intrinsic }),
          })
        : undefined;
      return Object.freeze({
        use,
        receiver: shared.receiver,
        ...(receiverValue === undefined ? {} : { receiverValue }),
        name: nameNode === undefined ? "" : ast.text(nameNode),
        selected,
        access: shared.callCallee ? "call" as const : shared.accessMode === "delete" ? "write" as const : shared.accessMode,
        optionalChain: shared.optionalChain,
      });
    },
    objectLiteralElement(element: Node) {
      if (ast.is.IsSpreadAssignment(element)) {
        const objectLiteral = ast.parent(element);
        const value = ast.as.AsSpreadAssignment(element)?.Expression;
        if (objectLiteral === undefined || value === undefined) throw new Error("A spread assignment requires its literal and value.");
        return Object.freeze({ objectLiteral, element, elementKind: "spread" as const, destinations: Object.freeze([]), value });
      }
      const info = semantics.forNode(element).operations.objectLiteralElement(element);
      if (info === undefined) return undefined;
      const value = info.elementKind === "property" ? ast.as.AsPropertyAssignment(element)?.Initializer
        : info.elementKind === "shorthand" ? ast.name(element) : element;
      if (value === undefined) throw new Error("An object literal element requires its value node.");
      return Object.freeze({
        objectLiteral: info.objectLiteral, element, elementKind: info.elementKind,
        destinations: Object.freeze([...info.sourceSelectedDeclarations]), value,
      });
    },
    iteration(statement: Node) {
      const info = semantics.forNode(statement).operations.iteration(statement);
      if (info === undefined || info.iterationKind === "for-in") return undefined;
      const iterable = ast.as.AsForInOrOfStatement(statement)?.Expression ??
        (ast.is.IsSpreadElement(statement) ? ast.as.AsSpreadElement(statement)?.Expression : undefined);
      if (iterable === undefined) throw new Error("An iteration selection requires its iterable expression.");
      // A spread selection carries no checker mechanism (the checker records the iteration mechanism only for for-of,
      // for-await-of and yield*): its protocol is translated from the iterable type (spreadProtocol).
      const unresolved = info.iterationKind === "for-await-of" ? forAwaitUnresolved(info.mechanism, statement) : undefined;
      if (unresolved !== undefined) {
        return Object.freeze({ kind: "for-await-unresolved" as const, statement, iterable, ...unresolved });
      }
      const selected = info.subject.kind === "spread" ? spreadProtocol(statement, info.sourceIterableType)
        : iterationProtocol(info.mechanism, statement, info.iterationKind === "for-await-of");
      if (selected.kind === "refused") return selected;
      return Object.freeze({ kind: "iteration-witness" as const, statement, iterable, protocol: selected.protocol,
        ...(selected.iteratorMethod === undefined ? {} : { iteratorMethod: selected.iteratorMethod }) });
    },
    generator(callable: Node) {
      const info = semantics.forNode(callable).operations.generator(callable);
      return info === undefined ? undefined : Object.freeze({ async: info.generatorKind === "async" });
    },
    completion(callable: Node) {
      if (ast.body(callable) === undefined) return undefined;
      const info = semantics.forNode(callable).operations.callableCompletion(callable);
      if (info === undefined) throw new Error("A callable with a body requires its completion witness.");
      return Object.freeze({ canFallThrough: info.canFallThrough });
    },
    resource(declaration: Node) {
      const info = semantics.forNode(declaration).operations.resourceManagement(declaration);
      if (info === undefined) return undefined;
      if (info.disposal.kind !== "selected") {
        return refusal("TSONIC_SOURCE_RESOURCE_UNTYPED", declaration,
          "Untyped dynamic resource disposal selects no typed dispose member.");
      }
      const alternatives = info.disposal.alternatives.map(alternative => {
        if (alternative.selectedDeclaration === undefined) throw new Error("A selected disposal requires its member declaration.");
        return Object.freeze({ kind: alternative.kind, dispose: alternative.selectedDeclaration });
      });
      return Object.freeze({ kind: "resource-witness" as const, async: info.declarationKind === "await using",
        alternatives: Object.freeze(alternatives) });
    },
    storage(expression: Node) {
      const info = semantics.forNode(expression).operations.storage(expression);
      return info === undefined ? undefined : Object.freeze({
        storageExpression: info.storageExpression,
        ...(info.declaration === undefined ? {} : { declaration: info.declaration }),
        writable: info.writable,
      });
    },
    yield(expression: Node) {
      if (!ast.is.IsYieldExpression(expression)) return undefined;
      const info = semantics.forNode(expression).operations.yield(expression);
      if (info === undefined) return undefined;
      const delegation = info.delegation === undefined ? undefined
        : iterationProtocol(info.delegation.mechanism, expression, info.generator.generatorKind === "async");
      return Object.freeze({
        expression, generator: info.generator.declaration, kind: info.yieldKind,
        ...(info.operand === undefined ? {} : { operand: info.operand.expression }),
        ...(delegation === undefined ? {} : { delegation }),
      });
    },
    wellKnownSymbol(node: Node) {
      const info = semantics.forNode(node).operations.wellKnownSymbol(node);
      return info === undefined ? undefined : wellKnownSymbolNames[info.kind];
    },
  });
}
