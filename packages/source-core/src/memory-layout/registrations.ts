import type { ProviderDeclarationIdentity } from "@tsonic/tsts";
import {
  dataLayoutsEqual, snapshotDataLayout, snapshotDataLayoutDescriptor, snapshotDataLayoutIdentity,
} from "./facts.js";
import type { TsonicDataLayoutFact, TsonicDataLayoutRegistration } from "./facts.js";
import { exactRecord } from "./snapshots.js";

export function dataLayoutIdentityKey(identity: ProviderDeclarationIdentity): string {
  return JSON.stringify([
    identity.providerId, identity.providerVersion, identity.providerModuleId,
    identity.moduleSpecifier, identity.exportId,
  ]);
}

export function captureDataLayoutRegistrations(
  registrations: readonly TsonicDataLayoutRegistration[],
): ReadonlyMap<string, TsonicDataLayoutFact> {
  if (!Array.isArray(registrations)) throw new Error("Data-layout registrations must be an array.");
  const results = new Map<string, TsonicDataLayoutFact>();
  for (const registration of registrations) {
    const record = exactRecord(registration, ["providerDeclaration", "descriptor"]);
    const providerDeclaration = snapshotDataLayoutIdentity(record.providerDeclaration);
    const descriptor = snapshotDataLayoutDescriptor(record.descriptor);
    const fact = snapshotDataLayout({ providerDeclaration, ...descriptor });
    const key = dataLayoutIdentityKey(providerDeclaration);
    const previous = results.get(key);
    if (previous !== undefined && !dataLayoutsEqual(previous, fact)) {
      throw new Error(`Conflicting data-layout registration for ${key}.`);
    }
    results.set(key, fact);
  }
  return results;
}
