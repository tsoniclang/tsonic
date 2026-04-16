import { useHandler } from "@fixture/pkg/middleware.js";

export function register(): void {
  useHandler(async (_req, _res, next) => {
    await next("route");
  });
}
