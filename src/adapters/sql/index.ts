/**
 * SQL Adapter for Dolphin Server Modules
 * 
 * DatabaseAdapter interface को full SQL implementation।
 * PostgreSQL (pg), MySQL (mysql2), र SQLite (better-sqlite3) support गर्छ।
 * 
 * Usage:
 *   import { createSQLAdapter } from 'dolphin-server-modules/adapters/sql';
 *   import { Pool } from 'pg';
 * 
 *   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 *   const db = createSQLAdapter({ client: pool, dialect: 'postgres' });
 */

import crypto from 'node:crypto';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SQLDialect = 'postgres' | 'mysql' | 'sqlite';

export interface SQLAdapterConfig {
  /** Database client instance (pg Pool, mysql2 Pool, or better-sqlite3 Database) */
  client: any;
  /** SQL dialect (default: 'postgres') */
  dialect?: SQLDialect;
  /**
   * Table name map — defaults to snake_case of collection name.
   * e.g. { User: 'users', RefreshToken: 'refresh_tokens' }
   */
  tables?: Record<string, string>;
  /** Enable soft delete (adds deleted_at column check). Default: false */
  softDelete?: boolean;
  /** Soft delete column name. Default: 'deleted_at' */
  softDeleteColumn?: string;
  /** Max rows returned per query. Default: 100 */
  maxLimit?: number;
  /** Enable debug SQL logging. Default: false */
  debug?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toSnakeCase = (str: string): string =>
  str.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, '');

const generateId = (): string => crypto.randomUUID();

const now = (): string => new Date().toISOString();

// ─── Query Builder ────────────────────────────────────────────────────────────

class QueryBuilder {
  private conditions: string[] = [];
  private values: any[] = [];
  private paramIdx = 1;

  constructor(private readonly dialect: SQLDialect) {}

  private placeholder(): string {
    if (this.dialect === 'postgres') return `$${this.paramIdx++}`;
    return '?'; // mysql + sqlite
  }

  /**
   * Build WHERE clause from a filter object.
   * Supports: equality, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $like, $and, $or
   */
  where(filter: Record<string, any>, prefix = ''): this {
    for (const [key, val] of Object.entries(filter)) {
      const col = prefix + toSnakeCase(key === 'id' ? 'id' : key);

      if (key === '$and' && Array.isArray(val)) {
        const parts = val.map((f: any) => {
          const sub = new QueryBuilder(this.dialect);
          sub.paramIdx = this.paramIdx;
          sub.where(f);
          this.paramIdx = sub.paramIdx;
          this.values.push(...sub.values);
          return `(${sub.conditions.join(' AND ')})`;
        });
        this.conditions.push(`(${parts.join(' AND ')})`);
        continue;
      }

      if (key === '$or' && Array.isArray(val)) {
        const parts = val.map((f: any) => {
          const sub = new QueryBuilder(this.dialect);
          sub.paramIdx = this.paramIdx;
          sub.where(f);
          this.paramIdx = sub.paramIdx;
          this.values.push(...sub.values);
          return `(${sub.conditions.join(' AND ')})`;
        });
        this.conditions.push(`(${parts.join(' OR ')})`);
        continue;
      }

      if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
        if (val.$eq !== undefined)  { this.conditions.push(`${col} = ${this.placeholder()}`);   this.values.push(val.$eq); }
        if (val.$ne !== undefined)  { this.conditions.push(`${col} != ${this.placeholder()}`);  this.values.push(val.$ne); }
        if (val.$gt !== undefined)  { this.conditions.push(`${col} > ${this.placeholder()}`);   this.values.push(val.$gt); }
        if (val.$gte !== undefined) { this.conditions.push(`${col} >= ${this.placeholder()}`);  this.values.push(val.$gte); }
        if (val.$lt !== undefined)  { this.conditions.push(`${col} < ${this.placeholder()}`);   this.values.push(val.$lt); }
        if (val.$lte !== undefined) { this.conditions.push(`${col} <= ${this.placeholder()}`);  this.values.push(val.$lte); }
        if (val.$like !== undefined){ this.conditions.push(`${col} ILIKE ${this.placeholder()}`); this.values.push(`%${val.$like}%`); }
        if (val.$in !== undefined && Array.isArray(val.$in)) {
          const placeholders = val.$in.map(() => this.placeholder()).join(', ');
          this.conditions.push(`${col} IN (${placeholders})`);
          this.values.push(...val.$in);
        }
        if (val.$nin !== undefined && Array.isArray(val.$nin)) {
          const placeholders = val.$nin.map(() => this.placeholder()).join(', ');
          this.conditions.push(`${col} NOT IN (${placeholders})`);
          this.values.push(...val.$nin);
        }
      } else {
        this.conditions.push(`${col} = ${this.placeholder()}`);
        this.values.push(val);
      }
    }
    return this;
  }

  build(): { sql: string; values: any[] } {
    const sql = this.conditions.length ? `WHERE ${this.conditions.join(' AND ')}` : '';
    return { sql, values: this.values };
  }
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

