import type { Node } from "@tsonic/tsts";
import type {
  SourceApplication, SourceApplicationFacts, SourceConstruction, SourceDeclaredSlot, SourceOperation,
  SourcePresence, SourceRefusal, SourceResult, SourceSignatureIdentity, SourceTypeEvidence,
  SourceUseDestination, SourceValueFacts,
} from "../../public/source/contracts.js";
import type { SourceDescriptorBuilder } from "../descriptor-contracts.js";

export interface SourceSolvedPublication {
  readonly originals: readonly Node[];
  readonly occurrences: readonly Node[];
  readonly types: ReadonlyMap<Node, SourceResult<SourceTypeEvidence>>;
  readonly contextual: ReadonlyMap<Node, SourceResult<SourcePresence<SourceTypeEvidence>>>;
  readonly slots: ReadonlyMap<Node, SourceResult<SourceDeclaredSlot>>;
  readonly destinations: ReadonlyMap<Node, SourceResult<SourcePresence<SourceUseDestination>>>;
  readonly operations: ReadonlyMap<Node, SourceResult<SourceOperation>>;
  readonly constructions: ReadonlyMap<Node, SourceResult<SourcePresence<SourceConstruction>>>;
  readonly returns: ReadonlyMap<SourceSignatureIdentity, SourceResult<SourceTypeEvidence>>;
  readonly applications: ReadonlyMap<Node, SourceResult<SourceApplication>>;
  readonly refusals: readonly SourceRefusal[];
}

export interface SourceSolvedFacts {
  readonly values: SourceValueFacts;
  readonly applications: SourceApplicationFacts;
  readonly refusals: readonly SourceRefusal[];
  assertApplication(application: SourceApplication): void;
}

