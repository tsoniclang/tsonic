import type { int } from "@tsonic/core/types.js";

class Bucket {
  pageviews: int = 0;
}

type Query = {
  limit?: int;
};

function takeInt(value: int): void {}

function takeMaybeInt(value?: int): void {}

export function run(
  query: Query,
  bucket: Bucket,
  ua: string
): string | undefined {
  takeInt(bucket.pageviews);
  takeMaybeInt(query.limit);

  const userAgent = ua.Trim() === "" ? undefined : ua;
  return userAgent;
}
