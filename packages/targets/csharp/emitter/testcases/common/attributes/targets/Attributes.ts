import { attributes as A, AttributeTargets } from "@tsonic/core/lang.js";
import { NonSerializedAttribute } from "@tsonic/dotnet/System.js";
import {
  MarshalAsAttribute,
  UnmanagedType,
} from "@tsonic/dotnet/System.Runtime.InteropServices.js";

export class Native {
  foo(): boolean {
    return true;
  }
}

// C# emits: [return: MarshalAs(UnmanagedType.Bool)]
A<Native>()
  .method((x) => x.foo)
  .target(AttributeTargets.return)
  .add(MarshalAsAttribute, UnmanagedType.Bool);

export class Data {
  value!: string;
}

// C# emits: [field: NonSerialized]
A<Data>()
  .prop((x) => x.value)
  .target("field")
  .add(NonSerializedAttribute);