const mapRow = (row: any): any => {
  if (!row) return null;
  const out: any = {};
  for (const [k, v] of Object.entries(row)) {
    // snake_case → camelCase
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  // Ensure id field
  if (out.id === undefined && (row as any).id !== undefined) out.id = String((row as any).id);
  return out;
};

// ─── SQL Executor ─────────────────────────────────────────────────────────────

async function runQuery(client: any, sql: string, values: any[], dialect: SQLDialect, debug: boolean): Promise<any[]> {
  if (debug) console.log('[SQL]', sql, values);

  if (dialect === 'postgres') {
    const result = await client.query(sql, values);
    return result.rows ?? [];
  }

  if (dialect === 'mysql') {
    const [rows] = await client.execute(sql, values);
    return Array.isArray(rows) ? rows : [];
  }

  if (dialect === 'sqlite') {
    // better-sqlite3 is synchronous
    const stmt = client.prepare(sql);
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return stmt.all(...values);
    }
    stmt.run(...values);
    return [];
  }

  return [];
}

// ─── createSQLAdapter ─────────────────────────────────────────────────────────

/**
 * createSQLAdapter()
 * 
 * DatabaseAdapter implementation for SQL databases.
 * Drop-in replacement for createMongooseAdapter() — same interface.
 * 
 * Required SQL schema (minimum):
 * 
 *   CREATE TABLE users (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     email TEXT UNIQUE NOT NULL,
 *     password TEXT NOT NULL,
 *     role TEXT DEFAULT 'user',
 *     two_factor_secret TEXT,
 *     two_factor_enabled BOOLEAN DEFAULT false,
 *     reset_password_token TEXT,
 *     reset_password_expires TIMESTAMPTZ,
 *     created_at TIMESTAMPTZ DEFAULT NOW(),
 *     updated_at TIMESTAMPTZ DEFAULT NOW(),
 *     deleted_at TIMESTAMPTZ
 *   );
 * 
 *   CREATE TABLE refresh_tokens (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     token TEXT UNIQUE NOT NULL,
 *     user_id UUID REFERENCES users(id) ON DELETE CASCADE,
 *     expires_at TIMESTAMPTZ NOT NULL,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 * 
 * @example
 * // PostgreSQL
 * import { Pool } from 'pg';
 * const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 * const db = createSQLAdapter({ client: pool, dialect: 'postgres' });
 * 
 * // MySQL
 * import mysql from 'mysql2/promise';
 * const pool = mysql.createPool({ uri: process.env.MYSQL_URL });
 * const db = createSQLAdapter({ client: pool, dialect: 'mysql' });
 * 
 * // SQLite
 * import Database from 'better-sqlite3';
 * const sqlite = new Database('app.db');
 * const db = createSQLAdapter({ client: sqlite, dialect: 'sqlite' });
 */
