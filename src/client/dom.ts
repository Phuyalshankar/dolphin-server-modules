export function attachDOMBinding(clientProto: any) {

    /** @private */
    clientProto._initDOMBinding = function() {
        if (this._domInitialized) return;
        this._domInitialized = true;

        // 1. Listen for inputs
        document.addEventListener('input', (e: any) => {
            if (!e.target || !e.target.getAttribute) return;
            const topic = e.target.getAttribute('data-rt-push');
            if (topic) {
                const payload = { name: e.target.name, value: e.target.value };
                this.pubPush(topic, payload);
            }
        });

        // 2. Listen for form submits (RT + API)
        document.addEventListener('submit', async (e: any) => {
            if (!e.target || !e.target.getAttribute) return;
            
            const rtTopic = e.target.getAttribute('data-rt-submit');
            const apiTarget = e.target.getAttribute('data-api-submit');
            
            if (rtTopic || apiTarget) {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData.entries());
                
                if (rtTopic) {
                    this.publish(rtTopic, data);
                } else if (apiTarget) {
                    const parts = apiTarget.trim().split(' ');
                    const method = parts.length > 1 ? parts[0].toUpperCase() : 'POST';
                    const path = parts.length > 1 ? parts[1] : parts[0];
                    try {
                        const result = await this.api.request(method, path, data);
                        const resultBind = e.target.getAttribute('data-api-result');
                        if (resultBind) this._updateDOM(resultBind, result);
                        
                        // Auto Navigation (Hookless Routing)
                        const redirect = e.target.getAttribute('data-api-redirect');
                        if (redirect) window.location.href = redirect;
                        if (e.target.hasAttribute('data-api-reload')) window.location.reload();
                    } catch (err) {
                        console.error('[Dolphin] API Submit Error:', err);
                    }
                }
            }
        });

        // 3. Listen for clicks (RT + API)
        document.addEventListener('click', async (e: any) => {
            if (!e.target || !e.target.closest) return;
            
            const rtBtn = e.target.closest('[data-rt-click]');
            const apiBtn = e.target.closest('[data-api-click]');
            
            if (rtBtn) {
                const topic = rtBtn.getAttribute('data-rt-click');
                const actionData = rtBtn.getAttribute('data-rt-payload');
                const payload = actionData ? JSON.parse(actionData) : {};
                this.publish(topic, payload);
            } else if (apiBtn) {
                const apiTarget = apiBtn.getAttribute('data-api-click');
                const actionData = apiBtn.getAttribute('data-api-payload');
                const payload = actionData ? JSON.parse(actionData) : null;
                const parts = apiTarget.trim().split(' ');
                const method = parts.length > 1 ? parts[0].toUpperCase() : 'POST';
                const path = parts.length > 1 ? parts[1] : parts[0];
                try {
                    const result = await this.api.request(method, path, payload);
                    const resultBind = apiBtn.getAttribute('data-api-result');
                    if (resultBind) this._updateDOM(resultBind, result);
                    
                    // Auto Navigation (Hookless Routing)
                    const redirect = apiBtn.getAttribute('data-api-redirect');
                    if (redirect) window.location.href = redirect;
                    if (apiBtn.hasAttribute('data-api-reload')) window.location.reload();
                } catch (err) {
                    console.error('[Dolphin] API Click Error:', err);
                }
            }
        });

        // 4. Update DOM when RT data arrives
        // Note: Subscribe to all topics ('#') to auto-update DOM bindings
        this.subscribe('#', (payload: any, topic: string) => {
            this._updateDOM(topic, payload);
        });

        // 5. Auto-fetch API GET bindings
        this._scanAndFetchAPIBinds();
    };

    /** @private */
    clientProto._scanAndFetchAPIBinds = async function() {
        if (typeof document === 'undefined') return;
        const elements = document.querySelectorAll('[data-api-get]');
        for (const el of Array.from(elements)) {
            const path = el.getAttribute('data-api-get');
            if (!path) continue;
            try {
                const result = await this.api.get(path);
                if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    (el as any).value = typeof result === 'object' ? (result.value !== undefined ? result.value : '') : result;
                } else {
                    el.innerHTML = typeof result === 'object' ? (result.html || result.text || JSON.stringify(result)) : result;
                }
            } catch(e) {
                console.error('[Dolphin] API Get Error:', e);
            }
        }
    };

    /** @private */
    clientProto._updateDOM = function(topic: string, payload: any) {
        if (typeof document === 'undefined') return;
        const elements = document.querySelectorAll(`[data-rt-bind="${topic}"]`);
        elements.forEach(el => {
            if (el.getAttribute('data-rt-type') === 'context' && typeof payload === 'object' && payload !== null) {
                const processNode = (node: Element) => {
                    if (node.hasAttribute('data-rt-text')) {
                        const key = node.getAttribute('data-rt-text');
                        if (key && payload[key] !== undefined && payload[key] !== null) node.textContent = payload[key];
                    }
                    if (node.hasAttribute('data-rt-html')) {
                        const key = node.getAttribute('data-rt-html');
                        if (key && payload[key] !== undefined && payload[key] !== null) node.innerHTML = payload[key];
                    }
                    if (node.hasAttribute('data-rt-attr')) {
                        const attrStr = node.getAttribute('data-rt-attr');
                        if (attrStr) {
                            attrStr.split(',').forEach(b => {
                                const parts = b.split(':');
                                if (parts.length === 2) {
                                    const attrName = parts[0].trim();
                                    const key = parts[1].trim();
                                    if (attrName && key && payload[key] !== undefined && payload[key] !== null) {
                                        node.setAttribute(attrName, payload[key]);
                                    }
                                }
                            });
                        }
                    }
                    if (node.hasAttribute('data-rt-class')) {
                        const classStr = node.getAttribute('data-rt-class');
                        if (classStr) {
                            classStr.split(',').forEach(b => {
                                const parts = b.split(':');
                                if (parts.length === 2) {
                                    const className = parts[0].trim();
                                    const key = parts[1].trim();
                                    if (payload[key]) {
                                        node.classList.add(className);
                                    } else {
                                        node.classList.remove(className);
                                    }
                                }
                            });
                        }
                    }
                    if (node.hasAttribute('data-rt-if')) {
                        const key = node.getAttribute('data-rt-if');
                        if (key) {
                            if (payload[key]) {
                                (node as HTMLElement).style.display = '';
                            } else {
                                (node as HTMLElement).style.display = 'none';
                            }
                        }
                    }
                    if (node.hasAttribute('data-rt-hide')) {
                        const key = node.getAttribute('data-rt-hide');
                        if (key) {
                            if (payload[key]) {
                                (node as HTMLElement).style.display = 'none';
                            } else {
                                (node as HTMLElement).style.display = '';
                            }
                        }
                    }
                };
                processNode(el);
                el.querySelectorAll('[data-rt-text], [data-rt-html], [data-rt-attr], [data-rt-class], [data-rt-if], [data-rt-hide]').forEach(processNode);
                return;
            }

            const template = el.getAttribute('data-rt-template');
            
            if (template && typeof payload === 'object' && payload !== null) {
                if (Array.isArray(payload)) {
                    let combinedHTML = '';
                    for (const item of payload) {
                        let finalItemHTML = template;
                        for (let key in item) {
                            finalItemHTML = finalItemHTML.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), item[key] !== undefined && item[key] !== null ? item[key] : '');
                        }
                        combinedHTML += finalItemHTML;
                    }
                    el.innerHTML = combinedHTML;
                } else {
                    let finalHTML = template;
                    for (let key in payload) {
                        finalHTML = finalHTML.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), payload[key] !== undefined && payload[key] !== null ? payload[key] : '');
                    }
                    el.innerHTML = finalHTML;
                }
                return;
            }

            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                (el as any).value = typeof payload === 'object' ? (payload.value !== undefined ? payload.value : '') : payload;
            } else {
                el.innerHTML = typeof payload === 'object' ? (payload.html || payload.text || JSON.stringify(payload)) : payload;
            }
        });
    };
}