import type { byte, int } from "@tsonic/core/types.js";
import { Buffer } from "@tsonic/nodejs/buffer.js";

export class Reader {
  read(buffer: Buffer, index: int): number | undefined {
    return buffer[index];
  }

  write(buffer: Buffer, index: int, value: byte): void {
    buffer[index] = value;
  }
}
