// In-memory D1 stand-in backed by node:sqlite, with every drizzle migration applied.
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import type { ContentDatabase, D1Statement, StatementResult } from "../../server/store.ts";

class TestStatement implements D1Statement {
  values: unknown[] = [];
  readonly database: DatabaseSync;
  readonly sql: string;
  constructor(database: DatabaseSync, sql: string) { this.database = database; this.sql = sql; }
  bind(...values: unknown[]): D1Statement { this.values = values; return this; }
  async first<T>(): Promise<T | null> { return (this.database.prepare(this.sql).get(...this.values as never[]) as T) ?? null; }
  async run(): Promise<StatementResult> {
    const result = this.database.prepare(this.sql).run(...this.values as never[]);
    return { success: true, meta: { changes: Number(result.changes) } };
  }
}

export class TestDatabase implements ContentDatabase {
  readonly sqlite = new DatabaseSync(":memory:");
  constructor() {
    for (const file of readdirSync(new URL("../../drizzle/", import.meta.url)).filter(file => file.endsWith(".sql")).sort()) {
      this.sqlite.exec(readFileSync(new URL(`../../drizzle/${file}`, import.meta.url), "utf8"));
    }
  }
  prepare(sql: string): D1Statement { return new TestStatement(this.sqlite, sql); }
  async batch(statements: D1Statement[]): Promise<StatementResult[]> {
    const results = [];
    for (const statement of statements) results.push(await statement.run());
    return results;
  }
}
