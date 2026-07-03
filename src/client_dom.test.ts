export {};
const { DolphinClient } = require('../scripts/client.js');

class MockElement {
  tagName: string;
  nodeType: number;
  childNodes: MockElement[];
  attributes: { name: string; value: string }[];
  style: any;
  classList: {
    add: jest.Mock;
    remove: jest.Mock;
  };
  parentNode: MockElement | null;
  _textContent: string;
  name: string;
  value: string;
  checked: boolean;

  constructor(tagName: string, nodeType: number = 1) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = nodeType;
    this.childNodes = [];
    this.attributes = [];
    this.style = {};
    this.classList = {
      add: jest.fn(),
      remove: jest.fn()
    };
    this.parentNode = null;
    this._textContent = '';
    this.name = '';
    this.value = '';
    this.checked = false;
  }

  get children() {
    return this.childNodes.filter(c => c.nodeType === 1);
  }

  get innerHTML() {
    if (this.nodeType === 3) return '';
    return this.childNodes.map(c => {
      if (c.nodeType === 3) return c.textContent;
      return c.outerHTML;
    }).join('');
  }

  set innerHTML(val: string) {
    this.childNodes = [];
    
    // Parse tags and text nodes
    let remaining = val;
    const tagRegex = /<([a-zA-Z1-6]+)([^>]*)>([\s\S]*?)<\/\1>/;
    
    while (remaining) {
      const match = remaining.match(tagRegex);
      if (match) {
        const index = match.index!;
        if (index > 0) {
          const txt = new MockElement('#text', 3);
          txt._textContent = remaining.substring(0, index);
          this.appendChild(txt);
        }
        
        const tagName = match[1];
        const attrStr = match[2];
        const content = match[3];
        
        const el = new MockElement(tagName);
        const attrRegex = /([a-zA-Z-]+)="([^"]*)"/g;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrStr)) !== null) {
          el.setAttribute(attrMatch[1], attrMatch[2]);
        }
        el.innerHTML = content;
        this.appendChild(el);
        
        remaining = remaining.substring(index + match[0].length);
      } else {
        const txt = new MockElement('#text', 3);
        txt._textContent = remaining;
        this.appendChild(txt);
        remaining = '';
      }
    }
  }

  get textContent() {
    if (this.nodeType === 3) return this._textContent;
    return this.childNodes.map(c => c.textContent).join('');
  }

  set textContent(val: string) {
    if (this.nodeType === 3) {
      this._textContent = val;
    } else {
      const txt = new MockElement('#text', 3);
      txt._textContent = val;
      this.childNodes = [txt];
    }
  }

  get outerHTML() {
    if (this.nodeType === 3) return this.textContent;
    const attrs = this.attributes.map(a => `${a.name}="${a.value}"`).join(' ');
    const attrStr = attrs ? ' ' + attrs : '';
    return `<${this.tagName.toLowerCase()}${attrStr}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
  }

  getAttribute(name: string) {
    const attr = this.attributes.find(a => a.name === name);
    return attr ? attr.value : null;
  }

  setAttribute(name: string, value: string) {
    const attr = this.attributes.find(a => a.name === name);
    if (attr) {
      attr.value = value;
    } else {
      this.attributes.push({ name, value });
    }
  }

  removeAttribute(name: string) {
    this.attributes = this.attributes.filter(a => a.name !== name);
  }

  hasAttribute(name: string) {
    return this.attributes.some(a => a.name === name);
  }

  appendChild(child: MockElement) {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: MockElement) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  replaceChild(newChild: MockElement, oldChild: MockElement) {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx !== -1) {
      this.childNodes[idx] = newChild;
      newChild.parentNode = this;
      oldChild.parentNode = null;
    }
    return newChild;
  }

  cloneNode(deep: boolean = true) {
    const clone = new MockElement(this.tagName, this.nodeType);
    clone._textContent = this._textContent;
    clone.name = this.name;
    clone.value = this.value;
    clone.checked = this.checked;
    this.attributes.forEach(a => clone.setAttribute(a.name, a.value));
    if (deep) {
      this.childNodes.forEach(c => clone.appendChild(c.cloneNode(true)));
    }
    return clone;
  }

  querySelectorAll(selector: string): MockElement[] {
    const results: MockElement[] = [];
    const traverse = (node: MockElement) => {
      node.childNodes.forEach(child => {
        if (selector.includes('[data-rt-text]') && child.hasAttribute('data-rt-text')) results.push(child);
        else if (selector.includes('[data-rt-html]') && child.hasAttribute('data-rt-html')) results.push(child);
        else if (selector.includes('[data-rt-attr]') && child.hasAttribute('data-rt-attr')) results.push(child);
        else if (selector.includes('[data-rt-class]') && child.hasAttribute('data-rt-class')) results.push(child);
        else if (selector.includes('[data-rt-if]') && child.hasAttribute('data-rt-if')) results.push(child);
        else if (selector.includes('[data-rt-hide]') && child.hasAttribute('data-rt-hide')) results.push(child);
        else if (selector.includes('[data-api-get]') && child.hasAttribute('data-api-get')) results.push(child);
        traverse(child);
      });
    };
    traverse(this);
    return results;
  }
}

class MockDOMParser {
  parseFromString(html: string, type: string) {
    const body = new MockElement('BODY');
    body.innerHTML = html;

    // Simulate simple tag identification for security testing
    if (html.includes('<script') || html.includes('<SCRIPT')) {
      const scriptEl = new MockElement('SCRIPT');
      body.appendChild(scriptEl);
    }
    if (html.includes('<iframe') || html.includes('<IFRAME')) {
      const iframeEl = new MockElement('IFRAME');
      body.appendChild(iframeEl);
    }
    if (html.includes('onclick=')) {
      const div = new MockElement('DIV');
      div.setAttribute('onclick', 'alert(1)');
      body.appendChild(div);
    }
    if (html.includes('href="javascript:')) {
      const a = new MockElement('A');
      a.setAttribute('href', 'javascript:alert(1)');
      body.appendChild(a);
    }
    return { body };
  }
}

describe('DOM Binding', () => {
  let c: any;

  beforeEach(() => {
    if (typeof (global as any).Node === 'undefined') {
      (global as any).Node = {
        ELEMENT_NODE: 1,
        TEXT_NODE: 3
      } as any;
    }
    (global as any).document = {
      querySelectorAll: jest.fn().mockReturnValue([]),
      querySelector: jest.fn().mockReturnValue(null),
      addEventListener: jest.fn(),
      createElement: jest.fn().mockImplementation((tag) => new MockElement(tag))
    };
    (global as any).requestAnimationFrame = (cb: () => void) => cb();
    (global as any).DOMParser = MockDOMParser as any;
    c = new DolphinClient('http://localhost:3000');
  });

  afterEach(() => {
    delete (global as any).document;
    delete (global as any).requestAnimationFrame;
    delete (global as any).DOMParser;
  });

  test('_updateDOM replaces {{key}} with payload data when data-rt-template is present', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', 'Hello {{name}}, your score is {{score}}!');
    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    c._updateDOM('auth/user', { name: 'Ram', score: 100 });

    expect(el.innerHTML).toBe('Hello Ram, your score is 100!');
  });

  test('_updateDOM supports data-rt-template pointing to a CSS selector (template tag)', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', '#my-template');
    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    const templateNode = new MockElement('TEMPLATE');
    templateNode.innerHTML = 'Hello {{name}} from template tag!';
    ((global as any).document.querySelector as jest.Mock).mockImplementation((selector: string) => {
      if (selector === '#my-template') return templateNode;
      return null;
    });

    c._updateDOM('auth/user', { name: 'Shankar' });

    expect(el.innerHTML).toBe('Hello Shankar from template tag!');
  });

  test('_updateDOM supports arrays and repeats template without map()', () => {
    const el = new MockElement('UL');
    el.setAttribute('data-rt-template', '<li>{{name}}</li>');
    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    c._updateDOM('api/users', [{ name: 'Ram' }, { name: 'Sita' }]);

    expect(el.innerHTML).toBe('<li>Ram</li><li>Sita</li>');
  });

  test('_updateDOM supports data-rt-type="context" for child element data passing', () => {
    const parent = new MockElement('DIV');
    parent.setAttribute('data-rt-type', 'context');

    const childText = new MockElement('SPAN');
    childText.setAttribute('data-rt-text', 'name');

    const childAttr = new MockElement('IMG');
    childAttr.setAttribute('data-rt-attr', 'src:avatarUrl, alt:name');

    parent.appendChild(childText);
    parent.appendChild(childAttr);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([parent]);

    c._updateDOM('auth/user', { name: 'Ram', avatarUrl: 'img.png' });

    expect(childText.textContent).toBe('Ram');
    expect(childAttr.getAttribute('src')).toBe('img.png');
    expect(childAttr.getAttribute('alt')).toBe('Ram');
  });

  test('_updateDOM supports data-rt-if, data-rt-hide, and data-rt-class', () => {
    const parent = new MockElement('DIV');
    parent.setAttribute('data-rt-type', 'context');

    const childIf = new MockElement('DIV');
    childIf.setAttribute('data-rt-if', 'isAdmin');

    const childHide = new MockElement('DIV');
    childHide.setAttribute('data-rt-hide', 'isDeleted');

    const childClass = new MockElement('DIV');
    childClass.setAttribute('data-rt-class', 'active:isActive');

    parent.appendChild(childIf);
    parent.appendChild(childHide);
    parent.appendChild(childClass);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([parent]);

    // Test Truthy values
    c._updateDOM('auth/user', { isAdmin: true, isDeleted: true, isActive: true });
    expect(childIf.style.display).toBe('');
    expect(childHide.style.display).toBe('none');
    expect(childClass.classList.add).toHaveBeenCalledWith('active');

    // Test Falsy values
    c._updateDOM('auth/user', { isAdmin: false, isDeleted: false, isActive: false });
    expect(childIf.style.display).toBe('none');
    expect(childHide.style.display).toBe('');
    expect(childClass.classList.remove).toHaveBeenCalledWith('active');
  });

  test('XSS HTML Sanitizer strips malicious tags and scripts', () => {
    const parent = new MockElement('DIV');
    parent.setAttribute('data-rt-type', 'context');

    const childHtml = new MockElement('DIV');
    childHtml.setAttribute('data-rt-html', 'bio');
    parent.appendChild(childHtml);

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([parent]);

    // Test sanitization with a script tag
    c._updateDOM('auth/user', { bio: '<b>Hello</b><script>alert(1)</script>' });
    expect(childHtml.innerHTML).not.toContain('<script>');

    // Test sanitization with a javascript: href
    c._updateDOM('auth/user', { bio: '<a href="javascript:alert(1)">Click</a>' });
    expect(childHtml.innerHTML).not.toContain('javascript:');

    // Test sanitization with onclick attributes
    c._updateDOM('auth/user', { bio: '<div onclick="alert(1)">Click</div>' });
    expect(childHtml.innerHTML).not.toContain('onclick=');
  });

  test('request debouncing configuration (data-rt-debounce)', () => {
    const originalSetTimeout = global.setTimeout;
    const timers: { cb: () => void; delay: number }[] = [];
    (global as any).setTimeout = (cb: () => void, delay: number) => {
      timers.push({ cb, delay });
      return timers.length as any;
    };

    const addEventListenerMock = (global as any).document.addEventListener;
    const inputHandlers: any[] = [];

    addEventListenerMock.mockImplementation((event: string, handler: any) => {
      if (event === 'input') inputHandlers.push(handler);
    });

    c = new DolphinClient('http://localhost:3000');
    c._initDOMBinding();
    c.pubPush = jest.fn();

    const targetEl = new MockElement('INPUT');
    targetEl.setAttribute('data-rt-push', 'input/chat');
    targetEl.setAttribute('data-rt-debounce', '300');
    targetEl.name = 'message';
    targetEl.value = 'hello';

    // Simulate the event for all registered input listeners
    inputHandlers.forEach(handler => {
      handler({ target: targetEl });
    });

    expect(c.pubPush).not.toHaveBeenCalled();
    expect(timers.length).toBe(1);
    expect(timers[0].delay).toBe(300);

    // Execute the timer manually
    timers[0].cb();

    expect(c.pubPush).toHaveBeenCalledWith('input/chat', expect.objectContaining({ name: 'message', value: 'hello' }));

    global.setTimeout = originalSetTimeout;
  });

  test('Proxy-based template rendering prevents ReferenceError for uninitialized keys', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-template', '{#each products.filter(p => !category) as item}<span>{{item.name}}</span>{/each}');
    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    // Notice we do NOT define 'category' in the store context object.
    // The proxy should prevent a ReferenceError.
    const storeState = {
      products: [{ name: 'Laptop' }, { name: 'Phone' }]
    };

    c._updateDOM('store/app', storeState);
    expect(el.innerHTML).toBe('<span>Laptop</span><span>Phone</span>');
  });

  test('_scanAndFetchAPIBinds sets store state and skips direct _updateDOM rendering when data-api-store is present', async () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-api-get', 'https://fakestoreapi.com/products');
    el.setAttribute('data-api-store', 'app.products');
    el.setAttribute('data-rt-bind', 'store/app');
    el.setAttribute('data-rt-template', '{{products.length}} items');

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    const mockProducts = [{ id: 1, title: 'Item 1' }, { id: 2, title: 'Item 2' }];
    c.api.get = jest.fn().mockResolvedValue(mockProducts);
    c.setStoreState = jest.fn();
    c._updateDOM = jest.fn();

    await c._scanAndFetchAPIBinds();

    expect(c.api.get).toHaveBeenCalledWith('https://fakestoreapi.com/products');
    expect(c.setStoreState).toHaveBeenCalledWith('app', 'products', mockProducts);
    expect(c._updateDOM).not.toHaveBeenCalled();
  });

  test('declarative filtering, searching, and sorting pre-processes lists correctly', () => {
    const el = new MockElement('DIV');
    el.setAttribute('data-rt-bind', 'store/app');
    el.setAttribute('data-rt-template', '<span>{{name}}</span>');
    el.setAttribute('data-rt-filter', 'category == app.category');
    el.setAttribute('data-rt-search', 'name == app.search');
    el.setAttribute('data-rt-sort', 'app.sortBy');

    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    // Seed mock stores
    c.uiStores = new Map();
    c.uiStores.set('app', {
      category: 'electronics',
      search: 'phone',
      sortBy: 'price-low'
    });

    const mockPayload = {
      items: [
        { name: 'Dell Laptop', category: 'electronics', price: 900 },
        { name: 'Pixel Phone', category: 'electronics', price: 600 },
        { name: 'Apple Phone', category: 'electronics', price: 1000 },
        { name: 'Gold Ring', category: 'jewelry', price: 300 }
      ]
    };

    // This should filter by category "electronics", search by query "phone" (matching Pixel and Apple),
    // and sort by price ascending (Pixel Phone 600, then Apple Phone 1000)
    const processed = c._applyDeclarativeDirectives(el, mockPayload);

    expect(processed.items.length).toBe(2);
    expect(processed.items[0].name).toBe('Pixel Phone');
    expect(processed.items[1].name).toBe('Apple Phone');
  });
});
