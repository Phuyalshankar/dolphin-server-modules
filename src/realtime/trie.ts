/**
 * TopicTrie for high-performance MQTT-style topic matching.
 * Supports:
 * - Simple topics: "sensors/temp"
 * - Single level wildcard: "sensors/+" (matches "sensors/temp", "sensors/hum")
 * - Multi level wildcard: "sensors/#" (matches "sensors/temp", "sensors/room1/temp")
 */
export class TopicTrie {
  private root: any = {};

  /**
   * Add a subscriber function to a topic pattern.
   */
  add(topic: string, fn: Function) {
    const parts = topic.split('/');
    let node = this.root;

    for (const p of parts) {
      if (!node[p]) node[p] = {};
      node = node[p];
    }

    if (!node._) node._ = [];
    node._.push(fn);
  }

  /**
   * Remove a subscriber function from a topic pattern.
   */
  remove(topic: string, fn: Function) {
    const parts = topic.split('/');
    let node = this.root;

    for (const p of parts) {
      if (!node[p]) return;
      node = node[p];
    }

    if (node._) {
      node._ = node._.filter((f: Function) => f !== fn);
      if (node._.length === 0) delete node._;
    }
  }

  /**
   * Match a topic and execute callback for each matching subscriber.
   */
  match(topic: string, cb: (fn: Function) => void) {
    const parts = topic.split('/');

    const walk = (node: any, i: number) => {
      if (!node) return;

      // Exact match level
      if (i === parts.length) {
        if (node._) node._.forEach(cb);
        // Also check if '#' exists at this level (e.g. pattern 'a/#' matches 'a')
        if (node['#'] && node['#']._) node['#']._.forEach(cb);
        return;
      }

      // 1. Direct match
      if (node[parts[i]]) walk(node[parts[i]], i + 1);

      // 2. Single level wildcard '+'
      if (node['+']) walk(node['+'], i + 1);

      // 3. Multi level wildcard '#'
      if (node['#'] && node['#']._) node['#']._.forEach(cb);
    };

    walk(this.root, 0);
  }
}
