import type { TextParseResult } from "../diag/contract.js";
import type { ConstantReference } from "../ir-types/contract.js";
import type { TypeEvidence, CategoryEvidence, NumericEvidence, SumEvidence, PointerEvidence, TypeComponent, ComponentSelector, TypeParameter, TypeParameterIdentity, SourceCategory, LiteralValue, BindingVector, SumArmRole, ConstructionDefinition, MemberOrigin, SumFamily, MemberKey, ExactRational, ArtifactBindings, BodyInstance, ConstValue, SelfBinding, TypeBinding, Execution, DeclaredExecution, SignatureRequest } from "../ir-types/contract.js";
import type { TyId, SourceNodeRef, DefId, NodeRef, SigId, LocalRef } from "../ids/contract.js";
import type { Cursor, RecordFields, TextStep } from "./parse-values.js";
import { acceptText, atomicText, fieldText, arrayText, nullableText, readStringChoice } from "./parse-values.js";
import { readSourceNodeRef, readNodeRef, readLocalRef } from "./parse-diagnostics.js";
import { choice, closeRecord, delimiter, openRecord, readArray, readBigInt, readBodyId, readBoolean, readDefinitionId, readField, readNumber, readString, readTypeId, readSignatureId } from "./parse-values.js";

export function readTypeEvidenceText<Root>(cursor: Cursor, finish: (value: TypeEvidence) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypeEvidence"), fields =>
    fieldText<TyId, Root>(cursor, fields, "type", (next, done) => atomicText(next, readTypeId, done), typeValue =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "component", (next, done) => atomicText(next, readSourceNodeRef, done), componentValue =>
      fieldText<CategoryEvidence, Root>(cursor, fields, "category", readCategoryEvidenceText, categoryValue =>
        fieldText<NumericEvidence | null, Root>(cursor, fields, "numeric", (next, done) => nullableText(next, readNumericEvidenceText, done), numericValue =>
          fieldText<SumEvidence | null, Root>(cursor, fields, "sum", (next, done) => nullableText(next, readSumEvidenceText, done), sumValue =>
            fieldText<DefId | null, Root>(cursor, fields, "nominal", (next, done) => nullableText(next, (next, done) => atomicText(next, readDefinitionId, done), done), nominalValue =>
              fieldText<PointerEvidence | null, Root>(cursor, fields, "pointer", (next, done) => nullableText(next, readPointerEvidenceText, done), pointerValue =>
                atomicText(cursor, next => closeRecord(next, fields), () =>
                    acceptText({ type: typeValue, component: componentValue, category: categoryValue, numeric: numericValue, sum: sumValue, nominal: nominalValue, pointer: pointerValue }, finish))))))))));
}

export function readTypeComponentText<Root>(cursor: Cursor, finish: (value: TypeComponent) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypeComponent"), fields =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "root", (next, done) => atomicText(next, readSourceNodeRef, done), rootValue =>
    fieldText<readonly (ComponentSelector)[], Root>(cursor, fields, "path", (next, done) => arrayText(next, readComponentSelectorText, done), pathValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ root: rootValue, path: pathValue }, finish)))));
}

export function readTypeParameterText<Root>(cursor: Cursor, finish: (value: TypeParameter) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "TypeParameter"), fields =>
    fieldText<TypeParameterIdentity, Root>(cursor, fields, "identity", (next, done) => atomicText(next, readParameterIdentity, done), identityValue =>
    fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
      fieldText<TyId | null, Root>(cursor, fields, "constraint", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), constraintValue =>
        fieldText<TyId | null, Root>(cursor, fields, "default", (next, done) => nullableText(next, (next, done) => atomicText(next, readTypeId, done), done), defaultValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ identity: identityValue, declaration: declarationValue, constraint: constraintValue, default: defaultValue }, finish)))))));
}

