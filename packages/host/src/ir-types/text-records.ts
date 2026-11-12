import type { TypeTable, TypeTerm } from "./contract.js";
import type { RecordReader } from "./text-readers.js";
import { arrayReader, lazyReader, nullableReader, recordReader, unionReader } from "./text-readers.js";
import { createTypeTextValues } from "./text-values.js";
import { createTypeComponentReaders } from "./text-components.js";

export function createTypeTextReaders() {
  const values = createTypeTextValues();
  const { projection: reader_projection } = createTypeComponentReaders(values);
  const reader_type: RecordReader<TypeTerm> = unionReader(["type term"], label => {
    switch (label) {
    case "primitive": return recordReader<TypeTerm>("primitive", read => {
      const field_primitive = read("primitive", lazyReader(() => values["native"]));
      return { fields: [field_primitive], value: () => ({ kind: "primitive", primitive: field_primitive.value() }) };
    });
    case "intrinsic": return recordReader<TypeTerm>("intrinsic", read => {
      const field_intrinsic = read("intrinsic", lazyReader(() => values["intrinsic"]));
      return { fields: [field_intrinsic], value: () => ({ kind: "intrinsic", intrinsic: field_intrinsic.value() }) };
    });
    case "string": return recordReader<TypeTerm>("string", () => {
      return { fields: [], value: () => ({ kind: "string" }) };
    });
    case "error": return recordReader<TypeTerm>("error", () => {
      return { fields: [], value: () => ({ kind: "error" }) };
    });
    case "literal": return recordReader<TypeTerm>("literal", read => {
      const field_value = read("value", lazyReader(() => values["literal"]));
      const field_base = read("base", lazyReader(() => values["type-id"]));
      return { fields: [field_value, field_base], value: () => ({ kind: "literal", value: field_value.value(), base: field_base.value() }) };
    });
    case "union": return recordReader<TypeTerm>("union", read => {
      const field_members = read("members", arrayReader(() => values["type-id"]));
      return { fields: [field_members], value: () => ({ kind: "union", members: field_members.value() }) };
    });
    case "intersection": return recordReader<TypeTerm>("intersection", read => {
      const field_members = read("members", arrayReader(() => values["type-id"]));
      return { fields: [field_members], value: () => ({ kind: "intersection", members: field_members.value() }) };
    });
    case "optional": return recordReader<TypeTerm>("optional", read => {
      const field_value = read("value", lazyReader(() => values["type-id"]));
      return { fields: [field_value], value: () => ({ kind: "optional", value: field_value.value() }) };
    });
    case "array": return recordReader<TypeTerm>("array", read => {
      const field_element = read("element", lazyReader(() => values["type-id"]));
      const field_readonly = read("readonly", lazyReader(() => values["boolean"]));
      return { fields: [field_element, field_readonly], value: () => ({ kind: "array", element: field_element.value(), readonly: field_readonly.value() }) };
    });
    case "tuple": return recordReader<TypeTerm>("tuple", read => {
      const field_elements = read("elements", arrayReader(() => values["tuple-element"]));
      const field_readonly = read("readonly", lazyReader(() => values["boolean"]));
      return { fields: [field_elements, field_readonly], value: () => ({ kind: "tuple", elements: field_elements.value(), readonly: field_readonly.value() }) };
    });
    case "fixed-array": return recordReader<TypeTerm>("fixed-array", read => {
      const field_element = read("element", lazyReader(() => values["type-id"]));
      const field_extent = read("extent", lazyReader(() => values["extent"]));
      return { fields: [field_element, field_extent], value: () => ({ kind: "fixed-array", element: field_element.value(), extent: field_extent.value() }) };
    });
    case "shape": return recordReader<TypeTerm>("shape", read => {
      const field_members = read("members", arrayReader(() => values["member"]));
      const field_indexes = read("indexes", arrayReader(() => values["index-signature"]));
      const field_calls = read("calls", arrayReader(() => values["signature-id"]));
      const field_constructs = read("constructs", arrayReader(() => values["signature-id"]));
      return { fields: [field_members, field_indexes, field_calls, field_constructs], value: () => ({ kind: "shape", members: field_members.value(), indexes: field_indexes.value(), calls: field_calls.value(), constructs: field_constructs.value() }) };
    });
    case "callable": return recordReader<TypeTerm>("callable", read => {
      const field_calls = read("calls", arrayReader(() => values["signature-id"]));
      const field_constructs = read("constructs", arrayReader(() => values["signature-id"]));
      return { fields: [field_calls, field_constructs], value: () => ({ kind: "callable", calls: field_calls.value(), constructs: field_constructs.value() }) };
    });
    case "declared": return recordReader<TypeTerm>("declared", read => {
      const field_definition = read("definition", lazyReader(() => values["definition-id"]));
      const field_arguments = read("arguments", arrayReader(() => values["type-id"]));
      const field_facet = read("facet", lazyReader(() => values["facet"]));
      const field_extent = read("extent", nullableReader(() => values["extent"]));
      return { fields: [field_definition, field_arguments, field_facet, field_extent], value: () => ({ kind: "declared", definition: field_definition.value(), arguments: field_arguments.value(), facet: field_facet.value(), extent: field_extent.value() }) };
    });
    case "construction-reference": return recordReader<TypeTerm>("construction-reference", read => {
      const field_definition = read("definition", lazyReader(() => values["construction"]));
      const field_arguments = read("arguments", arrayReader(() => values["type-id"]));
      return { fields: [field_definition, field_arguments], value: () => ({ kind: "construction-reference", definition: field_definition.value(), arguments: field_arguments.value() }) };
    });
    case "enum": return recordReader<TypeTerm>("enum", read => {
      const field_definition = read("definition", lazyReader(() => values["definition-id"]));
      return { fields: [field_definition], value: () => ({ kind: "enum", definition: field_definition.value() }) };
    });
    case "param": return recordReader<TypeTerm>("param", read => {
      const field_parameter = read("parameter", lazyReader(() => values["parameter-identity"]));
      return { fields: [field_parameter], value: () => ({ kind: "param", parameter: field_parameter.value() }) };
    });
    case "self": return recordReader<TypeTerm>("self", read => {
      const field_owner = read("owner", lazyReader(() => values["definition-id"]));
      return { fields: [field_owner], value: () => ({ kind: "self", owner: field_owner.value() }) };
    });
    case "projection": return recordReader<TypeTerm>("projection", read => {
      const field_source = read("source", lazyReader(() => values["type-id"]));
      const field_projection = read("projection", lazyReader(() => reader_projection));
      return { fields: [field_source, field_projection], value: () => ({ kind: "projection", source: field_source.value(), projection: field_projection.value() }) };
    });
    case "open": return recordReader<TypeTerm>("open", read => {
      const field_group = read("group", lazyReader(() => values["group-id"]));
      const field_variable = read("variable", lazyReader(() => values["number"]));
      return { fields: [field_group, field_variable], value: () => ({ kind: "open", group: field_group.value(), variable: field_variable.value() }) };
    });
    default: return null;
    }
  });
  const reader_table = recordReader<TypeTable>("TypeTable", read => {
      const field_terms = read("terms", arrayReader(() => reader_type));
      const field_signatures = read("signatures", arrayReader(() => values["signature"]));
      return { fields: [field_terms, field_signatures], value: () => ({ terms: field_terms.value(), signatures: field_signatures.value() }) };
    });
  return { table: reader_table };
}
