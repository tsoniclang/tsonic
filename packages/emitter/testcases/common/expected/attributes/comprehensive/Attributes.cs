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