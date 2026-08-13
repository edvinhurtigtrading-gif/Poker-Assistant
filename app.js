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
  setButtonState();
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
  saveState();
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
buildPicker();
if(!state.history?.length)startHand(false);else render();
