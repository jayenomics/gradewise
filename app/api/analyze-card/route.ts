import { searchPokemon } from "@/lib/pokemon";

export const runtime = "nodejs";

const allowedTypes = ["Basketball", "Baseball", "Football", "Hockey", "Soccer", "TCG", "Other"];

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !supabaseKey) return Response.json({ error: "Sign in to scan a card." }, { status: 401 });
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey:supabaseKey, Authorization:authorization } });
  if (!userResponse.ok) return Response.json({ error: "Your session expired. Sign in again to scan." }, { status: 401 });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return Response.json({ error: "Card recognition is not configured yet." }, { status: 503 });
  const form = await request.formData();
  const image = form.get("image");
  if (!(image instanceof File) || !image.size) return Response.json({ error: "Add a card photo first." }, { status: 400 });
  if (!image.type.startsWith("image/")) return Response.json({ error: "Please upload a photo of the card." }, { status: 400 });
  if (image.size > 12 * 1024 * 1024) return Response.json({ error: "Please use an image smaller than 12 MB." }, { status: 413 });

  const dataUrl = `data:${image.type || "image/jpeg"};base64,${Buffer.from(await image.arrayBuffer()).toString("base64")}`;
  const prompt = `Identify the collectible card in this photo. Inspect visible text, logos, card number, set marks, copyright year, player or character, parallel treatment, and sport/game. Do not invent missing details. Return only JSON with these keys: name (only the character name for Pokemon; otherwise a search-ready title), isPokemon (boolean), type (exactly one of Basketball, Baseball, Football, Hockey, Soccer, TCG, Other), year (number or null), manufacturer (string), setName (string), cardNumber (string), variant (string), confidence (integer 0-100), conditionNotes (array of short visible concerns), identificationNotes (short explanation). Do not estimate a price.`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.6-luna", input: [{ role:"user", content:[{ type:"input_text", text:prompt }, { type:"input_image", image_url:dataUrl, detail:"high" }] }], max_output_tokens:900 }),
  });
  if (!response.ok) {
    console.error("Card recognition failed", response.status, await response.text());
    return Response.json({ error: "The card could not be analyzed. Try a clearer, straight-on photo." }, { status: 502 });
  }
  const payload = await response.json();
  const output = payload.output_text || payload.output?.flatMap((item:{content?:{text?:string}[]})=>item.content||[]).map((item:{text?:string})=>item.text||"").join("") || "";
  try {
    const match = output.match(/\{[\s\S]*\}/); if (!match) throw new Error();
    const result = JSON.parse(match[0]);
    result.type = allowedTypes.includes(result.type) ? result.type : "Other";
    result.confidence = Math.max(0, Math.min(100, Number(result.confidence)||0));
    result.year = Number(result.year)||null;
    result.pokemonCandidates = result.isPokemon ? await searchPokemon(String(result.name||""), String(result.cardNumber||"")) : [];
    return Response.json(result);
  } catch { return Response.json({ error:"Recognition returned an incomplete result. Please try again." }, { status:502 }); }
}
