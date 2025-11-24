import bcrypt from 'bcrypt';
import {PG_App , type PG_Connection} from "./app.js";



export interface TableBase {
    table_name: string;
    visibles: string[];
    create():Promise<void>;
    alter():Promise<void>;
}



export class PG_Table implements TableBase {


    public table_name: string;
    public visibles: string[];
    protected sql:PG_Connection;
    protected max_rows_fetched:number = 50;


    public async alter() {}


    constructor( pg_app:PG_App , name:string , feilds:string[] ){
        this.sql = pg_app.sql;
        this.table_name = name;
        this.visibles = feilds;
    }


    public async create(){
        throw new Error("You need to overwrite this method. this is where your CREATE TABLE statement goes");
    } // to be overwritten


    public async insert( data:Record<string,any> ) {
        const keys = Object.keys( data );

        // validate keys
        for( const key of keys ){
            if ( ! this.visibles.includes(key) ){
                throw new Error("inserted rows need to have all columns in visibles");
            }
        }

        return await this.sql`INSERT INTO ${  this.sql(this.table_name)  } ${  this.sql(data , ...keys)  } returning id`; 
    }


    public async fetch( row_id:number ) {
        return await this.sql`SELECT ${ this.sql(this.visibles) } FROM ${this.sql(this.table_name)} WHERE id=${row_id}`;
    }


    public async list(limit: number = 50, page_number: number = 0) {

        const rows_limit = Math.min( Math.round(limit) , this.max_rows_fetched);
        const rows_offset = Math.max( Math.round(page_number), 0) * rows_limit;

        return await this.sql`
            SELECT ${this.sql(this.visibles)}
            FROM ${this.sql(this.table_name)}
            LIMIT ${rows_limit}
            OFFSET ${rows_offset}
        `;
    }


    public async listAll() {
        return await this.sql`
            SELECT ${this.sql(this.visibles)}
            FROM ${this.sql(this.table_name)}
        `;
    }


    public async delete( row_id:number ) {
        return await this.sql`DELETE FROM ${this.sql(this.table_name)} WHERE id=${row_id}`;
    }


    public async update( row_id:number , data:Record<string,any> ) {
        const keys = Object.keys( data );

        // validate keys
        for( const key of keys ){
            if ( ! this.visibles.includes(key) ){
                throw new Error("inserted rows need to have all columns in visibles");
            }
        }

        return await this.sql`UPDATE ${this.sql(this.table_name)} SET ${  this.sql( data , ...keys )  } where id=${row_id} returning id`;
    }


}





export class PG_AuthTable extends PG_Table {


    protected passwordField:string = "password_hash";
    public table_name: string;
    protected identify_user_by: string;
    private dummy_password_hash:string = "$2a$12$4jMZgsZF8HpkBKETdDSKDOIuFwkwYTppUbap/RbTyRCpFuHa2UoCe";


    constructor(pg_connection:PG_App , name: string, fillables: string[] = [] , identify_user_by:string="username" ) {
        super(pg_connection, name , fillables );
        this.identify_user_by = identify_user_by;
        this.table_name = name;
    }


    /**
     * Override insert to hash password automatically
     */
    public async insert(data: Record<string, any>) {
        // Hash password if present
        if (data.password) {
            data[ this.passwordField ] = await this.hashPassword(data.password);
            delete data.password; // Remove plain text password
        }

        // Validate keys against fillables
        const keys = Object.keys(data);
        for (const key of keys) {
            if (!this.visibles.includes(key) && key !== this.passwordField) {
                throw new Error(`${key} has to be a fillable`);
            }
        }

        return await this.sql`INSERT INTO ${this.sql(this.table_name)} ${this.sql(data, ...keys)} RETURNING id`;
    }


    /**
     * Update password method with secure hashing
     */
    public async updatePassword(userId: number, newPassword: string) {
        const passwordHash = await this.hashPassword(newPassword);
        
        return await this.sql`
            UPDATE ${this.sql(this.table_name)} 
            SET ${this.sql({ [this.passwordField]: passwordHash })} 
            WHERE id = ${userId} 
            RETURNING id
        `;
    }


