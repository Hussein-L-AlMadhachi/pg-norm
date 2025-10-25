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
    - [Ledger Tables (PG\_Ledger)](#ledger-tables-pg_ledger)
  - [API Reference](#api-reference)
    - [PG\_App](#pg_app)
    - [PG\_Table Properties](#pg_table-properties)
    - [PG\_Table Methods](#pg_table-methods)
    - [PG\_AuthTable (extends PG\_Table)](#pg_authtable-extends-pg_table)
    - [PG\_Ledger (immutable)](#pg_ledger-immutable)
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
    //      app,   table_name,        visible columns
    super( pg_app, 'products', ['name', 'price', 'category']);
    
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
      SELECT ${this.sql(this.visibles)}
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
await products.listAll();           // List all rows (only visible columns)
await products.fetch(1);            // Fetch row with id 1 (only visible columns)
await products.list(50, 2);         // List second 50 rows (respects max_rows_fetched)
await products.update(1, {...});    // Update row with id 1 (only visible columns)
await products.insert({...});       // Insert new row (only visible columns)
await products.delete(1);           // Delete row with id 1
```

### Authentication Tables (PG_AuthTable)

Handles password hashing (bcrypt), verification, and secure updates.

```ts
import { PG_AuthTable } from "pg-norm";

class UsersTable extends PG_AuthTable {
  constructor(pg_app: PG_App) {
    //      app   ,  table_name ,     visible columns     , identify_user_by
    super( pg_app ,   'users'   , ['name', 'email', 'age'],     "email"      );
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
```

**Important Notes:**

1. You must create a `password_hash` column and your identifying field (e.g., `email`)
2. Use the `password` field when inserting (not `password_hash`)
3. `update()` cannot update passwords (use `updatePassword()` instead)

### Ledger Tables (PG_Ledger)

Immutable tables—ideal for audit logs, financial records, or event sourcing.

```ts
import { PG_Ledger } from "pg-norm";

class TransactionLedger extends PG_Ledger {
  constructor(pg_app: PG_App) {
    super(pg_app, 'transactions', ['from_account', 'to_account', 'amount', 'type']);
  }

  // Note: method name is createTable() for ledgers
  public async createTable() {
    await this.sql`
      CREATE TABLE transactions (
        id SERIAL PRIMARY KEY,
        from_account INTEGER NOT NULL,
        to_account INTEGER NOT NULL,
        amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
        type VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
  }
}

const transactions = new TransactionLedger(app);
app.register(transactions);
```

**Allowed Operations:**

```ts
// ✅ Allowed
await transactions.insert({ from_account: 1, to_account: 2, amount: 100, type: 'transfer' });
await transactions.listAll();
await transactions.list(50, 2);
await transactions.fetch(1);

// ❌ Throws error: ledgers are immutable
// await transactions.update(1, { amount: 200 });
// await transactions.delete(1);
```

> PG-NORM enforces immutability both in code **and** via PostgreSQL Row-Level Security (RLS).

## API Reference

### PG_App

- `new PG_App(options)` – Initialize connection (uses `postgres.js` options)
- `.register(table)` – Register a table instance
- `.createTables()` – Create all registered tables
- `.alterTables()` – Alter all registered tables

### PG_Table Properties

- `.table_name` – Stores table name
- `.visibles` – Stores columns visible to CRUD operations
- `.max_rows_fetched` – Maximum rows `list()` can fetch (default: 50)

### PG_Table Methods

- `.insert(data)` – Insert record (only visible columns)
- `.fetch(id)` – Get by ID (only visible columns)
- `.listAll()` – Get all rows (only visible columns)
- `.list(page_size, page_number)` – Get paginated results
- `.update(id, data)` – Update record (only visible columns)
- `.delete(id)` – Delete record

### PG_AuthTable (extends PG_Table)

- `.verifyPassword(identifier, plainText)` → `Promise<boolean>`
- `.updatePassword(id, newPassword)` – Securely rehash password

### PG_Ledger (immutable)

- Only `.insert()`, `.fetch()`, `.listAll()`, and `.list()` are allowed
- Enforced at the database level via RLS
- Updates/deletes throw runtime errors

## Security Features

- 🔒 **SQL Injection Protection**: All queries use parameterized `sql`` templates
- 🔑 **Password Security**: Automatic bcrypt hashing with configurable rounds
- 🛡️ **Immutable Ledgers**: RLS policies prevent tampering—even via direct SQL
- 🧪 **Field Whitelisting**: Only declared `visibles` columns can be selected/inserted/updated

## Best Practices

1. **Extend, don't replace**: Add domain-specific query methods to your table classes
2. **Use ledgers for history**: Financial data, logs, or any append-only use case
3. **Validate early**: Rely on PostgreSQL constraints + visible field filtering
4. **Write raw SQL**: Take full advantage of CTEs, window functions, JSON, etc.
5. **Type everything**: Use TypeScript interfaces for query results when needed

## Example: E-commerce Application

```ts
class OrdersTable extends PG_Table {
  constructor(pg_app: PG_App) {
    super(pg_app, 'orders', ['user_id', 'total', 'status']);
  }

  async create() {
    await this.sql`
      CREATE TABLE orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        total DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;
  }

  async getUserOrders(userId: number) {
    return this.sql`
      SELECT o.*,
             json_agg(
               json_build_object('product_id', oi.product_id, 'quantity', oi.quantity)
             ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.user_id = ${userId}
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
  }
}
```

## License

MIT © Hussein Layth Al-Madhachi
