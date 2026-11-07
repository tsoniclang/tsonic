import { sourceAnalysisIncludesFile, type SourceAnalysisProgram } from "../../analysis-program.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import type { Node, SourceFile } from "@tsonic/tsts";
import { argumentPassingFactKey, flowStateFactKey } from "@tsonic/tsts";
import type { SourceTypeDescriptor } from "../../../source-semantics/local-type-flow/types.js";
import { sourceStorageHasSignatures, sourceStorageIndexes, sourceStoragePointerOperation, sourceStorageSignatureDeclarations } from "./host-reads.js";
import { Node_Initializer } from "../../../source-navigation/index.js";
import { sourcePresentStorageArms, sourceStorageMembers, sourceStorageComponents, sourceStorageSubjectType, sourceStorageComponentType, sourceStorageIsScalarType, sourceStorageOriginalComponents } from "../model/components.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject } from "../model/subjects.js";
import { sourceStorageIsDataMember, sourceStorageMemberSubject } from "../model/subjects.js";
import type { SourceStorageScopedSubject, SourceStorageScope } from "../graph/scoped-model.js";
import type { createSourceStorageTransport } from "./transport.js";
import type { createSourceStorageDomainWitnesses } from "../graph/domain-witnesses.js";
import type { createSourceStorageDomainPublications, SourceStoragePublication } from "../graph/domain-publications.js";
import type { createSourceStorageDomainInputs } from "./domain-inputs.js";
import type { createSourceStoragePublicationDemands } from "./publication-demands.js";
import { sourceStorageProjectionSubject, sourceStorageProjectionType } from "../scoped/projection-views.js";

