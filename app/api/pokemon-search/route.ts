import { searchPokemon } from "@/lib/pokemon";

export const runtime = "nodejs";

export async function POST(request:Request) {
  const authorization=request.headers.get("authorization");
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!authorization?.startsWith("Bearer ")||!url||!key) return Response.json({error:"Sign in to search cards."},{status:401});
  const user=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:authorization}});
  if(!user.ok) return Response.json({error:"Your session expired. Sign in again."},{status:401});
  const body=await request.json();
  const candidates=await searchPokemon(String(body.name||""),String(body.cardNumber||""));
  return Response.json({candidates});
}
