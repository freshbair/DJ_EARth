(function(global){
  'use strict';
  const $=id=>document.getElementById(id), player=global.DJEarthCountryTemperature;
  const Recognition=global.SpeechRecognition||global.webkitSpeechRecognition;
  let enabled=false, phase='off', recognizer=null, timer, run=0, audio, cancelSpeech, resumeOnVisible=false;
  let welcomed=false, welcoming=false, lastRetry=0;
  const introduction='Say Hey DJ to hear a temperature melody for your country.';
  function open(){ $('voiceAssistant').hidden=false;$('djLauncher').setAttribute('aria-expanded','true');$('djVoiceTitle').focus({preventScroll:true}); }
  function close(){ $('voiceAssistant').hidden=true;$('djLauncher').setAttribute('aria-expanded','false');$('djLauncher').focus({preventScroll:true}); }
  function status(text){$('djVoiceStatus').textContent=text;}
  function suspend(){clearTimeout(timer);const r=recognizer;recognizer=null;if(r){r.onend=null;r.onresult=null;r.onerror=null;try{r.abort();}catch{}}}
  function stop(){
    run++;enabled=false;phase='off';suspend();cancelSpeech?.();global.speechSynthesis?.cancel();player.stop();
    $('djMicState').textContent='Mic off';$('djEnable').textContent='Enable microphone';
    status('Voice assistant off. Microphone is not listening.');$('djMelody').textContent='Melody stopped.';
  }
  function listen(){
    if(welcoming||!enabled||recognizer||!Recognition||!['wake','country','playing'].includes(phase))return;
    const r=new Recognition();recognizer=r;r.lang='en-US';r.continuous=true;r.interimResults=false;r.maxAlternatives=5;
    r.onresult=e=>{
      if(recognizer!==r||welcoming||!['wake','country','playing'].includes(phase))return;
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal===false)continue;
        const alternatives=Array.from(e.results[i]).map(a=>a.transcript.trim()).filter(Boolean);
        if(phase==='country'){
          const candidates=alternatives.map(text=>player.resolve(text)).filter(Boolean);
          const unique=[...new Set(candidates)];
          if(unique.length===1)void country(null,unique[0]);
          else if(alternatives.some(text=>/^(stop|cancel)$/i.test(text)))stop();
          else void retryCountry();
        }else{
          const command=alternatives.find(text=>/\bhey (dj|d j|deejay|dee jay)\b/i.test(text))||alternatives[0];
          if(command)void heard(command);
        }
        break;
      }
    };
    r.onnomatch=()=>{if(recognizer===r)void retryCountry();};
    r.onend=()=>{
      if(recognizer!==r)return;
      recognizer=null;enabled=false;
      $('djMicState').textContent='Mic off';$('djEnable').textContent='Enable microphone';
      status('Microphone session ended. Use Enable microphone to listen again.');
    };
    r.onerror=e=>{
      if(recognizer!==r)return;
      if(['no-speech','aborted'].includes(e.error))return;
      stop();void speak(e.error==='not-allowed'?'Chrome blocked microphone access. Allow the microphone in site settings, then reload and click the page.':`Voice recognition unavailable: ${e.error}. Check your microphone and internet connection, then reload.`);
    };
    try{r.start();}catch{recognizer=null;stop();void speak('Could not start the microphone. Check browser site permissions, then reload.');}
  }
  async function retryCountry(){
    if(phase!=='country'||welcoming||Date.now()-lastRetry<4000)return;
    lastRetry=Date.now();const current=run;phase='speaking';
    await speak('I did not catch that clearly. Please say just the country name.');
    if(current===run){phase='country';listen();}
  }
  function speak(text){
    status(text);
    return new Promise(resolve=>{
      if(!global.speechSynthesis||!global.SpeechSynthesisUtterance){resolve();return;}
      let done=false;const finish=(success=false)=>{if(done)return;done=true;clearTimeout(timeout);cancelSpeech=null;resolve(success);};
      const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.95;
      utterance.onend=()=>finish(true);utterance.onerror=()=>finish(false);const timeout=setTimeout(finish,20000);cancelSpeech=finish;
      global.speechSynthesis.speak(utterance);
    });
  }
  async function chime(){
    audio ||= new (global.AudioContext||global.webkitAudioContext)();
    await Promise.race([audio.resume(),new Promise(resolve=>setTimeout(resolve,800))]);
    if(audio.state!=='running')throw Error('Your browser needs a click to enable sound. Click anywhere on the page, then say Hey DJ again.');
    const now=audio.currentTime;
    [660,880].forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=hz;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(0,now+i*.12);g.gain.linearRampToValueAtTime(.07,now+i*.12+.015);g.gain.linearRampToValueAtTime(0,now+i*.12+.12);o.start(now+i*.12);o.stop(now+i*.12+.13);o.onended=()=>{o.disconnect();g.disconnect();};});
    await new Promise(r=>setTimeout(r,280));
  }
  async function wake(){
    open();
    const current=++run;phase='speaking';cancelSpeech?.();global.speechSynthesis?.cancel();player.stop();global.djEarthApp?.stop();global.djEarthSolo?.stop();
    try{await chime();}catch(error){if(current===run){phase='wake';status(error.message);listen();}return;}
    if(current!==run)return;
    await speak('What country are you in right now?');
    if(current!==run)return;phase='country';status(enabled?'Listening for your country. You can say: I am in Lebanon.':'Type your country below, enable microphone access in browser settings.');listen();
  }
  async function country(text,location){
    if(document.body.dataset.track!=='1')document.querySelector('[data-track-index="1"]')?.click();
    const current=++run;phase='loading';cancelSpeech?.();global.speechSynthesis?.cancel();player.stop();
    const selected=location||player.resolve(text);
    if(!selected){phase='speaking';await speak('I did not recognize that country. Please say its full name.');if(current!==run)return;phase='country';listen();return;}
    status(`Preparing the temperature melody for ${selected.name}...`);
    try{
      const prepared=await player.prepare(selected);if(current!==run)return;
      $('djForecast').textContent=prepared.announcement;
      if(current!==run)return;
      phase='playing';prepared.start();status(`Playing ${selected.name}. ${enabled?'Say stop or Hey DJ.':'Use Stop assistant to end playback.'}`);listen();
    }catch(error){if(current!==run)return;phase='speaking';await speak(error.message||'The reference melody could not start. Please try again.');if(current!==run)return;phase='country';listen();}
  }
  async function heard(text){
    const normalized=text.toLowerCase().replace(/[.,!?]/g,'').trim();
    if(/^(stop|stop dj|stop music|stop assistant|cancel)$/.test(normalized)){stop();return;}
    if(/\bhey (dj|d j|deejay|dee jay)\b/.test(normalized)){await wake();return;}
    if(phase==='country')await country(text);
  }
  function enable(){
    if(enabled)return;
    if(!Recognition){status('Voice recognition is not supported here. Try a browser that supports speech recognition.');return;}
    enabled=true;phase='wake';
    $('djMicState').textContent='Listening';$('djEnable').textContent='Disable microphone';
    // Prime audio during this user gesture; a failed sample load is reported when used.
    void player.prime().catch(()=>{});
    try{audio ||= new (global.AudioContext||global.webkitAudioContext)();void audio.resume();}catch{}
    status('Microphone enabled. Say Hey DJ. Your browser may send audio to its speech-recognition service.');listen();
  }
  async function welcome(){
    if(welcomed||welcoming||!['off','wake'].includes(phase)||document.hidden)return;
    welcoming=true;const current=run;
    try{welcomed=Boolean(await speak(introduction));}finally{welcoming=false;if(current===run)listen();}
  }
  function primeAudio(event){
    if(event?.target?.closest?.('#djStop, #djEnable, #djAsk, #djWelcome'))return;
    void player.prime().catch(()=>{});
    try{audio ||= new (global.AudioContext||global.webkitAudioContext)();void audio.resume();}catch{}
    // Speech recognition itself requests permission. A Permissions API query
    // only reports permission; it cannot grant or request it.
    if(!enabled&&!document.hidden)enable();
    if(welcoming){cancelSpeech?.();global.speechSynthesis?.cancel();setTimeout(()=>void welcome(),0);}
    else void welcome();
  }
  $('djLauncher').addEventListener('click',()=>{if($('voiceAssistant').hidden)open();else close();});
  $('djClose').addEventListener('click',close);
  $('voiceAssistant').addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.preventDefault();}});
  $('djEnable').addEventListener('click',()=>{if(enabled)stop();else{enable();void welcome();}});
  $('djAsk').addEventListener('click',()=>{enable();void wake();});
  $('djStop').addEventListener('click',stop);
  $('djWelcome').addEventListener('click',()=>{stop();welcomed=false;void welcome();});
  $('djCountryForm').addEventListener('submit',e=>{e.preventDefault();void country($('djCountry').value);});
  for(const c of global.DJEarthCountries){const o=document.createElement('option');o.value=c.name;$('djCountries').append(o);}
  document.addEventListener('pointerdown',primeAudio,{once:true});
  document.addEventListener('keydown',primeAudio,{once:true});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){resumeOnVisible=enabled;stop();}
    else if(resumeOnVisible){resumeOnVisible=false;void autoEnable();}
  });
  global.addEventListener('pagehide',stop);
  for(const el of document.querySelectorAll('[data-track-index], #soloNote, #soloSingle, #soloPhrase, #soloStop, #stopScan, #sourceCanvas, #hearMapPoint, #no2Play, #no2Reference'))el.addEventListener('click',()=>{
    const wasEnabled=enabled;stop();if(wasEnabled)enable();
  });
  if(!Recognition)status('Voice recognition is not supported in this browser. Try a browser that supports speech recognition.');
  global.DJEarthVoice=Object.freeze({stop,getState:()=>({enabled,phase})});
  async function autoEnable(){
    if(!Recognition||document.hidden)return;
    const current=run;
    try{
      const permission=await navigator.permissions.query({name:'microphone'});
      if(current!==run||document.hidden)return;
      permission.onchange=()=>{if(permission.state==='granted'&&!document.hidden)enable();else if(permission.state==='denied')stop();};
      if(permission.state!=='denied')enable();
      else status(permission.state==='denied'?'Microphone is blocked in browser settings. Allow it in browser site settings.':'Your browser needs microphone permission once. Allow microphone access in browser site settings; saved permission will be reused.');
    }catch{enable();}
  }
  void autoEnable();
  void welcome();
})(globalThis);
