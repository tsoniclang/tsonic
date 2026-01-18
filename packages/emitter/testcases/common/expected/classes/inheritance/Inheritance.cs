// Generated from: Inheritance.ts
// Generated at: 2026-01-17T15:36:50.853Z
// WARNING: Do not modify this file manually

namespace TestCases.common.classes.inheritance
{
    public class Animal
    {
        public string name;

        public Animal(string name)
            {
            this.name = name;
            }

        public string makeSound()
            {
            return "Some sound";
            }
    }
    public class Dog : Animal
    {
        public string breed;

        public Dog(string name, string breed) : base(name)
            {
            this.breed = breed;
            }

        public override string makeSound()
            {
            return "Woof!";
            }
    }
}