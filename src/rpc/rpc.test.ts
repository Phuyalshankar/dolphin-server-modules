import { DolphinRPCServer, DolphinRPCClient } from './rpc';

class CalculatorService {
  add(a: number, b: number): number {
    return a + b;
  }

  async greet(name: string): Promise<string> {
    return `Hello ${name}`;
  }
}

describe('Dolphin RPC Module', () => {
  let server: DolphinRPCServer;
  let client: DolphinRPCClient;
  const PORT = 5678;

  beforeAll((done) => {
    server = new DolphinRPCServer();
    server.register('Calculator', new CalculatorService());
    server.listen(PORT, '127.0.0.1', done);
    client = new DolphinRPCClient({ url: `http://localhost:${PORT}` });
  });

  afterAll((done) => {
    server.close(done);
  });

  test('should invoke remote methods successfully', async () => {
    const calc = client.getService<CalculatorService>('Calculator');
    
    const sum = await calc.add(10, 15);
    expect(sum).toBe(25);

    const greeting = await calc.greet('Dolphin');
    expect(greeting).toBe('Hello Dolphin');
  });

  test('should fail when service does not exist', async () => {
    const missing = client.getService('MissingService');
    await expect(missing.foo()).rejects.toThrow('Service "MissingService" not found');
  });

  test('should fail when method does not exist', async () => {
    const calc = client.getService<any>('Calculator');
    await expect(calc.missingMethod()).rejects.toThrow('Method "missingMethod" not found on service "Calculator"');
  });
});
