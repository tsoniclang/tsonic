// Generated from: Attributes.ts
// Generated at: 2026-02-25T02:59:45.122Z
// WARNING: Do not modify this file manually

namespace TestCases.common.attributes.targets
{
    public class Native
    {
        [return: global::System.Runtime.InteropServices.MarshalAsAttribute(global::System.Runtime.InteropServices.UnmanagedType.Bool)]
        public bool foo()
        {
            return true;
        }
    }

    public class Data
    {
        [field: global::System.NonSerializedAttribute]
        public string value { get; set; }
    }
}