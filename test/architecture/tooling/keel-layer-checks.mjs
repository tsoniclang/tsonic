import { evaluateModuleLayerDependencies } from "./architecture-rules.mjs";
import { classifyFiles } from "./layer-classification.mjs";
import { canonicalTargetLayerPolicies, createTargetLayerRules } from "./target-layer-contract.mjs";
import { keelFinding, keelLayer, keelRoles, sortKeelFindings, validPath } from "./keel-contract.mjs";
import { keelSymbolIdentity } from "./keel-source-analysis.mjs";

export function evaluateKeelLayers(repo, model, census = {}, roleObligations = []) {
  const findings = [];
  const declarations = groupBy(model.declarations, keelSymbolIdentity);
  const metadataDeclarations = groupBy(model.typedDeclarations ?? [], entry => entry.file);
  const metadataSites = groupBy([...model.calls, ...model.accesses], entry => entry.file);
  const metadataFunctions = new Map(model.functions.map(entry => [keelSymbolIdentity(entry), entry]));
  const classifications = new Map();
  const obligations = new Map(roleObligations.map(entry => {
    requireReference(entry);
    if (!keelRoles.includes(entry.role)) throw new Error("Unknown required Keel semantic role.");
    return [keelSymbolIdentity(entry), entry];
  }));
  if (obligations.size !== roleObligations.length) throw new Error("Duplicate required Keel semantic-role obligation.");
  const exportedSelections = new Set(model.functions.filter(entry => entry.exported &&
    /^(?:select|choose)/u.test(entry.symbol.split(".").at(-1))).map(keelSymbolIdentity));
  const evidenceFor = entry => ({ bodySha256: entry.bodySha256 });
  const emit = (check, entry, reason, evidence = evidenceFor(entry)) => {
    findings.push(keelFinding(check, repo, entry.file, entry.symbol ?? entry.owner, reason, {
      ...evidenceFor(entry), ...evidence,
      ...(Number.isSafeInteger(entry.offset) ? { offset: entry.offset } : {}),
      ...(typeof entry.kind === "string" ? { kind: entry.kind } : {}),
    }));
  };

  for (const entry of model.selectionExports ?? []) {
    if (entry.target === undefined) {
      emit("AC1", entry, "An exported select/choose callable has no exact checked declaration.", {});
    } else if (entry.target.file.startsWith("src/")) {
      const id = keelSymbolIdentity(entry.target);
      if (!model.functions.some(declaration => keelSymbolIdentity(declaration) === id)) {
        emit("AC1", entry, "An exported select/choose callable has no current authored implementation.", { target: id });
      } else {
        exportedSelections.add(id);
      }
    }
  }

  for (const entry of census.functions ?? []) {
    requireReference(entry);
    const id = keelSymbolIdentity(entry);
    if (!keelRoles.includes(entry.role) || classifications.has(id) ||
      !/^[a-f0-9]{64}$/u.test(entry.bodySha256) || !Array.isArray(entry.evidence) || entry.evidence.length === 0) {
      throw new Error(`Invalid or duplicate Keel function classification '${id}'.`);
    }
    const candidates = (declarations.get(id) ?? []).filter(declaration =>
      model.functions.includes(declaration));
    if (candidates.length !== 1 || candidates[0].bodySha256 !== entry.bodySha256) {
      emit("AC1", entry, "Reviewed function classification is missing, ambiguous or stale.");
      continue;
    }
    const declaration = candidates[0];
    if (!entry.evidence.every(item => evidenceExists(item, declaration))) {
      emit("AC1", entry, "Function classification has no exact current structural evidence.");
      continue;
    }
    classifications.set(id, entry.role);
    const replaced = new Set();
    for (const previous of entry.replaces ?? []) {
      requireReference(previous);
      const identity = keelSymbolIdentity(previous);
      if (!obligations.has(identity) || replaced.has(identity)) {
        emit("AC1", entry, "Source correspondence must identify a unique immutable semantic-role obligation.");
      }
      replaced.add(identity);
    }
  }

  for (const [id, obligation] of obligations) {
    const matched = (census.functions ?? []).filter(entry => keelSymbolIdentity(entry) === id ||
      entry.replaces?.some(previous => keelSymbolIdentity(previous) === id));
    if (matched.length !== 1 || classifications.get(keelSymbolIdentity(matched[0])) !== obligation.role) {
      emit("AC1", obligation,
        "A reviewed semantic-role obligation requires one exact current source correspondence with its unchanged role; renaming or deleting a census row cannot close it.");
    }
  }

  for (const entry of model.functions) {
    const layer = keelLayer(entry.file);
    const role = classifications.get(keelSymbolIdentity(entry));
    if (role === "selection" && layer !== "policy") {
      emit(layer?.startsWith("backend/") ? "AC2" : "AC1", entry, "Per-construct native selection is owned by policy.");
    } else if (exportedSelections.has(keelSymbolIdentity(entry)) && role === undefined) {
      emit(layer?.startsWith("backend/") ? "AC2" : "AC1", entry,
        "An exported select/choose callable requires an exact current reviewed semantic-role classification; its name discovers a candidate, not its owner.");
    }
    if (role === "analysis" && layer !== "analysis") {
      emit(layer?.startsWith("backend/") ? "AC2" : "AC1", entry, "Cross-construct computation is owned by analysis.");
    }
    if (role === "provider-metadata") {
      const check = layer?.startsWith("backend/") ? "AC2" : "AC1";
      if (!entry.file.startsWith("src/providers/native/")) {
        emit(check, entry, "Native provider metadata processing is owned by providers/native.");
      }
      const boundaries = [entry.symbol, ...entry.parameters.map(name => `${entry.symbol}.${name}`)]
        .map(symbol => metadataDeclarations.get(entry.file)?.find(candidate => candidate.symbol === symbol));
      const references = boundaries.flatMap(boundary => boundary?.through ?? []);
      const output = boundaries[0]?.through ?? [];
      if (boundaries.some(boundary => boundary === undefined) ||
        !output.some(reference => !reference.file.startsWith("libraries/")) ||
        !providerMetadataReferences(references, metadataDeclarations)) {
        emit(check, entry, "Native provider metadata requires metadata-only inputs and provider model data output.");
      }
      const pending = [entry];
      const visited = new Set();
      while (pending.length > 0) {
        const current = pending.pop();
        const identity = keelSymbolIdentity(current);
        if (visited.has(identity)) continue;
        visited.add(identity);
        for (const site of (metadataSites.get(current.file) ?? []).filter(candidate =>
          candidate.owner === current.symbol || candidate.owner.startsWith(`${current.symbol}.`))) {
          const references = [site.target, site.expressionTarget, ...(site.through ?? []), ...(site.receiverThrough ?? [])]
            .filter(reference => reference !== undefined);
          if (!providerMetadataReferences(references, metadataDeclarations) || references.some(reference =>
            ["selection", "analysis", "syntax", "planner-invariant"].includes(classifications.get(keelSymbolIdentity(reference))))) {
            emit(check, entry, "Native provider metadata cannot read checked source or invoke policy, analysis or target syntax decisions.");
          }
          if (site.target !== undefined) {
            const callee = metadataFunctions.get(keelSymbolIdentity(site.target));
            if (callee !== undefined) pending.push(callee);
          }
        }
      }
    }
    if (role === "sealed-reader" && !entry.file.startsWith("src/analysis/program/records/") &&
      !entry.file.startsWith("src/policy/model/")) {
      emit("AC3", entry, "Sealed-record readers have one analysis/program/records owner.");
    }
  }

  const ownedFiles = model.moduleFiles ?? [...new Set(model.declarations.map(entry => entry.file)
    .filter(file => file.startsWith("src/")))];
  const layers = classifyFiles(ownedFiles, createTargetLayerRules(census));
  for (const finding of [...layers.findings, ...evaluateModuleLayerDependencies({
    edges: model.edges, classifications: layers.classifications, layerPolicies: canonicalTargetLayerPolicies,
  })]) findings.push(keelFinding(finding.source.startsWith("src/backend/") ? "AC2" : "AC1", repo,
    finding.source, finding.target ?? finding.source, finding.reason, { rule: finding.ruleId }));

  const lazyQueries = referenceSet(census.lazyQueries ?? [], "lazy query");
  const keyReaders = referenceSet(census.keyReaders ?? [], "key reader");
  const keyWriters = referenceSet(census.keyWriters ?? [], "key writer");
  const keyDefinitions = referenceSet(census.keyDefinitions ?? [], "key definition");
  const recordWriters = referenceSet(census.recordWriters ?? [], "record writer");
  const recordReaders = referenceSet(census.recordReaders ?? [], "record reader");
  const recordRoots = referenceSet(census.recordRoots ?? [], "record boundary");
  for (const entry of model.declarations) {
    if (!entry.file.startsWith("src/target-model/records/") && !entry.file.startsWith("src/analysis/program/records/")) continue;
    if (entry.kind !== "KindMethodSignature" && entry.functionProperty !== true) continue;
    const name = entry.symbol.split(".").at(-1);
    if (name === "get") recordReaders.add(keelSymbolIdentity(entry));
    if (name === "set") recordWriters.add(keelSymbolIdentity(entry));
  }
  if (census.programType !== undefined) {
    requireReference(census.programType);
    const records = { ...census.programType, symbol: `${census.programType.symbol}.records` };
    if (declarations.has(keelSymbolIdentity(records))) recordRoots.add(keelSymbolIdentity(records));
    else emit("AC3", census.programType, "The sealed target program has no exact records API boundary.", {});
  }
  const diagnosticSinks = referenceSet(census.diagnosticSinks ?? [], "diagnostic sink");
  const diagnosticCodeFields = referenceSet(census.diagnosticCodeFields ?? [], "diagnostic code field");
  const diagnosticTypes = new Set([...diagnosticCodeFields].map(id => id.slice(0, id.lastIndexOf("."))));
  for (const entry of model.typedDeclarations ?? []) {
    if (!["KindPropertySignature", "KindPropertyDeclaration"].includes(entry.kind)) continue;
    if (!Array.isArray(entry.receiverThrough)) throw new Error("Keel property evidence requires checked receiver provenance.");
    if (entry.receiverThrough.some(reference =>
      diagnosticTypes.has(keelSymbolIdentity(reference)))) diagnosticSinks.add(keelSymbolIdentity(entry));
  }
  const diagnosticCalls = referenceSet(census.diagnosticCalls ?? [], "diagnostic producer");
  const invariants = referenceSet(census.invariantHelpers ?? [], "planner invariant");
  if (invariants.size > 1) throw new Error("Backend invariants require a single owning helper.");
  for (const entry of census.invariantHelpers ?? []) {
    if (entry.file !== "src/backend/planner/diagnostics.ts" || !model.functions.some(declaration =>
      declaration.file === entry.file && declaration.symbol === entry.symbol)) {
      emit("AC4", entry, "The registered invariant helper has no body at the single canonical planner owner.", {});
    }
  }
  const cloneFields = referenceSet(census.cloneFields ?? [], "native AST clone field");
  const syntaxRoots = new Set([...cloneFields].map(id => id.slice(0, id.lastIndexOf("."))));
  const externalBoundaries = new Map();
  for (const entry of census.externalBoundaryTypes ?? []) {
    requireReference(entry);
    if (!["records", "diagnostics", "syntax"].includes(entry.kind)) throw new Error("Unknown external boundary kind.");
    const id = keelSymbolIdentity(entry);
    if (externalBoundaries.has(id)) throw new Error(`Duplicate external boundary '${id}'.`);
    externalBoundaries.set(id, entry.kind);
  }
  for (const [label, references] of [
    ["lazy query", lazyQueries], ["key reader", keyReaders], ["key writer", keyWriters],
    ["key definition", keyDefinitions], ["record writer", recordWriters],
    ["record reader", recordReaders], ["record boundary", recordRoots], ["diagnostic sink", diagnosticSinks],
    ["diagnostic code field", diagnosticCodeFields],
    ["diagnostic producer", diagnosticCalls], ["planner invariant", invariants],
    ["native AST clone field", cloneFields],
  ]) {
    for (const id of references) {
      if (!declarations.has(id)) {
        const separator = id.indexOf("#");
        findings.push(keelFinding("AC1", repo, id.slice(0, separator), id.slice(separator + 1),
          `Registered ${label} has no current declaration.`));
      }
    }
  }
  for (const id of lazyQueries) {
    if (classifications.get(id) !== "analysis") {
      const separator = id.indexOf("#");
      findings.push(keelFinding("AC2", repo, id.slice(0, separator), id.slice(separator + 1),
        "A lazy query requires a current reviewed analysis classification."));
    }
  }

  for (const site of [...model.calls, ...model.accesses]) {
    const target = site.target === undefined ? undefined : keelSymbolIdentity(site.target);
    const backend = site.file.startsWith("src/backend/");
    const targetLayer = site.target === undefined ? undefined : keelLayer(site.target.file);
    const unprovedAnalysisCall = site.kind === "call" && targetLayer === "analysis" &&
      !recordReaders.has(target) && classifications.get(target) !== "sealed-reader" &&
      !invariants.has(target);
    const semanticQuery = lazyQueries.has(target) || classifications.get(target) === "selection" ||
      site.kind === "call" && targetLayer === "policy" && !recordReaders.has(target) &&
      classifications.get(target) !== "sealed-reader";
    if (backend && site.file !== "src/backend/compile.ts" && (semanticQuery || unprovedAnalysisCall)) {
      emit("AC2", site, semanticQuery ? "Backend consumes sealed records, not native selectors or lazy analysis."
        : "An analysis callable consumed after sealing has no exact sealed-reader contract; location alone does not prove laziness.", {
        target, bodySha256: site.bodySha256,
      });
    }
    if ((keyReaders.has(target) || keyWriters.has(target) || keyDefinitions.has(target)) &&
      !site.file.startsWith("src/analysis/program/records/")) {
      emit("AC3", site, "Generic keyed storage is private to the single records owner.", { target });
    }
    if (recordWriters.has(target) && !site.file.startsWith("src/analysis/")) {
      emit("AC3", site, "Only analysis constructs or mutates target records.", { target });
    }
    if (backend && diagnosticCalls.has(target) && !invariants.has(`${site.file}#${site.owner}`)) {
      emit("AC4", site, "Backend diagnostic construction bypasses the single invariant helper.", { target });
    }
    const origins = site.through ?? [];
    const throughRecord = origins.some(reference => recordRoots.has(keelSymbolIdentity(reference)) ||
      externalBoundaries.get(keelSymbolIdentity(reference)) === "records");
    if (!Array.isArray(site.receiverThrough)) throw new Error("Keel call/access evidence requires checked receiver provenance.");
    const throughDiagnostics = site.receiverThrough.some(reference => diagnosticTypes.has(keelSymbolIdentity(reference)) ||
      diagnosticSinks.has(keelSymbolIdentity(reference)) ||
      externalBoundaries.get(keelSymbolIdentity(reference)) === "diagnostics");
    const callable = site.target === undefined ? false : (declarations.get(target) ?? []).some(entry =>
      ["KindMethodSignature", "KindMethodDeclaration", "KindFunctionDeclaration", "KindFunctionExpression", "KindArrowFunction"].includes(entry.kind));
    if ((site.kind === "call" || callable) && throughDiagnostics && backend && !invariants.has(`${site.file}#${site.owner}`)) {
      emit("AC4", site, "Backend cannot invoke a diagnostic sink, including through an aliased or unresolved collection method.", { target });
    }
    if (throughRecord && target === undefined && (site.kind === "call" || site.access.length > 1)) {
      emit("AC3", site, "A sensitive record boundary has no exact checked declaration; missing imports cannot bypass ownership.");
    }
  }
  for (const site of model.objectFields ?? []) {
    if (!site.file.startsWith("src/backend/") || site.target === undefined ||
      !diagnosticCodeFields.has(keelSymbolIdentity(site.target))) continue;
    if (!invariants.has(`${site.file}#${site.owner}`) || site.literal !== "TSONIC_INTERNAL_PLANNER_INVARIANT") {
      emit("AC4", site, "Backend diagnostic values must carry the fixed internal-invariant code and originate at its single owner.");
    }
  }

  for (const entry of model.functions) {
    if (classifications.get(keelSymbolIdentity(entry)) !== "sealed-reader" || !entry.file.startsWith("src/policy/model/")) continue;
    const sites = model.calls.filter(site => site.file === entry.file && site.owner === entry.symbol);
    const hasReader = sites.some(site => site.target !== undefined && recordReaders.has(keelSymbolIdentity(site.target)));
    const onlyReaders = sites.every(site => site.target !== undefined && recordReaders.has(keelSymbolIdentity(site.target)));
    if (!hasReader || !onlyReaders || [...model.loops, ...model.throws, ...(model.mutations ?? [])].some(site =>
      site.file === entry.file && site.owner === entry.symbol)) {
      emit("AC3", entry, "The policy-context port may only delegate to exact sealed readers; it cannot compute, mutate or reject.");
    }
  }
  for (const reference of census.keyTypes ?? []) {
    requireReference(reference);
    const id = keelSymbolIdentity(reference);
    if (!declarations.has(id)) {
      emit("AC3", reference, "The registered private generic key type has no current declaration.", {});
      continue;
    }
    for (const edge of model.edges) {
      if (edge.target === reference.file && !edge.source.startsWith("src/analysis/program/records/") &&
        edge.source !== reference.file) {
        findings.push(keelFinding("AC3", repo, edge.source, id,
          "Cross-layer imports cannot expose the private keyed-store vocabulary."));
      }
    }
  }

  for (const site of model.throws) {
    if (site.file.startsWith("src/backend/") && !invariants.has(`${site.file}#${site.owner}`)) {
      emit("AC4", site, "Backend throws must originate from the registered internal-invariant owner.");
    }
  }
  for (const site of model.comparisons) {
    if (!site.file.startsWith("src/backend/") || repo !== "tsonic-rust") continue;
    if (!["KindEqualsEqualsToken", "KindEqualsEqualsEqualsToken", "KindExclamationEqualsToken", "KindExclamationEqualsEqualsToken", "case"].includes(site.operator)) continue;
    const sides = [[site.left, site.right], [site.right, site.left]];
    if (sides.some(([member, literal]) => literal.literal === "clone" &&
      member.target !== undefined && cloneFields.has(keelSymbolIdentity(member.target)))) {
      emit("AC5", site, "Native AST clone inspection must not reconsider sealed ownership.");
    }
    if (sides.some(([member, literal]) => literal.literal === "clone" && member.target === undefined &&
      member.through?.some(reference => syntaxRoots.has(keelSymbolIdentity(reference)) ||
        externalBoundaries.get(keelSymbolIdentity(reference)) === "syntax"))) {
      emit("AC5", site, "Clone inspection has missing native AST declaration evidence; unresolved imports do not waive the boundary.");
    }
  }

  const localTraversals = new Map();
  for (const entry of census.localTraversals ?? []) {
    requireReference(entry);
    const id = `${keelSymbolIdentity(entry)}:${entry.offset}`;
    if (localTraversals.has(id) || !Number.isSafeInteger(entry.offset) || entry.offset < 0 ||
      typeof entry.reason !== "string" || entry.reason.length === 0 ||
      !/^[a-f0-9]{64}$/u.test(entry.bodySha256) || typeof entry.subjectParameter !== "string") {
      throw new Error(`Invalid local traversal '${id}'.`);
    }
    localTraversals.set(id, entry);
  }
  for (const loop of model.loops) {
    if (keelLayer(loop.file) !== "policy") continue;
    const id = `${loop.file}#${loop.owner}:${loop.offset}`;
    const reviewed = localTraversals.get(id);
    const owner = declarations.get(`${loop.file}#${loop.owner}`)?.find(entry => model.functions.includes(entry));
    if (reviewed === undefined || reviewed.bodySha256 !== loop.bodySha256 ||
      owner === undefined || !owner.parameters.includes(reviewed.subjectParameter) ||
      classifications.get(`${loop.file}#${loop.owner}`) === "analysis") {
      emit("AC6", loop, "Policy traversal lacks exact reviewed construct-local scope evidence.");
    }
    localTraversals.delete(id);
  }
  for (const entry of localTraversals.values()) {
    emit("AC6", entry, "Reviewed local traversal no longer identifies a policy loop.");
  }
  return sortKeelFindings(findings);

  function evidenceExists(evidence, declaration) {
    if (evidence.kind === "parameter") return declaration.parameters.includes(evidence.name);
    if (evidence.kind === "loop") return model.loops.some(loop =>
      loop.file === declaration.file && loop.owner === declaration.symbol && loop.offset === evidence.offset);
    if (evidence.kind === "import") return model.edges.some(edge =>
      edge.source === declaration.file && edge.target === evidence.file);
    if (evidence.kind === "call") {
      requireReference(evidence);
      return model.calls.some(call => call.file === declaration.file && call.owner === declaration.symbol &&
        call.target !== undefined && keelSymbolIdentity(call.target) === keelSymbolIdentity(evidence));
    }
    return false;
  }
}

