import { int } from "@tsonic/core/types.js";

// Return in if branch should get function's return type
export function getInIf(condition: boolean): int {
  if (condition) {
    return 100;
  }
  return 200;
}

// Return in else branch
export function getInElse(condition: boolean): int {
  if (condition) {
    return 10;
  } else {
    return 20;
  }
}

// Return in while loop
export function getInWhile(count: int): int {
  while (count > 0) {
    return 50;
  }
  return 0;
}

// Return in switch case
export function getInSwitch(key: int): int {
  switch (key) {
    case 1:
      return 100;
    case 2:
      return 200;
    default:
      return 0;
  }
}
