import { Console } from "@tsonic/dotnet/System.js";

class Builder {
  then(value: number): number {
    return value + 1;
  }
}

const builder = new Builder();
Console.WriteLine(builder.then(1));
