import { defineConfig } from "drizzle-kit";
import path from "path";

// Used only for `drizzle-kit export` (schema.mysql.sql generation) and for
// `drizzle-kit push` against a MySQL DATABASE_URL. Export never connects, so a
// placeholder URL is fine when the env var is not MySQL.
const url = process.env.DATABASE_URL?.startsWith("mysql")
  ? process.env.DATABASE_URL
  : "mysql://user:password@localhost:3306/flowdeck";

export default defineConfig({
  schema: path.join(__dirname, "./src/schema-mysql/index.ts"),
  dialect: "mysql",
  dbCredentials: { url },
});
