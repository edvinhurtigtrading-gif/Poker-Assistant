
window.addEventListener("error",(event)=>{
  console.error("Poker Assistant runtime error:",event.error||event.message);
  try{
    if(typeof heroIsActing==="function" && heroIsActing()){
      autoAnalysisRunning=false;
      if(typeof showAutoError==="function"){
        showAutoError("ANALYSIS ERROR",event.message||"Unexpected runtime error.");
      }
    }
  }catch(_){}
});

const POSITIONS_FROM_BTN=["BTN","SB","BB","UTG","HJ","CO"];
const NAMES=["HERO","Player 2","Player 3","Player 4","Player 5","Player 6"];
const RANKS=["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const SUITS=[{k:"s",sym:"♠",red:false},{k:"h",sym:"♥",red:true},{k:"d",sym:"♦",red:true},{k:"c",sym:"♣",red:false}];
const STORAGE_KEY="poker-assistant-v021";
let pickerTarget=null,pickerRank=null,pendingAction=null,snapshots=[];

function basePlayers(){return NAMES.map((name,seat)=>({seat,name,stack:100,streetBet:0,folded:false,allIn:false,acted:false}));}
function defaultState(){return {handNumber:1,dealerSeat:3,street:"preflop",players:basePlayers(),pot:0,currentBet:0,actorSeat:null,heroCards:[null,null],board:[null,null,null,null,null],history:[],awaitingBoard:false,awaitingHeroCards:true,handComplete:false};}
let state=loadState()||defaultState();

function loadState(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));return x&&x.players?.length===6?x:null}catch{return null}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function posForSeat(seat){return POSITIONS_FROM_BTN[(seat-state.dealerSeat+6)%6]}
function seatForPos(pos){for(let i=0;i<6;i++)if(posForSeat(i)===pos)return i;return null}
function fmt(x){return `${Math.round(x*100)/100} BB`}
function livePlayers(){return state.players.filter(p=>!p.folded)}
function actionablePlayers(){return state.players.filter(p=>!p.folded&&!p.allIn)}
function nextActionableSeat(from){for(let i=1;i<=6;i++){const s=(from+i)%6,p=state.players[s];if(!p.folded&&!p.allIn)return s}return null}
function amountToCallFor(seat){return Math.max(0,state.currentBet-state.players[seat].streetBet)}
function actorLabel(){return state.actorSeat===null?"—":`${NAMES[state.actorSeat]} · ${posForSeat(state.actorSeat)}`}
function streetName(s){return s[0].toUpperCase()+s.slice(1)}
function snapshot(){snapshots.push(JSON.stringify(state));if(snapshots.length>50)snapshots.shift()}
function undo(){if(!snapshots.length)return;state=JSON.parse(snapshots.pop());pendingAction=null;render()}

