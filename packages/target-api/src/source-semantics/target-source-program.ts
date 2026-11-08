import type { Node } from "@tsonic/tsts";
import type { SourceProgramInput } from "../host-input/program-input.js";
import type { SourceObjectProduction } from "./member-use.js";
import type { SourceObjectProductionQueries } from "./object-production.js";
import type { SourceInputComponent, SourceInputSignature } from "../host-input/identities.js";
import type { SourcePropertyName, SourceRefusal, SourceResult, SourceSignatureIdentity, SourceTypeBinding, SourceTypeEvidence } from "../public/source/contracts.js";
import type { SourceDescriptorReader, SourceProductionResult } from "./descriptor-contracts.js";
import { createSourceDescriptorOwner } from "./descriptor-owner.js";
import { createSourceTypeDescriptorReader } from "./local-type-flow/descriptors.js";
import { produceSourceScalarLiteralDomain } from "./local-type-flow/literal-domains.js";
import { produceSourceProjection } from "./local-type-flow/projections.js";
import { produceSourceSyntaxType } from "./local-type-flow/syntax-production.js";
import { sourceEvidenceExtends } from "./local-type-flow/evidence-relations.js";
import { analyzeSourceTypeFlow } from "./local-type-flow/solver.js";
import { createSourceMemberCorrespondenceQueries } from "./member-correspondence.js";
import { createSourceMemberUseQueries } from "./member-use.js";
import { createSourceProgramDocuments } from "./source-documents.js";
import type { SourceObjectFacts, SourceProgramFacts, TargetSourceProgram } from "./types.js";
import { createSourceAdmissionFacts } from "./admission.js";
import { createSourcePropertyNameQuery } from "./property-names.js";
import { createSourceAnalysisFacts } from "../target-analysis/source-protocol-production.js";
import type { SourceAnalysisFacts } from "../target-analysis/source-protocols.js";
import { createSourceNodeNavigationFacts } from "../source-navigation/facts.js";
import { createSourcePointerFacts } from "../target-analysis/source-pointer-production.js";

