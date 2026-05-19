import type { field } from "@tsonic/core/lang.js";

export class User {
  name: field<string> = "alice";

  nickname: string = "ali";

  email: field<string> = "a@example.com";
}
