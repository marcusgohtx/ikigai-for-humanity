(function () {
  'use strict';
  const app=document.getElementById('app');
  const Core=window.IKIGAI_GAME;
  const categories=Core.categories.map(({key,label})=>[key,label]);
  const say=Core.notify;
  const KEY='ikigai-room-session-v2';
  const LEGACY_KEY='ikigai-room-session-v1';
  let client,roomCode,snapshot,channel,timer;
  let channelReady=false,busy=false,mutationVersion=0;
  let selected={activityCategoryIndex:0};
  let drafts={activities:{},ideas:{}};

  const esc=Core.esc;
  const close=()=>'</div>';
  const activeCategories=config=>Core.activeCategories(config).map(({key,label})=>[key,label]);
  const shell=(note,navigation=roomCode?'leave':null)=>`<div class="shell"><header class="topbar"><button class="brand" data-room-action="${roomCode?'request-leave':'local-home'}"><span class="brand-mark">i</span>ikigai</button><div class="nav-actions"><span class="nav-note">${esc(note||'shared room')}</span>${navigation?'<button class="button reset-button" data-room-action="request-leave">Leave room</button>':''}</div></header>`;

  function readStored(){
    for(const key of [KEY,LEGACY_KEY]){try{const data=JSON.parse(localStorage.getItem(key));if(data?.roomCode)return data;}catch(_){}}
    return null;
  }
  function persist(){if(!roomCode)return;localStorage.setItem(KEY,JSON.stringify({roomCode,selected,drafts}));localStorage.removeItem(LEGACY_KEY);}
  function restoreLocal(code){const stored=readStored();if(stored?.roomCode===code){selected=stored.selected||{activityCategoryIndex:0};drafts=stored.drafts||{activities:{},ideas:{}};}else{selected={activityCategoryIndex:0};drafts={activities:{},ideas:{}};}}
  function roomUrl(code){const url=new URL(location.href);url.searchParams.set('room',code);return url;}
  function updateUrl(code){history.replaceState({},'',roomUrl(code));}
  function stripRoomUrl(){const url=new URL(location.href);url.searchParams.delete('room');history.replaceState({},'',url);}
  function clear(){localStorage.removeItem(KEY);localStorage.removeItem(LEGACY_KEY);roomCode=null;snapshot=null;selected={activityCategoryIndex:0};drafts={activities:{},ideas:{}};if(timer)clearInterval(timer);timer=null;if(channel){client?.removeChannel(channel);channel=null;}channelReady=false;stripRoomUrl();}

  async function setup(){
    if(client)return client;
    if(!window.supabase||!window.IKIGAI_SUPABASE)throw new Error('The room connection is unavailable.');
    client=window.supabase.createClient(window.IKIGAI_SUPABASE.url,window.IKIGAI_SUPABASE.publishableKey);
    const {data:{session}}=await client.auth.getSession();
    if(!session){const {error}=await client.auth.signInAnonymously();if(error)throw new Error('Enable Anonymous Sign-Ins in Supabase, then try again.');}
    return client;
  }
  async function rpc(name,args){await setup();const {data,error}=await client.rpc(name,args);if(error)throw new Error(error.message);return data;}
  async function broadcast(){if(!channel||!channelReady)return;try{await channel.send({type:'broadcast',event:'changed',payload:{}});}catch(_){}}

  function snapshotSignature(value){return JSON.stringify(value||null);}
  async function refresh(quiet=false,force=false){
    if(!roomCode||(!force&&busy))return;
    const version=mutationVersion;
    try{
      const next=await rpc('ikigai_room_snapshot',{p_code:roomCode});
      if(!force&&(busy||version!==mutationVersion))return;
      if(snapshotSignature(next)===snapshotSignature(snapshot))return;
      snapshot=next;render(true);
    }catch(error){if(!quiet)say(error.message);if(!snapshot){clear();renderHome();}}
  }

  async function watch(){
    if(!roomCode)return;
    restoreLocal(roomCode);persist();updateUrl(roomCode);
    if(timer)clearInterval(timer);timer=setInterval(()=>refresh(true),8000);
    if(channel)client.removeChannel(channel);
    channelReady=false;
    channel=client.channel(`ikigai-room-${roomCode}`,{config:{broadcast:{ack:true}}}).on('broadcast',{event:'changed'},()=>refresh(true)).subscribe(status=>{channelReady=status==='SUBSCRIBED';});
    await refresh(false,true);
  }

  async function act(name,args){
    if(busy)return false;
    busy=true;mutationVersion++;render(true);
    try{await rpc(name,args);busy=false;await broadcast();await refresh(false,true);return true;}
    catch(error){busy=false;say(error.message);render(true);return false;}
  }

  const configFor=()=>({...Core.readSettings('room'),playerCount:Number(document.getElementById('room-player-count').value)});

  function renderHome(){app.innerHTML=shell('a shared game for imagining work',null)+`<section class="hero"><div class="hero-copy"><div><div class="eyebrow">play together, from anywhere</div><h1>Make a life with your friends.</h1><p class="lead">Host a room, share its code, and let everyone write from their own phone. Unfinished drafts stay on each device, and completed paths return in a shared recap.</p><div class="actions"><button class="button coral" data-room-action="host">Host a room</button><button class="button quiet" data-room-action="join">Join a room</button><button class="button quiet" data-room-action="local-home">Use one device instead</button></div></div><aside class="hero-aside"><strong>2–8 friends · live room</strong>Two-player rooms use an honest friend-to-friend reflection. With three or more players, idea order is randomized.</aside></div>${Core.categoryStrip()}</section>`+close();}
  function renderHost(){app.innerHTML=shell('set up a shared room','back')+`<section class="screen-head"><div class="eyebrow">host a room</div><h2>Invite your curious people.</h2><p class="lead">The room link stays in the address bar, so reloads and mobile browser restarts can reconnect automatically.</p></section><section class="panel"><label class="field-label" for="room-host-name">Your name</label><input id="room-host-name" maxlength="24" placeholder="e.g. Ari" autofocus><label class="field-label" for="room-title">What should we call this gathering?</label><input id="room-title" maxlength="48" value="Career Possibilities">${Core.settingsMarkup('room')}<label class="field-label" for="room-player-count">Number of players</label><select id="room-player-count">${Array.from({length:7},(_,i)=>`<option value="${i+2}" ${i===2?'selected':''}>${i+2} players</option>`).join('')}</select><div class="form-foot"><p class="helper">Deep uses three activities per active category and two rounds. Quick uses three and one round. Custom categories with zero prompt cards are skipped during setup.</p><button class="button primary" data-room-action="create">Create room →</button></div></section>`+close();}
  function renderJoin(){app.innerHTML=shell('join a shared room','back')+`<section class="screen-head"><div class="eyebrow">join a room</div><h2>Enter your host’s room code.</h2><p class="lead">Returning players with the same browser session can reconnect even after the game starts.</p></section><section class="panel"><label class="field-label" for="join-name">Your name</label><input id="join-name" maxlength="24" placeholder="e.g. Sam" autofocus><label class="field-label" for="join-code">Room code</label><input id="join-code" maxlength="6" placeholder="ABC123" style="text-transform:uppercase"><div class="form-foot"><button class="button primary" data-room-action="enter">Join room →</button></div></section>`+close();}
  function renderLeaveConfirm(){app.innerHTML=shell(`ROOM ${roomCode}`,null)+`<section class="handoff-cover"><div class="eyebrow">leave this room?</div><h2>Your seat may still be needed.</h2><p class="lead">Stay if the game is active. Reloading is safe; deliberately leaving removes this device’s quick reconnect link.</p><div class="actions"><button class="button quiet" data-room-action="stay-room">Stay in room</button><button class="button coral" data-room-action="confirm-leave">Leave anyway</button></div></section>`+close();}

  function renderLobby(){
    const {room,players}=snapshot;const enough=players.length===room.config.playerCount;
    app.innerHTML=shell(`ROOM ${room.code}`)+`<section class="screen-head"><div class="room-code">ROOM ${room.code}</div><div class="eyebrow">waiting room</div><h2>${esc(room.title)}</h2><p class="lead">Share this room code or link. Once all ${room.config.playerCount} people are here, the host opens the activity stage.</p></section><section class="panel"><div class="pass-card"><span><small>Share this link</small><br><b id="room-link">${esc(roomUrl(room.code).toString())}</b></span><button class="button quiet" data-room-action="copy-link">Copy</button></div><div class="config-recap">${esc(Core.configSummary(room.config))}</div><div class="stack-list">${players.map(player=>`<div class="pass-card"><span><b>${esc(player.name)}</b>${player.id===snapshot.me.id?' <small>(you)</small>':''}</span><span class="pill">ready</span></div>`).join('')}</div><div class="form-foot">${room.isHost?`<p class="helper">${enough?'Everyone is here.':`Waiting for ${room.config.playerCount-players.length} more.`}</p><button class="button coral" data-room-action="start-room" ${enough&&!busy?'':'disabled'}>${busy?'Opening…':'Open activity stage →'}</button>`:'<p class="helper">Waiting for the host to open the activity stage…</p>'}</div></section>`+close();
  }

  function activityDraftKey(key,index){return `${key}:${index}`;}
  function renderOwnActivities(config){
    const count=config.itemsPerCategory;const active=activeCategories(config);
    return active.map(([key,label])=>`<section class="activity-inputs"><h3>${label}</h3>${Array.from({length:count},(_,i)=>`<label class="field-label" for="own-${key}-${i}">${label} activity ${i+1}</label><input class="room-own" id="own-${key}-${i}" data-category="${key}" data-ordinal="${i+1}" maxlength="80" value="${esc(drafts.activities[activityDraftKey(key,i+1)]||'')}" placeholder="e.g. Exploring local food markets">`).join('')}</section>`).join('');
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
    document.querySelectorAll(`[data-room-card^="${key}:"]`).forEach(node=>{const chosen=picks.includes(node.dataset.roomCard);node.classList.toggle('selected',chosen);node.disabled=!chosen&&atLimit;});
  }

  function renderTurn(){
    const {room,turn}=snapshot;if(!turn)return;const isTarget=turn.isTarget,waiting=turn.status==='submitting',voting=turn.status==='voting',result=turn.status==='result';const single=turn.neededCount===1;let body;
    if(waiting&&isTarget)body=`<section class="panel"><div class="prompt-cards">${turn.cards.map(card=>`<span class="prompt-card ${card.category}"><i></i>${esc(card.title)}</span>`).join('')}</div><h3>${single?'Your friend is writing.':'Your friends are writing.'}</h3><p class="lead">Ideas will appear together when everyone is ready. Submission timing is hidden to protect author privacy.</p></section>`;
    else if(waiting){
      const ideaDraft=drafts.ideas[turn.id]||'';
      body=turn.mySubmitted?`<section class="panel"><h3>Your idea is sealed.</h3><p class="lead">It is safely submitted. Waiting for ${single?turn.targetName:'the other friends'}…</p></section>`:`<section class="panel"><div class="prompt-cards">${turn.cards.map(card=>`<span class="prompt-card ${card.category}"><i></i>${esc(card.title)}</span>`).join('')}</div><label class="field-label" for="room-idea">What could ${esc(turn.targetName)}’s ideal career look like?</label><textarea id="room-idea" maxlength="700" placeholder="An ideal career could be…">${esc(ideaDraft)}</textarea><div class="form-foot"><p class="helper">Your unfinished idea stays on this device until the server confirms it is sealed.</p><button class="button primary" data-room-action="submit-idea" ${busy?'disabled':''}>${busy?'Sealing…':'Seal my idea →'}</button></div></section>`;
    }else if(voting&&isTarget){
      if(single){const option=turn.options[0];body=`<section class="panel"><div class="eyebrow">an idea from your friend</div><h2>${esc(option?.body||'')}</h2><p class="lead">In a two-player room the author is naturally known, so there is no artificial vote.</p><div class="form-foot"><button class="button coral" data-room-action="accept-room-path" ${busy||!option?'disabled':''}>${busy?'Saving…':'Continue with this path →'}</button></div></section>`;}
      else body=`<section class="idea-grid">${turn.options.map(option=>`<button class="vote-card ${selected.vote===option.id?'selected':''}" data-room-vote="${option.id}"><span class="kind-label">ideal career · anonymous author</span><p>${esc(option.body)}</p></button>`).join('')}</section><div class="actions" style="justify-content:center"><button class="button coral" data-room-action="cast-vote" ${selected.vote&&!busy?'':'disabled'}>${busy?'Saving…':'Choose this path →'}</button></div>`;
    }else if(voting)body=`<section class="panel"><h3>${esc(turn.targetName)} is reflecting.</h3><p class="lead">${single?`${esc(turn.targetName)} is reading your idea.`:`All ideas are in. Only ${esc(turn.targetName)} can see and choose among the shuffled possibilities.`}</p></section>`;
    else if(result&&isTarget)body=`<section class="panel"><div class="eyebrow">your selected path</div><h2>${esc(turn.winner)}</h2><p class="lead">This path is stored in the room recap. Continue when you are ready for the next person’s turn.</p><div class="form-foot"><button class="button coral" data-room-action="save-turn" ${busy?'disabled':''}>${busy?'Saving…':'Save turn & continue →'}</button></div></section>`;
    else body=`<section class="panel"><h3>${esc(turn.targetName)} is reflecting.</h3><p class="lead">Their selected path will appear in the shared recap when the table is complete.</p></section>`;
    app.innerHTML=shell(`ROOM ${room.code}`)+`<section class="screen-head"><div class="eyebrow">table round ${turn.tableRound} of ${room.config.roundCount} · ${esc(turn.targetName)}’s turn</div><h2>${waiting&&!isTarget?`Write an idea for ${esc(turn.targetName)}.`:isTarget&&voting?(single?'Reflect on your friend’s idea.':'Which path feels most real?'):`Make space for ${esc(turn.targetName)}.`}</h2><p class="lead">${waiting&&!isTarget?'Write at your own pace—your draft will stay put.':single?'One friend contributes one path in this two-player room.':'Ideas are shown in a persistent randomized order.'}</p></section>${body}`+close();
  }

  function resultsSummary(){const room=snapshot.room;const results=snapshot.results||[];return `${room.title}\n\n${results.map(result=>`Table round ${result.tableRound}: ${result.targetName}\nPrompt\n${(result.cards||[]).map(card=>`- ${categories.find(([key])=>key===card.category)?.[1]||card.category}: ${card.title}`).join('\n')}\n\nSelected path\n- ${result.winner}`).join('\n\n')}`;}
  function renderComplete(){const room=snapshot.room;const results=snapshot.results||[];const people=room.config.playerCount===2?'their friend':'their friends';app.innerHTML=shell(`ROOM ${room.code}`)+`<section class="screen-head"><div class="eyebrow">your table is complete</div><h2>Keep what feels alive.</h2><p class="lead">Every player received ${Core.countLabel(room.config.roundCount,'turn')} for ${people} to imagine with them.</p></section>${results.length?`<section class="ending-grid">${results.map(result=>`<article class="player-stack"><div class="eyebrow">table round ${result.tableRound} · ${esc(result.targetName)}</div><h3>${esc(result.winner)}</h3><div class="prompt-cards">${(result.cards||[]).map(card=>`<span class="prompt-card ${card.category}"><i></i>${esc(card.title)}</span>`).join('')}</div></article>`).join('')}</section>`:`<section class="panel"><p class="lead">The room is complete. Apply the latest room schema to enable the durable in-app result recap for this deployment.</p></section>`}<div class="actions" style="justify-content:center">${results.length?'<button class="button quiet" data-room-action="copy-room-summary">Copy table recap</button>':''}<button class="button coral" data-room-action="confirm-leave">Done</button></div>`+close();}

  function render(preserve=false){
    const scrollY=window.scrollY;const activeId=document.activeElement?.id;const selectionStart=document.activeElement?.selectionStart;
    if(!snapshot)return renderHome();
    if(snapshot.room.status==='lobby')renderLobby();else if(snapshot.room.status==='activities')renderActivities();else if(snapshot.room.status==='playing')renderTurn();else renderComplete();
    requestAnimationFrame(()=>{
      if(preserve){window.scrollTo(0,scrollY);if(activeId){const node=document.getElementById(activeId);node?.focus();if(Number.isInteger(selectionStart)&&node?.setSelectionRange)node.setSelectionRange(selectionStart,selectionStart);}}
      else window.scrollTo({top:0,left:0,behavior:'instant'});
    });
  }

  async function create(){const name=document.getElementById('room-host-name').value.trim(),title=document.getElementById('room-title').value.trim(),config=configFor();if(!name)return say('Enter your name.');const error=Core.validateSettings(config);if(error)return say(error);try{const data=await rpc('create_ikigai_room',{p_name:name,p_title:title,p_config:config});roomCode=data?.[0]?.code||data?.code;selected={activityCategoryIndex:0};drafts={activities:{},ideas:{}};await watch();await broadcast();}catch(error){say(error.message);}}
  async function join(){const name=document.getElementById('join-name').value.trim(),code=document.getElementById('join-code').value.trim().toUpperCase();if(!name||!code)return say('Enter your name and room code.');try{await rpc('join_ikigai_room',{p_code:code,p_name:name});roomCode=code;await watch();await broadcast();}catch(error){say(error.message);}}

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
  async function saveTurn(){const turnId=snapshot.turn.id;selected.vote=null;persist();const completed=await act('complete_ikigai_turn',{p_turn_id:turnId});if(completed)say('Turn saved to the table recap.');}
  function localHome(){clear();window.IkigaiRoom.active=false;window.IkigaiLocalRender?.();}

  document.addEventListener('click',async event=>{
    const node=event.target.closest('[data-room-action], [data-room-card], [data-room-vote]');if(!node)return;
    if(node.dataset.roomCard){const [key]=node.dataset.roomCard.split(':');const list=selected[key]||[];if(list.includes(node.dataset.roomCard))selected[key]=list.filter(token=>token!==node.dataset.roomCard);else if(list.length<snapshot.room.config.itemsPerCategory)selected[key]=[...list,node.dataset.roomCard];else return say(`Choose only ${Core.countLabel(snapshot.room.config.itemsPerCategory,'card')} in this category.`);persist();updatePicks();return;}
    if(node.dataset.roomVote){selected.vote=node.dataset.roomVote;persist();render();return;}
    const action=node.dataset.roomAction;
    if(action==='host')return renderHost();if(action==='join')return renderJoin();if(action==='local-home')return localHome();if(action==='room-home')return renderHome();
    if(action==='request-leave')return renderLeaveConfirm();if(action==='stay-room')return render();if(action==='confirm-leave')return localHome();
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
  document.addEventListener('change',event=>{if(event.target.id==='room-mode')Core.syncModeForm('room');});

  window.IkigaiRoom={openHost:()=>{clear();renderHost();},openJoin:()=>{clear();renderJoin();},open:()=>renderHome(),resume:async code=>{roomCode=code;try{await setup();await watch();}catch(error){say(error.message);clear();renderHome();}},active:false};
  const stored=readStored();const initialCode=new URLSearchParams(location.search).get('room')||stored?.roomCode;
  if(initialCode)window.IkigaiRoom.resume(initialCode.toUpperCase());
}());
