import { Assert } from "xunit-types/Xunit.js";
import type { JsValue } from "@tsonic/core/types.js";

declare class EventEmitter {
  on(eventName: string, listener: (value: JsValue) => void): void;
  emit(eventName: string, value: JsValue): void;
}

export function run(emitter: EventEmitter): void {
  let received: JsValue = null;
  emitter.on("test", (value) => {
    received = value;
  });
  emitter.emit("test", 42);
  Assert.Equal(42, received);
}
