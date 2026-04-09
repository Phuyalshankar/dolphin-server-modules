// @ts-check
const { DolphinClient } = require('./scripts/client');

async function test() {
    const dolphin = new DolphinClient('localhost:3000');
    
    // Testing Auth autocompletion
    await dolphin.auth.login('admin@test.com', 'password');
    
    // Testing API autocompletion
    const data = await dolphin.api.get('/products');
    
    // Testing Realtime autocompletion
    dolphin.subscribe('test/topic', (/** @type {any} */ payload, /** @type {string | undefined} */ topic) => {
        console.log(topic, payload);
    });
    
    dolphin.onSignal((/** @type {import('./scripts/client').SignalMessage} */ sig) => {
        console.log(sig.type, sig.from, sig.data);
    });
}
