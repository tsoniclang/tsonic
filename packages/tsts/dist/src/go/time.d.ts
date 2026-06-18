import type { long } from "@tsonic/core/types.js";
export type Duration = long;
export declare const Millisecond: Duration;
export declare const Second: Duration;
export declare const Minute: Duration;
export declare class Time {
    #private;
    constructor(date?: Date | number | string);
    Sub(other: Time): Duration;
    UnixMilli(): long;
    IsZero(): boolean;
    ToDate(): Date;
}
export interface Timer {
    C: Promise<Time>;
    Stop(): boolean;
}
export interface Ticker {
    C: AsyncIterable<Time>;
    Stop(): void;
}
export declare function After(duration: Duration): Promise<Time>;
export declare function AfterFunc(duration: Duration, callback: () => void): Timer;
export declare function NewTicker(duration: Duration): Ticker;
export declare function NewTimer(duration: Duration): Timer;
export declare function Now(): Time;
export declare function Since(time: Time): Duration;
export declare function Sleep(duration: Duration): Promise<void>;
export declare function Unix(seconds: long, nanoseconds: long): Time;
export declare function UnixMilli(milliseconds: long): Time;
//# sourceMappingURL=time.d.ts.map