import { sourceAnalysisIncludesFile, sourceAnalysisMayBeAbsent, type SourceAnalysisProgram } from "../../analysis-program.js";
import type { SourceTypeDescriptor } from "../../../source-semantics/local-type-flow/types.js";
import { sourceCallableValueParameters } from "../../../source-navigation/callable-parameters.js";
import type { Node } from "@tsonic/tsts";
import { Node_Initializer } from "../../../source-navigation/index.js";
import { sourceInstanceInitializers } from "../../../source-navigation/class-initialization.js";
import { createSourceStorageLexicalSelections } from "./lexical-regions.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageSubject, SourceStorageSubjectQuery } from "../model/subjects.js";
import type { SourceStorageInstanceRegion, SourceStorageCallbackEntry } from "../model/types.js";
import { sourceStorageBindingArgumentType, sourceStorageSelectedInputSlots, sourceStorageInvocationArgumentAbsence, sourceStorageNativeInputSlots } from "./invocation-inputs.js";
import type { SourceStorageInvocationInputSelectionQuery } from "./invocation-inputs.js";

export function createSourceStorageExecutionRegions(source: SourceAnalysisProgram, budget: SourceStorageBudget,
  constructionLineages: (invocation: Node) => readonly {
    readonly classes: readonly { readonly subject: SourceStorageSubject }[]; readonly complete: boolean;
  }[] | undefined, inputSlotsFor: SourceStorageInvocationInputSelectionQuery, subject: SourceStorageSubjectQuery) {
  const { ast, navigation } = source;
  const step = budget.step;
  const lexical = createSourceStorageLexicalSelections(ast, budget);
  const invocations = new Map<Node, Set<Node>>();
  const invocationRows = budget.createRows();
  let sealed = false;
  const typeMayBeAbsent = (type: SourceTypeDescriptor): boolean => !step() || sourceAnalysisMayBeAbsent(type);
  const callable = (declaration: Node, invocation: Node | undefined,
    argumentTypes?: (expression: Node) => readonly SourceTypeDescriptor[] | undefined, callback?: SourceStorageCallbackEntry,
    actualTypes?: readonly (readonly SourceTypeDescriptor[] | undefined)[], phase: "call" | "active" = "call"): readonly Node[] => {
    const body = ast.body(declaration);
    if (body === undefined) return [];
    const regions = phase === "active" || source.facts.selections.generator(declaration) === undefined ? [body] : [];
    const selection = invocation === undefined ? undefined : navigation.call(invocation);
    const inputs = inputSlotsFor(declaration, invocation, callback);
    const slots = sourceStorageSelectedInputSlots(inputs, declaration);
    const parameters = sourceCallableValueParameters(ast, declaration, navigation, { kind: "declaration" });
    if (parameters === undefined) {
      budget.reject("Source storage callable regions require their exact checked value parameters.");
      return [];
    }
    for (const parameter of parameters) {
      if (!step()) break;
      if (parameter === undefined || !sourceAnalysisIncludesFile(source, ast.getSourceFile(parameter)) ||
        !ast.is.IsParameterDeclaration(parameter) || ast.parent(parameter) !== declaration) {
        budget.reject("Source storage callable inputs require exact checked parameter declaration ownership.");
        break;
      }
      const initializer = Node_Initializer(ast, parameter);
      if (initializer === undefined) continue;
      if (actualTypes !== undefined) {
        const inputs = slots?.filter(slot => slot.parameter === parameter);
        if (inputs === undefined || inputs.length === 0 || inputs.some(input => {
          const supplied = actualTypes[input.effectiveIndex];
          return supplied === undefined || supplied.length === 0 || supplied.some(type => typeMayBeAbsent(type));
        })) regions.push(initializer);
        continue;
      }
      if (callback !== undefined && invocation !== undefined) {
        const formal = subject(parameter, "input");
        if (formal === undefined) return [];
        const inputs = sourceStorageNativeInputSlots(source, declaration,
          formal, inputSlotsFor(declaration, invocation, callback), step);
        if (inputs === undefined || inputs.some(input => input.absent || input.acceptsOmission || input.type === undefined ||
          typeMayBeAbsent(input.type))) regions.push(initializer);
        continue;
      }
      const inputs = slots?.filter(slot => slot.parameter === parameter);
      const bindings = inputs === undefined ? undefined : selection?.bindings.filter(binding =>
        inputs.some(slot => slot.effectiveIndex === binding.effectiveArgumentIndex || slot.repeated && binding.effectiveArgumentIndex >= slot.effectiveIndex));
      if (bindings === undefined || bindings.length === 0 || bindings.some(binding => {
        if (binding.sourceForm === "spread-sequence") return true;
        if (binding.sourceForm === "spread-element" && selection !== undefined &&
          sourceStorageInvocationArgumentAbsence(source, selection, binding) !== "present") return true;
        const expression = selection?.arguments[binding.sourceArgumentIndex];
        const supplied = selection === undefined ? undefined : sourceStorageBindingArgumentType(source, selection, binding);
        const types = argumentTypes === undefined || binding.sourceForm === "spread-element"
          ? supplied === undefined ? undefined : [supplied]
          : expression === undefined ? undefined : argumentTypes(expression);
        return types === undefined || types.length === 0 || types.some(type => typeMayBeAbsent(type));
      })) {
        regions.push(initializer);
      }
    }
    return regions;
  };
  const instance = (invocation: Node): { readonly regions: readonly SourceStorageInstanceRegion[]; readonly exact: boolean } | undefined => {
    const lineages = constructionLineages(invocation);
    if (lineages === undefined) return undefined;
    const checked = new Set<Node>();
    const regions: SourceStorageInstanceRegion[] = [];
    for (const lineage of lineages) for (const selected of lineage.classes) {
      if (!step()) return undefined;
      const owner = selected.subject.node;
      if (checked.has(owner)) continue;
      checked.add(owner);
      const initializers = sourceInstanceInitializers(owner, source, step);
      if (initializers === undefined) return undefined;
      for (const initializer of initializers) regions.push(Object.freeze({ owner, node: initializer }));
    }
    return Object.freeze({ regions: Object.freeze(regions), exact: lineages.length !== 0 && lineages.every(lineage => lineage.complete) });
  };
  return Object.freeze({ callable, instance, ...lexical,
    recordInvocation(invocation: Node): void {
      if (sealed) {
        budget.reject("Source storage execution regions cannot register invocations after construction is sealed.");
        return;
      }
      if (!step()) return;
      const region = lexical.enclosing(invocation);
      if (budget.failure() !== undefined) return;
      if (region === undefined) {
        budget.reject("Source storage execution requires its exact checked invocation region.");
        return;
      }
      const selected = invocations.get(region);
      if (selected?.has(invocation) || !invocationRows.add(selected === undefined ? 2 : 1)) return;
      const retained = selected ?? new Set<Node>();
      retained.add(invocation);
      invocations.set(region, retained);
    },
    invocationRegions: (): Iterable<Node> => invocations.keys(),
    invocationsIn(region: Node): Iterable<Node> | undefined {
      if (!step()) return undefined;
      return invocations.get(region)?.values();
    },
    seal(): void { sealed = true; },
  });
}
