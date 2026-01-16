namespace TestCases.common.attributes.basic
{
    [global::System.SerializableAttribute]
    public class User
    {
        public string Name;

        public double Age;
    }
    [global::System.ObsoleteAttribute("Use NewConfig instead")]
    public class Config
    {
        public string Setting;
    }
    [global::System.SerializableAttribute]
    [global::System.ObsoleteAttribute("Deprecated")]
    public class LegacyService
    {
        public string Data;
    }
}
