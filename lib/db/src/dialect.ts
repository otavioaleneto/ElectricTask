export type DbDialect = "postgres" | "mysql";

const url = process.env.DATABASE_URL ?? "";

export const dbDialect: DbDialect = /^(mysql2?|mariadb):\/\//i.test(url)
  ? "mysql"
  : "postgres";

export const isMysql = dbDialect === "mysql";
