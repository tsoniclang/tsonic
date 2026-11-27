import type {
  HostProgram, CanonicalizeProgram, ProgramEvidence, ProgramEvidenceInput, ProgramIdentityImage, ProgramIndex, ProgramInitialization, ProgramMemberEvidence,
  ConstantRecord, ModuleBodies, ResolvedExternalEntry, SignatureRecord,
} from "./contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import type { BodyFacts, BodyObservations, MetadataRecord, Summary, SummaryKey } from "../ir-facts/contract.js";
import type { TirBody, TirModule } from "../ir-tir/contract.js";
import type { MirBody } from "../ir-mir/contract.js";
import type { BodyInstance, Execution, MemberInventory } from "../ir-types/contract.js";
import type { CheckedContentImage, CheckedPhase, HirCoreCapture, SyntaxCopyResult, SyntaxImage, SyntaxRootSlot } from "../ir-hir/contract.js";
import type { OrderedTextRecord, ProjectionInventory, ProjectionResult } from "./program-values.js";
import type { InstantiationStop } from "./work.js";
import type { InvariantFailure } from "../diag/contract.js";
import type { DataflowStop } from "../dataflow/contract.js";
import { requirePresent } from "../diag/index.js";
import { projectCheckedContent } from "../ir-hir/index.js";
import { encodeKey } from "../ids/index.js";
import { chargeWork } from "../dataflow/index.js";
import { admitArtifactIdentity, admitSummaryIdentity, summaryKey } from "../ir-facts/index.js";
import { artifactBindingsData, artifactBindingsKey, compareIndexSignatures, constantReferenceKey } from "../ir-types/index.js";
import {
  copiedProjection, createProjectionInventory, finishProjection, followingProjection, inventoryRecord, prepareArtifactBindings,
  prepareBindingsProjection, prepareComponentProjection, prepareParameterProjection, orderProjection, orderTextProjection, projectRead, projectRecord, projectRows,
} from "./program-values.js";
import { publicationRewrite, rewriteConstant } from "./canonical-types.js";
import { projectExecution, projectInstance, projectMetadata, projectSummary, projectSummaryKey } from "./canonical-facts.js";
import { prepareModuleSyntax } from "./canonical-syntax.js";
import type { PreparedModuleSyntax } from "./canonical-syntax.js";
import type { RememberProgramBody } from "./canonical-syntax.js";
import type { CheckedChapterImage } from "./syntax-arena.js";
import { admitCheckedProjection, chargeInstantiationWork, ProgramWork } from "./work.js";
import { prepareCoreProjection } from "./instantiate-phase.js";

const dense: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A completed Program projection has dense keyed records." };
function instanceKeys<Value>(scan: ProjectionInventory, value: Value, instance: BodyInstance):
  ProjectionResult<OrderedTextRecord<Value>> {
  const stop = chargeWork(scan.meter.account, instance.body.length) ?? admitArtifactIdentity(instance.bindings, scan.meter.account);
  return stop === null ? copiedProjection({ value, group: instance.body, key: artifactBindingsKey(instance.bindings) }) : { kind: "refused", stop };
}

function signature(scan: ProjectionInventory, rewrite: TypeReferenceRewrite, read: () => SignatureRecord):
  ProjectionResult<SignatureRecord> {
  return projectRecord(scan, 5, () => {
    const record = read();
    return followingProjection(finishProjection(scan, prepareArtifactBindings(scan, record.bindings), rewrite), (bindings): ProjectionResult<SignatureRecord> => {
      const common = { definition: record.definition, bindings, ordinal: record.ordinal, signature: rewrite.signature(record.signature) };
      switch (record.kind) {
        case "advertised": case "api-signature": return copiedProjection({ ...common, kind: record.kind });
        case "api-body": return copiedProjection({ ...common, kind: "api-body", body: record.body });
      }
    });
  });
}

