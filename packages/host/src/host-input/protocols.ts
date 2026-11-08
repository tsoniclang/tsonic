import { argumentPassingFactKey } from "@tsonic/tsts";
import type { CheckedSourceProgram, Node, ResolvedSourceIterationInfo, Signature } from "@tsonic/tsts";
import type { SourceInputAtomicIteration, SourceInputComponent, SourceInputGenerator, SourceInputIteration,
  SourceInputIterationMechanism, SourceInputIteratorWitness, SourceInputProtocolQueries, SourceInputSignature,
  SourceInputDisposalAlternative, SourceInputResourceManagement,
  SourceInputYield } from "@tsonic/target-api/host";
import type { SourcePresence } from "@tsonic/target-api/source";
import type { SourceInputIdentityOwner } from "./identity-owner.js";
import { createSourceInputMemberPublisher, sourceCheckedMember } from "./member-components.js";

type CheckedMechanism = Extract<ResolvedSourceIterationInfo, { readonly iterationKind: "for-of" | "for-await-of" }>["mechanism"];
type CheckedAtomic = Exclude<CheckedMechanism, { readonly kind: "union" }>;
type CheckedProtocol = Extract<CheckedAtomic, { readonly protocol: object }>["protocol"];

export function createSourceProtocolInput(input: {
  readonly checked: CheckedSourceProgram;
  readonly identities: SourceInputIdentityOwner;
  readonly assertNode: (node: Node) => void;
  readonly syntax: (node: Node) => SourceInputComponent;
  readonly originalSignature: (owner: Node, kind: "call" | "construct", original: Signature) => SourceInputSignature;
}): SourceInputProtocolQueries {
  const { checked, identities, assertNode, syntax, originalSignature } = input;
  const { ast } = checked;
  const none = Object.freeze({ kind: "none" } as const);
  const present = <Value>(value: Value): SourcePresence<Value> => Object.freeze({ kind: "present", value });
  const queriesFor = (node: Node) => {
    assertNode(node);
    const file = ast.getSourceFile(node);
    if (file === undefined) throw new Error("A Source protocol requires its exact original source file.");
    return checked.getSourceFileQueries(file);
  };
  const protocol = (receiver: SourceInputComponent, selected: CheckedProtocol,
    asynchronous: boolean): SourceInputIteratorWitness | undefined => {
    identities.assertComponent(receiver);
    const { checker, typeShape: types } = queriesFor(receiver.root);
    const candidates = types.getPropertyInfos(selected.sourceIterableType).filter(property => {
      if (selected.resolutionKind === "selected-iterator-member")
        return property.symbol === selected.iteratorMethodSymbol || property.rootSymbols.includes(selected.iteratorMethodSymbol);
      return [property.symbol, ...property.rootSymbols].some(symbol => checker.getSymbolDeclarations(symbol).some(declaration => {
        const name = declaration === undefined ? undefined : ast.name(declaration);
        return name !== undefined && checker.getResolvedWellKnownSymbolInfo(name)?.kind === (asynchronous ? "async-iterator" : "iterator");
      }));
    });
    if (candidates.length !== 1) return undefined;
    const selectedMember = sourceCheckedMember(ast, checker, candidates[0]!, selected.sourceIterableType);
    const member = createSourceInputMemberPublisher({ ast, checker, types, identities, assertNode })(receiver, selectedMember);
    if (member?.read === undefined) return undefined;
    const signatures = types.getCallSignatures(candidates[0]!.type);
    if (signatures.length === 0 || signatures.some(signature => signature === undefined)) return undefined;
    const calls = signatures.map(signature => originalSignature(checker.getSignatureDeclaration(signature) ?? receiver.root, "call", signature!));
    const originalDeclarations = selected.resolutionKind === "known-iterable-instantiation"
      ? selected.iterableDeclarations : selected.iteratorMethodDeclarations;
    const declarations = Object.freeze(originalDeclarations.filter((declaration): declaration is Node => declaration !== undefined));
    for (const declaration of declarations) assertNode(declaration);
    return Object.freeze({ declarations, iterator: member, calls: Object.freeze(calls) });
  };
  const atomic = (root: SourceInputComponent, selected: CheckedAtomic, index: number | undefined): SourceInputAtomicIteration | undefined => {
    const source = identities.component(root.root, index === undefined ? root.path : [...root.path, { kind: "union-member", index }], selected.sourceIterableType);
    if (selected.kind === "synchronous-iterator-protocol" || selected.kind === "asynchronous-iterator-protocol" ||
      selected.kind === "synchronous-iterator-adapted-to-async") {
      const witness = protocol(source, selected.protocol, selected.kind === "asynchronous-iterator-protocol");
      return witness === undefined ? undefined : Object.freeze({ kind: selected.kind, source, protocol: witness });
    }
    if (selected.kind === "array-like-index" || selected.kind === "array-like-index-adapted-to-async") {
      const { typeShape } = queriesFor(root.root);
      const declarations = Object.freeze([...new Set(typeShape.getIndexInfos(selected.sourceIterableType).flatMap(value =>
        value.declaration === undefined ? value.components.filter((declaration): declaration is Node => declaration !== undefined) : [value.declaration]))]);
      for (const declaration of declarations) assertNode(declaration);
      return Object.freeze({ kind: selected.kind, source, declarations });
    }
    return Object.freeze({ kind: selected.kind, source });
  };
  const mechanism = (operand: Node, selected: CheckedMechanism): SourceInputIterationMechanism | undefined => {
    const root = syntax(operand);
    if (selected.kind !== "union") return atomic(root, selected, undefined);
    const alternatives: SourceInputAtomicIteration[] = [];
    for (const [index, alternative] of selected.alternatives.entries()) {
      const current = atomic(root, alternative, index);
      if (current === undefined) return undefined;
      alternatives.push(current);
    }
    return Object.freeze({ kind: "union", alternatives: Object.freeze(alternatives) });
  };
  const iterations = new WeakMap<Node, SourcePresence<SourceInputIteration>>();
  const generators = new WeakMap<Node, SourcePresence<SourceInputGenerator>>();
  const yields = new WeakMap<Node, SourcePresence<SourceInputYield>>();
  return Object.freeze({
    iteration(occurrence) {
      assertNode(occurrence);
      const existing = iterations.get(occurrence);
      if (existing !== undefined) return existing;
      const original = queriesFor(occurrence).checker.getResolvedIterationInfo(occurrence);
      if (original === undefined) { iterations.set(occurrence, none); return none; }
      const operand = original.subject.kind === "spread" ? ast.as.AsSpreadElement(occurrence)?.Expression
        : ast.is.IsForInStatement(occurrence) ? ast.as.AsForInStatement(occurrence)?.Expression : ast.as.AsForOfStatement(occurrence)?.Expression;
      if (operand === undefined) throw new Error("A selected Source iteration requires its original operand.");
      assertNode(operand);
      const selected = original.iterationKind === undefined ? undefined : original.iterationKind === "for-in"
        ? Object.freeze({ kind: "property-key-enumeration" } as const) : mechanism(operand, original.mechanism);
      const result = present(Object.freeze({ occurrence, operand,
        kind: original.iterationKind ?? "spread",
        mechanism: selected === undefined ? none : present(selected) }));
      iterations.set(occurrence, result);
      return result;
    },
    generator(declaration) {
      assertNode(declaration);
      const existing = generators.get(declaration);
      if (existing !== undefined) return existing;
      const { checker } = queriesFor(declaration);
      const original = checker.getResolvedGeneratorInfo(declaration);
      const signature = original === undefined ? undefined : checker.getSignatureFromDeclaration(declaration);
      const result = original === undefined || signature === undefined ? none : present(Object.freeze({ declaration,
        kind: original.generatorKind, signature: originalSignature(declaration, "call", signature),
        returnTypeBinding: original.returnTypeBinding === undefined ? none : present(original.returnTypeBinding.declaration) }));
      generators.set(declaration, result);
      return result;
    },
    yield(occurrence) {
      assertNode(occurrence);
      const existing = yields.get(occurrence);
      if (existing !== undefined) return existing;
      const original = queriesFor(occurrence).checker.getResolvedYieldInfo(occurrence);
      const selected = original?.operand === undefined || original.delegation === undefined ? undefined
        : mechanism(original.operand.expression, original.delegation.mechanism);
      const result = original === undefined ? none : present(Object.freeze({ occurrence, generator: original.generator.declaration,
        kind: original.yieldKind, operand: original.operand === undefined ? none : present(original.operand.expression),
        mechanism: selected === undefined ? none : present(selected) }));
      yields.set(occurrence, result);
      return result;
    },
    resourceManagement(declaration) {
      const { checker } = queriesFor(declaration);
      const kind = ast.variableDeclarationKind(declaration);
      if (!ast.is.IsVariableDeclaration(declaration) || kind !== "using" && kind !== "await using") return none;
      const original = checker.getResolvedResourceManagementInfo(declaration);
      const initializer = ast.as.AsVariableDeclaration(declaration)?.Initializer;
      let acquisition: SourceInputResourceManagement["acquisition"];
      if (initializer !== undefined) {
        assertNode(initializer);
        acquisition = Object.freeze({ kind: "initializer", expression: initializer });
      } else {
        const list = ast.parent(declaration);
        const statement = list === undefined ? undefined : ast.parent(list);
        if (statement === undefined || !ast.is.IsForOfStatement(statement))
          throw new Error("A resource declaration requires its original initializer or iteration acquisition.");
        assertNode(statement);
        acquisition = Object.freeze({ kind: "iteration", statement });
      }
      let disposal: SourceInputResourceManagement["disposal"] = Object.freeze({ kind: "unavailable" });
      if (original?.disposal.kind === "untyped-dynamic") disposal = Object.freeze({ kind: "untyped-dynamic" });
      else if (original?.disposal.kind === "selected") {
        const alternatives: SourceInputDisposalAlternative[] = [];
        for (const alternative of original.disposal.alternatives) {
          const symbols = [alternative.selectedSymbol, ...checker.getRootSymbols(alternative.selectedSymbol)];
          const declarations = Object.freeze([...new Set(symbols.flatMap(symbol => checker.getSymbolDeclarations(symbol))
            .filter((node): node is Node => node !== undefined))]);
          for (const node of declarations) assertNode(node);
          const signatures = queriesFor(declaration).typeShape.getCallSignatures(alternative.selectedType);
          if (signatures.length === 0 || signatures.some(signature => signature === undefined))
            throw new Error("A selected original disposer requires its complete original signature inventory.");
          alternatives.push(Object.freeze({ kind: alternative.kind, declarations,
            signatures: Object.freeze(signatures.map(signature => originalSignature(
              checker.getSignatureDeclaration(signature) ?? declaration, "call", signature!))) }));
        }
        disposal = Object.freeze({ kind: "selected", alternatives: Object.freeze(alternatives) });
      }
      return present(Object.freeze({ declaration, kind, acquisition, disposal }));
    },
    callableCompletion(declaration) {
      const selected = queriesFor(declaration).checker.getResolvedCallableCompletionInfo(declaration);
      if (selected === undefined) return none;
      if (selected.declaration !== declaration) throw new Error("Callable completion requires the exact original declaration.");
      return present(Object.freeze({ declaration, canFallThrough: selected.canFallThrough }));
    },
    argumentPassing(occurrence) {
      assertNode(occurrence);
      const selected = checked.sourceFacts.getFact(occurrence, argumentPassingFactKey);
      if (selected === undefined) return none;
      if (selected.role === "declaration") return present(Object.freeze({ role: selected.role, mode: selected.mode }));
      assertNode(selected.storageExpression);
      return present(Object.freeze({ role: selected.role, mode: selected.mode, storageExpression: selected.storageExpression }));
    },
    flowConditions(reference) {
      const selected = queriesFor(reference).checker.getResolvedFlowConditionInfo(reference);
      if (selected !== undefined) {
        if (selected.reference !== reference) throw new Error("Source flow conditions must retain their exact original reference.");
        for (const condition of selected.conditions) {
          assertNode(condition.expression);
          for (const assignment of condition.assignments) assertNode(assignment);
        }
      }
      return selected === undefined ? none : present(selected);
    },
  });
}
