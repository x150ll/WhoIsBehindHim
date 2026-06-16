// ===== AUDIO =====
const SOUND_FILES = {
  click:'sounds/click.wav', votePick:'sounds/vote-pick.wav',
  join:'sounds/join.wav', ready:'sounds/ready.wav',
  reveal:'sounds/reveal.wav', timerEnd:'sounds/timer-end.wav',
  warning:'sounds/warning.wav', spectator:'sounds/spectator.wav',
  winner:'sounds/winner.wav', gameStart:'sounds/game-start.wav',
  messageIn:'sounds/message-in.mp3', bgChat:'sounds/bg-chat.mp3'
};
const SOUNDS = {};
Object.entries(SOUND_FILES).forEach(([k,v])=>{try{SOUNDS[k]=new Audio(v);}catch(e){}});
if(SOUNDS.bgChat){SOUNDS.bgChat.loop=true;SOUNDS.bgChat.volume=0.25;}
let soundEnabled=true,bgPlaying=false;
function playSound(name,vol=1){if(!soundEnabled||!SOUNDS[name])return;try{const s=SOUNDS[name];s.currentTime=0;s.volume=Math.min(1,vol);s.play().catch(()=>{});}catch(e){}}
function toggleSound(){soundEnabled=!soundEnabled;document.getElementById('icon-sound-on').style.display=soundEnabled?'':'none';document.getElementById('icon-sound-off').style.display=soundEnabled?'none':'';if(!soundEnabled)SOUNDS.bgChat&&SOUNDS.bgChat.pause();else if(bgPlaying)SOUNDS.bgChat&&SOUNDS.bgChat.play().catch(()=>{});}
function startBg(){if(!bgPlaying){bgPlaying=true;if(soundEnabled&&SOUNDS.bgChat)SOUNDS.bgChat.play().catch(()=>{});}}
function stopBg(){bgPlaying=false;SOUNDS.bgChat&&(SOUNDS.bgChat.pause(),SOUNDS.bgChat.currentTime=0);}

// ===== PWA =====
let deferredInstallPrompt=null;
window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();deferredInstallPrompt=e;
  const already=localStorage.getItem('pwa-dismissed');
  if(!already){setTimeout(()=>document.getElementById('pwa-banner').classList.add('show'),2000);}
});
function installPWA(){
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt.userChoice.then(()=>{deferredInstallPrompt=null;closePWABanner();});
}
function closePWABanner(){
  document.getElementById('pwa-banner').classList.remove('show');
  localStorage.setItem('pwa-dismissed','1');
}

// ===== PARTICLES =====
const cvs=document.getElementById('particles-canvas'),ctx2d=cvs.getContext('2d');
let pts=[];
function rsz(){cvs.width=innerWidth;cvs.height=innerHeight;}
rsz();addEventListener('resize',rsz);
for(let i=0;i<55;i++)pts.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3,r:Math.random()*2+.5,a:Math.random()*.4+.1,c:Math.random()<.5?'109,40,217':'14,165,233'});
function animPts(){ctx2d.clearRect(0,0,cvs.width,cvs.height);pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=cvs.width;if(p.x>cvs.width)p.x=0;if(p.y<0)p.y=cvs.height;if(p.y>cvs.height)p.y=0;ctx2d.beginPath();ctx2d.arc(p.x,p.y,p.r,0,Math.PI*2);ctx2d.fillStyle=`rgba(${p.c},${p.a})`;ctx2d.fill();});requestAnimationFrame(animPts);}
animPts();

// ===== LANG =====
let lang='ar';
function toggleLang(){lang=lang==='ar'?'en':'ar';document.documentElement.lang=lang;document.documentElement.dir=lang==='ar'?'rtl':'ltr';document.body.classList.toggle('lang-en',lang==='en');applyLang();playSound('click');}
function applyLang(){document.querySelectorAll('[data-ar]').forEach(el=>{const t=el.getAttribute('data-'+lang);if(t)el.textContent=t;});document.querySelectorAll('[data-placeholder-ar]').forEach(el=>{el.placeholder=el.getAttribute('data-placeholder-'+lang)||'';});}

// ===== FIREBASE =====
const firebaseConfig={apiKey:"AIzaSyCD_WW5D70AKhfxn_LwETu0lratwwKJ1vA",authDomain:"whoisbehindhim.firebaseapp.com",databaseURL:"https://whoisbehindhim-default-rtdb.firebaseio.com",projectId:"whoisbehindhim",storageBucket:"whoisbehindhim.firebasestorage.app",messagingSenderId:"1028014942254",appId:"1:1028014942254:web:689ae0bda39ca5fdf297bf"};
firebase.initializeApp(firebaseConfig);
const db=firebase.database(),auth=firebase.auth();

