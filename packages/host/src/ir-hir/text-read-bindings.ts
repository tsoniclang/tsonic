import type { CheckerDiagnosticRef } from "../diag/contract.js";
import type { DefId, SourceNodeRef } from "../ids/contract.js";
import type { MemberKey, MemberOrigin } from "../ir-types/contract.js";
import type { CapturedFact, CheckedExportAssignment, CheckedExportBinding, CheckedName, CheckedNamespaceExport, HirBindingTarget, HirExportTarget, HirMemoryFieldCapture, HirMemoryLayoutCapture, HirModuleBinding, HirModuleExport, HirResolution } from "./contract.js";
import { literalReader, nonemptySequenceReader, recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirBindingTextReaders } from "./text-read-model.js";


export function createBindingTextReaders(readers: () => HirTextReaders): HirBindingTextReaders {
  const bindingSource = unionReader<SourceNodeRef>(() => [readers().record_5, readers().record_7]);
  const declarations = recordReader<Extract<HirExportTarget, { readonly kind: "declarations" }>>("declarations", read => {
    const definitions = read("definitions", nonemptySequenceReader(readers().identity_def));
    return { fields: [definitions], value: () => ({ kind: "declarations", definitions: definitions.value() }) };
  });
  const binding = recordReader<Extract<HirExportTarget, { readonly kind: "binding" }>>("binding", read => {
    const occurrence = read("occurrence", bindingSource);
    return { fields: [occurrence], value: () => ({ kind: "binding", occurrence: occurrence.value() }) };
  });
  const exportTarget = unionReader<HirExportTarget>(() => [declarations, binding]);
  const module = recordReader<Extract<HirBindingTarget, { readonly kind: "module" }>>("module", read => {
    const target = read("module", readers().identity_mod);
    return { fields: [target], value: () => ({ kind: "module", module: target.value() }) };
  });
  const member = recordReader<Extract<HirBindingTarget, { readonly kind: "member" }>>("member", read => {
    const through = read("through", exportTarget);
    const key = read("key", unionReader<CapturedFact<MemberKey>>(() => [readers().record_160, readers().record_10]));
    const origins = read("origins", unionReader<CapturedFact<readonly MemberOrigin[]>>(() => [readers().record_161, readers().record_10]));
    return { fields: [through, key, origins], value: () => ({ kind: "member", through: through.value(), key: key.value(), origins: origins.value() }) };
  });
  const diagnostic = recordReader<CheckerDiagnosticRef>("CheckerDiagnosticRef", read => {
    const module = read("module", readers().identity_mod);
    const index = read("index", readers().scalar_number);
    return { fields: [module, index], value: () => ({ module: module.value(), index: index.value() }) };
  });
  const unresolved = recordReader<Extract<HirBindingTarget, { readonly kind: "unresolved" }>>("unresolved", read => {
    const diagnostics = read("diagnostics", nonemptySequenceReader(diagnostic));
    return { fields: [diagnostics], value: () => ({ kind: "unresolved", diagnostics: diagnostics.value() }) };
  });
  const bindingTarget = unionReader<HirBindingTarget>(() => [declarations, binding, module, member, unresolved]);
  const available = recordReader<Extract<CapturedFact<HirBindingTarget>, { readonly kind: "available" }>>("available", read => {
    const value = read("value", bindingTarget);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });
  const moduleBinding = recordReader<HirModuleBinding>("HirModuleBinding", read => {
    const occurrence = read("occurrence", bindingSource);
    const target = read("target", unionReader<CapturedFact<HirBindingTarget>>(() => [available, readers().record_10]));
    return { fields: [occurrence, target], value: () => ({ occurrence: occurrence.value(), target: target.value() }) };
  });
  const moduleExport = recordReader<HirModuleExport>("HirModuleExport", read => {
    const name = read("name", readers().scalar_string);
    const target = read("target", exportTarget);
    return { fields: [name, target], value: () => ({ name: name.value(), target: target.value() }) };
  });
  const namespaceExport = recordReader<CheckedNamespaceExport>("CheckedNamespaceExport", read => {
    const core = read("core", readers().record_84);
    const parent = read("parent", unionReader<DefId | null>(() => [readers().scalar_null, readers().identity_def]));
    const attributes = read("attributes", sequenceReader(readers().record_13));
    const memory = read("memory", unionReader<CapturedFact<HirMemoryFieldCapture | HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
    const definition = read("definition", readers().identity_def);
    const binding = read("binding", bindingSource);
    return { fields: [core, parent, attributes, memory, definition, binding], value: () => ({ core: core.value(), parent: parent.value(),
      attributes: attributes.value(), memory: memory.value(), definition: definition.value(), binding: binding.value() }) };
  });
  const exportAssignment = recordReader<CheckedExportAssignment>("CheckedExportAssignment", read => {
    const core = read("core", readers().record_84);
    const parent = read("parent", unionReader<DefId | null>(() => [readers().scalar_null, readers().identity_def]));
    const attributes = read("attributes", sequenceReader(readers().record_13));
    const memory = read("memory", unionReader<CapturedFact<HirMemoryFieldCapture | HirMemoryLayoutCapture | null>>(() => [readers().record_157, readers().record_10]));
    const definition = read("definition", readers().identity_def);
    return { fields: [core, parent, attributes, memory, definition], value: () => ({ core: core.value(), parent: parent.value(),
      attributes: attributes.value(), memory: memory.value(), definition: definition.value() }) };
  });
  const exportBinding = recordReader<CheckedExportBinding>("CheckedExportBinding", read => {
    const core = read("core", readers().record_84);
    const binding = read("binding", bindingSource);
    return { fields: [core, binding], value: () => ({ core: core.value(), binding: binding.value() }) };
  });
  const resolution = unionReader<HirResolution>(() => [bindingTarget, readers().record_146, readers().record_10]);
  const bindingName = recordReader<Extract<CheckedName, { readonly role: "binding-name" }>>("CheckedName", read => {
    const core = read("core", readers().record_84);
    const role = read("role", literalReader<"binding-name">(["binding-name"]));
    const binding = read("binding", bindingSource);
    return { fields: [core, role, binding], value: () => ({ core: core.value(), role: role.value(), binding: binding.value() }) };
  });
  return { bindingSource, exportTarget, bindingTarget, moduleExport, moduleBinding, exportBinding, namespaceExport, exportAssignment, resolution, bindingName };
}
