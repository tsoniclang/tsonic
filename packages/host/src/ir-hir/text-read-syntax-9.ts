import type * as Hir from "./contract.js";
import type * as Ids from "../ids/contract.js";
import type { HirSyntaxConstruction, HirRecordConstruction } from "./text-construction.js";
import { syntaxRecord, sequenceReader, unionReader } from "./text-construction.js";
import type { HirTextReaders } from "./text-read-model.js";
export function createSyntaxGroup9(readers: () => HirTextReaders): ReadonlyMap<string, (accept: (value: HirSyntaxConstruction) => void) => HirRecordConstruction> {
  return new Map([
    ["ConstKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ConstKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ConstKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ConstKeyword", value }), accept)],
    ["ConstructorKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ConstructorKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ConstructorKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ConstructorKeyword", value }), accept)],
    ["ContinueKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ContinueKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ContinueKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ContinueKeyword", value }), accept)],
    ["DebuggerKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DebuggerKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DebuggerKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DebuggerKeyword", value }), accept)],
    ["DeclareKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DeclareKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DeclareKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DeclareKeyword", value }), accept)],
    ["DefaultKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DefaultKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DefaultKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DefaultKeyword", value }), accept)],
    ["DeferKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DeferKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DeferKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DeferKeyword", value }), accept)],
    ["DeleteKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DeleteKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DeleteKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DeleteKeyword", value }), accept)],
    ["DoKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DoKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DoKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DoKeyword", value }), accept)],
    ["DotDotDotToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DotDotDotToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DotDotDotToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DotDotDotToken", value }), accept)],
    ["DotToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "DotToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "DotToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "DotToken", value }), accept)],
    ["ElseKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ElseKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ElseKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ElseKeyword", value }), accept)],
    ["EndOfFile", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EndOfFile" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "EndOfFile", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EndOfFile", value }), accept)],
    ["EnumKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EnumKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "EnumKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EnumKeyword", value }), accept)],
    ["EqualsEqualsEqualsToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EqualsEqualsEqualsToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "EqualsEqualsEqualsToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EqualsEqualsEqualsToken", value }), accept)],
    ["EqualsEqualsToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EqualsEqualsToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "EqualsEqualsToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EqualsEqualsToken", value }), accept)],
    ["EqualsGreaterThanToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EqualsGreaterThanToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "EqualsGreaterThanToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EqualsGreaterThanToken", value }), accept)],
    ["EqualsToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "EqualsToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "EqualsToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "EqualsToken", value }), accept)],
    ["ExclamationEqualsEqualsToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExclamationEqualsEqualsToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ExclamationEqualsEqualsToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExclamationEqualsEqualsToken", value }), accept)],
    ["ExclamationEqualsToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExclamationEqualsToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ExclamationEqualsToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExclamationEqualsToken", value }), accept)],
    ["ExclamationToken", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExclamationToken" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ExclamationToken", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExclamationToken", value }), accept)],
    ["ExportKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExportKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ExportKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExportKeyword", value }), accept)],
    ["ExtendsKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ExtendsKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ExtendsKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ExtendsKeyword", value }), accept)],
    ["FinallyKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "FinallyKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "FinallyKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "FinallyKeyword", value }), accept)],
    ["ForKeyword", accept => syntaxRecord<Hir.Token<Hir.CheckedPhase, Hir.PlainTokenKind> & { readonly kind: "ForKeyword" }>(read => {
      const field_id = read("id", readers().identity_n);
      const field_origin = read("origin", readers().record_30);
      const field_parent = read("parent", unionReader<Ids.NodeId | null>(() => [readers().scalar_null, readers().identity_n]));
      const field_flags = read("flags", sequenceReader(readers().literal_35));
      const field_loc = read("loc", readers().record_81);
      const field_tsonic = read("tsonic", readers().scalar_null);
      return { fields: [field_id, field_origin, field_parent, field_flags, field_loc, field_tsonic], value: () => ({ kind: "ForKeyword", id: field_id.value(), origin: field_origin.value(), parent: field_parent.value(), flags: field_flags.value(), loc: field_loc.value(), tsonic: field_tsonic.value() }) };
    }, value => ({ kind: "ForKeyword", value }), accept)],
  ]);
}
