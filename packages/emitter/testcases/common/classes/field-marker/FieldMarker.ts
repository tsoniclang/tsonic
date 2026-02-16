import type { field } from "@tsonic/core/lang.js";

export class User {
  public name: field<string> = "alice";

  public nickname: string = "ali";

  public readonly email: field<string> = "a@example.com";
}
