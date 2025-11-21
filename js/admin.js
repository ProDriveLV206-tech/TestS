/* admin.js - full-power admin functions (client-side, requires proper Firebase rules)
 * Admin email must be present in /admins/{email_key} = true
 * This script assumes firebase and auth are loaded on the page.
 */
const ADMIN_EMAIL = "proadmin@proton.me";
const db = firebase.database();
const auth = firebase.auth();

async function requireAdmin(){
  return new Promise((resolve,reject)=>{
    auth.onAuthStateChanged(async user=>{
      if(!user){ alert('Not signed in'); resolve(false); return; }
      const key = user.email.replace(/\./g,'_');
      const snap = await db.ref('admins/'+key).once('value');
      if(!snap.exists()){ alert('Access denied. Not admin.'); resolve(false); return; }
      resolve(true);
    });
  });
}

function logAdmin(action, details){
  const user = auth.currentUser;
  db.ref('admin_logs').push({ by: user ? user.email : 'system', action, details: details||null, ts: Date.now() });
}

// USER MANAGEMENT
async function banUser(email){
  if(!await requireAdmin()) return;
  const k = email.replace(/\./g,'_');
  await db.ref('banned/'+k).set({ by: auth.currentUser.email, ts: Date.now() });
  logAdmin('ban', {email});
  alert('Banned '+email);
}

async function unbanUser(email){
  if(!await requireAdmin()) return;
  const k = email.replace(/\./g,'_');
  await db.ref('banned/'+k).remove();
  logAdmin('unban', {email});
  alert('Unbanned '+email);
}

async function muteUser(email){
  if(!await requireAdmin()) return;
  const k = email.replace(/\./g,'_');
  await db.ref('muted/'+k).set({ by: auth.currentUser.email, ts: Date.now() });
  logAdmin('mute', {email});
  alert('Muted '+email);
}

async function unmuteUser(email){
  if(!await requireAdmin()) return;
  const k = email.replace(/\./g,'_');
  await db.ref('muted/'+k).remove();
  logAdmin('unmute', {email});
  alert('Unmuted '+email);
}

async function tempMute(email, hours){
  if(!await requireAdmin()) return;
  const k = email.replace(/\./g,'_');
  const until = Date.now() + (hours||1)*3600*1000;
  await db.ref('muted/'+k).set({ by: auth.currentUser.email, until, ts: Date.now() });
  logAdmin('tempMute', {email, hours});
  alert('Temp-muted '+email+' for '+hours+' hour(s)');
}

async function shadowbanUser(email){
  if(!await requireAdmin()) return;
  const k = email.replace(/\./g,'_');
  await db.ref('shadowbanned/'+k).set({ by: auth.currentUser.email, ts: Date.now() });
  logAdmin('shadowban', {email});
  alert('Shadowbanned '+email);
}

async function unshadowbanUser(email){
  if(!await requireAdmin()) return;
  const k = email.replace(/\./g,'_');
  await db.ref('shadowbanned/'+k).remove();
  logAdmin('unshadowban', {email});
  alert('Unshadowbanned '+email);
}

async function forceLogout(email){
  if(!await requireAdmin()) return;
  const k = email.replace(/\./g,'_');
  await db.ref('force_logout/'+k).set(true);
  logAdmin('forceLogout', {email});
  alert('Force logout issued for '+email);
}

async function changeNickname(email, newNick){
  if(!await requireAdmin()) return;
  // find user by email -> uid
  const key = email;
  const users = await db.ref('users').orderByChild('email').equalTo(email).once('value');
  users.forEach(ch=>{
    db.ref('users/'+ch.key+'/nickname').set(newNick);
  });
  logAdmin('changeNickname', {email, newNick});
  alert('Nickname changed for '+email);
}

async function resetProfilePicture(email){
  if(!await requireAdmin()) return;
  const users = await db.ref('users').orderByChild('email').equalTo(email).once('value');
  users.forEach(ch=>{
    db.ref('users/'+ch.key+'/pfp').remove();
  });
  logAdmin('resetPFP', {email});
  alert('Reset PFP for '+email);
}

// CHAT MANAGEMENT
async function clearAllChat(room){
  if(!await requireAdmin()) return;
  room = room || 'global';
  await db.ref('chatrooms/'+room+'/messages').remove();
  logAdmin('clearAllChat', {room});
  alert('Cleared chat room '+room);
}

async function clearUserMessages(email, room){
  if(!await requireAdmin()) return;
  const kemail = email.replace(/\./g,'_');
  room = room || 'global';
  const msgs = await db.ref('chatrooms/'+room+'/messages').once('value');
  msgs.forEach(ch=>{
    const m = ch.val();
    if(m && m.user && m.user.toLowerCase()===email.toLowerCase()){
      db.ref('chatrooms/'+room+'/messages/'+ch.key).remove();
    }
  });
  logAdmin('clearUserMessages', {email, room});
  alert('Cleared messages for '+email+' in '+room);
}