export function readCategoryEvidenceText<Root>(cursor: Cursor, finish: (value: CategoryEvidence) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["known","parameter","choice","dynamic"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "known":
          return fieldText<SourceCategory, Root>(cursor, fields, "category", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["number","bigint","boolean","string","symbol","absence","object","callable"]), done), categoryValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, category: categoryValue }, finish)));
        case "parameter":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, declaration: declarationValue }, finish)));
        case "choice":
          return fieldText<readonly (CategoryEvidence)[], Root>(cursor, fields, "alternatives", (next, done) => arrayText(next, readCategoryEvidenceText, done), alternativesValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, alternatives: alternativesValue }, finish)));
        case "dynamic":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
      }
    }));
}

export function readNumericEvidenceText<Root>(cursor: Cursor, finish: (value: NumericEvidence) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["literal","declared","operation","application"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      return fieldText<NodeRef, Root>(cursor, fields, "producer", (next, done) => atomicText(next, readNodeRef, done), producerValue =>
    fieldText<CategoryEvidence, Root>(cursor, fields, "category", readCategoryEvidenceText, categoryValue =>
      fieldText<LiteralValue | null, Root>(cursor, fields, "authored", (next, done) => nullableText(next, readLiteralValueText, done), authoredValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, producer: producerValue, category: categoryValue, authored: authoredValue }, finish)))));
    }));
}

export function readSumEvidenceText<Root>(cursor: Cursor, finish: (value: SumEvidence) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["authored","inferred"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      return fieldText<SourceNodeRef, Root>(cursor, fields, "component", (next, done) => atomicText(next, readSourceNodeRef, done), componentValue =>
    fieldText<BindingVector, Root>(cursor, fields, "bindings", (next, done) => atomicText(next, readBindings, done), bindingsValue =>
      fieldText<readonly (SumArmRole)[], Root>(cursor, fields, "arms", (next, done) => arrayText(next, readSumArmRoleText, done), armsValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, component: componentValue, bindings: bindingsValue, arms: armsValue }, finish)))));
    }));
}

export function readPointerEvidenceText<Root>(cursor: Cursor, finish: (value: PointerEvidence) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["raw-address","typed-location","native-pointer","function-pointer"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "raw-address":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "typed-location":
          return fieldText<TyId, Root>(cursor, fields, "pointee", (next, done) => atomicText(next, readTypeId, done), pointeeValue =>
    fieldText<"readonly" | "readwrite" | "unspecified", Root>(cursor, fields, "mutability", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["readonly","readwrite","unspecified"]), done), mutabilityValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, pointee: pointeeValue, mutability: mutabilityValue }, finish))));
        case "native-pointer":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, declaration: declarationValue }, finish)));
        case "function-pointer":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    fieldText<readonly (TyId)[], Root>(cursor, fields, "parameters", (next, done) => arrayText(next, (next, done) => atomicText(next, readTypeId, done), done), parametersValue =>
      fieldText<TyId, Root>(cursor, fields, "result", (next, done) => atomicText(next, readTypeId, done), resultValue =>
        fieldText<readonly (string)[], Root>(cursor, fields, "abi", (next, done) => arrayText(next, (next, done) => atomicText(next, readString, done), done), abiValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ kind: label, declaration: declarationValue, parameters: parametersValue, result: resultValue, abi: abiValue }, finish))))));
      }
    }));
}

