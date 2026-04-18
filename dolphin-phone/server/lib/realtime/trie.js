"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TopicTrie = void 0;
/**
 * TopicTrie for high-performance MQTT-style topic matching.
 * Supports:
 * - Simple topics: "sensors/temp"
 * - Single level wildcard: "sensors/+" (matches "sensors/temp", "sensors/hum")
 * - Multi level wildcard: "sensors/#" (matches "sensors/temp", "sensors/room1/temp")
 */
class TopicTrie {
    root = {};
    /**
     * Add a subscriber function to a topic pattern.
     */
    add(topic, fn) {
        const parts = topic.split('/');
        let node = this.root;
        for (const p of parts) {
            if (!node[p])
                node[p] = {};
            node = node[p];
        }
        if (!node._)
            node._ = [];
        node._.push(fn);
    }
    /**
     * Remove a subscriber function from a topic pattern.
     */
    remove(topic, fn) {
        const parts = topic.split('/');
        let node = this.root;
        for (const p of parts) {
            if (!node[p])
                return;
            node = node[p];
        }
        if (node._) {
            node._ = node._.filter((f) => f !== fn);
            if (node._.length === 0)
                delete node._;
        }
    }
    /**
     * Match a topic and execute callback for each matching subscriber.
     */
    match(topic, cb) {
        const parts = topic.split('/');
        const walk = (node, i) => {
            if (!node)
                return;
            // Exact match level
            if (i === parts.length) {
                if (node._)
                    node._.forEach(cb);
                // Also check if '#' exists at this level (e.g. pattern 'a/#' matches 'a')
                if (node['#'] && node['#']._)
                    node['#']._.forEach(cb);
                return;
            }
            // 1. Direct match
            if (node[parts[i]])
                walk(node[parts[i]], i + 1);
            // 2. Single level wildcard '+'
            if (node['+'])
                walk(node['+'], i + 1);
            // 3. Multi level wildcard '#'
            if (node['#'] && node['#']._)
                node['#']._.forEach(cb);
        };
        walk(this.root, 0);
    }
}
exports.TopicTrie = TopicTrie;
//# sourceMappingURL=trie.js.map