export function createSQLAdapter(config: SQLAdapterConfig) {
  const {
    client,
    dialect = 'postgres',
    tables = {},
    softDelete = false,
    softDeleteColumn = 'deleted_at',
    maxLimit = 100,
    debug = false,
  } = config;

  const getTable = (collection: string): string =>
    tables[collection] ?? toSnakeCase(collection) + (collection.endsWith('s') ? '' : 's');

  const q = (sql: string, values: any[]) => runQuery(client, sql, values, dialect, debug);

  const softDeleteClause = (existing: string[]): string => {
    if (!softDelete) return '';
    const col = toSnakeCase(softDeleteColumn);
    return existing.length ? ` AND ${col} IS NULL` : ` WHERE ${col} IS NULL`;
  };

  const adapter = {
    // ── Auth Methods ───────────────────────────────────────────────────────────

    async createUser(data: any) {
      const table = getTable('User');
      const id = data.id ?? generateId();
      const createdAt = now();
      const cols = ['id', 'created_at', 'updated_at'];
      const vals: any[] = [id, createdAt, createdAt];

      for (const [k, v] of Object.entries(data)) {
        if (k === 'id') continue;
        cols.push(toSnakeCase(k));
        vals.push(v);
      }

      // postgres: $1,$2... | mysql/sqlite: ?,?,?
      const placeholders = cols.map((_, i) =>
        dialect === 'postgres' ? `$${i + 1}` : '?'
      ).join(', ');

      const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`;

      if (dialect === 'postgres') {
        const rows = await q(sql, vals);
        return mapRow(rows[0]);
      }

      // mysql / sqlite — no RETURNING
      await q(
        `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
        vals
      );
      const rows = await q(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return mapRow(rows[0]);
    },

    async findUserByEmail(email: string) {
      const table = getTable('User');
      const p = dialect === 'postgres' ? '$1' : '?';
      const rows = await q(
        `SELECT * FROM ${table} WHERE LOWER(email) = LOWER(${p})${softDeleteClause([])} LIMIT 1`,
        [email]
      );
      return mapRow(rows[0] ?? null);
    },

    async findUserById(id: string) {
      const table = getTable('User');
      const p = dialect === 'postgres' ? '$1' : '?';
      const rows = await q(
        `SELECT * FROM ${table} WHERE id = ${p}${softDeleteClause([])} LIMIT 1`,
        [id]
      );
      return mapRow(rows[0] ?? null);
    },

    async updateUser(id: string, data: any) {
      const table = getTable('User');
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;

      for (const [k, v] of Object.entries(data)) {
        if (k === 'id') continue;
        sets.push(dialect === 'postgres' ? `${toSnakeCase(k)} = $${idx++}` : `${toSnakeCase(k)} = ?`);
        vals.push(v);
      }
      sets.push(dialect === 'postgres' ? `updated_at = $${idx++}` : 'updated_at = ?');
      vals.push(now());
      vals.push(id);

      const p = dialect === 'postgres' ? `$${idx}` : '?';
      if (dialect === 'postgres') {
        const rows = await q(
          `UPDATE ${table} SET ${sets.join(', ')} WHERE id = ${p} RETURNING *`,
          vals
        );
        return mapRow(rows[0]);
      }
      await q(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ${p}`, vals);
      const rows = await q(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return mapRow(rows[0] ?? null);
    },

    async findUserByResetToken(token: string) {
      const table = getTable('User');
      const p = dialect === 'postgres' ? '$1' : '?';
      const rows = await q(
        `SELECT * FROM ${table} WHERE reset_password_token = ${p} LIMIT 1`,
        [token]
      );
      return mapRow(rows[0] ?? null);
    },

    async saveRefreshToken(data: any) {
      const table = getTable('RefreshToken');
      const id = data.id ?? generateId();
      const cols = ['id', ...Object.keys(data).filter((k) => k !== 'id').map(toSnakeCase)];
      const vals = [id, ...Object.values(data).filter((_, i) => Object.keys(data)[i] !== 'id')];
      const placeholders = cols.map((_, i) => dialect === 'postgres' ? `$${i + 1}` : '?').join(', ');
      await q(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`, vals);
    },

    async findRefreshToken(token: string) {
      const table = getTable('RefreshToken');
      const p = dialect === 'postgres' ? '$1' : '?';
      const rows = await q(`SELECT * FROM ${table} WHERE token = ${p} LIMIT 1`, [token]);
      return mapRow(rows[0] ?? null);
    },

    async deleteRefreshToken(token: string) {
      const table = getTable('RefreshToken');
      const p = dialect === 'postgres' ? '$1' : '?';
      await q(`DELETE FROM ${table} WHERE token = ${p}`, [token]);
    },

    // ── CRUD Methods ───────────────────────────────────────────────────────────

    async create(collection: string, data: any) {
      const table = getTable(collection);
      const id = data.id ?? generateId();
      const createdAt = now();
      const cols = ['id', 'created_at', 'updated_at'];
      const vals: any[] = [id, createdAt, createdAt];

      for (const [k, v] of Object.entries(data)) {
        if (k === 'id') continue;
        cols.push(toSnakeCase(k));
        vals.push(v);
      }

      const placeholders = cols.map((_, i) => dialect === 'postgres' ? `$${i + 1}` : '?').join(', ');

      if (dialect === 'postgres') {
        const rows = await q(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
          vals
        );
        return mapRow(rows[0]);
      }
      await q(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
      const rows = await q(`SELECT * FROM ${table} WHERE id = ?`, [id]);
      return mapRow(rows[0]);
    },

    async read(collection: string, query: any = {}, options: any = {}) {
      const table = getTable(collection);
      const qb = new QueryBuilder(dialect);
      const { limit, offset, sort, ...filter } = options;
      qb.where(filter);
      if (Object.keys(query).length) qb.where(query);

      const { sql: whereSql, values } = qb.build();
      const softClause = softDeleteClause(whereSql ? [whereSql] : []);
      const orderClause = sort ? `ORDER BY ${Object.entries(sort).map(([k, v]) => `${toSnakeCase(k)} ${v === 'asc' ? 'ASC' : 'DESC'}`).join(', ')}` : '';
      const cap = Math.min(limit ?? maxLimit, maxLimit);
      const limitClause = `LIMIT ${cap}${offset ? ` OFFSET ${offset}` : ''}`;

      const rows = await q(
        `SELECT * FROM ${table} ${whereSql}${softClause} ${orderClause} ${limitClause}`.trim(),
        values
      );
      return rows.map(mapRow);
    },

    async update(collection: string, query: any, data: any) {
      const table = getTable(collection);
      const sets: string[] = [];
      const vals: any[] = [];
      let idx = 1;

      for (const [k, v] of Object.entries(data)) {
        sets.push(dialect === 'postgres' ? `${toSnakeCase(k)} = $${idx++}` : `${toSnakeCase(k)} = ?`);
        vals.push(v);
      }
      sets.push(dialect === 'postgres' ? `updated_at = $${idx++}` : 'updated_at = ?');
      vals.push(now());

      const qb = new QueryBuilder(dialect);
      qb.where(query);
      const { sql: whereSql, values: whereVals } = qb.build();

      // Re-index postgres placeholders for WHERE clause
      let finalWhere = whereSql;
      if (dialect === 'postgres') {
        let wi = idx;
        finalWhere = whereSql.replace(/\$\d+/g, () => `$${wi++}`);
        idx = wi;
      }
      vals.push(...whereVals);

      await q(`UPDATE ${table} SET ${sets.join(', ')} ${finalWhere}`, vals);
      return { updated: true };
    },

    async delete(collection: string, query: any) {
      const table = getTable(collection);

      if (softDelete) {
        return this.update(collection, query, { [softDeleteColumn]: now() });
      }

      const qb = new QueryBuilder(dialect);
      qb.where(query);
      const { sql: whereSql, values } = qb.build();
      await q(`DELETE FROM ${table} ${whereSql}`, values);
      return { deleted: true };
    },

    async advancedRead(collection: string, query: any, options: any) {
      return this.read(collection, query, options);
    },

    // ── Utility ────────────────────────────────────────────────────────────────

    /** Run raw SQL — for complex queries not covered by the adapter */
    async raw(sql: string, values: any[] = []) {
      return q(sql, values);
    },

    /** Test the database connection */
    async ping(): Promise<boolean> {
      try {
        if (dialect === 'postgres') await q('SELECT 1', []);
        if (dialect === 'mysql') await q('SELECT 1', []);
        if (dialect === 'sqlite') await q('SELECT 1', []);
        return true;
      } catch {
        return false;
      }
    },

    /** Get table name for a collection */
    tableName: (collection: string) => getTable(collection),
  };

  return adapter;
}

export type SQLAdapter = ReturnType<typeof createSQLAdapter>;