    /**
     *   Verify password against stored hash (limited auth applications)
     */
    public async verifyPassword(user_identifier: string, plainTextPassword: string): Promise<boolean> {
        const [user] = await this.sql`
            SELECT ${this.sql(this.passwordField)} 
            FROM ${this.sql(this.table_name)} 
            WHERE ${this.sql(this.identify_user_by)} = ${user_identifier}
        `;

        if (!user || !user[this.passwordField]) {
            // when the user doesn't exist we wanna act like we're trying to log the user in so they can't use timing attacks
            await bcrypt.compare('dummy_password', this.dummy_password_hash);
            return false;
        }

        return await bcrypt.compare(plainTextPassword, user[this.passwordField]);
    }


    /**
     *   A more practical method for authentication
     */
    public async idAfterAuth(user_identifier: string, plainTextPassword: string): Promise<number|undefined> {
        const [user] = await this.sql`
            SELECT ${this.sql(this.passwordField, "id")}
            FROM ${this.sql(this.table_name)} 
            WHERE ${this.sql(this.identify_user_by)} = ${user_identifier}
        `;

        if (!user || !user[this.passwordField]) {
            // when the user doesn't exist we wanna act like we're trying to log the user in so they can't use timing attacks
            await bcrypt.compare('dummy_password', this.dummy_password_hash);
            return undefined;
        }

        if( await bcrypt.compare(plainTextPassword, user[this.passwordField]) ){
            return user.id as number;
        }
    }


    /**
     *   More practical method for advanced Authentication methods
     */
    public async fetchAfterAuth(user_identifier: string, plainTextPassword: string , columns:string[] ): Promise<Record<string,any>|undefined> {
        for ( const column of columns ){
            if ( ! this.visibles.includes(column) ) throw new ReferenceError("access to non-viisble non-authorized columns is restricted")
        }
        
        const [user] = await this.sql`
            SELECT ${this.sql(this.passwordField, ...columns)}
            FROM ${this.sql(this.table_name)} 
            WHERE ${this.sql(this.identify_user_by)} = ${user_identifier}
        `;

        if (!user || !user[this.passwordField]) {
            // when the user doesn't exist we wanna act like we're trying to log the user in so they can't use timing attacks
            await bcrypt.compare('dummy_password', this.dummy_password_hash);
            return undefined;
        }

        if( await bcrypt.compare(plainTextPassword, user[this.passwordField]) ){
            delete user[this.passwordField];
            return user;
        }
    }


    /**
     * Secure password hashing
     */
    protected async hashPassword(password: string): Promise<string> {
        if (!password || password.length < 8) {
            throw new Error('Password must be at least 8 characters long');
        }
        
        const saltRounds = 12;
        return await bcrypt.hash(password, saltRounds);
    }

}





export class PG_Ledger implements TableBase {

    public table_name: string;
    public visibles: string[];
    public readonly create: ()=>Promise<void>;
    protected sql: PG_Connection;
    protected max_rows_fetched:number = 50;

