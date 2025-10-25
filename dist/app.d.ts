import postgres from "postgres";
type ConnectionOptions = postgres.Options<{}>;
export type PG_Connection = ReturnType<typeof postgres>;
import { type TableBase } from "./tables.js";
export declare class PG_App {
    tables: Record<string, TableBase>;
    sql: PG_Connection;
    constructor(options: ConnectionOptions);
    register(table: TableBase): void;
    createTables(): Promise<void>;
    alterTables(): Promise<void>;
}
export {};
//# sourceMappingURL=app.d.ts.map