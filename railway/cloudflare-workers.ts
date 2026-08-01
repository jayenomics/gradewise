type CardRow = {
  id: string; name: string; type: string; year: number | null;
  rawValue: number; compValue: number; imageKey: string | null; createdAt: number;
};

type StoredImage = { bytes: Uint8Array; contentType: string };

const state = globalThis as typeof globalThis & {
  __gradewiseCards?: CardRow[];
  __gradewiseImages?: Map<string, StoredImage>;
};

state.__gradewiseCards ??= [];
state.__gradewiseImages ??= new Map();

function statement(sql: string, values: unknown[] = []) {
  return {
    bind: (...next: unknown[]) => statement(sql, next),
    async run() {
      if (sql.startsWith("INSERT INTO cards")) {
        const [id, name, type, year, rawValue, compValue, imageKey, createdAt] = values;
        state.__gradewiseCards!.push({
          id: String(id), name: String(name), type: String(type),
          year: year == null ? null : Number(year), rawValue: Number(rawValue),
          compValue: Number(compValue), imageKey: imageKey == null ? null : String(imageKey),
          createdAt: Number(createdAt),
        });
      }
      return { success: true };
    },
    async all() {
      return { results: [...state.__gradewiseCards!].sort((a, b) => b.compValue - a.compValue) };
    },
  };
}

export const env = {
  DB: { prepare: statement },
  IMAGES: {
    async put(key: string, body: ReadableStream, options?: { httpMetadata?: { contentType?: string } }) {
      const bytes = new Uint8Array(await new Response(body).arrayBuffer());
      state.__gradewiseImages!.set(key, { bytes, contentType: options?.httpMetadata?.contentType || "image/jpeg" });
    },
    async get(key: string) {
      const found = state.__gradewiseImages!.get(key);
      if (!found) return null;
      return {
        body: found.bytes,
        httpEtag: `\"${key}\"`,
        writeHttpMetadata(headers: Headers) { headers.set("content-type", found.contentType); },
      };
    },
  },
};
