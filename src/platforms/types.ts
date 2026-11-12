// Contrato que implementa cada red social. El motor de limpieza solo habla con esta interfaz:
// en la v2, Instagram y Facebook serán un adaptador nuevo sin tocar el motor.

export type Category = 'reposts' | 'likes' | 'favorites';

export type Session = { loggedIn: boolean; profileUrl: string | null };

// captcha: verificación de la red; rate_limit: aviso de demasiadas acciones; logged_out: la sesión expiró.
export type BlockReason = 'captcha' | 'rate_limit' | 'logged_out';

export type RemoveResult =
  // simulated: modo prueba, el botón activo se localizó pero no se pulsó.
  | { outcome: 'removed'; href: string; simulated: boolean }
  // Ya estaba deshecho (la red muestra la lista en caché): se salta sin pulsar nada.
  | { outcome: 'inactive'; href: string }
  // No hay elemento en esa posición: hay que cargar más o la lista se acabó.
  | { outcome: 'not_found' }
  | { outcome: 'blocked'; reason: BlockReason }
  // Falta el botón o se pulsó y el estado no cambió.
  | { outcome: 'failed'; detail: string };

export interface PlatformAdapter {
  readonly id: string;
  readonly homeUrl: string;
  readonly loginUrl: string;
  readonly userAgent: string;
  readonly categories: readonly Category[];

  detectSession(): Promise<Session>;
  // Va al perfil si hace falta y abre la pestaña. Devuelve cuántos elementos hay visibles.
  openCategory(category: Category): Promise<number>;
  // Enlaces de los elementos visibles de la pestaña abierta, en orden.
  listItems(): Promise<string[]>;
  // Desplaza la pestaña para cargar más elementos. Devuelve el total visible.
  loadMore(): Promise<number>;
  removeItem(category: Category, index: number, options?: { dryRun?: boolean }): Promise<RemoveResult>;
  detectBlock(): Promise<BlockReason | null>;
  // Cierra la sesión en la red dentro del WebView.
  logout(): Promise<void>;
}
