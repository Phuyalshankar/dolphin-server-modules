/**
 * TopicTrie for high-performance MQTT-style topic matching.
 * Supports:
 * - Simple topics: "sensors/temp"
 * - Single level wildcard: "sensors/+" (matches "sensors/temp", "sensors/hum")
 * - Multi level wildcard: "sensors/#" (matches "sensors/temp", "sensors/room1/temp")
 */
export declare class TopicTrie {
    private root;
    /**
     * Add a subscriber function to a topic pattern.
     */
    add(topic: string, fn: Function): void;
    /**
     * Remove a subscriber function from a topic pattern.
     */
    remove(topic: string, fn: Function): void;
    /**
     * Match a topic and execute callback for each matching subscriber.
     */
    match(topic: string, cb: (fn: Function) => void): void;
}