// ===== STATE =====
let myUid=null,myRoomId=null,isAdmin=false,myPlayerData={},avatarBase64=null;
let chatTimerInt=null,silenceInt=null,silenceSec=0,isSpectator=false,myVotes={};
let silenceWarnShown=false,readyAgainSet=false,lastPlayerCount=0;
let currentRound=1,myTotalScore=0,myRealName='';
let chatStarted=false,votingStarted=false,resultsStarted=false,voteSubmitted=false;
let unsubStatus=null,unsubPlayers=null,unsubMessages=null,unsubVotes=null,unsubReadyAgain=null,unsubStrip=null,voteProgressUnsub=null;

auth.signInAnonymously().then(u=>{myUid=u.user.uid;}).catch(e=>console.error(e));

function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

// ===== SCREENS =====
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');}

// ===== TOAST =====
function toast(msg,type='',dur=3200){
  const c=document.getElementById('toast-container'),d=document.createElement('div');
  d.className='toast '+(type||'');d.textContent=msg;c.appendChild(d);
  setTimeout(()=>{d.style.opacity='0';d.style.transition='opacity 0.3s';setTimeout(()=>d.remove(),300);},dur);
}

// ===== RESET =====
function hardReset(){
  detachAllListeners();stopBg();
  if(chatTimerInt)clearInterval(chatTimerInt);
  if(silenceInt)clearInterval(silenceInt);
  myRoomId=null;isAdmin=false;myPlayerData={};avatarBase64=null;
  myVotes={};silenceSec=0;isSpectator=false;silenceWarnShown=false;
  readyAgainSet=false;lastPlayerCount=0;currentRound=1;myTotalScore=0;myRealName='';
  chatStarted=false;votingStarted=false;resultsStarted=false;voteSubmitted=false;
  document.getElementById('kicked-overlay').classList.remove('active');
  document.getElementById('chat-messages').innerHTML='';
  document.getElementById('reveals-list').innerHTML='';
  document.getElementById('scores-list').innerHTML='';
  document.getElementById('vote-cards-container').innerHTML='';
  document.getElementById('btn-play-again').style.display='none';
  document.getElementById('btn-end-room').style.display='none';
  document.getElementById('ready-again-status').textContent='';
  showScreen('screen-landing');
}

function detachAllListeners(){
  if(!myRoomId)return;
  try{if(unsubStatus){db.ref('rooms/'+myRoomId+'/status').off('value',unsubStatus);unsubStatus=null;}}catch(e){}
  try{if(unsubPlayers){db.ref('rooms/'+myRoomId+'/players').off('value',unsubPlayers);unsubPlayers=null;}}catch(e){}
  try{if(unsubMessages){db.ref('rooms/'+myRoomId+'/messages').off('child_added',unsubMessages);unsubMessages=null;}}catch(e){}
  try{if(unsubStrip){db.ref('rooms/'+myRoomId+'/players').off('value',unsubStrip);unsubStrip=null;}}catch(e){}
  try{if(voteProgressUnsub){db.ref('rooms/'+myRoomId+'/votes').off('value',voteProgressUnsub);voteProgressUnsub=null;}}catch(e){}
  try{if(unsubReadyAgain){db.ref('rooms/'+myRoomId+'/readyAgain').off('value',unsubReadyAgain);unsubReadyAgain=null;}}catch(e){}
}

// ===== LANDING =====
function goToRoom(){
  playSound('click');
  if(!myUid){
    // Wait for auth then proceed
    toast(lang==='ar'?'جارٍ الاتصال...':'Connecting...','warning');
    const waitAuth=setInterval(()=>{
      if(myUid){clearInterval(waitAuth);showScreen('screen-room');}
    },200);
    setTimeout(()=>clearInterval(waitAuth),5000);
    return;
  }
  showScreen('screen-room');
}

// ===== ROOM =====
function showJoinForm(){playSound('click');document.getElementById('join-form').style.display='block';document.getElementById('room-created-display').style.display='none';}
function genCode(){return Math.random().toString(36).substring(2,8).toUpperCase();}

async function handleCreateRoom(){
  playSound('click');
  if(!myUid){toast(lang==='ar'?'جارٍ الاتصال':'Connecting','warning');return;}
  const code=genCode();myRoomId=code;isAdmin=true;currentRound=1;
  await db.ref('rooms/'+code).set({admin:myUid,status:'waiting',code,round:1,createdAt:Date.now()});
  document.getElementById('display-room-code').textContent=code;
  document.getElementById('room-created-display').style.display='block';
  document.getElementById('join-form').style.display='none';
  playSound('join');
}

