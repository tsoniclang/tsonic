namespace TestCases.common.attributes.basic
{
    [global::SerializableAttribute]
    public class User
    {
        public string name;

        public double age;
    }
    [global::ObsoleteAttribute("Use NewConfig instead")]
    public class Config
    {
        public string setting;
    }
    [global::SerializableAttribute]
    [global::ObsoleteAttribute("Deprecated")]
    public class LegacyService
    {
        public string data;
    }
}