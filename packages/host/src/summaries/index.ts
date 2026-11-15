import type { BindDeclaredSummary, ComponentsOf, DependenciesOf, ConvergeComponent } from "./contract.js";
import { bindDeclaredSummary as bind } from "./bind-declared.js";
import { componentsOf as components } from "./components.js";
import { dependenciesOf as dependencies } from "./dependencies.js";
import { convergeComponent as converge } from "./converge.js";

export const bindDeclaredSummary: BindDeclaredSummary = bind;
export const componentsOf: ComponentsOf = components;
export const dependenciesOf: DependenciesOf = dependencies;
export const convergeComponent: ConvergeComponent = converge;