export function readComponentSelectorText<Root>(cursor: Cursor, finish: (value: ComponentSelector) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["class-value","construction-argument","optional-value","array-element","tuple-element","union-member","argument-place","parameter-place","intersection-member","intersection-result","argument-tail","parameter-tail","member","index-key","index-value","projection-source","parameter","receiver","signature-tail","tuple-slice","result","type-argument","sum-arm","awaited"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "class-value":
        case "optional-value":
        case "array-element":
        case "intersection-result":
        case "projection-source":
        case "awaited":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "construction-argument":
          return fieldText<ConstructionDefinition, Root>(cursor, fields, "definition", readConstructionDefinitionText, definitionValue =>
    fieldText<number, Root>(cursor, fields, "index", (next, done) => atomicText(next, readNumber, done), indexValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, definition: definitionValue, index: indexValue }, finish))));
        case "tuple-element":
        case "union-member":
        case "argument-place":
        case "parameter-place":
        case "intersection-member":
          return fieldText<number, Root>(cursor, fields, "index", (next, done) => atomicText(next, readNumber, done), indexValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, index: indexValue }, finish)));
        case "argument-tail":
        case "parameter-tail":
          return fieldText<number, Root>(cursor, fields, "start", (next, done) => atomicText(next, readNumber, done), startValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, start: startValue }, finish)));
        case "member":
          return fieldText<MemberOrigin, Root>(cursor, fields, "origin", readMemberOriginText, originValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, origin: originValue }, finish)));
        case "index-key":
        case "index-value":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, declaration: declarationValue }, finish)));
        case "parameter":
          return fieldText<SigId, Root>(cursor, fields, "signature", (next, done) => atomicText(next, readSignatureId, done), signatureValue =>
    fieldText<number, Root>(cursor, fields, "index", (next, done) => atomicText(next, readNumber, done), indexValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, signature: signatureValue, index: indexValue }, finish))));
        case "receiver":
        case "result":
          return fieldText<SigId, Root>(cursor, fields, "signature", (next, done) => atomicText(next, readSignatureId, done), signatureValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, signature: signatureValue }, finish)));
        case "signature-tail":
          return fieldText<SigId, Root>(cursor, fields, "signature", (next, done) => atomicText(next, readSignatureId, done), signatureValue =>
    fieldText<number, Root>(cursor, fields, "start", (next, done) => atomicText(next, readNumber, done), startValue =>
      fieldText<boolean, Root>(cursor, fields, "readonly", (next, done) => atomicText(next, readBoolean, done), readonlyValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, signature: signatureValue, start: startValue, readonly: readonlyValue }, finish)))));
        case "tuple-slice":
          return fieldText<number, Root>(cursor, fields, "start", (next, done) => atomicText(next, readNumber, done), startValue =>
    fieldText<number, Root>(cursor, fields, "endCount", (next, done) => atomicText(next, readNumber, done), endCountValue =>
      fieldText<boolean, Root>(cursor, fields, "readonly", (next, done) => atomicText(next, readBoolean, done), readonlyValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ kind: label, start: startValue, endCount: endCountValue, readonly: readonlyValue }, finish)))));
        case "type-argument":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    fieldText<number, Root>(cursor, fields, "index", (next, done) => atomicText(next, readNumber, done), indexValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, declaration: declarationValue, index: indexValue }, finish))));
        case "sum-arm":
          return fieldText<SumFamily, Root>(cursor, fields, "family", readSumFamilyText, familyValue =>
    fieldText<number, Root>(cursor, fields, "index", (next, done) => atomicText(next, readNumber, done), indexValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, family: familyValue, index: indexValue }, finish))));
      }
    }));
}

export function readMemberKeyText<Root>(cursor: Cursor, finish: (value: MemberKey) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["text","number","symbol"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "text":
          return fieldText<string, Root>(cursor, fields, "value", (next, done) => atomicText(next, readString, done), valueValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, value: valueValue }, finish)));
        case "number":
          return fieldText<ExactRational, Root>(cursor, fields, "value", (next, done) => atomicText(next, readExactRational, done), valueValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, value: valueValue }, finish)));
        case "symbol":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, declaration: declarationValue }, finish)));
      }
    }));
}

export function readMemberOriginText<Root>(cursor: Cursor, finish: (value: MemberOrigin) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["declared","class-prototype","mapped"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "declared":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, declaration: declarationValue }, finish)));
        case "class-prototype":
          return fieldText<DefId, Root>(cursor, fields, "owner", (next, done) => atomicText(next, readDefinitionId, done), ownerValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, owner: ownerValue }, finish)));
        case "mapped":
          return fieldText<SourceNodeRef, Root>(cursor, fields, "owner", (next, done) => atomicText(next, readSourceNodeRef, done), ownerValue =>
    fieldText<MemberKey, Root>(cursor, fields, "key", readMemberKeyText, keyValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, owner: ownerValue, key: keyValue }, finish))));
      }
    }));
}

