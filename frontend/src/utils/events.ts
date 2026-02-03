type EventType = 'api-error' | 'unauthorized'

export const eventBus = {
  on(event: EventType, callback: (detail: any) => void) {
    document.addEventListener(event, (e) => callback((e as CustomEvent).detail))
  },
  dispatch(event: EventType, detail: any) {
    document.dispatchEvent(new CustomEvent(event, { detail }))
  },
  remove(event: EventType, callback: (detail: any) => void) {
    document.removeEventListener(event, (e) => callback((e as CustomEvent).detail))
  },
}