function postBlind(seat,amount,label){
  const p=state.players[seat],amt=Math.min(amount,p.stack);
  p.stack-=amt;p.streetBet+=amt;state.pot+=amt;if(p.stack===0)p.allIn=true;
  state.history.push({street:"preflop",text:`${NAMES[seat]} posts ${label} ${fmt(amt)}`});
}
function startHand(resetStacks=false){
  if(resetStacks)state.players=basePlayers();
  state.street="preflop";state.pot=0;state.currentBet=0;state.heroCards=[null,null];state.board=[null,null,null,null,null];
  state.history=[];state.awaitingBoard=false;state.awaitingHeroCards=true;state.handComplete=false;
  state.players.forEach(p=>{p.streetBet=0;p.folded=false;p.allIn=false;p.acted=false});
  postBlind(seatForPos("SB"),.5,"SB");postBlind(seatForPos("BB"),1,"BB");
  state.currentBet=1;state.actorSeat=null;
  state.history.push({street:"preflop",text:"Hand started"});
  snapshots=[];pendingAction=null;render();
}
function contribute(seat,amount){
  const p=state.players[seat],amt=Math.max(0,Math.min(amount,p.stack));
  p.stack-=amt;p.streetBet+=amt;state.pot+=amt;if(p.stack<=0)p.allIn=true;return amt;
}
function markRaiseReset(raiser){
  state.players.forEach((p,i)=>{if(i!==raiser&&!p.folded&&!p.allIn)p.acted=false});
  state.players[raiser].acted=true;
}
function bettingRoundComplete(){
  const a=actionablePlayers();
  if(a.length<=1)return true;
  return a.every(p=>p.acted && Math.abs(p.streetBet-state.currentBet)<1e-9);
}
function finishIfOneLeft(){
  const live=livePlayers();
  if(live.length!==1)return false;
  state.actorSeat=null;state.handComplete=true;
  state.history.push({street:state.street,text:`${live[0].name} wins ${fmt(state.pot)}`});
  return true;
}
function requiredBoardCount(){return state.street==="flop"?3:state.street==="turn"?4:state.street==="river"?5:0}
function boardReady(){return state.board.slice(0,requiredBoardCount()).every(Boolean)}
function beginNextStreet(){
  const order=["preflop","flop","turn","river"];
  if(state.street==="river"){
    state.actorSeat=null;state.handComplete=true;
    state.history.push({street:"river",text:"Betting complete — showdown"});
    return;
  }
  state.street=order[order.indexOf(state.street)+1];
  state.players.forEach(p=>{p.streetBet=0;p.acted=false});
  state.currentBet=0;pendingAction=null;
  state.awaitingBoard=true;state.actorSeat=null;
  state.history.push({street:state.street,text:`${state.street.toUpperCase()} — enter board card${state.street==="flop"?"s":""}`});
}
function resumeStreetIfBoardReady(){
  if(!state.awaitingBoard||!boardReady())return;
  state.awaitingBoard=false;
  const btn=seatForPos("BTN");
  state.actorSeat=nextActionableSeat(btn);
  state.history.push({street:state.street,text:`${state.street.toUpperCase()} betting begins`});
}
function advanceAfterAction(lastSeat){
  if(finishIfOneLeft())return;
  if(bettingRoundComplete()){beginNextStreet();return}
  state.actorSeat=nextActionableSeat(lastSeat);
}

function doAction(type,overrideSize=null){
  if(state.handComplete||state.awaitingBoard||state.awaitingHeroCards||state.actorSeat===null)return;
  const s=state.actorSeat,p=state.players[s],name=NAMES[s],toCall=amountToCallFor(s);
  if(type==="check"&&toCall>0){alert("Check är inte möjligt. Du måste folda, syna eller höja.");return}
  if(type==="call"&&toCall<=0){alert("Det finns inget att syna. Check är gratis.");return}
  if(type==="bet"&&state.currentBet>0){alert("Det finns redan en bet. Använd Raise.");return}
  if(type==="raise"&&state.currentBet<=0){alert("Ingen har bettat ännu. Använd Bet.");return}
  if((type==="bet"||type==="raise")&&overrideSize===null){pendingAction=type;render();return}

  snapshot();
  if(type==="fold"){p.folded=true;p.acted=true;state.history.push({street:state.street,text:`${name} folds`});}
  else if(type==="check"){p.acted=true;state.history.push({street:state.street,text:`${name} checks`});}
  else if(type==="call"){
    const paid=contribute(s,toCall);p.acted=true;
    state.history.push({street:state.street,text:`${name} calls ${fmt(paid)}`});
  }
  else if(type==="allin"){
    const oldCurrent=state.currentBet;contribute(s,p.stack);
    if(p.streetBet>oldCurrent){state.currentBet=p.streetBet;markRaiseReset(s)}
    else p.acted=true;
    state.history.push({street:state.street,text:`${name} all-in to ${fmt(p.streetBet)}`});
  }
  else if(type==="bet"||type==="raise"){
    let target;
    if(state.street==="preflop"&&overrideSize>=2)target=overrideSize;
    else if(type==="bet")target=p.streetBet+Math.max(.01,state.pot*overrideSize);
    else target=state.currentBet+Math.max(1,state.pot*overrideSize);
    if(target<=state.currentBet && type==="raise"){snapshots.pop();alert("Raise måste vara högre än nuvarande bet.");return}
    contribute(s,Math.max(0,target-p.streetBet));
    if(p.streetBet>state.currentBet){state.currentBet=p.streetBet;markRaiseReset(s)} else p.acted=true;
    state.history.push({street:state.street,text:`${name} ${type==="bet"?"bets":"raises to"} ${fmt(p.streetBet)}`});
    pendingAction=null;
  }
  advanceAfterAction(s);render();
}

