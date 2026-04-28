import { stringify } from "./helper.ts";

export class console {
  static log(message: string): void {
    void stringify(message);
  }
}
