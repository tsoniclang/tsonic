import type { DataflowAccount, DataflowStop } from "../dataflow/contract.js";
import { chargeResultEntries, chargeWork } from "../dataflow/index.js";
import type { LibraryExportIdentity } from "../ids/contract.js";
import type { BindingScope, BindingVector, SignatureRequest } from "../ir-types/contract.js";
import { rigidBindings } from "../ir-types/index.js";

export function admitNativeIdentity(account: DataflowAccount, identity: LibraryExportIdentity): DataflowStop | null {
  const fields = chargeWork(account, 8);
  if (fields !== null) return fields;
  const module = identity.module;
  return chargeWork(account, module.providerId.length + module.providerVersion.length + (module.packageName?.length ?? 0)
    + module.moduleSpecifier.length + module.providerModuleId.length + identity.exportId.length
    + (identity.memberId?.length ?? 0) + (identity.signatureId?.length ?? 0));
}

export function declaredScopeBindings(account: DataflowAccount, request: SignatureRequest, scope: BindingScope): BindingVector | DataflowStop {
  const read = chargeWork(account, 1);
  if (read !== null) return read;
  const bindings = request.bindings;
  if (bindings.kind === "instantiated") return bindings.bindings;
  const headers = chargeWork(account, 4);
  if (headers !== null) return headers;
  const count = scope.classParameters.length + scope.methodParameters.length + scope.capturedParameters.length + scope.selfOwners.length;
  const stop = chargeWork(account, count) ?? chargeResultEntries(account, 5 + 2 * count);
  return stop ?? rigidBindings(scope);
}