function nextHand(){state.handNumber++;state.dealerSeat=(state.dealerSeat+1)%6;startHand(false)}
function resetAll(){state=defaultState();startHand(true)}
function usedCards(){return [...state.heroCards,...state.board].filter(Boolean).map(c=>c.rank+c.suit)}
function cardText(c){return c?c.rank+SUITS.find(s=>s.k===c.suit).sym:"+"}
function paintCard(el,c){el.textContent=cardText(c);el.classList.remove("card-red","card-black");if(c)el.classList.add(SUITS.find(s=>s.k===c.suit).red?"card-red":"card-black")}

function slotAllowed(target){
  if(target.startsWith("hero"))return true;
  const i=Number(target.slice(5));
  if(state.street==="preflop")return false;
  if(state.street==="flop")return i<=2;
  if(state.street==="turn")return i<=3;
  return i<=4;
}
function openPicker(target){
  if(!slotAllowed(target)){alert("Det kortet är inte tillgängligt ännu.");return}
  pickerTarget=target;pickerRank=null;
  document.getElementById("cardModal").classList.remove("hidden");
  document.getElementById("rankGrid").classList.remove("hidden");
  document.getElementById("suitGrid").classList.add("hidden");
}
function closePicker(){document.getElementById("cardModal").classList.add("hidden");pickerTarget=null;pickerRank=null}
function targetGet(){if(pickerTarget.startsWith("hero"))return state.heroCards[Number(pickerTarget.slice(4))];return state.board[Number(pickerTarget.slice(5))]}
function targetSet(v){if(pickerTarget.startsWith("hero"))state.heroCards[Number(pickerTarget.slice(4))]=v;else state.board[Number(pickerTarget.slice(5))]=v}
function buildPicker(){
  const rg=document.getElementById("rankGrid"),sg=document.getElementById("suitGrid");rg.innerHTML="";sg.innerHTML="";
  RANKS.forEach(r=>{const b=document.createElement("button");b.textContent=r;b.onclick=()=>{pickerRank=r;rg.classList.add("hidden");sg.classList.remove("hidden")};rg.appendChild(b)});
  SUITS.forEach(su=>{const b=document.createElement("button");b.textContent=su.sym;b.style.color=su.red?"#e34b4b":"#111";b.onclick=()=>{
    const code=pickerRank+su.k,old=targetGet();if(usedCards().includes(code)&&(!old||old.rank+old.suit!==code)){alert("Kortet används redan.");return}
    snapshot();targetSet({rank:pickerRank,suit:su.k});closePicker();if(state.awaitingHeroCards&&state.heroCards.every(Boolean)){state.awaitingHeroCards=false;state.actorSeat=seatForPos("UTG");state.history.push({street:"preflop",text:"Hero cards entered — preflop betting begins"});}resumeStreetIfBoardReady();render();
  };sg.appendChild(b)});
}
function setButtonState(){
  const toCall=state.actorSeat===null?0:amountToCallFor(state.actorSeat);
  const locked=state.actorSeat===null||state.awaitingBoard||state.awaitingHeroCards||state.handComplete;
  document.querySelectorAll("[data-action]").forEach(b=>b.disabled=locked);
  const check=document.querySelector('[data-action="check"]'),call=document.querySelector('[data-action="call"]');
  const bet=document.querySelector('[data-action="bet"]'),raise=document.querySelector('[data-action="raise"]');
  check.disabled=locked||toCall>0;call.disabled=locked||toCall<=0;
  bet.disabled=locked||state.currentBet>0;raise.disabled=locked||state.currentBet<=0;
  document.getElementById("sizeRow").style.opacity=pendingAction?"1":".45";
}

