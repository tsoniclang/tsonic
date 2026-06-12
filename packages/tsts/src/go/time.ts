import type { long } from "@tsonic/core/types.js";

export type Duration = long;

const nanosecondsPerMillisecond = 1_000_000;
const nanosecondsPerSecond = 1_000_000_000;
const nanosecondsPerMinute = 60 * nanosecondsPerSecond;

export const Millisecond = nanosecondsPerMillisecond as Duration;

export const Second = nanosecondsPerSecond as Duration;

export const Minute = nanosecondsPerMinute as Duration;

export class Time {
  readonly #date: Date;

  constructor(date: Date | number | string = 0) {
    this.#date = date instanceof Date ? new Date(date.getTime()) : new Date(date);
  }

  Sub(other: Time): Duration {
    return ((this.#date.getTime() - other.#date.getTime()) * nanosecondsPerMillisecond) as Duration;
  }

  UnixMilli(): long {
    return this.#date.getTime() as long;
  }

  IsZero(): boolean {
    return this.#date.getTime() === 0;
  }

  ToDate(): Date {
    return new Date(this.#date.getTime());
  }
}

export interface Timer {
  C: Promise<Time>;
  Stop(): boolean;
}

export interface Ticker {
  C: AsyncIterable<Time>;
  Stop(): void;
}

export function After(duration: Duration): Promise<Time> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(Now()), durationToMilliseconds(duration));
  });
}

export function AfterFunc(duration: Duration, callback: () => void): Timer {
  const handle = setTimeout(callback, durationToMilliseconds(duration));
  return {
    C: Promise.resolve(Now()),
    Stop: () => {
      clearTimeout(handle);
      return true;
    },
  };
}

export function NewTicker(duration: Duration): Ticker {
  let stopped = false;
  return {
    C: {
      async *[Symbol.asyncIterator](): AsyncIterator<Time> {
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

export function NewTimer(duration: Duration): Timer {
  let active = true;
  let handle!: ReturnType<typeof setTimeout>;
  const promise = new Promise<Time>((resolve) => {
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

export function Now(): Time {
  return new Time(new Date());
}

export function Since(time: Time): Duration {
  return Now().Sub(time);
}

export function Sleep(duration: Duration): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationToMilliseconds(duration));
  });
}

export function Unix(seconds: long, nanoseconds: long): Time {
  return new Time((seconds as number) * 1000 + Math.floor((nanoseconds as number) / nanosecondsPerMillisecond));
}

export function UnixMilli(milliseconds: long): Time {
  return new Time(milliseconds as number);
}

const durationToMilliseconds = (duration: Duration): number => {
  return Math.max(0, Math.floor((duration as number) / nanosecondsPerMillisecond));
}
