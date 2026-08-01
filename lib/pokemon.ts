export type PokemonCandidate = { id:string; name:string; number:string; setName:string; series:string; releaseDate:string; rarity:string; artist:string; imageSmall:string; imageLarge:string; tcgplayerUrl:string; prices:{label:string;market:number}[]; marketPrice:number };

type ApiCard = { id:string; name:string; number:string; rarity?:string; artist?:string; set:{name:string;series:string;releaseDate:string}; images:{small:string;large:string}; tcgplayer?:{url?:string;prices?:Record<string,{market?:number}>} };

export async function searchPokemon(name:string, cardNumber=""):Promise<PokemonCandidate[]> {
  const cleanName = name.replace(/\s+#?\d+[a-z/\-]*\s*$/i, "").replace(/[^a-zA-Z0-9.' -]/g, "").trim();
  const cleanNumber = cardNumber.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleanName) return [];
  const queries = [cleanNumber ? `name:\"${cleanName}\" number:${cleanNumber}` : `name:\"${cleanName}\"`, `name:${cleanName.split(/\s+/).join("*")}*`];
  for (const query of queries) {
    const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(query)}&pageSize=12&select=id,name,number,rarity,artist,set,images,tcgplayer`, { headers:process.env.POKEMON_TCG_API_KEY?{"X-Api-Key":process.env.POKEMON_TCG_API_KEY}:{}, next:{revalidate:86400} });
    if (!response.ok) continue;
    const cards = ((await response.json()).data || []) as ApiCard[];
    if (!cards.length) continue;
    return cards.sort((a,b)=>Number(b.number===cleanNumber)-Number(a.number===cleanNumber)).slice(0,3).map((card)=>{
      const prices = Object.entries(card.tcgplayer?.prices || {}).map(([label,value])=>({label,market:Number(value.market)||0})).filter((price)=>price.market>0);
      return { id:card.id,name:card.name,number:card.number,setName:card.set.name,series:card.set.series,releaseDate:card.set.releaseDate,rarity:card.rarity||"Unknown",artist:card.artist||"Unknown",imageSmall:card.images.small,imageLarge:card.images.large,tcgplayerUrl:card.tcgplayer?.url||"",prices,marketPrice:prices.length?Math.max(...prices.map((price)=>price.market)):0 };
    });
  }
  return [];
}