function heroIsActing(){
  return state.actorSeat===0 && !state.awaitingBoard && !state.awaitingHeroCards && !state.handComplete;
}
function effectiveStackVsActiveOpponents(){
  const hero=state.players[0];
  const opponents=state.players.filter((p,i)=>i!==0&&!p.folded);
  if(!opponents.length)return 0;
  const maxCallable=Math.max(...opponents.map(p=>p.stack));
  return Math.min(hero.stack,maxCallable);
}
function calculateMath(){
  const heroTurn=heroIsActing();
  const hero=state.players[0];
  const call=heroTurn?amountToCallFor(0):0;
  const potBefore=state.pot;
  const finalPotAfterCall=potBefore+call;
  const requiredEquity=call>0 && finalPotAfterCall>0 ? call/finalPotAfterCall : 0;
  const potOdds=requiredEquity;
  const effectiveStack=effectiveStackVsActiveOpponents();
  const spr=state.street!=="preflop" && potBefore>0 ? effectiveStack/potBefore : null;
  return {heroTurn,call,potBefore,finalPotAfterCall,requiredEquity,potOdds,effectiveStack,spr};
}
function pct(x){return `${(x*100).toFixed(1)}%`}
function renderMathPanel(){
  const m=calculateMath();
  const note=document.getElementById("mathHeroNote");
  const exp=document.getElementById("mathExplanation");
  document.getElementById("mathPot").textContent=fmt(m.potBefore);
  document.getElementById("mathCall").textContent=m.heroTurn?fmt(m.call):"—";
  document.getElementById("mathEffectiveStack").textContent=fmt(m.effectiveStack);
  document.getElementById("mathSpr").textContent=m.spr===null?"Preflop":m.spr.toFixed(2);

  if(!m.heroTurn){
    document.getElementById("mathPotOdds").textContent="—";
    document.getElementById("mathRequiredEquity").textContent="—";
    note.textContent=state.awaitingHeroCards
      ?"Välj först dina två hålkort."
      :state.awaitingBoard
        ?`Mata in ${state.street.toUpperCase()}-kortet/korten.`
        :"Matematikpanelen aktiveras när Hero står på tur.";
    exp.textContent="När Hero står på tur visas pot odds, required equity och SPR automatiskt.";
    return;
  }

  note.textContent=`Hero är på tur som ${posForSeat(0)}.`;
  if(m.call>0){
    document.getElementById("mathPotOdds").textContent=pct(m.potOdds);
    document.getElementById("mathRequiredEquity").textContent=pct(m.requiredEquity);
    exp.innerHTML=`En call kostar <strong>${fmt(m.call)}</strong>. Efter call blir den totala potten <strong>${fmt(m.finalPotAfterCall)}</strong>. Hero behöver därför minst <strong class="math-highlight">${pct(m.requiredEquity)} equity</strong> för att en ren call ska nå break-even, innan framtida betting och implied odds tas med.`;
  }else{
    document.getElementById("mathPotOdds").textContent="0.0%";
    document.getElementById("mathRequiredEquity").textContent="0.0%";
    exp.innerHTML=`Hero kan <strong>checka gratis</strong>. Required equity för att fortsätta via check är därför 0%.${m.spr!==null?` Aktuell SPR är <strong>${m.spr.toFixed(2)}</strong>.`:""}`;
  }
}


