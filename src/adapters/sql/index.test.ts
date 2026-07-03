// SQL Adapter Tests
import { createSQLAdapter } from './index';

// ─── Mock DB Client ───────────────────────────────────────────────────────────

function makeMockClient(rows: any[] = []) {
  const calls: { sql: string; values: any[] }[] = [];

  const client = {
    _calls: calls,
    async query(sql: string, values: any[]) {
      calls.push({ sql, values });
      return { rows };
    },
  };
  return client;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('createSQLAdapter (postgres dialect)', () => {
  it('should create adapter without throwing', () => {
    const client = makeMockClient();
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    expect(adapter).toBeDefined();
    expect(typeof adapter.createUser).toBe('function');
    expect(typeof adapter.findUserByEmail).toBe('function');
    expect(typeof adapter.read).toBe('function');
    expect(typeof adapter.create).toBe('function');
    expect(typeof adapter.update).toBe('function');
    expect(typeof adapter.delete).toBe('function');
  });

  it('tableName() should convert collection to snake_case table', () => {
    const client = makeMockClient();
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    expect(adapter.tableName('User')).toBe('users');
    expect(adapter.tableName('RefreshToken')).toBe('refresh_tokens');
    expect(adapter.tableName('BlogPost')).toBe('blog_posts');
  });

  it('tableName() should respect custom tables map', () => {
    const client = makeMockClient();
    const adapter = createSQLAdapter({
      client,
      dialect: 'postgres',
      tables: { User: 'accounts', RefreshToken: 'tokens' },
    });
    expect(adapter.tableName('User')).toBe('accounts');
    expect(adapter.tableName('RefreshToken')).toBe('tokens');
  });

  it('findUserByEmail() should run SELECT with LOWER(email)', async () => {
    const mockRow = { id: 'u1', email: 'test@example.com', password: 'hash' };
    const client = makeMockClient([mockRow]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    const result = await adapter.findUserByEmail('TEST@example.com');

    expect(client._calls).toHaveLength(1);
    expect(client._calls[0].sql).toContain('LOWER(email)');
    expect(client._calls[0].sql).toContain('LOWER($1)');
    expect(client._calls[0].values).toEqual(['TEST@example.com']);
    expect(result).not.toBeNull();
    expect(result.email).toBe('test@example.com');
  });

  it('findUserByEmail() should return null when no rows', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    const result = await adapter.findUserByEmail('nobody@example.com');
    expect(result).toBeNull();
  });

  it('findUserById() should query by id', async () => {
    const client = makeMockClient([{ id: 'abc', email: 'a@b.com' }]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    await adapter.findUserById('abc');

    expect(client._calls[0].sql).toContain('WHERE id = $1');
    expect(client._calls[0].values).toEqual(['abc']);
  });

  it('read() should apply equality filter', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    await adapter.read('Post', { status: 'active' });

    expect(client._calls[0].sql).toContain('WHERE status = $1');
    expect(client._calls[0].values).toContain('active');
  });

  it('read() should apply $like filter with ILIKE', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    await adapter.read('Post', { title: { $like: 'hello' } });

    expect(client._calls[0].sql).toContain('ILIKE');
    expect(client._calls[0].values[0]).toBe('%hello%');
  });

  it('read() should apply $gt filter', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    await adapter.read('Order', { total: { $gt: 100 } });

    expect(client._calls[0].sql).toContain('> $1');
    expect(client._calls[0].values[0]).toBe(100);
  });

  it('read() should apply $in filter', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    await adapter.read('Post', { status: { $in: ['draft', 'published'] } });

    expect(client._calls[0].sql).toContain('IN ($1, $2)');
    expect(client._calls[0].values).toEqual(['draft', 'published']);
  });

  it('ping() should return true on successful query', async () => {
    const client = makeMockClient([{ '?column?': 1 }]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });
    const result = await adapter.ping();
    expect(result).toBe(true);
  });

  it('ping() should return false on failed query', async () => {
    const client = {
      async query() { throw new Error('Connection refused'); },
    };
    const adapter = createSQLAdapter({ client: client as any, dialect: 'postgres' });
    const result = await adapter.ping();
    expect(result).toBe(false);
  });

  it('findRefreshToken() should query by token', async () => {
    const client = makeMockClient([{ id: 'rt1', token: 'tok123', user_id: 'u1' }]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    const result = await adapter.findRefreshToken('tok123');
    expect(client._calls[0].sql).toContain('WHERE token = $1');
    expect(result).not.toBeNull();
  });

  it('deleteRefreshToken() should DELETE by token', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    await adapter.deleteRefreshToken('tok-to-delete');
    expect(client._calls[0].sql).toContain('DELETE FROM');
    expect(client._calls[0].values).toEqual(['tok-to-delete']);
  });

  it('soft delete: read() should add deleted_at IS NULL clause', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres', softDelete: true });

    await adapter.read('Post', {});
    expect(client._calls[0].sql).toContain('deleted_at IS NULL');
  });
});

describe('createSQLAdapter — $or / $and operators', () => {
  it('read() should handle $or', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    await adapter.read('User', {
      $or: [{ role: 'admin' }, { role: 'moderator' }],
    });

    expect(client._calls[0].sql).toContain('OR');
  });

  it('read() should handle $and', async () => {
    const client = makeMockClient([]);
    const adapter = createSQLAdapter({ client, dialect: 'postgres' });

    await adapter.read('User', {
      $and: [{ status: 'active' }, { role: 'user' }],
    });

    expect(client._calls[0].sql).toContain('AND');
  });
});