export function createSourceSolvedFacts(builder: SourceDescriptorBuilder, publication: SourceSolvedPublication): SourceSolvedFacts {
  const originals = new Set(publication.originals);
  const enrolled = Object.freeze([...publication.occurrences]);
  const occurrences = new Set(publication.occurrences);
  if (occurrences.size !== enrolled.length) throw new Error("A Source value inventory must contain each original enrolled occurrence exactly once.");
  for (const occurrence of enrolled) {
    if (!originals.has(occurrence)) throw new Error("An enrolled Source value must be an original node in this view.");
    if (!publication.types.has(occurrence)) throw new Error("Every enrolled Source value requires its actual resolved type or original refusal before publication.");
  }
  const types = new Map(publication.types);
  const contextual = new Map(publication.contextual);
  const slots = new Map(publication.slots);
  const destinations = new Map(publication.destinations);
  const operations = new Map(publication.operations);
  const constructions = new Map(publication.constructions);
  const returns = new Map(publication.returns);
  const applications = new Map(publication.applications);
  const applicationMembership = new Set<SourceApplication>();
  const none: SourceResult<SourcePresence<never>> = Object.freeze({ kind: "resolved", value: Object.freeze({ kind: "none" }) });

  function assertOccurrence(occurrence: Node): void {
    if (!occurrences.has(occurrence)) throw new Error("Source value facts require an original occurrence from this view.");
  }

  function assertOriginal(node: Node): void {
    if (!originals.has(node)) throw new Error("Source declaration and place questions require an original node from this view.");
  }

  function required<Value>(records: ReadonlyMap<Node, SourceResult<Value>>, occurrence: Node, question: string): SourceResult<Value> {
    assertOccurrence(occurrence);
    const result = records.get(occurrence);
    if (result === undefined) throw new Error(`The solved Source ${question} requires its original published result.`);
    return result;
  }

  function discovered<Value>(records: ReadonlyMap<Node, SourceResult<SourcePresence<Value>>>, occurrence: Node):
    SourceResult<SourcePresence<Value>> {
    assertOccurrence(occurrence);
    return records.get(occurrence) ?? none;
  }

  function validate<Value>(records: ReadonlyMap<Node, SourceResult<Value>>, inspect: (value: Value, occurrence: Node) => void): void {
    for (const [occurrence, result] of records) {
      assertOccurrence(occurrence);
      if (result.kind === "resolved") inspect(result.value, occurrence);
    }
  }

  function validatePresence<Value>(inspect: (value: Value, occurrence: Node) => void):
    (presence: SourcePresence<Value>, occurrence: Node) => void {
    return (presence, occurrence) => {
      if (presence.kind === "present") inspect(presence.value, occurrence);
    };
  }

  function evidence(value: SourceTypeEvidence): void {
    builder.assertEvidence(value);
  }

  function destination(value: SourceUseDestination): void {
    evidence(value.declaration.type);
    evidence(value.applied);
    for (const binding of value.application?.classBindings ?? []) evidence(binding.value);
    for (const binding of value.application?.signatureBindings ?? []) evidence(binding.value);
    if (value.application === undefined && value.applied !== value.declaration.type) {
      throw new Error("A nonapplied Source use must retain its exact original declaration evidence.");
    }
  }

  validate(types, evidence);
  validate(contextual, validatePresence(evidence));
  for (const [declaration, slot] of slots) {
    assertOriginal(declaration);
    if (slot.kind === "resolved") evidence(slot.value.type);
  }
  validate(destinations, validatePresence(destination));
  validate(operations, (operation, occurrence) => {
    if (operation.occurrence !== occurrence) throw new Error("A Source operation requires its identical original occurrence.");
    evidence(operation.result);
    if ("operands" in operation) {
      for (const operand of operation.operands) { assertOccurrence(operand.occurrence); evidence(operand.value); }
      if (operation.kind === "compound") {
        assertOriginal(operation.target);
        destination(operation.destination);
        evidence(operation.calculation);
      }
    } else if (operation.kind === "assignment") {
      assertOriginal(operation.target);
      assertOccurrence(operation.source.occurrence);
      evidence(operation.source.value);
      destination(operation.destination);
    } else if (operation.kind === "update") {
      assertOccurrence(operation.operand.occurrence);
      evidence(operation.operand.value);
      destination(operation.destination);
    } else if ("left" in operation) {
      for (const operand of [operation.left, operation.right]) { assertOccurrence(operand.occurrence); evidence(operand.value); }
    } else if (operation.kind === "await") {
      assertOccurrence(operation.operand.occurrence);
      evidence(operation.operand.value);
      evidence(operation.completion);
    } else {
      assertOccurrence(operation.control.occurrence);
      evidence(operation.control.value);
      if (operation.kind === "conditional") {
        for (const branch of [operation.whenTrue, operation.whenFalse]) { assertOccurrence(branch.occurrence); evidence(branch.value); }
      } else if (operation.kind === "and") {
        assertOccurrence(operation.whenTrue.occurrence);
        evidence(operation.whenTrue.value);
      } else if (operation.kind === "or") {
        assertOccurrence(operation.whenFalse.occurrence);
        evidence(operation.whenFalse.value);
      } else {
        evidence(operation.whenPresent);
        assertOccurrence(operation.whenAbsent.occurrence);
        evidence(operation.whenAbsent.value);
      }
    }
  });
  validate(constructions, validatePresence((construction, occurrence) => {
    if (construction.occurrence !== occurrence) throw new Error("A Source construction requires its original occurrence.");
    evidence(construction.value);
    for (const step of construction.evaluation) { assertOccurrence(step.occurrence); evidence(step.value); }
  }));
  for (const result of returns.values()) if (result.kind === "resolved") evidence(result.value);
  validate(applications, (application, occurrence) => {
    if (application.identity.invocation !== occurrence) throw new Error("A Source application requires its identical original invocation.");
    evidence(application.result);
    for (const binding of [...application.identity.classBindings, ...application.identity.signatureBindings]) evidence(binding.value);
    if (application.receiver.kind === "value") { assertOccurrence(application.receiver.occurrence); evidence(application.receiver.value); }
    for (const argument of application.sourceArguments) {
      assertOriginal(argument.occurrence);
      assertOccurrence(argument.operand.occurrence);
      evidence(argument.operand.value);
    }
    for (const argument of application.arguments) {
      assertOriginal(argument.sourceArgument);
      const original = application.sourceArguments[argument.sourceArgumentIndex];
      if (original?.occurrence !== argument.sourceArgument) throw new Error("A Source argument binding must retain its exact authored evaluation vector entry.");
      assertOccurrence(argument.effectiveArgument);
      evidence(argument.source);
      destination(argument.destination);
      if (argument.parameter.signature !== application.identity.signature) {
        throw new Error("A Source argument destination requires its original application signature.");
      }
    }
    applicationMembership.add(application);
  });

  const values: SourceValueFacts = Object.freeze({
    occurrences: () => enrolled,
    type: (occurrence: Node) => required(types, occurrence, "value type"),
    contextual: (occurrence: Node) => discovered(contextual, occurrence),
    declaredSlot(declaration: Node) {
      assertOriginal(declaration);
      const slot = slots.get(declaration);
      if (slot === undefined) throw new Error("A Source declared slot requires its original published declaration evidence.");
      return slot;
    },
    destination: (occurrence: Node) => discovered(destinations, occurrence),
    operation: (occurrence: Node) => required(operations, occurrence, "operation"),
    construction: (occurrence: Node) => discovered(constructions, occurrence),
    callableReturn(signature: SourceSignatureIdentity) {
      const result = returns.get(signature);
      if (result === undefined) throw new Error("Source callable returns require their exact published signature identity.");
      return result;
    },
  });
  return Object.freeze({ values, applications: Object.freeze({
    application: (occurrence: Node) => required(applications, occurrence, "application"),
  }), refusals: Object.freeze([...publication.refusals]),
    assertApplication(application: SourceApplication): void {
      if (!applicationMembership.has(application)) throw new Error("A Source application must be the exact published application from this view.");
    },
  });
}
