type EventListener = (...args: JsValue[]) => void;
type ListenerRegistration = {
  readonly invoke: EventListener;
};

export class Emitter {
  private readonly listenersByEvent: Map<string, ListenerRegistration[]> =
    new Map<string, ListenerRegistration[]>();

  public emit(eventName: string, ...args: JsValue[]): boolean {
    const registrations = this.listenersByEvent.get(eventName);
    if (registrations === undefined || registrations.length === 0) {
      return false;
    }
    const snapshot = registrations.slice();
    for (const registration of snapshot) {
      registration.invoke(...args);
    }
    return true;
  }
}