function copyRoomCode(){playSound('click');navigator.clipboard.writeText(myRoomId||'').then(()=>toast(lang==='ar'?'تم نسخ الكود!':'Code copied!','success'));}

function proceedToSetup(){
  playSound('click');currentRound=1;myTotalScore=0;
  document.getElementById('real-name-group').style.display='flex';
  document.getElementById('real-name').value='';
  showScreen('screen-setup');
  document.getElementById('admin-start-wrap').style.display=isAdmin?'block':'none';
  document.getElementById('admin-end-wrap').style.display=isAdmin?'block':'none';
  document.getElementById('btn-end-room').style.display='none';
  setupListeners();
}

async function handleJoinRoom(){
  playSound('click');
  if(!myUid){toast(lang==='ar'?'جارٍ الاتصال':'Connecting','warning');return;}
  const code=document.getElementById('join-code-input').value.trim().toUpperCase();
  if(code.length<4){toast(lang==='ar'?'أدخل كود الغرفة':'Enter room code','error');return;}
  const snap=await db.ref('rooms/'+code).once('value');
  if(!snap.exists()){toast(lang==='ar'?'الغرفة غير موجودة':'Room not found','error');return;}
  const room=snap.val();
  if(room.status!=='waiting'){toast(lang==='ar'?'اللعبة بدأت بالفعل':'Game already started','error');return;}
  const ps=await db.ref('rooms/'+code+'/players').once('value');
  if(ps.exists()&&Object.keys(ps.val()).length>=6){toast(lang==='ar'?'الغرفة ممتلئة':'Room is full','error');return;}
  myRoomId=code;currentRound=room.round||1;myTotalScore=0;
  document.getElementById('real-name-group').style.display='flex';
  document.getElementById('real-name').value='';
  playSound('join');showScreen('screen-setup');
  document.getElementById('admin-start-wrap').style.display='none';
  document.getElementById('admin-end-wrap').style.display='none';
  setupListeners();
}

// ===== SETUP =====
function handleAvatarChange(e){
  const file=e.target.files[0];if(!file)return;
  if(file.size>3*1024*1024){toast(lang==='ar'?'الصورة أكبر من 3MB':'Image too large (max 3MB)','error');return;}
  const r=new FileReader();
  r.onload=ev=>{
    avatarBase64=ev.target.result;
    const img=document.getElementById('avatar-preview-img');
    img.src=avatarBase64;img.style.display='block';
    document.getElementById('avatar-placeholder').style.display='none';
    playSound('click');
  };
  r.readAsDataURL(file);
}

async function handleReady(){
  playSound('click');
  if(!myUid||!myRoomId){toast(lang==='ar'?'خطأ في الاتصال':'Connection error','error');return;}
  const charName=document.getElementById('char-name').value.trim();
  const charDesc=document.getElementById('char-desc').value.trim();
  const realName=currentRound>1?myRealName:document.getElementById('real-name').value.trim();
  if(!charName){toast(lang==='ar'?'أدخل اسم الشخصية':'Enter character name','error');return;}
  if(!charDesc){toast(lang==='ar'?'أدخل وصف الشخصية':'Enter character description','error');return;}
  if(currentRound===1&&!realName){toast(lang==='ar'?'أدخل اسمك الحقيقي':'Enter your real name','error');return;}
  if(!avatarBase64){toast(lang==='ar'?'ارفع صورة للشخصية':'Upload a character photo','error');return;}
  if(currentRound===1)myRealName=realName;
  const existSnap=await db.ref('rooms/'+myRoomId+'/players/'+myUid+'/totalScore').once('value');
  const savedTotal=existSnap.val()!=null?existSnap.val():myTotalScore;
  myPlayerData={uid:myUid,charName,charDesc,realName:myRealName,avatar:avatarBase64,isReady:true,isSpectator:false,roundScore:0,totalScore:savedTotal};
  await db.ref('rooms/'+myRoomId+'/players/'+myUid).set(myPlayerData);
  document.getElementById('btn-ready').disabled=true;
  playSound('ready');
  toast(lang==='ar'?'تم! في انتظار الآخرين':'Done! Waiting for others','success');
}

