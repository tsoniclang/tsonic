import { stringify } from "./helper.ts";

export abstract class console {
  public static log(message: string): void {
    void stringify(message);
  }
}
