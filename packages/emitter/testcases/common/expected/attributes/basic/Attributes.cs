// Generated from: Attributes.ts
// Generated at: 2026-02-25T02:59:42.280Z
// WARNING: Do not modify this file manually

namespace TestCases.common.attributes.basic
{
    [global::System.SerializableAttribute]
    public class User
    {
        public string name { get; set; }

        public double age { get; set; }
    }

    [global::System.ObsoleteAttribute("Use NewConfig instead")]
    public class Config
    {
        public string setting { get; set; }
    }

    [global::System.SerializableAttribute]
    [global::System.ObsoleteAttribute("Deprecated")]
    public class LegacyService
    {
        public string data { get; set; }
    }
}