function initialization(scan: ProjectionInventory, source: ProgramInitialization,
  executionImage: (source: Execution) => ProjectionResult<Execution>,
): ProjectionResult<ProgramInitialization> {
  return projectRecord(scan, 4, () => {
    const external = projectRows(scan, source.external, read => projectRecord(scan, 4, () => {
      const row = read();
      return followingProjection(projectRows(scan, row.storage, readStorage => projectRecord<ResolvedExternalEntry["storage"][number]>(scan, 4, () => {
        const reference = readStorage();
        return followingProjection(executionImage(reference.owner.key.execution), execution =>
          copiedProjection({ cell: reference.cell, owner: { kind: "summary", key: { kind: "body", execution } } }));
      })), storage => copiedProjection({ ...row, storage }));
    }));
    if (external.kind === "refused") return external;
    const modules = projectRows(scan, source.modules, read => projectRead(scan, () => executionImage(read())));
    if (modules.kind === "refused") return modules;
    const entries = projectRows(scan, source.entries, read => projectRead(scan, () => executionImage(read())));
    if (entries.kind === "refused") return entries;
    return copiedProjection({ entry: source.entry, external: external.value, modules: modules.value, entries: entries.value });
  });
}

function projectIndex(scan: ProjectionInventory, rewrite: TypeReferenceRewrite, program: HostProgram, table: ProgramIndex["types"],
  summaryImage: Map<Summary, Summary>, metadataImage: Map<MetadataRecord, MetadataRecord>,
): ProjectionResult<ProgramIndex> {
  return projectRecord(scan, 13, () => {
    const index = program.index;
    const signatures = projectRows(scan, index.signatures, read => signature(scan, rewrite, read));
    if (signatures.kind === "refused") return signatures;
    const orderedSignatures = orderTextProjection(scan, signatures.value, value => {
      const stop = chargeWork(scan.meter.account, value.definition.length) ?? admitArtifactIdentity(value.bindings, scan.meter.account);
      return stop === null ? copiedProjection({ value, group: value.definition, key: encodeKey([
        artifactBindingsData(value.bindings), value.kind, value.ordinal,
      ]) }) : { kind: "refused", stop };
    });
    if (orderedSignatures.kind === "refused") return orderedSignatures;
    const bodies = projectRows(scan, index.bodies, read => projectRecord(scan, 9, () => {
      const row = read();
      return followingProjection(projectInstance(scan, rewrite, row.instance), instance => copiedProjection({ ...row, instance }));
    }));
    if (bodies.kind === "refused") return bodies;
    const orderedBodies = orderTextProjection(scan, bodies.value, value => instanceKeys(scan, value, value.instance));
    if (orderedBodies.kind === "refused") return orderedBodies;
    const executions = projectRecord(scan, 0, () => copiedProjection(new Map<Execution, Execution>()));
    if (executions.kind === "refused") return executions;
    const executionImage = (original: Execution): ProjectionResult<Execution> => {
      const known = executions.value.get(original);
      if (known !== undefined) return copiedProjection(known);
      return projectRecord(scan, 0, () => followingProjection(projectExecution(scan, rewrite, original), mapped => {
        executions.value.set(original, mapped);
        return copiedProjection(mapped);
      }));
    };
    const dependencies = projectRecord(scan, 4, () => {
      const { operations, dependencies, components } = index.dependencyInventory;
      const keys = new Map<SummaryKey, SummaryKey>();
      const keyImage = (original: SummaryKey): ProjectionResult<SummaryKey> => {
        const known = keys.get(original);
        if (known !== undefined) return copiedProjection(known);
        return projectRecord(scan, 0, () => {
          const mapped: ProjectionResult<SummaryKey> = original.kind === "body"
            ? projectRecord(scan, 2, () => followingProjection(executionImage(original.execution), execution =>
              copiedProjection({ kind: "body", execution })))
            : projectSummaryKey(scan, rewrite, original);
          if (mapped.kind === "copied") keys.set(original, mapped.value);
          return mapped;
        });
      };
      const mapped = projectRows(scan, operations, read => projectRead(scan, () => keyImage(read())));
      if (mapped.kind === "refused") return mapped;
      const edges = projectRows(scan, dependencies, read => projectRecord(scan, 4, () => {
        const row = read();
        return followingProjection(executionImage(row.dependent), dependent =>
          followingProjection(keyImage(row.target), target =>
            copiedProjection({ dependent, at: row.at, reason: row.reason, target })));
      }));
      if (edges.kind === "refused") return edges;
      return copiedProjection({ operations: mapped.value, dependencies: edges.value, components });
    });
    if (dependencies.kind === "refused") return dependencies;
    const metadata = projectRows(scan, index.metadata, read => projectRecord(scan, 0, () => {
      const source = read();
      return followingProjection(projectMetadata(scan, rewrite, source), row => {
        metadataImage.set(source, row);
        return copiedProjection(row);
      });
    }));
    if (metadata.kind === "refused") return metadata;
    const orderedMetadata = orderTextProjection(scan, metadata.value, value => {
      const key = value.key;
      const stop = chargeWork(scan.meter.account, key.definition.length) ?? admitArtifactIdentity(key.bindings, scan.meter.account);
      return stop === null ? copiedProjection({ value, group: key.definition, key: artifactBindingsKey(key.bindings) }) : { kind: "refused", stop };
    });
    if (orderedMetadata.kind === "refused") return orderedMetadata;
    const summaries = projectRows(scan, index.summaries, read => projectRecord(scan, 0, () => {
      const source = read();
      return followingProjection(projectSummary(scan, rewrite, source), row => {
        summaryImage.set(source, row);
        return copiedProjection(row);
      });
    }));
    if (summaries.kind === "refused") return summaries;
    const orderedSummaries = orderTextProjection(scan, summaries.value, value => {
      const stop = admitSummaryIdentity(value.key, scan.meter.account);
      return stop === null ? copiedProjection({ value, group: "", key: summaryKey(value.key) }) : { kind: "refused", stop };
    });
    if (orderedSummaries.kind === "refused") return orderedSummaries;
    const constants = projectRows(scan, index.constants, read => projectRecord(scan, 2, () => projectRecord<ConstantRecord>(scan, 2, () => {
      const row = read();
      const reference = row.reference;
      const { context } = reference;
      if (context === "enum-member") {
        const member = reference.member;
        return followingProjection(finishProjection(scan, prepareArtifactBindings(scan, reference.bindings), rewrite), bindings =>
          projectRecord(scan, 3, () => copiedProjection({
            reference: { context, member, bindings }, value: rewriteConstant(rewrite, row.value),
          })));
      }
      return followingProjection(projectInstance(scan, rewrite, reference.initializer), initializer =>
        projectRecord(scan, 3, () => copiedProjection({ reference: { initializer, context }, value: rewriteConstant(rewrite, row.value) })));
    })));
    if (constants.kind === "refused") return constants;
    const orderedConstants = orderTextProjection(scan, constants.value, value => {
      const { reference } = value;
      const [owner, bindings] = reference.context === "enum-member"
        ? [reference.member, reference.bindings] : [reference.initializer.body, reference.initializer.bindings];
      const stop = chargeWork(scan.meter.account, owner.length) ?? admitArtifactIdentity(bindings, scan.meter.account);
      return stop === null ? copiedProjection({ value, group: "", key: constantReferenceKey(reference) }) : { kind: "refused", stop };
    });
    if (orderedConstants.kind === "refused") return orderedConstants;
    return followingProjection(initialization(scan, index.initialization, executionImage), initialization => {
      const { schema, nativeFactsKey, rootPackage, packages, modules, diagnostics } = index;
      return copiedProjection({ schema, nativeFactsKey, rootPackage, packages, modules, diagnostics, types: table,
        signatures: orderedSignatures.value, bodies: orderedBodies.value, dependencyInventory: dependencies.value,
        metadata: orderedMetadata.value, summaries: orderedSummaries.value, constants: orderedConstants.value, initialization });
    });
  });
}

