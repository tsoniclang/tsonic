// Generated from: Attributes.ts
// Generated at: 2026-01-17T15:36:38.460Z
// WARNING: Do not modify this file manually

namespace TestCases.common.attributes.basic
{
    [global::System.SerializableAttribute]
    public class User
    {
        public string name;

        public double age;
    }
    [global::System.ObsoleteAttribute("Use NewConfig instead")]
    public class Config
    {
        public string setting;
    }
    [global::System.SerializableAttribute]
    [global::System.ObsoleteAttribute("Deprecated")]
    public class LegacyService
    {
        public string data;
    }
}