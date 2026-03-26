import { TopicTrie } from './trie';

describe('Realtime Module - TopicTrie', () => {
  let trie: TopicTrie;

  beforeEach(() => {
    trie = new TopicTrie();
  });

  it('should match exact topics', () => {
    const fn = jest.fn();
    trie.add('sensors/temp', fn);
    trie.match('sensors/temp', (f) => f());
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should match single level wildcard (+)', () => {
    const fn = jest.fn();
    trie.add('sensors/+', fn);
    trie.match('sensors/temp', (f) => f());
    trie.match('sensors/hum', (f) => f());
    trie.match('actuators/led', (f) => f());
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
