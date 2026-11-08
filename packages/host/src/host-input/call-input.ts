import type { CheckedSourceProgram, Diagnostic, Node, ResolvedCallApplicationEvidence, ResolvedCallInferencePathPart, ResolvedCheckedCallCandidateEvidence, ResolvedCheckedComponentEvidence, ResolvedCheckerBackingConstraint, ResolvedCheckerDiagnosticCoverage, Type } from "@tsonic/tsts";
import type { SourceInputApplication, SourceInputBackingConstraint, SourceInputCallCandidate, SourceInputCallSelection, SourceInputCandidateIdentity, SourceInputComponent, SourceInputComponentPart, SourceInputDiagnosticCoverage, SourceInputDiagnosticIdentity, SourceInputInferenceContributions, SourceInputTypeArgument } from "@tsonic/target-api/host";
import type { SourceInputIdentityOwner } from "./identity-owner.js";
import type { createSourceDescriptorFacts } from "./descriptor-facts.js";

export function createSourceCallInput(options: {
  readonly checked: CheckedSourceProgram;
  readonly identities: SourceInputIdentityOwner;
  readonly facts: ReturnType<typeof createSourceDescriptorFacts>;
  assertNode(node: Node): void;
}) {
  const { checked, identities, facts, assertNode } = options;
  const { ast } = checked;
  const selections = new WeakMap<Node, SourceInputCallSelection>();
  const applications = new WeakMap<ResolvedCallApplicationEvidence, SourceInputApplication>();
  const candidates = new WeakMap<ResolvedCheckedCallCandidateEvidence, SourceInputCallCandidate>();
  const candidateRecords = new WeakMap<SourceInputCandidateIdentity, ResolvedCheckedCallCandidateEvidence>();
  const diagnostics = new WeakMap<Diagnostic, SourceInputDiagnosticIdentity>();
  const diagnosticRecords = new WeakMap<SourceInputDiagnosticIdentity, Diagnostic>();
  const constraintRecords = new WeakMap<SourceInputBackingConstraint, ResolvedCheckerBackingConstraint>();
  const constraints = new WeakMap<ResolvedCheckerBackingConstraint, SourceInputBackingConstraint>();

  function diagnostic(value: Diagnostic, site: Node | undefined): SourceInputDiagnosticIdentity {
    if (site !== undefined) assertNode(site);
    const previous = diagnostics.get(value);
    if (previous !== undefined) return previous;
    const result = Object.freeze({ kind: "diagnostic" as const, site });
    diagnostics.set(value, result);
    diagnosticRecords.set(result, value);
    return result;
  }

  function parameterDeclaration(type: Type, owner: Node): Node | undefined {
    const { checker } = facts.queries(owner);
    const symbol = checker.getTypeSymbol(type);
    const selected = checker.getSymbolDeclarations(symbol).filter((value): value is Node => value !== undefined && ast.is.IsTypeParameterDeclaration(value));
    return selected.length === 1 && checker.getDeclaredTypeOfSymbol(symbol) === type ? selected[0] : undefined;
  }

  function coverage(value: ResolvedCheckerDiagnosticCoverage): SourceInputDiagnosticCoverage {
    const root = diagnostic(value.root, undefined);
    return value.kind === "unavailable" ? Object.freeze({ kind: "unavailable", root })
      : Object.freeze({ kind: "complete", root, obligations: Object.freeze(value.obligations.map(obligation => Object.freeze({
        kind: obligation.kind, diagnostic: diagnostic(obligation.diagnostic, undefined), application: obligation.application === undefined ? undefined : application(obligation.application),
      }))), purpose: value.purpose.kind === "other" ? Object.freeze({ kind: "other" })
        : Object.freeze({ kind: "alternative-applicability", invocation: value.purpose.invocation,
          notes: Object.freeze(value.purpose.notes.map(note => diagnostic(note, undefined))) }) });
  }

  function argument(value: ResolvedCallApplicationEvidence["signatureTypeArguments"][number], owner: Node): SourceInputTypeArgument {
    if (value.declaration !== undefined) assertNode(value.declaration);
    const root = value.explicitTypeNode ?? value.defaultTypeNode ?? value.declaration ?? owner;
    return Object.freeze({ declaration: value.declaration,
      parameter: identities.component(value.declaration ?? owner, [], value.typeParameter),
      argument: value.checkedArgument === undefined ? undefined : identities.component(root, [], value.checkedArgument),
      explicitTypeNode: value.explicitTypeNode, defaultTypeNode: value.defaultTypeNode });
  }

  function application(value: ResolvedCallApplicationEvidence): SourceInputApplication {
    assertNode(value.invocation);
    const previous = applications.get(value);
    if (previous !== undefined) return previous;
    const signature = facts.originalSignature(value.invocation, value.kind, value.signature);
    const result: SourceInputApplication = Object.freeze({ invocation: value.invocation, kind: value.kind, signature,
      callee: Object.freeze({ occurrence: value.callee.expression, component: identities.component(value.callee.expression, [], value.callee.type), role: "value" }),
      receiver: value.receiver === undefined ? undefined : Object.freeze({ occurrence: value.receiver.expression,
        component: identities.component(value.receiver.expression, [], value.receiver.type), role: "value" }),
      class: value.class === undefined ? undefined : Object.freeze({ declaration: value.class.declaration,
        arguments: Object.freeze(value.class.typeArguments.map(binding => argument(binding, value.invocation))) }),
      signatureArguments: Object.freeze(value.signatureTypeArguments.map(binding => argument(binding, value.invocation))) });
    applications.set(value, result);
    return result;
  }

  function path(root: Node, values: readonly ResolvedCallInferencePathPart[]): readonly SourceInputComponentPart[] | undefined {
    const selected: SourceInputComponentPart[] = [];
    for (const value of values) {
      switch (value.kind) {
        case "element": selected.push({ kind: "element" }); break;
        case "tuple": selected.push({ kind: "tuple-element", index: value.index }); break;
        case "tuple-slice": selected.push({ kind: "tuple-slice", start: value.start, endCount: value.endCount, readonly: value.readonly }); break;
        case "union-member": selected.push({ kind: "union-member", index: value.index }); break;
        case "member": selected.push({ kind: "member", declaration: value.declaration, access: "read" }); break;
        case "index": selected.push({ kind: "index-value", declaration: value.declaration }); break;
        case "type-argument": {
          const { checker } = facts.queries(root);
          const declaration = checker.getPrimarySymbolDeclaration(checker.getTypeSymbol(value.owner));
          if (declaration === undefined) return undefined;
          selected.push({ kind: "type-argument", declaration, index: value.index });
          break;
        }
        case "callable-result": case "callable-parameter": case "callable-receiver": case "signature-tail": {
          const signature = facts.originalSignature(root, value.signatureKind, value.signature);
          selected.push(value.kind === "callable-result" ? { kind: "result", signature }
            : value.kind === "callable-parameter" ? { kind: "parameter", signature, index: value.index }
            : value.kind === "callable-receiver" ? { kind: "receiver", signature }
            : { kind: "signature-tail", signature, start: value.start, readonly: value.readonly });
          break;
        }
      }
    }
    return Object.freeze(selected);
  }

  function checkedComponent(value: ResolvedCheckedComponentEvidence): SourceInputComponent {
    const suffix = path(value.root.node, value.path);
    if (suffix === undefined) throw new Error("A recorded backing constraint requires a complete original component path.");
    const root = value.root;
    const prefix: readonly SourceInputComponentPart[] = root.kind === "call-argument" ? [{ kind: "argument-place", index: root.index }]
      : root.kind === "call-parameter" ? [{ kind: "parameter-place", index: root.index }]
      : root.kind === "arguments" ? [{ kind: "argument-tail", start: root.start }]
      : root.kind === "parameters" ? [{ kind: "parameter-tail", start: root.start }] : [];
    return identities.component(root.node, [...prefix, ...suffix], value.type);
  }

  function constraint(value: ResolvedCheckerBackingConstraint): SourceInputBackingConstraint {
    assertNode(value.site);
    const previous = constraints.get(value);
    if (previous !== undefined) return previous;
    const common = { site: value.site, diagnostic: diagnostic(value.diagnostic.diagnostic, value.site), rootDiagnostic: diagnostic(value.diagnostic.root, value.site),
      rootCoverage: coverage(value.diagnostic.rootCoverage), application: value.application === undefined ? undefined : application(value.application) };
    const result: SourceInputBackingConstraint = Object.freeze(value.kind === "operator"
      ? { ...common, kind: "operator", operation: value.operation, left: checkedComponent(value.left), right: checkedComponent(value.right) }
      : value.kind === "index" ? { ...common, kind: "index", access: value.access, receiver: checkedComponent(value.receiver), index: checkedComponent(value.index) }
      : { ...common, kind: "write-fit", source: checkedComponent(value.source), destination: checkedComponent(value.destination) });
    constraintRecords.set(result, value);
    constraints.set(value, result);
    return result;
  }

  function contributions(value: ResolvedCheckedCallCandidateEvidence): SourceInputInferenceContributions {
    const journal = value.inferenceContributions;
    if (journal.kind === "unavailable") return Object.freeze({ kind: "unavailable" });
    const result: Extract<SourceInputInferenceContributions, { readonly kind: "available" }>["values"][number][] = [];
    for (const entry of journal.contributions) {
      const { origin } = entry;
      const sourcePath = path(value.application.invocation, entry.sourcePath), formalPath = path(value.application.invocation, entry.formalPath);
      if (sourcePath === undefined || formalPath === undefined) return Object.freeze({ kind: "unavailable" });
      const sourceBase: readonly SourceInputComponentPart[] = origin.kind === "argument" ? [{ kind: "argument-place", index: origin.effectiveArgumentIndex }]
        : origin.kind === "argument-tail" ? [{ kind: "argument-tail", start: origin.effectiveArgumentIndex }] : [];
      const formalBase: readonly SourceInputComponentPart[] = origin.kind === "argument" ? [{ kind: "parameter-place", index: origin.effectiveArgumentIndex }]
        : origin.kind === "argument-tail" ? [{ kind: "parameter-tail", start: origin.effectiveArgumentIndex }]
        : origin.kind === "receiver" ? [{ kind: "receiver", signature: application(value.application).signature }] : [];
      const root = origin.kind === "argument" || origin.kind === "argument-tail" ? value.application.invocation : origin.subject;
      result.push(Object.freeze({ declaration: parameterDeclaration(entry.typeParameter, value.application.invocation), origin: Object.freeze({ ...origin }),
        source: identities.component(root, [...sourceBase, ...sourcePath], entry.sourcePath.length === 0 ? entry.sourceRootType : undefined),
        formal: identities.component(root, [...formalBase, ...formalPath], entry.formalPath.length === 0 ? entry.formalRootType : undefined) }));
    }
    return Object.freeze({ kind: "available", values: Object.freeze(result) });
  }

  function candidate(value: ResolvedCheckedCallCandidateEvidence): SourceInputCallCandidate {
    const selectedApplication = application(value.application);
    const previous = candidates.get(value);
    if (previous !== undefined) return previous;
    const identity = Object.freeze({ kind: "candidate" as const, invocation: value.application.invocation });
    const result: SourceInputCallCandidate = Object.freeze({ identity, application: selectedApplication,
      sourceArguments: Object.freeze(value.sourceArguments.map(occurrence => {
        assertNode(occurrence);
        const spread = ast.is.IsSpreadElement(occurrence);
        const expression = spread ? ast.as.AsSpreadElement(occurrence)?.Expression : occurrence;
        if (expression === undefined) throw new Error("An original spread argument requires its original operand.");
        return Object.freeze({ occurrence, expression, form: spread ? "spread" as const : "value" as const, component: undefined });
      })),
      arguments: value.arguments.kind === "unavailable" ? Object.freeze({ kind: "unavailable" })
        : Object.freeze({ kind: "available", values: Object.freeze(value.arguments.values.map(binding => Object.freeze({
          sourceArgument: binding.sourceArgument, sourceArgumentIndex: binding.sourceArgumentIndex,
          effectiveArgument: binding.effectiveArgument, effectiveArgumentIndex: binding.effectiveArgumentIndex,
          sourceForm: binding.sourceForm, spreadElementIndex: binding.spreadElementIndex,
          parameterIndex: binding.parameterIndex, parameterForm: binding.parameterForm,
          source: identities.component(value.application.invocation, [{ kind: "argument-place", index: binding.effectiveArgumentIndex }], binding.selectedArgumentType),
          destination: identities.component(value.application.invocation, [{ kind: "parameter-place", index: binding.effectiveArgumentIndex }], binding.selectedParameterType),
        }))) }), inferenceContributions: contributions(value), constraints: Object.freeze(value.constraints.map(constraint)),
      diagnostics: Object.freeze(value.diagnostics.map(entry => diagnostic(entry, value.application.invocation))), diagnosticCoverage: Object.freeze(value.diagnosticCoverage.map(coverage)) });
    candidateRecords.set(identity, value);
    candidates.set(value, result);
    return result;
  }

  return Object.freeze({
    application(invocation: Node): SourceInputCallSelection {
      assertNode(invocation);
      const previous = selections.get(invocation);
      if (previous !== undefined) return previous;
      const observed = facts.queries(invocation).checker.getResolvedCallInfo(invocation);
      if (observed === undefined) throw new Error("An enrolled invocation requires its checked call observation.");
      const declarationOrder = observed.declarationOrder.kind === "unavailable" ? Object.freeze({ kind: "unavailable" as const })
        : Object.freeze({ kind: "available" as const, signatures: Object.freeze(observed.declarationOrder.signatures.map(signature =>
          facts.originalSignature(invocation, ast.is.IsNewExpression(invocation) ? "construct" : "call", signature))) });
      const result: SourceInputCallSelection = observed.kind === "untyped" ? Object.freeze({ kind: "untyped", declarationOrder, diagnostics: Object.freeze(observed.diagnostics.map(value => diagnostic(value, invocation))) })
        : observed.kind === "conditional-candidates" ? Object.freeze({ kind: "conditional-candidates", declarationOrder, candidates: Object.freeze(observed.candidates.map(candidate)), diagnostics: Object.freeze(observed.diagnostics.map(value => diagnostic(value, invocation))) })
        : Object.freeze({ kind: "applicable", declarationOrder, selection: Object.freeze({ ...candidate(observed.selection),
          result: identities.component(invocation, [{ kind: "result", signature: application(observed.selection.application).signature }], observed.resultType),
          parameters: Object.freeze(observed.selection.parameters.map(parameter => Object.freeze({ index: parameter.parameterIndex,
            declaration: parameter.parameterDeclaration, kind: parameter.rest ? "rest" as const : parameter.acceptsOmission ? "optional" as const : "required" as const,
            component: identities.component(observed.selection.application.callee.expression, [{ kind: "parameter", signature: application(observed.selection.application).signature, index: parameter.parameterIndex }], parameter.selectedType) }))) }) });
      selections.set(invocation, result);
      return result;
    },
    constraints(occurrence: Node): readonly SourceInputBackingConstraint[] {
      assertNode(occurrence);
      return Object.freeze(checked.getBackingConstraints().filter(value => value.site === occurrence).map(constraint));
    },
    originalDiagnostic(identity: SourceInputDiagnosticIdentity): Diagnostic {
      const selected = diagnosticRecords.get(identity);
      if (selected === undefined) throw new Error("A checked diagnostic identity belongs to one exact Host input view.");
      return selected;
    },
    originalCandidate(identity: SourceInputCandidateIdentity): ResolvedCheckedCallCandidateEvidence {
      const selected = candidateRecords.get(identity);
      if (selected === undefined) throw new Error("A checked candidate identity belongs to one exact Host input view.");
      return selected;
    },
    originalConstraint(value: SourceInputBackingConstraint): ResolvedCheckerBackingConstraint {
      const selected = constraintRecords.get(value);
      if (selected === undefined) throw new Error("A checked constraint belongs to one exact Host input view.");
      return selected;
    },
  });
}
