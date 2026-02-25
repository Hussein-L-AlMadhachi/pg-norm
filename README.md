# PG-NORM (PostgreSQL NoORM)

> 💡 **Tip**: Install the [`es6-string-html`](https://marketplace.visualstudio.com/items?itemName=Tobermory.es6-string-html) extension in VS Code/VSCodium for syntax highlighting inside `sql`` tagged templates.

**PG-NORM** is an SQL-first database layer for PostgreSQL that embraces raw SQL while offering sensible abstractions for common operations. Built on top of [`postgres.js`](https://github.com/porsager/postgres) with full TypeScript support.

Think of it as a **NoORM** (Not an ORM)—a lightweight toolkit that gives you model-like classes with basic CRUD operations so you can focus on writing expressive, performant, and maintainable SQL.

## Table of Contents

- [PG-NORM (PostgreSQL NoORM)](#pg-norm-postgresql-noorm)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
    - [Configure your database (`src/db.ts`)](#configure-your-database-srcdbts)
  - [Core Concepts](#core-concepts)
    - [Basic Tables (PG\_Table)](#basic-tables-pg_table)
    - [Authentication Tables (PG\_AuthTable)](#authentication-tables-pg_authtable)
    - [Soft Delete Tables (PG\_SoftDeleteTable)](#soft-delete-tables-pg_softtable)
    - [Nesting queries in transactions](#nesting-queries-in-transactions)
  - [API Reference](#api-reference)
    - [PG\_App](#pg_app)
    - [PG\_Table Properties](#pg_table-properties)
    - [PG\_Table Methods](#pg_table-methods)
    - [PG\_AuthTable (extends PG\_Table)](#pg_authtable-extends-pg_table)
  - [Security Features](#security-features)
  - [Best Practices](#best-practices)
  - [Example: E-commerce Application](#example-e-commerce-application)
  - [License](#license)

## Installation

```bash
npm create pg-norm@latest your-project-name
cd your-project-name
npm install
```

> The `create-pg-norm` starter includes a ready-to-use project scaffold.

## Quick Start

After initialization, your project structure looks like this:

```txt
.
├── cli
│   ├── alter.ts
│   └── create.ts
├── package.json
├── src
│   ├── db.ts        # Database connection
│   └── models.ts    # Table definitions
└── tsconfig.json
```

### Configure your database (`src/db.ts`)

```ts
import { PG_App } from 'pg-norm';

export const app = new PG_App({
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  username: 'user',
  password: 'pass',
  // ... other postgres.js options
  connection: {
    application_name: 'my-app',
    // See: https://www.postgresql.org/docs/current/runtime-config-client.html
  }
});
```

## Core Concepts

### Basic Tables (PG_Table)

For standard CRUD operations with full SQL control.

```ts
import { PG_Table, PG_App } from "pg-norm";
import { app } from "./db.js";

class ProductsTable extends PG_Table {
  constructor(pg_app: PG_App) {
    //      app,   table_name,
    super( pg_app, 'products',
      {
        select:['name', 'price', 'category'],
        insert:['name', 'price', 'category'],
        update:['name', 'price', 'category']
      }
    );
    
    // Change the maximum data this.list() can fetch (default: 50)
    // this.max_rows_fetched = 50;
  }

  public async create() {
    // Important: always create a column named 'id'
    await this.sql`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(50),
        in_stock BOOLEAN DEFAULT true
      )
    `;
  }

  public async alter() {
    // Use this method to update your schema
    // Remove this method if you have no schema changes
  }

  // Write custom query methods
  async findByCategory(category: string) {
    return this.sql`
      SELECT ${this.sql(this.selectables)}
      FROM ${this.sql(this.table_name)}
      WHERE category = ${category}
    `;
  }
}

// Register table for CLI commands support
export const products = new ProductsTable(app);
app.register(products);
```

**Available CRUD Methods:**

```ts
// Basic CRUD operations (you can override these)
await products.listAll();                           // List all rows (only visible columns)
await products.fetch(1);                           // Fetch row with id 1 (only visible columns)
await products.list(50, 2);                        // List 50 rows starting after id 2 (respects max_rows_fetched)
await products.update(1, {...});                   // Update row with id 1 (only visible columns)
await products.insert({...});                      // Insert new row (only visible columns)
await products.delete(1);                          // Delete row with id 1

// All methods support optional transaction parameter
await products.listAll(tx_sql);                    // Execute within transaction
await products.fetch(1, tx_sql);
await products.list(50, 2, tx_sql);
await products.update(1, {...}, tx_sql);
await products.insert({...}, tx_sql);
await products.delete(1, tx_sql);
```

### Authentication Tables (PG_AuthTable)

Handles password hashing (bcrypt), verification, and secure updates.

```ts
import { PG_AuthTable } from "pg-norm";

class UsersTable extends PG_AuthTable {
  constructor(pg_app: PG_App) {
    //      app   ,  table_name , 
    super( pg_app ,   'users'   , 
      {
        select: ['name', 'email', 'age'],   //permissions you set for each column
        update: ['name', 'email', 'age'], 
        insert: ['name', 'email', 'age']
      },
      "email" // how do you identify your user for login
    );
  }

  async create() {
    // Important: create 'id', 'password_hash', and your "identify_user_by" field
    await this.sql`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        age INTEGER,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
  }
}

const users = new UsersTable(app);
app.register(users);
```

**Authentication Methods:**

```ts
// Insert with password hashing
await users.insert({ 
  name: 'John', 
  email: 'john@example.com', 
  age: 25, 
  password: 'plaintext_password'  // Will be hashed automatically
});

// Password management
await users.updatePassword(1, "new_password");
const isValid = await users.verifyPassword("john@example.com", "password_to_check");

const user_id = await users.idAfterAuth("john@example.com", "password_to_check");
if ( user_id === undefined ){
  throw new Error("Wrong username or password")
}

const user = await users.fetchAfterAuth("john@example.com", "password_to_check" , ["id","name","email"] );
if ( user === undefined ){
  throw new Error("Wrong username or password")
}
// now you can use user.id, user.name ,user.email

```

**Important Notes:**

1. You must create a `password_hash` column and your identifying field (e.g., `email`)
2. Use the `password` field when inserting (not `password_hash`)
3. `update()` cannot update passwords (use `updatePassword()` instead)

### Soft Delete Tables (PG_SoftDeleteTable)

Implements soft delete functionality where records are marked as deleted instead of being permanently removed. This is useful for maintaining data history and allowing record restoration.

```ts
import { PG_SoftDeleteTable } from "pg-norm";

class OrdersTable extends PG_SoftDeleteTable {
  constructor(pg_app: PG_App) {
    super(pg_app, 'orders', {
      select: ['user_id', 'product_id', 'quantity', 'total_price', 'status'],
      insert: ['user_id', 'product_id', 'quantity', 'total_price', 'status'],
      update: ['quantity', 'total_price', 'status']
    });
    // Optionally customize the soft delete column (default: 'deleted_at')
    // this.softDeleteColumn = 'archived_at';
  }

  async create() {
    // Important: create a timestamp column to track soft deletes
    await this.sql`
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL DEFAULT 1,
        total_price DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        deleted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
  }

  async alter() {}
}

const orders = new OrdersTable(app);
app.register(orders);
```

**Soft Delete Methods:**

```ts
// Soft delete - marks record as deleted without removing it
await orders.delete(1);              // Sets deleted_at = NOW()

// List all active (non-deleted) records only
await orders.listAll();              // Only returns rows where deleted_at IS NULL

// Fetch active record (returns undefined if soft-deleted)
await orders.fetch(1);               // Only returns row if deleted_at IS NULL

// List paginated active records
await orders.list(50, 2);            // Paginate through non-deleted records

// List all deleted records
await orders.listAllDeleted();       // Returns all soft-deleted records

// Fetch deleted record
await orders.fetchDeleted(1);        // Returns only the deleted record

// List paginated deleted records
await orders.listDeleted(50, 2);     // Paginate through soft-deleted records

// Restore a soft-deleted record
await orders.restore(1);             // Sets deleted_at = NULL

// Permanently remove a record (hard delete)
await orders.hardDelete(1);         // Permanently removes the record from database
```

**Key Features:**

- Records are marked with a timestamp instead of being deleted
- Active record queries (listAll(), fetch(), list()) exclude soft-deleted records
- Dedicated methods for querying deleted records: listAllDeleted(), fetchDeleted(), listDeleted()
- restore() method reactivates soft-deleted records
- hardDelete() available for permanent removal when needed
- Customize the soft delete column name via this.softDeleteColumn
- All methods support optional transaction parameter for use within transactions

### Nesting queries in transactions

consider these two tables:

```ts
import { PG_Table, PG_App } from "pg-norm";
import { app } from "./db.js";

class OrdersTable extends PG_Table {
  constructor(pg_app: PG_App) {
    super(pg_app, 'orders',
      {
        select: ['user_id', 'product_id', 'quantity', 'total_price', 'status'],
        insert: ['user_id', 'product_id', 'quantity', 'total_price', 'status'],
        update: ['quantity', 'total_price', 'status']
      }
    );
  }

  public async create() {
    await this.sql`
      CREATE TABLE orders (
        id           SERIAL PRIMARY KEY,
        user_id      INTEGER NOT NULL REFERENCES users(id),
        product_id   INTEGER NOT NULL REFERENCES products(id),
        quantity     INTEGER NOT NULL DEFAULT 1,
        total_price  DECIMAL(10,2) NOT NULL,
        status       VARCHAR(50) DEFAULT 'pending',
        created_at   TIMESTAMP DEFAULT NOW()
      )
    `;
  }

  public async alter() {}
}
```

```ts
import { PG_Table, PG_App } from "pg-norm";
import { app } from "./db.js";

class ProductsTable extends PG_Table {
  constructor(pg_app: PG_App) {
    //      app,   table_name,
    super( pg_app, 'products',
      {
        select:['name', 'price', 'category','available'],
        insert:['name', 'price', 'category','available'],
        update:['name', 'price', 'category','available']
      }
    );
    
    // Change the maximum data this.list() can fetch (default: 50)
    // this.max_rows_fetched = 50;
  }

  public async create() {
    // Important: always create a column named 'id'
    await this.sql`
      CREATE TABLE products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        category VARCHAR(50),
        available INTEGER
      )
    `;
  }

  public async alter() {
    // Use this method to update your schema
    // Remove this method if you have no schema changes
  }

  async findByCategory(category: string) {
    return this.sql`
      SELECT ${this.sql(this.selectables)}
      FROM ${this.sql(this.table_name)}
      WHERE category = ${category}
    `;
  }

  public async order( product_id: number, user_id: number, quantity: number , sql_obj=null) {

    // automatically if sql_obj is passed this will pick it up
    // otherwise it will execute the query normally without any transactions
    const sql = this.external_sql( sql_obj );

    await sql.begin(async (tx_sql) => {

      // Decrement available stock
      const [product] = await tx_sql`
        UPDATE ${sql(this.table_name)}
        SET available = available - ${quantity}
        WHERE id = ${product_id}
        RETURNING price
      `;

      // Insert a matching order row inside the same transaction
      await orders.insert(
        {
          user_id,
          product_id,
          quantity,
          total_price: product.price * quantity,
          status: 'pending',
        },
        tx_sql  // pass the transaction sql object so both queries share the same transaction
      );

    });
  } 

}

```



## API Reference

### PG_App

- `new PG_App(options)` – Initialize connection (uses `postgres.js` options)
- `.register(table)` – Register a table instance
- `.createTables()` – Create all registered tables
- `.alterTables()` – Alter all registered tables

### PG_Table Properties

- `.table_name` – Stores table name
- `.selectables` – Stores columns visible to select operations
- `.updatables` – Stores columns visible to update operations
- `.insertables` – Stores columns visible to insert operations
- `.max_rows_fetched` – Maximum rows `list()` can fetch (default: 50)

### PG_Table Methods

- `.insert(data, sql_obj?)` – Insert record (only insertable columns)
- `.fetch(id, sql_obj?)` – Get by ID (only selectable columns)
- `.listAll(sql_obj?)` – Get all rows (only selectable columns)
- `.list(limit, last_id, sql_obj?)` – Get paginated results (only selectable columns)
- `.update(id, data, sql_obj?)` – Update record (only updatable columns)
- `.delete(id, sql_obj?)` – Delete record

### PG_AuthTable (extends PG_Table)

- `.verifyPassword(identifier, plainText)` → `Promise<boolean>`
- `.idAfterAuth(identifier, plainText)` → `Promise<number|undefined>`
- `.fetchAfterAuth(identifier, plainText , columns)` → `Promise<Record<string,any>|undefined>`
- `.updatePassword(id, newPassword)` – Securely rehash password

### PG_SoftDeleteTable (extends PG_Table)

- `.softDeleteColumn` – Stores the column name for soft delete timestamps (default: `'deleted_at'`)
- `.delete(id, sql_obj?)` – Soft delete (marks with timestamp)
- `.listAll(sql_obj?)` → `Promise<Record<string,any>[]>` – List active rows (excludes soft-deleted)
- `.fetch(id, sql_obj?)` → `Promise<Record<string,any>|unknown[]>` – Fetch active row (excludes soft-deleted)
- `.list(limit, last_id, sql_obj?)` → `Promise<Record<string,any>[]>` – List active rows paginated (excludes soft-deleted)
- `.listAllDeleted(sql_obj?)` → `Promise<Record<string,any>[]>` – List all soft-deleted rows
- `.fetchDeleted(id, sql_obj?)` → `Promise<Record<string,any>|unknown[]>` – Fetch soft-deleted row
- `.listDeleted(limit, last_id, sql_obj?)` → `Promise<Record<string,any>[]>` – List soft-deleted rows paginated
- `.restore(id, sql_obj?)` – Restore soft-deleted record
- `.hardDelete(id)` – Permanently delete record

## License

MIT © Hussein Layth Al-Madhachi
