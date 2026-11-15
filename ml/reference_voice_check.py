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
 window.test={spoken:[],requests:0,active:0,starts:0};
 Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{test.requests++;return {getTracks:()=>[{stop(){}}]}}}});
 Object.defineProperty(navigator,'permissions',{value:{query:async()=>({state:'granted'})},configurable:true});
 window.SpeechRecognition=class{start(){test.starts++;test.active++;test.rec=this;}abort(){test.active--;}};
 window.SpeechSynthesisUtterance=class{constructor(text){this.text=text}};
 Object.defineProperty(window,'speechSynthesis',{value:{speak(u){test.spoken.push(u.text);setTimeout(()=>u.onend?.(),10)},cancel(){}}});
 const originalFetch=window.fetch;window.realFetch=originalFetch;
 window.fetch=async(url,options)=>{
 if(!String(url).includes('api.open-meteo.com'))return originalFetch(url,options);
 if(test.fail)throw new TypeError('offline');
 const now=Math.floor(Date.now()/1000),start=Math.floor(now/3600)*3600;
 return {ok:true,json:async()=>({current:{time:test.stale?0:now,temperature_2m:20},current_units:{temperature_2m:'\\u00b0C'},hourly_units:{temperature_2m:'\\u00b0C'},hourly:{time:Array.from({length:8},(_,i)=>start+i*3600),temperature_2m:[19,20,21,22,23,24,25,26]}})};
 };
 """})
 navigate()
 print(evaluate("""(async()=>{
 const assert=(v,m)=>{if(!v)throw Error(m)},wait=ms=>new Promise(r=>setTimeout(r,ms));
 await wait(500);
 assert(!document.getElementById('liveTemperatureMap'),'embedded map remains');
 assert(!globalThis.DJEarthLiveTemperature,'API remains loaded');
 document.querySelector('[data-track-index="1"]').click();
 assert(getComputedStyle(document.getElementById('sourceCanvas').closest('figure')).display!=='none','reference hidden');
 const canvas=document.createElement('canvas');canvas.width=2;canvas.height=1;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#0000ff';ctx.fillRect(0,0,1,1);ctx.fillStyle='#ff0000';ctx.fillRect(1,0,1,1);
 const blob=await new Promise(r=>canvas.toBlob(r));
 await djEarthApp.uploadImage(new File([blob],'test.png',{type:'image/png'}));
 await djEarthApp.previewCoordinates(0,0);
 const cold=Number(document.getElementById('soloValue').value);
 await djEarthApp.previewCoordinates(1,0);
 const hot=Number(document.getElementById('soloValue').value);
 assert(cold<hot&&cold<20&&hot>80,'map intensity remains fixed '+cold+' '+hot);
 assert(document.getElementById('soloValueLabel').textContent===hot+'%','label not synced');
 document.querySelector('[data-track-index="0"]').click();
 await djEarthApp.uploadImage(new File([blob],'test.png',{type:'image/png'}));
 await djEarthApp.previewCoordinates(0,0);const dark=Number(document.getElementById('soloValue').value);
 await djEarthApp.previewCoordinates(1,0);assert(Number(document.getElementById('soloValue').value)!==dark,'night lights intensity fixed');
 document.querySelector('[data-track-index="1"]').click();
 const country=DJEarthCountryTemperature.resolve('I am in Lebanon');
 const prepared=await DJEarthCountryTemperature.prepare(country);
 assert(prepared.values.length===6&&prepared.values.some(v=>v!==null),'reference sampling failed');
 assert(prepared.values.every(v=>v===null||(v>=0&&v<=6)),'wrong reference scale');
 prepared.start();
 const expected=prepared.values[0]===null?0:Math.round(prepared.values[0]/6*100);
 assert(Number(document.getElementById('soloValue').value)===expected,'intensity not updated');
 assert(document.getElementById('djMelody').textContent.includes('reference'),'wrong playback');
 DJEarthVoice.stop();
 assert(test.spoken[0].includes('temperature melody'),'misleading welcome');
 return 'PASS restored reference image, sampling, harmonica playback and intensity; no live API loaded';
 })()"""),flush=True)
 assert not errors,errors

finally:
 proc.terminate();server.shutdown();server.server_close()