export function readLiteralValueText<Root>(cursor: Cursor, finish: (value: LiteralValue) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => choice(next, ["number","bigint","string","boolean","absence","unique-symbol"]), label =>
    atomicText(cursor, next => delimiter(next, "("), () => {
      const fields: RecordFields = { given: new Set<string>() };
      switch (label) {
        case "number":
          return fieldText<string, Root>(cursor, fields, "token", (next, done) => atomicText(next, readString, done), tokenValue =>
    fieldText<ExactRational, Root>(cursor, fields, "value", (next, done) => atomicText(next, readExactRational, done), valueValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, token: tokenValue, value: valueValue }, finish))));
        case "bigint":
          return fieldText<string, Root>(cursor, fields, "token", (next, done) => atomicText(next, readString, done), tokenValue =>
    fieldText<bigint, Root>(cursor, fields, "value", (next, done) => atomicText(next, readBigInt, done), valueValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ kind: label, token: tokenValue, value: valueValue }, finish))));
        case "string":
          return fieldText<string, Root>(cursor, fields, "value", (next, done) => atomicText(next, readString, done), valueValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, value: valueValue }, finish)));
        case "boolean":
          return fieldText<boolean, Root>(cursor, fields, "value", (next, done) => atomicText(next, readBoolean, done), valueValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, value: valueValue }, finish)));
        case "absence":
          return atomicText(cursor, next => closeRecord(next, fields), () =>
      acceptText({ kind: label }, finish));
        case "unique-symbol":
          return fieldText<DefId, Root>(cursor, fields, "declaration", (next, done) => atomicText(next, readDefinitionId, done), declarationValue =>
    atomicText(cursor, next => closeRecord(next, fields), () =>
        acceptText({ kind: label, declaration: declarationValue }, finish)));
      }
    }));
}

export function readSumArmRoleText<Root>(cursor: Cursor, finish: (value: SumArmRole) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "SumArmRole"), fields =>
    fieldText<number, Root>(cursor, fields, "authoredIndex", (next, done) => atomicText(next, readNumber, done), authoredIndexValue =>
    fieldText<SourceNodeRef, Root>(cursor, fields, "component", (next, done) => atomicText(next, readSourceNodeRef, done), componentValue =>
      fieldText<TyId, Root>(cursor, fields, "member", (next, done) => atomicText(next, readTypeId, done), memberValue =>
        atomicText(cursor, next => closeRecord(next, fields), () =>
            acceptText({ authoredIndex: authoredIndexValue, component: componentValue, member: memberValue }, finish))))));
}

export function readConstructionDefinitionText<Root>(cursor: Cursor, finish: (value: ConstructionDefinition) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "ConstructionDefinition"), fields =>
    fieldText<NodeRef, Root>(cursor, fields, "occurrence", (next, done) => atomicText(next, readNodeRef, done), occurrenceValue =>
    fieldText<readonly (LocalRef)[], Root>(cursor, fields, "captures", (next, done) => arrayText(next, (next, done) => atomicText(next, readLocalRef, done), done), capturesValue =>
      atomicText(cursor, next => closeRecord(next, fields), () =>
          acceptText({ occurrence: occurrenceValue, captures: capturesValue }, finish)))));
}

export function readSumFamilyText<Root>(cursor: Cursor, finish: (value: SumFamily) => TextStep<Root>): TextStep<Root> {
  return atomicText(cursor, next => openRecord(next, "SumFamily"), fields =>
    fieldText<"authored" | "inferred", Root>(cursor, fields, "origin", (next, done) => atomicText(next, cursor => readStringChoice(cursor, ["authored","inferred"]), done), originValue =>
    fieldText<TypeComponent, Root>(cursor, fields, "component", readTypeComponentText, componentValue =>
      fieldText<readonly (TypeParameterIdentity)[], Root>(cursor, fields, "parameters", (next, done) => arrayText(next, (next, done) => atomicText(next, readParameterIdentity, done), done), parametersValue =>
        fieldText<readonly (SumArmRole)[], Root>(cursor, fields, "roles", (next, done) => arrayText(next, readSumArmRoleText, done), rolesValue =>
          atomicText(cursor, next => closeRecord(next, fields), () =>
              acceptText({ origin: originValue, component: componentValue, parameters: parametersValue, roles: rolesValue }, finish)))))));
}

