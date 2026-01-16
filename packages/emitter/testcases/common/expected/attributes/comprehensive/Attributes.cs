namespace TestCases.common.attributes.comprehensive
{
    [global::System.SerializableAttribute]
    public class User
    {
        [global::System.ObsoleteAttribute("ctor")]
        public User()
            {
            }

        private string NameField;

        [global::System.ObsoleteAttribute("prop")]
        public string Name
            {
            get
                {
                return this.NameField;
                }
            set
                {
                this.NameField = value;
                }
            }

        [global::System.ObsoleteAttribute("method")]
        public void Save()
            {
            }
    }
    public class NoCtor
    {
        [global::System.ObsoleteAttribute("implicit")]
        public NoCtor()
            {
            }

        public double Value;
    }
}
