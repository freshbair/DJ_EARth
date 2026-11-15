(function(global){
  'use strict';
  const $=id=>document.getElementById(id), player=global.DJEarthCountryTemperature;
  const Recognition=global.SpeechRecognition||global.webkitSpeechRecognition;
  let enabled=false, phase='off', recognizer=null, timer, run=0, audio, cancelSpeech, resumeOnVisible=false;
  function open(){ $('voiceAssistant').hidden=false;$('djLauncher').setAttribute('aria-expanded','true');$('djVoiceTitle').focus({preventScroll:true}); }
  function close(){ $('voiceAssistant').hidden=true;$('djLauncher').setAttribute('aria-expanded','false');$('djLauncher').focus({preventScroll:true}); }
  function status(text){$('djVoiceStatus').textContent=text;}
  function suspend(){clearTimeout(timer);const r=recognizer;recognizer=null;if(r){r.onend=null;r.onresult=null;r.onerror=null;try{r.abort();}catch{}}}
  function stop(){
    run++;enabled=false;phase='off';suspend();cancelSpeech?.();global.speechSynthesis?.cancel();player.stop();
    $('djEnable').setAttribute('aria-pressed','false');$('djEnable').textContent='Enable voice';
    $('djMicState').textContent='Mic off';
    status('Voice assistant off. Microphone is not listening.');$('djMelody').textContent='Melody stopped.';
  }
  function listen(){
    if(!enabled||recognizer||!Recognition||!['wake','country','playing'].includes(phase))return;
    const r=new Recognition();recognizer=r;r.lang='en-US';r.continuous=false;r.interimResults=false;
    r.onresult=e=>{if(recognizer!==r)return;const text=e.results[e.resultIndex][0].transcript;void heard(text);};
    r.onend=()=>{if(recognizer!==r)return;recognizer=null;if(enabled)timer=setTimeout(listen,350);};
    r.onerror=e=>{
      if(recognizer!==r)return;
      if(['no-speech','aborted'].includes(e.error))return;
      stop();status(e.error==='not-allowed'?'Microphone permission was denied. Enable it in your browser, or type your country below.':`Voice recognition unavailable (${e.error}). Type your country below, or try enabling voice again.`);
    };
    try{r.start();}catch{recognizer=null;stop();status('Could not start the microphone. Use the typed-country option.');}
  }
  function speak(text){
    status(text);suspend();
    return new Promise(resolve=>{
      if(!global.speechSynthesis||!global.SpeechSynthesisUtterance){resolve();return;}
      let done=false;const finish=()=>{if(done)return;done=true;clearTimeout(timeout);cancelSpeech=null;resolve();};
      const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.95;
      utterance.onend=finish;utterance.onerror=finish;const timeout=setTimeout(finish,20000);cancelSpeech=finish;
      global.speechSynthesis.speak(utterance);
    });
  }
  async function chime(){
    audio ||= new (global.AudioContext||global.webkitAudioContext)();
    await Promise.race([audio.resume(),new Promise(resolve=>setTimeout(resolve,800))]);
    if(audio.state!=='running')throw Error('Your browser needs a click to enable sound. Tap Ask me my country to continue.');
    const now=audio.currentTime;
    [660,880].forEach((hz,i)=>{const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=hz;o.connect(g);g.connect(audio.destination);g.gain.setValueAtTime(0,now+i*.12);g.gain.linearRampToValueAtTime(.07,now+i*.12+.015);g.gain.linearRampToValueAtTime(0,now+i*.12+.12);o.start(now+i*.12);o.stop(now+i*.12+.13);o.onended=()=>{o.disconnect();g.disconnect();};});
    await new Promise(r=>setTimeout(r,280));
  }
  async function wake(){
    open();
    const current=++run;phase='speaking';suspend();cancelSpeech?.();global.speechSynthesis?.cancel();player.stop();global.djEarthApp?.stop();global.djEarthSolo?.stop();
    try{await chime();}catch(error){if(current===run){phase='wake';status(error.message);listen();}return;}
    if(current!==run)return;
    await speak('What country are you in right now?');
    if(current!==run)return;phase='country';status(enabled?'Listening for your country. You can say: I am in Lebanon.':'Type your country below, or enable voice to answer with the microphone.');listen();
  }
  async function country(text){
    const current=++run;phase='loading';suspend();cancelSpeech?.();global.speechSynthesis?.cancel();player.stop();
    const selected=player.resolve(text);
    if(!selected){phase='speaking';await speak('I did not recognize that country. Please say its full name, or type it below.');if(current!==run)return;phase='country';listen();return;}
    $('djCountry').value=selected.name;
    status(`Preparing the temperature melody for ${selected.name}...`);
    try{
      const prepared=await player.prepare(selected);if(current!==run)return;
      phase='speaking';await speak(`Playing an approximate reference-map temperature melody for ${selected.name}. This is not today's weather.`);
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
    if(!Recognition){status('Voice recognition is not supported here. Use the typed-country option below.');return;}
    enabled=true;phase='wake';$('djEnable').setAttribute('aria-pressed','true');$('djEnable').textContent='Disable microphone';
    $('djMicState').textContent='Listening';
    // Prime audio during this user gesture; a failed sample load is reported when used.
    void player.prime().catch(()=>{});
    try{audio ||= new (global.AudioContext||global.webkitAudioContext)();void audio.resume();}catch{}
    status('Microphone enabled. Say Hey DJ. Your browser may send audio to its speech-recognition service.');listen();
  }
  $('djEnable').addEventListener('click',()=>{if(enabled)stop();else enable();});
  $('djLauncher').addEventListener('click',()=>{
    void player.prime().catch(()=>{});
    try{audio ||= new (global.AudioContext||global.webkitAudioContext)();void audio.resume();}catch{}
    if($('voiceAssistant').hidden)open();else close();
  });
  $('djClose').addEventListener('click',close);
  $('voiceAssistant').addEventListener('keydown',e=>{if(e.key==='Escape'){close();e.preventDefault();}});
  $('djAsk').addEventListener('click',()=>{void wake();});
  $('djStop').addEventListener('click',stop);
  $('djCountryForm').addEventListener('submit',e=>{e.preventDefault();void country($('djCountry').value);});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){resumeOnVisible=enabled;stop();}
    else if(resumeOnVisible){resumeOnVisible=false;void autoEnable();}
  });
  global.addEventListener('pagehide',stop);
  for(const el of document.querySelectorAll('[data-track-index], #soloNote, #soloSingle, #soloPhrase, #soloStop, #stopScan, #sourceCanvas, #hearMapPoint, #no2Play, #no2Reference'))el.addEventListener('click',()=>{
    const wasEnabled=enabled;stop();if(wasEnabled)enable();
  });
  for(const item of global.DJEarthCountries){const option=document.createElement('option');option.value=item.name;$('djCountries').append(option);}
  if(!Recognition)status('Voice recognition is not supported in this browser. You can still type your country and play its reference melody.');
  global.DJEarthVoice=Object.freeze({stop,getState:()=>({enabled,phase})});
  async function autoEnable(){
    if(!Recognition||document.hidden)return;
    const current=run;
    try{
      const permission=await navigator.permissions.query({name:'microphone'});
      if(current!==run||document.hidden)return;
      if(permission.state==='granted')enable();
      else status(permission.state==='denied'?'Microphone is blocked in browser settings. You can still type a country.':'Your browser needs microphone permission once. Use Enable microphone to allow it; saved permission will be reused.');
    }catch{status('This browser cannot check saved microphone permission. Use Enable microphone once to start.');}
  }
  void autoEnable();
})(globalThis);
