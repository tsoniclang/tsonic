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
  readonly arguments: readonly { readonly argument: Node; readonly parameterIndex: number;
    readonly mode: "positional" | "rest-element" | "spread" }[];
  readonly parameterDeclarations: readonly Node[];
  readonly optionalChain: boolean;
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

export interface HostCheckerInput {
  mergedDeclarations(declaration: Node): readonly Node[];
  call(use: Node): HostCallWitness | HostWitnessRefusal | undefined;
  memberAccess(use: Node): HostMemberAccessWitness | undefined;
  objectLiteralElement(element: Node): HostObjectLiteralElementWitness | undefined;
  iteration(statement: Node): HostIterationWitness | undefined;
  generator(callable: Node): { readonly async: boolean } | undefined;
  resource(declaration: Node): { readonly async: boolean; readonly dispose: Node } | undefined;
  storage(expression: Node): { readonly storageExpression: Node; readonly declaration?: Node } | undefined;
  wellKnownSymbol(node: Node): string | undefined;
}

const wellKnownSymbolNames: Readonly<Record<string, string>> = Object.freeze({
  "async-dispose": "Symbol.asyncDispose", "async-iterator": "Symbol.asyncIterator", dispose: "Symbol.dispose",
  "has-instance": "Symbol.hasInstance", "is-concat-spreadable": "Symbol.isConcatSpreadable", iterator: "Symbol.iterator",
  match: "Symbol.match", "match-all": "Symbol.matchAll", replace: "Symbol.replace", search: "Symbol.search",
  species: "Symbol.species", split: "Symbol.split", "to-primitive": "Symbol.toPrimitive",
  "to-string-tag": "Symbol.toStringTag", unscopables: "Symbol.unscopables",
});

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
      const overloads = mergedDeclarations(signature).filter(entry => isSourceCallableSignatureDeclaration(ast, entry));
      const seen = new Set<Node>();
      const arguments_ = info.sourceArgumentBindings.flatMap(binding => {
        const argument = info.sourceArguments[binding.sourceArgumentIndex]?.expression;
        if (argument === undefined) throw new Error("A call argument binding requires its source argument.");
        if (seen.has(argument)) return [];
        seen.add(argument);
        const mode = binding.sourceForm !== "value" ? "spread" as const
          : binding.sourceParameterForm === "parameter" ? "positional" as const : "rest-element" as const;
        return [Object.freeze({ argument, parameterIndex: binding.sourceParameterIndex, mode })];
      });
      const parameterDeclarations = info.sourceSelectedSignatureParameters.map(parameter => {
        if (parameter.parameterDeclaration === undefined) {
          throw new Error("A declared signature parameter requires its declaration.");
        }
        return parameter.parameterDeclaration;
      });
      return Object.freeze({
        kind: "call-witness" as const,
        use, callKind, callee,
        ...(declaration === undefined ? {} : { declaration }),
        signature,
        overloadIndex: Math.max(0, overloads.indexOf(signature)),
        ...(info.sourceReceiver === undefined ? {} : { receiver: info.sourceReceiver.expression }),
        arguments: Object.freeze(arguments_),
        parameterDeclarations: Object.freeze(parameterDeclarations),
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
      const mechanism = info.mechanism as { readonly kind: string; readonly protocol?: {
        readonly resolutionKind: string; readonly iteratorMethodValueDeclaration?: Node } };
      const protocol = mechanism.kind === "array-like-index" || mechanism.kind === "array-like-index-adapted-to-async" ? "array" as const
        : mechanism.kind === "string-code-unit-index" || mechanism.kind === "string-code-unit-index-adapted-to-async" ? "string" as const
        : mechanism.kind === "synchronous-iterator-protocol" || mechanism.kind === "synchronous-iterator-adapted-to-async"
          ? "iterator" as const
        : mechanism.kind === "asynchronous-iterator-protocol" ? "async-iterator" as const : undefined;
      if (protocol === undefined) {
        return mechanism.kind === "untyped-dynamic-iteration"
          ? refusal("TSONIC_SOURCE_ITERATION_UNTYPED", statement, "The iterated value has no typed iteration protocol.")
          : refusal("TSONIC_SOURCE_ITERATION_MIXED", statement,
            "The iterated value selects different iteration protocols per union arm.");
      }
      const iteratorMethod = mechanism.protocol?.resolutionKind === "selected-iterator-member"
        ? mechanism.protocol.iteratorMethodValueDeclaration : undefined;
      return Object.freeze({ kind: "iteration-witness" as const, statement, iterable, protocol,
        ...(iteratorMethod === undefined ? {} : { iteratorMethod }) });
    },
    generator(callable: Node) {
      const info = semantics.forNode(callable).operations.generator(callable);
      return info === undefined ? undefined : Object.freeze({ async: info.generatorKind === "async" });
    },
    resource(declaration: Node) {
      const info = semantics.forNode(declaration).operations.resourceManagement(declaration);
      if (info === undefined || info.disposal.kind !== "selected") return undefined;
      const disposals = [...new Set(info.disposal.alternatives.map(entry => entry.selectedDeclaration)
        .filter((entry): entry is Node => entry !== undefined))];
      return disposals.length !== 1 ? undefined
        : Object.freeze({ async: info.declarationKind === "await using", dispose: disposals[0]! });
    },
    storage(expression: Node) {
      const info = semantics.forNode(expression).operations.storage(expression);
      return info === undefined ? undefined : Object.freeze({
        storageExpression: info.storageExpression,
        ...(info.declaration === undefined ? {} : { declaration: info.declaration }),
      });
    },
    wellKnownSymbol(node: Node) {
      const info = semantics.forNode(node).operations.wellKnownSymbol(node);
      return info === undefined ? undefined : wellKnownSymbolNames[info.kind];
    },
  });
}
