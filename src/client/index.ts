import { DolphinClient } from './core';
import { attachDOMBinding } from './dom';

attachDOMBinding(DolphinClient.prototype);

if (typeof window !== 'undefined') {
  (window as any).DolphinClient = DolphinClient;
  (window as any).dolphin = new DolphinClient();
}

export { DolphinClient };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DolphinClient };
}
