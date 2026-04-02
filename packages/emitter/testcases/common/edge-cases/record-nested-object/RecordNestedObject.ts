import type { JsValue } from "@tsonic/core/types.js";

export function getSettings(): Record<string, JsValue> {
  return {
    authentication_methods: {
      password: true,
      dev: true,
      "openid connect": false,
    },
  };
}
