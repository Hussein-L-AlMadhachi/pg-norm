import {PG_App} from "./app.js";
import { PG_Table } from './pg_table.js';
import {type PG_ColumnAccess} from "./pg_column_access.js";





export class PG_SoftDeleteTable extends PG_Table {

    softDeleteColumn: string = 'deleted_at';



    constructor(app: PG_App, table_name: string, permissions: PG_ColumnAccess) {
        super(app, table_name, permissions);
    }



    async delete(id: number) {
        return this.sql`
            UPDATE ${this.sql(this.table_name)}
            SET ${this.sql(this.softDeleteColumn)} = NOW()
            WHERE id = ${id}
        `;
    }



    async listAll(sql_obj=null) {
        const sql = this.external_sql(sql_obj);

        return sql`
            SELECT ${this.sql(this.selectables)}
            FROM ${this.sql(this.table_name)}
            WHERE ${this.sql(this.softDeleteColumn)} IS NULL
        `;
    }



    async fetch(row_id:number, sql_obj=null) {
        const sql = this.external_sql( sql_obj );

        return await sql`
            SELECT ${ sql(this.selectables) } FROM ${sql(this.table_name)} WHERE id=${row_id} 
            AND ${this.sql(this.softDeleteColumn)} IS NULL
        `;
    }



    async restore(id: number, sql_obj=null) {
        const sql = this.external_sql( sql_obj );

        return sql`
            UPDATE ${sql(this.table_name)}
            SET ${sql(this.softDeleteColumn)} = NULL
            WHERE id = ${id}
        `;
    }



    async fetchDeleted(row_id:number, sql_obj=null) {
        const sql = this.external_sql( sql_obj );

        return await sql`
            SELECT ${ sql(this.selectables) } FROM ${sql(this.table_name)} WHERE id=${row_id}
        `;
    }



    async listAllDeleted(row_id:number, sql_obj=null) {
        const sql = this.external_sql( sql_obj );

        return await sql`
            SELECT ${ sql(this.selectables) } FROM ${sql(this.table_name)}
        `;
    }



    public async list(limit: number = 50, last_id:number , sql_obj=null) {
        const sql = this.external_sql( sql_obj );
        const rows_limit = Math.min( Math.round(limit) , this.max_rows_fetched);

        return await sql`
            SELECT ${sql(this.selectables)}
            FROM ${sql(this.table_name)}
            LIMIT ${rows_limit}
            WHERE id > ${last_id} AND
            ${this.sql(this.softDeleteColumn)} IS NULL 
        `;
    }



    public async listDeleted(limit: number = 50, last_id:number , sql_obj=null) {
        const sql = this.external_sql( sql_obj );
        const rows_limit = Math.min( Math.round(limit) , this.max_rows_fetched);

        return await sql`
            SELECT ${sql(this.selectables)}
            FROM ${sql(this.table_name)}
            LIMIT ${rows_limit}
            WHERE id > ${last_id}
        `;
    }



    async hard_delete(id: number, sql_obj=null) {
        return super.delete(id, sql_obj);
    }


}

