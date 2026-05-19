import { listNextControls, useHandler } from "@fixture/pkg/middleware.js";

export function register(): void {
  const controls = listNextControls();
  const control = controls[0];
  useHandler(async (_req, _res, next) => {
    await next(control);
  });
}