function inlineCycle(path: string): never {
  throw new TypeError("Inline cycle at " + path);
}

export const canonicalizeProgram: CanonicalizeProgram = (program, publication, resources, mode) => {
  const rewrite = publicationRewrite(publication);
  const scan = createProjectionInventory(ProgramWork.state(resources), rewrite, inlineCycle);
  const setup = projectRecord(scan, 7, () => copiedProjection({
    trees: new Map<TirModule["tree"], PreparedModuleSyntax>(),
    tir: new Map<TirBody, TirBody>(), mir: new Map<MirBody, MirBody>(), facts: new Map<BodyFacts, BodyFacts>(),
    observations: new Map<BodyObservations, BodyObservations>(), summaries: new Map<Summary, Summary>(), metadata: new Map<MetadataRecord, MetadataRecord>(),
  }));
  if (setup.kind === "refused") return setup.stop;
  const ready = setup.value;
  const remember: RememberProgramBody = (original, source, image) => {
    const tir = projectRecord(scan, 0, () => copiedProjection((selected: TirBody) => { ready.tir.set(original, selected); }));
    if (tir.kind === "refused") return tir;
    if (source.kind !== "selected" || image === null) return tir;
    const mir = projectRecord(scan, 0, () => { ready.mir.set(source.mir, image.mir); return copiedProjection(null); });
    if (mir.kind === "refused") return mir;
    const observations = projectRecord(scan, 0, () => { ready.observations.set(source.observations, image.observations); return copiedProjection(null); });
    if (observations.kind === "refused") return observations;
    for (let position = 0; position < source.facts.length; position += 1) {
      const entry = projectRecord(scan, 0, () => {
        ready.facts.set(requirePresent(source.facts[position], dense), requirePresent(image.facts[position], dense));
        return copiedProjection(null);
      });
      if (entry.kind === "refused") return entry;
    }
    return tir;
  };
  const index = projectIndex(scan, rewrite, program, publication.table, ready.summaries, ready.metadata);
  if (index.kind === "refused") return index.stop;
  const originalInitialization = program.index.initialization;
  const modules = projectRows(scan, program.modules, (read, position) => projectRecord(scan, 0, () => {
    const original = read();
    return followingProjection(prepareModuleSyntax(scan, rewrite, original, "HostProgram.modules[" + position + "]", remember), module =>
      followingProjection(orderTextProjection(scan, module.bodies, value => instanceKeys(scan, value, value.instance)), bodies =>
        copiedProjection({ module, bodies })));
  }));
  if (modules.kind === "refused") return modules.stop;
  const preparedModules = modules.value;
  function* candidateRoots(): Generator<SyntaxRootSlot<CheckedPhase>> {
    for (const [position, prepared] of preparedModules.entries()) {
      for (const [ordinal, node] of prepared.module.checkedRoots.entries())
        yield { path: "HostProgram.modules[" + position + "].checked[" + ordinal + "]", read: () => node };
    }
  }
  const finalModules: ModuleBodies[] = [];
  let originalEvidence: ProgramEvidenceInput | null = null;
  const suppliedEvidence = (): ProgramEvidenceInput | null => originalEvidence;
  const roots = preparedModules.some(row => row.module.checkedRoots.length !== 0) ? candidateRoots() : null;
  const settlement = checkedContent<{ readonly kind: "evidence-input-stop"; readonly stop: DataflowStop }>(scan, rewrite, roots, candidate => {
    const checked = checkedChapterImage(candidate);
    for (const row of preparedModules) {
      const selected = row.module.materialize(checked, row.bodies);
      if (selected.kind === "refused") return selected;
      ready.trees.set(row.module.originalTree, row.module);
      finalModules.push(selected.value);
    }
    if (mode.kind !== "with-evidence") return copiedProjection(null);
    const supplied = mode.read(scan.meter.account);
    if (supplied.kind !== "complete") return { kind: "refused", stop: { kind: "evidence-input-stop", stop: supplied } };
    const admission = inventoryRecord(scan, 4);
    if (admission !== null) return { kind: "refused", stop: admission };
    originalEvidence = supplied.value;
    const sources = originalEvidence.checked;
    if (sources.length === 0) return copiedProjection(null);
    function* evidenceRoots(): Generator<SyntaxRootSlot<CheckedPhase>> {
      for (let position = 0; position < sources.length; position += 1)
        yield { path: "ProgramEvidence.checked[" + position + "].tree", read: () => requirePresent(sources[position], dense).tree };
    }
    return copiedProjection(evidenceRoots());
  });
  if (settlement.kind === "refused") return settlement.stop;
  const value = { index: index.value, modules: finalModules };
  const image: ProgramIdentityImage = {
    treeOf: source => ready.trees.get(source)?.tree() ?? null,
    tirOf: source => ready.tir.get(source) ?? null, mirOf: source => ready.mir.get(source) ?? null,
    factsOf: source => ready.facts.get(source) ?? null, observationsOf: source => ready.observations.get(source) ?? null,
    summaryOf: source => ready.summaries.get(source) ?? null, metadataOf: source => ready.metadata.get(source) ?? null,
    initializationOf: source => source === originalInitialization ? index.value.initialization : null,
  };
  const originals = suppliedEvidence();
  if (originals === null) return { kind: "complete", mode: "data-only", value, image };
  const evidence = projectEvidence(scan, rewrite, originals, settlement.value, ready.trees);
  if (evidence.kind === "refused") return evidence.stop;
  return { kind: "complete", mode: "with-evidence", value, image, evidence: evidence.value };
};

