import type { DefId, TyId } from "../ids/contract.js";
import type { HirNode, InterfaceDeclaration } from "../ir-hir/contract.js";
import type { TirReadyReadAdmission, TirVerifierInput, TypedPhase } from "./contract.js";
import type { TirOccurrenceEmit } from "./verify-occurrences.js";

export function verifyInterfaceInstance<Stop extends object>(input: TirVerifierInput, node: InterfaceDeclaration<TypedPhase>,
  original: HirNode | undefined, admit: TirReadyReadAdmission<Stop>, emit: TirOccurrenceEmit): Stop | null {
  const invalid = () => {
    emit("interface-instance-exact", node, "interface header must retain its actual checked nominal instance and rigid arguments");
    return null;
  };
  const enter = admit({ kind: "row" });
  if (enter !== null) return enter;
  if (original?.kind !== "InterfaceDeclaration" || node.tsonic.definition !== original.tsonic.definition) return invalid();
  const definition = original.tsonic.definition;
  const owner = admit({ kind: "source-declaration", definition });
  if (owner !== null) return owner;
  const nominal = input.nominalOf(definition);
  const read = admit({ kind: "row" });
  if (read !== null) return read;
  const term = input.types.terms[node.tsonic.type];
  if (nominal?.kind === "declared") {
    if (term?.kind !== "declared" || term.definition !== definition || term.facet !== "instance" || term.extent !== null
      || !nominal.facets.includes("instance") || term.arguments.length !== original.tsonic.parameters.length) return invalid();
    for (let position = 0; position < term.arguments.length; ++position) {
      const stop = admit({ kind: "row" });
      if (stop !== null) return stop;
      const argument = term.arguments[position];
      const binder = original.tsonic.parameters[position];
      const value = argument === undefined ? undefined : input.types.terms[argument];
      if (binder === undefined || value?.kind !== "param" || value.parameter !== binder.declaration) return invalid();
    }
    return null;
  }
  if (nominal?.kind !== "merged-interface" || term?.kind !== "merged-interface"
    || nominal.definitions.length !== term.definitions.length || nominal.slots.length !== term.arguments.length) return invalid();
  let fragment = -1;
  for (let position = 0; position < term.definitions.length; ++position) {
    const stop = admit({ kind: "row" });
    if (stop !== null) return stop;
    const actual = term.definitions[position];
    if (actual === undefined || actual !== nominal.definitions[position]) return invalid();
    if (actual === definition) fragment = position;
  }
  if (fragment === -1) return invalid();
  let captured: readonly DefId[] | undefined;
  let local = 0;
  for (let position = 0; position < nominal.slots.length; ++position) {
    const stop = admit({ kind: "row" });
    if (stop !== null) return stop;
    const slot = nominal.slots[position];
    const argument: TyId | undefined = term.arguments[position];
    const value = argument === undefined ? undefined : input.types.terms[argument];
    if (slot === undefined) return invalid();
    if (slot.scope === "local") {
      if (value?.kind !== "merged-parameter" || value.parameters.length !== slot.parameters.length
        || slot.parameters[fragment] !== original.tsonic.parameters[local]?.declaration) return invalid();
      for (let parameter = 0; parameter < slot.parameters.length; ++parameter) {
        const stop = admit({ kind: "row" });
        if (stop !== null) return stop;
        if (slot.parameters[parameter] === undefined || slot.parameters[parameter] !== value.parameters[parameter]) return invalid();
      }
      ++local;
    } else {
      if (value?.kind !== "param") return invalid();
      if (captured === undefined) {
        const scope = admit({ kind: "source-declaration", definition });
        if (scope !== null) return scope;
        const original = input.declarationOf(definition);
        if (original === null) return invalid();
        captured = original.scope.capturedParameters;
      }
      let binder: DefId | undefined;
      for (let parameter = 0; parameter < slot.parameters.length; ++parameter) {
        const row = admit({ kind: "row" });
        if (row !== null) return row;
        const offered = slot.parameters[parameter];
        if (offered === undefined) return invalid();
        for (let index = 0; index < captured.length; ++index) {
          const owner = admit({ kind: "row" });
          if (owner !== null) return owner;
          if (captured[index] !== offered) continue;
          if (binder !== undefined) return invalid();
          binder = offered;
          break;
        }
      }
      if (binder === undefined || binder !== value.parameter) return invalid();
    }
  }
  return local === original.tsonic.parameters.length ? null : invalid();
}
