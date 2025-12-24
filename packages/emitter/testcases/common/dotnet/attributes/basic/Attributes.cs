namespace TestCases.common.attributes.basic
{
    [SerializableAttribute]
    public class User
    {
        public string name;

        public double age;
    }
    [ObsoleteAttribute("Use NewConfig instead")]
    public class Config
    {
        public string setting;
    }
    [SerializableAttribute]
    [ObsoleteAttribute("Deprecated")]
    public class LegacyService
    {
        public string data;
    }
}