function checkedChapterImage(image: SyntaxImage<CheckedPhase> | null): CheckedChapterImage {
  return {
    expressionOf: source => {
      const result = image?.bodyRootOf(source);
      return requirePresent(result !== null && result?.kind !== "SourceFile" && result?.kind !== "Block" ? result : undefined, dense);
    },
    declarationOf: source => {
      const result = image?.statementOf(source);
      return requirePresent(result?.kind === "FunctionDeclaration" || result?.kind === "TypeAliasDeclaration" || result?.kind === "InterfaceDeclaration"
        ? result : undefined, dense);
    },
    sourceFileOf: source => requirePresent(image?.sourceFileOf(source) ?? undefined, dense),
  };
}

function inlineCheckedCycle(path: string): never {
  throw new TypeError("Inline cycle in checked Program TypeComponent at " + path);
}

function checkedContent<Stop>(scan: ProjectionInventory, rewrite: TypeReferenceRewrite, candidate: Iterable<SyntaxRootSlot<CheckedPhase>> | null,
  independent: (candidate: SyntaxImage<CheckedPhase> | null) =>
    SyntaxCopyResult<Iterable<SyntaxRootSlot<CheckedPhase>> | null, InstantiationStop | Stop>) {
  const work = () => chargeInstantiationWork(scan.meter);
  let cores: Map<HirCoreCapture, HirCoreCapture> | undefined;
  const core = (source: HirCoreCapture): ProjectionResult<HirCoreCapture> => projectRead(scan, () => {
    const prior = cores?.get(source);
    if (prior !== undefined) return copiedProjection(prior);
    return followingProjection(finishProjection(scan, prepareCoreProjection(scan, source, "CheckedModule.core", inlineCheckedCycle), rewrite), value => {
      if (cores === undefined) {
        const setup = inventoryRecord(scan, 0);
        if (setup !== null) return { kind: "refused", stop: setup };
        cores = new Map();
      }
      const retain = inventoryRecord(scan, 0);
      if (retain !== null) return { kind: "refused", stop: retain };
      cores.set(source, value);
      return copiedProjection(value);
    });
  });
  return projectCheckedContent<InstantiationStop, Stop>(candidate, { root: work, edge: work, node: work,
    parameter: () => admitCheckedProjection(scan.meter, 1, 1),
    structure: node => inventoryRecord(scan, 5) ?? inventoryRecord(scan, node.kind === "Block" ? 2 : 0),
    list: node => node.kind === "BinaryExpression" ? work() : inventoryRecord(scan, 2) }, {
    admit: (units, records) => admitCheckedProjection(scan.meter, units, records),
    syntaxNode: () => inventoryRecord(scan, 5),
    type: type => projectRead(scan, () => copiedProjection(rewrite.type(type))),
    signature: signature => projectRead(scan, () => copiedProjection(rewrite.signature(signature))),
    bindings: bindings => finishProjection(scan, prepareBindingsProjection(scan, bindings), rewrite),
    parameter: parameter => finishProjection(scan, prepareParameterProjection(scan, () => parameter), rewrite),
    component: component => finishProjection(scan,
      prepareComponentProjection(scan, component, "CheckedModule.component", inlineCheckedCycle), rewrite),
    core,
  }, independent);
}

