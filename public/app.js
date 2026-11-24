import { Chess } from "https://cdn.jsdelivr.net/npm/chess.js@1.4.0/dist/esm/chess.js";
const GLYPHS = {
  w: { k:"♔", q:"♕", r:"♖", b:"♗", n:"♘", p:"♙" },
  b: { k:"♚", q:"♛", r:"♜", b:"♝", n:"♞", p:"♟" }
};
let game, selected = null, legalTargets = [], flipped = false, pending = null, activeRules = [], attempts = {}, history = [], lastMove = null, bonusMotions = 0;
let botDifficulty=Number(localStorage.getItem("motionChessBotDifficulty")||2);
let authToken=localStorage.getItem('motionChessToken')||'', currentUser=null, socket=null, onlineMatch=null, playerColor='w', themeDark=localStorage.getItem('motionChessTheme')==='dark';
if(themeDark)document.body.classList.add('theme-dark');
const $ = id => document.getElementById(id);
const boardEl = $("board");

function freshGame(){ onlineMatch=null;playerColor="w";game = new Chess(); selected=null; legalTargets=[]; pending=null; activeRules=[]; attempts={}; history=[]; lastMove=null; bonusMotions=0; render(); updatePanels(); log("New match started. White to move."); }
function coords(square){ return { file:square.charCodeAt(0)-97, rank:Number(square[1]) }; }
function squareName(f,r){ return String.fromCharCode(97+f)+r; }
function render(){
  boardEl.innerHTML="";
  const ranks = flipped ? [1,2,3,4,5,6,7,8] : [8,7,6,5,4,3,2,1];
  const files = flipped ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  ranks.forEach((rank,ri)=>files.forEach((file,fi)=>{
    const sq=squareName(file,rank), piece=game.get(sq), cell=document.createElement("div");
    cell.className="square "+(((file+rank)%2===0)?"light":"dark");
    if(selected===sq)cell.classList.add("selected");
    if(lastMove && (lastMove.from===sq||lastMove.to===sq))cell.classList.add("last-move");
    if(legalTargets.includes(sq)){cell.classList.add("legal");if(piece)cell.classList.add("has-piece");}
    cell.dataset.square=sq; cell.setAttribute("role","gridcell"); cell.addEventListener("click",()=>onSquare(sq));
    if(piece){const span=document.createElement("span");span.className="piece "+(piece.color==="w"?"white":"black");span.textContent=GLYPHS[piece.color][piece.type];cell.appendChild(span);}
    if(fi===0){const c=document.createElement("span");c.className="coord rank";c.textContent=rank;cell.appendChild(c);}
    if(ri===7){const c=document.createElement("span");c.className="coord file";c.textContent=String.fromCharCode(97+file);cell.appendChild(c);}
    boardEl.appendChild(cell);
  }));
  $("rankLabels").innerHTML=""; $("fileLabels").innerHTML="";
  ranks.forEach(r=>{const s=document.createElement("span");s.textContent=r;$("rankLabels").appendChild(s)});
  files.forEach(f=>{const s=document.createElement("span");s.textContent=String.fromCharCode(97+f);$("fileLabels").appendChild(s)});
  $("turnLabel").textContent=game.turn()==="w"?"White":"Black";
  $("turnDot").style.background=game.turn()==="w"?"#7fb57e":"#4b5b4c";
  $("turnNumber").textContent=String(game.history().length+1).padStart(2,"0");
  $("boardHint").textContent=game.isCheck()?(game.turn()==="w"?"White is in check.":"Black is in check."):"Select a piece, then choose a highlighted square.";
}
function onSquare(sq){
  if(game.isGameOver()){toast("The game is over. Start a new game to continue.");return;}
  if(playerColor==="spectator"){toast("Spectators cannot move pieces.");return;}
  if(game.turn()!==playerColor){toast(onlineMatch?"It is not your turn.":"The practice bot is thinking.");return;}
  const piece=game.get(sq);
  if(selected && legalTargets.includes(sq)){
    const move=game.move({from:selected,to:sq,promotion:"q"});
    if(move){lastMove={from:move.from,to:move.to};selected=null;legalTargets=[];if(onlineMatch){socket.emit("match:move",{matchId:onlineMatch.id,from:move.from,to:move.to,promotion:"q"});}else{render();updatePanels();log(`You moved ${pieceName(move.piece)} ${move.from} → ${move.to}.`);if(game.isGameOver()){endGame();return;} setTimeout(botMove,550);}return;}
  }
  if(piece && piece.color===playerColor){
    selected=sq;legalTargets=game.moves({square:sq,verbose:true}).map(m=>m.to);render();
  } else {selected=null;legalTargets=[];render();}
}
function pieceName(p){return ({p:"Pawn",n:"Knight",b:"Bishop",r:"Rook",q:"Queen",k:"King"})[p]||p;}
function applyLocalRumble(color,distance,capturePath){
  const forward=color==="w"?1:-1, pawns=[];
  for(let r=1;r<=8;r++)for(let f=0;f<8;f++){const sq=String.fromCharCode(97+f)+r,p=game.get(sq);if(p&&p.type==="p"&&p.color===color)pawns.push({sq,file:f,rank:r});}
  pawns.sort((a,b)=>color==="w"?b.rank-a.rank:a.rank-b.rank);
  for(const p of pawns){if(!game.get(p.sq))continue;let rank=p.rank;for(let n=0;n<distance;n++){const nr=rank+forward;if(nr<1||nr>8)break;const target=String.fromCharCode(97+p.file)+nr,occupant=game.get(target);if(occupant?.type==="k"&&occupant.color!==color)break;if(occupant&&occupant.color===color)break;if(occupant&&!capturePath)break;if(occupant)game.remove(target);game.remove(String.fromCharCode(97+p.file)+rank);if((color==="w"&&nr===8)||(color==="b"&&nr===1))game.put({type:"q",color},target);else game.put({type:"p",color},target);rank=nr;}}
}
function applyLocalRules(color){for(const r of activeRules){if(r.side===(color==="w"?"White":"Black")&&r.effect?.type==="pawn_rumble")applyLocalRumble(color,r.effect.distance||1,r.effect.capturePath!==false);}}
function botMove(){
  if(game.isGameOver()||game.turn()!=="b")return;
  $("botStatus").textContent="Thinking…";
  const moves=game.moves({verbose:true});
  if(!moves.length){endGame();return;}
  // Three local difficulty levels. Hard performs a shallow material search; all levels use legal chess moves.
  const value={p:100,n:320,b:330,r:500,q:900,k:20000};
  const evaluate=()=>{let score=0;for(let r=1;r<=8;r++)for(let f=0;f<8;f++){const p=game.get(String.fromCharCode(97+f)+r);if(p)score+=(p.color==="b"?1:-1)*value[p.type];}return score;};
  const ranked=moves.map(m=>{game.move({from:m.from,to:m.to,promotion:"q"});let score=0;if(botDifficulty>=2){score=evaluate();if(game.isCheckmate())score+=100000;else if(game.isCheck())score+=35;}if(botDifficulty>=3&&!game.isGameOver()){const replies=game.moves({verbose:true});let worst=Infinity;for(const reply of replies){game.move({from:reply.from,to:reply.to,promotion:"q"});const v=evaluate();worst=Math.min(worst,v);game.undo();}score=worst;}game.undo();return {m,score:score+Math.random()*(botDifficulty===1?1000:botDifficulty===2?18:4)};});
  ranked.sort((a,b)=>botDifficulty===1?Math.random()-.5:b.score-a.score);
  const choice=ranked[0].m, made=game.move({from:choice.from,to:choice.to,promotion:"q"});
  lastMove={from:made.from,to:made.to};applyLocalRules("w");$("botStatus").textContent="Ready";render();updatePanels();log(`Practice Bot moved ${pieceName(made.piece)} ${made.from} → ${made.to}.`);
  if(game.isGameOver())endGame();
}
function setTab(tab){
  document.querySelectorAll(".action-tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  $("movePane").classList.toggle("hidden",tab!=="move");$("motionPane").classList.toggle("hidden",tab!=="motion");
}
document.querySelectorAll(".action-tab").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
$("motionInput").addEventListener("input",()=>{$("charCount").textContent=$("motionInput").value.length+"/3000";});
function normalized(s){return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim();}
async function evaluateMotion(){
  const motion=$("motionInput").value.trim();if(!motion){toast("Describe your motion first.");return;}
  $("evaluateBtn").disabled=true;$("evaluateBtn").textContent="Referee is thinking…";
  try{
    if(!authToken) throw new Error("Playing offline against the bot: using the built-in referee.");
    const response=await fetch("/api/evaluate-motion",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+authToken},body:JSON.stringify({motion,fen:game.fen(),side:playerColor==="w"?"white":"black",activeRules,previousAttempts:attempts[normalized(motion)]||0})});
    if(!response.ok){const e=await response.json();throw new Error(e.error||"AI request failed.");}
    const result=await response.json();showEvaluation(motion,result);
  }catch(err){
    // A transparent local fallback lets the prototype be explored without an API key.
    const result=localReferee(motion);
    result.public_reasoning += " (Local demo estimate — connect an AI API for real adjudication.)";
    showEvaluation(motion,result);
    if(!err.message.includes("AI is not configured"))toast("Using demo referee: "+err.message);
  }finally{$("evaluateBtn").disabled=false;$("evaluateBtn").textContent="✦ Submit motion";}
}
function localReferee(motion){
  const words=motion.trim().split(/\s+/).length;
  const extreme=/instantly win|delete all|erase all|unlimited power|invincible/i.test(motion);
  const complex=/all|every|board|teleport|dragon|flood|king|queen|twice|automatic|transform|summon|rumbling/i.test(motion);
  const difficulty=extreme?20:Math.min(19,Math.max(6,7+Math.floor(words/8)+(complex?3:0)));
  return {status:"ready",interpretation:motion,difficulty,questions:[],public_reasoning:"This is a local demonstration estimate based on the wording and apparent scope of the motion. A connected AI referee can assess the board position and ask follow-up questions.",implementation_note:"This prototype records approved motions but does not yet alter the legal chess engine. The custom rule is descriptive only.",creativity_note:"Creativity will be judged across the complete match."};
}
function showEvaluation(motion,result){
  if(result.status==="reject"){refereeCard("Motion rejected",result.public_reasoning||"This motion conflicts with a fundamental match rule.",null);log("Referee rejected a motion.");return;}
  if(result.status==="clarify" && result.questions?.length){openClarification(motion,result);return;}
  pending={motion,result};refereeCard("Motion ready for confirmation",result.public_reasoning,result);
}
function refereeCard(title,reason,result){
  const c=$("refereeContent");c.innerHTML="";
  const card=document.createElement("div");card.className="evaluation-card";
  const h=document.createElement("h3");h.textContent=title;card.appendChild(h);
  const p=document.createElement("p");p.textContent=reason;card.appendChild(p);
  if(result){
    const d=document.createElement("div");d.className="difficulty";d.textContent=result.difficulty+"+";const sm=document.createElement("small");sm.textContent=" D20 REQUIRED";d.appendChild(sm);card.appendChild(d);
    const summary=document.createElement("div");summary.className="motion-summary";summary.textContent=result.interpretation;card.appendChild(summary);
    const note=document.createElement("p");note.textContent=result.implementation_note||"";card.appendChild(note);
    const actions=document.createElement("div");actions.className="evaluation-actions";
    const confirm=document.createElement("button");confirm.className="primary-btn";confirm.textContent="Confirm motion";confirm.onclick=()=>confirmMotion();actions.appendChild(confirm);
    const cancel=document.createElement("button");cancel.className="secondary-btn";cancel.textContent="Revise";cancel.onclick=()=>{pending=null;setTab("motion");$("motionInput").focus();};actions.appendChild(cancel);card.appendChild(actions);
  }
  c.appendChild(card);$("rollBtn").disabled=true;$("diceTitle").textContent=result?"Awaiting confirmation":"No roll pending";$("diceSub").textContent=result?`Need ${result.difficulty}+ on a D20.`:"Your die appears when a motion is ready.";
}
function openClarification(motion,result){
  const area=$("questionArea");area.innerHTML="";
  (result.questions||[]).forEach((q,i)=>{const wrap=document.createElement("div");wrap.className="question-field";const label=document.createElement("label");label.textContent=q;const input=document.createElement("input");input.placeholder="Your clarification…";input.id="clarify"+i;wrap.append(label,input);area.appendChild(wrap);});
  $("modalTitle").textContent="Clarify your motion";$("modalText").textContent="The referee needs a little more information before it can evaluate this motion.";
  $("continueModal").onclick=async()=>{
    const answers=[...area.querySelectorAll("input")].map((el,i)=>({question:result.questions[i],answer:el.value.trim()}));
    if(answers.some(a=>!a.answer)){toast("Please answer each clarification question.");return;}
    $("modalBackdrop").classList.add("hidden");
    const revised=motion+"\nClarifications: "+answers.map(a=>a.question+" "+a.answer).join("; ");
    $("motionInput").value=revised;$("charCount").textContent=revised.length+"/3000";
    await evaluateMotion();
  };
  $("cancelModal").onclick=()=>$("modalBackdrop").classList.add("hidden");
  $("modalBackdrop").classList.remove("hidden");
}
function confirmMotion(){
  if(!pending)return;
  $("rollBtn").disabled=false;$("diceTitle").textContent="Ready to roll";$("diceSub").textContent=`Roll ${pending.result.difficulty} or higher.`;
  $("die").classList.add("ready");$("die").textContent="D20";
  refereeCard("Motion confirmed",pending.result.public_reasoning,pending.result);
  const buttons=$("refereeContent").querySelectorAll("button");buttons[0].disabled=true;buttons[0].textContent="Confirmed";
  log(`Motion proposed: “${pending.motion}” — ${pending.result.difficulty}+ required.`);
}
$("rollBtn").addEventListener("click",rollDice);
function passMotionTurn(){
  const fields=game.fen().split(" ");
  fields[1]=fields[1]==="w"?"b":"w";
  game.load(fields.join(" "));
  selected=null;legalTargets=[];
  render();
}
function rollDice(){
  if(!pending)return;
  const motion=pending.motion,result=pending.result;
  if(onlineMatch){socket.emit("match:motion",{matchId:onlineMatch.id,motion,difficulty:result.difficulty,effect:result.effect,interpretation:result.interpretation});socket.emit("match:roll",{matchId:onlineMatch.id});$("rollBtn").disabled=true;$("diceTitle").textContent="Rolling on server…";return;}
  $("rollBtn").disabled=true;$("die").classList.add("rolling");
  let ticks=0;const interval=setInterval(()=>{
    $("die").textContent=String(1+Math.floor(Math.random()*20));ticks++;
    if(ticks>=14){clearInterval(interval);const roll=1+Math.floor(Math.random()*20);$("die").classList.remove("rolling");$("die").textContent=roll;const success=roll>=result.difficulty;
      $("diceTitle").textContent=success?"Motion succeeded!":"Motion failed";$("diceSub").textContent=`Rolled ${roll} · Needed ${result.difficulty}+`;
      $("die").classList.toggle("ready",success);$("die").style.color=success?"#477b4b":"#b45c51";
      if(success){
        activeRules.push({motion,interpretation:result.interpretation,implementation:result.implementation_note,side:playerColor==="w"?"White":"Black",effect:result.effect});
        if(result.effect?.type==="pawn_rumble")applyLocalRumble(playerColor,result.effect.distance||1,result.effect.capturePath!==false);
        renderRules();log(`SUCCESS — ${motion}`);
        toast("Motion succeeded. Rule added to match record.");
      }else{
        attempts[normalized(motion)]=(attempts[normalized(motion)]||0)+1;
        log(`FAILED — rolled ${roll}, needed ${result.difficulty}+. Your turn is lost.`);
        toast("Motion failed. Your turn is forfeited.");
      }
      passMotionTurn();
      pending=null;$("motionInput").value="";$("charCount").textContent="0/3000";
      $("refereeContent").innerHTML=`<div class="referee-empty"><div class="sparkle">${success?"✦":"◇"}</div><strong>${success?"Motion recorded":"Motion unsuccessful"}</strong><span>${success?"See Active motions for the match record.":"You may attempt this motion again on a future turn."}</span></div>`;
      if(!game.isGameOver())setTimeout(botMove,650);
    }
  },75);
}
function renderRules(){
  $("ruleCount").textContent=activeRules.length;const root=$("activeRules");root.innerHTML="";
  if(!activeRules.length){root.innerHTML='<div class="empty-rule">No custom rules established yet.</div>';return;}
  activeRules.forEach((r,i)=>{const item=document.createElement("div");item.className="rule-item";const icon=document.createElement("div");icon.className="rule-icon";icon.textContent="✦";const body=document.createElement("div");const strong=document.createElement("strong");strong.textContent=`Motion ${i+1} · ${r.side}`;const span=document.createElement("span");span.textContent=r.interpretation;body.append(strong,span);item.append(icon,body);root.appendChild(item);});
}
function updatePanels(){renderRules();}
function log(message){
  history.unshift(message);const root=$("history");root.innerHTML="";
  history.slice(0,12).forEach((entry,i)=>{const row=document.createElement("div");row.className="history-item";const time=document.createElement("span");time.className="history-time";time.textContent=String(history.length-i).padStart(2,"0");const txt=document.createElement("span");txt.className="history-text";txt.textContent=entry;row.append(time,txt);root.appendChild(row);});
}
function endGame(){const msg=game.isCheckmate()?"Checkmate. The practice game has ended.":game.isDraw()?"Draw.":"Game over.";log(msg);toast(msg);}
function toast(message){const t=$("toast");t.textContent=message;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2800);}
$("evaluateBtn").addEventListener("click",evaluateMotion);
$("flipBtn").addEventListener("click",()=>{flipped=!flipped;render();});
$("undoBtn").addEventListener("click",()=>{if(game.history().length){game.undo();if(game.turn()==="b"&&game.history().length)game.undo();lastMove=null;selected=null;legalTargets=[];render();log("Last turn undone.");}else toast("Nothing to undo.");});
$("newGameBtn").addEventListener("click",()=>{if(confirm("Start a new match? Current match history and motions will be cleared."))freshGame();});
freshGame();


