import bcrypt from 'bcrypt';
import {PG_App} from "./app.js";
import { PG_Table } from './pg_table.js';
import {type PG_ColumnAccess} from "./pg_column_access.js";



export class PG_AuthTable extends PG_Table {



    protected passwordField:string = "password_hash";
    public table_name: string;
    protected identify_user_by: string;
    private dummy_password_hash:string = "$2a$12$4jMZgsZF8HpkBKETdDSKDOIuFwkwYTppUbap/RbTyRCpFuHa2UoCe";



    constructor(pg_connection:PG_App , name: string, fillables: PG_ColumnAccess , identify_user_by:string="username" ) {
        super(pg_connection, name , fillables );
        this.identify_user_by = identify_user_by;
        this.table_name = name;
    }



    /**
     * Override insert to hash password automatically
     */
    public async insert(data: Record<string, any> , sql_obj=null) {
        const sql = this.external_sql( sql_obj );

        // Hash password if present
        if (data.password) {
            data[ this.passwordField ] = await this.hashPassword(data.password);
            delete data.password; // Remove plain text password
        }

        // Validate keys against fillables
        const keys = Object.keys(data);
        for (const key of keys) {
            if (!this.insertables.includes(key) && key !== this.passwordField) {
                throw new Error(`${key} has to be an insertable column`);
            }
        }

        return await sql`INSERT INTO ${sql(this.table_name)} ${sql(data, ...keys)} RETURNING id`;
    }



    /**
     * Update password method with secure hashing
     */
    public async updatePassword(userId: number, newPassword: string, sql_obj=null) {
        const sql = this.external_sql( sql_obj );

        const passwordHash = await this.hashPassword(newPassword);
        
        return await sql`
            UPDATE ${sql(this.table_name)} 
            SET ${sql({ [this.passwordField]: passwordHash })} 
            WHERE id = ${userId} 
            RETURNING id
        `;
    }



    /**
     *   Verify password against stored hash (limited auth applications)
     */
    public async verifyPassword(user_identifier: string, plainTextPassword: string, sql_obj=null): Promise<boolean> {
        let sql = this.external_sql( sql_obj );

        const [user] = await sql`
            SELECT ${sql(this.passwordField)} 
            FROM ${sql(this.table_name)} 
            WHERE ${sql(this.identify_user_by)} = ${user_identifier}
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
    public async idAfterAuth(user_identifier: string, plainTextPassword: string, sql_obj=null): Promise<number|undefined> {
        const sql = this.external_sql( sql_obj );

        const [user] = await sql`
            SELECT ${sql(this.passwordField, "id")}
            FROM ${sql(this.table_name)} 
            WHERE ${sql(this.identify_user_by)} = ${user_identifier}
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
    public async fetchAfterAuth(user_identifier: string, plainTextPassword: string , columns:string[], sql_obj=null ): Promise<Record<string,any>|undefined> {
        const sql = this.external_sql( sql_obj );

        for ( const column of columns ){
            if ( ! this.selectables.includes(column) ) throw new ReferenceError("access to non-visible non-authorized columns is restricted")
        }
        
        const [user] = await sql`
            SELECT ${sql(this.passwordField, ...columns)}
            FROM ${sql(this.table_name)} 
            WHERE ${sql(this.identify_user_by)} = ${user_identifier}
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

