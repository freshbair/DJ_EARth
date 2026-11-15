/* Approximate registration of the supplied Robinson-style temperature illustration.
   Relative 0–6 values only; not Celsius, current weather, or a country average. */
(function (global) {
  'use strict';
  const X = [1,.9986,.9954,.99,.9822,.973,.96,.9427,.9216,.8962,.8679,.835,.7986,.7597,.7186,.6732,.6213,.5722,.5322];
  const Y = [0,.062,.124,.186,.248,.31,.372,.434,.4958,.5571,.6176,.6769,.7346,.7903,.8435,.8936,.9394,.9761,1];
  const voice = global.DJEarthInstruments.createInstrument('harmonica');
  let image, centers, loading, ticket = 0, timer, currentGain = 1;
  function normalize(text) { return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\s+/g,' ').trim(); }
  const aliases = new Map();
  for (const country of global.DJEarthCountries) for (const name of [country.name, ...country.aliases]) {
    const key = normalize(name);
    if (aliases.has(key) && aliases.get(key) !== country) aliases.set(key, null);
    else aliases.set(key, country);
  }
  const extra = { usa:'USA', 'united states':'USA', america:'USA', uk:'GBR', britain:'GBR', england:'GBR', 'south korea':'KOR', 'north korea':'PRK', 'uae':'ARE', 'united arab emirates':'ARE', turkey:'TUR', turkiye:'TUR', 'czech republic':'CZE', 'ivory coast':'CIV' };
  Object.entries(extra).forEach(([name,code]) => aliases.set(name,global.DJEarthCountries.find(c=>c.code===code)));
  // Congo alone is ambiguous; ask for the full name rather than guess.
  aliases.set('congo',null);
  function resolve(text) {
    const cleaned=normalize(text).replace(/^(i am currently in|i am in|i m in|im in|i live in|my country is|i am from|in) /,'');
    return aliases.get(cleaned) || null;
  }
  function project(lon,lat) {
    const band=Math.min(17,Math.floor(Math.abs(lat)/5)), f=Math.abs(lat)/5-band;
    const sx=X[band]+(X[band+1]-X[band])*f, sy=Y[band]+(Y[band+1]-Y[band])*f;
    // Manually fitted map outline in the 1024x484 source; excludes its legend.
    return [468.5+456.5*(lon/180)*sx,223.5-219.5*Math.sign(lat)*sy];
  }
  async function load() {
    if (!loading) loading=(async()=>{
      const img=new Image();img.src=global.DJEarthTemperatureReference;await img.decode();
      if(img.naturalWidth!==1024||img.naturalHeight!==484)throw Error('Temperature reference registration does not match this image.');
      const c=document.createElement('canvas');c.width=1024;c.height=484;
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);
      image=ctx.getImageData(0,0,1024,484);centers=global.DJEarthTemperature.learnTemperatureGroups(image);
    })().catch(error=>{loading=null;throw error;});
    await loading;
  }
  function stop() { ticket++;clearTimeout(timer);voice.stopAll(); }
  function sample(lon,lat) {
    const [x,y]=project(lon,lat), values=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const px=Math.round(x)+dx,py=Math.round(y)+dy;
      if(px<12||px>925||py<4||py>443)continue;
      const i=(py*image.width+px)*4,[r,g,b,a]=image.data.slice(i,i+4);
      // Drop dark borders and white background; small countries may remain unreliable.
      if(Math.max(r,g,b)<35||global.DJEarthTemperature.isRestPixel(r,g,b,a))continue;
      values.push(global.DJEarthTemperature.temperatureFromRGB(r,g,b));
    }
    values.sort((a,b)=>a-b);return values.length>=3?values[Math.floor(values.length/2)]:null;
  }
  async function prepare(country) {
    await Promise.all([load(),voice.ready()]);
    const values=country.points.map(([lon,lat])=>sample(lon,lat));
    if(values.every(v=>v===null))throw Error('I cannot read reliable sample points for that country on this reference.');
    const notes=values.map(value=>value===null?null:global.DJEarthTemperature.pitchForTemperature(value,'learned',centers,'piano'));
    return {country,values,notes,start(){
      stop();global.djEarthApp?.stop();global.djEarthSolo?.stop();
      const run=ticket;let i=0;
      function step(){
        if(run!==ticket)return;
        const j=i++%notes.length,value=values[j],note=notes[j];
        currentGain=value===null?0:.1+.9*value/6;
        voice.setVolume(Number(document.getElementById('volume').value)/100*currentGain);
        if(note)voice.play(note.hz);
        document.getElementById('djMelody').textContent=`${country.name}: reference sample ${j+1} of ${notes.length}. ${value===null?'No reading; rest.':`Relative temperature ${value.toFixed(1)} of 6; ${note.name}, ${note.pitch}.`}`;
        timer=setTimeout(step,650);
      }
      step();
    }};
  }
  document.getElementById('volume').addEventListener('input',()=>voice.setVolume(Number(document.getElementById('volume').value)/100*currentGain));
  global.DJEarthCountryTemperature=Object.freeze({resolve,project,prepare,stop,prime:()=>voice.ready()});
})(globalThis);
