import Storage from 'expo-sqlite/kv-store';

// Almacenamiento clave-valor síncrono. El resto del código recibe esta interfaz,
// así las pruebas pueden usar un Map en lugar de SQLite.
export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export const storage: KeyValueStore = {
  getItem: key => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: key => {
    Storage.removeItemSync(key);
  },
};
