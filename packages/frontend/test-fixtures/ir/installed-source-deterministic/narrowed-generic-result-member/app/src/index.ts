import type { JsValue } from "@tsonic/core/types.js";
import { getChannel } from "@fixture/domain/index.js";

export function run(): Record<string, JsValue> {
  const result = getChannel();
  if (!result.success) {
    return {};
  }

  const ch = result.data;
  const stream: Record<string, JsValue> = {};
  stream["message_retention_days"] = ch.MessageRetentionDays ?? null;
  return stream;
}
