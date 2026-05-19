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