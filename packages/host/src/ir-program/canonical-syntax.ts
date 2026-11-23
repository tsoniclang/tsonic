import type { SyntaxCopyResult, SyntaxRootSlot } from "../ir-hir/contract.js";
import type { TirBody, TypedPhase } from "../ir-tir/contract.js";
import type { InstantiationStop } from "./work.js";
import type { PreparedTypedSyntax } from "./instantiate-syntax.js";
import { prepareTypedForest } from "./instantiate-syntax.js";
import type { AdmittedTirSyntax } from "./instantiate-tir.js";
import { inventoryTirBody } from "./instantiate-tir.js";
import type { ModuleBodies, PublishedBody } from "./contract.js";
import type { TypeReferenceRewrite } from "./canonical-types.js";
import { projectBodyFacts, projectInstance, projectObservations } from "./canonical-facts.js";
import { projectMirBody } from "./canonical-tir.js";
import type { ProjectionInventory, ProjectionResult } from "./program-values.js";
import { copiedProjection, projectRead, projectRecord, projectRows } from "./program-values.js";
import type { InvariantFailure } from "../diag/contract.js";
import { requirePresent } from "../diag/index.js";
import { typedSyntaxPhaseCopy } from "./canonical-phase.js";

const missingSyntax: InvariantFailure = { owner: "ir-program", query: null, origin: null,
  message: "A syntax chapter can only project a node from its admitted forest." };

export function rewriteBodySyntax(
  rewrite: TypeReferenceRewrite, roots: AdmittedTirSyntax, syntax: PreparedTypedSyntax,
): SyntaxCopyResult<Pick<TirBody, "root" | "params">, InstantiationStop> {
  const projected = syntax.materialize(rewrite);
  if (projected.kind === "refused") return projected;
  const image = projected.value;
  for (const [index, parameter] of roots.params.entries())
    roots.params[index] = requirePresent(image.parameterOf(parameter) ?? undefined, missingSyntax);
  return { kind: "copied", value: { root: requirePresent(image.bodyRootOf(roots.root) ?? undefined, missingSyntax), params: roots.params } };
}

export function projectModuleSyntax(scan: ProjectionInventory, rewrite: TypeReferenceRewrite, module: ModuleBodies, at: string,
  remember: (source: PublishedBody, projected: PublishedBody) => InstantiationStop | null,
): ProjectionResult<ModuleBodies & { readonly bodies: PublishedBody[] }> {
  return projectRecord(scan, 3, () => {
    const rows = projectRows(scan, module.bodies, read => projectRecord(scan, 3, () => {
      const source = read();
      const instance = projectInstance(scan, rewrite, source.instance);
      if (instance.kind === "refused") return instance;
      const body = inventoryTirBody(scan, source.tir);
      if (body.kind !== "complete") return { kind: "refused", stop: body };
      return copiedProjection({ source, instance: instance.value, body: body.value });
    }));
    if (rows.kind === "refused") return rows;
    const admittedRows = rows.value;
    const originalTree = module.tree;
    function* slots(): Generator<SyntaxRootSlot<TypedPhase>> {
      yield { read: () => originalTree, path: at + ".tree" };
      for (const [position, { body }] of admittedRows.entries()) {
        const path = at + ".bodies[" + position + "].tir";
        yield { read: () => body.roots.root, path: path + ".root" };
        for (const [index, parameter] of body.roots.params.entries())
          yield { read: () => parameter, path: path + ".params[" + index + "]" };
      }
    }
    const syntax = prepareTypedForest(scan, slots(), typedSyntaxPhaseCopy(scan, at));
    if (syntax.kind !== "complete") return { kind: "refused", stop: syntax };
    const completed = syntax.value.materialize(rewrite);
    if (completed.kind === "refused") return completed;
    const image = completed.value;
    const bodies: PublishedBody[] = [];
    for (const [position, { source, instance, body }] of admittedRows.entries()) {
      const roots = body.roots;
      for (const [index, parameter] of roots.params.entries())
        roots.params[index] = requirePresent(image.parameterOf(parameter) ?? undefined, missingSyntax);
      const root = requirePresent(image.bodyRootOf(roots.root) ?? undefined, missingSyntax);
      const tir = body.project(rewrite, root, roots.params, instance.bindings);
      let selected: PublishedBody;
      if (source.kind === "template") selected = { kind: "template", instance, tir };
      else {
        const mir = projectMirBody(scan, source.mir, rewrite, at + ".bodies[" + position + "].mir");
        if (mir.kind === "refused") return mir;
        const observations = projectObservations(scan, rewrite, source.observations);
        if (observations.kind === "refused") return observations;
        const facts = projectRows(scan, source.facts, read => projectRead(scan, () => projectBodyFacts(scan, rewrite, read())));
        if (facts.kind === "refused") return facts;
        selected = { kind: "selected", instance, tir, mir: mir.value, observations: observations.value, facts: facts.value };
      }
      const stop = remember(source, selected);
      if (stop !== null) return { kind: "refused", stop };
      bodies.push(selected);
    }
    return copiedProjection({ module: module.module, tree: requirePresent(image.sourceFileOf(originalTree) ?? undefined, missingSyntax), bodies });
  });
}