function setupListeners(){
  if(!myRoomId)return;
  detachAllListeners();lastPlayerCount=0;
  unsubPlayers=function(snap){
    const players=snap.val()||{},arr=Object.values(players);
    const readyCount=arr.filter(p=>p.isReady).length,total=arr.length;
    document.getElementById('players-count-badge').textContent=total+' / 6';
    document.getElementById('ready-progress').style.width=(total>0?(readyCount/total)*100:0)+'%';
    renderWaiting(players);
    if(total>lastPlayerCount&&lastPlayerCount>0)playSound('join');
    lastPlayerCount=total;
    if(isAdmin){
      const canStart=readyCount===total&&total>=2&&total<=6;
      document.getElementById('btn-start-game').disabled=!canStart;
      document.getElementById('start-hint').textContent=canStart?(lang==='ar'?'الجميع جاهز — يمكنك البدء!':'All ready — start now!'):(lang==='ar'?`في انتظار الجميع (${readyCount}/${total})`:`Waiting (${readyCount}/${total})`);
    }
  };
  db.ref('rooms/'+myRoomId+'/players').on('value',unsubPlayers);
  unsubStatus=function(snap){
    const st=snap.val();
    if(st==='chatting')startChat();
    else if(st==='voting')startVoting();
    else if(st==='results')startResults();
    else if(st==='ended')onRoomEnded();
    else if(st==='waiting'&&(chatStarted||votingStarted||resultsStarted))resetForNewRound();
  };
  db.ref('rooms/'+myRoomId+'/status').on('value',unsubStatus);
}

function renderWaiting(players){
  const g=document.getElementById('players-waiting-grid');g.innerHTML='';
  Object.values(players).forEach(p=>{
    const d=document.createElement('div');
    d.className='player-waiting-card'+(p.isReady?' ready':'');
    d.innerHTML=`<img src="${p.avatar}" class="avatar avatar-sm" style="display:block;margin:0 auto"><div class="player-waiting-name">${escH(p.charName)}</div><div class="player-waiting-status${p.isReady?' ok':''}">${p.isReady?(lang==='ar'?'جاهز':'Ready'):(lang==='ar'?'يُعدّ...':'Setting up...')}</div>`;
    g.appendChild(d);
  });
}

async function handleStartGame(){playSound('gameStart');await db.ref('rooms/'+myRoomId+'/chatStartedAt').set(Date.now());await db.ref('rooms/'+myRoomId+'/status').set('chatting');}

async function handleAdminEndRoom(){
  if(!isAdmin)return;playSound('click');
  await db.ref('rooms/'+myRoomId+'/status').set('ended');
  setTimeout(async()=>{await db.ref('rooms/'+myRoomId).remove();hardReset();},2000);
}

function onRoomEnded(){
  if(isAdmin)return;
  detachAllListeners();stopBg();
  if(chatTimerInt)clearInterval(chatTimerInt);
  if(silenceInt)clearInterval(silenceInt);
  document.getElementById('kicked-overlay').classList.add('active');
}

// ===== CHAT =====
let chatEndTime=null;
function startChat(){
  if(chatStarted)return;chatStarted=true;
  showScreen('screen-chat');startBg();playSound('gameStart');
  document.getElementById('chat-room-code-display').textContent=myRoomId;
  isSpectator=false;silenceSec=0;silenceWarnShown=false;
  document.getElementById('chat-input-wrap').style.display='flex';
  document.getElementById('spectator-notice').style.display='none';
  document.getElementById('chat-messages').innerHTML='';
  db.ref('rooms/'+myRoomId+'/chatStartedAt').once('value').then(snap=>{
    chatEndTime=(snap.val()||Date.now())+600000;startChatTimer();
  });
  renderChatStrip();
  if(!unsubMessages){
    unsubMessages=function(snap){const msg=snap.val();renderMsg(msg);if(msg.uid!==myUid)playSound('messageIn',.7);};
    db.ref('rooms/'+myRoomId+'/messages').on('child_added',unsubMessages);
  }
  resetSilence();startSilence();
}

function startChatTimer(){
  if(chatTimerInt)clearInterval(chatTimerInt);
  chatTimerInt=setInterval(()=>{
    const rem=chatEndTime-Date.now();
    if(rem<=0){clearInterval(chatTimerInt);chatTimerInt=null;document.getElementById('chat-timer-display').textContent='00:00';if(isAdmin)db.ref('rooms/'+myRoomId+'/status').set('voting');playSound('timerEnd');return;}
    const m=Math.floor(rem/60000),s=Math.floor((rem%60000)/1000);
    const el=document.getElementById('chat-timer-display');
    el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
    el.className='timer-text'+(rem<60000?' danger':'');
    if(rem<62000&&rem>60000)playSound('warning',.5);
  },1000);
}

