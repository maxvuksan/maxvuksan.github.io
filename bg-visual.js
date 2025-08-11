function main(){
  const canvas = document.getElementById('filaments');
  const ctx = canvas.getContext('2d', { alpha:false });
  const DPR = () => Math.min(2, window.devicePixelRatio || 1);

  // --- Look & flow (yours, unchanged except density default kept small) ---
  const params = {
    lineColor:   "#ffb491",
    fadeColor:   "#302523",
    fadeAlpha60: 0.05,
    density:     20,         // number of strands
    thickness:   2,
    baseSpeed:   100,
    inertia:     0.92,
    jitter:      0.10,

    // Quasi-periodic field (two lattices)
    cellSizeA:   500,
    cellSizeB:   500*1.61803398875,
    mixB:        0.1,
    epsilon:     0.35,
    phase:       1.2,

    // Global drift/rotation
    driftX:      6,
    driftY:     -4,
    rotSpeed:    0.06,

    // Subtle chaos
    noiseAmp:    3,
    noiseScale:  0.9
  };

  // --------- particles ----------
  let particles = [];

  // Spawn a particle object at a given position
  function makeParticle(x,y){
    const a=Math.random()*Math.PI*2, sp=30+Math.random()*20;
    return { x,y, px:x, py:y, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, life:0, maxLife:40+Math.random()*70 };
  }

  // Fallback random spawn (used for respawns during runtime)
  function spawnRandom(){
    const x=Math.random()*canvas.width, y=Math.random()*canvas.height;
    return makeParticle(x,y);
  }

  // --------- tiny value-noise & curl (for chaos spice) ----------
  function hash(x,y){let h=x*374761393+y*668265263;h=(h^(h>>>13))*1274126177;return((h^(h>>>16))>>>0)/4294967296;}
  const sstep=t=>t*t*(3-2*t);
  function vnoise(x,y){
    const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi;
    const u=sstep(xf), v=sstep(yf);
    const h00=hash(xi,yi),h10=hash(xi+1,yi),h01=hash(xi,yi+1),h11=hash(xi+1,yi+1);
    const nx0=h00*(1-u)+h10*u, nx1=h01*(1-u)+h11*u;
    return nx0*(1-v)+nx1*v;
  }
  function fbm(x,y,t){let a=0.5,f=1,s=0;for(let i=0;i<3;i++){s+=a*vnoise(x*f+t*0.02*i,y*f-t*0.018*i);f*=1.85;a*=0.5;}return s;}
  function curlNoise(x,y,t,scale){
    const e=1.0;
    const fx1=fbm((x+e)*scale,y*scale,t), fx0=fbm((x-e)*scale,y*scale,t);
    const fy1=fbm(x*scale,(y+e)*scale,t), fy0=fbm(x*scale,(y-e)*scale,t);
    const dx=(fx1-fx0)*0.5, dy=(fy1-fy0)*0.5;
    return {x:dy,y:-dx};
  }

  // --------- periodic stream fields (two lattices) ----------
  function fieldVelLattice(x,y,t,cellSize){
    const cx=canvas.width*0.5, cy=canvas.height*0.5;
    const th=params.rotSpeed*t, s=Math.sin(th), c=Math.cos(th);
    const xr=x-cx, yr=y-cy;
    const xd=xr*c-yr*s + cx + params.driftX*t;
    const yd=xr*s+yr*c + cy + params.driftY*t;

    const kx=(2*Math.PI)/cellSize, ky=(2*Math.PI)/cellSize;

    const sx=Math.sin(kx*xd),  cx1=Math.cos(kx*xd);
    const sy=Math.sin(ky*yd),  cy1=Math.cos(ky*yd);

    const sx2=Math.sin(2*kx*xd + params.phase), cx2=Math.cos(2*kx*xd + params.phase);
    const sy2=Math.sin(2*ky*yd),                cy2=Math.cos(2*ky*yd);

    const dpsidy =  ky * ( sx * cy1 + params.epsilon * sx2 * cy2 );
    const dpsidx =  kx * ( cx1 * sy + params.epsilon * cx2 * sy2 );

    let vx =  dpsidy, vy = -dpsidx;
    const L=Math.hypot(vx,vy)+1e-6;
    vx=(vx/L)*params.baseSpeed; vy=(vy/L)*params.baseSpeed;
    return {vx,vy};
  }

  function fieldVelocity(x,y,t){
    const a = fieldVelLattice(x,y,t, params.cellSizeA);
    const b = fieldVelLattice(x,y,t, params.cellSizeB);
    let vx = (1-params.mixB)*a.vx + params.mixB*b.vx;
    let vy = (1-params.mixB)*a.vy + params.mixB*b.vy;

    const n = curlNoise(x,y,t, params.noiseScale);
    vx += n.x * (params.noiseAmp*params.baseSpeed);
    vy += n.y * (params.noiseAmp*params.baseSpeed);

    const L=Math.hypot(vx,vy)+1e-6;
    vx = vx/L * params.baseSpeed;
    vy = vy/L * params.baseSpeed;
    return {vx,vy};
  }

  // --------- Blue-noise (Poisson-disk) sampler ----------
  // Bridson algorithm, grid-accelerated. Returns ~count points with minDist.
  function poissonDisk(width, height, count){
    // choose a min distance based on area and desired count
    // (slightly conservative so we can usually fit `count` points)
    const area = width * height;
    const idealCell = Math.sqrt(area / count);
    const minDist = idealCell * 0.9; // tweak spread here
    const k = 30; // attempts per active point

    const cellSize = minDist / Math.SQRT2;
    const gw = Math.ceil(width / cellSize);
    const gh = Math.ceil(height / cellSize);
    const grid = new Array(gw * gh).fill(-1);

    const samples = [];
    const active = [];

    function gridIndex(x,y){
      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      return gy * gw + gx;
    }
    function farFromNeighbors(x,y){
      const gx = Math.floor(x / cellSize);
      const gy = Math.floor(y / cellSize);
      const r = 2; // check neighbors in 5x5 around (gx,gy)
      for(let oy=-r; oy<=r; oy++){
        for(let ox=-r; ox<=r; ox++){
          const nx = gx+ox, ny = gy+oy;
          if(nx<0||ny<0||nx>=gw||ny>=gh) continue;
          const idx = grid[ny*gw+nx];
          if(idx>=0){
            const p = samples[idx];
            const dx = p.x - x, dy = p.y - y;
            if(dx*dx + dy*dy < minDist*minDist) return false;
          }
        }
      }
      return true;
    }

    // initial random
    const x0 = Math.random()*width, y0 = Math.random()*height;
    samples.push({x:x0,y:y0});
    active.push(0);
    grid[gridIndex(x0,y0)] = 0;

    while(active.length && samples.length < count){
      const ai = active[Math.floor(Math.random()*active.length)];
      const base = samples[ai];
      let placed = false;
      for(let i=0;i<k;i++){
        const ang = Math.random()*Math.PI*2;
        const rad = minDist * (1 + Math.random()); // [minDist, 2*minDist)
        const x = base.x + Math.cos(ang)*rad;
        const y = base.y + Math.sin(ang)*rad;
        if(x<=0||y<=0||x>=width||y>=height) continue;
        if(!farFromNeighbors(x,y)) continue;
        const idx = samples.length;
        samples.push({x,y});
        active.push(idx);
        grid[gridIndex(x,y)] = idx;
        placed = true;
        if(samples.length >= count) break;
      }
      if(!placed){
        // retire this active point
        const last = active.pop();
        if(ai < active.length) active[ai] = last;
      }
    }

    // If we didn’t hit `count`, sprinkle a few stratified extras
    while(samples.length < count){
      const x = Math.random()*width, y = Math.random()*height;
      if(farFromNeighbors(x,y)) samples.push({x,y});
    }

    return samples.slice(0, count);
  }

  // Create particles with blue-noise starting positions
  function seedParticlesUniform(n){
    particles.length = 0;
    const pts = poissonDisk(canvas.width, canvas.height, n);
    for(const p of pts) particles.push(makeParticle(p.x, p.y));
  }

  // --------- size & clear ----------
  function clearCanvas(hard=false){
    const i=parseInt(params.fadeColor.slice(1),16), r=(i>>16)&255,g=(i>>8)&255,b=i&255;
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.fillRect(0,0,canvas.width,canvas.height);
    if(hard){ for(const p of particles){ p.px=p.x; p.py=p.y; } }
  }
  let skipOnce=false;
  function resize(){
    const dpr=DPR();
    canvas.width  = Math.floor((canvas.clientWidth||innerWidth)*dpr);
    canvas.height = Math.floor((canvas.clientHeight||innerHeight)*dpr);
    ctx.lineCap='round'; ctx.lineJoin='round';

    // reseed with blue-noise on resize so spacing stays uniform
    seedParticlesUniform(params.density);

    clearCanvas(true);
    skipOnce=true;
  }
  new ResizeObserver(resize).observe(document.body);

  // --------- interaction (optional) ----------
  let mouse=null;
  canvas.addEventListener('pointerdown',e=>{mouse={x:e.clientX*DPR(),y:e.clientY*DPR(),d:true};});
  canvas.addEventListener('pointermove',e=>{if(mouse){mouse.x=e.clientX*DPR();mouse.y=e.clientY*DPR();}});
  canvas.addEventListener('pointerup',()=>{mouse=null;});

  // --------- loop ----------
  resize(); // seeds particles via blue-noise
  clearCanvas(true);

  let last=performance.now();
  function frame(){
    const now=performance.now();
    const dt=Math.min(0.05,(now-last)/1000); last=now;
    if(skipOnce){skipOnce=false;requestAnimationFrame(frame);return;}

    const fade = 1 - Math.pow(1 - params.fadeAlpha60, dt*60);
    if(fade>0){
      const i=parseInt(params.fadeColor.slice(1),16), r=(i>>16)&255,g=(i>>8)&255,b=i&255;
      ctx.globalCompositeOperation='source-over';
      ctx.fillStyle=`rgba(${r},${g},${b},${fade})`;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }

    const j=parseInt(params.lineColor.slice(1),16), rr=(j>>16)&255, gg=(j>>8)&255, bb=j&255;
    ctx.strokeStyle=`rgba(${rr},${gg},${bb},0.10)`;
    ctx.lineWidth=Math.max(0.2,params.thickness)*DPR();

    const sub=Math.min(6, Math.max(1, Math.ceil((params.baseSpeed*dt)/50)));
    const hs=dt/sub, maxSeg2=Math.pow(500*DPR(),2);

    for(let s=0;s<sub;s++){
      ctx.beginPath();
      for(let i=0;i<particles.length;i++){
        const p=particles[i];
        const ox=p.x, oy=p.y;

        const f = fieldVelocity(p.x, p.y, (now/1000)+s*0.0002);

        p.vx = p.vx*params.inertia + f.vx*(1-params.inertia);
        p.vy = p.vy*params.inertia + f.vy*(1-params.inertia);
        p.vx += (Math.random()-0.5)*params.jitter;
        p.vy += (Math.random()-0.5)*params.jitter;

        if(mouse){
          const dx=p.x-mouse.x, dy=p.y-mouse.y, d2=dx*dx+dy*dy+1e-2;
          const push=9000/d2;
          p.vx += dx*push*hs; p.vy += dy*push*hs;
        }

        p.x += p.vx*hs; p.y += p.vy*hs;

        let tele=false;
        if(p.x<-2){p.x=canvas.width+2;tele=true;}
        if(p.y<-2){p.y=canvas.height+2;tele=true;}
        if(p.x>canvas.width+2){p.x=-2;tele=true;}
        if(p.y>canvas.height+2){p.y=-2;tele=true;}

        const dx=p.x-ox, dy=p.y-oy, big=(dx*dx+dy*dy)>maxSeg2;
        if(tele||big){ctx.moveTo(p.x,p.y);} else {ctx.moveTo(ox,oy);ctx.lineTo(p.x,p.y);}

        p.life+=hs;
        if(p.life>p.maxLife){
          // respawns are random (runtime churn), initial layout is blue-noise
          particles[i] = spawnRandom();
        }
      }
      ctx.stroke();
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}


main();