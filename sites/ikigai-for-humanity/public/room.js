(function () {
  'use strict';
  const app=document.getElementById('app');
  const Core=window.IKIGAI_GAME;
  const categories=Core.categories.map(({key,label})=>[key,label]);
  const say=Core.notify;
  const KEY='ikigai-room-session-v2';
  const LEGACY_KEY='ikigai-room-session-v1';
  let sessionReady,roomCode,snapshot,timer;
  let busy=false,mutationVersion=0,refreshing=false,leaveConfirmation=false;
  let createAttempt=null;
  let selected={activityCategoryIndex:0};
  let drafts={activities:{},ideas:{}};

  const esc=Core.esc;
  const close=()=>'</div>';
  const activeCategories=config=>Core.activeCategories(config).map(({key,label})=>[key,label]);
  const shell=(note,navigation=roomCode?'leave':null)=>`<div class="shell"><header class="topbar"><button class="brand" data-room-action="${roomCode?'request-leave':'room-home'}" aria-label="Ikigai home"><span class="brand-mark">i</span>ikigai</button><div class="nav-actions"><span class="nav-note">${esc(note||'shared room')}</span>${navigation==='back'?'<button class="button reset-button" data-room-action="room-home">Back</button>':navigation==='leave'?'<button class="button reset-button" data-room-action="request-leave">Leave room</button>':''}</div></header>`;

  function readStored(){
    for(const key of [KEY,LEGACY_KEY]){try{const data=JSON.parse(localStorage.getItem(key));if(data?.roomCode)return data;}catch(_){}}
    return null;
  }
  function persist(){if(!roomCode)return;localStorage.setItem(KEY,JSON.stringify({roomCode,selected,drafts}));localStorage.removeItem(LEGACY_KEY);}
  function restoreLocal(code){const stored=readStored();if(stored?.roomCode===code){selected=stored.selected||{activityCategoryIndex:0};drafts=stored.drafts||{activities:{},ideas:{}};}else{selected={activityCategoryIndex:0};drafts={activities:{},ideas:{}};}}
  function roomUrl(code){const url=new URL(location.href);url.searchParams.set('room',code);return url;}
  function updateUrl(code){history.replaceState({},'',roomUrl(code));}
  function stripRoomUrl(){const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);}
  function stopWatching(){if(timer)clearInterval(timer);timer=null;}
  function clear(){localStorage.removeItem(KEY);localStorage.removeItem(LEGACY_KEY);roomCode=null;snapshot=null;selected={activityCategoryIndex:0};drafts={activities:{},ideas:{}};leaveConfirmation=false;stopWatching();stripRoomUrl();}

  async function request(options={}){
    let response;
    try{response=await fetch('/api/rooms',{credentials:'same-origin',cache:'no-store',...options});}
    catch(_){throw new Error('Could not connect. Check your internet connection and try again.');}
    const result=await response.json().catch(()=>null);
    if(!response.ok||result?.error)throw new Error(result?.error?.message||'The room connection is unavailable. Please try again.');
    return result;
  }
  async function setup(){if(!sessionReady)sessionReady=request().catch(error=>{sessionReady=null;throw error;});return sessionReady;}
  async function rpc(name,args,requestId){await setup();const result=await request({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,args,requestId})});return result.data;}

  function snapshotSignature(value){return JSON.stringify(value||null);}
  async function refresh(quiet=false,force=false){
    if(!roomCode||(!force&&(busy||refreshing)))return;
    const version=mutationVersion,code=roomCode;refreshing=true;
    try{
      const next=await rpc('ikigai_room_snapshot',{p_code:code});
      if(code!==roomCode||(!force&&(busy||version!==mutationVersion)))return;
      if(snapshotSignature(next)===snapshotSignature(snapshot))return;
      snapshot=next;if(!leaveConfirmation)render(true);
    }catch(error){
      if(code!==roomCode)return;
      if(/Join this room first|not found|expired/i.test(error.message)){stopWatching();roomCode=null;snapshot=null;renderJoin(code);if(!/Join this room first/i.test(error.message))say(error.message);}
      else if(!quiet){say(error.message);if(!snapshot)renderReconnect();}
    }finally{refreshing=false;}
  }

  async function watch(){
    if(!roomCode)return;
    restoreLocal(roomCode);persist();updateUrl(roomCode);
    stopWatching();timer=setInterval(()=>{if(!document.hidden)refresh(true);},1500);
    await refresh(false,true);
  }

  async function act(name,args){
    if(busy)return false;
    busy=true;mutationVersion++;render(true);
    try{await rpc(name,args);busy=false;await refresh(false,true);return true;}
    catch(error){busy=false;say(error.message);render(true);return false;}
  }

  const configFor=()=>({...Core.readSettings('room'),playerCount:Number(document.getElementById('room-player-count').value)});

  function renderHome(){app.innerHTML=shell('a gentle game for imagining work',null)+`<section class="hero"><div class="hero-copy"><div><h1>What could your work become?</h1><p class="lead">Draft the ingredients that feel most like you. Then let your friends imagine real, surprising paths forward together.</p><p class="helper">Host a room, share the link, and everyone can play on their own phone.</p><div class="actions"><button class="button coral" data-room-action="host">Host a room</button><button class="button quiet" data-room-action="join">Join a room</button></div></div><aside class="hero-aside"><strong>2–8 friends · flexible pace</strong>Go practical, go strange, or go both. Offer a possibility, not a prescription.</aside></div>${Core.categoryStrip()}</section>`+close();}
  function renderHost(){app.innerHTML=shell('set up a shared room','back')+`<section class="screen-head"><h2>Invite your curious people.</h2><p class="lead">Create a room, then share its link with your friends. Everyone writes on their own device.</p></section><section class="panel"><label class="field-label" for="room-host-name">Your name</label><input id="room-host-name" type="text" maxlength="24" placeholder="e.g. Ari" autocomplete="given-name" autofocus><label class="field-label" for="room-title">What should we call this gathering?</label><input id="room-title" type="text" maxlength="48" value="Career Possibilities">${Core.settingsMarkup('room')}<label class="field-label" for="room-player-count">Number of players</label><select id="room-player-count">${Array.from({length:7},(_,i)=>`<option value="${i+2}" ${i===2?'selected':''}>${i+2} players</option>`).join('')}</select><div class="form-foot"><p class="helper">Deep uses three activities per active category and two rounds. Quick uses three and one round. Custom categories with zero prompt cards are skipped during setup.</p><button class="button primary" data-room-action="create">Create room →</button></div></section>`+close();}
  function renderJoin(code=''){app.innerHTML=shell('join a shared room','back')+`<section class="screen-head"><h2>${code?'Your friends are waiting.':'Enter your host’s room code.'}</h2><p class="lead">${code?'Enter your name to join the room.':'Ask your host for the six-character code, then enter your name.'}</p></section><section class="panel"><label class="field-label" for="join-name">Your name</label><input id="join-name" type="text" maxlength="24" placeholder="e.g. Sam" autocomplete="given-name" autofocus><label class="field-label" for="join-code">Room code</label><input id="join-code" type="text" maxlength="6" placeholder="ABC123" value="${esc(code)}" autocapitalize="characters" autocomplete="off" spellcheck="false" style="text-transform:uppercase"><div class="form-foot"><p class="helper">Use the same browser to reconnect after the game starts.</p><button class="button primary" data-room-action="enter">Join room →</button></div></section>`+close();}
  function renderLeaveConfirm(){app.innerHTML=shell(`ROOM ${roomCode}`,null)+`<section class="handoff-cover"><div class="eyebrow">leave this room?</div><h2>Your seat may still be needed.</h2><p class="lead">Stay if the game is active. Reloading is safe; deliberately leaving removes this device’s quick reconnect link.</p><div class="actions"><button class="button quiet" data-room-action="stay-room">Stay in room</button><button class="button coral" data-room-action="confirm-leave">Leave anyway</button></div></section>`+close();}
  function renderReconnect(){app.innerHTML=shell(`ROOM ${roomCode}`)+`<section class="screen-head"><h2>Reconnect to your room.</h2><p class="lead">Your unfinished writing is still saved on this device. Check your connection, then try again.</p></section><section class="panel"><div class="room-code">ROOM ${esc(roomCode)}</div><button class="button primary" data-room-action="retry-room">Try again</button></section>`+close();}

  function renderLobby(){
    const {room,players}=snapshot;const enough=players.length===room.config.playerCount;
    app.innerHTML=shell(`ROOM ${room.code}`)+`<section class="screen-head"><div class="room-code">ROOM ${room.code}</div><div class="eyebrow">waiting room</div><h2>${esc(room.title)}</h2><p class="lead">Share this room code or link. Once all ${room.config.playerCount} people are here, the host opens the activity stage.</p></section><section class="panel"><div class="pass-card"><span><small>Share this link</small><br><b id="room-link">${esc(roomUrl(room.code).toString())}</b></span><button class="button quiet" data-room-action="copy-link">Copy</button></div><div class="config-recap">${esc(Core.configSummary(room.config))}</div><div class="stack-list">${players.map(player=>`<div class="pass-card"><span><b>${esc(player.name)}</b>${player.id===snapshot.me.id?' <small>(you)</small>':''}</span><span class="pill">ready</span></div>`).join('')}</div><div class="form-foot">${room.isHost?`<p class="helper">${enough?'Everyone is here.':`Waiting for ${room.config.playerCount-players.length} more.`}</p><button class="button coral" data-room-action="start-room" ${enough&&!busy?'':'disabled'}>${busy?'Opening…':'Open activity stage →'}</button>`:'<p class="helper">Waiting for the host to open the activity stage…</p>'}</div></section>`+close();
  }

  function activityDraftKey(key,index){return `${key}:${index}`;}
  function renderOwnActivities(config){
    const count=config.itemsPerCategory;const active=activeCategories(config);
    return active.map(([key,label])=>`<section class="activity-inputs"><h3>${label}</h3>${Array.from({length:count},(_,i)=>`<label class="field-label" for="own-${key}-${i}">${label} activity ${i+1}</label><input class="room-own" id="own-${key}-${i}" type="text" data-category="${key}" data-ordinal="${i+1}" maxlength="80" value="${esc(drafts.activities[activityDraftKey(key,i+1)]||'')}" placeholder="e.g. Exploring local food markets">`).join('')}</section>`).join('');
  }

  function visibleCardMarkup(key,label,count){
    const picks=selected[key]||[];const cards=window.CARD_LIBRARY?.[key]||[];
    return `<div class="activity-browser"><label class="field-label" for="room-card-search">Search or browse suggestions</label><input id="room-card-search" type="text" placeholder="Search ${esc(label.toLowerCase())}…"><p class="helper">Showing 24 suggestions. Search to explore the full deck.</p><div class="card-grid room-card-grid">${cards.map((title,i)=>{const token=`${key}:${i}`;const hidden=i>=24&&!picks.includes(token);return `<button class="activity-card ${key}" data-room-card="${token}" data-card-title="${esc(title.toLowerCase())}" ${hidden?'hidden':''}><span class="card-dot"></span><span class="category">${label}</span><span class="title">${esc(title)}</span></button>`;}).join('')}</div></div>`;
  }

  function renderPremadeActivities(config){
    const active=activeCategories(config);selected.activityCategoryIndex=Math.min(selected.activityCategoryIndex||0,active.length-1);const [key,label]=active[selected.activityCategoryIndex];const count=config.itemsPerCategory;const n=(selected[key]||[]).length;const last=selected.activityCategoryIndex===active.length-1;
    return `<div class="activity-step-nav"><span class="pill">Category ${selected.activityCategoryIndex+1} of ${active.length}</span><strong>${label}</strong><span id="picked-${key}">${n} / ${count}</span></div>${visibleCardMarkup(key,label,count)}<div class="selection-bar"><p id="selection-summary"><b>${n} of ${count}</b> selected for ${label.toLowerCase()}</p><div class="actions compact-actions">${selected.activityCategoryIndex?'<button class="button quiet small" data-room-action="previous-room-category">Back</button>':''}<button class="button primary small" data-category-continue data-room-action="${last?'submit-activities':'next-room-category'}" ${n===count&&!busy?'':'disabled'}>${busy?'Saving…':last?'Save my activity cards →':'Next category →'}</button></div></div>`;
  }

  function renderActivities(){
    const {room,me,players}=snapshot;const done=me.activitiesReady;const everyone=players.every(player=>player.activitiesReady);
    if(done){const hostControl=room.isHost?`<button class="button coral" data-room-action="begin-game" ${everyone&&!busy?'':'disabled'}>${busy?'Starting…':'Begin round one →'}</button><p class="helper">${everyone?'Everyone is ready.':'Wait for everyone to finish.'}</p>`:`<p class="helper">${everyone?'The host can begin round one now.':'Waiting for the other decks…'}</p>`;app.innerHTML=shell(`ROOM ${room.code}`)+`<section class="screen-head"><div class="eyebrow">activity cards saved</div><h2>Nice. Your deck is ready.</h2><p class="lead">Your submitted deck is safe on the server. You can reload and return to this waiting screen.</p></section><section class="panel"><div class="stack-list">${players.map(player=>`<div class="pass-card"><span><b>${esc(player.name)}</b></span><span class="pill">${player.activitiesReady?'ready':'writing'}</span></div>`).join('')}</div><div class="form-foot">${hostControl}</div></section>`+close();return;}
    const own=room.config.source==='own';const active=activeCategories(room.config);const content=own?renderOwnActivities(room.config):renderPremadeActivities(room.config);
    app.innerHTML=shell(`ROOM ${room.code}`)+`<section class="screen-head"><div class="eyebrow">stage 1 · your activity cards</div><h2>${own?'Write':'Choose'} what belongs in your life.</h2><p class="lead">${own?'Create':'Choose'} ${Core.countLabel(room.config.itemsPerCategory,'activity')} in each of ${Core.countLabel(active.length,'active category')}. Unfinished work is saved on this device and server refreshes will not clear it.</p></section><section class="panel">${content}${own?`<div class="form-foot"><p class="helper">Only categories used by the prompt are included.</p><button class="button primary" data-room-action="submit-activities" ${busy?'disabled':''}>${busy?'Saving…':'Save my activity cards →'}</button></div>`:''}</section>`+close();
    updatePicks();
  }

  function updatePicks(){
    if(!snapshot||snapshot.room.config.source!=='premade')return;
    const active=activeCategories(snapshot.room.config);const [key]=active[selected.activityCategoryIndex||0];const count=snapshot.room.config.itemsPerCategory;const picks=selected[key]||[];const atLimit=picks.length>=count;
    const label=document.getElementById(`picked-${key}`);if(label)label.textContent=`${picks.length} / ${count}`;
    const summary=document.getElementById('selection-summary');if(summary)summary.innerHTML=`<b>${picks.length} of ${count}</b> selected for ${categories.find(([candidate])=>candidate===key)?.[1].toLowerCase()}`;
    const continueButton=document.querySelector('[data-category-continue]');if(continueButton)continueButton.disabled=picks.length!==count||busy;
    document.querySelectorAll(`[data-room-card^="${key}:"]`).forEach(node=>{const chosen=picks.includes(node.dataset.roomCard);node.classList.toggle('selected',chosen);node.setAttribute('aria-pressed',String(chosen));node.disabled=!chosen&&atLimit;});
  }

  function renderTurn(){
    const {room,turn}=snapshot;if(!turn)return;const isTarget=turn.isTarget,waiting=turn.status==='submitting',voting=turn.status==='voting',result=turn.status==='result';const single=turn.neededCount===1;let body;
    if(waiting&&isTarget)body=`<section class="panel"><div class="prompt-cards">${turn.cards.map(card=>`<span class="prompt-card ${card.category}"><i></i>${esc(card.title)}</span>`).join('')}</div><h3>${single?'Your friend is writing.':'Your friends are writing.'}</h3><p class="lead">Ideas will appear together when everyone is ready. Submission timing is hidden to protect author privacy.</p></section>`;
    else if(waiting){
      const ideaDraft=drafts.ideas[turn.id]||'';
      body=turn.mySubmitted?`<section class="panel"><h3>Your idea is sealed.</h3><p class="lead">It is safely submitted. Waiting for ${single?esc(turn.targetName):'the other friends'}…</p></section>`:`<section class="panel"><div class="prompt-cards">${turn.cards.map(card=>`<span class="prompt-card ${card.category}"><i></i>${esc(card.title)}</span>`).join('')}</div><label class="field-label" for="room-idea">What could ${esc(turn.targetName)}’s ideal career look like?</label><textarea id="room-idea" maxlength="700" placeholder="An ideal career could be…">${esc(ideaDraft)}</textarea><div class="form-foot"><p class="helper">Your unfinished idea stays on this device until the server confirms it is sealed.</p><button class="button primary" data-room-action="submit-idea" ${busy?'disabled':''}>${busy?'Sealing…':'Seal my idea →'}</button></div></section>`;
    }else if(voting&&isTarget){
      if(single){const option=turn.options[0];body=`<section class="panel"><div class="eyebrow">an idea from your friend</div><h2>${esc(option?.body||'')}</h2><p class="lead">In a two-player room the author is naturally known, so there is no artificial vote.</p><div class="form-foot"><button class="button coral" data-room-action="accept-room-path" ${busy||!option?'disabled':''}>${busy?'Saving…':'Continue with this path →'}</button></div></section>`;}
      else body=`<section class="idea-grid">${turn.options.map(option=>`<button class="vote-card ${selected.vote===option.id?'selected':''}" data-room-vote="${option.id}" aria-pressed="${selected.vote===option.id}"><span class="kind-label">ideal career · anonymous author</span><p>${esc(option.body)}</p></button>`).join('')}</section><div class="actions" style="justify-content:center"><button class="button coral" data-room-action="cast-vote" ${selected.vote&&!busy?'':'disabled'}>${busy?'Saving…':'Choose this path →'}</button></div>`;
    }else if(voting)body=`<section class="panel"><h3>${esc(turn.targetName)} is reflecting.</h3><p class="lead">${single?`${esc(turn.targetName)} is reading your idea.`:`All ideas are in. Only ${esc(turn.targetName)} can see and choose among the shuffled possibilities.`}</p></section>`;
    else if(result&&isTarget){const keepIds=keptIdeaIds(turn);body=`<section class="panel reflection"><div><div class="prompt-cards">${turn.cards.map(card=>`<span class="prompt-card ${card.category}"><i></i>${esc(card.title)}</span>`).join('')}</div><div class="stack-list">${turn.options.map(option=>`<div class="reflect-item"><input id="keep-${option.id}" data-room-keep="${option.id}" type="checkbox" ${keepIds.includes(option.id)?'checked':''} ${busy?'disabled':''}><label for="keep-${option.id}">${esc(option.body)}<span class="score">${option.chosen?'Chosen path':'Idea bank unless checked'}</span></label></div>`).join('')}</div></div><aside class="reflection-side"><h3>Take what fits.</h3><p>Your chosen path is already checked. Keep any others that still feel alive; everything else remains in your Idea bank.</p><button class="button coral" data-room-action="save-turn" ${busy?'disabled':''}>${busy?'Saving…':'Save my stacks →'}</button></aside></section>`;}
    else body=`<section class="panel"><h3>${esc(turn.targetName)} is reflecting.</h3><p class="lead">Their selected path will appear in the shared recap when the table is complete.</p></section>`;
    app.innerHTML=shell(`ROOM ${room.code}`)+`<section class="screen-head"><div class="eyebrow">table round ${turn.tableRound} of ${room.config.roundCount} · ${esc(turn.targetName)}’s turn</div><h2>${waiting&&!isTarget?`Write an idea for ${esc(turn.targetName)}.`:isTarget&&result?'What do you want to keep exploring?':isTarget&&voting?(single?'Reflect on your friend’s idea.':'Which path feels most real?'):`Make space for ${esc(turn.targetName)}.`}</h2><p class="lead">${waiting&&!isTarget?'Write at your own pace. Your draft will stay put.':isTarget&&result?'These are gentle invitations, not final answers. You get the final say.':single?'One friend contributes one path in this two-player room.':'Ideas are shuffled before the active player chooses.'}</p></section>${body}`+close();
  }

  function keptIdeaIds(turn){return selected.keepTurn===turn.id&&Array.isArray(selected.keepIds)?selected.keepIds:turn.options.filter(option=>option.keep||option.chosen).map(option=>option.id);}
  function resultCollections(){const collections=new Map();for(const result of snapshot.results||[]){if(!collections.has(result.targetName))collections.set(result.targetName,{name:result.targetName,keep:[],bank:[]});const player=collections.get(result.targetName);for(const idea of result.ideas||[])(idea.keep?player.keep:player.bank).push(idea);}return [...collections.values()];}
  function resultsSummary(){return `${snapshot.room.title}\n\n`+resultCollections().map(player=>`${player.name}\nKeep exploring\n${player.keep.map(idea=>`- ${idea.body}`).join('\n')||'- None'}\n\nIdea bank\n${player.bank.map(idea=>`- ${idea.body}`).join('\n')||'- None'}`).join('\n\n');}
  function renderComplete(){const room=snapshot.room;const collections=resultCollections();app.innerHTML=shell(`ROOM ${room.code}`)+`<section class="screen-head"><div class="eyebrow">your table is complete</div><h2>Keep what feels alive.</h2><p class="lead">Your complete group summary is saved for 30 days. Copy the recap to keep it.</p></section><section class="ending-grid">${collections.map(player=>`<article class="player-stack"><h3>${esc(player.name)}</h3><div class="eyebrow" style="margin-bottom:9px">keep exploring · ${player.keep.length}</div><div class="stack-list">${player.keep.length?player.keep.map(idea=>`<div class="stack-item">${esc(idea.body)}</div>`).join(''):'<p class="empty">Nothing pinned yet. Every idea remains in the bank.</p>'}</div><div class="eyebrow" style="margin:20px 0 9px">idea bank · ${player.bank.length}</div><div class="stack-list">${player.bank.length?player.bank.map(idea=>`<div class="stack-item">${esc(idea.body)}</div>`).join(''):'<p class="empty">Every idea is in Keep exploring.</p>'}</div></article>`).join('')}</section><div class="actions" style="justify-content:center"><button class="button quiet" data-room-action="copy-room-summary">Copy table recap</button><button class="button coral" data-room-action="confirm-leave">Done</button></div>`+close();}

  function render(preserve=false){
    const scrollY=window.scrollY;const activeId=document.activeElement?.id;const selectionStart=document.activeElement?.selectionStart;
    if(!snapshot)return renderHome();
    if(snapshot.room.status==='lobby')renderLobby();else if(snapshot.room.status==='activities')renderActivities();else if(snapshot.room.status==='playing')renderTurn();else renderComplete();
    requestAnimationFrame(()=>{
      if(preserve){window.scrollTo(0,scrollY);if(activeId){const node=document.getElementById(activeId);node?.focus();if(Number.isInteger(selectionStart)&&node?.setSelectionRange)node.setSelectionRange(selectionStart,selectionStart);}}
      else window.scrollTo({top:0,left:0,behavior:'instant'});
    });
  }

  function setEntryBusy(action,label){const button=document.querySelector(`[data-room-action="${action}"]`);if(button){button.disabled=busy;button.textContent=label;}}
  async function create(){
    if(busy)return;
    const name=document.getElementById('room-host-name').value.trim(),title=document.getElementById('room-title').value.trim(),config=configFor();
    if(!name)return say('Enter your name.');const error=Core.validateSettings(config);if(error)return say(error);
    const args={p_name:name,p_title:title,p_config:config};const signature=JSON.stringify(args);if(createAttempt?.signature!==signature)createAttempt={signature,id:crypto.randomUUID()};
    busy=true;mutationVersion++;setEntryBusy('create','Creating…');
    try{const data=await rpc('create_ikigai_room',args,createAttempt.id);const code=data?.[0]?.code||data?.code;if(!code)throw new Error('The room could not be created. Please try again.');createAttempt=null;roomCode=code;selected={activityCategoryIndex:0};drafts={activities:{},ideas:{}};busy=false;await watch();}
    catch(error){say(error.message);}
    finally{busy=false;setEntryBusy('create','Create room →');}
  }
  async function join(){
    if(busy)return;
    const name=document.getElementById('join-name').value.trim(),code=document.getElementById('join-code').value.trim().toUpperCase();
    if(!name||!code)return say('Enter your name and room code.');if(!/^[A-Z0-9]{6}$/.test(code))return say('Enter the six-character code from your host.');
    busy=true;mutationVersion++;setEntryBusy('enter','Joining…');
    try{await rpc('join_ikigai_room',{p_code:code,p_name:name});roomCode=code;busy=false;await watch();}
    catch(error){say(error.message);}
    finally{busy=false;setEntryBusy('enter','Join room →');}
  }

  async function saveActivities(){
    const config=snapshot.room.config;const active=activeCategories(config);let activities=[];
    if(config.source==='own'){
      activities=active.flatMap(([key])=>Array.from({length:config.itemsPerCategory},(_,i)=>({category:key,ordinal:i+1,title:(drafts.activities[activityDraftKey(key,i+1)]||'').trim()})));
      if(activities.some(activity=>activity.title.length<2))return say('Write every activity before continuing.');
      const duplicate=active.some(([key])=>{const titles=activities.filter(activity=>activity.category===key).map(activity=>activity.title.toLowerCase());return new Set(titles).size!==titles.length;});if(duplicate)return say('Make each activity distinct within its category.');
    }else{
      for(const [key] of active){const picks=selected[key]||[];if(picks.length!==config.itemsPerCategory)return say(`Choose ${Core.countLabel(config.itemsPerCategory,'card')} for every active category.`);picks.forEach((token,i)=>activities.push({category:key,ordinal:i+1,title:window.CARD_LIBRARY[key][Number(token.split(':')[1])]}));}
    }
    const success=await act('submit_ikigai_activities',{p_code:roomCode,p_activities:activities});if(success){drafts.activities={};persist();}
  }

  async function submitIdea(){const turn=snapshot.turn;const body=(drafts.ideas[turn.id]||'').trim();if(body.length<12)return say('Write a little more so the idea has room to breathe.');const success=await act('submit_ikigai_idea',{p_turn_id:turn.id,p_body:body});if(success){delete drafts.ideas[turn.id];persist();}}
  async function saveTurn(){const turnId=snapshot.turn.id;const keepIds=keptIdeaIds(snapshot.turn);const completed=await act('complete_ikigai_turn',{p_turn_id:turnId,p_keep_ids:keepIds});if(completed){selected.vote=null;delete selected.keepTurn;delete selected.keepIds;persist();say('Turn saved to the table recap.');}}
  function localHome(){clear();window.IkigaiRoom.active=false;window.IkigaiLocalRender?.();}
  function roomHome(){clear();renderHome();}

  document.addEventListener('click',async event=>{
    const node=event.target.closest('[data-room-action], [data-room-card], [data-room-vote]');if(!node)return;
    if(busy)return;
    if(node.dataset.roomCard){const [key]=node.dataset.roomCard.split(':');const list=selected[key]||[];if(list.includes(node.dataset.roomCard))selected[key]=list.filter(token=>token!==node.dataset.roomCard);else if(list.length<snapshot.room.config.itemsPerCategory)selected[key]=[...list,node.dataset.roomCard];else return say(`Choose only ${Core.countLabel(snapshot.room.config.itemsPerCategory,'card')} in this category.`);persist();updatePicks();return;}
    if(node.dataset.roomVote){selected.vote=node.dataset.roomVote;persist();render();return;}
    const action=node.dataset.roomAction;
    if(action==='host')return renderHost();if(action==='join')return renderJoin();if(action==='local-home')return localHome();if(action==='room-home')return roomHome();
    if(action==='request-leave'){leaveConfirmation=true;return renderLeaveConfirm();}if(action==='stay-room'){leaveConfirmation=false;return render();}if(action==='confirm-leave')return roomHome();
    if(action==='retry-room')return watch();
    if(action==='create')return create();if(action==='enter')return join();
    if(action==='start-room')return act('start_ikigai_room',{p_code:roomCode});
    if(action==='previous-room-category'){selected.activityCategoryIndex--;persist();render();return;}
    if(action==='next-room-category'){selected.activityCategoryIndex++;persist();render();return;}
    if(action==='submit-activities')return saveActivities();
    if(action==='begin-game')return act('begin_ikigai_game',{p_code:roomCode});
    if(action==='submit-idea')return submitIdea();
    if(action==='accept-room-path'){const option=snapshot.turn.options[0];if(option)return act('cast_ikigai_vote',{p_turn_id:snapshot.turn.id,p_idea_id:option.id});}
    if(action==='cast-vote')return act('cast_ikigai_vote',{p_turn_id:snapshot.turn.id,p_idea_id:selected.vote});
    if(action==='save-turn')return saveTurn();
    if(action==='copy-link')return Core.copyText(roomUrl(roomCode).toString()).then(copied=>say(copied?'Room link copied.':`Share room code ${roomCode}.`));
    if(action==='copy-room-summary')return Core.copyText(resultsSummary()).then(copied=>say(copied?'Table recap copied.':'Clipboard access is unavailable.'));
  });

  document.addEventListener('input',event=>{
    const node=event.target;
    if(node.matches('.room-own')){drafts.activities[activityDraftKey(node.dataset.category,Number(node.dataset.ordinal))]=node.value;persist();}
    if(node.id==='room-idea'&&snapshot?.turn){drafts.ideas[snapshot.turn.id]=node.value;persist();}
    if(node.id==='room-card-search'){
      const query=node.value.trim().toLowerCase();document.querySelectorAll('[data-card-title]').forEach((card,index)=>{const chosen=card.classList.contains('selected');card.hidden=!!query?!card.dataset.cardTitle.includes(query):index>=24&&!chosen;});
    }
  });
  document.addEventListener('change',event=>{const node=event.target;if(node.id==='room-mode')Core.syncModeForm('room');if(node.dataset.roomKeep&&snapshot?.turn){selected.keepTurn=snapshot.turn.id;selected.keepIds=[...document.querySelectorAll('[data-room-keep]:checked')].map(input=>input.dataset.roomKeep);persist();}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&roomCode)refresh(true);});

  window.IkigaiRoom={openHost:()=>{clear();renderHost();},openJoin:code=>{clear();if(code)updateUrl(code);renderJoin(code);},open:roomHome,resume:async code=>{roomCode=code;try{await setup();await watch();}catch(error){say(error.message);renderReconnect();}},active:false};
  const stored=readStored();const linkedCode=new URLSearchParams(location.search).get('room')?.trim().toUpperCase();
  if(linkedCode&&linkedCode!==stored?.roomCode){renderJoin(linkedCode);}
  else if(linkedCode||stored?.roomCode)window.IkigaiRoom.resume((linkedCode||stored.roomCode).toUpperCase());
  else renderHome();
}());
