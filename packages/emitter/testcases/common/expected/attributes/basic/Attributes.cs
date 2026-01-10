namespace TestCases.common.attributes.basic
{
    [global::SerializableAttribute]
    public class User
    {
        public string Name;

        public double Age;
    }
    [global::ObsoleteAttribute("Use NewConfig instead")]
    public class Config
    {
        public string Setting;
    }
    [global::SerializableAttribute]
    [global::ObsoleteAttribute("Deprecated")]
    public class LegacyService
    {
        public string Data;
    }
}