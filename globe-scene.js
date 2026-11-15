/* Decorative Earth scene. It never reads or changes the studio's audio controls. */
(function (global) {
  'use strict';

  const host = document.querySelector('.record-art');
  if (!host) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'globe-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', {
    alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power'
  });
  if (!gl) return;

  const vertexSource = `
    attribute vec2 position;
    varying vec2 screen;
    void main() {
      screen = position;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `;
  const fragmentSource = `
    precision highp float;
    varying vec2 screen;
    uniform sampler2D earth;
    uniform float longitude;
    uniform float tilt;
    const float PI = 3.14159265359;
    void main() {
      vec2 point = screen / 0.755;
      float radius = length(point);
      if (radius > 1.0) {
        float halo = exp(-(radius - 1.0) * 21.0) * 0.20;
        gl_FragColor = vec4(0.12, 0.46, 0.95, halo);
        return;
      }
      vec3 normal = vec3(point, sqrt(max(0.0, 1.0 - dot(point, point))));
      float ct = cos(tilt), st = sin(tilt);
      vec3 tilted = vec3(normal.x, normal.y * ct - normal.z * st, normal.y * st + normal.z * ct);
      float cl = cos(longitude), sl = sin(longitude);
      vec3 surface = vec3(tilted.x * cl - tilted.z * sl, tilted.y, tilted.x * sl + tilted.z * cl);
      vec2 uv = vec2(atan(surface.x, surface.z) / (2.0 * PI) + 0.5, 0.5 - asin(clamp(surface.y, -1.0, 1.0)) / PI);
      vec3 map = texture2D(earth, uv).rgb;
      vec3 light = normalize(vec3(-0.85, 0.62, 1.15));
      float sunlight = max(0.0, dot(normal, light));
      vec3 color = map * vec3(0.85, 0.98, 1.15) * (0.10 + 1.08 * sunlight);
      float ocean = smoothstep(0.025, 0.16, map.b - map.r);
      vec3 halfLight = normalize(light + vec3(0.0, 0.0, 1.0));
      float shine = pow(max(0.0, dot(normal, halfLight)), 55.0) * ocean * 0.25;
      float rim = pow(1.0 - normal.z, 3.0);
      color += vec3(0.25, 0.55, 0.95) * shine;
      color += vec3(0.05, 0.35, 0.90) * rim * (0.30 + 0.50 * sunlight);
      float alpha = 1.0 - smoothstep(0.992, 1.0, radius);
      gl_FragColor = vec4(color, alpha);
    }
  `;

  function shader(type, source) {
    const compiled = gl.createShader(type);
    gl.shaderSource(compiled, source);
    gl.compileShader(compiled);
    if (!gl.getShaderParameter(compiled, gl.COMPILE_STATUS)) {
      gl.deleteShader(compiled);
      throw new Error('Decorative globe shader unavailable.');
    }
    return compiled;
  }

  let program;
  let texture;
  let vertices;
  try {
    const vertex = shader(gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl.FRAGMENT_SHADER, fragmentSource);
    program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);
    vertices = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, 'earth'), 0);
  } catch {
    return;
  }

  const longitudeLocation = gl.getUniformLocation(program, 'longitude');
  const tiltLocation = gl.getUniformLocation(program, 'tilt');
  const reduced = global.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = global.matchMedia('(hover: hover) and (pointer: fine)');
  let ready = false;
  let visible = true;
  let frame;
  let lastRender = 0;
  let rotation = 0.35;
  let pointerX = 0;
  let pointerY = 0;
  let easeX = 0;
  let easeY = 0;
  let previousTime;

  function size() {
    const edge = Math.min(900, Math.max(1, Math.round(host.clientWidth * Math.min(global.devicePixelRatio || 1, 1.6) * 1.08)));
    if (canvas.width !== edge) {
      canvas.width = edge;
      canvas.height = edge;
      gl.viewport(0, 0, edge, edge);
    }
  }

  function render(time) {
    if (!ready || document.hidden || !visible) return;
    const elapsed = previousTime === undefined ? 0 : Math.min(time - previousTime, 80);
    previousTime = time;
    if (!reduced.matches) {
      rotation += elapsed * 0.000035;
      easeX += (pointerX - easeX) * 0.08;
      easeY += (pointerY - easeY) * 0.08;
    }
    size();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(longitudeLocation, rotation + easeX * 0.15);
    gl.uniform1f(tiltLocation, -0.12 + easeY * 0.10);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function tick(time) {
    frame = undefined;
    if (time - lastRender >= 33) {
      render(time);
      lastRender = time;
    }
    schedule();
  }

  function schedule() {
    if (ready && visible && !document.hidden && !reduced.matches && frame === undefined) {
      frame = global.requestAnimationFrame(tick);
    }
  }

  function pause() {
    if (frame !== undefined) global.cancelAnimationFrame(frame);
    frame = undefined;
    previousTime = undefined;
  }

  const image = new Image();
  image.onload = () => {
    try {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
      host.append(canvas);
      ready = true;
      render(performance.now());
      host.classList.add('has-globe');
      schedule();
    } catch {
      canvas.remove();
    }
  };
  // If the local texture cannot load, keep the existing Earth record illustration.
  image.onerror = () => {};
  image.src = 'assets/earth-day.jpg';

  host.addEventListener('pointermove', event => {
    if (reduced.matches || !finePointer.matches) return;
    const bounds = host.getBoundingClientRect();
    pointerX = (event.clientX - bounds.left) / bounds.width - 0.5;
    pointerY = (event.clientY - bounds.top) / bounds.height - 0.5;
  }, { passive: true });
  host.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else { render(performance.now()); schedule(); }
  });
  reduced.addEventListener('change', () => {
    pause();
    if (reduced.matches) { easeX = 0; easeY = 0; }
    render(performance.now());
    schedule();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    ready = false;
    pause();
    host.classList.remove('has-globe');
    canvas.remove();
  });

  if ('IntersectionObserver' in global) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (!visible) pause();
      else { render(performance.now()); schedule(); }
    }, { rootMargin: '60px' });
    observer.observe(host);
  }
  if ('ResizeObserver' in global) {
    new ResizeObserver(() => render(performance.now())).observe(host);
  } else {
    global.addEventListener('resize', () => render(performance.now()), { passive: true });
  }
  global.addEventListener('pagehide', pause);
  global.addEventListener('pageshow', () => { render(performance.now()); schedule(); });
})(globalThis);