export function createTargetSourceProgram(input: SourceProgramInput): TargetSourceProgram {
  const { ast, inventory } = input;
  const sourceFiles = Object.freeze([...input.sourceFiles]);
  let reader: SourceDescriptorReader | undefined;
  let propertyName: ((node: Node) => SourceProductionResult<SourcePropertyName>) | undefined;
  let objectProduction: SourceObjectProduction | undefined;
  let objectQueries: SourceObjectProductionQueries | undefined;
  let memberUses: ReturnType<typeof createSourceMemberUseQueries> | undefined;
  let solved: ReturnType<typeof analyzeSourceTypeFlow> | undefined;
  let protocols: SourceAnalysisFacts | undefined;
  const signatures = new WeakMap<SourceInputSignature, SourceSignatureIdentity>();
  const unavailableRefusals = new WeakMap<Node, Map<string, SourceRefusal>>();

  function assertNode(node: Node): void {
    if (!inventory.contains(node)) throw new Error("Source facts require the exact original node from this program.");
  }
  function requiredReader(): SourceDescriptorReader {
    if (reader === undefined) throw new Error("The Source reader must be installed once before original component production.");
    return reader;
  }
  function requiredSolved(): ReturnType<typeof analyzeSourceTypeFlow> {
    if (solved === undefined) throw new Error("Final Source value queries require completion of the original solve.");
    return solved;
  }
  function requiredObjects(): SourceObjectProduction {
    if (objectProduction === undefined) throw new Error("Original Source semantic production requires its single member owner before graph collection.");
    return objectProduction;
  }
  function requiredProtocols(): SourceAnalysisFacts {
    if (protocols === undefined) throw new Error("Original Source storage requires its one final protocol owner.");
    return protocols;
  }
  function settle<Value>(result: SourceProductionResult<Value>): SourceResult<Value> {
    if (result.kind === "pending") throw new Error("A final Source query cannot publish an unsolved original dependency.");
    return owner.observe(result);
  }

  const owner = createSourceDescriptorOwner({ input: input.input, assertNode,
    members: (value, original, bindings) => requiredReader().describeMembers(original, bindings, value),
    receiverBindings(value, direct) {
      const original = owner.builder.originalComponent(value);
      if (original.kind === "present") return requiredReader().inheritedBindings(original.value, direct);
      return value.type.kind === "declared"
        ? requiredReader().inheritedBindings(input.input.syntax(value.type.declaration), direct)
        : { kind: "resolved", value: direct };
    },
    project(originalSource, source, projection, bindings) {
      return produceSourceProjection({ ast, input: input.input, builder: owner.builder,
        reader: requiredReader(), objects: requiredObjects(), originalSource, source, projection, bindings });
    } });

  function signature(original: SourceInputSignature): SourceSignatureIdentity {
    input.input.assertSignature(original);
    const previous = signatures.get(original);
    if (previous !== undefined) return previous;
    for (const declaration of original.typeParameters) {
      const selected = settle(requiredReader().describeSyntax(declaration, []));
      if (selected.kind === "refused") throw new Error("An original callable binder must be registered before its signature identity is published.");
    }
    const selected = owner.builder.signature(original.owner, original.signatureKind, original, original.declaration, original.typeParameters);
    signatures.set(original, selected);
    return selected;
  }
  function publish(component: SourceInputComponent, receiver?: SourceTypeEvidence): SourceResult<SourceTypeEvidence> {
    const bindings: SourceTypeBinding[] = [];
    if (receiver !== undefined) {
      owner.view.assertEvidence(receiver);
      if (receiver.type.kind === "declared") {
        const parameters = input.input.describe(input.input.syntax(receiver.type.declaration)).definitionParameters;
        if (parameters === undefined) throw new Error("An original declared receiver requires its complete authenticated binder inventory.");
        for (const [index, declaration] of parameters.entries()) {
          const value = owner.view.component(receiver, { kind: "type-argument", declaration: receiver.type.declaration, index });
          if (value.kind === "refused") return owner.observe(value);
          bindings.push({ declaration, value: value.value });
        }
      }
    }
    return settle(requiredReader().describeComponent(component, bindings));
  }
  function unavailable(node: Node, reason: string): SourceRefusal {
    assertNode(node);
    let records = unavailableRefusals.get(node);
    const previous = records?.get(reason);
    if (previous !== undefined) return previous;
    if (records === undefined) { records = new Map(); unavailableRefusals.set(node, records); }
    const refusal: SourceRefusal = Object.freeze({ kind: "refused", source: "tsonic", code: "TSONIC_SOURCE_FORM_UNSUPPORTED",
      site: node, message: reason });
    records.set(reason, refusal);
    owner.observe(refusal);
    return refusal;
  }

  const navigationOwner = createSourceNodeNavigationFacts({ ast, input: input.navigation, assertNode,
    signature, publish, profileDeclaration: input.profileDeclaration });
  const navigation = navigationOwner.facts;
  const profile = input.apiFacts.kind === "none" ? input.apiFacts : Object.freeze({ kind: "present" as const,
    value: input.apiFacts.value({ view: owner.view, assertNode,
      assertApplication: application => requiredSolved().assertApplication(application),
      profileDeclaration: input.profileDeclaration }) });
  const correspondence = createSourceMemberCorrespondenceQueries({ view: owner.view,
    inventory: { members: owner.builder.members, construction: owner.builder.construction }, assertNode, domain: owner.builder.domain });
  solved = analyzeSourceTypeFlow({ ast, sourceFiles, navigation, input: input.input, protocolInput: input.protocolInput, descriptorBuilder: owner.builder, profile,
    createDescriptorReader(hooks) {
      if (reader !== undefined) throw new Error("A Source solve must create exactly one descriptor reader for its view.");
      reader = createSourceTypeDescriptorReader({ input: input.input, builder: owner.builder, hooks, observe: owner.observe,
        scalarDomain: (original, facts) => produceSourceScalarLiteralDomain(ast, original, facts),
        syntaxProduction: (component, syntax, bindings, currentReader) => produceSourceSyntaxType({ ast,
          input: input.input, builder: owner.builder, reader: currentReader, objects: requiredObjects(), component, syntax, bindings }) });
      return reader;
    },
    createPropertyNameQuery(queries) {
      if (propertyName !== undefined) throw new Error("A Source solve must retain one property-name owner before collection.");
      propertyName = createSourcePropertyNameQuery({ ast, assertNode, ...input.propertyNames, ...queries });
      return propertyName;
    },
    createObjects(queries: SourceObjectProductionQueries) {
      if (objectProduction !== undefined) throw new Error("A Source solve must retain one member-use and correspondence owner.");
      objectQueries = queries;
      memberUses = createSourceMemberUseQueries({ view: owner.view,
        inventory: { members: owner.builder.members, construction: owner.builder.construction }, assertNode,
        select: input.memberUse, value: occurrence => queries.value(occurrence, []), compose: queries.memberValue,
        destination: queries.memberDestination, unavailable });
      objectProduction = Object.freeze({ ...correspondence, use: memberUses.use });
      return objectProduction;
    } });
  input.discharge(solved.dischargedDiagnostics);
  for (const refusal of solved.refusals) owner.observe(refusal);
  const completeObjects = objectProduction;
  const completePropertyName = propertyName;
  if (completeObjects === undefined || completePropertyName === undefined)
    throw new Error("A Source solve must establish its required object and property-name owners before publication.");
  const keyContains = (destination: SourceTypeEvidence, source: SourceTypeEvidence) => sourceEvidenceExtends(
    { builder: owner.builder, objects: completeObjects }, destination, source);
  const objects: SourceObjectFacts = Object.freeze({
    correspondence: (source, destination, purpose) => settle(completeObjects.correspondence(source, destination, purpose, keyContains)),
    correspondingMember: (source, destination, declaration, purpose) => settle(completeObjects.correspondingMember(source, destination, declaration, purpose, keyContains)),
    use: occurrence => settle(completeObjects.use(occurrence)),
    propertyName: name => settle(completePropertyName(name)) });
  const completeObjectQueries = objectQueries;
  if (completeObjectQueries === undefined) throw new Error("Final Source protocols require the original member value and destination owner.");
  const completeMemberUses = memberUses;
  if (completeMemberUses === undefined) throw new Error("Final Source storage requires the same original member selection owner.");
  protocols = createSourceAnalysisFacts({ ast, input: input.protocolInput, view: owner.view, assertNode,
    values: solved.values, navigation, memberPlace: completeMemberUses.place,
    inventory: { members: owner.builder.members, construction: owner.builder.construction },
    signature, solved: solved.protocols, pointers: createSourcePointerFacts({ core: input.core,
      applications: solved.applications, values: solved.values, view: owner.view, assertNode,
      originalComponent: owner.builder.originalComponent, sourceOriginSubjects: owner.builder.sourceOriginSubjects,
      syntax: input.input.syntax, publish, storage: occurrence => requiredProtocols().storage(occurrence), unavailable }), unavailable, settle });
  const facts: SourceProgramFacts = Object.freeze({ admission: createSourceAdmissionFacts({ ast, assertNode, observe: owner.observe }),
    descriptors: owner.view, values: solved.values, applications: solved.applications,
    enums: solved.enums, navigation, profile, objects, protocols, refusals: owner.refusals });
  return Object.freeze({ ast, sourceFiles, documents: createSourceProgramDocuments(ast, input.programSourceFiles), facts });
}
