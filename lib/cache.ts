/**
 * Caché en memoria con vencimiento. Evita consultar a las tiendas
 * cada vez que alguien repite la misma búsqueda.
 * En producción con varias instancias conviene pasarlo a Redis o Supabase.
 */
export class TTLCache<V> {
  private store = new Map<string, { v: V; exp: number }>();
  private ttlMs: number;
  private max: number;
  constructor(ttlMs: number, max = 500) {
    this.ttlMs = ttlMs;
    this.max = max;
  }

  get(key: string): V | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (Date.now() > hit.exp) {
      this.store.delete(key);
      return undefined;
    }
    return hit.v;
  }

  set(key: string, v: V) {
    if (this.store.size >= this.max) {
      const first = this.store.keys().next().value;
      if (first !== undefined) this.store.delete(first);
    }
    this.store.set(key, { v, exp: Date.now() + this.ttlMs });
  }
}