function inventoryImage(scan: ProjectionInventory, rewrite: TypeReferenceRewrite, value: MemberInventory): ProjectionResult<MemberInventory> {
  return projectRecord(scan, 8, () => {
    const indexes = projectRows(scan, value.indexes, read => projectRecord(scan, 3, () => {
      const { origin, readonly, key } = read();
      return copiedProjection({ origin, readonly, key: rewrite.type(key) });
    }));
    if (indexes.kind === "refused") return indexes;
    const ordered = orderProjection(scan, indexes.value, (left, right) => {
      const owner = left.origin.kind === "body" ? left.origin.value.body : left.origin.value.owner;
      const other = right.origin.kind === "body" ? right.origin.value.body : right.origin.value.owner;
      const stop = chargeWork(scan.meter.account, owner.length + other.length);
      return stop === null ? copiedProjection(compareIndexSignatures(left, right)) : { kind: "refused", stop };
    });
    if (ordered.kind === "refused") return ordered;
    const signatures = (source: MemberInventory["calls"]) => followingProjection(
      projectRows(scan, source, read => projectRead(scan, () => copiedProjection(rewrite.signature(read())))),
      rows => orderProjection(scan, rows, (left, right) => copiedProjection(left - right)));
    const calls = signatures(value.calls);
    if (calls.kind === "refused") return calls;
    const constructs = signatures(value.constructs);
    if (constructs.kind === "refused") return constructs;
    const constructors = projectRows(scan, value.constructors, read => projectRecord(scan, 3, () => {
      const { signature, declaration, body } = read();
      return copiedProjection({ signature: rewrite.signature(signature), declaration, body });
    }));
    if (constructors.kind === "refused") return constructors;
    const orderedConstructors = orderProjection(scan, constructors.value, (left, right) => copiedProjection(left.signature - right.signature));
    if (orderedConstructors.kind === "refused") return orderedConstructors;
    const { members, accessors, completeness } = value;
    return copiedProjection({ receiver: rewrite.type(value.receiver), members, indexes: ordered.value,
      calls: calls.value, constructs: constructs.value, accessors, constructors: orderedConstructors.value, completeness });
  });
}

