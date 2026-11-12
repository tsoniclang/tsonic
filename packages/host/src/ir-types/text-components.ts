import type { ComponentSelector, SumArmRole, SumFamily, TypeComponent, TypeProjection } from "./contract.js";
import type { TypeTextValues } from "./text-values.js";
import type { RecordReader } from "./text-readers.js";
import { arrayReader, lazyReader, recordReader, unionReader } from "./text-readers.js";

export function createTypeComponentReaders(values: TypeTextValues) {
  const reader_component = recordReader<TypeComponent>("TypeComponent", read => {
      const field_root = read("root", lazyReader(() => values["source"]));
      const field_path = read("path", arrayReader(() => reader_selector));
      return { fields: [field_root, field_path], value: () => ({ root: field_root.value(), path: field_path.value() }) };
    });
  const reader_family = recordReader<SumFamily>("SumFamily", read => {
      const field_origin = read("origin", lazyReader(() => values["sum-origin"]));
      const field_component = read("component", lazyReader(() => reader_component));
      const field_parameters = read("parameters", arrayReader(() => values["parameter-identity"]));
      const field_roles = read("roles", arrayReader(() => reader_arm));
      return { fields: [field_origin, field_component, field_parameters, field_roles], value: () => ({ origin: field_origin.value(), component: field_component.value(), parameters: field_parameters.value(), roles: field_roles.value() }) };
    });
  const reader_arm = recordReader<SumArmRole>("SumArmRole", read => {
      const field_authoredIndex = read("authoredIndex", lazyReader(() => values["number"]));
      const field_component = read("component", lazyReader(() => values["source"]));
      const field_member = read("member", lazyReader(() => values["type-id"]));
      return { fields: [field_authoredIndex, field_component, field_member], value: () => ({ authoredIndex: field_authoredIndex.value(), component: field_component.value(), member: field_member.value() }) };
    });
  const reader_selector: RecordReader<ComponentSelector> = unionReader(["component selector"], label => {
    switch (label) {
    case "class-value": return recordReader<ComponentSelector>("class-value", () => {
      return { fields: [], value: () => ({ kind: "class-value" }) };
    });
    case "optional-value": return recordReader<ComponentSelector>("optional-value", () => {
      return { fields: [], value: () => ({ kind: "optional-value" }) };
    });
    case "array-element": return recordReader<ComponentSelector>("array-element", () => {
      return { fields: [], value: () => ({ kind: "array-element" }) };
    });
    case "intersection-result": return recordReader<ComponentSelector>("intersection-result", () => {
      return { fields: [], value: () => ({ kind: "intersection-result" }) };
    });
    case "projection-source": return recordReader<ComponentSelector>("projection-source", () => {
      return { fields: [], value: () => ({ kind: "projection-source" }) };
    });
    case "awaited": return recordReader<ComponentSelector>("awaited", () => {
      return { fields: [], value: () => ({ kind: "awaited" }) };
    });
    case "tuple-element": return recordReader<ComponentSelector>("tuple-element", read => {
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_index], value: () => ({ kind: "tuple-element", index: field_index.value() }) };
    });
    case "union-member": return recordReader<ComponentSelector>("union-member", read => {
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_index], value: () => ({ kind: "union-member", index: field_index.value() }) };
    });
    case "argument-place": return recordReader<ComponentSelector>("argument-place", read => {
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_index], value: () => ({ kind: "argument-place", index: field_index.value() }) };
    });
    case "parameter-place": return recordReader<ComponentSelector>("parameter-place", read => {
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_index], value: () => ({ kind: "parameter-place", index: field_index.value() }) };
    });
    case "intersection-member": return recordReader<ComponentSelector>("intersection-member", read => {
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_index], value: () => ({ kind: "intersection-member", index: field_index.value() }) };
    });
    case "construction-argument": return recordReader<ComponentSelector>("construction-argument", read => {
      const field_definition = read("definition", lazyReader(() => values["construction"]));
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_definition, field_index], value: () => ({ kind: "construction-argument", definition: field_definition.value(), index: field_index.value() }) };
    });
    case "argument-tail": return recordReader<ComponentSelector>("argument-tail", read => {
      const field_start = read("start", lazyReader(() => values["number"]));
      return { fields: [field_start], value: () => ({ kind: "argument-tail", start: field_start.value() }) };
    });
    case "parameter-tail": return recordReader<ComponentSelector>("parameter-tail", read => {
      const field_start = read("start", lazyReader(() => values["number"]));
      return { fields: [field_start], value: () => ({ kind: "parameter-tail", start: field_start.value() }) };
    });
    case "member": return recordReader<ComponentSelector>("member", read => {
      const field_origin = read("origin", lazyReader(() => values["origin"]));
      return { fields: [field_origin], value: () => ({ kind: "member", origin: field_origin.value() }) };
    });
    case "index-key": return recordReader<ComponentSelector>("index-key", read => {
      const field_declaration = read("declaration", lazyReader(() => values["definition-id"]));
      return { fields: [field_declaration], value: () => ({ kind: "index-key", declaration: field_declaration.value() }) };
    });
    case "index-value": return recordReader<ComponentSelector>("index-value", read => {
      const field_declaration = read("declaration", lazyReader(() => values["definition-id"]));
      return { fields: [field_declaration], value: () => ({ kind: "index-value", declaration: field_declaration.value() }) };
    });
    case "parameter": return recordReader<ComponentSelector>("parameter", read => {
      const field_signature = read("signature", lazyReader(() => values["signature-id"]));
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_signature, field_index], value: () => ({ kind: "parameter", signature: field_signature.value(), index: field_index.value() }) };
    });
    case "receiver": return recordReader<ComponentSelector>("receiver", read => {
      const field_signature = read("signature", lazyReader(() => values["signature-id"]));
      return { fields: [field_signature], value: () => ({ kind: "receiver", signature: field_signature.value() }) };
    });
    case "result": return recordReader<ComponentSelector>("result", read => {
      const field_signature = read("signature", lazyReader(() => values["signature-id"]));
      return { fields: [field_signature], value: () => ({ kind: "result", signature: field_signature.value() }) };
    });
    case "signature-tail": return recordReader<ComponentSelector>("signature-tail", read => {
      const field_signature = read("signature", lazyReader(() => values["signature-id"]));
      const field_start = read("start", lazyReader(() => values["number"]));
      const field_readonly = read("readonly", lazyReader(() => values["boolean"]));
      return { fields: [field_signature, field_start, field_readonly], value: () => ({ kind: "signature-tail", signature: field_signature.value(), start: field_start.value(), readonly: field_readonly.value() }) };
    });
    case "tuple-slice": return recordReader<ComponentSelector>("tuple-slice", read => {
      const field_start = read("start", lazyReader(() => values["number"]));
      const field_endCount = read("endCount", lazyReader(() => values["number"]));
      const field_readonly = read("readonly", lazyReader(() => values["boolean"]));
      return { fields: [field_start, field_endCount, field_readonly], value: () => ({ kind: "tuple-slice", start: field_start.value(), endCount: field_endCount.value(), readonly: field_readonly.value() }) };
    });
    case "type-argument": return recordReader<ComponentSelector>("type-argument", read => {
      const field_declaration = read("declaration", lazyReader(() => values["definition-id"]));
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_declaration, field_index], value: () => ({ kind: "type-argument", declaration: field_declaration.value(), index: field_index.value() }) };
    });
    case "sum-arm": return recordReader<ComponentSelector>("sum-arm", read => {
      const field_family = read("family", lazyReader(() => reader_family));
      const field_index = read("index", lazyReader(() => values["number"]));
      return { fields: [field_family, field_index], value: () => ({ kind: "sum-arm", family: field_family.value(), index: field_index.value() }) };
    });
    default: return null;
    }
  });
  const reader_projection: RecordReader<TypeProjection> = unionReader(["awaited","component"], label => {
    switch (label) {
    case "awaited": return recordReader<TypeProjection>("awaited", () => {
      return { fields: [], value: () => ({ kind: "awaited" }) };
    });
    case "component": return recordReader<TypeProjection>("component", read => {
      const field_component = read("component", lazyReader(() => reader_component));
      return { fields: [field_component], value: () => ({ kind: "component", component: field_component.value() }) };
    });
    default: return null;
    }
  });
  return { component: reader_component, family: reader_family, arm: reader_arm, selector: reader_selector, projection: reader_projection };
}
