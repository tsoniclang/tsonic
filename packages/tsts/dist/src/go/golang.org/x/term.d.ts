import type { bool, int } from "../../scalars.js";
import type { GoError } from "../../compat.js";
import type { File } from "../../os.js";
type TerminalDescriptor = int | File | {
    Fd(): int;
};
export declare function GetSize(descriptor: TerminalDescriptor): [int, int, GoError];
export declare function IsTerminal(descriptor: TerminalDescriptor): bool;
export {};
//# sourceMappingURL=term.d.ts.map