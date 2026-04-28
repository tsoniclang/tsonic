import { getChannel } from "@fixture/domain/index.js";

type StreamValue = string | number | boolean | object | null;

export function run(): Record<string, StreamValue> {
  const result = getChannel();
  if (!result.success) {
    return {};
  }

  const ch = result.data;
  const stream: Record<string, StreamValue> = {};
  stream["message_retention_days"] = ch.MessageRetentionDays ?? null;
  return stream;
}
