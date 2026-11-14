/* Repeatable tests for the actual pure light track and synthesized piano.
   Also callable without a DOM: await globalThis.runDJEarthTests(). */
(function (root) {
  'use strict';

  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  function near(actual, expected, tolerance = 1e-8) {
    assert(Math.abs(actual - expected) <= tolerance, `Expected ${expected}; got ${actual}.`);
  }

  function image(width, height, pixel) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) data.set(pixel(x, y), (y * width + x) * 4);
    }
    return { width, height, data };
  }

  class FakeParam {
    constructor() { this.value = 0; this.events = []; }
    cancelScheduledValues(time) { this.events.push({ type: 'cancel', time }); }
    setValueAtTime(value, time) { this.value = value; this.events.push({ type: 'set', value, time }); }
    linearRampToValueAtTime(value, time) { this.value = value; this.events.push({ type: 'linear', value, time }); }
    exponentialRampToValueAtTime(value, time) { this.value = value; this.events.push({ type: 'exponential', value, time }); }
  }

  class FakeAudioContext {
    static instances = [];
    constructor() {
      this.currentTime = 4;
      this.state = 'suspended';
      this.destination = {};
      this.gains = [];
      this.tones = [];
      FakeAudioContext.instances.push(this);
    }
    async resume() { this.state = 'running'; }
    createGain() {
      const node = { gain: new FakeParam(), connect() {}, disconnect() { this.disconnected = true; } };
      this.gains.push(node);
      return node;
    }
    createOscillator() {
      const node = {
        frequency: new FakeParam(), stops: [],
        connect() {}, disconnect() { this.disconnected = true; },
        start(time) { this.started = time; },
        stop(time) { this.stops.push(time); }
      };
      this.tones.push(node);
      return node;
    }
  }

  async function pianoFixture(volume = 0.55) {
    const piano = root.createDJEarthPiano({ AudioContext: FakeAudioContext, volume });
    await piano.ready();
    return { piano, context: FakeAudioContext.instances.at(-1) };
  }

  async function runDJEarthTests() {
    const light = root.DJEarthLight;
    const results = [];
    async function test(name, fn) {
      try { await fn(); results.push({ name, passed: true }); }
      catch (error) { results.push({ name, passed: false, error: error.message || String(error) }); }
    }

    await test('Fixed test pattern: Do → Ré → Mi → Fa → Sol → La → Si → Do', () => {
      const spots = light.scanSpots(light.createTestPattern());
      assert(spots.map(spot => spot.brightness).join(',') === '0,48,88,128,168,208,255,0', 'Pattern brightness changed.');
      assert(spots.map(spot => light.pitchForBrightness(spot.brightness).name).join(',') === 'Do,Ré,Mi,Fa,Sol,La,Si,Do', 'Unexpected note sequence.');
    });

    await test('Test phrase ends on high Do (C5), exactly one octave above its first Do (C4)', () => {
      const spots = light.scanSpots(light.createTestPattern());
      const centers = light.learnBrightnessGroups(light.createTestPattern());
      for (const mode of ['fixed', 'learned']) {
        const notes = spots.map(spot => light.pitchForSpot(spot, mode, centers, true));
        assert(notes.map(note => note.pitch).join(',') === 'C4,D4,E4,F4,G4,A4,B4,C5', `${mode} test phrase has the wrong octave.`);
        near(notes[7].hz, notes[0].hz * 2);
      }
    });

    await test('The phrase ending never changes uploaded black pixels or transparent rests', () => {
      const spot = { index: 7, brightness: 0, rest: false };
      assert(light.pitchForSpot(spot).pitch === 'C4', 'Uploaded black pixel was transposed.');
      assert(light.pitchForSpot(spot, 'learned', [0]).pitch === 'C4', 'Uniform learned image was transposed.');
      assert(light.pitchForSpot({ ...spot, rest: true }, 'fixed', [], true) === null, 'Transparent pixel was turned into high Do.');
    });

    await test('Scan samples segment centers on the middle row', () => {
      const spots = light.scanSpots(light.createTestPattern());
      assert(spots.map(spot => spot.x).join(',') === '50,150,250,350,450,550,650,750', 'Incorrect horizontal coordinates.');
      assert(spots.every(spot => spot.y === 80), 'Incorrect middle row.');
    });

    await test('Every brightness value 0–255 follows floor(brightness × 7 / 256)', () => {
      for (let value = 0; value < 256; value++) {
        assert(light.pitchForBrightness(value) === light.NOTES[Math.floor(value * 7 / 256)], `Wrong note at brightness ${value}.`);
      }
    });

    await test('RGB brightness uses the specified weighted rounding', () => {
      assert(light.brightnessFromRGB(255, 0, 0) === 54, 'Wrong red weight.');
      assert(light.brightnessFromRGB(0, 255, 0) === 182, 'Wrong green weight.');
      assert(light.brightnessFromRGB(0, 0, 255) === 18, 'Wrong blue weight.');
      assert(light.brightnessFromRGB(12, 79, 201) === Math.round(0.2126 * 12 + 0.7152 * 79 + 0.0722 * 201), 'Mixed RGB calculation differs.');
    });

    await test('Opaque black plays Do; only alpha zero is a rest', () => {
      const black = light.scanSpots(image(8, 1, () => [0, 0, 0, 255]));
      assert(black.every(spot => !spot.rest && spot.brightness === 0 && light.pitchForBrightness(spot.brightness).name === 'Do'), 'Black was treated as a rest.');
      const transparent = light.scanSpots(image(8, 1, () => [255, 255, 255, 0]));
      assert(transparent.every(spot => spot.rest), 'Transparent pixels were played.');
      assert(light.scanSpots(image(8, 1, () => [48, 48, 48, 1])).every(spot => !spot.rest), 'Partially transparent pixels should remain valid.');
    });

    await test('A uniform image learns one center and one consistent note', () => {
      const uniform = image(16, 12, () => [128, 128, 128, 255]);
      const centers = light.learnBrightnessGroups(uniform);
      assert(centers.length === 1 && centers[0] === 128, 'Uniform image produced extra groups.');
      assert(light.scanSpots(uniform).every(spot => light.pitchForBrightness(spot.brightness, 'learned', centers).name === 'Do'), 'Uniform learned note is inconsistent.');
    });

    await test('Test pattern learns seven sorted brightness centers', () => {
      assert(light.learnBrightnessGroups(light.createTestPattern()).join(',') === '0,48,88,128,168,208,255', 'Unexpected learned pattern centers.');
    });

    await test('Two learned levels map dark to Do and bright to Si', () => {
      const centers = light.learnBrightnessGroups(image(20, 8, x => x < 10 ? [20, 20, 20, 255] : [220, 220, 220, 255]));
      assert(centers.length === 2, 'Expected two groups.');
      assert(light.pitchForBrightness(20, 'learned', centers).name === 'Do' && light.pitchForBrightness(220, 'learned', centers).name === 'Si', 'Learned scale order is incorrect.');
    });

    await test('A transparent image learns no brightness groups', () => {
      assert(light.learnBrightnessGroups(image(9, 4, () => [255, 255, 255, 0])).length === 0, 'Transparent pixels entered clustering.');
    });

    await test('Gradient k-means is deterministic, finite, ordered, and bounded to seven groups', () => {
      const gradient = image(256, 3, x => [x, x, x, 255]);
      const first = light.learnBrightnessGroups(gradient);
      const second = light.learnBrightnessGroups(gradient);
      assert(first.length > 0 && first.length <= 7, 'Invalid group count.');
      assert(first.every((center, i) => Number.isFinite(center) && (i === 0 || center > first[i - 1])), 'Centers are not finite and ascending.');
      assert(JSON.stringify(first) === JSON.stringify(second), 'Learning is nondeterministic.');
    });

    await test('Learning and scan measurements update when image pixels change', () => {
      const original = light.createTestPattern();
      const replacement = image(32, 10, () => [208, 208, 208, 255]);
      assert(light.learnBrightnessGroups(original).length === 7 && light.learnBrightnessGroups(replacement).join(',') === '208', 'New image did not replace learned groups.');
      assert(light.scanSpots(replacement).every(spot => spot.brightness === 208 && light.pitchForBrightness(spot.brightness).name === 'La'), 'New image scan has stale measurements.');
    });

    await test('Piano audio initializes lazily on ready()', async () => {
      const before = FakeAudioContext.instances.length;
      const piano = root.createDJEarthPiano({ AudioContext: FakeAudioContext });
      assert(FakeAudioContext.instances.length === before, 'Audio started during construction.');
      await piano.ready();
      assert(FakeAudioContext.instances.length === before + 1 && FakeAudioContext.instances.at(-1).state === 'running', 'Audio was not readied.');
      piano.stopAll();
    });

    await test('A 440 Hz piano note synthesizes 440, 880, and 1320 Hz partials', async () => {
      const { piano, context } = await pianoFixture();
      piano.play(440);
      assert(context.tones.map(tone => tone.frequency.value).join(',') === '440,880,1320', 'Incorrect piano partial tuning.');
      piano.stopAll();
    });

    await test('Volume zero gives exact silence and volume changes preserve pitch', async () => {
      const { piano, context } = await pianoFixture();
      piano.play(440);
      const frequencies = context.tones.map(tone => tone.frequency.value).join(',');
      piano.setVolume(0);
      assert(context.gains[0].gain.value === 0, 'Mute did not reach zero master gain.');
      piano.setVolume(0.8);
      assert(context.gains[0].gain.value > 0 && context.gains[0].gain.value <= 0.16, 'Comfortable gain cap was exceeded.');
      assert(context.tones.map(tone => tone.frequency.value).join(',') === frequencies, 'Changing volume changed pitch.');
      piano.stopAll();
    });

    await test('Stop silences all voices, preserves volume, and allows the next note', async () => {
      const { piano, context } = await pianoFixture(0.4);
      piano.play(440);
      piano.play(330);
      const masterGain = context.gains[0].gain.value;
      piano.stopAll();
      assert(context.gains.slice(1).every(node => node.gain.value === 0 && node.disconnected), 'A note envelope remains audible.');
      assert(context.tones.every(tone => tone.stops.at(-1) === context.currentTime && tone.disconnected), 'A note was not stopped.');
      near(context.gains[0].gain.value, masterGain);
      piano.play(262);
      assert(context.tones.length === 9 && context.tones.slice(-3).every(tone => tone.started === context.currentTime), 'Next note did not restart.');
      near(context.gains[0].gain.value, masterGain);
      piano.stopAll();
    });

    await test('Piano envelopes have a quick attack, decaying tail, and finite stop time', async () => {
      const { piano, context } = await pianoFixture();
      piano.play(440);
      context.gains.slice(1).forEach(node => {
        const attack = node.gain.events.find(event => event.type === 'linear' && event.value > 0);
        const decay = node.gain.events.find(event => event.type === 'exponential');
        const end = node.gain.events.at(-1);
        assert(attack && attack.time - context.currentTime <= 0.01 && attack.value > 0, 'Attack is not quick.');
        assert(decay && decay.time > attack.time && decay.value < attack.value, 'Tail does not fade.');
        assert(end.type === 'linear' && end.value === 0 && end.time > decay.time, 'Tail does not end at zero.');
      });
      assert(context.tones.every(tone => tone.stops[0] > context.currentTime && tone.stops[0] <= context.currentTime + 1), 'Note duration is unbounded.');
      piano.stopAll();
    });

    return results;
  }

  root.runDJEarthTests = runDJEarthTests;
  const list = root.document && root.document.querySelector('#testResults');
  if (list) {
    runDJEarthTests().then(results => {
      const passed = results.filter(result => result.passed).length;
      const summary = root.document.querySelector('#testSummary');
      if (summary) summary.textContent = `${passed} / ${results.length} checks passed.`;
      results.forEach(result => {
        const row = root.document.createElement('li');
        row.textContent = `${result.passed ? 'PASS' : 'FAIL'} · ${result.name}${result.error ? ` — ${result.error}` : ''}`;
        row.style.margin = '10px 16px';
        row.style.color = result.passed ? '#cbf4ec' : '#ffc7c7';
        list.append(row);
      });
    });
  }
})(globalThis);