function providerMetadataReferences(references, declarations) {
  const pending = [...references];
  const visited = new Set();
  while (pending.length > 0) {
    const reference = pending.pop();
    const identity = keelSymbolIdentity(reference);
    if (visited.has(identity)) continue;
    visited.add(identity);
    if (!providerMetadataReference(reference)) return false;
    for (const declaration of declarations.get(reference.file) ?? []) {
      if (declaration.symbol === reference.symbol ||
        declaration.symbol.startsWith(`${reference.symbol}.`)) {
        pending.push(...(declaration.through ?? []));
      }
    }
  }
  return true;
}

function providerMetadataReference(reference) {
  if (reference.file.startsWith("libraries/") || reference.file.startsWith("src/providers/native/") ||
    ["identities", "metadata", "types", "operations", "conversions", "lifetimes"]
      .some(family => reference.file.startsWith(`src/target-model/${family}/`))) return true;
  return reference.file === "external/tsonic/packages/tsts/dist/src/extensions/host.d.ts" &&
    providerDeclarationMetadata.has(reference.symbol.split(".")[0]);
}

const providerDeclarationMetadata = new Set([
  "ExtensionEvidence", "ProviderIdentity", "ProviderDeclarationKind", "ProviderExportKind",
  "ProviderTypeFamilyDeclaration", "ProviderPropertyName", "ProviderTypeParameterDeclaration",
  "ProviderTypeExpression", "ProviderParameterDeclaration", "ProviderSignatureDeclaration",
  "ProviderMemberDeclaration", "ProviderExportDeclaration", "ProviderImportDeclaration",
  "ProviderHeritageDeclaration", "ProviderDeclarationModel", "ProviderRequestedExport",
]);

function requireReference(reference) {
  if (!validPath(reference.file) || typeof reference.symbol !== "string" || reference.symbol.length === 0 ||
    /[*?\[\]{}]/u.test(reference.symbol)) throw new Error("Keel references must identify exact authored declarations.");
}

function referenceSet(references, label) {
  const result = new Set();
  for (const reference of references) {
    requireReference(reference);
    const id = keelSymbolIdentity(reference);
    if (result.has(id)) throw new Error(`Duplicate ${label} '${id}'.`);
    result.add(id);
  }
  return result;
}

function groupBy(entries, keyFor) {
  const result = new Map();
  for (const entry of entries) {
    const key = keyFor(entry);
    const group = result.get(key) ?? [];
    group.push(entry);
    result.set(key, group);
  }
  return result;
}
