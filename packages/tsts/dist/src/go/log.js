import { Sprintf } from "./fmt.js";
export const Ldate = 1;
export const Ltime = 2;
export const Lmicroseconds = 4;
export const Llongfile = 8;
export const Lshortfile = 16;
export const LUTC = 32;
export const Lmsgprefix = 64;
export const LstdFlags = (Ldate | Ltime);
let flags = LstdFlags;
export function SetFlags(nextFlags) {
    flags = nextFlags;
}
export function Flags() {
    return flags;
}
export function Printf(format, ...args) {
    globalThis.console.error(formatMessage(format, args));
}
export function Fatalf(format, ...args) {
    throw new globalThis.Error(formatMessage(format, args));
}
function formatMessage(format, args) {
    return Sprintf(format, ...args);
}
//# sourceMappingURL=log.js.map