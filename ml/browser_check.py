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
 navigate()
 print('Sample instruments:',evaluate("""(async()=>{
 const assert=(v,m)=>{if(!v)throw Error(m)};
 for(const id of ['harmonica','guitar','harp','violin']){
  const sources=[],gains=[];let oscillators=0,ctx;
  function Context(){
   ctx=new AudioContext();const buffer=ctx.createBufferSource.bind(ctx),gain=ctx.createGain.bind(ctx),osc=ctx.createOscillator.bind(ctx);
   ctx.createBufferSource=()=>{const s=buffer();sources.push(s);return s};
   ctx.createGain=()=>{const g=gain();gains.push(g);return g};
   ctx.createOscillator=()=>{oscillators++;return osc()};return ctx;
  }
  const voice=DJEarthInstruments.createInstrument(id,{AudioContext:Context});await voice.ready();
  const base=id==='guitar'?48:60;
  for(let n=0;n<13;n++){
   voice.play(440*2**((base+n-69)/12));const src=sources.at(-1);
   assert(src.buffer.duration>.8,'sample too short '+id);
   assert(Math.abs(src.playbackRate.value-1)<1e-5,'missing recorded semitone '+id);
   const d=src.buffer.getChannelData(0);assert(d.some(x=>Math.abs(x)>.01),'silent sample '+id);
   voice.stopAll();
  }
  voice.play(440*2**((base+.3-69)/12));assert(Math.abs(sources.at(-1).playbackRate.value-2**(.3/12))<1e-5,'continuous tuning '+id);
  voice.setVolume(0);await new Promise(r=>setTimeout(r,50));assert(gains[0].gain.value===0,'master mute '+id+' gain='+gains[0].gain.value+' time='+ctx.currentTime+' state='+ctx.state);
  voice.stopAll();assert(oscillators===0,'oscillator approximation remains '+id);
  await ctx.close();
 }
 return 'PASS 52 decoded note samples, exact semitones, fractional tuning, master mute and zero oscillators';})()"""),flush=True)
 print('Map interaction:',evaluate("""(async()=>{
 const assert=(v,m)=>{if(!v)throw Error(m)},wait=ms=>new Promise(r=>setTimeout(r,ms));
 assert(!document.querySelector('#spotOverlay, #scanRoute, .scan-line, .route-step'),'numbered route remains');
 for(const track of [0,1]){
  document.querySelector('[data-track-index="'+track+'"]').click();await wait(100);
  if(track===0){
   await djEarthApp.loadNightLightsMap();
   assert(djEarthApp.getState().width===700,'night map failed to load');
   assert(djEarthApp.getState().imageName==='Night lights reference map','wrong night default');
   assert(document.getElementById('patternNote').hidden,'test pattern text on map');
   djEarthApp.useTestPattern();document.getElementById('resetTrackImage').click();
   for(let n=0;n<50 && djEarthApp.getState().loading;n++)await wait(50);
   assert(djEarthApp.getState().width===700,'reset did not restore night map');
  }
  djEarthApp.useTestPattern();
  for(const mode of ['fixed','learned']){
   djEarthApp.setMode(mode);
   await djEarthApp.previewCoordinates(0,50);
   assert(document.getElementById('activeNote').textContent.includes('C4'),'first Do not C4');
   await djEarthApp.previewCoordinates(799,50);
   assert(document.getElementById('activeNote').textContent.includes('C5'),'last Do not C5');
  }
  djEarthApp.setMode('fixed');
  document.getElementById('soloNote').click();await wait(30);
  await djEarthApp.previewCoordinates(600,50);
  assert(document.getElementById('soloValue').value==='100','map did not sync intensity');
  assert(document.getElementById('soloNote').getAttribute('aria-pressed')==='true','map stopped live');
  await wait(550);
  assert(document.body.classList.contains('is-playing'),'live did not continue');
  await djEarthApp.previewCoordinates(0,50);
  assert(document.getElementById('soloValue').value==='0','dark/cold point did not lower intensity');
  document.getElementById('soloStop').click();
  const data=new ImageData(2,2);data.data.set([0,0,0,255,255,255,255,255,10,63,255,255,252,46,22,255]);
  djEarthApp.loadImageData(data,'Coordinate test');
  await djEarthApp.previewCoordinates(.9,.9);
  assert(document.getElementById('scanPosition').textContent.includes('(0, 0)'),'sampling rounded to adjacent pixel');
  const c=document.getElementById('sourceCanvas'),r=c.getBoundingClientRect();
  c.dispatchEvent(new MouseEvent('click',{clientX:r.left+r.width*.75,clientY:r.top+r.height*.75,bubbles:true}));await wait(20);
  assert(document.getElementById('scanPosition').textContent.includes('(1, 1)'),'map click failed');
  document.getElementById('mapColumn').value='0';document.getElementById('mapRow').value='100';document.getElementById('hearMapPoint').click();await wait(20);
  assert(document.getElementById('scanPosition').textContent.includes('(0, 1)'),'keyboard point failed');
 }
 return 'PASS no markers; direct click and keyboard coordinates on both tracks';})()"""),flush=True)
 print('Lab:',evaluate("""(async()=>{
 const assert=(v,m)=>{if(!v)throw Error(m)}, wait=ms=>new Promise(r=>setTimeout(r,ms));
 const $=id=>document.getElementById(id);
 document.querySelector('[data-track-index="2"]').click();await wait(500);
 assert(!$('no2Lab').hidden,'panel hidden');assert(!$('no2Play').disabled,'default failed to load: '+$('no2Status').textContent);
 const model=JSON.stringify(DJEarthNO2Model);
 assert(DJEarthNO2.predict([0,0,0])===null,'black accepted');
 assert(DJEarthNO2.predict([255,255,255])===null,'white accepted');
 assert(DJEarthNO2.predict([0,255,0])===null,'wrong palette accepted');
 let last=0;for(let n=0;n<=10;n++){let hz=DJEarthNO2.frequency(n);assert(hz>last,'pitch order');last=hz;}
 const getImage=async src=>{const im=new Image();im.src=src;await im.decode();const c=document.createElement('canvas');c.width=1200;c.height=675;const cx=c.getContext('2d');cx.drawImage(im,0,0);return cx.getImageData(0,0,1200,675)};
 for(const date of ['2015-2019','2020']){
  const data=await getImage('assets/no2/march-'+date+'.jpg');assert(DJEarthNO2.compatible(data),'source compatibility '+date);
  assert(DJEarthNO2.sample(data,1000,300)===null,'ocean not masked');assert(DJEarthNO2.sample(data,950,585)===null,'legend not masked');assert(DJEarthNO2.sample(data,200,50)===null,'header not masked');
  let accepted=0;for(let y=150;y<500;y+=50)for(let x=150;x<700;x+=50)if(DJEarthNO2.sample(data,x,y)!==null)accepted++;
  assert(accepted>10,'too few accepted land points '+accepted);
  console.log(date+' accepted samples: '+accepted);
 }
 const bad=new ImageData(1200,675);assert(!DJEarthNO2.compatible(bad),'blank accepted');
 $('no2Play').click();await wait(100);assert($('no2Status').textContent.includes('March 2020'),'point playback status');
 $('no2Reference').click();await wait(100);$('no2Stop').click();await wait(1200);assert($('no2Status').textContent==='NO\u2082 sound stopped.','reference failed to cancel');
 document.querySelector('[name=no2Source][value="2015-2019"]').click();await wait(200);assert($('no2Reading').textContent.includes('2015'),'switch source');
 const blob=await (await fetch('assets/no2/march-2020.jpg')).blob();const dt=new DataTransfer();dt.items.add(new File([blob],'today-template.jpg',{type:'image/jpeg'}));$('no2Upload').files=dt.files;$('no2Upload').dispatchEvent(new Event('change'));await wait(200);assert(!$('no2Play').disabled,'valid upload');assert($('no2Reading').textContent.includes('today-template'),'uploaded label');
 const c=document.createElement('canvas');c.width=1200;c.height=675;const wrong=await new Promise(r=>c.toBlob(r));const dt2=new DataTransfer();dt2.items.add(new File([wrong],'wrong.png',{type:'image/png'}));$('no2Upload').files=dt2.files;$('no2Upload').dispatchEvent(new Event('change'));await wait(200);assert($('no2Play').disabled,'bad upload left stale playback');
 document.querySelector('[name=no2Source][value="2020"]').click();await wait(200);assert(!$('no2Play').disabled,'recover after rejection');
 assert(model===JSON.stringify(DJEarthNO2Model),'model changed');
 document.querySelector('[data-track-index="1"]').click();await wait(50);assert($('no2Lab').hidden,'lab visible on temperature');
 return 'PASS rejection, fixed scale, both sources, upload, stop, track isolation';})()"""),flush=True)
 for width in [390,768,1440]:
  call('Emulation.setDeviceMetricsOverride',{'width':width,'height':1000,'deviceScaleFactor':1,'mobile':width<768})
  evaluate("document.querySelector('[data-track-index=\"2\"]').click()")
  assert evaluate('document.documentElement.scrollWidth<=innerWidth'), 'overflow '+str(width)
 print('Responsive: PASS',flush=True)
 for page,selector in [('tests.html','#testSummary'),('tests-live.html','#results')]:
  navigate(page);time.sleep(1);print(page,evaluate('document.querySelector('+json.dumps(selector)+').textContent'),flush=True)
 assert not errors, errors
 print('Uncaught browser errors: 0',flush=True)
 ws.close()
finally:proc.terminate();server.shutdown();server.server_close()