export function readConstValue(cursor: Cursor): TextParseResult<ConstValue> {
  const kind = choice(cursor, ["number","bigint","string","boolean","absence","unique-symbol","error"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  switch (kind.value) {
    case "number": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const value = readField(cursor, fields, "value", readExactRational);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        type: type.value, value: value.value
      } };
    }
    case "bigint": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const value = readField(cursor, fields, "value", readBigInt);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        type: type.value, value: value.value
      } };
    }
    case "string": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const value = readField(cursor, fields, "value", readString);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        type: type.value, value: value.value
      } };
    }
    case "boolean": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const value = readField(cursor, fields, "value", readBoolean);
      if (value.kind === "invalid-text") return value;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        type: type.value, value: value.value
      } };
    }
    case "absence": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        type: type.value
      } };
    }
    case "unique-symbol": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const declaration = readField(cursor, fields, "declaration", readDefinitionId);
      if (declaration.kind === "invalid-text") return declaration;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        type: type.value, declaration: declaration.value
      } };
    }
    case "error": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: kind.value,
        type: type.value
      } };
    }
  }
}

export function readExactRational(cursor: Cursor): TextParseResult<ExactRational> {
  const kind = choice(cursor, ["ExactRational"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const numerator = readField(cursor, fields, "numerator", readBigInt);
  if (numerator.kind === "invalid-text") return numerator;
  const denominator = readField(cursor, fields, "denominator", readBigInt);
  if (denominator.kind === "invalid-text") return denominator;
  const negativeZero = readField(cursor, fields, "negativeZero", readBoolean);
  if (negativeZero.kind === "invalid-text") return negativeZero;
  const closed = closeRecord(cursor, fields);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    numerator: numerator.value, denominator: denominator.value, negativeZero: negativeZero.value
  } };
}

export function readParameterIdentity(cursor: Cursor): TextParseResult<TypeParameterIdentity> {
  const opened = openRecord(cursor, "TypeParameterIdentity");
  if (opened.kind === "invalid-text") return opened;
  const owner = readField(cursor, opened.value, "owner", readDefinitionId);
  if (owner.kind === "invalid-text") return owner;
  const index = readField(cursor, opened.value, "index", readNumber);
  if (index.kind === "invalid-text") return index;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { owner: owner.value, index: index.value } };
}

export function readTypeBinding(cursor: Cursor): TextParseResult<TypeBinding> {
  const kind = choice(cursor, ["bound", "rigid"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const parameter = readField(cursor, fields, "parameter", readParameterIdentity);
  if (parameter.kind === "invalid-text") return parameter;
  switch (kind.value) {
    case "rigid": {
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: "rigid", parameter: parameter.value } };
    }
    case "bound": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: "bound", parameter: parameter.value, type: type.value } };
    }
  }
}

export function readSelfBinding(cursor: Cursor): TextParseResult<SelfBinding> {
  const kind = choice(cursor, ["bound", "rigid"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  const owner = readField(cursor, fields, "owner", readDefinitionId);
  if (owner.kind === "invalid-text") return owner;
  switch (kind.value) {
    case "rigid": {
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: "rigid", owner: owner.value } };
    }
    case "bound": {
      const type = readField(cursor, fields, "type", readTypeId);
      if (type.kind === "invalid-text") return type;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: "bound", owner: owner.value, type: type.value } };
    }
  }
}

export function readBindings(cursor: Cursor): TextParseResult<BindingVector> {
  const opened = openRecord(cursor, "BindingVector");
  if (opened.kind === "invalid-text") return opened;
  const classBindings = readField(cursor, opened.value, "classBindings", next => readArray(next, readTypeBinding));
  if (classBindings.kind === "invalid-text") return classBindings;
  const methodBindings = readField(cursor, opened.value, "methodBindings", next => readArray(next, readTypeBinding));
  if (methodBindings.kind === "invalid-text") return methodBindings;
  const capturedBindings = readField(cursor, opened.value, "capturedBindings", next => readArray(next, readTypeBinding));
  if (capturedBindings.kind === "invalid-text") return capturedBindings;
  const selfBindings = readField(cursor, opened.value, "selfBindings", next => readArray(next, readSelfBinding));
  if (selfBindings.kind === "invalid-text") return selfBindings;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: {
    classBindings: classBindings.value, methodBindings: methodBindings.value,
    capturedBindings: capturedBindings.value, selfBindings: selfBindings.value,
  } };
}

