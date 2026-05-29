export {};
const { DolphinClient } = require('../scripts/client.js');

describe('DOM Binding', () => {
  let c: any;

  beforeEach(() => {
    // Mocking document before Client instantiation
    (global as any).document = {
      querySelectorAll: jest.fn(),
      addEventListener: jest.fn()
    };
    c = new DolphinClient('http://localhost:3000');
  });

  afterEach(() => {
    delete (global as any).document;
  });

  test('_updateDOM replaces {{key}} with payload data when data-rt-template is present', () => {
    const el = {
      tagName: 'DIV',
      getAttribute: jest.fn().mockReturnValue('Hello {{name}}, your score is {{score}}!'),
      innerHTML: ''
    };
    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    c._updateDOM('auth/user', { name: 'Ram', score: 100 });

    expect(el.innerHTML).toBe('Hello Ram, your score is 100!');
  });
  test('_updateDOM supports arrays and repeats template without map()', () => {
    const el = {
      tagName: 'UL',
      getAttribute: jest.fn().mockReturnValue('<li>{{name}}</li>'),
      innerHTML: ''
    };
    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([el]);

    c._updateDOM('api/users', [{ name: 'Ram' }, { name: 'Sita' }]);

    expect(el.innerHTML).toBe('<li>Ram</li><li>Sita</li>');
  });
  test('_updateDOM supports data-rt-type="context" for child element data passing', () => {
    const parent = {
      tagName: 'DIV',
      getAttribute: jest.fn().mockImplementation((attr) => attr === 'data-rt-type' ? 'context' : null),
      querySelectorAll: jest.fn(),
      hasAttribute: jest.fn().mockReturnValue(false)
    };

    const childText = {
      hasAttribute: jest.fn().mockImplementation((attr) => attr === 'data-rt-text'),
      getAttribute: jest.fn().mockReturnValue('name'),
      textContent: ''
    };

    const childAttr = {
      hasAttribute: jest.fn().mockImplementation((attr) => attr === 'data-rt-attr'),
      getAttribute: jest.fn().mockReturnValue('src:avatarUrl, alt:name'),
      setAttribute: jest.fn()
    };

    parent.querySelectorAll.mockReturnValue([childText, childAttr]);
    ((global as any).document.querySelectorAll as jest.Mock).mockReturnValue([parent]);

    c._updateDOM('auth/user', { name: 'Ram', avatarUrl: 'img.png' });

    expect(childText.textContent).toBe('Ram');
    expect(childAttr.setAttribute).toHaveBeenCalledWith('src', 'img.png');
    expect(childAttr.setAttribute).toHaveBeenCalledWith('alt', 'Ram');
  });
  test('_updateDOM supports data-rt-if, data-rt-hide, and data-rt-class', () => {
    const parent = {
      tagName: 'DIV',
      getAttribute: jest.fn().mockImplementation((attr) => attr === 'data-rt-type' ? 'context' : null),
      querySelectorAll: jest.fn(),
      hasAttribute: jest.fn().mockReturnValue(false)
    };

    const childIf = {
      hasAttribute: jest.fn().mockImplementation((attr) => attr === 'data-rt-if'),
      getAttribute: jest.fn().mockReturnValue('isAdmin'),
      style: { display: '' }
    };

    const childHide = {
      hasAttribute: jest.fn().mockImplementation((attr) => attr === 'data-rt-hide'),
      getAttribute: jest.fn().mockReturnValue('isDeleted'),
      style: { display: '' }
    };

    const childClass = {
      hasAttribute: jest.fn().mockImplementation((attr) => attr === 'data-rt-class'),
      getAttribute: jest.fn().mockReturnValue('active:isActive'),
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      }
    };

    parent.querySelectorAll.mockReturnValue([childIf, childHide, childClass]);
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
});
