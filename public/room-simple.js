// A room begins with a code, not a headcount. The host starts whenever at
// least one friend has joined; the database then locks in that player count.
(function () {
  const categories = ['love', 'strength', 'opportunity', 'need'];
  function showHost() {
    document.getElementById('app').innerHTML = `<div class="shell"><header class="topbar"><button class="brand" data-r="local"><span class="brand-mark">i</span>ikigai</button></header><section class="screen-head"><div class="eyebrow">host a room</div><h2>Create a room code.</h2><p class="lead">Share it with friends, then configure the game together in the lobby.</p></section><section class="panel"><label class="field-label" for="simple-name">Your name</label><input id="simple-name" maxlength="24" autofocus><div class="form-foot"><button class="button coral" data-simple-create>Create room →</button></div></section></div>`;
  }
  function waitFor(request, message) {
    return Promise.race([
      request,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), 15000))
    ]);
  }
  async function create() {
    const name=document.getElementById('simple-name').value.trim();
    const button=document.querySelector('[data-simple-create]');
    if(!name){alert('Enter your name to create the room.');return;}
    button.disabled=true; button.textContent='Creating room…';
    try {
      const db=supabase.createClient(IKIGAI_SUPABASE.url,IKIGAI_SUPABASE.publishableKey);
      let {data:{session},error:sessionError}=await waitFor(db.auth.getSession(),'Connection timed out. Please try again.');
      if(sessionError) throw sessionError;
      if(!session){
        const {error}=await waitFor(db.auth.signInAnonymously(),'Sign-in timed out. Please try again.');
        if(error) throw error;
      }
      const config={mode:'quick',source:'premade',playerCount:8,itemsPerCategory:5,roundCount:1,roundCardCounts:Object.fromEntries(categories.map(category=>[category,1]))};
      const {data,error}=await waitFor(db.rpc('create_ikigai_room',{p_name:name,p_title:'Career Possibilities',p_config:config}),'Creating the room timed out. Please try again.');
      if(error) throw error;
      // PostgREST normally returns [{ code }], but handle every supported RPC
      // response shape. Never navigate without an actual room code.
      const roomCode=typeof data==='string'?data:data?.[0]?.code||data?.code;
      if(!roomCode) throw new Error('The room was created, but its code was not returned. Please try again.');
      location.assign(location.pathname+'?room='+encodeURIComponent(roomCode));
    } catch(error) {
      alert(error.message||'We could not create the room. Please try again.');
      button.disabled=false; button.textContent='Create room →';
    }
  }
  function unlockStart() {
    const start=document.querySelector('[data-r="start"]'); if(!start)return;
    const count=Math.max(0, document.querySelectorAll('.panel .pass-card').length - (document.getElementById('room-link') ? 1 : 0));
    start.disabled=count<2;
    const prior=document.getElementById('room-waiting-hint');
    if(prior) prior.textContent=count<2?'Waiting for one friend to join with this room code.':'Ready — the host can start whenever you like.';
  }
  document.addEventListener('click',event=>{
    // Leaving must always work, including while a room snapshot is loading or
    // when the room controller has encountered an error.
    const leave=event.target.closest('[data-r="leave"]');
    if(leave){event.preventDefault();event.stopImmediatePropagation();location.assign(location.pathname);return;}
    const host=event.target.closest('[data-r="host"],[data-room-action="host"]');
    if(host){event.preventDefault();event.stopImmediatePropagation();showHost();return;}
    const createButton=event.target.closest('[data-simple-create]');
    if(createButton){event.preventDefault();event.stopImmediatePropagation();create();}
  },true);
  const app=document.getElementById('app');
  if(app) new MutationObserver(unlockStart).observe(app,{childList:true,subtree:true});
  unlockStart();
}());
