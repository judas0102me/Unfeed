import { BridgeMessage, wrapScript } from './bridge';

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

// Lo que el runner necesita del WebView.
export type ScriptTarget = { injectJavaScript(js: string): void };

// Ejecuta scripts en el WebView y espera su respuesta como una promesa.
// Cada script lleva un id; el mensaje `result` con ese id la resuelve o la rechaza.
export class ScriptRunner {
  private target: ScriptTarget | null = null;
  private readonly pending = new Map<string, Pending>();
  private readonly prefix = Math.random().toString(36).slice(2, 8);
  private seq = 0;

  // Se llama desde el `ref` del WebView: lo recibe al montarse y null al desmontarse.
  attach(target: ScriptTarget | null) {
    this.target = target;
  }

  run<T>(body: string, timeoutMs = 15000): Promise<T> {
    const target = this.target;
    if (!target) return Promise.reject(new Error('El WebView no está listo'));
    const id = `${this.prefix}-${++this.seq}`;
    return new Promise<T>((resolve, reject) => {
      // Si la página se recarga a mitad del script, la respuesta nunca llega.
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`El script no respondió en ${timeoutMs / 1000} s`));
      }, timeoutMs);
      this.pending.set(id, { resolve: v => resolve(v as T), reject, timer });
      target.injectJavaScript(wrapScript(id, body));
    });
  }

  // Devuelve true si el mensaje era la respuesta de un script.
  handle(msg: BridgeMessage): boolean {
    if (msg.type !== 'result') return false;
    const pending = this.pending.get(msg.id);
    if (!pending) return true;
    clearTimeout(pending.timer);
    this.pending.delete(msg.id);
    if (msg.ok) pending.resolve(msg.value);
    else pending.reject(new Error(msg.error));
    return true;
  }
}
