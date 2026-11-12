import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type * as Types from "../ir-types/contract.js";
import type * as Diag from "../diag/contract.js";
import { recordReader, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders, HirReadGroup1 } from "./text-read-model.js";
export function createReadGroup1(readers: () => HirTextReaders): HirReadGroup1 {
  const record_30 = recordReader<Ids.Origin>("Origin", read => {
      const field_module = read("module", readers().identity_mod);
      const field_start = read("start", readers().scalar_number);
      const field_length = read("length", readers().scalar_number);
      const field_derived = read("derived", sequenceReader(unionReader<Ids.Derivation>(() => [readers().record_31, readers().record_32])));
      return { fields: [field_module, field_start, field_length, field_derived], value: () => ({ module: field_module.value(), start: field_start.value(), length: field_length.value(), derived: field_derived.value() }) };
    });
  const record_31 = recordReader<{ readonly kind: "lowering"; readonly pass: Ids.PassName; }>("lowering", read => {
      const field_pass = read("pass", readers().literal_5);
      return { fields: [field_pass], value: () => ({ kind: "lowering", pass: field_pass.value() }) };
    });
  const record_32 = recordReader<{ readonly kind: "expansion"; readonly expansion: Ids.ExpansionId; }>("expansion", read => {
      const field_expansion = read("expansion", readers().identity_exp);
      return { fields: [field_expansion], value: () => ({ kind: "expansion", expansion: field_expansion.value() }) };
    });
  const record_33 = recordReader<{ readonly kind: "file"; readonly path: string; }>("file", read => {
      const field_path = read("path", readers().scalar_string);
      return { fields: [field_path], value: () => ({ kind: "file", path: field_path.value() }) };
    });
  const record_34 = recordReader<{ readonly kind: "none"; }>("none", () => {

      return { fields: [], value: () => ({ kind: "none" }) };
    });
  const record_35 = recordReader<{ readonly kind: "text"; readonly value: string; }>("text", read => {
      const field_value = read("value", readers().scalar_string);
      return { fields: [field_value], value: () => ({ kind: "text", value: field_value.value() }) };
    });
  const record_36 = recordReader<{ readonly kind: "integer"; readonly value: bigint; }>("integer", read => {
      const field_value = read("value", readers().scalar_bigint);
      return { fields: [field_value], value: () => ({ kind: "integer", value: field_value.value() }) };
    });
  const record_37 = recordReader<{ readonly kind: "number"; readonly value: number; }>("number", read => {
      const field_value = read("value", readers().scalar_number);
      return { fields: [field_value], value: () => ({ kind: "number", value: field_value.value() }) };
    });
  const record_38 = recordReader<{ readonly kind: "origin"; readonly value: Ids.Origin; }>("origin", read => {
      const field_value = read("value", readers().record_30);
      return { fields: [field_value], value: () => ({ kind: "origin", value: field_value.value() }) };
    });
  const record_39 = recordReader<Diag.RelatedDiagnostic>("RelatedDiagnostic", read => {
      const field_site = read("site", unionReader<Diag.DiagnosticSite>(() => [readers().record_29, readers().record_33, readers().record_34]));
      const field_code = read("code", unionReader<Diag.DiagnosticCode>(() => [readers().record_26, readers().record_27, readers().record_28]));
      const field_message = read("message", readers().scalar_string);
      return { fields: [field_site, field_code, field_message], value: () => ({ site: field_site.value(), code: field_code.value(), message: field_message.value() }) };
    });
  const record_40 = recordReader<Diag.DiagnosticFix>("DiagnosticFix", read => {
      const field_description = read("description", readers().scalar_string);
      const field_edits = read("edits", sequenceReader(readers().record_41));
      return { fields: [field_description, field_edits], value: () => ({ description: field_description.value(), edits: field_edits.value() }) };
    });
  const record_41 = recordReader<Diag.TextEdit>("TextEdit", read => {
      const field_origin = read("origin", readers().record_30);
      const field_replacement = read("replacement", readers().scalar_string);
      return { fields: [field_origin, field_replacement], value: () => ({ origin: field_origin.value(), replacement: field_replacement.value() }) };
    });
  const record_42 = recordReader<Hir.HirInferenceContribution>("HirInferenceContribution", read => {
      const field_parameter = read("parameter", readers().record_20);
      const field_role = read("role", readers().literal_6);
      const field_source = read("source", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_component = read("component", readers().record_43);
      const field_type = read("type", unionReader<Hir.CapturedFact<Ids.TyId>>(() => [readers().record_9, readers().record_10]));
      return { fields: [field_parameter, field_role, field_source, field_component, field_type], value: () => ({ parameter: field_parameter.value(), role: field_role.value(), source: field_source.value(), component: field_component.value(), type: field_type.value() }) };
    });
  const record_43 = recordReader<Types.TypeComponent>("TypeComponent", read => {
      const field_root = read("root", unionReader<Ids.SourceNodeRef>(() => [readers().record_5, readers().record_7]));
      const field_path = read("path", sequenceReader(unionReader<Types.ComponentSelector>(() => [readers().record_44, readers().record_45, readers().record_47, readers().record_48, readers().record_49, readers().record_50, readers().record_51, readers().record_52, readers().record_53, readers().record_54, readers().record_55, readers().record_56, readers().record_57, readers().record_64, readers().record_65, readers().record_66, readers().record_67, readers().record_68, readers().record_69, readers().record_70, readers().record_71, readers().record_72, readers().record_73, readers().record_76])));
      return { fields: [field_root, field_path], value: () => ({ root: field_root.value(), path: field_path.value() }) };
    });
  const record_44 = recordReader<{ readonly kind: "class-value"; }>("class-value", () => {

      return { fields: [], value: () => ({ kind: "class-value" }) };
    });
  const record_45 = recordReader<{ readonly kind: "construction-argument"; readonly definition: Types.ConstructionDefinition; readonly index: number; }>("construction-argument", read => {
      const field_definition = read("definition", readers().record_46);
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_definition, field_index], value: () => ({ kind: "construction-argument", definition: field_definition.value(), index: field_index.value() }) };
    });
  const record_46 = recordReader<Types.ConstructionDefinition>("ConstructionDefinition", read => {
      const field_occurrence = read("occurrence", readers().record_6);
      const field_captures = read("captures", sequenceReader(readers().record_11));
      return { fields: [field_occurrence, field_captures], value: () => ({ occurrence: field_occurrence.value(), captures: field_captures.value() }) };
    });
  const record_47 = recordReader<{ readonly kind: "optional-value"; }>("optional-value", () => {

      return { fields: [], value: () => ({ kind: "optional-value" }) };
    });
  const record_48 = recordReader<{ readonly kind: "array-element"; }>("array-element", () => {

      return { fields: [], value: () => ({ kind: "array-element" }) };
    });
  const record_49 = recordReader<{ readonly kind: "tuple-element"; readonly index: number; }>("tuple-element", read => {
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_index], value: () => ({ kind: "tuple-element", index: field_index.value() }) };
    });
  const record_50 = recordReader<{ readonly kind: "argument-place" | "parameter-place" | "union-member"; readonly index: number; }>("union-member", read => {
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_index], value: () => ({ kind: "union-member", index: field_index.value() }) };
    });
  const record_51 = recordReader<{ readonly kind: "argument-place" | "parameter-place" | "union-member"; readonly index: number; }>("argument-place", read => {
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_index], value: () => ({ kind: "argument-place", index: field_index.value() }) };
    });
  const record_52 = recordReader<{ readonly kind: "argument-place" | "parameter-place" | "union-member"; readonly index: number; }>("parameter-place", read => {
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_index], value: () => ({ kind: "parameter-place", index: field_index.value() }) };
    });
  const record_53 = recordReader<{ readonly kind: "intersection-member"; readonly index: number; }>("intersection-member", read => {
      const field_index = read("index", readers().scalar_number);
      return { fields: [field_index], value: () => ({ kind: "intersection-member", index: field_index.value() }) };
    });
  const record_54 = recordReader<{ readonly kind: "intersection-result"; }>("intersection-result", () => {

      return { fields: [], value: () => ({ kind: "intersection-result" }) };
    });
  const record_55 = recordReader<{ readonly kind: "argument-tail" | "parameter-tail"; readonly start: number; }>("argument-tail", read => {
      const field_start = read("start", readers().scalar_number);
      return { fields: [field_start], value: () => ({ kind: "argument-tail", start: field_start.value() }) };
    });
  const record_56 = recordReader<{ readonly kind: "argument-tail" | "parameter-tail"; readonly start: number; }>("parameter-tail", read => {
      const field_start = read("start", readers().scalar_number);
      return { fields: [field_start], value: () => ({ kind: "parameter-tail", start: field_start.value() }) };
    });
  const record_57 = recordReader<{ readonly kind: "member"; readonly origin: Types.MemberOrigin; }>("member", read => {
      const field_origin = read("origin", unionReader<Types.MemberOrigin>(() => [readers().record_58, readers().record_59, readers().record_60]));
      return { fields: [field_origin], value: () => ({ kind: "member", origin: field_origin.value() }) };
    });
  const record_58 = recordReader<{ readonly kind: "declared"; readonly declaration: Ids.DefId; }>("declared", read => {
      const field_declaration = read("declaration", readers().identity_def);
      return { fields: [field_declaration], value: () => ({ kind: "declared", declaration: field_declaration.value() }) };
    });
  const record_59 = recordReader<{ readonly kind: "class-prototype"; readonly owner: Ids.DefId; }>("class-prototype", read => {
      const field_owner = read("owner", readers().identity_def);
      return { fields: [field_owner], value: () => ({ kind: "class-prototype", owner: field_owner.value() }) };
    });
  return { record_30, record_31, record_32, record_33, record_34, record_35, record_36, record_37, record_38, record_39, record_40, record_41, record_42, record_43, record_44, record_45, record_46, record_47, record_48, record_49, record_50, record_51, record_52, record_53, record_54, record_55, record_56, record_57, record_58, record_59 };
}
