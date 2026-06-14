import type { GoSlice } from "../compat.js";
import type { Context, CancelFunc } from "../context.js";
export declare function NotifyContext(parent: Context, ...signals: GoSlice<NodeJS.Signals | string>): [Context, CancelFunc];
//# sourceMappingURL=signal.d.ts.map