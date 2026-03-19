/**
 * CLR Heritage Enrichment
 *
 * Enrichment of assembly NominalEntry structures with .d.ts info:
 * - Applying member types from tsbindgen .d.ts to assembly entries
 * - Applying method signature optionals from .d.ts to assembly entries
 */

import type { IrType } from "../../../types/index.js";
import type {
  TypeId,
  NominalEntry,
  MemberEntry,
} from "./types.js";
import { makeMethodSignatureKey } from "./clr-type-parser.js";
import { extractHeritageFromTsBindgenDts } from "./clr-heritage-extraction.js";

export const enrichAssemblyEntriesFromTsBindgenDts = (
  entries: Map<string, NominalEntry>,
  tsNameToTypeId: ReadonlyMap<string, TypeId>,
  dtsPaths: readonly string[]
): void => {
  const mergedMemberTypes = new Map<string, Map<string, IrType>>();
  const mergedMethodSignatureOptionals = new Map<
    string,
    Map<string, readonly boolean[]>
  >();

  for (const dtsPath of dtsPaths) {
    try {
      const info = extractHeritageFromTsBindgenDts(
        dtsPath,
        tsNameToTypeId,
        entries
      );

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
    } catch (e) {
      console.warn(
        `Failed to parse tsbindgen d.ts for enrichment: ${dtsPath}`,
        e
      );
    }
  }

  // Apply merged info to entries
  for (const [tsName, typeId] of tsNameToTypeId) {
    const entry = entries.get(typeId.stableId);
    if (!entry) continue;

    const memberTypes = mergedMemberTypes.get(tsName);
    const signatureOptionals = mergedMethodSignatureOptionals.get(tsName);
    let updatedMembers: Map<string, MemberEntry> | undefined;
    if (memberTypes) {
      for (const [memberName, type] of memberTypes) {
        const member = entry.members.get(memberName);
        if (!member) continue;
        if (!updatedMembers) {
          updatedMembers = new Map(entry.members);
        }
        updatedMembers.set(memberName, { ...member, type });
      }
    }

    if (signatureOptionals) {
      const currentMembers = updatedMembers ?? entry.members;
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

          const optionals = signatureOptionals.get(signatureKey);
          if (!optionals) return sig;
          if (optionals.length !== sig.parameters.length) return sig;

          const updatedParams = sig.parameters.map((p, idx) => {
            const isOptional = optionals[idx];
            return isOptional === undefined || isOptional === p.isOptional
              ? p
              : { ...p, isOptional };
          });

          if (updatedParams.every((p, idx) => p === sig.parameters[idx])) {
            return sig;
          }

          memberChanged = true;
          return { ...sig, parameters: updatedParams };
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

    if (!updatedMembers) continue;

    entries.set(typeId.stableId, { ...entry, members: updatedMembers });
  }
};
