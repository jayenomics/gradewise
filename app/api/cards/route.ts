import { env } from "cloudflare:workers";

const schemaSql = `CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  year INTEGER,
  raw_value REAL NOT NULL,
  comp_value REAL NOT NULL,
  image_key TEXT,
  created_at INTEGER NOT NULL
)`;

async function ready() {
  await env.DB.prepare(schemaSql).run();
}

export async function GET() {
  await ready();
  const result = await env.DB.prepare("SELECT id, name, type, year, raw_value AS rawValue, comp_value AS compValue, image_key AS imageKey, created_at AS createdAt FROM cards ORDER BY comp_value DESC").all();
  return Response.json(result.results);
}

export async function POST(request: Request) {
  await ready();
  const form = await request.formData();
  const id = crypto.randomUUID();
  const file = form.get("image");
  let imageKey: string | null = null;
  if (file instanceof File && file.size) {
    imageKey = `${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    await env.IMAGES.put(imageKey, file.stream(), { httpMetadata: { contentType: file.type || "image/jpeg" } });
  }
  const name = String(form.get("name") || "Untitled card");
  const type = String(form.get("type") || "Other");
  const year = Number(form.get("year")) || null;
  const rawValue = Number(form.get("rawValue")) || 0;
  const compValue = Number(form.get("compValue")) || rawValue;
  const createdAt = Date.now();
  await env.DB.prepare("INSERT INTO cards (id, name, type, year, raw_value, comp_value, image_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(id, name, type, year, rawValue, compValue, imageKey, createdAt).run();
  return Response.json({ id, name, type, year, rawValue, compValue, imageKey, createdAt }, { status: 201 });
}
