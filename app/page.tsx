"use client";

import { useEffect, useMemo, useState } from "react";

type ConditionKey = "centering" | "corners" | "edges" | "surface";

const conditionLabels: Record<ConditionKey, string> = {
  centering: "Centering",
  corners: "Corners",
  edges: "Edges",
  surface: "Surface",
};

const gradeSteps = [6, 7, 8, 9, 10];

type CardRecord = { id:string; name:string; type:string; year:number|null; rawValue:number; compValue:number; imageKey:string|null; createdAt:number };
const demoCards: CardRecord[] = [
  { id:"demo-1", name:"Chrome Rookie Refractor", type:"Basketball", year:2003, rawValue:1800, compValue:2450, imageKey:null, createdAt:1 },
  { id:"demo-2", name:"1st Edition Holo", type:"TCG", year:1999, rawValue:760, compValue:1120, imageKey:null, createdAt:2 },
  { id:"demo-3", name:"Bowman 1st Prospect", type:"Baseball", year:2011, rawValue:340, compValue:525, imageKey:null, createdAt:3 },
];

export default function Home() {
  const [cardName, setCardName] = useState("1986 Fleer Rookie #57");
  const [rawValue, setRawValue] = useState(420);
  const [values, setValues] = useState({ 6: 390, 7: 440, 8: 590, 9: 1180, 10: 7400 });
  const [fee, setFee] = useState(75);
  const [shipping, setShipping] = useState(22);
  const [conditions, setConditions] = useState<Record<ConditionKey, number>>({
    centering: 8.8,
    corners: 9.1,
    edges: 8.4,
    surface: 8.7,
  });
  const [collection, setCollection] = useState<CardRecord[]>(demoCards);
  const [filter, setFilter] = useState("All");
  const [scan, setScan] = useState({ name:"", type:"Basketball", year:"", rawValue:"", compValue:"" });
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/cards").then((r) => r.ok ? r.json() : []).then((cards: CardRecord[]) => { if (cards.length) setCollection(cards); }).catch(() => {});
  }, []);

  const saveCard = async () => {
    if (!scan.name.trim()) return;
    setSaving(true);
    const form = new FormData();
    Object.entries(scan).forEach(([key, value]) => form.append(key, value));
    if (scanFile) form.append("image", scanFile);
    try {
      const response = await fetch("/api/cards", { method:"POST", body:form });
      if (!response.ok) throw new Error("save failed");
      const card = await response.json();
      setCollection((current) => [card, ...current.filter((item) => !item.id.startsWith("demo-"))]);
      setScan({ name:"", type:"Basketball", year:"", rawValue:"", compValue:"" }); setScanFile(null); setPreview("");
    } catch {
      const card: CardRecord = { id:crypto.randomUUID(), name:scan.name, type:scan.type, year:Number(scan.year)||null, rawValue:Number(scan.rawValue)||0, compValue:Number(scan.compValue)||Number(scan.rawValue)||0, imageKey:null, createdAt:Date.now() };
      setCollection((current) => [card, ...current]);
    } finally { setSaving(false); }
  };

  const totalValue = collection.reduce((sum, card) => sum + card.compValue, 0);
  const shownCards = filter === "All" ? collection : collection.filter((card) => card.type === filter);
  const types = ["All", ...Array.from(new Set(collection.map((card) => card.type)))];

  const result = useMemo(() => {
    const weights = { centering: 0.22, corners: 0.3, edges: 0.22, surface: 0.26 };
    const weighted = (Object.keys(conditions) as ConditionKey[]).reduce(
      (sum, key) => sum + conditions[key] * weights[key],
      0,
    );
    const weakest = Math.min(...Object.values(conditions));
    const likely = Math.max(6, Math.min(10, Math.round(weighted - Math.max(0, 8.4 - weakest) * 0.45)));
    const confidence = Math.round(66 + Math.min(22, Math.abs(weighted - Math.round(weighted)) * 38));
    const gradedValue = values[likely as keyof typeof values] ?? values[8];
    const cost = rawValue + fee + shipping;
    const profit = gradedValue - cost;
    const roi = Math.round((profit / cost) * 100);
    const worthIt = profit > 80 && roi > 15;
    return { weighted, likely, confidence, gradedValue, cost, profit, roi, worthIt, weakest };
  }, [conditions, fee, rawValue, shipping, values]);

  const updateCondition = (key: ConditionKey, value: number) => {
    setConditions((current) => ({ ...current, [key]: value }));
  };

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="GradeWise home">
          <span className="brandMark">GW</span>
          <span>GRADEWISE</span>
        </a>
        <span className="edition"><i /> Portfolio intelligence</span>
        <a className="textLink" href="#method">How it works <span>+</span></a>
      </header>

      <section className="hero" id="top">
        <div className="eyebrow"><span>LIVE</span> CARD PORTFOLIO + GRADING INTELLIGENCE</div>
        <h1>Grade smarter.<br /><em>Collect better.</em></h1>
        <p>One command center for your collection. Track value, estimate grades, and know exactly which cards are worth the submission.</p>
        <div className="heroRule"><span>01 / Estimate</span><span>02 / Decide</span><span>03 / Track</span></div>
      </section>

      <section className="workspace" aria-label="Card grading calculator">
        <div className="formPanel">
          <div className="sectionHead">
            <span className="sectionNo">01</span>
            <div><h2>Price the play</h2><p>Use recent sold comps, not asking prices.</p></div>
          </div>

          <label className="field wide">
            <span>Card / Set</span>
            <input value={cardName} onChange={(e) => setCardName(e.target.value)} />
          </label>

          <div className="twoCol">
            <label className="field"><span>Raw value</span><div className="money"><b>$</b><input type="number" value={rawValue} onChange={(e) => setRawValue(+e.target.value)} /></div></label>
            <label className="field"><span>Grading fee</span><div className="money"><b>$</b><input type="number" value={fee} onChange={(e) => setFee(+e.target.value)} /></div></label>
          </div>

          <label className="field compact"><span>Round-trip shipping + insurance</span><div className="money"><b>$</b><input type="number" value={shipping} onChange={(e) => setShipping(+e.target.value)} /></div></label>

          <div className="comps">
            <div className="miniHead"><span>Value by grade</span><small>editable comps</small></div>
            <div className="gradeRow">
              {gradeSteps.map((grade) => (
                <label key={grade}><span>{grade}</span><div><b>$</b><input aria-label={`Value at grade ${grade}`} type="number" value={values[grade as keyof typeof values]} onChange={(e) => setValues((v) => ({ ...v, [grade]: +e.target.value }))} /></div></label>
              ))}
            </div>
          </div>

          <div className="sectionHead conditionHead">
            <span className="sectionNo">02</span>
            <div><h2>Call the condition</h2><p>Be strict. The grader will be.</p></div>
          </div>

          <div className="sliders">
            {(Object.keys(conditions) as ConditionKey[]).map((key) => (
              <label className="slider" key={key}>
                <span>{conditionLabels[key]}</span>
                <input type="range" min="5" max="10" step="0.1" value={conditions[key]} onChange={(e) => updateCondition(key, +e.target.value)} />
                <output>{conditions[key].toFixed(1)}</output>
              </label>
            ))}
          </div>
        </div>

        <aside className="resultPanel" aria-live="polite">
          <div className="resultKicker"><i /> GRADEWISE ESTIMATE / LIVE</div>
          <div className="cardLabel"><span>{cardName || "Untitled card"}</span><small>Based on your inputs</small></div>

          <div className="gradeDisplay">
            <div className="gradeCircle"><small>LIKELY</small><strong>{result.likely}</strong><span>/ 10</span></div>
            <div className="confidence"><span>{result.confidence}% confidence</span><div><i style={{ width: `${result.confidence}%` }} /></div></div>
          </div>

          <div className={`verdict ${result.worthIt ? "go" : "hold"}`}>
            <span>{result.worthIt ? "SEND IT" : "HOLD RAW"}</span>
            <strong>{result.worthIt ? "Worth a shot." : "The margin is too thin."}</strong>
            <p>{result.worthIt ? "Your estimated grade clears the cost and return threshold." : "Improve the grade odds or wait for a better value spread."}</p>
          </div>

          <div className="ledger">
            <div><span>Estimated slab value</span><b>${result.gradedValue.toLocaleString()}</b></div>
            <div><span>All-in basis</span><b>- ${result.cost.toLocaleString()}</b></div>
            <div className="ledgerTotal"><span>Estimated upside</span><b>{result.profit >= 0 ? "+" : "-"} ${Math.abs(result.profit).toLocaleString()}</b></div>
            <div><span>Projected ROI</span><b className={result.roi > 0 ? "positive" : "negative"}>{result.roi}%</b></div>
          </div>

          <div className="watchout"><b>WATCHOUT</b><p>Your lowest subgrade is <strong>{result.weakest.toFixed(1)}</strong>. One hidden flaw can move the result down a full grade.</p></div>
        </aside>
      </section>

      <section className="vault" id="collection">
        <div className="vaultIntro">
          <div className="eyebrow"><span>THE VAULT</span> / LIVE COLLECTION</div>
          <h2>Your cards.<br /><em>One market view.</em></h2>
          <p>Scan a card, save the latest comp, and keep your collection organized by category.</p>
        </div>

        <div className="portfolioStrip">
          <div><span>Collection value</span><strong>${totalValue.toLocaleString()}</strong></div>
          <div><span>Cards tracked</span><strong>{collection.length}</strong></div>
          <div><span>Top card</span><strong>${Math.max(...collection.map((card) => card.compValue), 0).toLocaleString()}</strong></div>
        </div>

        <div className="collectionGrid">
          <div className="scanCard">
            <div className="sectionHead"><span className="sectionNo">+</span><div><h2>Scan a card</h2><p>Front photo works best in even light.</p></div></div>
            <label className={`dropzone ${preview ? "hasImage" : ""}`} style={preview ? { backgroundImage:`url(${preview})` } : undefined}>
              <input type="file" accept="image/*" capture="environment" onChange={(e) => { const file=e.target.files?.[0]||null; setScanFile(file); if(file) setPreview(URL.createObjectURL(file)); }} />
              {!preview && <><b>+</b><span>Take photo or upload</span><small>JPG, PNG, HEIC</small></>}
            </label>
            <div className="scanFields">
              <label><span>Card name</span><input placeholder="Player / set / card no." value={scan.name} onChange={(e)=>setScan({...scan,name:e.target.value})} /></label>
              <div><label><span>Type</span><select value={scan.type} onChange={(e)=>setScan({...scan,type:e.target.value})}><option>Basketball</option><option>Baseball</option><option>Football</option><option>Hockey</option><option>Soccer</option><option>TCG</option><option>Other</option></select></label><label><span>Year</span><input type="number" placeholder="2024" value={scan.year} onChange={(e)=>setScan({...scan,year:e.target.value})} /></label></div>
              <div><label><span>Raw value</span><input type="number" placeholder="$0" value={scan.rawValue} onChange={(e)=>setScan({...scan,rawValue:e.target.value})} /></label><label><span>Latest comp</span><input type="number" placeholder="$0" value={scan.compValue} onChange={(e)=>setScan({...scan,compValue:e.target.value})} /></label></div>
            </div>
            <button className="saveButton" onClick={saveCard} disabled={!scan.name.trim()||saving}>{saving?"Saving...":"Add to collection"}</button>
            <p className="scanNote">Photo recognition and live marketplace comp matching can be connected as the next data service.</p>
          </div>

          <div className="library">
            <div className="libraryHead"><div><span>Digital library</span><h3>Most valuable first</h3></div><div className="filters">{types.map((type)=><button className={filter===type?"active":""} key={type} onClick={()=>setFilter(type)}>{type}</button>)}</div></div>
            <div className="cardList">
              {shownCards.sort((a,b)=>b.compValue-a.compValue).map((card,index)=><article key={card.id} className="collectionCard">
                <div className="rank">{String(index+1).padStart(2,"0")}</div>
                <div className="thumb">{card.imageKey?<img src={`/api/cards/image/${encodeURIComponent(card.imageKey)}`} alt=""/>:<span>{card.type.slice(0,2).toUpperCase()}</span>}</div>
                <div className="cardMeta"><small>{card.year || "YEAR N/A"} / {card.type}</small><h4>{card.name}</h4><button onClick={()=>{setCardName(card.name);setRawValue(card.rawValue);document.getElementById("top")?.scrollIntoView()}}>Run grade check +</button></div>
                <div className="cardValue"><small>Latest comp</small><strong>${card.compValue.toLocaleString()}</strong><span>Raw ${card.rawValue.toLocaleString()}</span></div>
              </article>)}
            </div>
          </div>
        </div>
      </section>

      <section className="method" id="method">
        <div><span className="sectionNo">03</span><h2>A second opinion,<br />not a guarantee.</h2></div>
        <div className="methodGrid">
          <article><b>01</b><h3>Price honestly</h3><p>Enter actual sold prices at each grade and include every submission cost.</p></article>
          <article><b>02</b><h3>Inspect ruthlessly</h3><p>Rate centering, corners, edges and surface under bright, angled light.</p></article>
          <article><b>03</b><h3>Follow the spread</h3><p>GradeWise weighs the likely outcome against your total basis and downside.</p></article>
        </div>
      </section>

      <footer><span>GRADEWISE / EST. 2026</span><p>Estimates are educational, not an affiliation with or guarantee from any grading company.</p></footer>
    </main>
  );
}
