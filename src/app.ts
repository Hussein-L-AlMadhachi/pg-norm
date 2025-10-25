import postgres from "postgres";

type ConnectionOptions = postgres.Options<{}>;
export type PG_Connection = ReturnType<typeof postgres>;



import { type TableBase } from "./tables.js";



export class PG_App {

    public tables: Record<string , TableBase> = {};
    public sql:PG_Connection;

    constructor( options:ConnectionOptions ){
        this.sql = postgres(options);
    }

    register( table:TableBase ) {
        this.tables[ table.table_name ] = table;
    }

    async createTables(){
        for( const table_name in this.tables ){
            await this.tables[ table_name ]!.create();
        }
    }

    async alterTables(){
        for( const table_name in this.tables ){
           await this.tables[ table_name ]!.alter();
        }
    }

}

