// host-input/objects: the checker selection witnesses behind the role model, object facts and selections (I3).
// Node-only records; no checker Type, Signature or Symbol leaves this file. The overlapping call and member
// selections reuse the host-input translators (`SourceHostInput.call` / `.member`, index.ts); this module adds only
// the fields those witnesses do not carry (callee, called declaration, argument bindings, parameter declarations,
// access mode, index signature, receiver value) and the other operation witnesses.
import type { AstReader, Node } from "@tsonic/tsts";
import { isSourceCallableSignatureDeclaration } from "../source-navigation/callable-boundaries.js";
import type { SourceProgramNavigation } from "../source-navigation/types.js";
import type { SourceProgramSemantics } from "./semantics-types.js";
import type { SourceHostInput } from "./index.js";

export interface HostCheckerServices {
  readonly ast: AstReader;
  readonly navigation: SourceProgramNavigation;
  readonly semantics: SourceProgramSemantics;
  /** The program's host-input adapter; its call and member translators are reused, never re-implemented. */
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
function iterationProtocol(mechanismInput: unknown, site: Node, awaited: boolean): HostIterationProtocol | HostWitnessRefusal {
  const mechanism = mechanismInput as { readonly kind: string; readonly protocol?: {
    readonly resolutionKind: string; readonly iteratorMethodValueDeclaration?: Node } };
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

  // The entity of a declaration: the navigation input witness (one translator, host-input/navigation.ts).
  const mergedDeclarations = navigation.mergedDeclarations;

  return Object.freeze({
    mergedDeclarations,
    call(use: Node) {
      const shared = input.call(use);
      if (shared === undefined) return undefined;
      const info = semantics.forNode(use).operations.call(use);
      if (info === undefined) throw new Error("A selected call requires its argument bindings.");
      if (info.sourceSelectedSignatureKind !== "resolved") {
        return refusal("TSONIC_SOURCE_CALL_UNTYPED", use, "The call has no selected typed signature (untyped callee).");
      }
      const signature = shared.signature;
      if (signature === undefined) {
        return refusal("TSONIC_SOURCE_CALL_SIGNATURE_UNDECLARED", use,
          "The selected signature of this call has no declaration (a synthesized signature).");
      }
      const callee = info.sourceCallee.expression;
      const kind = ast.kindName(use);
      const callKind = kind === "KindNewExpression" ? "construction" : kind === "KindTaggedTemplateExpression"
        ? "tagged-template" : ast.kindName(callee) === "KindSuperKeyword" ? "super-call" : "call";
      const access = info.sourceCalleeAccess;
      const declaration = access?.kind === "property" ? access.selectedDeclaration ?? access.declaration
        : navigation.sourceReferenceFor(callee)?.declaration;
      // Overload position: the authored position among the signature's merged callable-signature declarations
      // (overloads first, then the implementation). A signature that merges with nothing (a call signature member,
      // an arrow) is its own single overload.
      const overloads = mergedDeclarations(signature).filter(entry => isSourceCallableSignatureDeclaration(ast, entry));
      const overloadIndex = overloads.indexOf(signature);
      if (overloads.length > 0 && overloadIndex < 0) throw new Error("A selected signature must be one of its merged declarations.");
      const bindings = [...info.sourceArgumentBindings].sort((left, right) => left.effectiveArgumentIndex - right.effectiveArgumentIndex);
      const arguments_ = bindings.map((binding, effectiveIndex) => {
        const argument = info.sourceArguments[binding.sourceArgumentIndex]?.expression;
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
      const parameters = info.sourceSelectedSignatureParameters.map((parameter, index) => {
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
        ...(info.sourceReceiver === undefined ? {} : { receiver: info.sourceReceiver.expression }),
        arguments: Object.freeze(arguments_),
        parameters: Object.freeze(parameters),
        optionalChain: shared.optionalChain,
      });
    },
    memberAccess(use: Node) {
      if (!ast.is.IsPropertyAccessExpression(use)) return undefined;
      const shared = input.member(use);
      if (shared === undefined) return undefined;
      const info = semantics.forNode(use).operations.propertyAccess(use);
      if (info === undefined) throw new Error("A selected member access requires its access mode.");
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
        access: info.callCallee ? "call" as const : info.accessMode === "delete" ? "write" as const : info.accessMode,
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
      const selected = iterationProtocol(info.mechanism, statement, info.iterationKind === "for-await-of");
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
          "Untyped dynamic resource disposal has no closed C# target operation.");
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