export function readArtifactBindings(cursor: Cursor): TextParseResult<ArtifactBindings> {
  const kind = choice(cursor, ["parametric", "instantiated"]);
  if (kind.kind === "invalid-text") return kind;
  const opened = delimiter(cursor, "(");
  if (opened.kind === "invalid-text") return opened;
  const fields: RecordFields = { given: new Set<string>() };
  switch (kind.value) {
    case "parametric": {
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: "parametric" } };
    }
    case "instantiated": {
      const bindings = readField(cursor, fields, "bindings", readBindings);
      if (bindings.kind === "invalid-text") return bindings;
      const closed = closeRecord(cursor, fields);
      return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { kind: "instantiated", bindings: bindings.value } };
    }
  }
}

export function readExecution(cursor: Cursor): TextParseResult<Execution> {
  const opened = openRecord(cursor, "Execution");
  if (opened.kind === "invalid-text") return opened;
  const instance = readField(cursor, opened.value, "instance", readInstance);
  if (instance.kind === "invalid-text") return instance;
  const provided = readField(cursor, opened.value, "provided", readNumber);
  if (provided.kind === "invalid-text") return provided;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { instance: instance.value, provided: provided.value } };
}

function readSignatureRequest(cursor: Cursor): TextParseResult<SignatureRequest> {
  const opened = openRecord(cursor, "SignatureRequest");
  if (opened.kind === "invalid-text") return opened;
  const definition = readField(cursor, opened.value, "definition", readDefinitionId);
  if (definition.kind === "invalid-text") return definition;
  const endpoint = readField(cursor, opened.value, "endpoint", next => readStringChoice(next, ["advertised", "api-signature", "api-body"]));
  if (endpoint.kind === "invalid-text") return endpoint;
  const ordinal = readField(cursor, opened.value, "ordinal", readNumber);
  if (ordinal.kind === "invalid-text") return ordinal;
  const bindings = readField(cursor, opened.value, "bindings", readArtifactBindings);
  if (bindings.kind === "invalid-text") return bindings;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed",
    value: { definition: definition.value, endpoint: endpoint.value, ordinal: ordinal.value, bindings: bindings.value } };
}

export function readDeclaredExecution(cursor: Cursor): TextParseResult<DeclaredExecution> {
  const opened = openRecord(cursor, "DeclaredExecution");
  if (opened.kind === "invalid-text") return opened;
  const request = readField(cursor, opened.value, "request", readSignatureRequest);
  if (request.kind === "invalid-text") return request;
  const provided = readField(cursor, opened.value, "provided", readNumber);
  if (provided.kind === "invalid-text") return provided;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { request: request.value, provided: provided.value } };
}

export function readInstance(cursor: Cursor): TextParseResult<BodyInstance> {
  const opened = openRecord(cursor, "BodyInstance");
  if (opened.kind === "invalid-text") return opened;
  const body = readField(cursor, opened.value, "body", readBodyId);
  if (body.kind === "invalid-text") return body;
  const bindings = readField(cursor, opened.value, "bindings", readArtifactBindings);
  if (bindings.kind === "invalid-text") return bindings;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { body: body.value, bindings: bindings.value } };
}

export function readConstantReference(cursor: Cursor): TextParseResult<ConstantReference> {
  const opened = openRecord(cursor, "ConstantReference");
  if (opened.kind === "invalid-text") return opened;
  const initializer = readField(cursor, opened.value, "initializer", readInstance);
  if (initializer.kind === "invalid-text") return initializer;
  const context = readField(cursor, opened.value, "context", next => readStringChoice(next, ["enum-member", "fixed-array-extent", "compile-time"]));
  if (context.kind === "invalid-text") return context;
  const closed = closeRecord(cursor, opened.value);
  return closed.kind === "invalid-text" ? closed : { kind: "parsed", value: { initializer: initializer.value, context: context.value } };
}
