// Generated from: Attributes.ts
// Generated at: 2026-02-25T02:59:43.679Z
// WARNING: Do not modify this file manually

namespace TestCases.common.attributes.comprehensive
{
    [global::System.SerializableAttribute]
    public class User
    {
        [global::System.ObsoleteAttribute("ctor")]
        public User()
        {
        }

        private string _nameField { get; set; }

        [global::System.ObsoleteAttribute("prop")]
        public string name
        {
            get
            {
                return this._nameField;
            }
            set
            {
                this._nameField = value;
            }
        }

        [global::System.ObsoleteAttribute("method")]
        public void save()
        {
        }
    }

    public class NoCtor
    {
        [global::System.ObsoleteAttribute("implicit")]
        public NoCtor()
        {
        }

        public double value { get; set; }
    }
}