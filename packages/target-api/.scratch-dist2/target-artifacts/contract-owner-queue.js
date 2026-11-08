var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _DeterministicOwnerQueue_instances, _DeterministicOwnerQueue_heap, _DeterministicOwnerQueue_members, _DeterministicOwnerQueue_removeRoot, _DeterministicOwnerQueue_bubbleUp, _DeterministicOwnerQueue_bubbleDown;
export class DeterministicOwnerQueue {
    constructor() {
        _DeterministicOwnerQueue_instances.add(this);
        _DeterministicOwnerQueue_heap.set(this, []);
        _DeterministicOwnerQueue_members.set(this, new Set());
    }
    get size() {
        return __classPrivateFieldGet(this, _DeterministicOwnerQueue_members, "f").size;
    }
    push(owner) {
        if (__classPrivateFieldGet(this, _DeterministicOwnerQueue_members, "f").has(owner)) {
            return;
        }
        __classPrivateFieldGet(this, _DeterministicOwnerQueue_members, "f").add(owner);
        __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f").push(owner);
        __classPrivateFieldGet(this, _DeterministicOwnerQueue_instances, "m", _DeterministicOwnerQueue_bubbleUp).call(this, __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f").length - 1);
    }
    pop() {
        while (__classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f").length > 0) {
            const owner = __classPrivateFieldGet(this, _DeterministicOwnerQueue_instances, "m", _DeterministicOwnerQueue_removeRoot).call(this);
            if (!__classPrivateFieldGet(this, _DeterministicOwnerQueue_members, "f").delete(owner)) {
                continue;
            }
            return owner;
        }
        return undefined;
    }
    discard(owner) {
        __classPrivateFieldGet(this, _DeterministicOwnerQueue_members, "f").delete(owner);
    }
}
_DeterministicOwnerQueue_heap = new WeakMap(), _DeterministicOwnerQueue_members = new WeakMap(), _DeterministicOwnerQueue_instances = new WeakSet(), _DeterministicOwnerQueue_removeRoot = function _DeterministicOwnerQueue_removeRoot() {
    const root = __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[0];
    const tail = __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f").pop();
    if (__classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f").length > 0 && tail !== undefined) {
        __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[0] = tail;
        __classPrivateFieldGet(this, _DeterministicOwnerQueue_instances, "m", _DeterministicOwnerQueue_bubbleDown).call(this, 0);
    }
    return root;
}, _DeterministicOwnerQueue_bubbleUp = function _DeterministicOwnerQueue_bubbleUp(start) {
    let index = start;
    while (index > 0) {
        const parent = Math.floor((index - 1) / 2);
        if (__classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[parent].localeCompare(__classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[index]) <= 0) {
            return;
        }
        [__classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[parent], __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[index]] = [
            __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[index],
            __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[parent],
        ];
        index = parent;
    }
}, _DeterministicOwnerQueue_bubbleDown = function _DeterministicOwnerQueue_bubbleDown(start) {
    let index = start;
    while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f").length &&
            __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[left].localeCompare(__classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[smallest]) < 0) {
            smallest = left;
        }
        if (right < __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f").length &&
            __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[right].localeCompare(__classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[smallest]) < 0) {
            smallest = right;
        }
        if (smallest === index) {
            return;
        }
        [__classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[index], __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[smallest]] = [
            __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[smallest],
            __classPrivateFieldGet(this, _DeterministicOwnerQueue_heap, "f")[index],
        ];
        index = smallest;
    }
};
//# sourceMappingURL=contract-owner-queue.js.map