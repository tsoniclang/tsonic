import type { Node } from "@tsonic/tsts";
import type { SourceNavigationCall } from "../../../source-model/navigation-records.js";
import type { SourceStorageBudget } from "../model/resource-budget.js";
import type { SourceStorageCallEffect, SourceStorageEffects } from "../model/types.js";
export declare function snapshotSourceStorageCallbackEffects(value: unknown, selected: SourceNavigationCall, budget: SourceStorageBudget): ReturnType<NonNullable<SourceStorageEffects["callbackEntries"]>>;
export declare function snapshotSourceStorageCallEffect(value: unknown, selected: SourceNavigationCall, 
/** The receiver expression of a member call (sourceStorageCallReceiver). */
receiver: Node | undefined, budget: SourceStorageBudget): SourceStorageCallEffect | undefined;
//# sourceMappingURL=call-effects.d.ts.map