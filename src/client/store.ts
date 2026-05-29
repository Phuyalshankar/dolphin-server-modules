export class DolphinStore {
    /** @param {DolphinClient} client */
    constructor(client) {
        this.client  = client;
        /** @type {Map<string, any>} */
        this.data      = new Map();
        /** @type {Set<function()>} */
        this.listeners = new Set();
        /** @type {Set<string>} */
        this.subscribed = new Set();

        return new Proxy(this, {
            get: (target, prop) => {
                if (prop in target) return target[prop];
                if (typeof prop === 'string') return this._getCollection(prop);
            }
        });
    }

    /** @private */
    _getCollection(name) {
        if (!this.data.has(name)) {
            const collection = {
                _rawItems: [],
                items:     [],
                loading:   true,
                error:     null,
                success:   false,
                _filter:   null,
                _sort:     null,

                where: (fn) => {
                    collection._filter = fn;
                    this._applyTransform(collection);
                    return collection;
                },
                orderBy: (key, direction = 'asc') => {
                    collection._sort = { key, direction };
                    this._applyTransform(collection);
                    return collection;
                },
                reset: () => {
                    collection._filter = null;
                    collection._sort   = null;
                    this._applyTransform(collection);
                    return collection;
                },
            };

            this.data.set(name, collection);
            this._fetchAndSync(name);
        }
        return this.data.get(name);
    }

    /** @private */
    async _fetchAndSync(name) {
        const state = this.data.get(name);
        try {
            const res = await this.client.api.get(`/${name.toLowerCase()}`);
            state._rawItems = Array.isArray(res) ? res : (res.data || []);
            state.loading   = false;
            state.success   = true;
            state.error     = null;
            this._applyTransform(state);

            if (!this.subscribed.has(name)) {
                this.client.subscribe(`db:sync/${name.toLowerCase()}`, (update) => {
                    this._handleRemoteUpdate(name, update);
                });
                this.subscribed.add(name);
            }
        } catch (e) {
            state.loading = false;
            state.success = false;
            state.error   = e.data?.error || e.message || 'Fetch failed';
            this._notify();
        }
    }

    /** @private */
    _applyTransform(state) {
        let result = [...state._rawItems];
        if (state._filter) result = result.filter(state._filter);
        if (state._sort) {
            const { key, direction } = state._sort;
            result.sort((a, b) => {
                if (a[key] === b[key]) return 0;
                return (a[key] > b[key] ? 1 : -1) * (direction === 'asc' ? 1 : -1);
            });
        }
        state.items = result;
        this._notify();
    }

    /** @private */
    _handleRemoteUpdate(collection, update) {
        const state = this.data.get(collection);
        if (!state) return;
        const { type, data } = update;
        let items = state._rawItems;

        if (type === 'create') {
            items = [...items, data];
        } else if (type === 'update') {
            items = items.map(i => (i.id === data.id || i._id === data._id) ? { ...i, ...data } : i);
        } else if (type === 'delete') {
            items = items.filter(i => {
                if (data.id  != null && i.id  === data.id)  return false;
                if (data._id != null && i._id === data._id) return false;
                return true;
            });
        }

        state._rawItems = items;
        this._applyTransform(state);
    }

    /** Subscribe for React useSyncExternalStore */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /** @param {string} collection */
    getSnapshot(collection) {
        return this.data.get(collection) || { items: [], loading: false, error: null, success: false };
    }

    /** @private */
    _notify() {
        this.listeners.forEach(l => l());
    }
}
