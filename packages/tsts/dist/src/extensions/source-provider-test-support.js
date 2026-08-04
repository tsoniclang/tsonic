import { TstsSourceProviderContractVersion, } from "./index.js";
export const testCoreDeclarations = [
    "interface Object {}",
    "interface Function {}",
    "interface CallableFunction extends Function {}",
    "interface NewableFunction extends Function {}",
    "interface IArguments {}",
    "interface String {}",
    "interface Number {}",
    "interface Boolean {}",
    "interface RegExp {}",
    "interface Array<T> { readonly length: number; [index: number]: T; }",
].join("\n");
export const testNoLibCompilerOptions = Object.freeze({
    noLib: true,
    module: "esnext",
    moduleResolution: "bundler",
});
export function sourceProviderExtension(models, options = {}) {
    const extensionId = options.extensionId ?? "test.source-provider.extension";
    const providerId = options.providerId ?? "test.source-provider";
    const provider = {
        identity: {
            id: providerId,
            version: "1.0.0",
            extensionContractVersion: TstsSourceProviderContractVersion,
            diagnosticRange: { start: 9_900_000, end: 9_900_099 },
        },
        declarationMaterialization: options.declarationMaterialization ?? "complete",
        ownsModule(specifier, context) {
            options.onContext?.(specifier, context);
            return models.has(specifier)
                ? { kind: "owned" }
                : { kind: "unowned" };
        },
        resolveModule(specifier) {
            const model = models.get(specifier);
            if (model === undefined) {
                return providerDiagnostic(providerId, "TEST_PROVIDER_MODULE_MISSING", `No model exists for '${specifier}'.`);
            }
            return {
                kind: "virtual",
                moduleSpecifier: specifier,
                virtualFileName: `/provider/${model.providerModuleId.replaceAll(".", "/")}.d.ts`,
                providerModuleId: model.providerModuleId,
            };
        },
        getDeclarationModel(resolution, request) {
            const model = models.get(resolution.moduleSpecifier);
            if (model === undefined) {
                return providerDiagnostic(providerId, "TEST_PROVIDER_MODEL_MISSING", `No declaration model exists for '${resolution.moduleSpecifier}'.`);
            }
            return options.getDeclarationModel?.(resolution, model, request) ?? model;
        },
    };
    return {
        identity: {
            id: extensionId,
            version: "1.0.0",
        },
        initialize(context) {
            context.registerSourceDeclarationProvider(provider);
        },
    };
}
export function sourceProviderCompilerExtension(provider, extensionId = `${provider.identity.id}.extension`) {
    return {
        identity: {
            id: extensionId,
            version: "1.0.0",
        },
        initialize(context) {
            context.registerSourceDeclarationProvider(provider);
        },
    };
}
export function testProviderIdentity(id) {
    return {
        id,
        version: "1.0.0",
        extensionContractVersion: TstsSourceProviderContractVersion,
    };
}
export function testProviderModel(moduleSpecifier, providerModuleId, exports = [{
        id: "Value",
        name: "Value",
        kind: "value",
        type: { kind: "number" },
    }]) {
    return { moduleSpecifier, providerModuleId, exports };
}
export function findNodes(root, children, predicate) {
    const matches = [];
    const visit = (node) => {
        if (node === undefined) {
            return;
        }
        if (predicate(node)) {
            matches.push(node);
        }
        for (const child of children(node)) {
            visit(child);
        }
    };
    visit(root);
    return matches;
}
function providerDiagnostic(providerId, extensionCode, message) {
    return {
        category: "error",
        numericCode: 9900001,
        extensionId: providerId,
        extensionCode,
        message,
    };
}
//# sourceMappingURL=source-provider-test-support.js.map