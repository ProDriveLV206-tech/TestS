/* chat.js - enforces moderation checks before sending and when displaying messages */
const db = firebase.database();
const auth = firebase.auth();

// helper to get email key
function emailKey(email){ return email.replace(/\./g,'_'); }

// check can send (bans/mutes/lock/slowmode)
async function canUserSend(email, room){
  room = room||'global';
  const k = emailKey(email.toLowerCase());
  const banned = await db.ref('banned/'+k).once('value');
  if(banned.exists()) return {ok:false, reason:'banned'};
  const mute = await db.ref('muted/'+k).once('value');
  if(mute.exists()){
    const m = mute.val();
    if(m.until && m.until > Date.now()) return {ok:false, reason:'muted', until: m.until};
    if(!m.until) return {ok:false, reason:'muted'};
  }
  const locked = await db.ref('locked/'+room).once('value');
  if(locked.exists()) return {ok:false, reason:'locked'};
  const slow = await db.ref('slowmode/'+room).once('value');
  if(slow.exists()){
    const s = slow.val();
    const lastKey = 'lastMsg_'+k+'_'+room;
    const last = localStorage.getItem(lastKey);
    if(last){
      const diff = Date.now() - parseInt(last,10);
      if(diff < (s.seconds||0)*1000) return {ok:false, reason:'slowmode', wait: (s.seconds*1000 - diff)};
    }
  }
  return {ok:true};
}

// before sending in UI, call canUserSend and respect result
async function sendMessage(room, msg){
  const user = firebase.auth().currentUser;
  if(!user) return alert('Login required');
  const can = await canUserSend(user.email, room);
  if(!can.ok){
    if(can.reason==='banned') return alert('You are banned');
    if(can.reason==='muted') return alert('You are muted');
    if(can.reason==='locked') return alert('This room is locked');
    if(can.reason==='slowmode') return alert('Slow mode active. Wait a bit.');
    return alert('You cannot send messages');
  }
  const push = db.ref('chatrooms/'+room+'/messages').push();
  // include nickname and pfp from profile if present
  const profile = (await db.ref('users/'+user.uid).once('value')).val()||{};
  const data = { user: user.email, uid:user.uid, msg: msg, time: Date.now(), nickname: profile.nickname||profile.name, pfp: profile.pfp||'' };
  await push.set(data);
  // record last send for slowmode
  const k = emailKey(user.email.toLowerCase());
  localStorage.setItem('lastMsg_'+k+'_'+room, Date.now().toString());
  return true;
}

// alter display: hide messages from shadowbanned users for others
function displayMessages(room, container){
  db.ref('chatrooms/'+room+'/messages').limitToLast(200).on('child_added', async snap=>{
    const m = snap.val();
    if(!m) return;
    const current = auth.currentUser;
    const authorKey = emailKey((m.user||'').toLowerCase());
    const shadow = await db.ref('shadowbanned/'+authorKey).once('value');
    if(shadow.exists()){
      // if current is same as author, show; otherwise skip (shadowban)
      if(!current || current.email.toLowerCase() !== (m.user||'').toLowerCase()){
        return; // do not display this message to others
      }
    }
    // normal render
    const div = document.createElement('div'); div.className='message';
    const av = document.createElement('div'); av.className='avatar'; const img=document.createElement('img'); img.src = m.pfp||'https://via.placeholder.com/40'; img.style.width='40px'; img.style.height='40px'; av.appendChild(img);
    const bubble = document.createElement('div'); bubble.innerHTML = '<div class="meta">'+(m.nickname||m.user)+' • '+new Date(m.time).toLocaleTimeString()+'</div><div>'+m.msg+'</div>';
    div.appendChild(av); div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  });
}

// listen for force logout signals for current user
auth.onAuthStateChanged(user=>{
  if(!user) return;
  const key = emailKey(user.email.toLowerCase());
  db.ref('force_logout/'+key).on('value', snap=>{ if(snap.exists() && snap.val()){ alert('You were force-logged out by an admin'); auth.signOut(); db.ref('force_logout/'+key).remove(); } });
});
