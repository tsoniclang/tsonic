import { lineCount } from "./file-inventory.mjs";
import { stronglyConnectedComponents } from "./strongly-connected-components.mjs";

export function evaluateArchitecture({
  sourceFiles,
  edges,
  classifications,
  forbiddenLayerEdges = [],
  layerPolicies = [],
  forbiddenPackages = [],
  packageLayers = [],
  forbiddenDirectories = [],
  rootPolicies = [],
  sourceRules = [],
  softLineLimit = 700,
  hardLineLimit = 900,
  lineLimitExceptions = new Map(),
}) {
  const findings = [...evaluateModuleLayerDependencies({
    edges, classifications, forbiddenLayerEdges, layerPolicies, forbiddenPackages, packageLayers,
  })];

  for (const [file, text] of sourceFiles) {
    for (const rule of sourceRules) {
      if (rule.matches(file, text)) {
        findings.push(finding(
          rule.ruleId,
          file,
          undefined,
          rule.reason,
        ));
      }
    }
  }

  for (const directory of forbiddenDirectories) {
    for (const file of sourceFiles.keys()) {
      if (file.split("/").includes(directory)) {
        findings.push(finding(
          "ARCH-NO-VAGUE-ROOT-001",
          file,
          undefined,
          `Product source uses forbidden ownership sink '${directory}/'.`,
        ));
      }
    }
  }

  for (const policy of rootPolicies) {
    for (const file of sourceFiles.keys()) {
      if (
        file.startsWith(policy.prefix) &&
        file.slice(policy.prefix.length).includes("/") === false &&
        !policy.allowed.has(file)
      ) {
        findings.push(finding(
          "ARCH-DIRECTORY-001",
          file,
          undefined,
          `Implementation file is not an approved entrypoint at '${policy.prefix}'.`,
        ));
      }
    }
  }

  const lineReports = [];
  for (const [file, text] of sourceFiles) {
    const lines = lineCount(text);
    if (lines > softLineLimit) {
      lineReports.push(Object.freeze({ file, lines }));
    }
    const exception = lineLimitExceptions.get(file);
    if (lines > hardLineLimit && !validLineLimitException(exception, lines)) {
      findings.push(finding(
        "ARCH-FILE-SIZE-001",
        file,
        undefined,
        `Authored source has ${lines} lines; hard limit is ${hardLineLimit}.`,
      ));
    }
  }

  const components = stronglyConnectedComponents(sourceFiles.keys(), edges);
  for (const component of components) {
    if (component.length < 2) {
      continue;
    }
    const layers = new Set(component.map((file) => classifications.get(file)));
    if (layers.size > 1) {
      findings.push(finding(
        "ARCH-CYCLE-001",
        component[0],
        component.at(-1),
        `Import cycle crosses layers ${[...layers].sort().join(", ")}: ${component.join(" -> ")}.`,
      ));
    }
  }

  return Object.freeze({
    findings: Object.freeze(sortFindings(findings)),
    lineReports: Object.freeze(
      lineReports.sort((left, right) => right.lines - left.lines || left.file.localeCompare(right.file)),
    ),
    components,
  });
}

export function evaluateModuleLayerDependencies({
  edges,
  classifications,
  forbiddenLayerEdges = [],
  layerPolicies = [],
  forbiddenPackages = [],
  packageLayers = [],
}) {
  const findings = [];
  for (const edge of edges) {
    if (edge.unresolved) {
      findings.push(finding(
        "ARCH-MODULE-001",
        edge.source,
        undefined,
        `Relative module '${edge.specifier}' does not resolve to exactly one authored source file.`,
      ));
      continue;
    }
    if (edge.kind === "package") {
      const forbidden = forbiddenPackages.find((entry) =>
        edge.specifier === entry.prefix || edge.specifier.startsWith(`${entry.prefix}/`)
      );
      if (forbidden !== undefined) {
        findings.push(finding(
          forbidden.ruleId,
          edge.source,
          edge.specifier,
          forbidden.reason,
        ));
      }
      const packageLayer = packageLayers.find((entry) =>
        edge.specifier === entry.prefix || edge.specifier.startsWith(`${entry.prefix}/`)
      )?.layer;
      const sourceLayer = classifications.get(edge.source);
      const layerPolicy = layerPolicies.find((rule) => rule.source === sourceLayer);
      if (
        forbidden === undefined &&
        packageLayer !== undefined &&
        sourceLayer !== packageLayer &&
        layerPolicy !== undefined &&
        !layerPolicy.allowed.has(packageLayer)
      ) {
        findings.push(finding(
          layerPolicy.ruleId,
          edge.source,
          edge.specifier,
          layerPolicy.reason,
        ));
      }
      continue;
    }
    const sourceLayer = classifications.get(edge.source);
    const targetLayer = classifications.get(edge.target);
    const layerPolicy = layerPolicies.find((rule) =>
      rule.source === sourceLayer
    );
    if (
      sourceLayer !== targetLayer &&
      layerPolicy !== undefined &&
      !layerPolicy.allowed.has(targetLayer)
    ) {
      findings.push(finding(
        layerPolicy.ruleId,
        edge.source,
        edge.target,
        layerPolicy.reason,
      ));
      continue;
    }
    const blocked = forbiddenLayerEdges.find((rule) =>
      rule.source === sourceLayer && rule.targets.includes(targetLayer)
    );
    if (blocked !== undefined) {
      findings.push(finding(
        blocked.ruleId,
        edge.source,
        edge.target,
        blocked.reason,
      ));
    }
  }
  return Object.freeze(sortFindings(findings));
}

