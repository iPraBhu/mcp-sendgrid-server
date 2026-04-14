/**
 * Simple TTL (time-to-live) in-memory cache.
 * Used to reduce redundant outbound requests for frequently-read, slowly-changing resources.
 */

export class TtlCache<T> {
  private value?: T;
  private expiresAt?: number;

  constructor(private readonly ttlMs: number) {}

  get(): T | undefined {
    if (this.value !== undefined && Date.now() < (this.expiresAt ?? 0)) {
      return this.value;
    }
    return undefined;
  }

  set(value: T): void {
    this.value = value;
    this.expiresAt = Date.now() + this.ttlMs;
  }

  invalidate(): void {
    this.value = undefined;
    this.expiresAt = undefined;
  }

  /**
   * Return cached value if fresh; otherwise call `loader()`, cache the result, and return it.
   */
  async getOrLoad(loader: () => Promise<T>): Promise<T> {
    const cached = this.get();
    if (cached !== undefined) return cached;
    const fresh = await loader();
    this.set(fresh);
    return fresh;
  }
}
