export interface TargetUseSiteRef {
    readonly subject: object;
    readonly role: string;
    readonly enclosingContract: string;
    readonly specialization?: string;
}
export declare function targetUseSiteRef(subject: object, role: string, enclosingContract: string, specialization?: string): TargetUseSiteRef;
export declare function targetUseSiteIdentity(use: Omit<TargetUseSiteRef, "subject">): string;
//# sourceMappingURL=use-sites.d.ts.map