async function deleteMessage(room, msgKey){
  if(!await requireAdmin()) return;
  await db.ref('chatrooms/'+room+'/messages/'+msgKey).remove();
  logAdmin('deleteMessage', {room, msgKey});
  alert('Deleted message '+msgKey);
}

async function deleteRoom(room){
  if(!await requireAdmin()) return;
  await db.ref('chatrooms/'+room).remove();
  await db.ref('rooms/'+room).remove();
  logAdmin('deleteRoom', {room});
  alert('Deleted room '+room);
}

async function lockChat(room){
  if(!await requireAdmin()) return;
  room = room||'global';
  await db.ref('locked/'+room).set(true);
  logAdmin('lockChat', {room});
  alert('Locked chat '+room);
}

async function unlockChat(room){
  if(!await requireAdmin()) return;
  room=room||'global';
  await db.ref('locked/'+room).remove();
  logAdmin('unlockChat', {room});
  alert('Unlocked chat '+room);
}

async function setSlowMode(room, seconds){
  if(!await requireAdmin()) return;
  room = room||'global';
  await db.ref('slowmode/'+room).set({seconds: seconds, by: auth.currentUser.email, ts: Date.now()});
  logAdmin('setSlowMode', {room, seconds});
  alert('Set slow mode '+seconds+'s for '+room);
}

async function disableSlowMode(room){
  if(!await requireAdmin()) return;
  room = room||'global';
  await db.ref('slowmode/'+room).remove();
  logAdmin('disableSlowMode', {room});
  alert('Disabled slow mode for '+room);
}

async function globalAnnouncement(text){
  if(!await requireAdmin()) return;
  await db.ref('global_announcements').push({text, by: auth.currentUser.email, ts: Date.now()});
  logAdmin('globalAnnouncement', {text});
  alert('Announcement sent');
}

// UI Controls
async function setAccentColor(hex){
  if(!await requireAdmin()) return;
  await db.ref('siteCustom/accent').set(hex);
  logAdmin('setAccentColor', {hex});
  alert('Accent color set');
}
async function setServerName(name){
  if(!await requireAdmin()) return;
  await db.ref('siteCustom/name').set(name);
  logAdmin('setServerName', {name});
  alert('Server name set');
}
async function setServerLogo(url){
  if(!await requireAdmin()) return;
  await db.ref('siteCustom/logo').set(url);
  logAdmin('setServerLogo', {url});
  alert('Server logo set');
}
async function setBackground(url){
  if(!await requireAdmin()) return;
  await db.ref('siteCustom/background').set(url);
  logAdmin('setBackground', {url});
  alert('Background set');
}

async function toggleMaintenance(mode, message){
  if(!await requireAdmin()) return;
  await db.ref('maintenance').set({on: !!mode, msg: message||''});
  logAdmin('toggleMaintenance', {mode, message});
  alert('Maintenance mode set to '+!!mode);
}

// VIEW / TOOLS
async function viewUsers(){
  if(!await requireAdmin()) return;
  const snap = await db.ref('users').once('value');
  return snap.val();
}
async function viewBanned(){
  if(!await requireAdmin()) return;
  const snap = await db.ref('banned').once('value');
  return snap.val();
}
async function viewMuted(){
  if(!await requireAdmin()) return;
  const snap = await db.ref('muted').once('value');
  return snap.val();
}
async function viewOnline(){
  if(!await requireAdmin()) return;
  const snap = await db.ref('users').once('value');
  const res={};
  snap.forEach(ch=>{ const u=ch.val(); if(u && u.presence && u.presence.online) res[ch.key]=u; });
  return res;
}
async function viewReports(){
  if(!await requireAdmin()) return;
  const snap = await db.ref('reports').once('value');
  return snap.val();
}

// Auto processing: listen to admin_commands node and apply if present (optional)
db.ref('admin_commands').on('child_added', async snap=>{
  try{
    const cmd = snap.val();
    if(!cmd || !cmd.command) return;
    const c = cmd.command.toLowerCase();
    const payload = cmd.payload || {};
    // basic processor - map command names to functions
    if(c.includes('ban')) await banUser(payload.target||payload.email||'');
    else if(c.includes('unban')) await unbanUser(payload.target||payload.email||'');
    else if(c.includes('mute')) await muteUser(payload.target||payload.email||'');
    else if(c.includes('unmute')) await unmuteUser(payload.target||payload.email||'');
    else if(c.includes('shadowban')) await shadowbanUser(payload.target||payload.email||'');
    else if(c.includes('clear') && c.includes('chat')) await clearAllChat(payload.room||'global');
    else if(c.includes('delete') && payload.msgKey) await deleteMessage(payload.room||'global', payload.msgKey);
    // mark processed
    await db.ref('admin_commands/'+snap.key+'/processed').set(true);
  }catch(e){
    console.error('Admin command processing error', e);
  }
});
