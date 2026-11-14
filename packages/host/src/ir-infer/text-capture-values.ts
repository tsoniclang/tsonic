import { arraySchema, enumSchema, nullableSchema, recordSchema, unionSchema } from "./text-data.js";
import type { DataSchemas } from "./text-data.js";
import type { EvidenceSchemas } from "./text-evidence.js";
import type { Diagnostic, DiagnosticCode, DiagnosticFix, DiagnosticSite, HostDiagnosticCode, MessageArgument, RelatedDiagnostic, TextEdit } from "../diag/contract.js";
import type { Origin, SigId, TyId } from "../ids/contract.js";
import type { HirCallableEndpoint, HirCandidate, HirCandidateList, HirInferenceContribution } from "../ir-hir/contract.js";
import type { BindingVector } from "../ir-types/contract.js";
import type { RecordSchema } from "./text-data.js";
import type { Schema } from "./text-data.js";

export interface UnavailableRecord {
  readonly kind: "unavailable";
  readonly reason: "checker-error" | "parameter-dependent" | "not-provided" | "missing-original-component" | "incomplete-association" | "unsupported-checked-structure";
}

export interface AvailableSignatureRecord {
  readonly kind: "available";
  readonly value: SigId;
}

export interface AvailableBindingsRecord {
  readonly kind: "available";
  readonly value: BindingVector;
}

export interface AvailableDiagnosticRecord {
  readonly kind: "available";
  readonly value: Diagnostic | null;
}

export interface AvailableTypeRecord {
  readonly kind: "available";
  readonly value: TyId;
}

export interface HostCodeRecord {
  readonly kind: "host";
  readonly name: HostDiagnosticCode;
  readonly rendered: string;
}

export interface CheckerCodeRecord {
  readonly kind: "checker";
  readonly number: number;
  readonly rendered: string;
}

export interface ExtensionCodeRecord {
  readonly kind: "extension";
  readonly number: number;
  readonly extensionCode: string;
  readonly rendered: string;
}

export interface SourceSiteRecord {
  readonly kind: "source";
  readonly origin: Origin;
}

export interface FileSiteRecord {
  readonly kind: "file";
  readonly path: string;
}

export interface NoSiteRecord {
  readonly kind: "none";

}

export interface TextArgumentRecord {
  readonly kind: "text";
  readonly value: string;
}

export interface IntegerArgumentRecord {
  readonly kind: "integer";
  readonly value: bigint;
}

export interface NumberArgumentRecord {
  readonly kind: "number";
  readonly value: number;
}

export interface OriginArgumentRecord {
  readonly kind: "origin";
  readonly value: Origin;
}

export interface CaptureValuesSchemas {
  readonly hirCallableEndpointSchema: RecordSchema<HirCallableEndpoint>;
  readonly endpointRoleSchema: Schema<"advertised" | "api-body" | "api-signature">;
  readonly hirCandidateListSchema: RecordSchema<HirCandidateList>;
  readonly hirCandidateSchema: RecordSchema<HirCandidate>;
  readonly hirInferenceContributionSchema: RecordSchema<HirInferenceContribution>;
  readonly hirContributionRoleSchema: Schema<"argument" | "context" | "receiver" | "result" | "type-argument">;
  readonly unavailableSchema: RecordSchema<UnavailableRecord>;
  readonly unavailableReasonSchema: Schema<"checker-error" | "not-provided" | "parameter-dependent" | "missing-original-component" | "incomplete-association" | "unsupported-checked-structure">;
  readonly capturedSignatureSchema: RecordSchema<AvailableSignatureRecord | UnavailableRecord>;
  readonly availableSignatureSchema: RecordSchema<AvailableSignatureRecord>;
  readonly capturedBindingsSchema: RecordSchema<AvailableBindingsRecord | UnavailableRecord>;
  readonly availableBindingsSchema: RecordSchema<AvailableBindingsRecord>;
  readonly capturedDiagnosticSchema: RecordSchema<AvailableDiagnosticRecord | UnavailableRecord>;
  readonly availableDiagnosticSchema: RecordSchema<AvailableDiagnosticRecord>;
  readonly capturedTypeSchema: RecordSchema<AvailableTypeRecord | UnavailableRecord>;
  readonly availableTypeSchema: RecordSchema<AvailableTypeRecord>;
  readonly diagnosticSchema: RecordSchema<Diagnostic>;
  readonly diagnosticCodeSchema: RecordSchema<DiagnosticCode>;
  readonly hostCodeSchema: RecordSchema<HostCodeRecord>;
  readonly checkerCodeSchema: RecordSchema<CheckerCodeRecord>;
  readonly extensionCodeSchema: RecordSchema<ExtensionCodeRecord>;
  readonly severitySchema: Schema<"error" | "suggestion" | "warning">;
  readonly diagnosticSiteSchema: RecordSchema<DiagnosticSite>;
  readonly sourceSiteSchema: RecordSchema<SourceSiteRecord>;
  readonly fileSiteSchema: RecordSchema<FileSiteRecord>;
  readonly noSiteSchema: RecordSchema<NoSiteRecord>;
  readonly messageArgumentSchema: RecordSchema<MessageArgument>;
  readonly textArgumentSchema: RecordSchema<TextArgumentRecord>;
  readonly integerArgumentSchema: RecordSchema<IntegerArgumentRecord>;
  readonly numberArgumentSchema: RecordSchema<NumberArgumentRecord>;
  readonly originArgumentSchema: RecordSchema<OriginArgumentRecord>;
  readonly relatedDiagnosticSchema: RecordSchema<RelatedDiagnostic>;
  readonly diagnosticFixSchema: RecordSchema<DiagnosticFix>;
  readonly textEditSchema: RecordSchema<TextEdit>;
}