export function createSourceStorageDomainInitialization(input: {
  readonly source: SourceAnalysisProgram;
  readonly transport: ReturnType<typeof createSourceStorageTransport>;
  readonly budget: SourceStorageBudget;
  readonly witnesses: ReturnType<typeof createSourceStorageDomainWitnesses>;
  readonly publications: ReturnType<typeof createSourceStorageDomainPublications>;
  readonly publicationDemands: ReturnType<typeof createSourceStoragePublicationDemands>;
  readonly add: ReturnType<typeof createSourceStorageDomainInputs>["add"];
  readonly publicationOriginsIn: (subject: SourceStorageSubject, bindings: SourceStorageScope) => ReadonlySet<SourceStorageScopedSubject> | undefined;
}) {
  const { source, transport, budget, witnesses, publications, publicationDemands, add, publicationOriginsIn } = input;
  const { ast, navigation } = source;
  const publish = (subject: SourceStorageSubject | undefined, exposure: Node, writes = true,
    kind: SourceStoragePublication["kind"] = "external-write", type?: SourceTypeDescriptor, sourceFile?: SourceFile, externalEntry = false,
    inputOwner?: SourceStorageSubject, receiver?: SourceStoragePublication["receiver"],
    bindings?: SourceStorageScope): void => {
    if (subject === undefined) return;
    const file = sourceFile ?? transport.sourceFileFor(subject);
    const selected = type ?? sourceStorageSubjectType(source, subject, file);
    if (selected === undefined || file === undefined) return;
    const context = receiver?.bindings ?? bindings ?? (externalEntry
      ? transport.substitutions.forLexicalOwner(subject.node) : transport.substitutions.empty);
    if (context === undefined) {
      budget.reject("Source storage publication requires its completed original lexical creation bindings.");
      return;
    }
    publications.add(subject, selected, file, exposure, writes, kind, externalEntry, inputOwner, receiver, context);
  };
  const callable = (declaration: Node, exposure: Node): void => {
    const selected = navigation.callableImplementation(declaration);
    const owner = selected.kind === "resolved" ? selected.implementation.declaration : declaration;
    if (!publications.callable(owner, exposure)) return;
    if (ast.is.IsClassDeclaration(owner) || ast.is.IsClassExpression(owner)) {
      const sourceClass = navigation.isProjectDeclaration(owner) && transport.declarationIsAmbient(owner) === false;
      const constructors = navigation.classConstructors(owner);
      if (constructors.kind === "resolved") for (const signature of constructors.signatures) {
        if (!budget.step()) return;
        const implementation = signature.declaration === undefined ? undefined : navigation.callableImplementation(signature.declaration);
        const sourceConstructor = sourceClass && implementation?.kind === "resolved" &&
          navigation.isProjectDeclaration(implementation.implementation.declaration) &&
          ast.body(implementation.implementation.declaration) !== undefined;
        for (const parameter of signature.parameters) {
          if (!budget.step()) return;
          const formal = transport.subject(parameter.parameterDeclaration, "input");
          add(formal, "external-input", exposure);
          if (sourceConstructor) publish(formal, exposure, false, "external-write", undefined, undefined, true, formal);
        }
      }
      const receiver = transport.subject(owner, "receiver");
      if (sourceClass) publish(receiver, exposure);
      else add(receiver, "external-input", exposure);
    } else {
      const parameters = sourceCallableValueParameters(ast, owner, source.navigation, { kind: "declaration" });
      if (parameters === undefined) {
        budget.reject("Source storage callable publication requires its exact checked value parameters.");
        return;
      }
      for (const parameter of parameters) {
        if (!budget.step()) return;
        const formal = transport.subject(parameter, "input");
        const entries = transport.invocations.has(exposure) ? transport.callbackEntriesFor(exposure).filter(callback =>
          budget.step() && transport.callbackImplementationsFor(callback).has(owner)) : [];
        const nativeInput = formal !== undefined && entries.length !== 0 &&
          entries.every(callback => {
            if (!budget.step()) return false;
            const selected = transport.invocationInputs(formal, owner, exposure, callback);
            return selected.subjects.size !== 0 && !selected.subjects.has(formal) &&
              selected.calleeSubjects?.includes(formal) !== true;
          });
        if (nativeInput) continue;
        add(formal, "external-input", exposure);
        if (ast.body(owner) !== undefined) publish(formal, exposure, false, "external-write", undefined, undefined, true, formal);
      }
      if (ast.body(owner) !== undefined) {
        if (ast.is.IsMethodDeclaration(owner) || ast.is.IsGetAccessorDeclaration(owner) || ast.is.IsSetAccessorDeclaration(owner))
          add(transport.subject(owner, "receiver"), "external-input", exposure);
        publish(transport.subject(owner, "return"), exposure, true, "external-write", undefined, undefined, true);
      }
    }
  };
  const accessible = (declaration: Node): boolean => !ast.hasModifierKind(declaration, "private");
  const initializePublications = (): void => {
    for (const node of transport.visitedNodes) {
      if (!budget.step()) return;
      if (!ast.is.IsVariableDeclaration(node) && !ast.is.IsFunctionDeclaration(node) && !ast.is.IsClassDeclaration(node)) continue;
      if (ast.is.IsVariableDeclaration(node) && navigation.isProjectDeclaration(node) && Node_Initializer(ast, node) === undefined) {
        const ambient = transport.declarationIsAmbient(node);
        if (ambient === undefined) return;
        if (ambient) {
          const subject = transport.subjectFor(node);
          add(subject, "external-input", node);
          publish(subject, node, false, "external-write", undefined, undefined, true, subject);
        }
      }
      const summary = navigation.declarationUseSummary(node);
      if (summary.exported) {
        const subject = transport.subjectFor(node);
        if (ast.is.IsVariableDeclaration(node) && ast.variableDeclarationKind(node) !== "const") add(subject, "external-write", node);
        publish(subject, node);
        if (ast.is.IsClassDeclaration(node) || ast.is.IsFunctionDeclaration(node)) callable(node, node);
      }
      if (summary.hasUnclassifiedValueUse) publish(transport.subjectFor(node), node, true, "unclassified-exposure");
    }
    for (const node of transport.checkedDeclarations.keys()) {
      if (!budget.step()) return;
      if (!ast.is.IsPropertyDeclaration(node) || !ast.hasModifierKind(node, "static") ||
        transport.declarationIsAmbient(node) !== true) continue;
      const subject = transport.subject(node, "member");
      add(subject, "external-input", node);
      publish(subject, node, false, "external-write", undefined, undefined, true, subject);
    }
    for (const boundary of transport.boundaries) {
      if (!budget.step()) return;
      const effect = transport.invocationEffects.get(boundary.invocation);
      if (effect?.resultAlias === undefined && effect?.resultAllocation === undefined)
        add(transport.subject(boundary.invocation), "opaque-result", boundary.invocation);
      for (const expression of transport.invocationArguments.get(boundary.invocation) ?? []) {
        if (!budget.step()) return;
        const subject = transport.subjectFor(expression);
        publish(subject, boundary.invocation, true, "opaque-write");
        const passing = source.sourceFacts.getFact(expression, argumentPassingFactKey);
        const flow = source.sourceFacts.getFact(expression, flowStateFactKey);
        const pointer = sourceStoragePointerOperation(source, expression);
        const storage = passing?.storageExpression ?? (pointer?.operation === "address-of" ? pointer.storageExpression : undefined);
        const file = storage === undefined ? undefined : ast.getSourceFile(storage);
        if (storage !== undefined && (file === undefined || !sourceAnalysisIncludesFile(source, file))) {
          budget.reject("Source storage exposure requires its exact checked storage expression.");
          return;
        }
        if (passing !== undefined && passing.mode !== "by-value" && passing.mode !== "byref-readonly" && passing.mode !== "borrow-shared" ||
          pointer?.operation === "address-of" || flow?.state === "borrowed-mut")
          add(transport.locationFor(storage ?? expression), "opaque-write", boundary.invocation);
      }
    }
    for (let index = 0; index < publications.size() && budget.step(); index += 1) {
      const publication = publications.at(index)!;
      // The exposed value is its present arms (absence, void and never carry no storage); a single scalar arm none.
      const arms = sourcePresentStorageArms(publication.type);
      if (arms.length === 0) continue;
      const present = arms.length === 1 ? arms[0]! : publication.type;
      if (arms.length === 1 && sourceStorageIsScalarType(present, ast)) continue;
      const origins = publication.receiver === undefined ? publicationOriginsIn(publication.subject, publication.bindings) ?? []
        : transport.substitutions.projectedValues(publication.receiver) ?? [];
      for (const selectedOwner of origins) {
        if (!budget.step()) return;
        const owner = selectedOwner.subject;
        if (witnesses.forSubject(owner).some(boundary => boundary.kind === "opaque-result")) continue;
        const file = transport.sourceFileFor(owner);
        const type = sourceStorageProjectionType(source, owner, selectedOwner.views, file);
        if (type === undefined || file === undefined) continue;
        const emptyView = (sourceStorageMembers(source, present)?.length ?? 0) === 0 &&
          sourceStorageIndexes(source, present).length === 0 && !sourceStorageHasSignatures(present);
        const physicalContents = transport.contextLocation(owner) === "allocation" || owner.kind === "receiver" &&
          owner.projection.length === 0 && (ast.is.IsClassDeclaration(owner.node) || ast.is.IsClassExpression(owner.node));
        if (!physicalContents) for (const demand of publicationDemands.values(owner, selectedOwner.bindings)) {
          if (!budget.step()) return;
          publish(demand.subject, publication.exposure, publication.writes, publication.kind, demand.type, undefined,
            publication.externalEntry, publication.inputOwner, demand.receiver, demand.bindings);
        }
        if (emptyView && !physicalContents) continue;
        const exposed = emptyView ? type : present;
        const checkedOwner = sourceStorageProjectionSubject(owner, selectedOwner.views, transport.subject);
        if (checkedOwner === undefined) continue;
        for (const declaration of sourceStorageSignatureDeclarations(type)) {
          if (!budget.step()) return;
          callable(declaration, publication.exposure);
        }
        const members = transport.memberFlow.membersFor(checkedOwner, exposed);
        if (members === undefined) {
          const components = transport.memberFlow.componentsFor(owner);
          if (components === undefined) add(owner, "unclassified-exposure", publication.exposure, publication.inputOwner);
          else for (const component of components) {
            if (!budget.step()) return;
            const child = component.kind === "member" || component.kind === "method-value"
              ? sourceStorageMemberSubject(component.declaration, ast, transport.subject)
              : transport.subject(owner.node, owner.kind, [...owner.projection, component]);
            add(child, "unclassified-exposure", publication.exposure, owner);
          }
        }
        for (const member of members === undefined ? [] : members) {
          if (!budget.step()) return;
          if (member.kind !== "present") continue;
          const declarations = new Set<Node>();
          for (const declaration of member.source.declarations) { if (!budget.step()) return; declarations.add(declaration); }
          for (const declaration of declarations) {
            if (!budget.step()) return;
            if (!accessible(declaration) || !transport.retainCheckedContext(declaration, file)) continue;
            const child = sourceStorageMemberSubject(declaration, ast, transport.subject);
            if (publication.inputOwner !== undefined) add(child, "external-input", publication.exposure, publication.inputOwner);
            const declaringOwner = ast.parent(declaration);
            const objectMethodSlot = declaringOwner !== undefined && ast.is.IsObjectLiteralExpression(declaringOwner) &&
              ast.is.IsMethodDeclaration(declaration);
            if (publication.writes && (objectMethodSlot || !member.destination.readonly || !member.source.readonly) &&
              (member.destination.read !== "method" || objectMethodSlot) &&
              !ast.is.IsGetAccessorDeclaration(declaration) && !ast.is.IsSetAccessorDeclaration(declaration))
              add(child, publication.kind, publication.exposure, owner, selectedOwner.bindings);
            if (publication.writes) for (const setter of member.source.setters) {
              if (!budget.step()) return;
              callable(setter, publication.exposure);
            }
            if (member.destination.read === "method" && !sourceStorageIsDataMember(declaration, ast)) callable(declaration, publication.exposure);
            else if (sourceStorageIsDataMember(declaration, ast) && physicalContents)
              publish(child, publication.exposure, publication.writes, publication.kind, member.destination.type, file,
                publication.externalEntry, publication.inputOwner,
                Object.freeze({ ...selectedOwner, type: member.source.receiverType, view: checkedOwner,
                  component: Object.freeze({ kind: "member", declaration }) }));
            else if (ast.is.IsGetAccessorDeclaration(declaration)) callable(declaration, publication.exposure);
          }
        }
        const indexes = sourceStorageIndexes(source, exposed);
        for (const component of sourceStorageComponents(exposed)) {
          if (!budget.step()) return;
          const element = sourceStorageComponentType(source, exposed, component);
          if (element === undefined) continue;
          const originals = sourceStorageOriginalComponents(source, type, exposed, component);
          for (const original of originals) {
            if (!budget.step()) return;
            const child = transport.subject(owner.node, owner.kind, [...owner.projection, original]);
            if (publication.inputOwner !== undefined) add(child, "external-input", publication.exposure, publication.inputOwner);
            if (publication.writes && indexes.some(value => !value.readonly)) add(child, publication.kind, publication.exposure, owner, selectedOwner.bindings);
            if (physicalContents)
              publish(child, publication.exposure, publication.writes, publication.kind, element, file, publication.externalEntry,
                publication.inputOwner, undefined, selectedOwner.bindings);
          }
        }
      }
    }
  };
  return initializePublications;
}
