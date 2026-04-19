/**
 * DolphinPersist - Offline Cache Plugin for Dolphin Client
 * 
 * Optional, zero-dependency persistence layer for DolphinStore.
 * Supports both localStorage (simple) and IndexedDB (large data).
 * 
 * Usage:
 *   // Auto-detect best storage:
 *   const persist = new DolphinPersist();
 *   dolphin.store.use(persist);
 *
 *   // Force localStorage:
 *   const persist = new DolphinPersist({ driver: 'localstorage' });
 *
 *   // Force IndexedDB:
 *   const persist = new DolphinPersist({ driver: 'indexeddb' });
 */

class DolphinPersist {
    /**
     * @param {{ driver?: 'auto'|'localstorage'|'indexeddb', prefix?: string, ttl?: number }} options
     */
    constructor(options = {}) {
        this.driver = options.driver || 'auto';
        this.prefix = options.prefix || 'dolphin_persist_';
        this.ttl = options.ttl || 0; // 0 = no expiry (milliseconds)
        this._db = null;
        this._ready = false;
        this._readyPromise = this._init();
    }

    async _init() {
        if (this.driver === 'auto') {
            this.driver = typeof indexedDB !== 'undefined' ? 'indexeddb' : 'localstorage';
        }

        if (this.driver === 'indexeddb') {
            try {
                await this._openIndexedDB();
            } catch {
                console.warn('[DolphinPersist] IndexedDB unavailable, falling back to localStorage');
                this.driver = 'localstorage';
            }
        }

        this._ready = true;
    }

    _openIndexedDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('dolphin_persist', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('cache')) {
                    db.createObjectStore('cache', { keyPath: 'key' });
                }
            };
            req.onsuccess = (e) => { this._db = e.target.result; resolve(); };
            req.onerror = () => reject(req.error);
        });
    }

    async set(collection, data) {
        await this._readyPromise;
        const entry = {
            data,
            savedAt: Date.now(),
            expiresAt: this.ttl ? Date.now() + this.ttl : null
        };

        if (this.driver === 'indexeddb') {
            return new Promise((resolve, reject) => {
                const tx = this._db.transaction('cache', 'readwrite');
                tx.objectStore('cache').put({ key: this.prefix + collection, ...entry });
                tx.oncomplete = resolve;
                tx.onerror = reject;
            });
        } else {
            try {
                localStorage.setItem(this.prefix + collection, JSON.stringify(entry));
            } catch (e) {
                console.warn('[DolphinPersist] localStorage write failed:', e.message);
            }
        }
    }

    async get(collection) {
        await this._readyPromise;
        let entry = null;

        if (this.driver === 'indexeddb') {
            entry = await new Promise((resolve, reject) => {
                const tx = this._db.transaction('cache', 'readonly');
                const req = tx.objectStore('cache').get(this.prefix + collection);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = reject;
            });
        } else {
            try {
                const raw = localStorage.getItem(this.prefix + collection);
                entry = raw ? JSON.parse(raw) : null;
            } catch { entry = null; }
        }

        if (!entry) return null;

        // TTL check
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            await this.clear(collection);
            return null;
        }

        return entry.data;
    }

    async clear(collection) {
        await this._readyPromise;
        if (this.driver === 'indexeddb') {
            return new Promise((resolve) => {
                const tx = this._db.transaction('cache', 'readwrite');
                tx.objectStore('cache').delete(this.prefix + collection);
                tx.oncomplete = resolve;
            });
        } else {
            localStorage.removeItem(this.prefix + collection);
        }
    }

    async clearAll() {
        await this._readyPromise;
        if (this.driver === 'indexeddb') {
            return new Promise((resolve) => {
                const tx = this._db.transaction('cache', 'readwrite');
                tx.objectStore('cache').clear();
                tx.oncomplete = resolve;
            });
        } else {
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.startsWith(this.prefix)) keysToRemove.push(k);
            }
            keysToRemove.forEach(k => localStorage.removeItem(k));
        }
    }

    /** Check what's cached */
    async info(collection) {
        await this._readyPromise;
        const entry = await this.get(collection);
        if (!entry) return null;
        return {
            collection,
            items: entry.length,
            driver: this.driver,
            savedAt: new Date(entry.savedAt)
        };
    }
}

// ============================================
// Extend DolphinStore to support persist plugin
// ============================================

/**
 * Monkey-patches the DolphinStore to support .use(persist) plugin.
 * Call this after DolphinClient is loaded.
 */
function enablePersist(storeInstance, persist) {
    const originalFetch = storeInstance._fetchAndSync.bind(storeInstance);

    storeInstance._fetchAndSync = async function(name) {
        // 1. Load from cache first (instant render)
        const cached = await persist.get(name);
        if (cached && cached.length > 0) {
            storeInstance.data.set(name, cached);
            storeInstance._notify();
            console.log(`[DolphinPersist] Loaded "${name}" from ${persist.driver} cache (${cached.length} items)`);
        }

        // 2. Fetch fresh from server
        await originalFetch(name);

        // 3. Save updated data to cache
        const fresh = storeInstance.data.get(name) || [];
        await persist.set(name, fresh);
    };

    // Also persist on every realtime update
    const originalUpdate = storeInstance._handleRemoteUpdate.bind(storeInstance);
    storeInstance._handleRemoteUpdate = async function(collection, update) {
        originalUpdate(collection, update);
        const updated = storeInstance.data.get(collection) || [];
        await persist.set(collection, updated);
    };

    console.log(`[DolphinPersist] Persistence enabled using ${persist.driver}`);
}

// ============================================
// Exports
// ============================================

if (typeof window !== 'undefined') {
    window.DolphinPersist = DolphinPersist;
    window.enablePersist = enablePersist;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DolphinPersist, enablePersist };
}
