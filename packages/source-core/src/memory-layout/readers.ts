import type { ExtensionFactSubject, ReadonlySourceFactResolver } from "@tsonic/tsts";
import { tsonicKeepAliveFactKey, tsonicRawMemoryOperationFactKey } from "../pointers/raw-memory/facts.js";
import { tsonicDataLayoutFactKey, tsonicMemoryFieldLayoutFactKey, tsonicMemoryLayoutFactKey, tsonicMemoryLayoutQueryFactKey } from "./facts.js";

export function readTsonicDataLayout(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicDataLayoutFactKey);
}

export function readTsonicMemoryFieldLayout(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryFieldLayoutFactKey);
}

export function readTsonicMemoryLayout(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryLayoutFactKey);
}

export function readTsonicMemoryLayoutQuery(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicMemoryLayoutQueryFactKey);
}

export function readTsonicRawMemoryOperation(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicRawMemoryOperationFactKey);
}

export function readTsonicKeepAlive(facts: ReadonlySourceFactResolver, subject: ExtensionFactSubject | undefined) {
  return facts.getFact(subject, tsonicKeepAliveFactKey);
}
