import { generateClientJS, generateClientDTS } from './client-generator.js';


describe('Dolphin Client SDK Native Platform Generator', () => {
  const mockRoutes = [
    { method: 'GET', path: '/api/todos' },
    { method: 'POST', path: '/api/todos' },
    { method: 'DELETE', path: '/api/todos/:id' },
    { method: 'POST', path: '/api/auth/login' }
  ];

  test('should generate default client SDK without DolphinNativeSync when platform is not specified', () => {
    const code = generateClientJS(mockRoutes);
    expect(code).toContain('class DolphinClient');
    expect(code).not.toContain('class DolphinNativeSync');
  });

  test('should generate native platform SDK with DolphinNativeSync when platform is native', () => {
    const code = generateClientJS(mockRoutes, 'native');
    expect(code).toContain('class DolphinClient');
    expect(code).toContain('class DolphinNativeSync');
    expect(code).toContain('sync(app)');
    expect(code).toContain('intercom/calls');
  });

  test('should generate native platform DTS typings with DolphinNativeSync export when platform is native', () => {
    const dts = generateClientDTS(mockRoutes, 'native');
    expect(dts).toContain('export class DolphinClient');
    expect(dts).toContain('export class DolphinNativeSync');
    expect(dts).toContain('sync(app: any): void');
    expect(dts).toContain('disconnect(): void');
  });
});

