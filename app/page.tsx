"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ConditionKey = "centering" | "corners" | "edges" | "surface";

const conditionLabels: Record<ConditionKey, string> = {
  centering: "Centering",
  corners: "Corners",
  edges: "Edges",
  surface: "Surface",
};

const gradeSteps = [6, 7, 8, 9, 10];

type CardRecord = { id:string; name:string; type:string; year:number|null; rawValue:number; compValue:number; imageKey:string|null; imageUrl?:string; createdAt:number };
type Account = { id:string; name:string; email:string };
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
  const [account, setAccount] = useState<Account | null>(null);
  const [accountReady, setAccountReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signup"|"login">("signup");
  const [auth, setAuth] = useState({ name:"", email:"", password:"" });
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");

  useEffect(() => {
    const connect = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) await loadAccount(data.session.user.id, data.session.user.email || "", data.session.user.user_metadata?.name || "Collector");
      else { setCollection(demoCards); setAccountReady(true); }
    };
    connect();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) { setAccount(null); setCollection(demoCards); setAccountReady(true); }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const loadAccount = async (id:string, email:string, name:string) => {
    setAccount({ id, email, name });
    const { data } = await supabase.from("cards").select("*").order("comp_value", { ascending:false });
    const rows = await Promise.all((data || []).map(async (row) => {
      let imageUrl: string | undefined;
      if (row.image_path) imageUrl = (await supabase.storage.from("card-images").createSignedUrl(row.image_path, 3600)).data?.signedUrl;
      return { id:row.id, name:row.name, type:row.type, year:row.year, rawValue:Number(row.raw_value), compValue:Number(row.comp_value), imageKey:row.image_path, imageUrl, createdAt:new Date(row.created_at).getTime() } as CardRecord;
    }));
    setCollection(rows); setAccountReady(true);
  };

  const imageToDataUrl = (file: File) => new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .78));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });

  const submitAuth = async () => {
    setAuthError("");
    setAuthNotice("");
    const email = auth.email.trim().toLowerCase();
    if (!email || auth.password.length < 6 || (authMode === "signup" && !auth.name.trim())) { setAuthError("Enter your name, email, and a password with 6+ characters."); return; }
    if (authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password:auth.password, options:{ data:{ name:auth.name.trim() }, emailRedirectTo:window.location.origin } });
      if (error) { setAuthError(error.message); return; }
      if (!data.session) { setAuthNotice("Check your email to confirm the account, then sign in."); return; }
      await loadAccount(data.user!.id, email, auth.name.trim());
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password:auth.password });
      if (error) { setAuthError(error.message); return; }
      await loadAccount(data.user.id, email, data.user.user_metadata?.name || "Collector");
    }
    setAuthOpen(false); setAuth({name:"",email:"",password:""});
  };

  const saveCard = async () => {
    if (!scan.name.trim()) return;
    if (!account) { setAuthMode("signup"); setAuthOpen(true); return; }
    setSaving(true);
    try {
      const imageUrl = scanFile ? await imageToDataUrl(scanFile) : undefined;
      let imagePath: string | null = null;
      if (scanFile) {
        imagePath = `${account.id}/${crypto.randomUUID()}-${scanFile.name.replace(/[^a-zA-Z0-9._-]/g,"-")}`;
        const uploaded = await supabase.storage.from("card-images").upload(imagePath, scanFile, { contentType:scanFile.type, upsert:false });
        if (uploaded.error) throw uploaded.error;
      }
      const values = { user_id:account.id, name:scan.name, type:scan.type, year:Number(scan.year)||null, raw_value:Number(scan.rawValue)||0, comp_value:Number(scan.compValue)||Number(scan.rawValue)||0, image_path:imagePath };
      const saved = await supabase.from("cards").insert(values).select().single();
      if (saved.error) throw saved.error;
      const card: CardRecord = { id:saved.data.id, name:scan.name, type:scan.type, year:values.year, rawValue:values.raw_value, compValue:values.comp_value, imageKey:imagePath, imageUrl, createdAt:Date.now() };
      setCollection((current) => [card, ...current.filter((item) => !item.id.startsWith("demo-"))]);
      setScan({ name:"", type:"Basketball", year:"", rawValue:"", compValue:"" }); setScanFile(null); setPreview("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Could not save this card. Please try again.");
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
          <img className="brandLogo" src="/gradewise-logo.png" alt="GradeWise" />
        </a>
        <span className="edition"><i /> Portfolio intelligence</span>
        {account ? <button className="accountButton" onClick={()=>supabase.auth.signOut()}><span>{account.name.slice(0,1).toUpperCase()}</span>{account.name} · Sign out</button> : <button className="accountButton" onClick={()=>setAuthOpen(true)}>Create account <b>+</b></button>}
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
                <div className="thumb">{card.imageUrl?<img src={card.imageUrl} alt=""/>:card.imageKey?<img src={`/api/cards/image/${encodeURIComponent(card.imageKey)}`} alt=""/>:<span>{card.type.slice(0,2).toUpperCase()}</span>}</div>
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

      {authOpen && <div className="authBackdrop" onMouseDown={(e)=>{if(e.target===e.currentTarget)setAuthOpen(false)}}>
        <section className="authModal" role="dialog" aria-modal="true" aria-label="GradeWise account">
          <button className="authClose" onClick={()=>setAuthOpen(false)}>×</button>
          <img src="/gradewise-logo.png" alt="GradeWise" />
          <div className="authTabs"><button className={authMode==="signup"?"active":""} onClick={()=>{setAuthMode("signup");setAuthError("")}}>Create account</button><button className={authMode==="login"?"active":""} onClick={()=>{setAuthMode("login");setAuthError("")}}>Sign in</button></div>
          <h2>{authMode==="signup"?"Build your vault.":"Welcome back."}</h2>
          <p>Your cards and scans stay attached to this account on this device.</p>
          {authMode==="signup" && <label><span>Name</span><input autoFocus value={auth.name} onChange={e=>setAuth({...auth,name:e.target.value})} /></label>}
          <label><span>Email</span><input type="email" value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})} /></label>
          <label><span>Password</span><input type="password" value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})} onKeyDown={e=>{if(e.key==="Enter")submitAuth()}} /></label>
          {authError && <div className="authError">{authError}</div>}
          {authNotice && <div className="authNotice">{authNotice}</div>}
          <button className="authSubmit" onClick={submitAuth}>{authMode==="signup"?"Create my account":"Sign in"}</button>
          <small>Testing mode · stored locally in this browser</small>
        </section>
      </div>}
    </main>
  );
}
