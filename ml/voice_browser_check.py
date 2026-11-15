import subprocess,tempfile,time,json,urllib.request,threading,http.server
from pathlib import Path
import websocket
class Quiet(http.server.SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
class Server(http.server.ThreadingHTTPServer):
 def handle_error(self,*args):pass
server=Server(('127.0.0.1',0),Quiet);threading.Thread(target=server.serve_forever,daemon=True).start();url='http://127.0.0.1:'+str(server.server_port)+'/'
profile=Path(tempfile.mkdtemp(prefix='djearth-album-qa-'))
proc=subprocess.Popen([r'C:\Program Files\Google\Chrome\Application\chrome.exe','--headless=new','--no-first-run','--no-default-browser-check','--mute-audio','--autoplay-policy=no-user-gesture-required','--enable-unsafe-swiftshader','--remote-debugging-port=0','--remote-allow-origins=*','--user-data-dir='+str(profile),'about:blank'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=0x08000000)
try:
 for i in range(100):
  if (profile/'DevToolsActivePort').exists():break
  time.sleep(.05)
 port=(profile/'DevToolsActivePort').read_text().splitlines()[0];tabs=json.load(urllib.request.urlopen('http://127.0.0.1:'+port+'/json'))
 ws=websocket.create_connection(tabs[0]['webSocketDebuggerUrl'],timeout=60);seq=0;errors=[]
 def call(method,params={}):
  global seq
  seq+=1;ws.send(json.dumps({'id':seq,'method':method,'params':params}))
  while True:
   data=json.loads(ws.recv())
   if data.get('method')=='Runtime.exceptionThrown':errors.append(data['params']['exceptionDetails'])
   if data.get('id')==seq:return data
 def evaluate(code):
  data=call('Runtime.evaluate',{'expression':code,'awaitPromise':True,'returnByValue':True})
  if 'exceptionDetails' in data.get('result',{}):raise RuntimeError(data['result']['exceptionDetails'])
  return data.get('result',{}).get('result',{}).get('value')
 def navigate(page='index.html'):call('Page.navigate',{'url':url+page});time.sleep(.5)
 call('Runtime.enable');call('Page.enable')

 call('Page.addScriptToEvaluateOnNewDocument',{'source':"""
 window.voiceTest={instances:[],spoken:[],active:0};
 Object.defineProperty(navigator,'permissions',{value:{query:async()=>({state:'prompt'})},configurable:true});
 class Recognition {
  constructor(){voiceTest.instances.push(this);}
  start(){this.running=true;voiceTest.active++;}
  abort(){if(this.running){voiceTest.active--;this.running=false;}this.onend?.();}
  emit(text){if(!this.running)throw Error('not listening');this.onresult?.({resultIndex:0,results:[[{transcript:text}]]});}
 }
 window.SpeechRecognition=Recognition;
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 Object.defineProperty(window,'speechSynthesis',{value:{speak(u){voiceTest.spoken.push(u.text);setTimeout(()=>u.onend?.(),10)},cancel(){}}});
 """})
 navigate()
 print('Voice flow:',evaluate("""(async()=>{
 const assert=(v,m)=>{if(!v)throw Error(m)}, wait=ms=>new Promise(r=>setTimeout(r,ms));
 const $=id=>document.getElementById(id), latest=()=>voiceTest.instances.at(-1);
 assert(voiceTest.active===0,'microphone started without permission');
 assert(document.body.dataset.track==='0','site did not open on Track 1');
 assert($('voiceAssistant').hidden,'large assistant panel visible on startup');
 assert(DJEarthCountryTemperature.resolve('I am in Lebanon').name==='Lebanon','country parsing');
 assert(DJEarthCountryTemperature.resolve('Congo')===null,'ambiguous country guessed');
 assert(DJEarthCountryTemperature.resolve('Atlantis')===null,'unknown country guessed');
 const p=DJEarthCountryTemperature.project(0,0);assert(p[0]===468.5 && p[1]===223.5,'registration');
 const prepared=await DJEarthCountryTemperature.prepare(DJEarthCountryTemperature.resolve('Lebanon'));
 assert(prepared.values.length===6 && prepared.notes.some(Boolean),'reference sampling failed');
 assert(prepared.values.filter(v=>v!==null).every(v=>v>=0&&v<=6),'invalid temperature values');
 $('djEnable').click();assert(voiceTest.active===1,'enable failed');
 latest().emit('Hey DJ');await wait(400);
 assert(voiceTest.spoken.includes('What country are you in right now?'),'missing country prompt');
 assert(DJEarthVoice.getState().phase==='country','not waiting for country');
 assert(!$('voiceAssistant').hidden,'wake did not open assistant');
 assert(voiceTest.active===1,'recognizer overlap');
 latest().emit('I am in Lebanon');await wait(250);
 assert(DJEarthVoice.getState().phase==='playing','country did not start melody '+$('djVoiceStatus').textContent);
 assert($('djMelody').textContent.includes('Lebanon'),'wrong country');
 assert(voiceTest.spoken.at(-1).includes('not today'),'reference disclosure missing');
 latest().emit('stop');await wait(20);assert(!DJEarthVoice.getState().enabled&&voiceTest.active===0,'stop left microphone running');
 $('djCountry').value='Brazil';$('djCountryForm').dispatchEvent(new Event('submit',{cancelable:true}));await wait(200);
 assert(DJEarthVoice.getState().phase==='playing'&&voiceTest.active===0,'typed fallback');
 $('djStop').click();
 $('djEnable').click();latest().emit('hey dee jay');await wait(400);latest().emit('Atlantis');await wait(80);
 assert(DJEarthVoice.getState().phase==='country','unknown country failed to retry');
 latest().onerror({error:'not-allowed'});assert(!DJEarthVoice.getState().enabled&&voiceTest.active===0,'permission error loop');
 $('djCountry').value='India';$('djCountryForm').dispatchEvent(new Event('submit',{cancelable:true}));$('djStop').click();await wait(150);
 assert(DJEarthVoice.getState().phase==='off','late playback after stop');
 return {result:'PASS opt-in, wake, prompt, country lookup, learned samples, playback, stop, typed fallback, unknown country, permission error and cancellation',lebanonValues:prepared.values};
 })()"""),flush=True)
 for width in [390,768,1440]:
  call('Emulation.setDeviceMetricsOverride',{'width':width,'height':1000,'deviceScaleFactor':1,'mobile':width<768})
  assert evaluate('document.documentElement.scrollWidth<=innerWidth'),'overflow'
 print('Responsive: PASS',flush=True)
 call('Page.addScriptToEvaluateOnNewDocument',{'source':"Object.defineProperty(navigator,'permissions',{value:{query:async()=>({state:'granted'})},configurable:true});"})
 navigate()
 print('Saved permission:',evaluate("""(async()=>{
 await new Promise(r=>setTimeout(r,100));
 if(!DJEarthVoice.getState().enabled||voiceTest.active!==1)throw Error('saved permission did not auto-enable');
 if(!document.getElementById('voiceAssistant').hidden)throw Error('auto-start opened panel');
 document.querySelector('[data-track-index="1"]').click();
 if(!DJEarthVoice.getState().enabled||voiceTest.active!==1)throw Error('track switch disabled wake word');
 document.getElementById('djStop').click();
 if(voiceTest.active!==0)throw Error('explicit stop failed');
 return 'PASS auto-listening with granted permission, compact startup, persistent wake listener and stop';})()"""),flush=True)
 call('Page.addScriptToEvaluateOnNewDocument',{'source':'window.SpeechRecognition=undefined;window.webkitSpeechRecognition=undefined;'})
 navigate()
 print('Unsupported browser:',evaluate("""(async()=>{
 const wait=ms=>new Promise(r=>setTimeout(r,ms));
 document.getElementById('djEnable').click();
 if(DJEarthVoice.getState().enabled)throw Error('Enabled without recognition');
 document.getElementById('djCountry').value='France';document.getElementById('djCountryForm').dispatchEvent(new Event('submit',{cancelable:true}));
 for(let i=0;i<50&&DJEarthVoice.getState().phase!=='playing';i++)await wait(100);
 if(DJEarthVoice.getState().phase!=='playing')throw Error('Typed fallback failed');
 document.getElementById('soloStop').click();
 if(DJEarthVoice.getState().phase!=='off')throw Error('Manual Stop did not cancel assistant');
 return 'PASS typed playback without speech recognition and main Stop cancellation';})()"""),flush=True)
 assert not errors,errors
 print('Browser exceptions: 0',flush=True)
 ws.close()
finally:proc.terminate();server.shutdown();server.server_close()
