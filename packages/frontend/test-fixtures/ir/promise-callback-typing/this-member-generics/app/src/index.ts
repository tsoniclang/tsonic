type RuntimeValue = string | number | boolean | object | null;
type EventListener = (...args: RuntimeValue[]) => void;
type ListenerRegistration = {
  readonly invoke: EventListener;
};

export class Emitter {
  private readonly listenersByEvent: Map<string, ListenerRegistration[]> =
    new Map<string, ListenerRegistration[]>();

  public emit(eventName: string, ...args: RuntimeValue[]): boolean {
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