const HR={2:2,3:3,4:4,5:5,6:6,7:7,8:8,9:9,T:10,J:11,Q:12,K:13,A:14};
const FULLDECK=RANKS.flatMap(r=>SUITS.map(s=>({rank:r,suit:s.k})));
function code(c){return c.rank+c.suit} function copy(c){return {rank:c.rank,suit:c.suit}}
function shuf(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function comb(arr,k){const out=[];function rec(s,p){if(p.length===k){out.push(p.slice());return}for(let i=s;i<=arr.length-(k-p.length);i++){p.push(arr[i]);rec(i+1,p);p.pop()}}rec(0,[]);return out}
function e5(cs){const v=cs.map(c=>HR[c.rank]).sort((a,b)=>b-a),cnt={};v.forEach(x=>cnt[x]=(cnt[x]||0)+1);let u=[...new Set(v)].sort((a,b)=>b-a);if(u.includes(14))u.push(1);let st=0;for(let i=0;i<=u.length-5;i++)if(u[i]-u[i+4]===4){st=u[i];break}const fl=cs.every(c=>c.suit===cs[0].suit),g=Object.entries(cnt).map(([x,n])=>({v:+x,c:n})).sort((a,b)=>b.c-a.c||b.v-a.v);if(fl&&st)return[8,st];if(g[0].c===4)return[7,g[0].v,g[1].v];if(g[0].c===3&&g[1]?.c===2)return[6,g[0].v,g[1].v];if(fl)return[5,...v];if(st)return[4,st];if(g[0].c===3)return[3,g[0].v,...g.slice(1).map(x=>x.v).sort((a,b)=>b-a)];if(g[0].c===2&&g[1]?.c===2){const p=[g[0].v,g[1].v].sort((a,b)=>b-a),k=g.find(x=>x.c===1).v;return[2,...p,k]}if(g[0].c===2)return[1,g[0].v,...g.filter(x=>x.c===1).map(x=>x.v).sort((a,b)=>b-a)];return[0,...v]}
function cmp(a,b){for(let i=0;i<Math.max(a.length,b.length);i++){const x=a[i]||0,y=b[i]||0;if(x!==y)return x>y?1:-1}return 0}
function best(cs){let b=null;for(const f of comb(cs,5)){const s=e5(f);if(!b||cmp(s,b)>0)b=s}return b}
function desc(a,b){const x=HR[a.rank],y=HR[b.rank];if(x===y)return a.rank+b.rank;const hi=x>y?a:b,lo=x>y?b:a;return hi.rank+lo.rank+(a.suit===b.suit?"s":"o")}
const ORDER=["AA","KK","QQ","JJ","TT","99","88","77","66","55","44","33","22","AKs","AQs","AJs","ATs","KQs","KJs","QJs","JTs","T9s","98s","87s","76s","65s","54s","AKo","AQo","AJo","KQo","ATo","KJo","QJo","A9s","A8s","A7s","A6s","A5s","A4s","A3s","A2s","KTs","QTs","J9s","T8s","97s","86s","75s","64s","53s","43s","K9s","Q9s","J8s","T7s","96s","85s","74s","63s","52s","42s","A9o","A8o","A7o","A6o","A5o","KTo","QTo","JTo","K9o","Q9o","J9o","T9o","98o","87o","76o","65o","54o"];
function preset(kind,seat){let t=kind==="tight"?12:kind==="standard"?20:kind==="wide"?35:kind==="verywide"?50:({UTG:14,HJ:18,CO:27,BTN:43,SB:36,BB:45}[posForSeat(seat)]||20);let c=0,ds=new Set;const goal=1326*t/100;for(const d of ORDER){if(c>=goal)break;ds.add(d);c+=d.length===2?6:d.endsWith("s")?4:12}return{ds,t}}
function villainSeat(){const e=document.getElementById("villainSelect");return e&&e.value!==""?+e.value:null}
function rangeNow(){const s=villainSeat();if(s===null)return{combos:[],t:0};const p=preset(document.getElementById("rangePreset")?.value||"auto",s),dead=new Set([...state.heroCards,...state.board].filter(Boolean).map(code)),av=FULLDECK.filter(c=>!dead.has(code(c))),out=[];for(let i=0;i<av.length;i++)for(let j=i+1;j<av.length;j++)if(p.ds.has(desc(av[i],av[j])))out.push([copy(av[i]),copy(av[j])]);return{combos:out,t:p.t}}
function updateVillains(){const e=document.getElementById("villainSelect");if(!e)return;const old=e.value;e.innerHTML="";state.players.forEach((p,i)=>{if(i===0||p.folded)return;const o=document.createElement("option");o.value=i;o.textContent=`${NAMES[i]} · ${posForSeat(i)}`;e.appendChild(o)});if([...e.options].some(o=>o.value===old))e.value=old}
function rangeSummary(){const r=rangeNow();const a=document.getElementById("rangeCombos"),b=document.getElementById("rangeWidth");if(a){a.textContent=r.combos.length;b.textContent=`≈ ${r.t}%`}}
let lastEq=null;
let autoAnalysisToken=0;
let lastAutoSignature="";
let autoAnalysisRunning=false;
let autoAnalysisTimeout=null;
function runEq(autoMode=false){
  if(!state.heroCards.every(Boolean)){
    if(!autoMode)alert("Välj Hero-korten först.");
    return;
  }

  const r=rangeNow();
  if(!r.combos.length){
    autoAnalysisRunning=false;
    if(autoMode)showAutoError("INSUFFICIENT DATA","No valid opponent combos.");
    return;
  }

  const btn=document.getElementById("runEquityBtn");
  if(btn&&!autoMode){
    btn.disabled=true;
    btn.textContent="Calculating...";
  }

  const token=++autoAnalysisToken;
  autoAnalysisRunning=autoMode;

  if(autoAnalysisTimeout)clearTimeout(autoAnalysisTimeout);

  const targetRuns=autoMode?800:5000;
  const batchSize=autoMode?40:80;
  const startTime=performance.now();
  const softLimitMs=autoMode?1400:5000;

  let w=0,t=0,l=0,done=0;
  const kb=state.board.filter(Boolean).map(copy);
  const base=new Set([...state.heroCards,...kb].map(code));

  function finishEstimate(partial=false){
    if(token!==autoAnalysisToken)return;

    const N=Math.max(1,done);
    lastEq={
      win:w/N,
      tie:t/N,
      lose:l/N,
      equity:(w+t*.5)/N,
      runs:N,
      partial
    };

    autoAnalysisRunning=false;

    if(autoAnalysisTimeout){
      clearTimeout(autoAnalysisTimeout);
      autoAnalysisTimeout=null;
    }

    renderEq();

    if(btn&&!autoMode){
      btn.disabled=false;
      btn.textContent="Calculate equity";
    }

    renderAutoDecision();

    const sub=document.getElementById("heroTurnSub");
    if(autoMode && sub){
      sub.textContent=partial
        ? `Quick estimate · ${N} sims`
        : `Decision ready · ${N} sims`;
    }
  }

  function processBatch(){
    if(token!==autoAnalysisToken)return;

    try{
      const batchEnd=Math.min(done+batchSize,targetRuns);

      while(done<batchEnd){
        const vh=r.combos[Math.floor(Math.random()*r.combos.length)];

        if(!vh || vh.some(c=>base.has(code(c)))){
          continue;
        }

        const dead=new Set([...base,...vh.map(code)]);
        const deck=FULLDECK.filter(c=>!dead.has(code(c))).map(copy);

        // Partial Fisher-Yates: only shuffle enough cards to complete board.
        const need=5-kb.length;
        for(let i=0;i<need;i++){
          const j=i+Math.floor(Math.random()*(deck.length-i));
          [deck[i],deck[j]]=[deck[j],deck[i]];
        }

        const bd=kb.slice();
        for(let i=0;i<need;i++)bd.push(deck[i]);

        const q=cmp(
          best([...state.heroCards,...bd]),
          best([...vh,...bd])
        );

        if(q>0)w++;
        else if(q===0)t++;
        else l++;

        done++;
      }

      const elapsed=performance.now()-startTime;

      if(done>=targetRuns){
        finishEstimate(false);
        return;
      }

      // In auto mode, return a usable quick estimate instead of hanging.
      if(autoMode && elapsed>=softLimitMs && done>=200){
        finishEstimate(true);
        return;
      }

      // Yield to browser so UI, timeout, buttons and repaint keep working.
      setTimeout(processBatch,0);

    }catch(err){
      console.error(err);
      autoAnalysisRunning=false;

      if(autoAnalysisTimeout){
        clearTimeout(autoAnalysisTimeout);
        autoAnalysisTimeout=null;
      }

      if(done>=100){
        finishEstimate(true);
      }else if(autoMode){
        showAutoError("ANALYSIS ERROR","Unable to calculate this state.");
      }

      if(btn&&!autoMode){
        btn.disabled=false;
        btn.textContent="Calculate equity";
      }
    }
  }

  if(autoMode){
    autoAnalysisTimeout=setTimeout(()=>{
      if(token!==autoAnalysisToken || !autoAnalysisRunning)return;

      if(done>=100){
        finishEstimate(true);
      }else{
        autoAnalysisRunning=false;
        showAutoError("ANALYSIS ERROR","Calculation timed out.");
      }
    },2200);
  }

  setTimeout(processBatch,0);
}

function renderEq(){if(!lastEq)return;document.getElementById("eqWin").textContent=pct(lastEq.win);document.getElementById("eqTie").textContent=pct(lastEq.tie);document.getElementById("eqLose").textContent=pct(lastEq.lose);document.getElementById("eqTotal").textContent=pct(lastEq.equity);document.getElementById("equityExplanation").innerHTML=`Hero equity vs selected estimated range: <strong class="math-highlight">${pct(lastEq.equity)}</strong>. Blocked combos are removed. ${lastEq.runs?`Based on ${lastEq.runs} simulations${lastEq.partial?" (quick estimate)":""}.`:""}`;renderEv()}
function renderEv(){
  if(!lastEq)return;
  const ev=actionEVs(); if(!ev)return;
  document.getElementById("evFold").textContent=`${ev.evFold.toFixed(2)} BB`;
  document.getElementById("evCall").textContent=`${ev.evCall.toFixed(2)} BB`;
  document.getElementById("evRaise").textContent=`${ev.evRaise.toFixed(2)} BB`;
  const vals=[["FOLD",ev.evFold],["CALL",ev.evCall],["RAISE",ev.evRaise]].sort((a,b)=>b[1]-a[1]);
  const gap=vals[0][1]-vals[1][1];
  let strength=gap>=2?"CLEAR":gap>=.5?"MODERATE":"CLOSE";
  let action=vals[0][0];
  if(ev.robust==="NO CLEAR EDGE"){action="NO CLEAR EDGE";strength="CLOSE";}
  document.getElementById("recommendation").innerHTML=
    `BEST: <span class="${action==="NO CLEAR EDGE"?"no-edge":"math-highlight"}">${action}</span> · ${strength}<br>`+
    `<span style="font-size:10px;color:var(--muted)">Fold ${(ev.foldPct*100).toFixed(0)}% · Call ${(ev.callFreq*100).toFixed(0)}% · Reraise ${(ev.reraisePct*100).toFixed(0)}% · Equity when called ${(ev.eqCall*100).toFixed(1)}%</span>`;
  renderAutoDecision();
}

function hookV04(){const vs=document.getElementById("villainSelect"),rp=document.getElementById("rangePreset");if(!vs)return;vs.onchange=()=>{lastEq=null;lastAutoSignature="";rangeSummary();maybeAutoAnalyze()};rp.onchange=()=>{lastEq=null;lastAutoSignature="";rangeSummary();maybeAutoAnalyze()};document.getElementById("runEquityBtn").onclick=runEq;const f=document.getElementById("foldSlider");f.oninput=()=>{document.getElementById("foldValue").textContent=`${f.value}%`;lastAutoSignature="";renderEv();maybeAutoAnalyze()};document.getElementById("raiseSizeSelect").onchange=()=>{lastAutoSignature="";renderEv();maybeAutoAnalyze()};const rr=document.getElementById("reraiseSlider");rr.oninput=()=>{document.getElementById("reraiseValue").textContent=`${rr.value}%`;lastAutoSignature="";renderEv();maybeAutoAnalyze()};updateVillains();rangeSummary()}

function render(){
  document.getElementById("handNumber").textContent=`#${state.handNumber}`;
  document.getElementById("streetLabel").textContent=streetName(state.street);
  document.getElementById("heroPosition").textContent=posForSeat(0);
  document.getElementById("potValue").textContent=fmt(state.pot);
  document.getElementById("sidePot").textContent=fmt(state.pot);
  document.getElementById("currentBet").textContent=fmt(state.currentBet);
  document.getElementById("activeCount").textContent=livePlayers().length;
  const tc=state.actorSeat===null?0:amountToCallFor(state.actorSeat);
  document.getElementById("amountToCall").textContent=state.awaitingBoard?"Enter board cards":`To call: ${fmt(tc)}`;
  document.getElementById("sideToCall").textContent=fmt(tc);
  document.getElementById("actorName").textContent=state.awaitingBoard?`${streetName(state.street)} board`:actorLabel();
  document.getElementById("toAct").textContent=state.handComplete?"Hand complete":state.awaitingBoard?`Enter ${streetName(state.street)} card${state.street==="flop"?"s":""}`:`${actorLabel()} to act`;

  for(let s=0;s<6;s++){
    document.getElementById(`position-${s}`).textContent=posForSeat(s);
    document.getElementById(`stack-${s}`).textContent=fmt(state.players[s].stack);
    document.getElementById(`bet-${s}`).textContent=state.players[s].streetBet>0?fmt(state.players[s].streetBet):"";
    document.getElementById(`dealer-${s}`).classList.toggle("active",s===state.dealerSeat);
    const seat=document.querySelector(`.seat[data-seat="${s}"]`);
    seat.classList.toggle("active",s===state.actorSeat);seat.classList.toggle("folded",state.players[s].folded);
  }
  document.querySelectorAll("[data-card-slot]").forEach(el=>{
    const t=el.dataset.cardSlot,c=t.startsWith("hero")?state.heroCards[Number(t.slice(4))]:state.board[Number(t.slice(5))];
    paintCard(el,c);
    if(t.startsWith("board")){el.disabled=!slotAllowed(t);el.style.opacity=slotAllowed(t)?"1":".28"}
  });
  const list=document.getElementById("positionList");list.innerHTML="";
  for(let s=0;s<6;s++){const row=document.createElement("div");row.className=`position-row ${s===0?"hero":""}`;row.innerHTML=`<span>${NAMES[s]}</span><strong>${posForSeat(s)}</strong>`;list.appendChild(row)}
  const hist=document.getElementById("history");hist.innerHTML="";let lastStreet="";
  state.history.forEach(h=>{if(h.street!==lastStreet){const st=document.createElement("div");st.className="history-street";st.textContent=h.street.toUpperCase();hist.appendChild(st);lastStreet=h.street}const ln=document.createElement("div");ln.className="history-line";ln.textContent=h.text;hist.appendChild(ln)});
  setButtonState();renderMathPanel();
  const overlay=document.getElementById("entryOverlay"), entryCards=document.getElementById("entryCards");
  const showEntry=state.awaitingHeroCards||state.awaitingBoard;
  overlay.classList.toggle("hidden",!showEntry);
  if(showEntry){
    entryCards.innerHTML="";
    if(state.awaitingHeroCards){
      document.getElementById("entryEyebrow").textContent="NEW HAND";
      document.getElementById("entryTitle").textContent="ENTER YOUR HAND";
      document.getElementById("entryHint").textContent="Välj dina två hålkort. Preflop startar automatiskt när båda är valda.";
      [0,1].forEach(i=>{
        const b=document.createElement("button");b.className="entry-card";const c=state.heroCards[i];b.textContent=cardText(c);
        if(c){b.classList.add("filled",SUITS.find(s=>s.k===c.suit).red?"card-red":"card-black")}
        b.onclick=()=>openPicker(`hero${i}`);entryCards.appendChild(b);
      });
    }else{
      const need=state.street==="flop"?[0,1,2]:state.street==="turn"?[3]:[4];
      document.getElementById("entryEyebrow").textContent=state.street.toUpperCase();
      document.getElementById("entryTitle").textContent=`ENTER ${state.street.toUpperCase()}`;
      document.getElementById("entryHint").textContent=state.street==="flop"?"Välj de tre flopkorten. Action startar automatiskt när alla tre är valda.":"Välj det nya boardkortet. Action startar automatiskt när kortet är valt.";
      need.forEach(i=>{
        const b=document.createElement("button");b.className="entry-card";const c=state.board[i];b.textContent=cardText(c);
        if(c){b.classList.add("filled",SUITS.find(s=>s.k===c.suit).red?"card-red":"card-black")}
        b.onclick=()=>openPicker(`board${i}`);entryCards.appendChild(b);
      });
    }
  }
  saveState();setTimeout(maybeAutoAnalyze,0);
}

document.querySelectorAll("[data-card-slot]").forEach(b=>b.addEventListener("click",()=>openPicker(b.dataset.cardSlot)));
document.getElementById("closeModal").onclick=closePicker;
document.getElementById("cardModal").addEventListener("click",e=>{if(e.target.id==="cardModal")closePicker()});
document.getElementById("clearCardBtn").onclick=()=>{if(!pickerTarget)return;snapshot();targetSet(null);closePicker();render()};
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>doAction(b.dataset.action));
document.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{if(!pendingAction){alert("Tryck först Bet eller Raise.");return}doAction(pendingAction,Number(b.dataset.size))});
document.getElementById("customSizeBtn").onclick=()=>{if(!pendingAction||state.actorSeat===null)return;const x=Number(prompt("Ange målbelopp i BB, t.ex. 6.5"));if(!Number.isFinite(x)||x<=state.currentBet)return;snapshot();const s=state.actorSeat,p=state.players[s];contribute(s,Math.max(0,x-p.streetBet));state.currentBet=p.streetBet;markRaiseReset(s);state.history.push({street:state.street,text:`${NAMES[s]} ${pendingAction==="bet"?"bets":"raises to"} ${fmt(p.streetBet)}`});pendingAction=null;advanceAfterAction(s);render()};
document.getElementById("undoBtn").onclick=undo;
document.getElementById("nextStreetBtn").style.display="none";
document.getElementById("nextHand").onclick=nextHand;
document.getElementById("resetSession").onclick=()=>{if(confirm("Reset hela sessionen?"))resetAll()};
buildPicker();hookV04();
if(!state.history?.length)startHand(false);else render();
