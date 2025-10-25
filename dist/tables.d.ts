import { PG_App, type PG_Connection } from "./app.js";
export interface TableBase {
    table_name: string;
    visibles: string[];
    create(): Promise<void>;
    alter(): Promise<void>;
}
export declare class PG_Table implements TableBase {
    table_name: string;
    visibles: string[];
    protected sql: PG_Connection;
    alter(): Promise<void>;
    constructor(pg_app: PG_App, name: string, feilds: string[]);
    create(): Promise<void>;
    insert(data: Record<string, any>): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    fetch(row_id: number): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    list(): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    delete(row_id: number): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    update(row_id: number, data: Record<string, any>): Promise<import("postgres").RowList<import("postgres").Row[]>>;
}
export declare class PG_AuthTable extends PG_Table {
    protected passwordField: string;
    table_name: string;
    constructor(pg_connection: PG_App, name: string, fillables?: string[]);
    /**
     * Override insert to hash password automatically
     */
    insert(data: Record<string, any>): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    /**
     * Update password method with secure hashing
     */
    updatePassword(userId: number, newPassword: string): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    /**
     * Verify password against stored hash
     */
    verifyPassword(userId: number, plainTextPassword: string): Promise<boolean>;
    /**
     * Secure password hashing
     */
    protected hashPassword(password: string): Promise<string>;
}
export declare class PG_Ledger implements TableBase {
    table_name: string;
    visibles: string[];
    readonly create: () => Promise<void>;
    protected sql: PG_Connection;
    constructor(pg_app: PG_App, name: string, fillables: string[]);
    alter(): Promise<void>;
    protected createTable(): Promise<void>;
    insert(data: Record<string, any>): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    fetch(row_id: number): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    list(): Promise<import("postgres").RowList<import("postgres").Row[]>>;
    delete(row_id: number): Promise<void>;
    update(row_id: number): Promise<void>;
}
//# sourceMappingURL=tables.d.ts.map