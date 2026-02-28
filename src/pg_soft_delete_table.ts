import {PG_App} from "./pg_app.js";
import { PG_Table } from './pg_table.js';
import {type PG_ColumnAccess} from "./pg_column_access.js";





export class PG_SoftDeleteTable extends PG_Table {



    softDeleteColumn: string = 'deleted_at';



    constructor(app: PG_App, table_name: string, permissions: PG_ColumnAccess) {
        super(app, table_name, permissions);
    }



    async delete(id: number, sql_obj=null) {
        const sql = this.externalSql( sql_obj );

        return this.sql`
            UPDATE ${this.sql(this.table_name)}
            SET ${this.sql(this.softDeleteColumn)} = NOW()
            WHERE id = ${id}
        `;
    }



    async listAll<T>(sql_obj=null): Promise<T[]> {
        const sql = this.externalSql(sql_obj);

        return this.extract<T>( await sql`
            SELECT ${this.sql(this.selectables)}
            FROM ${this.sql(this.table_name)}
            WHERE ${this.sql(this.softDeleteColumn)} IS NULL
        `);
    }



    async fetch<T>(row_id:number, sql_obj=null): Promise<T|undefined> {
        const sql = this.externalSql( sql_obj );

        return this.extractOne<T>( await sql`
            SELECT ${ sql(this.selectables) } FROM ${sql(this.table_name)} WHERE id=${row_id} 
            AND ${this.sql(this.softDeleteColumn)} IS NULL
        `);
    }



    async restore(id: number, sql_obj=null) {
        const sql = this.externalSql( sql_obj );

        return sql`
            UPDATE ${sql(this.table_name)}
            SET ${sql(this.softDeleteColumn)} = NULL
            WHERE id = ${id}
        `;
    }



    async fetchDeleted<T>(row_id:number, sql_obj=null): Promise<T[]> {
        const sql = this.externalSql( sql_obj );

        return this.extract<T>( await sql`
            SELECT ${ sql(this.selectables) } FROM ${sql(this.table_name)} WHERE id=${row_id}
            AND ${this.sql(this.softDeleteColumn)} IS NOT NULL
        `);
    }



    async listAllDeleted<T>(sql_obj=null): Promise<T[]> {
        const sql = this.externalSql( sql_obj );

        return this.extract<T>( await sql`
            SELECT ${ sql(this.selectables) } FROM ${sql(this.table_name)}
            WHERE ${this.sql(this.softDeleteColumn)} IS NOT NULL
        `);
    }



    public async list<T>(limit: number = 50, last_id:number , sql_obj=null): Promise<T[]> {
        const sql = this.externalSql( sql_obj );
        const rows_limit = Math.min( Math.round(limit) , this.max_rows_fetched);

        return this.extract<T>( await sql`
            SELECT ${sql(this.selectables)}
            FROM ${sql(this.table_name)}
            LIMIT ${rows_limit}
            WHERE id > ${last_id} AND
            ${this.sql(this.softDeleteColumn)} IS NULL 
        ` );
    }



    public async listDeleted<T>(limit: number = 50, last_id:number , sql_obj=null): Promise<T[]> {
        const sql = this.externalSql( sql_obj );
        const rows_limit = Math.min( Math.round(limit) , this.max_rows_fetched);

        return this.extract<T>( await sql`
            SELECT ${sql(this.selectables)}
            FROM ${sql(this.table_name)}
            LIMIT ${rows_limit}
            WHERE id > ${last_id}
        `);
    }



    async hard_delete(id: number, sql_obj=null) {
        return super.delete(id, sql_obj);
    }



}

