import { PG_InvalidError } from "./errors.js";
import {PG_App , type PG_Connection} from "./pg_app.js";
import {type PG_ColumnAccess} from "./pg_column_access.js";
import type postgres from "postgres";



export interface TableBase {
    table_name: string;
    selectables: string[];
    updatables: string[];
    insertables: string[];
    create():Promise<void>;
    alter():Promise<void>;
}



export class PG_Table implements TableBase {

    public table_name: string;

    public selectables: string[];
    public updatables: string[];
    public insertables: string[];

    protected sql:PG_Connection;
    protected max_rows_fetched:number = 50;

    toString() {
        return this.table_name;
    }



    public async alter() {}



    // used to pass sql_obj to enable executing queries with in external transactions in other functions
    protected externalSql( sql_obj:PG_Connection | null ) {
        if( ! sql_obj ) {
           return this.sql; 
        }

        return sql_obj;
    }


    protected extract<T>( result:postgres.RowList<postgres.Row[]> ): T[] {
        return [...result] as T[];
    }



    protected extractOne<T>( result:postgres.RowList<postgres.Row[]> ): T|undefined {
        return result[0] as T|undefined;
    }



    constructor( pg_app:PG_App , name:string , feilds:PG_ColumnAccess ){
        this.sql = pg_app.sql;
        this.table_name = name;
        this.selectables = feilds.select;
        this.updatables = feilds.update;
        this.insertables = feilds.insert;
    }



    public async create(){
        throw new Error("You need to overwrite this method. this is where your CREATE TABLE statement goes");
    } // to be overwritten



    public async insert( data:Record<string,any>, sql_obj=null ) {
        const sql = this.externalSql( sql_obj );

        const keys = Object.keys( data );

        // validate keys
        for( const key of keys ){
            if ( ! this.insertables.includes(key) ){
                throw new Error("inserted rows need to have all its columns to be insertable columns");
            }
        }

        return await sql`INSERT INTO ${sql(this.table_name)} ${sql(data , ...keys)} returning id`; 
    }



    public async fetch<T>( row_id:number , sql_obj=null): Promise<T|undefined> {
        const sql = this.externalSql( sql_obj );
        return this.extractOne<T>(
            await sql`SELECT ${sql(this.selectables)} FROM ${sql(this.table_name)} WHERE id=${row_id}`
        );
    }



    public async list<T>(limit: number = 50, last_id:number , sql_obj=null) {
        const sql = this.externalSql( sql_obj );

        const rows_limit = Math.min( Math.round(limit) , this.max_rows_fetched);

        return this.extract<T>( await sql`
            SELECT ${sql(this.selectables)}
            FROM ${sql(this.table_name)}
            LIMIT ${rows_limit}
            WHERE id > ${last_id}
        `);
    }



    public async listAll<T>( sql_obj=null ) {
        const sql = this.externalSql( sql_obj );

        return this.extract<T>(await sql`
            SELECT ${sql(this.selectables)}
            FROM ${sql(this.table_name)}
        `);
    }



    public async delete( row_id:number , sql_obj=null ) {
        const sql = this.externalSql( sql_obj );
        return await sql`DELETE FROM ${sql(this.table_name)} WHERE id=${row_id}`;
    }



    public async update( row_id:number , data:Record<string,any> , sql_obj=null ) {
        const sql = this.externalSql( sql_obj );

        const keys = Object.keys( data );

        // validate keys
        for( const key of keys ){
            if ( ! this.updatables.includes(key) ){
                throw new Error("updated rows need to have all columns to be updatable columns");
            }
        }

        return await sql`UPDATE ${sql(this.table_name)} SET ${  sql( data , ...keys )  } where id=${row_id} returning id`;
    }


    public async insertMany(records: Record<string,any>[], sql_obj = null) {
        const sql = this.externalSql(sql_obj);

        if (records.length <= 0) {
            throw new PG_InvalidError("there is no data to insert");
        }
        
        const columns = Object.keys(records[0]!);
        
        return await sql`INSERT INTO ${sql(this.table_name)} ${sql(records, columns)}`;
    }

    public async set( record:Record<string,number|string> , sql_obj = null) {
        const sql = this.externalSql(sql_obj);

        const columns = Object.keys(record);

        return await sql`INSERT INTO ${sql(this.table_name)} ${sql(record,columns)} ON CONFLICT (id) DO UPDATE SET ${ sql(record,columns) }`;
    }
}

