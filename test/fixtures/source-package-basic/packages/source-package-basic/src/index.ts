import { clamp } from "@acme/math";

export function main(): void {
  console.log(clamp(10, 0, 5).toString());
}