function startSilence(){
  if(silenceInt)clearInterval(silenceInt);
  silenceInt=setInterval(()=>{
    if(isSpectator){clearInterval(silenceInt);silenceInt=null;return;}
    silenceSec++;
    document.getElementById('silence-bar-fill').style.width=Math.min((silenceSec/60)*100,100)+'%';
    if(silenceSec>=50&&!silenceWarnShown){silenceWarnShown=true;toast(lang==='ar'?'تحذير: 10 ثوانٍ للإرسال وإلا ستصبح مشاهداً!':'Warning: 10s to send or become spectator!','warning',4000);playSound('warning',.4);}
    if(silenceSec>=60){clearInterval(silenceInt);silenceInt=null;becomeSpectator();}
  },1000);
}

function resetSilence(){silenceSec=0;silenceWarnShown=false;document.getElementById('silence-bar-fill').style.width='0%';}

async function becomeSpectator(){
  if(isSpectator)return;isSpectator=true;
  await db.ref('rooms/'+myRoomId+'/players/'+myUid+'/isSpectator').set(true);
  document.getElementById('chat-input-wrap').style.display='none';
  document.getElementById('spectator-notice').style.display='flex';
  playSound('spectator');
  addSysMsg(lang==='ar'?`"${myPlayerData.charName}" أصبح مشاهداً`:`"${myPlayerData.charName}" is now spectating`,'warning');
  toast(lang==='ar'?'أصبحت مشاهداً — لا نقاط هذه الجولة':'You are now spectating — no points this round','error',5000);
}

function renderChatStrip(){
  const strip=document.getElementById('chat-players-strip');
  if(unsubStrip){db.ref('rooms/'+myRoomId+'/players').off('value',unsubStrip);unsubStrip=null;}
  unsubStrip=function(snap){
    strip.innerHTML='';
    Object.values(snap.val()||{}).forEach(p=>{
      const d=document.createElement('div');d.className='chat-player-avatar';
      d.innerHTML=`<img src="${p.avatar}" class="avatar avatar-sm" style="${p.isSpectator?'opacity:.4;filter:grayscale(1)':''}">${p.isSpectator?'<div class="spectator-dot"></div>':''}`;
      d.onclick=()=>openModal(p);strip.appendChild(d);
    });
  };
  db.ref('rooms/'+myRoomId+'/players').on('value',unsubStrip);
}

