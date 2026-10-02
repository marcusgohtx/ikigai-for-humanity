(function () {
  'use strict';
  const STORAGE_KEY = 'ikigai-make-a-life-v6';
  const Core = window.IKIGAI_GAME;
  const labels = Object.fromEntries(Core.categories.map(({key, label}) => [key, label]));
  const toast = Core.notify;
  const app = document.getElementById('app');
  let state = load() || { screen: 'home' };
  let setupNameCache = ['Ari', 'Sam', 'Riley', 'Jordan'];

  function uid(prefix) { return `${prefix}-${Math.random().toString(36).slice(2, 9)}`; }
  function load() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } }
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function shuffle(array) { const copy=array.slice(); for(let i=copy.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];} return copy; }
  function sample(array, count) { return shuffle(array).slice(0, count); }
  function activeCategories() { return Core.activeCategories(state); }
  function categoryKeys() { return activeCategories().map(({key}) => key); }
  function cardById(id) { return state.cards.find(card => card.id === id); }
  function activePlayer() { return state.players[state.activeIndex]; }
  function round() { return state.round; }
  const esc = Core.esc;

  function header(note='') { return `<div class="shell"><header class="topbar"><button class="brand" data-action="home"><span class="brand-mark">i</span>ikigai</button><div class="nav-actions"><span class="nav-note">${esc(note)}</span>${state.players?'<button class="button reset-button" data-action="reset-game">Reset game</button>':''}</div></header>`; }
  const close = () => '</div>';
  function categoryCard(card, selectable, selected) { return `<button class="activity-card ${card.category} ${selected?'selected':''}" data-card="${card.id}" ${selectable?'':'disabled'}><span class="card-dot"></span><span class="category">${labels[card.category]}</span><span class="title">${esc(card.title)}</span></button>`; }
  function selectedPromptCards(ids) { return ids.map(id=>{const card=cardById(id);return `<span class="prompt-card ${card.category}"><i></i>${esc(card.title)}</span>`;}).join(''); }
  function progress(current,total){return `<div class="progress">${Array.from({length:total},(_,i)=>`<span class="${i<current?'done':i===current?'current':''}"></span>`).join('')}</div>`;}
  function playerInput(name,index){return `<div class="player-entry"><input class="player-name" data-player-index="${index}" type="text" maxlength="24" value="${esc(name)}" placeholder="Player ${index+1}" /></div>`;}

  function queueHandoff(player, nextScreen, eyebrow, title, body) {
    state.handoff={playerId:player.id,nextScreen,eyebrow,title,body};
    state.screen='handoff';
    save();
    render();
  }

  function renderHandoff(){
    const handoff=state.handoff;
    const player=state.players.find(candidate=>candidate.id===handoff.playerId);
    app.innerHTML=header(state.title)+`<section class="handoff-cover"><div class="eyebrow">${esc(handoff.eyebrow)}</div><h2>Pass the device to ${esc(player.name)}.</h2><p class="lead">${esc(handoff.body)}</p><button class="button coral" data-action="handoff-ready">I’m ${esc(player.name)} — ready →</button></section>`+close();
  }

  function completeHandoff(){const next=state.handoff.nextScreen;delete state.handoff;state.screen=next;save();render();}

  function renderHome(){
    app.innerHTML=header('a gentle game for imagining work')+`<section class="hero"><div class="hero-copy"><div><div class="eyebrow">make a life with your friends</div><h1>What could your work become?</h1><p class="lead">Draft the ingredients that feel most like you. Then let your friends imagine real, surprising paths forward—together.</p><div class="actions"><button class="button coral" data-action="setup">Play on one device</button><button class="button quiet" data-room-action="host">Host a room</button><button class="button quiet" data-room-action="join">Join a room</button>${state.players?'<button class="button quiet" data-action="resume">Resume saved table</button>':''}</div></div><aside class="hero-aside"><strong>2–8 friends · flexible pace</strong>Go practical, go strange, or go both. Offer a possibility—not a prescription.</aside></div>${Core.categoryStrip()}</section>`+close();
  }

  function renderSetup(){
    app.innerHTML=header('set the table')+`<section class="screen-head"><div class="eyebrow">new game</div><h2>Gather your curious people.</h2><p class="lead">Every player contributes ideas and takes turns as the active player. Choose a mode, then set up your table.</p></section><section class="panel"><label class="field-label" for="table-name">What should we call this gathering?</label><input id="table-name" type="text" maxlength="48" value="Career Possibilities" placeholder="e.g. Sunday dinner ideas" />${Core.settingsMarkup('game')}<label class="field-label" for="player-count">Number of players</label><select id="player-count">${Array.from({length:7},(_,i)=>`<option value="${i+2}" ${i===2?'selected':''}>${i+2} players</option>`).join('')}</select><label class="field-label">Player names</label><div id="player-inputs">${setupNameCache.slice(0,4).map(playerInput).join('')}</div><div class="form-foot"><p class="helper">With two players, each person reflects on one clearly attributed idea. With three or more, ideas are shuffled and anonymous.</p><button class="button primary" data-action="start-game">Continue →</button></div></section>`+close();
  }

  function buildCards(){return Object.entries(window.CARD_LIBRARY).flatMap(([category,titles])=>titles.map((title,index)=>({id:`${category}-${index+1}`,category,title})));}
  function dealHands(category,playerCount,items){const handSize=Math.min(items+3,Math.floor(state.cards.filter(card=>card.category===category).length/playerCount));const pool=shuffle(state.cards.filter(card=>card.category===category));return state.players.map((_,index)=>pool.slice(index*handSize,index*handSize+handSize).map(card=>card.id));}

  function startGame(){
    const entries=[...document.querySelectorAll('.player-name')].map(input=>({name:input.value.trim()}));
    const names=entries.map(entry=>entry.name);
    if(names.some(name=>!name))return toast('Give every player a name before continuing.');
    if(new Set(names.map(name=>name.toLowerCase())).size!==names.length)return toast('Give each person a distinct name.');
    const config=Core.readSettings('game');
    const error=Core.validateSettings(config);if(error)return toast(error);
    const {mode,source,itemsPerCategory,roundCount,roundCardCounts}=config;
    const cards=source==='premade'?buildCards():[];
    if(source==='premade'&&cards.length<32)return toast('The card library is still loading—try again in a moment.');
    const players=names.map(name=>({id:uid('p'),name,draft:[],keep:[],bank:[]}));
    const roundPlayerIds=players.map(player=>player.id);
    state={screen:source==='premade'?'draft':'create-activities',title:document.getElementById('table-name').value.trim()||'Career Possibilities',roomCode:Math.random().toString(36).slice(2,7).toUpperCase(),mode,source,itemsPerCategory,roundCount,roundCardCounts,players,roundPlayerIds,cards,draft:{hands:[],pickRound:0,pickerIndex:0,categoryIndex:0},activityCreation:{playerIndex:0,categoryIndex:0},activityDrafts:{},activeIndex:0,completedRounds:0};
    if(source==='premade')state.draft.hands=dealHands(categoryKeys()[0],players.length,itemsPerCategory);
    save();render();
  }

  function renderDraft(){
    const draft=state.draft;const keys=categoryKeys();const category=keys[draft.categoryIndex];const picker=state.players[draft.pickerIndex];const hand=draft.hands[draft.pickerIndex].map(cardById);const picked=picker.draft.filter(id=>cardById(id).category===category).length;const tablePick=draft.pickRound*state.players.length+draft.pickerIndex+1;const tableTotal=state.itemsPerCategory*state.players.length;
    app.innerHTML=header(state.title)+`<section class="screen-head"><div class="room-code">TABLE ${state.roomCode} · ${labels[category].toUpperCase()} · PLAYER ${draft.pickerIndex+1} OF ${state.players.length}</div><div class="eyebrow">${esc(picker.name)} · pick ${draft.pickRound+1} of ${state.itemsPerCategory} · table pick ${tablePick} of ${tableTotal}</div><h2>Choose ${labels[category].toLowerCase()}.</h2><p class="lead">This choice belongs to ${esc(picker.name)}’s personal deck. The handoff cover keeps each player’s options private.</p></section>${progress(draft.pickRound,state.itemsPerCategory)}<section class="pass-card"><span><b>${esc(picker.name)}</b><br><small>${picked} of ${state.itemsPerCategory} selected in this category</small></span><span class="pill">category ${draft.categoryIndex+1} of ${keys.length}</span></section><section class="card-grid">${hand.map(card=>categoryCard(card,true,false)).join('')}</section>`+close();
  }

  function chooseDraft(id){
    const draft=state.draft;const hand=draft.hands[draft.pickerIndex];const location=hand.indexOf(id);if(location<0)return;
    hand.splice(location,1);state.players[draft.pickerIndex].draft.push(id);
    if(draft.pickerIndex<state.players.length-1)draft.pickerIndex++;
    else{draft.pickerIndex=0;draft.pickRound++;draft.hands=[draft.hands[draft.hands.length-1],...draft.hands.slice(0,-1)];}
    const keys=categoryKeys();
    if(draft.pickRound>=state.itemsPerCategory){draft.categoryIndex++;draft.pickRound=0;if(draft.categoryIndex>=keys.length){state.screen='draft-complete';save();render();return;}draft.hands=dealHands(keys[draft.categoryIndex],state.players.length,state.itemsPerCategory);}
    const next=state.players[draft.pickerIndex];
    queueHandoff(next,'draft','private activity draft',`${next.name} chooses next.`,`Only ${next.name} should see the next hand of activity cards.`);
  }

  function activityDraftKey(player,category){return `${player.id}:${category}`;}
  function renderActivityCreation(){
    const step=state.activityCreation;const keys=categoryKeys();const creator=state.players[step.playerIndex];const category=keys[step.categoryIndex];const values=state.activityDrafts?.[activityDraftKey(creator,category)]||[];const canBack=step.playerIndex>0||step.categoryIndex>0;
    app.innerHTML=header(state.title)+`<section class="screen-head"><div class="room-code">CREATE · PLAYER ${step.playerIndex+1} OF ${state.players.length} · CATEGORY ${step.categoryIndex+1} OF ${keys.length}</div><div class="eyebrow">make your own activity cards</div><h2>${esc(creator.name)}, add to “${esc(labels[category])}.”</h2><p class="lead">Write ${Core.countLabel(state.itemsPerCategory,'specific activity')}. Your unfinished text is saved in this browser as you type.</p></section><section class="panel"><div class="activity-inputs">${Array.from({length:state.itemsPerCategory},(_,index)=>`<label class="field-label" for="activity-${index}">${labels[category]} activity ${index+1}</label><input id="activity-${index}" class="own-activity" data-draft-index="${index}" type="text" maxlength="80" value="${esc(values[index]||'')}" placeholder="e.g. Exploring local food markets" />`).join('')}</div><div class="form-foot"><p class="helper">You can return to the previous category to make corrections.</p><div class="actions compact-actions">${canBack?'<button class="button quiet" data-action="previous-activities">← Edit previous</button>':''}<button class="button primary" data-action="save-activities">Continue →</button></div></div></section>`+close();
  }

  function saveActivities(){
    const step=state.activityCreation;const keys=categoryKeys();const category=keys[step.categoryIndex];const creator=state.players[step.playerIndex];const values=[...document.querySelectorAll('.own-activity')].map(input=>input.value.trim());
    if(values.some(value=>value.length<2))return toast('Give each activity a little more detail.');
    if(new Set(values.map(value=>value.toLowerCase())).size!==values.length)return toast('Make each activity distinct.');
    const prefix=`own-${creator.id}-${category}-`;state.cards=state.cards.filter(card=>!card.id.startsWith(prefix));creator.draft=creator.draft.filter(id=>!id.startsWith(prefix));
    values.forEach((title,index)=>{const card={id:`${prefix}${index+1}`,category,title};state.cards.push(card);creator.draft.push(card.id);});
    delete state.activityDrafts[activityDraftKey(creator,category)];
    if(step.categoryIndex<keys.length-1){step.categoryIndex++;save();render();return;}
    if(step.playerIndex<state.players.length-1){step.playerIndex++;step.categoryIndex=0;const next=state.players[step.playerIndex];queueHandoff(next,'create-activities','private activity creation',`${next.name} creates next.`,`These activities form ${next.name}’s personal deck.`);return;}
    state.screen='draft-complete';save();render();
  }

  function previousActivities(){
    const step=state.activityCreation;const keys=categoryKeys();if(step.categoryIndex>0)step.categoryIndex--;else if(step.playerIndex>0){step.playerIndex--;step.categoryIndex=keys.length-1;}else return;
    const creator=state.players[step.playerIndex];const category=keys[step.categoryIndex];const ids=creator.draft.filter(id=>cardById(id)?.category===category);state.activityDrafts[activityDraftKey(creator,category)]=ids.map(id=>cardById(id).title);state.cards=state.cards.filter(card=>!ids.includes(card.id));creator.draft=creator.draft.filter(id=>!ids.includes(id));save();render();
  }

  function renderDraftComplete(){
    app.innerHTML=header(state.title)+`<section class="screen-head"><div class="eyebrow">the ingredients are in</div><h2>Each person has a personal activity deck.</h2><p class="lead">${state.players.length===2?'Each player will receive one clearly attributed idea from their friend in every turn.':'Ideas are shuffled before the active player sees them, so contributor order stays private.'}</p></section><section class="panel">${state.players.map(player=>`<div class="pass-card"><span><b>${esc(player.name)}</b><br><small>${Core.countLabel(player.draft.length,'activity')} collected</small></span><span class="pill">takes a turn each round</span></div>`).join('')}<div class="config-recap">${esc(Core.configSummary(state))}</div><div class="form-foot"><p class="helper">Each table round includes one turn for every player.</p><button class="button coral" data-action="begin-round">Open ${esc(activePlayer().name)}’s turn →</button></div></section>`+close();
  }

  function beginRound(){const cards=categoryKeys().flatMap(category=>sample(activePlayer().draft.filter(id=>cardById(id).category===category),state.roundCardCounts[category]));state.round={cards,ideas:[],submitIndex:0,votes:{},ideaDrafts:{}};state.screen='career-prompt';save();render();}
  function renderCareerPrompt(){const r=round();const player=activePlayer();const tableRound=Math.floor(state.completedRounds/state.players.length)+1;app.innerHTML=header(state.title)+`<section class="screen-head"><div class="eyebrow">table round ${tableRound} of ${state.roundCount} · ${esc(player.name)}’s turn</div><h2>${esc(player.name)}, review your ingredients.</h2><p class="lead">When you are ready, hide this screen and pass the device to the first friend who will imagine a path for you.</p></section><section class="card-grid">${r.cards.map(cardById).map(card=>categoryCard(card,false,false)).join('')}</section><div class="actions" style="justify-content:center"><button class="button coral" data-action="start-submissions">Hide cards &amp; pass to a friend →</button></div>`+close();}
  function submitters(){return state.players.filter(player=>player.id!==activePlayer().id);}
  function beginSubmissions(){const writer=submitters()[round().submitIndex];queueHandoff(writer,'submission','private idea writing',`${writer.name} writes next.`,`The active player should not see the idea until it has been sealed.`);}
  function renderSubmission(){const r=round();const writer=submitters()[r.submitIndex];const value=r.ideaDrafts?.[writer.id]||'';app.innerHTML=header(state.title)+`<section class="screen-head"><div class="eyebrow">an idea for ${esc(activePlayer().name)}</div><h2>${esc(writer.name)}, add your idea.</h2><p class="lead">Use as many ingredients as you can. Go practical, go strange, or go both.</p></section><section class="panel"><div class="prompt-cards">${selectedPromptCards(r.cards)}</div><label class="field-label" for="idea">What could ${esc(activePlayer().name)}’s ideal career look like?</label><textarea id="idea" maxlength="700" placeholder="An ideal career could be…">${esc(value)}</textarea><div class="form-foot"><p class="helper">Your unfinished draft is saved locally. Seal it before passing the device.</p><button class="button primary" data-action="submit-idea">Seal this idea →</button></div></section>`+close();}

  function submitIdea(){
    const body=document.getElementById('idea').value.trim();if(body.length<12)return toast('Write a little more so the idea has room to breathe.');
    const r=round();const author=submitters()[r.submitIndex];r.ideas.push({id:uid('idea'),authorId:author.id,body,score:0,keep:false});delete r.ideaDrafts[author.id];r.submitIndex++;
    if(r.submitIndex<submitters().length){const writer=submitters()[r.submitIndex];queueHandoff(writer,'submission','private idea writing',`${writer.name} writes next.`,`The previous idea is sealed. Only ${writer.name} should see the next form.`);return;}
    if(r.ideas.length>1)r.ideas=shuffle(r.ideas);
    const player=activePlayer();queueHandoff(player,'reveal','private reflection',`${player.name}, your ideas are ready.`,`Only ${player.name} should reveal and reflect on the submitted paths.`);
  }

  function renderReveal(){const r=round();const single=r.ideas.length===1;app.innerHTML=header(state.title)+`<section class="screen-head"><div class="eyebrow">everything is in</div><h2>${single?'Here’s what your friend imagined.':'Here’s what your friends imagined.'}</h2><p class="lead">${single?'In a two-player game, the author is naturally known. Read this as a generous invitation, not a vote.':'The ideas were shuffled before reveal so submission order does not identify their authors.'}</p></section><section class="idea-grid">${r.ideas.map((idea,index)=>`<article class="idea reveal" style="animation-delay:${index*.1}s"><div class="quote">“</div><p>${esc(idea.body)}</p><footer>${single?'an idea from your friend':'ideal career · author anonymous'}</footer></article>`).join('')}</section><div class="actions" style="justify-content:center"><button class="button coral" data-action="${single?'accept-only-idea':'start-voting'}">${single?'Reflect on this path':'Choose the path to explore'} →</button></div>`+close();}
  function renderVote(){const r=round();const selected=r.votes[activePlayer().id];app.innerHTML=header(state.title)+`<section class="screen-head"><div class="eyebrow">your choice</div><h2>${esc(activePlayer().name)}, which path feels most real?</h2><p class="lead">Choose the shuffled possibility you feel most drawn to explore.</p></section><section class="idea-grid">${r.ideas.map(idea=>`<button class="vote-card ${selected===idea.id?'selected':''}" data-vote="${idea.id}"><span class="kind-label">ideal career · anonymous author</span><p>${esc(idea.body)}</p></button>`).join('')}</section><div class="actions" style="justify-content:center"><button class="button primary" data-action="next-voter" ${!selected?'disabled':''}>Choose this path →</button></div>`+close();}
  function acceptOnlyIdea(){const idea=round().ideas[0];round().votes[activePlayer().id]=idea.id;idea.score=1;idea.keep=true;state.screen='reflect';save();render();}
  function nextVoter(){const r=round();const idea=r.ideas.find(candidate=>candidate.id===r.votes[activePlayer().id]);if(idea){idea.score++;idea.keep=true;}state.screen='reflect';save();render();}
  function renderReflect(){const r=round(),player=activePlayer();app.innerHTML=header(state.title)+`<section class="screen-head"><div class="eyebrow">${esc(player.name)}’s collection</div><h2>What do you want to keep exploring?</h2><p class="lead">Your chosen path is already checked. Keep any others that still feel alive; everything else remains in your Idea bank.</p></section><section class="panel reflection"><div><div class="prompt-cards">${selectedPromptCards(r.cards)}</div><div class="stack-list">${r.ideas.map(idea=>`<div class="reflect-item"><input id="keep-${idea.id}" data-keep="${idea.id}" type="checkbox" ${idea.keep?'checked':''}/><label for="keep-${idea.id}">${esc(idea.body)}<span class="score">${idea.score?'Chosen path':'Idea bank unless checked'}</span></label></div>`).join('')}</div></div><aside class="reflection-side"><h3>Take what fits.</h3><p>These are gentle invitations, not final answers. You get the final say.</p><button class="button coral" data-action="save-reflection">Save my stacks →</button></aside></section>`+close();}

  function saveReflection(){const r=round(),player=activePlayer();r.ideas.forEach(idea=>{idea.keep=!!document.querySelector(`[data-keep="${idea.id}"]`)?.checked;const saved={body:idea.body,score:idea.score,cards:r.cards};(idea.keep?player.keep:player.bank).push(saved);});state.completedRounds++;if(state.completedRounds>=state.roundCount*state.players.length)state.screen='ending';else{state.activeIndex=state.completedRounds%state.players.length;state.screen='round-ready';}save();render();toast('Turn saved.');}
  function renderRoundReady(){const player=activePlayer();const tableRound=Math.floor(state.completedRounds/state.players.length)+1;const turnInRound=state.completedRounds%state.players.length+1;app.innerHTML=header(state.title)+`<section class="screen-head"><div class="eyebrow">table round ${tableRound} of ${state.roundCount} · player ${turnInRound} of ${state.players.length}</div><h2>Make space for ${esc(player.name)}.</h2><p class="lead">Their activity deck is waiting. This turn draws another mix from the deck; repeats are possible, especially with smaller custom decks.</p></section><section class="panel"><div class="pass-card"><span><small>Pass the device to</small><br><b>${esc(player.name)}</b></span><span class="pill">their turn</span></div><div class="form-foot"><p class="helper">${state.players.length===2?'Their friend contributes one idea.':'Friends contribute ideas, then only the active player chooses.'}</p><button class="button coral" data-action="begin-round">Open ${esc(player.name)}’s turn →</button></div></section>`+close();}
  function renderEnding(){app.innerHTML=header(state.title)+`<section class="screen-head"><div class="eyebrow">your table is complete</div><h2>Keep what feels alive.</h2><p class="lead">Your complete group summary remains here and can be copied when you choose.</p></section><section class="ending-grid">${state.players.map(player=>`<article class="player-stack"><h3>${esc(player.name)}</h3><div class="eyebrow" style="margin-bottom:9px">keep exploring · ${player.keep.length}</div><div class="stack-list">${player.keep.length?player.keep.map(item=>`<div class="stack-item">${esc(item.body)}</div>`).join(''):'<p class="empty">Nothing pinned yet—every idea remains in the bank.</p>'}</div><div class="eyebrow" style="margin:20px 0 9px">idea bank · ${player.bank.length}</div><div class="stack-list">${player.bank.map(item=>`<div class="stack-item">${esc(item.body)}</div>`).join('')}</div></article>`).join('')}</section><div class="actions" style="justify-content:center"><button class="button quiet" data-action="copy-summary">Copy group summary</button><button class="button coral" data-action="new-game">Start a new table</button></div>`+close();}
  function summaryText(){return `${state.title}\n\n`+state.players.map(player=>`${player.name}\nKeep exploring\n${player.keep.map(item=>`- ${item.body}`).join('\n')||'- None'}\n\nIdea bank\n${player.bank.map(item=>`- ${item.body}`).join('\n')||'- None'}`).join('\n\n');}
  function copySummary(){return Core.copyText(summaryText()).then(copied=>toast(copied?'Group summary copied to the clipboard.':'Clipboard access is unavailable in this browser.'));}

  function render(){
    const renderers={home:renderHome,setup:renderSetup,draft:renderDraft,'create-activities':renderActivityCreation,'draft-complete':renderDraftComplete,'career-prompt':renderCareerPrompt,submission:renderSubmission,reveal:renderReveal,vote:renderVote,reflect:renderReflect,'round-ready':renderRoundReady,ending:renderEnding,handoff:renderHandoff};
    (renderers[state.screen]||renderHome)();
    requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
  }

  app.addEventListener('click',event=>{
    const node=event.target.closest('button,input');if(!node)return;const action=node.dataset.action;
    if(action==='home'){if(state.screen!=='home')state.previousScreen=state.screen;state.screen='home';save();render();return;}
    if(action==='setup'){state={screen:'setup'};render();return;}
    if(action==='resume'){state.screen=state.previousScreen||'draft';save();render();return;}
    if(action==='start-game')return startGame();
    if(action==='handoff-ready')return completeHandoff();
    if(action==='save-activities')return saveActivities();
    if(action==='previous-activities')return previousActivities();
    if(action==='start-submissions')return beginSubmissions();
    if(action==='begin-round')return beginRound();
    if(action==='submit-idea')return submitIdea();
    if(action==='start-voting'){state.screen='vote';save();render();return;}
    if(action==='accept-only-idea')return acceptOnlyIdea();
    if(action==='next-voter')return nextVoter();
    if(action==='save-reflection')return saveReflection();
    if(action==='copy-summary')return copySummary();
    if(action==='new-game'){localStorage.removeItem(STORAGE_KEY);state={screen:'setup'};render();return;}
    if(action==='reset-game'&&window.confirm('Reset this game? This permanently removes the drafted cards and saved idea stacks from this browser.')){localStorage.removeItem(STORAGE_KEY);state={screen:'home'};render();return;}
    const cardId=node.dataset.card;if(cardId&&state.screen==='draft')chooseDraft(cardId);
    if(node.dataset.vote){round().votes[activePlayer().id]=node.dataset.vote;render();}
  });

  app.addEventListener('input',event=>{
    const node=event.target;
    if(node.matches('.player-name')){setupNameCache[Number(node.dataset.playerIndex)]=node.value;return;}
    if(node.matches('.own-activity')){const step=state.activityCreation;const category=categoryKeys()[step.categoryIndex];const creator=state.players[step.playerIndex];const key=activityDraftKey(creator,category);state.activityDrafts[key]||=[];state.activityDrafts[key][Number(node.dataset.draftIndex)]=node.value;save();return;}
    if(node.id==='idea'&&state.screen==='submission'){const writer=submitters()[round().submitIndex];round().ideaDrafts[writer.id]=node.value;save();}
  });

  app.addEventListener('change',event=>{
    const node=event.target;
    if(node.id==='game-mode')Core.syncModeForm('game');
    if(node.id==='player-count'){
      const container=document.getElementById('player-inputs');[...container.querySelectorAll('.player-name')].forEach(input=>setupNameCache[Number(input.dataset.playerIndex)]=input.value);
      const count=Number(node.value);while(container.children.length<count){const index=container.children.length;container.insertAdjacentHTML('beforeend',playerInput(setupNameCache[index]||'',index));}while(container.children.length>count)container.lastElementChild.remove();
    }
  });

  window.IkigaiLocalRender=render;
  render();
}());