function memberImage(scan: ProjectionInventory, rewrite: TypeReferenceRewrite, read: () => ProgramMemberEvidence):
  ProjectionResult<ProgramMemberEvidence> {
  return projectRecord(scan, 3, () => {
    const row = read();
    const instance = projectInstance(scan, rewrite, row.instance);
    if (instance.kind === "refused") return instance;
    const occurrence = row.occurrence;
    const mapped = occurrence.kind === "selection" ? copiedProjection(occurrence) : projectRecord(scan, 6, () =>
      followingProjection(finishProjection(scan,
        prepareComponentProjection(scan, occurrence.destination, "ProgramEvidence.member.destination", inlineCheckedCycle), rewrite),
      destination => copiedProjection({ ...occurrence, destination })));
    if (mapped.kind === "refused") return mapped;
    const inventory = row.inventory;
    return followingProjection(inventory === null ? copiedProjection(null) : inventoryImage(scan, rewrite, inventory),
      inventory => copiedProjection({ instance: instance.value, occurrence: mapped.value, inventory }));
  });
}

function projectEvidence(scan: ProjectionInventory, rewrite: TypeReferenceRewrite, input: ProgramEvidenceInput,
  content: CheckedContentImage<InstantiationStop> | null,
  trees: ReadonlyMap<TirModule["tree"], PreparedModuleSyntax>): ProjectionResult<ProgramEvidence> {
  const checked = projectRows(scan, input.checked, read => projectRead(scan, () => requirePresent(content ?? undefined, dense).projectModule(read())));
  if (checked.kind === "refused") return checked;
  const members = projectRows(scan, input.members, read => memberImage(scan, rewrite, read));
  if (members.kind === "refused") return members;
  const signatures = projectRows(scan, input.signatures, read => projectRecord<ProgramEvidence["signatures"][number]>(scan, 2, () => {
    const row = read();
    const signature = rewrite.signature(row.signature.id);
    const request = row.request;
    if (request === null) return copiedProjection({ request: null, signature });
    return projectRecord(scan, 4, () =>
      followingProjection(finishProjection(scan, prepareArtifactBindings(scan, request.bindings), rewrite), bindings =>
        copiedProjection({ request: { ...request, bindings }, signature })));
  }));
  if (signatures.kind === "refused") return signatures;
  const storage = projectRows(scan, input.storage, read => projectRecord(scan, 2, () => {
    const { declaration, storage } = read();
    return copiedProjection({ declaration, storage: storage === null ? null : rewrite.type(storage) });
  }));
  if (storage.kind === "refused") return storage;
  let layoutOperands: NonNullable<ProgramEvidence["layoutOperands"]>[number][] | null = null;
  const operands = input.layoutOperands;
  if (operands !== null) for (let index = 0; index < operands.length; index += 1) {
    const read = chargeWork(scan.meter.account, 1);
    if (read !== null) return { kind: "refused", stop: read };
    const row = requirePresent(operands[index], dense);
    const root = trees.get(row.tree)?.layoutRootOf(row.root) ?? null;
    if (root === null) continue;
    const retained = inventoryRecord(scan, 2) ?? (layoutOperands === null ? inventoryRecord(scan, 0) : null);
    if (retained !== null) return { kind: "refused", stop: retained };
    const instance = projectInstance(scan, rewrite, row.instance);
    if (instance.kind === "refused") return instance;
    (layoutOperands ??= []).push({ instance: instance.value, root });
  }
  return copiedProjection({ checked: checked.value, members: members.value, signatures: signatures.value,
    storage: storage.value, layoutOperands });
}
