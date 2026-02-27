namespace TestCases.common.types.mapped
{
    public class Person
    {
        public required string name { get; set; }

        public required double age { get; set; }
    }

    [global::Tsonic.Internal.ModuleContainerAttribute]
    public static class MappedTypes
    {

    }
}