function renderMsg(msg){
  const c=document.getElementById('chat-messages');
  if(msg.system){const d=document.createElement('div');d.className='msg-system'+(msg.warning?' warning-msg':'');d.textContent=msg.text;c.appendChild(d);c.scrollTop=c.scrollHeight;return;}
  const isMe=msg.uid===myUid,d=document.createElement('div');d.className='msg-wrap'+(isMe?' mine':'');
  const t=new Date(msg.ts),ts=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
  const pStr=JSON.stringify(msg.player).replace(/"/g,'&quot;');
  d.innerHTML=`<div class="msg-avatar" onclick='openModal(${pStr})'><img src="${msg.player.avatar}" class="avatar avatar-sm"></div><div class="msg-bubble-wrap"><div class="msg-name">${escH(msg.player.charName)}</div><div class="msg-bubble">${escH(msg.text)}</div><div class="msg-time">${ts}</div></div>`;
  c.appendChild(d);c.scrollTop=c.scrollHeight;
}

function addSysMsg(text,type=''){
  const c=document.getElementById('chat-messages'),d=document.createElement('div');
  d.className='msg-system'+(type==='warning'?' warning-msg':'');d.textContent=text;c.appendChild(d);c.scrollTop=c.scrollHeight;
}

function handleChatKeydown(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}

async function sendMessage(){
  if(isSpectator)return;
  const inp=document.getElementById('chat-input'),text=inp.value.trim();if(!text)return;
  inp.value='';playSound('click',.5);resetSilence();startSilence();
  db.ref('rooms/'+myRoomId+'/players/'+myUid+'/lastMsg').set(Date.now());
  await db.ref('rooms/'+myRoomId+'/messages').push({uid:myUid,text,ts:Date.now(),player:{charName:myPlayerData.charName,avatar:myPlayerData.avatar,uid:myUid}});
}

// ===== VOTING =====
async function startVoting(){
  if(votingStarted)return;votingStarted=true;
  stopBg();if(chatTimerInt){clearInterval(chatTimerInt);chatTimerInt=null;}if(silenceInt){clearInterval(silenceInt);silenceInt=null;}
  showScreen('screen-voting');
  const snap=await db.ref('rooms/'+myRoomId+'/players').once('value');
  const players=snap.val()||{},me=players[myUid];
  isSpectator=me?.isSpectator||false;myVotes={};
  if(isSpectator){
    document.getElementById('vote-cards-container').innerHTML=`<div class="glass-card" style="text-align:center;padding:40px"><svg viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" style="width:48px;height:48px;display:block;margin:0 auto 16px"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><div style="font-size:18px;font-weight:800;margin-bottom:8px">${lang==='ar'?'أنت مشاهد':'You are spectating'}</div><div style="font-size:13px;color:var(--text-dim)">${lang==='ar'?'لا يمكنك التصويت هذه الجولة':'You cannot vote this round'}</div></div>`;
    listenVoteProgress(players);return;
  }
  renderVoteCards(players);listenVoteProgress(players);
}

function renderVoteCards(players){
  const c=document.getElementById('vote-cards-container');c.innerHTML='';
  // Show all players' characters (including mine) but I vote on all OTHERS
  // Options for each character = all real names EXCEPT the character's own real name
  const allPlayers=Object.values(players);
  const othersChars=allPlayers.filter(p=>p.uid!==myUid); // characters I need to guess
  const allRealNames=allPlayers.map(p=>({uid:p.uid,name:p.realName})); // all real names as options

  othersChars.forEach(char=>{
    const card=document.createElement('div');card.className='vote-card';card.id='vc-'+char.uid;
    // Show all real names as options (voter tries to match char to its real owner)
    const opts=allRealNames.map(r=>`<button class="vote-option" onclick="selVote('${char.uid}','${r.uid}')" id="vo-${char.uid}-${r.uid}">${escH(r.name)}</button>`).join('');
    card.innerHTML=`<div class="vote-card-header"><img src="${char.avatar}" class="avatar avatar-lg"><div><div class="vote-char-name">${escH(char.charName)}</div><div class="vote-char-desc">${escH(char.charDesc)}</div></div></div><div class="vote-question">${lang==='ar'?'من يقف خلف هذه الشخصية؟':'Who is behind this character?'}</div><div class="vote-options">${opts}</div>`;
    c.appendChild(card);
  });
  checkVotes();
}

function selVote(cUid,gUid){
  playSound('votePick');myVotes[cUid]=gUid;
  document.querySelectorAll(`[id^="vo-${cUid}-"]`).forEach(b=>b.classList.remove('selected'));
  document.getElementById(`vo-${cUid}-${gUid}`)?.classList.add('selected');
  document.getElementById('vc-'+cUid)?.classList.add('voted');
  checkVotes();
}

function checkVotes(){
  const n=document.querySelectorAll('.vote-card').length;
  document.getElementById('btn-submit-vote').disabled=Object.keys(myVotes).length<n||n===0;
}

async function submitVotes(){
  if(voteSubmitted)return;voteSubmitted=true;
  playSound('ready');
  await db.ref('rooms/'+myRoomId+'/votes/'+myUid).set(myVotes);
  document.getElementById('btn-submit-vote').disabled=true;
  toast(lang==='ar'?'تم إرسال تصويتك! في انتظار الآخرين...':'Vote submitted! Waiting for others...','success');
}

function listenVoteProgress(players){
  const active=Object.values(players).filter(p=>!p.isSpectator);
  const tot=active.length;
  if(voteProgressUnsub){db.ref('rooms/'+myRoomId+'/votes').off('value',voteProgressUnsub);voteProgressUnsub=null;}
  // Edge case: if everyone is spectator, go to results immediately
  if(tot===0&&isAdmin){
    calcResults(players,{});
    return;
  }
  voteProgressUnsub=async function(snap){
    const votes=snap.val()||{},n=Object.keys(votes).length;
    document.getElementById('vote-progress-text').textContent=n+'/'+tot;
    document.getElementById('vote-progress-bar').style.width=(tot>0?(n/tot)*100:0)+'%';
    if(isAdmin&&n>=tot&&tot>0){
      db.ref('rooms/'+myRoomId+'/votes').off('value',voteProgressUnsub);voteProgressUnsub=null;
      const ps=await db.ref('rooms/'+myRoomId+'/players').once('value');
      await calcResults(ps.val()||{},votes);
    }
  };
  db.ref('rooms/'+myRoomId+'/votes').on('value',voteProgressUnsub);
}

async function calcResults(players,votes){
  const roundScores={};
  Object.keys(players).forEach(uid=>{roundScores[uid]=0;});
  // votes structure: { voterUid: { charOwnerUid: guessedRealOwnerUid } }
  // A point = voter guessed charOwnerUid === guessedRealOwnerUid (correct match)
  // Spectators get 0 regardless
  Object.entries(votes).forEach(([voterUid,voterVotes])=>{
    if(players[voterUid]?.isSpectator) return;
    Object.entries(voterVotes).forEach(([charOwnerUid,guessedUid])=>{
      if(charOwnerUid===guessedUid){
        roundScores[voterUid]=(roundScores[voterUid]||0)+1;
      }
    });
  });
  for(const uid in players){
    const rs=players[uid].isSpectator?0:(roundScores[uid]||0);
    const prevTotal=players[uid].totalScore||0;
    await db.ref('rooms/'+myRoomId+'/players/'+uid).update({roundScore:rs,totalScore:prevTotal+rs});
  }
  await db.ref('rooms/'+myRoomId+'/round').set(currentRound);
  await db.ref('rooms/'+myRoomId+'/status').set('results');
}

// ===== RESULTS =====
async function startResults(){
  if(resultsStarted)return;resultsStarted=true;
  showScreen('screen-results');playSound('winner');
  const snap=await db.ref('rooms/'+myRoomId+'/players').once('value');
  const players=snap.val()||{},arr=Object.values(players);
  if(players[myUid])myTotalScore=players[myUid].totalScore||0;
  const roundSnap=await db.ref('rooms/'+myRoomId+'/round').once('value');
  const roundNum=roundSnap.val()||1;
  document.getElementById('results-round-badge').textContent=lang==='ar'?`نتائج الجولة ${roundNum}`:`Round ${roundNum} Results`;
  renderReveals(arr);
  setTimeout(()=>renderScores(arr,roundNum),arr.length*620+400);
  if(isAdmin){document.getElementById('btn-play-again').style.display='inline-flex';document.getElementById('btn-end-room').style.display='inline-flex';}
  listenReadyAgain(arr);
}

function renderReveals(arr){
  const list=document.getElementById('reveals-list');list.innerHTML='';
  arr.forEach((p,i)=>{
    const d=document.createElement('div');d.className='reveal-card';
    d.innerHTML=`<div class="reveal-char-side"><img src="${p.avatar}" class="avatar avatar-sm"><div><div class="reveal-label">${lang==='ar'?'الشخصية':'Character'}</div><div class="reveal-name">${escH(p.charName)}</div></div></div><div class="reveal-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></div><div class="reveal-real-side"><div><div class="reveal-label">${lang==='ar'?'الشخص الحقيقي':'Real Person'}</div><div class="reveal-name">${escH(p.realName)}</div></div></div>`;
    setTimeout(()=>{d.classList.add('shown');playSound('reveal');},i*620);
    list.appendChild(d);
  });
}

function renderScores(arr,roundNum){
  const sorted=[...arr].sort((a,b)=>(b.totalScore||0)-(a.totalScore||0));
  const list=document.getElementById('scores-list');list.innerHTML='';
  const isFirst=roundNum===1;
  sorted.forEach((p,i)=>{
    const d=document.createElement('div');d.className='score-card'+(i===0?' first-place':'');
    const rs=p.roundScore||0,ts=p.totalScore||0;
    const pts=isFirst
      ?`<div class="score-points-wrap"><div class="score-points-round${i===0?' first':''}">${p.isSpectator?'—':rs}</div><div class="score-points-label">${lang==='ar'?'نقطة':'pts'}</div></div>`
      :`<div class="score-points-wrap"><div class="score-points-round${i===0?' first':''}">${p.isSpectator?'—':'+'+rs}</div><div class="score-points-label">${lang==='ar'?'هذه الجولة':'this round'}</div><div class="score-points-total">${lang==='ar'?'الإجمالي:':'Total:'} ${p.isSpectator?'—':ts}</div></div>`;
    d.innerHTML=`<div class="score-rank${i===0?' first':''}">${i===0?'★':(i+1)}</div><img src="${p.avatar}" class="avatar avatar-xl"><div class="score-info"><div class="score-char-name">${escH(p.charName)}</div><div class="score-real-name">${escH(p.realName)}</div>${p.isSpectator?`<div class="score-spectator-note">${lang==='ar'?'مشاهد':'Spectator'}</div>`:''}</div>${pts}`;
    list.appendChild(d);
  });
}

function listenReadyAgain(arr){
  if(unsubReadyAgain){try{db.ref('rooms/'+myRoomId+'/readyAgain').off('value',unsubReadyAgain);}catch(e){}unsubReadyAgain=null;}
  unsubReadyAgain=function(snap){
    const n=Object.keys(snap.val()||{}).length,tot=arr.length;
    document.getElementById('ready-again-status').textContent=lang==='ar'?`${n}/${tot} جاهزون للجولة التالية`:`${n}/${tot} ready for next round`;
  };
  db.ref('rooms/'+myRoomId+'/readyAgain').on('value',unsubReadyAgain);
}

async function handleReadyAgain(){
  if(readyAgainSet)return;readyAgainSet=true;playSound('click');
  await db.ref('rooms/'+myRoomId+'/readyAgain/'+myUid).set(true);
  document.getElementById('btn-ready-again').disabled=true;
  toast(lang==='ar'?'تم! في انتظار الآخرين':'Done! Waiting for others','success');
}

async function handlePlayAgain(){
  playSound('gameStart');currentRound++;
  await db.ref('rooms/'+myRoomId+'/round').set(currentRound);
  const snap=await db.ref('rooms/'+myRoomId+'/players').once('value');
  const pl=snap.val()||{};
  for(const uid in pl){
    await db.ref('rooms/'+myRoomId+'/players/'+uid).update({isReady:false,isSpectator:false,roundScore:0,charName:'',charDesc:'',avatar:'',lastMsg:null});
  }
  await db.ref('rooms/'+myRoomId+'/messages').remove();
  await db.ref('rooms/'+myRoomId+'/votes').remove();
  await db.ref('rooms/'+myRoomId+'/readyAgain').remove();
  await db.ref('rooms/'+myRoomId+'/chatStartedAt').remove();
  await db.ref('rooms/'+myRoomId+'/status').set('newround');
  setTimeout(async()=>{await db.ref('rooms/'+myRoomId+'/status').set('waiting');},300);
}

function resetForNewRound(){
  detachAllListeners();
  chatStarted=false;votingStarted=false;resultsStarted=false;
  readyAgainSet=false;voteSubmitted=false;isSpectator=false;
  myVotes={};avatarBase64=null;silenceSec=0;silenceWarnShown=false;
  if(chatTimerInt){clearInterval(chatTimerInt);chatTimerInt=null;}
  if(silenceInt){clearInterval(silenceInt);silenceInt=null;}
  stopBg();
  db.ref('rooms/'+myRoomId+'/round').once('value').then(snap=>{currentRound=snap.val()||currentRound;});
  document.getElementById('chat-messages').innerHTML='';
  document.getElementById('reveals-list').innerHTML='';
  document.getElementById('scores-list').innerHTML='';
  document.getElementById('vote-cards-container').innerHTML='';
  document.getElementById('btn-play-again').style.display='none';
  document.getElementById('btn-end-room').style.display='none';
  document.getElementById('btn-ready-again').disabled=false;
  document.getElementById('ready-again-status').textContent='';
  document.getElementById('btn-ready').disabled=false;
  document.getElementById('btn-submit-vote').disabled=true;
  document.getElementById('char-name').value='';
  document.getElementById('char-desc').value='';
  document.getElementById('avatar-file').value='';
  document.getElementById('avatar-preview-img').style.display='none';
  document.getElementById('avatar-placeholder').style.display='flex';
  document.getElementById('real-name-group').style.display='none';
  showScreen('screen-setup');
  document.getElementById('admin-start-wrap').style.display=isAdmin?'block':'none';
  document.getElementById('admin-end-wrap').style.display=isAdmin?'block':'none';
  lastPlayerCount=0;
  setupListeners();
}

// ===== PROFILE MODAL =====
function openModal(p){
  if(typeof p==='string')try{p=JSON.parse(p);}catch(e){return;}
  playSound('click');
  document.getElementById('modal-avatar').src=p.avatar||'';
  document.getElementById('modal-char-name').textContent=p.charName||'';
  document.getElementById('modal-char-desc').textContent=p.charDesc||'';
  document.getElementById('profile-modal').classList.add('active');
}
function closeModal(){playSound('click');document.getElementById('profile-modal').classList.remove('active');}
document.getElementById('profile-modal').addEventListener('click',function(e){if(e.target===this)closeModal();});

// ===== DEV MODAL =====
function openDevModal(){playSound('click');document.getElementById('dev-modal').classList.add('active');}
function closeDevModal(){playSound('click');document.getElementById('dev-modal').classList.remove('active');}
document.getElementById('dev-modal').addEventListener('click',function(e){if(e.target===this)closeDevModal();});

// ===== SERVICE WORKER =====
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
  });
}

applyLang();