export function createCaptureValuesSchemas(data: DataSchemas, evidence: EvidenceSchemas): CaptureValuesSchemas {
  const { bigintSchema, bindingVectorSchema, bodySchema, candSchema, defSchema, hostCodeNameSchema, numberSchema, originSchema, sigSchema, sourceNodeRefSchema, stringSchema, tSchema, typeParameterIdentitySchema } = data;
  const { typeComponentSchema } = evidence;
  const hirCallableEndpointSchema = recordSchema<HirCallableEndpoint>("HirCallableEndpoint", "HirCallableEndpoint", read => {
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const role = read("role", () => endpointRoleSchema, value => value.role);
    const signature = read("signature", () => sigSchema, value => value.signature);
    const body = read("body", () => nullableSchema(bodySchema), value => value.body);
    return { fields: [declaration, role, signature, body], value: () => ({ declaration: declaration.value(), role: role.value(), signature: signature.value(), body: body.value() }) };
  });

  const endpointRoleSchema = enumSchema("EndpointRole", ["advertised","api-signature","api-body"]);

  const hirCandidateListSchema = recordSchema<HirCandidateList>("HirCandidateList", "HirCandidateList", read => {
    const id = read("id", () => candSchema, value => value.id);
    const candidates = read("candidates", () => arraySchema(hirCandidateSchema), value => value.candidates);
    return { fields: [id, candidates], value: () => ({ id: id.value(), candidates: candidates.value() }) };
  });

  const hirCandidateSchema = recordSchema<HirCandidate>("HirCandidate", "HirCandidate", read => {
    const ordinal = read("ordinal", () => numberSchema, value => value.ordinal);
    const declaration = read("declaration", () => defSchema, value => value.declaration);
    const appliedSignature = read("appliedSignature", () => capturedSignatureSchema, value => value.appliedSignature);
    const bindings = read("bindings", () => capturedBindingsSchema, value => value.bindings);
    const conditionalFailure = read("conditionalFailure", () => capturedDiagnosticSchema, value => value.conditionalFailure);
    const contributions = read("contributions", () => arraySchema(hirInferenceContributionSchema), value => value.contributions);
    return { fields: [ordinal, declaration, appliedSignature, bindings, conditionalFailure, contributions], value: () => ({ ordinal: ordinal.value(), declaration: declaration.value(), appliedSignature: appliedSignature.value(), bindings: bindings.value(), conditionalFailure: conditionalFailure.value(), contributions: contributions.value() }) };
  });

  const hirInferenceContributionSchema = recordSchema<HirInferenceContribution>("HirInferenceContribution", "HirInferenceContribution", read => {
    const parameter = read("parameter", () => typeParameterIdentitySchema, value => value.parameter);
    const role = read("role", () => hirContributionRoleSchema, value => value.role);
    const source = read("source", () => sourceNodeRefSchema, value => value.source);
    const component = read("component", () => typeComponentSchema, value => value.component);
    const type = read("type", () => capturedTypeSchema, value => value.type);
    return { fields: [parameter, role, source, component, type], value: () => ({ parameter: parameter.value(), role: role.value(), source: source.value(), component: component.value(), type: type.value() }) };
  });

  const hirContributionRoleSchema = enumSchema("HirContributionRole", ["argument","receiver","context","result","type-argument"]);

  const unavailableSchema = recordSchema<UnavailableRecord>("Unavailable", "unavailable", read => {
    const reason = read("reason", () => unavailableReasonSchema, value => value.reason);
    return { fields: [reason], value: () => ({ kind: "unavailable", reason: reason.value() }) };
  });

  const unavailableReasonSchema = enumSchema("UnavailableReason", ["checker-error","parameter-dependent","not-provided","missing-original-component","incomplete-association","unsupported-checked-structure"]);

  const capturedSignatureSchema: RecordSchema<AvailableSignatureRecord | UnavailableRecord> = unionSchema<AvailableSignatureRecord | UnavailableRecord>("CapturedSignature",
    () => [availableSignatureSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableSignatureSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableSignatureSchema = recordSchema<AvailableSignatureRecord>("AvailableSignature", "available", read => {
    const value = read("value", () => sigSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedBindingsSchema: RecordSchema<AvailableBindingsRecord | UnavailableRecord> = unionSchema<AvailableBindingsRecord | UnavailableRecord>("CapturedBindings",
    () => [availableBindingsSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableBindingsSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableBindingsSchema = recordSchema<AvailableBindingsRecord>("AvailableBindings", "available", read => {
    const value = read("value", () => bindingVectorSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedDiagnosticSchema: RecordSchema<AvailableDiagnosticRecord | UnavailableRecord> = unionSchema<AvailableDiagnosticRecord | UnavailableRecord>("CapturedDiagnostic",
    () => [availableDiagnosticSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableDiagnosticSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableDiagnosticSchema = recordSchema<AvailableDiagnosticRecord>("AvailableDiagnostic", "available", read => {
    const value = read("value", () => nullableSchema(diagnosticSchema), value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const capturedTypeSchema: RecordSchema<AvailableTypeRecord | UnavailableRecord> = unionSchema<AvailableTypeRecord | UnavailableRecord>("CapturedType",
    () => [availableTypeSchema, unavailableSchema], value => {
    switch (value.kind) {
      case "available": return availableTypeSchema.stage(value);
      case "unavailable": return unavailableSchema.stage(value);
    }
  });

  const availableTypeSchema = recordSchema<AvailableTypeRecord>("AvailableType", "available", read => {
    const value = read("value", () => tSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "available", value: value.value() }) };
  });

  const diagnosticSchema = recordSchema<Diagnostic>("Diagnostic", "Diagnostic", read => {
    const code = read("code", () => diagnosticCodeSchema, value => value.code);
    const severity = read("severity", () => severitySchema, value => value.severity);
    const site = read("site", () => diagnosticSiteSchema, value => value.site);
    const source = read("source", () => nullableSchema(stringSchema), value => value.source);
    const evidence = read("evidence", () => arraySchema(stringSchema), value => value.evidence);
    const message = read("message", () => stringSchema, value => value.message);
    const argumentsField = read("arguments", () => arraySchema(messageArgumentSchema), value => value.arguments);
    const related = read("related", () => arraySchema(relatedDiagnosticSchema), value => value.related);
    const fix = read("fix", () => nullableSchema(diagnosticFixSchema), value => value.fix);
    return { fields: [code, severity, site, source, evidence, message, argumentsField, related, fix], value: () => ({ code: code.value(), severity: severity.value(), site: site.value(), source: source.value(), evidence: evidence.value(), message: message.value(), arguments: argumentsField.value(), related: related.value(), fix: fix.value() }) };
  });

  const diagnosticCodeSchema: RecordSchema<DiagnosticCode> = unionSchema<DiagnosticCode>("DiagnosticCode",
    () => [hostCodeSchema, checkerCodeSchema, extensionCodeSchema], value => {
    switch (value.kind) {
      case "host": return hostCodeSchema.stage(value);
      case "checker": return checkerCodeSchema.stage(value);
      case "extension": return extensionCodeSchema.stage(value);
    }
  });

  const hostCodeSchema = recordSchema<HostCodeRecord>("HostCode", "host", read => {
    const name = read("name", () => hostCodeNameSchema, value => value.name);
    const rendered = read("rendered", () => stringSchema, value => value.rendered);
    return { fields: [name, rendered], value: () => ({ kind: "host", name: name.value(), rendered: rendered.value() }) };
  });

  const checkerCodeSchema = recordSchema<CheckerCodeRecord>("CheckerCode", "checker", read => {
    const number = read("number", () => numberSchema, value => value.number);
    const rendered = read("rendered", () => stringSchema, value => value.rendered);
    return { fields: [number, rendered], value: () => ({ kind: "checker", number: number.value(), rendered: rendered.value() }) };
  });

  const extensionCodeSchema = recordSchema<ExtensionCodeRecord>("ExtensionCode", "extension", read => {
    const number = read("number", () => numberSchema, value => value.number);
    const extensionCode = read("extensionCode", () => stringSchema, value => value.extensionCode);
    const rendered = read("rendered", () => stringSchema, value => value.rendered);
    return { fields: [number, extensionCode, rendered], value: () => ({ kind: "extension", number: number.value(), extensionCode: extensionCode.value(), rendered: rendered.value() }) };
  });

  const severitySchema = enumSchema("Severity", ["error","warning","suggestion"]);

  const diagnosticSiteSchema: RecordSchema<DiagnosticSite> = unionSchema<DiagnosticSite>("DiagnosticSite",
    () => [sourceSiteSchema, fileSiteSchema, noSiteSchema], value => {
    switch (value.kind) {
      case "source": return sourceSiteSchema.stage(value);
      case "file": return fileSiteSchema.stage(value);
      case "none": return noSiteSchema.stage(value);
    }
  });

  const sourceSiteSchema = recordSchema<SourceSiteRecord>("SourceSite", "source", read => {
    const origin = read("origin", () => originSchema, value => value.origin);
    return { fields: [origin], value: () => ({ kind: "source", origin: origin.value() }) };
  });

  const fileSiteSchema = recordSchema<FileSiteRecord>("FileSite", "file", read => {
    const path = read("path", () => stringSchema, value => value.path);
    return { fields: [path], value: () => ({ kind: "file", path: path.value() }) };
  });

  const noSiteSchema = recordSchema<NoSiteRecord>("NoSite", "none", () => {
    return { fields: [], value: () => ({ kind: "none" }) };
  });

  const messageArgumentSchema: RecordSchema<MessageArgument> = unionSchema<MessageArgument>("MessageArgument",
    () => [textArgumentSchema, integerArgumentSchema, numberArgumentSchema, originArgumentSchema], value => {
    switch (value.kind) {
      case "text": return textArgumentSchema.stage(value);
      case "integer": return integerArgumentSchema.stage(value);
      case "number": return numberArgumentSchema.stage(value);
      case "origin": return originArgumentSchema.stage(value);
    }
  });

  const textArgumentSchema = recordSchema<TextArgumentRecord>("TextArgument", "text", read => {
    const value = read("value", () => stringSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "text", value: value.value() }) };
  });

  const integerArgumentSchema = recordSchema<IntegerArgumentRecord>("IntegerArgument", "integer", read => {
    const value = read("value", () => bigintSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "integer", value: value.value() }) };
  });

  const numberArgumentSchema = recordSchema<NumberArgumentRecord>("NumberArgument", "number", read => {
    const value = read("value", () => numberSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "number", value: value.value() }) };
  });

  const originArgumentSchema = recordSchema<OriginArgumentRecord>("OriginArgument", "origin", read => {
    const value = read("value", () => originSchema, value => value.value);
    return { fields: [value], value: () => ({ kind: "origin", value: value.value() }) };
  });

  const relatedDiagnosticSchema = recordSchema<RelatedDiagnostic>("RelatedDiagnostic", "RelatedDiagnostic", read => {
    const site = read("site", () => diagnosticSiteSchema, value => value.site);
    const code = read("code", () => diagnosticCodeSchema, value => value.code);
    const message = read("message", () => stringSchema, value => value.message);
    return { fields: [site, code, message], value: () => ({ site: site.value(), code: code.value(), message: message.value() }) };
  });

  const diagnosticFixSchema = recordSchema<DiagnosticFix>("DiagnosticFix", "DiagnosticFix", read => {
    const description = read("description", () => stringSchema, value => value.description);
    const edits = read("edits", () => arraySchema(textEditSchema), value => value.edits);
    return { fields: [description, edits], value: () => ({ description: description.value(), edits: edits.value() }) };
  });

  const textEditSchema = recordSchema<TextEdit>("TextEdit", "TextEdit", read => {
    const origin = read("origin", () => originSchema, value => value.origin);
    const replacement = read("replacement", () => stringSchema, value => value.replacement);
    return { fields: [origin, replacement], value: () => ({ origin: origin.value(), replacement: replacement.value() }) };
  });
  return { hirCallableEndpointSchema, endpointRoleSchema, hirCandidateListSchema, hirCandidateSchema, hirInferenceContributionSchema, hirContributionRoleSchema, unavailableSchema, unavailableReasonSchema, capturedSignatureSchema, availableSignatureSchema, capturedBindingsSchema, availableBindingsSchema, capturedDiagnosticSchema, availableDiagnosticSchema, capturedTypeSchema, availableTypeSchema, diagnosticSchema, diagnosticCodeSchema, hostCodeSchema, checkerCodeSchema, extensionCodeSchema, severitySchema, diagnosticSiteSchema, sourceSiteSchema, fileSiteSchema, noSiteSchema, messageArgumentSchema, textArgumentSchema, integerArgumentSchema, numberArgumentSchema, originArgumentSchema, relatedDiagnosticSchema, diagnosticFixSchema, textEditSchema };
}
