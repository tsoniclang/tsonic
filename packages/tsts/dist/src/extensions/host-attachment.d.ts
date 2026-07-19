import type { ExtensionHost } from "./host.js";
export declare const extensionHostAllowsSemanticQueryPreflight: unique symbol;
export declare function registerAttachedExtensionHost(owner: object, host: ExtensionHost): void;
export declare function lookupAttachedExtensionHost(owner: object): ExtensionHost | undefined;
export declare function hasAttachedExtensionHost(owner: object): boolean;
//# sourceMappingURL=host-attachment.d.ts.map