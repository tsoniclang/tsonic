import type { GoSlice } from "../compat.js";
import type { Context, CancelFunc } from "../context.js";
import { Canceled } from "../context.js";

class signalContext implements Context {
  private canceled = false;

  constructor(private readonly parent: Context) {}

  cancel(): void {
    this.canceled = true;
  }

  Deadline(): ReturnType<Context["Deadline"]> {
    return this.parent.Deadline();
  }

  Done(): ReturnType<Context["Done"]> {
    return undefined;
  }

  Err(): ReturnType<Context["Err"]> {
    return this.canceled ? Canceled : this.parent.Err();
  }

  Value(key: unknown): unknown {
    return this.parent.Value(key);
  }
}

export function NotifyContext(parent: Context, ...signals: GoSlice<NodeJS.Signals | string>): [Context, CancelFunc] {
  const context = new signalContext(parent);
  const handlers = signals.map((signal) => {
    const handler = (): void => context.cancel();
    process.once(signal as NodeJS.Signals, handler);
    return { signal: signal as NodeJS.Signals, handler };
  });
  const stop = (): void => {
    context.cancel();
    for (const entry of handlers) {
      process.off(entry.signal, entry.handler);
    }
  };
  return [context, stop];
}