// ACCOUNT + ONLINE MULTIPLAYER
const accountBackdrop=$("accountBackdrop");
function accountOpen(){accountBackdrop.classList.remove("hidden");if(currentUser)showLobby();}
function accountClose(){accountBackdrop.classList.add("hidden");}
$("accountBtn").onclick=accountOpen;$("authClose").onclick=accountClose;
$("themeBtn").onclick=()=>{themeDark=!themeDark;document.body.classList.toggle("theme-dark",themeDark);localStorage.setItem("motionChessTheme",themeDark?"dark":"light");$("themeBtn").textContent=themeDark?"☀ Light mode":"☾ Dark mode";};
$("themeBtn").textContent=themeDark?"☀ Light mode":"☾ Dark mode";
function showLobby(){ $("authFields").classList.add("hidden");document.querySelector(".account-modal> .modal-actions").classList.add("hidden");$("onlineLobby").classList.remove("hidden");$("profileLine").textContent=`♟ ${currentUser.username} · ${currentUser.gamesPlayed} games · ${currentUser.wins} wins · ${currentUser.survivalPoints} survival points`; }
function showAuth(){currentUser=null;authToken="";localStorage.removeItem("motionChessToken");$("authFields").classList.remove("hidden");document.querySelector(".account-modal> .modal-actions").classList.remove("hidden");$("onlineLobby").classList.add("hidden");if(socket){socket.disconnect();socket=null;}}
async function auth(action){const username=$("authUsername").value.trim(),password=$("authPassword").value;if(!username||!password){toast("Enter your username and password.");return;}try{const r=await fetch("/api/"+action,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});const d=await r.json();if(!r.ok)throw Error(d.error);authToken=d.token;currentUser=d.user;localStorage.setItem("motionChessToken",authToken);connectSocket();showLobby();toast(action==="register"?"Account created.":"Welcome back.");}catch(e){toast(e.message);}}
$("authLogin").onclick=()=>auth("login");$("authRegister").onclick=()=>auth("register");$("signOut").onclick=()=>{showAuth();toast("Signed out.");};
function connectSocket(){if(socket)socket.disconnect();socket=io({auth:{token:authToken}});socket.on("connect_error",e=>toast(e.message));socket.on("queue:waiting",()=>$("lobbyStatus").textContent="Searching for an opponent… keep this window open.");socket.on("room:created",d=>{$("lobbyStatus").textContent=`Private room created. Share code ${d.code} with your opponent.`;});socket.on("match:found",m=>{onlineMatch=m;playerColor=m.players.find(p=>p.id===currentUser.id)?.color||"w";applyOnlineState(m);accountClose();toast("Match found! You are "+(playerColor==="w"?"White":"Black")+".");});socket.on("match:state",m=>{if(onlineMatch&&m.id===onlineMatch.id)applyOnlineState(m);else if(!onlineMatch){onlineMatch=m;playerColor="spectator";applyOnlineState(m);accountClose();toast("Spectating live match.");}});socket.on("error:message",msg=>toast(msg));socket.on("motion:result",d=>{pending=null;$("die").textContent=d.roll;$("diceTitle").textContent=d.success?"Motion succeeded":"Motion failed";$("diceSub").textContent=`Rolled ${d.roll} · Needed ${d.pending.difficulty}+`;if(d.success){toast("Motion succeeded and added to the match rules.");}else toast("Motion failed; your turn is forfeited.");});}
function applyOnlineState(m){onlineMatch=m;try{game.load(m.fen);}catch{}activeRules=m.motions||[];renderRules();render();$("matchModeLabel").textContent=(m.status==="finished"?"MATCH FINISHED":"ONLINE MULTIPLAYER")+" · ROOM "+m.id;const me=m.players.find(p=>p.id===currentUser.id),opp=m.players.find(p=>p.id!==currentUser.id);if(playerColor!=="spectator")playerColor=me?.color||playerColor;$("myName").textContent=me?.username||currentUser.username;$("myMeta").textContent=(playerColor==="w"?"White":"Black")+" · YOU";$("opponentName").textContent=opp?.username||"Waiting for opponent";$("opponentMeta").textContent=opp?"Online opponent":"Share your room code";$("turnLabel").textContent=m.turn==="w"?"White":"Black";$("history").innerHTML="";(m.events||[]).slice().reverse().slice(0,12).forEach((e,i)=>{const row=document.createElement("div");row.className="history-item";row.textContent=e;$("history").appendChild(row)});}
$("quickMatch").onclick=()=>{socket?.emit("queue:join",{timeControl:"15+10",allowMotions:true});$("lobbyStatus").textContent="Joining matchmaking queue…";};
$("createRoom").onclick=()=>socket?.emit("room:create",{timeControl:"15+10",allowMotions:true});
$("customMatch").onclick=()=>{const tc=prompt("Time control (examples: 5+0, 10+5, 15+10):","10+5");if(tc===null)return;const allow=confirm("Allow motions in this match?");socket?.emit("room:create",{timeControl:tc,allowMotions:allow});};
$("watchMatches").onclick=async()=>{try{const r=await fetch("/api/active-matches",{headers:{Authorization:"Bearer "+authToken}});const d=await r.json();if(!d.matches.length){$("lobbyStatus").textContent="No active matches to spectate right now.";return;}const pick=prompt("Enter a match ID to spectate:\n"+d.matches.map(m=>`${m.id} — ${m.players.join(" vs ")} (${m.spectators} spectators)`).join("\n"),d.matches[0].id);if(pick)socket.emit("match:watch",pick.trim().toUpperCase());}catch(e){toast("Could not load active matches.");}};
async function openProfile(username=currentUser?.username){if(!username){accountOpen();toast("Sign in to view your online profile.");return;}try{const headers=authToken?{Authorization:"Bearer "+authToken}:{};const r=await fetch("/api/profile/"+encodeURIComponent(username),{headers});const d=await r.json();if(!r.ok)throw Error(d.error||"Could not load profile.");const u=d.user;$("profileAvatar").textContent=u.avatar||"♟";$("profileUsername").textContent=u.username;$("profileJoined").textContent="Motion Chess player · Personal match record";const stats=[["Games played",u.gamesPlayed],["Wins",u.wins],["Losses",u.losses],["Survival points",u.survivalPoints],["Creativity points",u.creativityPoints]];$("profileStats").innerHTML=stats.map(([label,value])=>`<div class="profile-stat"><span>${label}</span><strong>${value}</strong></div>`).join("");const matches=d.recentMatches||[];$("profileMatches").innerHTML=matches.length?matches.map(m=>`<div class="profile-match"><strong>Match ${m.id}</strong><span>${m.result?.reason||"Completed"} · ${new Date(m.result?.finishedAt||m.createdAt).toLocaleDateString()}</span></div>`).join(""):'<div class="profile-empty">No completed online matches yet. Your match history will appear here.</div>';$ ("profileScreen").classList.remove("hidden");accountClose();}catch(e){toast(e.message);}}
$("viewProfile").onclick=()=>openProfile();$("profileTopBtn").onclick=()=>openProfile();$("profileBack").onclick=()=>$("profileScreen").classList.add("hidden");
$("botGameBtn").onclick=()=>{const current=["Easy","Normal","Hard"][botDifficulty-1]||"Normal";const picked=prompt("Choose bot difficulty:\n1 = Easy\n2 = Normal\n3 = Hard",String(botDifficulty));if(picked===null)return;const n=Math.max(1,Math.min(3,Number(picked)||2));botDifficulty=n;localStorage.setItem("motionChessBotDifficulty",String(n));onlineMatch=null;playerColor="w";freshGame();$("matchModeLabel").textContent=`PRACTICE MATCH · ${["EASY","NORMAL","HARD"][n-1]} BOT`;$("opponentName").textContent=["Easy Bot","Normal Bot","Hard Bot"][n-1];$("botStatus").textContent="Ready";toast(`${["Easy","Normal","Hard"][n-1]} bot match started.`);};
$("joinRoom").onclick=()=>{const code=$("roomCode").value.trim();if(!code){toast("Enter a room code.");return;}socket?.emit("room:join",code);};
if(authToken){fetch("/api/me",{headers:{Authorization:"Bearer "+authToken}}).then(r=>r.ok?r.json():Promise.reject()).then(d=>{currentUser=d.user;connectSocket();}).catch(()=>showAuth());}
