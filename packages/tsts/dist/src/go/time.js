const nanosecondsPerMillisecond = 1_000_000;
const nanosecondsPerSecond = 1_000_000_000;
const nanosecondsPerMinute = 60 * nanosecondsPerSecond;
export const Millisecond = nanosecondsPerMillisecond;
export const Second = nanosecondsPerSecond;
export const Minute = nanosecondsPerMinute;
export class Time {
    #date;
    constructor(date = 0) {
        this.#date = date instanceof Date ? new Date(date.getTime()) : new Date(date);
    }
    Sub(other) {
        return ((this.#date.getTime() - other.#date.getTime()) * nanosecondsPerMillisecond);
    }
    UnixMilli() {
        return this.#date.getTime();
    }
    IsZero() {
        return this.#date.getTime() === 0;
    }
    ToDate() {
        return new Date(this.#date.getTime());
    }
}
export function After(duration) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(Now()), durationToMilliseconds(duration));
    });
}
export function AfterFunc(duration, callback) {
    const handle = setTimeout(callback, durationToMilliseconds(duration));
    return {
        C: Promise.resolve(Now()),
        Stop: () => {
            clearTimeout(handle);
            return true;
        },
    };
}
export function NewTicker(duration) {
    let stopped = false;
    return {
        C: {
            async *[Symbol.asyncIterator]() {
                while (!stopped) {
                    await Sleep(duration);
                    if (!stopped) {
                        yield Now();
                    }
                }
            },
        },
        Stop: () => {
            stopped = true;
        },
    };
}
export function NewTimer(duration) {
    let active = true;
    let handle;
    const promise = new Promise((resolve) => {
        handle = setTimeout(() => {
            active = false;
            resolve(Now());
        }, durationToMilliseconds(duration));
    });
    return {
        C: promise,
        Stop: () => {
            if (!active) {
                return false;
            }
            clearTimeout(handle);
            active = false;
            return true;
        },
    };
}
export function Now() {
    return new Time(new Date());
}
export function Since(time) {
    return Now().Sub(time);
}
export function Sleep(duration) {
    return new Promise((resolve) => {
        setTimeout(resolve, durationToMilliseconds(duration));
    });
}
export function Unix(seconds, nanoseconds) {
    return new Time(seconds * 1000 + Math.floor(nanoseconds / nanosecondsPerMillisecond));
}
export function UnixMilli(milliseconds) {
    return new Time(milliseconds);
}
const durationToMilliseconds = (duration) => {
    return Math.max(0, Math.floor(duration / nanosecondsPerMillisecond));
};
//# sourceMappingURL=time.js.map