    constructor( pg_app:PG_App , name:string , fillables:string[] ){
        this.sql = pg_app.sql;
        this.table_name = name;
        this.visibles = fillables;

        this.create = async ()=>{
            await this.createTable();

            await this.sql`
                ALTER TABLE ${this.sql(this.table_name)} ENABLE ROW LEVEL SECURITY;

                CREATE POLICY ${ this.sql(`${this.table_name}_no_update_policy`) }
                ON ${ this.sql(this.table_name) }
                TO PUBLIC
                FOR UPDATE
                WITH CHECK (false);

                CREATE POLICY ${ this.sql(`${this.table_name}_no_update_for_policy`) }
                TO PUBLIC
                FOR UPDATE USING (false);


                CREATE POLICY ${ this.sql(`${this.table_name}_no_delete_policy`) } 
                ON ${ this.sql(this.table_name) }
                TO PUBLIC
                FOR DELETE
                USING (false);

                CREATE OR REPLACE FUNCTION ${this.sql(`${this.table_name}_block_all_updates()`)}
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'Table "%" is immutable. Updates are not allowed.', TG_TABLE_NAME;
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;

                -- Attach to your ledger table
                CREATE TRIGGER ${ this.sql(`${this.table_name}_prevent_update_trigger`) } 
                    BEFORE UPDATE ON ${this.sql(this.table_name)}
                    FOR EACH ROW ALWAYS EXECUTE FUNCTION ${this.sql(`${this.table_name}_block_all_updates()`)};


                REVOKE TRUNCATE ON ${this.sql(this.table_name)} FROM PUBLIC;

                CREATE OR REPLACE FUNCTION ${this.sql(`${this.table_name}_block_truncate()`)}
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'Table "%" is immutable. TRUNCATE is not allowed.', TG_TABLE_NAME;
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;

                -- Attach TRUNCATE trigger to your ledger table
                CREATE TRIGGER ${ this.sql(`${this.table_name}_prevent_truncate_trigger`) }
                    BEFORE TRUNCATE ON ${this.sql(this.table_name)}
                    FOR EACH STATEMENT ALWAYS EXECUTE FUNCTION ${this.sql(`${this.table_name}_block_truncate()`)};


                -- Creating a trigger function that blocks ALL deletes
                CREATE OR REPLACE FUNCTION ${this.sql(`${this.table_name}_block_all_deletes()`)}
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION 'Table "%" is immutable. DELETES are not allowed.', TG_TABLE_NAME;
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql;

                -- Attach DELETE trigger to your ledger table
                CREATE TRIGGER ${ this.sql(`${this.table_name}_prevent_any_deletes_trigger`) } 
                    BEFORE DELETE ON ${this.sql(this.table_name)}
                    FOR EACH ROW ALWAYS EXECUTE FUNCTION ${this.sql(`${this.table_name}_block_all_deletes()`)};

                -- enabling ALWAYS on triggers
                ALTER TABLE ${this.sql(this.table_name)}
                ENABLE ALWAYS TRIGGER ${ this.sql(`${this.table_name}_prevent_update_trigger`) };

                ALTER TABLE ${this.sql(this.table_name)}
                ENABLE ALWAYS TRIGGER ${ this.sql(`${this.table_name}_prevent_truncate_trigger`) };

                ALTER TABLE ${this.sql(this.table_name)}
                ENABLE ALWAYS TRIGGER ${ this.sql(`${this.table_name}_prevent_any_deletes_trigger`) };

            `;
        }

    }

    // to be overwritten by inheritors for them to alter their own tables schema
    public async alter() {
        throw new Error("You need to overwrite this method. this is where your ALTER TABLE statement goes");
    }

    // to be overwritten by inheritors for them to make thier own schema but users call create like normal to create the tables
    protected async createTable(){
        throw new Error("You need to overwrite this method. this is where your CREATE TABLE statement goes");
    }

    public async insert( data:Record<string,any> ) {
        const keys = Object.keys( data );

        // validate keys
        for( const key of keys ){
            if ( ! this.visibles.includes(key) ){
                throw new Error("updated has to be a fillable");
            }
        }

        return await this.sql`INSERT INTO ${  this.sql(this.table_name)  } ${  this.sql(data , ...keys)  } RETURNING id`; 
    }

    public async fetch( row_id:number ) {
        return await this.sql`SELECT ${ this.sql(this.visibles) } FROM ${this.sql(this.table_name)} WHERE id=${row_id}`;
    }

    public async list(limit: number = 50, page_number: number = 0) {

        const rows_limit = Math.min( Math.round(limit) , this.max_rows_fetched);
        const rows_offset = Math.max( Math.round(page_number), 0) * rows_limit;

        return await this.sql`
            SELECT ${this.sql(this.visibles)}
            FROM ${this.sql(this.table_name)}
            LIMIT ${rows_limit}
            OFFSET ${rows_offset}
        `;
    }

    public async listAll() {
        return await this.sql`
            SELECT ${this.sql(this.visibles)}
            FROM ${this.sql(this.table_name)}
        `;
    }

    public async delete( row_id:number ) {
        throw new Error( "ledgers are immutable!!! you cannot delete from them" );
    }


    public async update( row_id:number ) {
        throw new Error( "ledgers are immutable!!! you cannot update any row in them" );
    }

}

