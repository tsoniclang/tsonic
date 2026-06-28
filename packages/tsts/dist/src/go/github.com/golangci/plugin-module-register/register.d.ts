import type { int } from "../../../scalars.js";
export declare const LinterPlugin: int;
export declare const LoadModeTypesInfo: int;
export interface PluginRegistration {
    Kind: int;
    Name: string;
    Analyzer: unknown;
    LoadMode: int;
}
export declare function Plugin(kind: int, name: string, analyzer: unknown, loadMode: int): PluginRegistration;
//# sourceMappingURL=register.d.ts.map