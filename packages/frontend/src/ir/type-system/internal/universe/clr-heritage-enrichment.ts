/**
 * CLR Heritage Enrichment
 *
 * Enrichment of assembly NominalEntry structures with .d.ts info:
 * - Applying member types from tsbindgen .d.ts to assembly entries
 * - Applying method signature optionals from .d.ts to assembly entries
 */

import type { IrType } from "../../../types/index.js";
import type { TypeId, NominalEntry, MemberEntry } from "./types.js";
import { makeMethodSignatureKey } from "./clr-type-parser.js";
import { extractHeritageFromTsBindgenDts } from "./clr-heritage-extraction.js";

export const enrichAssemblyEntriesFromTsBindgenDts = (
  entries: Map<string, NominalEntry>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>,
  dtsPaths: readonly string[]
): void => {
  const mergedTypeParameters = new Map<string, readonly string[]>();
  const mergedMemberTypes = new Map<string, Map<string, IrType>>();
  const mergedMethodSignatureSurfaces = new Map<
    string,
    Map<
      string,
      {
        readonly typeParameterNames: readonly string[];
        readonly parameters: readonly {
          readonly type: IrType;
          readonly isRest: boolean;
          readonly isOptional: boolean;
        }[];
        readonly returnType: IrType;
      }
    >
  >();
  const mergedMethodSignatureOptionals = new Map<
    string,
    Map<string, readonly boolean[]>
  >();

  for (const dtsPath of dtsPaths) {
    const info = extractHeritageFromTsBindgenDts(
      dtsPath,
      tsNameToTypeId,
      entries
    );

    for (const [tsName, typeParameters] of info.typeParametersByTsName) {
      if (!mergedTypeParameters.has(tsName)) {
        mergedTypeParameters.set(tsName, typeParameters);
      }
    }

    for (const [tsName, memberTypes] of info.memberTypesByTsName) {
      const merged =
        mergedMemberTypes.get(tsName) ?? new Map<string, IrType>();
      for (const [memberName, type] of memberTypes) {
        if (!merged.has(memberName)) {
          merged.set(memberName, type);
        }
      }
      mergedMemberTypes.set(tsName, merged);
    }

    for (const [
      tsName,
      signatureSurfaces,
    ] of info.methodSignatureSurfacesByTsName) {
      const merged =
        mergedMethodSignatureSurfaces.get(tsName) ??
        new Map<
          string,
          {
            readonly typeParameterNames: readonly string[];
            readonly parameters: readonly {
              readonly type: IrType;
              readonly isRest: boolean;
              readonly isOptional: boolean;
            }[];
            readonly returnType: IrType;
          }
        >();
      for (const [sigKey, surface] of signatureSurfaces) {
        if (!merged.has(sigKey)) {
          merged.set(sigKey, surface);
        }
      }
      mergedMethodSignatureSurfaces.set(tsName, merged);
    }

    for (const [
      tsName,
      signatureOptionals,
    ] of info.methodSignatureOptionalsByTsName) {
      const merged =
        mergedMethodSignatureOptionals.get(tsName) ??
        new Map<string, readonly boolean[]>();
      for (const [sigKey, optionals] of signatureOptionals) {
        if (!merged.has(sigKey)) {
          merged.set(sigKey, optionals);
        }
      }
      mergedMethodSignatureOptionals.set(tsName, merged);
    }
  }

  // Apply merged info to entries
  for (const [tsName, typeId] of tsNameToTypeId) {
    const entry = entries.get(typeId.stableId);
    if (!entry) continue;

    const typeParameters = mergedTypeParameters.get(tsName);
    const memberTypes = mergedMemberTypes.get(tsName);
    const signatureSurfaces = mergedMethodSignatureSurfaces.get(tsName);
    const signatureOptionals = mergedMethodSignatureOptionals.get(tsName);
    let updatedEntry: NominalEntry | undefined;

    if (
      typeParameters &&
      typeParameters.length === entry.typeParameters.length &&
      typeParameters.some(
        (name, index) => name !== entry.typeParameters[index]?.name
      )
    ) {
      updatedEntry = {
        ...entry,
        typeParameters: entry.typeParameters.map((parameter, index) => ({
          ...parameter,
          name: typeParameters[index] ?? parameter.name,
        })),
      };
    }

    const baseEntry = updatedEntry ?? entry;
    let updatedMembers: Map<string, MemberEntry> | undefined;
    if (memberTypes) {
      for (const [memberName, type] of memberTypes) {
        const member = baseEntry.members.get(memberName);
        if (!member) continue;
        if (!updatedMembers) {
          updatedMembers = new Map(baseEntry.members);
        }
        updatedMembers.set(memberName, { ...member, type });
      }
    }

    if (signatureOptionals || signatureSurfaces) {
      const currentMembers = updatedMembers ?? baseEntry.members;
      for (const [memberName, member] of currentMembers) {
        if (member.memberKind !== "method" || !member.signatures) continue;

        let memberChanged = false;
        const updatedSignatures = member.signatures.map((sig) => {
          const signatureKey = makeMethodSignatureKey({
            isStatic: sig.isStatic,
            name: memberName,
            typeParamCount: sig.typeParameters.length,
            parameters: sig.parameters.map((p) => ({
              type: p.type,
              isRest: p.isRest,
            })),
            returnType: sig.returnType,
          });

          const surface = signatureSurfaces?.get(signatureKey);
          const optionals = signatureOptionals?.get(signatureKey);
          const updatedParams =
            surface && surface.parameters.length === sig.parameters.length
              ? sig.parameters.map((parameter, idx) => {
                  const surfaceParameter = surface.parameters[idx];
                  if (!surfaceParameter) {
                    return parameter;
                  }

                  return {
                    ...parameter,
                    type: surfaceParameter.type,
                    isOptional: surfaceParameter.isOptional,
                    isRest: surfaceParameter.isRest,
                  };
                })
              : optionals && optionals.length === sig.parameters.length
                ? sig.parameters.map((parameter, idx) => {
                    const isOptional = optionals[idx];
                    return isOptional === undefined ||
                      isOptional === parameter.isOptional
                      ? parameter
                      : { ...parameter, isOptional };
                  })
                : sig.parameters;

          const updatedTypeParameters =
            surface &&
            surface.typeParameterNames.length === sig.typeParameters.length
              ? sig.typeParameters.map((typeParameter, idx) => ({
                  ...typeParameter,
                  name: surface.typeParameterNames[idx] ?? typeParameter.name,
                }))
              : sig.typeParameters;

          const updatedSignature =
            updatedParams === sig.parameters &&
            updatedTypeParameters === sig.typeParameters &&
            !surface
              ? sig
              : {
                  ...sig,
                  parameters: updatedParams,
                  returnType: surface?.returnType ?? sig.returnType,
                  typeParameters: updatedTypeParameters,
                };

          if (updatedSignature === sig) {
            return sig;
          }

          memberChanged = true;
          return updatedSignature;
        });

        if (!memberChanged) continue;

        if (!updatedMembers) {
          updatedMembers = new Map(entry.members);
        }
        updatedMembers.set(memberName, {
          ...member,
          signatures: updatedSignatures,
        });
      }
    }

    if (!updatedEntry && !updatedMembers) continue;

    entries.set(typeId.stableId, {
      ...(updatedEntry ?? entry),
      members: updatedMembers ?? baseEntry.members,
    });
  }
};
