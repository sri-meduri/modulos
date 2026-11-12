/** Tiny pub/sub for cloud-save failures (data layer -> banner). */
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export const saveErrors = {
    emit: (message: string) => listeners.forEach(l => l(message)),
    subscribe: (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; },
};
