import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const cards = sqliteTable("cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  year: integer("year"),
  rawValue: real("raw_value").notNull(),
  compValue: real("comp_value").notNull(),
  imageKey: text("image_key"),
  createdAt: integer("created_at").notNull(),
});
