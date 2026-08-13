const POSITIONS_FROM_BTN=["BTN","SB","BB","UTG","HJ","CO"];
const NAMES=["HERO","Player 2","Player 3","Player 4","Player 5","Player 6"];
const RANKS=["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
const SUITS=[{k:"s",sym:"♠",red:false},{k:"h",sym:"♥",red:true},{k:"d",sym:"♦",red:true},{k:"c",sym:"♣",red:false}];
const STORAGE_KEY="poker-assistant-v02";
let pickerTarget=null,pickerRank=null,pendingAction=null;
let snapshots=[];

function basePlayers(){return NAMES.map((name,seat)=>({seat,name,stack:100,streetBet:0,folded:false,allIn:false}));}
function defaultState(){return {handNumber:1,dealerSeat:3,street:"preflop",players:basePlayers(),pot:0,currentBet:0,actorSeat:null,heroCards:[null,null],board:[null,null,null,null,null],history:[]};}
let state=loadState()||defaultState();

function loadState(){try{const x=JSON.parse(localStorage.getItem(STORAGE_KEY));return x&&x.players?.length===6?x:null}catch{return null}}
function saveState(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function posForSeat(seat){return POSITIONS_FROM_BTN[(seat-state.dealerSeat+6)%6]}
function seatForPos(pos){for(let i=0;i<6;i++)if(posForSeat(i)===pos)return i;return null}
function fmt(x){const n=Math.round(x*100)/100;return `${n} BB`}
function nextActiveSeat(from){for(let i=1;i<=6;i++){const s=(from+i)%6;const p=state.players[s];if(!p.folded&&!p.allIn)return s}return null}
function activePlayers(){return state.players.filter(p=>!p.folded)}
function actorLabel(){return state.actorSeat===null?"—":`${NAMES[state.actorSeat]} · ${posForSeat(state.actorSeat)}`}

function startHand(resetStacks=false){
  if(resetStacks) state.players=basePlayers();
  state.street="preflop";state.pot=0;state.currentBet=0;state.heroCards=[null,null];state.board=[null,null,null,null,null];state.history=[];
  state.players.forEach(p=>{p.streetBet=0;p.folded=false;p.allIn=false});
  const sb=seatForPos("SB"),bb=seatForPos("BB");
  postBlind(sb,.5,"SB");postBlind(bb,1,"BB");
  state.currentBet=1;
  state.actorSeat=seatForPos("UTG");
  state.history.push({street:"preflop",text:"Hand started"});
  snapshots=[];render();
}
function postBlind(seat,amount,label){const p=state.players[seat],amt=Math.min(amount,p.stack);p.stack-=amt;p.streetBet+=amt;state.pot+=amt;state.history.push({street:"preflop",text:`${NAMES[seat]} posts ${label} ${fmt(amt)}`})}
function snapshot(){snapshots.push(JSON.stringify(state));if(snapshots.length>40)snapshots.shift()}
function undo(){if(!snapshots.length)return;state=JSON.parse(snapshots.pop());render()}

function amountToCallFor(seat){return Math.max(0,state.currentBet-state.players[seat].streetBet)}
function contribute(seat,amount){const p=state.players[seat],amt=Math.max(0,Math.min(amount,p.stack));p.stack-=amt;p.streetBet+=amt;state.pot+=amt;if(p.stack<=0)p.allIn=true;return amt}
function doAction(type,overrideSize=null){
  if(state.actorSeat===null)return;
  snapshot();
  const s=state.actorSeat,p=state.players[s],name=NAMES[s],toCall=amountToCallFor(s);
  if(type==="fold"){p.folded=true;state.history.push({street:state.street,text:`${name} folds`});}
  else if(type==="check"){if(toCall>0){snapshots.pop();alert("Det går inte att checka när det finns ett belopp att syna.");return}state.history.push({street:state.street,text:`${name} checks`});}
  else if(type==="call"){if(toCall<=0){snapshots.pop();alert("Det finns inget att syna.");return}const paid=contribute(s,toCall);state.history.push({street:state.street,text:`${name} calls ${fmt(paid)}`});}
  else if(type==="allin"){const before=p.streetBet;const paid=contribute(s,p.stack);if(p.streetBet>state.currentBet)state.currentBet=p.streetBet;state.history.push({street:state.street,text:`${name} all-in to ${fmt(p.streetBet)}`});}
  else if(type==="bet"||type==="raise"){
    pendingAction=type;
    if(overrideSize===null){document.getElementById("sizeRow").scrollIntoView({behavior:"smooth",block:"center"});snapshots.pop();return}
    let target;
    if(state.street==="preflop"&&overrideSize>=2){target=overrideSize;}
    else if(type==="bet"){target=p.streetBet+Math.max(.01,state.pot*overrideSize);}
    else {target=Math.max(state.currentBet+Math.max(1,state.currentBet),state.currentBet+state.pot*overrideSize);}
    const add=Math.max(0,target-p.streetBet);
    const paid=contribute(s,add);
    if(p.streetBet>state.currentBet)state.currentBet=p.streetBet;
    state.history.push({street:state.street,text:`${name} ${type==="bet"?"bets":"raises to"} ${fmt(p.streetBet)}`});
    pendingAction=null;
  }
  advanceAfterAction(s);render();
}
function advanceAfterAction(lastSeat){
  if(activePlayers().length===1){state.actorSeat=null;state.history.push({street:state.street,text:`${activePlayers()[0].name} wins the pot`});return}
  state.actorSeat=nextActiveSeat(lastSeat);
}
function nextStreet(){
  if(state.street==="river"){alert("River är redan sista street. Klicka Next hand.");return}
  snapshot();
  const order=["preflop","flop","turn","river"];
  state.street=order[order.indexOf(state.street)+1];
  state.players.forEach(p=>p.streetBet=0);state.currentBet=0;
  const bb=seatForPos("BB");state.actorSeat=nextActiveSeat((bb+5)%6);
  state.history.push({street:state.street,text:`${state.street.toUpperCase()} begins`});
  render();
}
function nextHand(){
  state.handNumber++;state.dealerSeat=(state.dealerSeat+1)%6;startHand(false);
}
function resetAll(){state=defaultState();startHand(true)}

function usedCards(){return [...state.heroCards,...state.board].filter(Boolean).map(c=>c.rank+c.suit)}
function cardText(c){return c?c.rank+SUITS.find(s=>s.k===c.suit).sym:"+"}
function paintCard(el,c){el.textContent=cardText(c);el.classList.remove("card-red","card-black");if(c)el.classList.add(SUITS.find(s=>s.k===c.suit).red?"card-red":"card-black")}

function openPicker(target){pickerTarget=target;pickerRank=null;document.getElementById("cardModal").classList.remove("hidden");document.getElementById("rankGrid").classList.remove("hidden");document.getElementById("suitGrid").classList.add("hidden")}
function closePicker(){document.getElementById("cardModal").classList.add("hidden");pickerTarget=null;pickerRank=null}
function targetGet(){if(pickerTarget.startsWith("hero"))return state.heroCards[Number(pickerTarget.slice(4))];return state.board[Number(pickerTarget.slice(5))]}
function targetSet(v){if(pickerTarget.startsWith("hero"))state.heroCards[Number(pickerTarget.slice(4))]=v;else state.board[Number(pickerTarget.slice(5))]=v}
function buildPicker(){
  const rg=document.getElementById("rankGrid"),sg=document.getElementById("suitGrid");rg.innerHTML="";sg.innerHTML="";
  RANKS.forEach(r=>{const b=document.createElement("button");b.textContent=r;b.onclick=()=>{pickerRank=r;rg.classList.add("hidden");sg.classList.remove("hidden");};rg.appendChild(b)});
  SUITS.forEach(su=>{const b=document.createElement("button");b.textContent=su.sym;b.style.color=su.red?"#e34b4b":"#111";b.onclick=()=>{const code=pickerRank+su.k;if(usedCards().includes(code)&&(!targetGet()||targetGet().rank+targetGet().suit!==code)){alert("Kortet används redan.");return}snapshot();targetSet({rank:pickerRank,suit:su.k});closePicker();render()};sg.appendChild(b)});
}
function render(){
  document.getElementById("handNumber").textContent=`#${state.handNumber}`;
  document.getElementById("streetLabel").textContent=state.street[0].toUpperCase()+state.street.slice(1);
  document.getElementById("heroPosition").textContent=posForSeat(0);
  document.getElementById("potValue").textContent=fmt(state.pot);
  document.getElementById("sidePot").textContent=fmt(state.pot);
  document.getElementById("currentBet").textContent=fmt(state.currentBet);
  document.getElementById("activeCount").textContent=activePlayers().length;
  const tc=state.actorSeat===null?0:amountToCallFor(state.actorSeat);
  document.getElementById("amountToCall").textContent=`To call: ${fmt(tc)}`;
  document.getElementById("sideToCall").textContent=fmt(tc);
  document.getElementById("actorName").textContent=actorLabel();
  document.getElementById("toAct").textContent=state.actorSeat===null?"Hand complete":`${actorLabel()} to act`;

  for(let s=0;s<6;s++){
    document.getElementById(`position-${s}`).textContent=posForSeat(s);
    document.getElementById(`stack-${s}`).textContent=fmt(state.players[s].stack);
    document.getElementById(`bet-${s}`).textContent=state.players[s].streetBet>0?fmt(state.players[s].streetBet):"";
    document.getElementById(`dealer-${s}`).classList.toggle("active",s===state.dealerSeat);
    const seat=document.querySelector(`.seat[data-seat="${s}"]`);
    seat.classList.toggle("active",s===state.actorSeat);seat.classList.toggle("folded",state.players[s].folded);
  }

  document.querySelectorAll("[data-card-slot]").forEach(el=>{
    const t=el.dataset.cardSlot;let c=t.startsWith("hero")?state.heroCards[Number(t.slice(4))]:state.board[Number(t.slice(5))];paintCard(el,c);
  });

  const list=document.getElementById("positionList");list.innerHTML="";
  for(let s=0;s<6;s++){const row=document.createElement("div");row.className=`position-row ${s===0?"hero":""}`;row.innerHTML=`<span>${NAMES[s]}</span><strong>${posForSeat(s)}</strong>`;list.appendChild(row)}
  const hist=document.getElementById("history");hist.innerHTML="";let lastStreet="";
  state.history.forEach(h=>{if(h.street!==lastStreet){const st=document.createElement("div");st.className="history-street";st.textContent=h.street.toUpperCase();hist.appendChild(st);lastStreet=h.street}const ln=document.createElement("div");ln.className="history-line";ln.textContent=h.text;hist.appendChild(ln)});
  saveState();
}

document.querySelectorAll("[data-card-slot]").forEach(b=>b.addEventListener("click",()=>openPicker(b.dataset.cardSlot)));
document.getElementById("closeModal").onclick=closePicker;
document.getElementById("cardModal").addEventListener("click",e=>{if(e.target.id==="cardModal")closePicker()});
document.getElementById("clearCardBtn").onclick=()=>{if(!pickerTarget)return;snapshot();targetSet(null);closePicker();render()};
document.querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>doAction(b.dataset.action));
document.querySelectorAll("[data-size]").forEach(b=>b.onclick=()=>{if(!pendingAction){alert("Tryck först Bet eller Raise.");return}doAction(pendingAction,Number(b.dataset.size))});
document.getElementById("customSizeBtn").onclick=()=>{if(!pendingAction){alert("Tryck först Bet eller Raise.");return}const x=Number(prompt("Ange målbelopp i BB, t.ex. 6.5"));if(!Number.isFinite(x)||x<=0)return;snapshot();const s=state.actorSeat,p=state.players[s],add=Math.max(0,x-p.streetBet);contribute(s,add);if(p.streetBet>state.currentBet)state.currentBet=p.streetBet;state.history.push({street:state.street,text:`${NAMES[s]} ${pendingAction==="bet"?"bets":"raises to"} ${fmt(p.streetBet)}`});pendingAction=null;advanceAfterAction(s);render()};
document.getElementById("undoBtn").onclick=undo;
document.getElementById("nextStreetBtn").onclick=nextStreet;
document.getElementById("nextHand").onclick=nextHand;
document.getElementById("resetSession").onclick=()=>{if(confirm("Reset hela sessionen?"))resetAll()};
buildPicker();

if(!state.history?.length){startHand(false)}else render();
