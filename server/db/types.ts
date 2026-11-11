export interface StatementResult { meta?: { changes?: number }; results?: unknown[]; success?: boolean }

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<StatementResult>;
}

export interface ContentDatabase {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<StatementResult[]>;
}

export interface CatalogRow {
  revision: number;
  draft_json: string;
  published_id: string | null;
  published_revision: number | null;
  published_at: string | null;
}

export interface PublicationRow { id: string; catalog_revision: number; worlds_json: string; created_at: string }
