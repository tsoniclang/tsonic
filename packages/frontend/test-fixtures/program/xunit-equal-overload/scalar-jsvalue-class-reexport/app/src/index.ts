import { Assert } from "xunit-types/Xunit.js";
import type { JsValue } from "@tsonic/core/types.js";

declare class EventEmitter {
  static once(emitter: EventEmitter, eventName: string): Promise<JsValue[]>;
}

export async function run(emitter: EventEmitter): Promise<void> {
  const args = await EventEmitter.once(emitter, "test");
  Assert.Equal("arg1", args[0]);
}