export function evaluateBarrelModules(
  modules,
  {
    allowedImplementationFiles = new Set(),
    allowedKinds = new Set(["KindImportDeclaration", "KindExportDeclaration"]),
  } = {},
) {
  const findings = [];
  for (const module of modules) {
    if (
      module.file.split("/").at(-1) !== "index.ts" ||
      allowedImplementationFiles.has(module.file)
    ) {
      continue;
    }
    const implementationKinds = module.topLevelKinds.filter((kind) => !allowedKinds.has(kind));
    if (implementationKinds.length > 0) {
      findings.push(finding(
        "ARCH-INDEX-001",
        module.file,
        undefined,
        `Barrel contains implementation declarations: ${[...new Set(implementationKinds)].sort().join(", ")}.`,
      ));
    }
  }
  return Object.freeze(sortFindings(findings));
}

export function evaluateModuleLiveness({ modules, edges, entrypoints }) {
  const known = new Set(modules.map(module => module.file));
  const dependencies = new Map([...known].map(file => [file, []]));
  for (const edge of edges) {
    if (known.has(edge.source) && known.has(edge.target)) dependencies.get(edge.source).push(edge.target);
  }
  const findings = entrypoints.filter(file => !known.has(file)).map(file => finding(
    "ARCH-MODULE-ENTRY-001", file, undefined, "Declared product entrypoint is missing from the checked source domain."));
  const reachable = new Set();
  const pending = entrypoints.filter(file => known.has(file));
  while (pending.length > 0) {
    const file = pending.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    pending.push(...dependencies.get(file));
  }
  for (const file of known) {
    if (!reachable.has(file)) findings.push(finding(
      "ARCH-MODULE-LIVENESS-001", file, undefined, "Product module has no path from a declared public entrypoint."));
  }
  return Object.freeze(sortFindings(findings));
}

export function evaluateFunctionLiveness({ modules, readers, entrypoints }) {
  if (!Array.isArray(readers)) throw new Error("Function liveness requires its checked reader-module inventory.");
  for (const module of [...modules, ...readers]) {
    if (!Array.isArray(module.functionExports) || !Array.isArray(module.functionReads))
      throw new Error(`Module requires its checked function-use inventory: ${module.file}`);
  }
  const byFile = new Map(modules.map(module => [module.file, module]));
  const publicFunctions = new Set(entrypoints.flatMap(file => {
    const module = byFile.get(file);
    if (module === undefined) throw new Error(`Missing function-liveness entrypoint: ${file}`);
    return module.functionExports;
  }));
  const reads = new Set([...modules, ...readers].flatMap(module => module.functionReads));
  return Object.freeze([...new Set(modules.flatMap(module => module.functionExports))]
    .filter(identity => !publicFunctions.has(identity) && !reads.has(identity)).sort()
    .map(identity => finding("ARCH-FUNCTION-LIVENESS-001", identity.slice(0, identity.lastIndexOf("#")), identity,
      "Exported function has no checked product/test reader or transitive public export; registry strings are not execution consumers.")));
}

export function evaluateSelfBarrelImports({ modules, edges }) {
  const runtime = new Map(modules.map(module => {
    if (!Array.isArray(module.runtimeSpecifiers)) throw new Error(`Module requires its checked runtime-specifier inventory: ${module.file}`);
    return [module.file, new Set(module.runtimeSpecifiers)];
  }));
  const runtimeEdges = edges.filter(edge => {
    const specifiers = runtime.get(edge.source);
    if (specifiers === undefined) throw new Error(`Foreign runtime module edge: ${edge.source}`);
    return edge.kind === "relative" && runtime.has(edge.target) && specifiers.has(edge.specifier);
  });
  const components = stronglyConnectedComponents(runtime.keys(), runtimeEdges);
  const componentFor = new Map(components.flatMap((component, index) => component.map(file => [file, index])));
  const findings = [];
  for (const edge of runtimeEdges) {
    if ((edge.target !== "index.ts" && !edge.target.endsWith("/index.ts")) ||
      edge.source.slice(0, edge.source.lastIndexOf("/")) !== edge.target.slice(0, edge.target.lastIndexOf("/"))) continue;
    if (componentFor.get(edge.source) === componentFor.get(edge.target)) findings.push(finding("ARCH-SELF-BARREL-001", edge.source, edge.target,
      "Runtime import enters the module's own re-exporting barrel; import the actual owning leaf instead."));
  }
  return Object.freeze(sortFindings(findings));
}

function validLineLimitException(exception, lines) {
  return exception !== undefined &&
    Number.isSafeInteger(exception.maximumLines) &&
    exception.maximumLines >= lines &&
    typeof exception.owner === "string" &&
    exception.owner.length > 0 &&
    typeof exception.reason === "string" &&
    exception.reason.length > 0 &&
    /^\d{4}-\d{2}-\d{2}$/u.test(exception.reviewDate);
}

export function finding(ruleId, source, target, reason) {
  return Object.freeze({ ruleId, source, target, reason });
}

export function formatArchitectureFindings(findings) {
  return findings.map((entry) => [
    entry.ruleId,
    `source: ${entry.source}`,
    ...(entry.target === undefined ? [] : [`target: ${entry.target}`]),
    `reason: ${entry.reason}`,
  ].join("\n")).join("\n\n");
}

export function sortFindings(findings) {
  return findings.sort((left, right) =>
    left.ruleId.localeCompare(right.ruleId) ||
    left.source.localeCompare(right.source) ||
    (left.target ?? "").localeCompare(right.target ?? "")
  );
}
