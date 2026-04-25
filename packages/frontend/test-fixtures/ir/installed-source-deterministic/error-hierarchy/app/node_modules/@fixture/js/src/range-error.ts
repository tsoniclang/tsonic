import { Error } from "./error-object.js";

export class RangeError extends Error {
  public name: string = "RangeError";

  public constructor(message?: string) {
    super(message);
  }
}
