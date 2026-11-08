/* =========================================================================
   EVERY SECOND COUNTS — 3D presentation engine
   One persistent WebGL particle field that morphs into a medical form per
   slide (DNA helix, ECG, globe, documents, CT stack, neural net, brain,
   voice waveform, orbits, heart, galaxy) + HTML overlays & slide scenes.
   ========================================================================= */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const small = () => innerWidth < 860;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const slides = $$('.slide');
const TOTAL = slides.length;

/* ---------------------------------------------------------------- RNG/noise */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
let rnd = mulberry32(1337);
function gauss(){let u=0,v=0;while(!u)u=rnd();while(!v)v=rnd();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function randDir(){const z=rnd()*2-1,a=rnd()*Math.PI*2,r=Math.sqrt(1-z*z);return[Math.cos(a)*r,z,Math.sin(a)*r]}
function norm(v){const l=Math.hypot(v[0],v[1],v[2]);return[v[0]/l,v[1]/l,v[2]/l]}
function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]}

const PERM = new Uint8Array(256), VAL = new Float32Array(256);
{const r=mulberry32(99);const p=[...Array(256).keys()];for(let i=255;i>0;i--){const j=Math.floor(r()*(i+1));[p[i],p[j]]=[p[j],p[i]]}p.forEach((v,i)=>PERM[i]=v);for(let i=0;i<256;i++)VAL[i]=r()}
const h3 = (i,j,k) => VAL[PERM[(PERM[(PERM[i&255]+j)&255]+k)&255]];
const sm = t => t*t*(3-2*t);
function vnoise(x,y,z){
  const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=sm(x-xi),yf=sm(y-yi),zf=sm(z-zi);
  const L=(a,b,t)=>a+(b-a)*t;
  return L(L(L(h3(xi,yi,zi),h3(xi+1,yi,zi),xf),L(h3(xi,yi+1,zi),h3(xi+1,yi+1,zi),xf),yf),
           L(L(h3(xi,yi,zi+1),h3(xi+1,yi,zi+1),xf),L(h3(xi,yi+1,zi+1),h3(xi+1,yi+1,zi+1),xf),yf),zf);
}
function fbm(x,y,z){let a=.5,f=1,s=0;for(let o=0;o<4;o++){s+=a*vnoise(x*f,y*f,z*f);f*=2;a*=.5}return s/.9375}
function rotEuler(x,y,z,a,b,c){
  let y1=y*Math.cos(a)-z*Math.sin(a), z1=y*Math.sin(a)+z*Math.cos(a); y=y1; z=z1;
  let x1=x*Math.cos(b)+z*Math.sin(b); z1=-x*Math.sin(b)+z*Math.cos(b); x=x1; z=z1;
  x1=x*Math.cos(c)-y*Math.sin(c); y1=x*Math.sin(c)+y*Math.cos(c);
  return [x1,y1,z];
}

/* ------------------------------------------------------------------ colours */
const hex = h => {const n=parseInt(h.slice(1),16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]};
const mixc = (a,b,t) => [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
const C = {
  amber:hex('#f08a24'), orange:hex('#f26b3a'), gold:hex('#e0a100'), cyan:hex('#0ea5c6'), teal:hex('#0aa58f'),
  blue:hex('#1e6fe8'), red:hex('#e5374f'), pink:hex('#e0457b'), violet:hex('#7a5af5'), green:hex('#16b36b'),
  white:hex('#34557a'), ice:hex('#3f86d0')
};

/* ------------------------------------------------------------ point buffers */
class Buf{
  constructor(n){this.n=n;this.i=0;this.p=new Float32Array(n*3);this.c=new Float32Array(n*3);this.a=new Float32Array(n);this.tf=null}
  put(x,y,z,col,k=1){
    if(this.i>=this.n) return;
    if(this.tf){const r=this.tf(x,y,z);x=r[0];y=r[1];z=r[2]}
    const j=this.i*3;this.p[j]=x;this.p[j+1]=y;this.p[j+2]=z;
    this.c[j]=col[0];this.c[j+1]=col[1];this.c[j+2]=col[2];this.a[this.i]=k;this.i++;
  }
}
function fill(b,col,k=.1){ // leftover particles become faint ambient dust
  b.tf=null;
  while(b.i<b.n){const d=randDir(),r=4+rnd()*6;b.put(d[0]*r*1.4,d[1]*r*.8,d[2]*r-3,col,k*(.3+rnd()*.7))}
  return b;
}

/* =================================================================== SHAPES */
function helixInto(b,n,o={}){
  const r=o.r??1.25,h=o.h??7.2,turns=o.turns??2.3,cA=o.cA??C.blue,cB=o.cB??C.teal;
  const nS=Math.floor(n*.6),nR=Math.floor(n*.3),nD=n-nS-nR,TAU=Math.PI*2;
  for(let i=0;i<nS;i++){ // backbone strands made of glowing fibres
    const s=rnd()<.5?0:1,t=rnd(),f=Math.floor(rnd()*7)-3;
    const a=t*turns*TAU+s*Math.PI+f*.045,rr=r+f*.025+gauss()*.02;
    b.put(Math.cos(a)*rr,(t-.5)*h+gauss()*.015,Math.sin(a)*rr,mixc(cA,cB,t),.55+rnd()*.6);
  }
  const rungs=Math.round(turns*11);
  const BP=[[C.amber,C.cyan],[C.cyan,C.amber],[C.red,C.green],[C.green,C.red]]; // A-T / G-C base pairs
  for(let i=0;i<nR;i++){
    const j=Math.floor(rnd()*rungs),t=(j+.5)/rungs,a=t*turns*TAU,u=rnd();
    const x0=Math.cos(a)*r,z0=Math.sin(a)*r,pair=BP[(j*7)%4];
    b.put(x0*(1-2*u)+gauss()*.012,(t-.5)*h+gauss()*.012,z0*(1-2*u)+gauss()*.012,u<.5?pair[0]:pair[1],.45+rnd()*.35);
  }
  for(let i=0;i<nD;i++){
    const a=rnd()*TAU,rr=1.6+rnd()*2.2;
    b.put(Math.cos(a)*rr,(rnd()-.5)*h*1.1,Math.sin(a)*rr,mixc(cA,cB,rnd()),.1+rnd()*.18);
  }
}
function heartXY(t){const s=Math.sin(t);return[16*s*s*s,13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)]}
function heartInto(b,n,o={}){
  const sc=o.s??.135,nS=Math.floor(n*.72),nI=Math.floor(n*.2),nD=n-nS-nI;
  for(let i=0;i<nS;i++){
    const t=rnd()*Math.PI*2,u=rnd()*2-1,k=Math.pow(1-u*u,.38),[hx,hy]=heartXY(t);
    b.put(hx*sc*k,(hy+2)*sc*k,u*1.0,mixc(C.red,C.pink,clamp((hy+17)/30,0,1)*.8),.55+rnd()*.5);
  }
  for(let i=0;i<nI;i++){
    const t=rnd()*Math.PI*2,f=Math.sqrt(rnd()),u=(rnd()*2-1)*f,[hx,hy]=heartXY(t);
    b.put(hx*sc*f*.9,(hy+2)*sc*f*.9,u*.8,C.red,.2);
  }
  for(let i=0;i<nD;i++){const d=randDir(),r=2.8+rnd()*2;b.put(d[0]*r,d[1]*r,d[2]*r*.6,C.pink,.1)}
}

/* --- shared geometry used by both particles and 3D extras --- */
const GLOBE = (() => {
  const R=2.2,pin=norm([.36,.40,.84]);
  const t1=norm(cross(pin,[0,1,0])),t2=cross(t1,pin);
  const towers=[0,1,2].map(k=>{const f=k*Math.PI*2/3+.4;return norm([pin[0]+(t1[0]*Math.cos(f)+t2[0]*Math.sin(f))*.42,pin[1]+(t1[1]*Math.cos(f)+t2[1]*Math.sin(f))*.42,pin[2]+(t1[2]*Math.cos(f)+t2[2]*Math.sin(f))*.42])});
  return {R,pin,towers};
})();
const CT = {slices:9,rx:2.0,rz:1.45,y0:-2.2,y1:2.2,anom:{s:5,x:.78,z:-.12}};
CT.anomY = CT.y0+(CT.y1-CT.y0)*CT.anom.s/(CT.slices-1);
const BRAIN = {anom:[1.3,.72,1.12]};
const NEURAL = (() => {
  const r=mulberry32(21),layers=[5,8,9,8,4],nodes=[],L=[];
  layers.forEach((cnt,li)=>{const arr=[];for(let k=0;k<cnt;k++){arr.push(nodes.length);nodes.push([-3.2+li*1.6,(k-(cnt-1)/2)*.66+(r()-.5)*.12,(r()-.5)*1.4,li])}L.push(arr)});
  const edges=[];for(let li=0;li<L.length-1;li++)for(const a of L[li])for(const c of L[li+1])if(r()<.72)edges.push([a,c]);
  const out={};edges.forEach((e,i)=>{(out[e[0]]=out[e[0]]||[]).push(i)});
  return {nodes,L,edges,out,flag:L[L.length-1][1]};
})();

const SHAPES = {
  helix(n){const b=new Buf(n);b.tf=null;helixInto(b,Math.floor(n*.92));return fill(b,C.blue,.1)},

  ecg(n){
    const b=new Buf(n);
    const ecgY=x=>{const P=4.2,ph=(((x%P)+P)%P)/P,g=(c,w,a)=>a*Math.exp(-((ph-c)**2)/(2*w*w));
      return g(.18,.035,.16)+g(.355,.008,-.14)+g(.39,.011,1.75)+g(.425,.01,-.5)+g(.62,.05,.32)};
    const M=6000,X0=-9,X1=9,pts=[],L=[0];
    for(let i=0;i<=M;i++){const x=X0+(X1-X0)*i/M;pts.push([x,ecgY(x)]);if(i)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]))}
    const tot=L[M],nL=Math.floor(n*.6);
    for(let i=0;i<nL;i++){ // sample along arc length so spikes stay dense
      const s=rnd()*tot;let lo=0,hi=M;while(hi-lo>1){const m=(lo+hi)>>1;if(L[m]<s)lo=m;else hi=m}
      const p=pts[lo];b.put(p[0],p[1]*1.15+gauss()*.018,gauss()*.04,mixc(C.green,C.white,rnd()*.25),.7+rnd()*.5);
    }
    const nG=Math.floor(n*.26);
    for(let i=0;i<nG;i++){let x,y;
      if(rnd()<.5){x=Math.round((X0+rnd()*(X1-X0))/.6)*.6;y=-3.3+rnd()*6.6}else{y=Math.round((-3.3+rnd()*6.6)/.6)*.6;x=X0+rnd()*(X1-X0)}
      b.put(x,y,-1.2,C.green,.08+rnd()*.06)}
    return fill(b,C.green,.08);
  },

  globe(n){
    const b=new Buf(n),R=GLOBE.R,P=GLOBE.pin;
    const S=[];for(let i=0;i<3000;i++){const d=randDir();S.push(fbm(d[0]*1.5+3,d[1]*1.5+1,d[2]*1.5+7))}
    S.sort((a,c)=>a-c);const thr=S[Math.floor(S.length*.6)];
    const nG=Math.floor(n*.72);let k=0,guard=0;
    while(k<nG&&guard++<n*60){ // noise "continents" + sparse ocean
      const d=randDir(),v=fbm(d[0]*1.5+3,d[1]*1.5+1,d[2]*1.5+7);
      if(v>thr){b.put(d[0]*R,d[1]*R,d[2]*R,mixc(C.teal,C.cyan,Math.min(1,(v-thr)*6)),.45+Math.min(.7,(v-thr)*5));k++}
      else if(rnd()<.09){b.put(d[0]*R*.995,d[1]*R*.995,d[2]*R*.995,C.blue,.24);k++}
    }
    const nGr=Math.floor(n*.06);
    for(let i=0;i<nGr;i++){let lat,lon;
      if(rnd()<.5){lat=(Math.floor(rnd()*5)-2)*Math.PI/6;lon=rnd()*Math.PI*2}else{lon=Math.floor(rnd()*12)*Math.PI/6;lat=(rnd()-.5)*Math.PI}
      const rr=R*1.003;b.put(Math.cos(lat)*Math.cos(lon)*rr,Math.sin(lat)*rr,Math.cos(lat)*Math.sin(lon)*rr,C.cyan,.1)}
    const nA=Math.floor(n*.07);
    for(let i=0;i<nA;i++){const d=randDir(),rr=R*(1.08+rnd()*.12);b.put(d[0]*rr,d[1]*rr,d[2]*rr,C.cyan,.07+rnd()*.07)}
    const nP=Math.floor(n*.05);
    for(let i=0;i<nP;i++){
      if(rnd()<.55) b.put(P[0]*R+gauss()*.035,P[1]*R+gauss()*.035,P[2]*R+gauss()*.035,C.red,1.4);
      else{const hh=R+rnd()*1.0;b.put(P[0]*hh+gauss()*.008,P[1]*hh+gauss()*.008,P[2]*hh+gauss()*.008,mixc(C.red,C.white,rnd()*.3),1.0)}
    }
    for(const T of GLOBE.towers)for(let i=0;i<Math.floor(n*.006);i++){const hh=R+rnd()*.35;b.put(T[0]*hh+gauss()*.01,T[1]*hh+gauss()*.01,T[2]*hh+gauss()*.01,C.cyan,1.2)}
    return fill(b,C.cyan,.08);
  },

  papers(n){
    const b=new Buf(n),D=64,per=Math.floor(n*.86/D);
    for(let d=0;d<D;d++){
      const th=rnd()*Math.PI*2,rad=.9+rnd()*1.8,cy=(rnd()-.5)*4.8,cx=Math.cos(th)*rad,cz=Math.sin(th)*rad;
      const ex=rnd()*Math.PI,ey=rnd()*Math.PI,ez=rnd()*Math.PI,urgent=rnd()<.14;
      const col=urgent?C.red:(rnd()<.2?C.amber:C.white),w=.5,h=.68,rows=6+Math.floor(rnd()*3);
      const lens=[...Array(rows)].map(()=>.35+rnd()*.6);
      for(let i=0;i<per;i++){let x,y;
        if(rnd()<.38){const s=rnd()*2*(w+h);
          if(s<w){x=-w/2+s;y=h/2}else if(s<w+h){x=w/2;y=h/2-(s-w)}else if(s<2*w+h){x=w/2-(s-w-h);y=-h/2}else{x=-w/2;y=-h/2+(s-2*w-h)}}
        else{const r=Math.floor(rnd()*rows);y=h/2-.1-r*(h-.2)/(rows-1);x=-w/2+.07+rnd()*(w-.14)*lens[r]}
        const p=rotEuler(x,y,0,ex,ey,ez);b.put(cx+p[0],cy+p[1],cz+p[2],col,urgent?.9:.5+rnd()*.3);
      }
    }
    return fill(b,C.white,.07);
  },

  ct(n){
    const b=new Buf(n),S=CT.slices,per=Math.floor(n*.88/S);
    for(let s=0;s<S;s++){
      const y=CT.y0+(CT.y1-CT.y0)*s/(S-1),ls=.55+.45*Math.sin((s+.5)/S*Math.PI);
      for(let i=0;i<per;i++){
        if(rnd()<.3){const a=rnd()*Math.PI*2;b.put(Math.cos(a)*CT.rx+gauss()*.015,y,Math.sin(a)*CT.rz+gauss()*.015,C.ice,.8);continue}
        let u,v;do{u=rnd()*2-1;v=rnd()*2-1}while(u*u+v*v>1);
        const x=u*CT.rx*.95,z=v*CT.rz*.95;
        const lung=((x-.85)/(.62*ls))**2+((z+.05)/(.88*ls))**2<1||((x+.85)/(.62*ls))**2+((z+.05)/(.88*ls))**2<1;
        if(lung&&rnd()>.06){i--;continue}
        const spine=x*x+(z+1.0)**2<.07;
        b.put(x,y+gauss()*.01,z,spine?C.white:C.ice,spine?1.0:lung?.12:.2+rnd()*.15);
      }
      if(s===CT.anom.s)for(let i=0;i<Math.floor(n*.015);i++)b.put(CT.anom.x+gauss()*.06,y+gauss()*.02,CT.anom.z+gauss()*.06,C.red,1.7);
    }
    return fill(b,C.ice,.07);
  },

  neural(n){
    const b=new Buf(n),{nodes,edges}=NEURAL,cols=[C.cyan,C.cyan,C.violet,C.violet,C.white];
    const nN=Math.floor(n*.42),nE=Math.floor(n*.4);
    for(let i=0;i<nN;i++){
      const id=Math.floor(rnd()*nodes.length),nd=nodes[id],halo=rnd()<.3,s=halo?.16:.055,flag=id===NEURAL.flag;
      b.put(nd[0]+gauss()*s,nd[1]+gauss()*s,nd[2]+gauss()*s,flag?C.amber:cols[nd[3]],halo?.25:(flag?1.6:1));
    }
    for(let i=0;i<nE;i++){
      const e=edges[Math.floor(rnd()*edges.length)],A=nodes[e[0]],B=nodes[e[1]],t=rnd();
      b.put(A[0]+(B[0]-A[0])*t+gauss()*.008,A[1]+(B[1]-A[1])*t+gauss()*.008,A[2]+(B[2]-A[2])*t+gauss()*.008,mixc(cols[A[3]],cols[B[3]],t),.18);
    }
    return fill(b,C.cyan,.09);
  },

  brain(n){
    const b=new Buf(n),A=BRAIN.anom,nH=Math.floor(n*.78),nC=Math.floor(n*.1),nS=Math.floor(n*.04);
    const col=(x,y,z,k)=>{const d=Math.hypot(x-A[0],y-A[1],z-A[2]);return d<.45?[mixc(C.amber,C.red,d/.45),1.6]:[mixc(C.violet,C.pink,clamp((y+1.3)/2.6,0,1)),k]};
    for(let i=0;i<nH;i++){
      const s=rnd()<.5?-1:1,d=randDir();
      let f=1+.075*Math.sin(d[0]*9+d[1]*7)*Math.sin(d[2]*8+d[1]*5)+.06*(fbm(d[0]*3+s*5,d[1]*3,d[2]*3)-.5);
      const inner=rnd()<.22;if(inner)f*=Math.cbrt(rnd())*.92;
      let x=d[0]*1.18*f,y=d[1]*1.12*f,z=d[2]*1.72*f;if(x*s<0)x*=.25;x+=s*.66;y+=.2;
      const [c,k]=col(x,y,z,inner?.24:.8+rnd()*.5);b.put(x,y,z,c,k);
    }
    for(let i=0;i<nC;i++){const d=randDir(),f=1+.05*Math.sin(d[1]*34);b.put(d[0]*1.05*f,-.85+d[1]*.48*f,-1.15+d[2]*.62*f,C.violet,.5+rnd()*.3)}
    for(let i=0;i<nS;i++){const a=rnd()*Math.PI*2,t=rnd();b.put(Math.cos(a)*.2,-.7-t*1.3,-.55+Math.sin(a)*.2-t*.15,C.violet,.45)}
    return fill(b,C.pink,.08);
  },

  wave(n){
    const b=new Buf(n),env=x=>(.2+.8*Math.abs(Math.sin(x*1.3))*Math.abs(Math.sin(x*.41+1)))*1.5;
    const nW=Math.floor(n*.42),nB=Math.floor(n*.1),nT=Math.floor(n*.38),rows=11,rowY=i=>2.1-i*.42;
    for(let i=0;i<nW;i++){const x=Math.round((-5.2+rnd()*4.6)/.1)*.1,a=env(x),y=(rnd()*2-1)*a;b.put(x,y,gauss()*.05,mixc(C.cyan,C.blue,Math.abs(y)/1.6),.5+rnd()*.5)}
    const r2=mulberry32(5),words=[];
    for(let i=0;i<rows;i++){const ws=[];let x=1;const end=1+(i===0?1.8:i===rows-1?2.2:3+r2()*1.2);while(x<end){const w=.18+r2()*.55;ws.push([x,Math.min(x+w,end)]);x+=w+.1}words.push(ws)}
    for(let i=0;i<nT;i++){const r=Math.floor(rnd()*rows),ws=words[r],w=ws[Math.floor(rnd()*ws.length)];b.put(w[0]+rnd()*(w[1]-w[0]),rowY(r)+gauss()*.03,gauss()*.02,r===0?C.amber:C.white,r===0?.9:.5+rnd()*.3)}
    for(let i=0;i<nB;i++){const t=rnd(),y0=(rnd()*2-1)*1.2,y1=rowY(Math.floor(rnd()*rows));b.put(-.6+t*1.6,y0+(y1-y0)*sm(t)+gauss()*.03,Math.sin(t*Math.PI)*.8+gauss()*.05,mixc(C.cyan,C.amber,t),.3)}
    return fill(b,C.cyan,.08);
  },

  rings(n){
    const b=new Buf(n),R=[{R:3.6,t:[1.25,0,.2],c:C.gold},{R:3.0,t:[1.0,.6,-.3],c:C.white},{R:4.2,t:[1.45,-.5,.1],c:C.cyan}],nR=Math.floor(n*.6);
    for(let i=0;i<nR;i++){const g=R[i%3],a=rnd()*Math.PI*2,rr=g.R+gauss()*.05,p=rotEuler(Math.cos(a)*rr,Math.sin(a)*rr,gauss()*.03,...g.t);b.put(p[0],p[1],p[2],g.c,.3+rnd()*.5)}
    const nS=Math.floor(n*.28);
    for(let i=0;i<nS;i++)b.put((rnd()-.5)*22,(rnd()-.5)*13,-3-rnd()*7,rnd()<.2?C.gold:C.white,.12+rnd()*.25);
    return fill(b,C.gold,.08);
  },

  heart(n){const b=new Buf(n);heartInto(b,Math.floor(n*.95));return fill(b,C.pink,.08)},

  galaxy(n){
    const b=new Buf(n),nG=Math.floor(n*.86);
    for(let i=0;i<nG;i++){
      const arm=i%3,r=Math.pow(rnd(),.55)*5.4,a=arm*Math.PI*2/3+r*.95+gauss()*(.17/(r*.4+.35)),sp=.12*(1.4-r/5.4);
      b.put(Math.cos(a)*r+gauss()*sp*2,gauss()*sp*1.6,Math.sin(a)*r+gauss()*sp*2,r<.8?mixc(C.white,C.gold,r/.8):mixc(C.violet,C.cyan,(r-.8)/4.6),r<.8?1:.35+rnd()*.45);
    }
    return fill(b,C.violet,.09);
  },

  split(n){
    const b=new Buf(n),h=Math.floor(n*.48);
    b.tf=(x,y,z)=>[x*.7-6.6,y*.7,z*.7];helixInto(b,h,{cA:C.cyan,cB:C.blue,h:6.4,turns:2});
    b.tf=(x,y,z)=>[x*.5+6.9,y*.5+.1,z*.5];heartInto(b,Math.floor(n*.48));
    return fill(b,C.white,.07);
  },

  finale(n){
    const b=new Buf(n);b.tf=(x,y,z)=>[y*1.75,x,z];
    helixInto(b,Math.floor(n*.88),{h:8,turns:3.4,cA:C.blue,cB:C.teal,r:1.1});
    return fill(b,C.blue,.08);
  }
};

/* ============================================================= SLIDE CONFIG */
const CFG = [
  {shape:'ecg',    pos:[0,-.3,-2.6], rot:[0,0,0],     mode:1, fadeX:-.4, accent:'#e5374f', center:true, op:.75},   // slide 1
  {shape:'globe',  pos:[3.0,.15,0],  rot:[.22,-.32,0],sway:.45, extra:'globe', accent:'#0e93b8'},                 // slide 2
  {shape:'papers', pos:[3.0,0,0],    rot:[.12,0,0],   spinY:.3, chaos:.1, accent:'#ea7a12'},                       // slide 3
  {shape:'ct',     pos:[3.1,.2,0],   rot:[.45,0,0],   spinY:.13, extra:'ct', accent:'#1e6fe8', scale:.86},                    // slide 4
  {shape:'neural', pos:[2.9,0,0],    rot:[0,-.5,0],   sway:.35, extra:'neural', accent:'#0a9e88'},                 // slide 5
  {shape:'brain',  pos:[.4,.2,-4.5], rot:[.12,1.15,0],sway:.4, mode:2, accent:'#d93d73', center:true, op:.4}, // slide 6
  {shape:'rings',  pos:[3.1,0,-1.2], rot:[.25,0,0],   spinY:.12, accent:'#c88a04', scale:.7},                      // slide 7
  {shape:'galaxy', pos:[0,0,-3],     rot:[1.05,0,.2], spinY:.07, accent:'#6d4ef0', center:true, op:.6},            // slide 8
  {shape:'split',  pos:[0,-.1,-3.5], rot:[0,0,0],     sway:.16, accent:'#0a9e88', center:true},                    // slide 9
  {shape:'finale', pos:[0,-.2,-2.6], rot:[0,0,.08],   spinX:.35, accent:'#1e6fe8', center:true, op:.32}             // slide 10
];

/* =========================================================== WEBGL ENGINE */
const GL = { ok: !!window.THREE };
const N = small() ? 9000 : 16000;
let U, renderer, scene, camera, root, spinG, geo;
let aFrom, aTo, aCF, aCT, aAF, aAT, aRand;
const extras = {};

function initGL(){
  if(!GL.ok) return;
  const canvas = $('#gl');
  try{ renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:true, powerPreference:'high-performance'}); }
  catch(e){ GL.ok=false; return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(innerWidth,innerHeight,false);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40,innerWidth/innerHeight,.1,100);
  camera.position.set(0,0,10);
  root = new THREE.Group(); spinG = new THREE.Group(); root.add(spinG); scene.add(root);

  aFrom=new Float32Array(N*3); aTo=new Float32Array(N*3); aCF=new Float32Array(N*3); aCT=new Float32Array(N*3); aAF=new Float32Array(N); aAT=new Float32Array(N); aRand=new Float32Array(N*4);
  const r=mulberry32(4242);
  for(let i=0;i<N;i++){aRand[i*4]=r();aRand[i*4+1]=r();aRand[i*4+2]=r();aRand[i*4+3]=r()}
  for(let i=0;i<N*3;i++){aFrom[i]=(r()-.5)*30;aTo[i]=aFrom[i]}
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(aTo,3));
  geo.setAttribute('aFrom',new THREE.BufferAttribute(aFrom,3));
  geo.setAttribute('aTo',new THREE.BufferAttribute(aTo,3));
  geo.setAttribute('aCF',new THREE.BufferAttribute(aCF,3));
  geo.setAttribute('aCT',new THREE.BufferAttribute(aCT,3));
  geo.setAttribute('aAF',new THREE.BufferAttribute(aAF,1));
  geo.setAttribute('aAT',new THREE.BufferAttribute(aAT,1));
  geo.setAttribute('aRand',new THREE.BufferAttribute(aRand,4));

  U = {uP:{value:1},uT:{value:0},uSize:{value:small()?2.0:2.3},uPR:{value:renderer.getPixelRatio()},uChaos:{value:0},
       uBeat:{value:0},uMode:{value:0},uFadeX:{value:0},uFadeAmt:{value:0},uSweep:{value:0},uAmt:{value:0},uOpacity:{value:0}};
  const mat = new THREE.ShaderMaterial({
    uniforms:U, transparent:true, depthWrite:false, blending:THREE.NormalBlending,
    vertexShader:`
      uniform float uP,uT,uSize,uPR,uChaos,uBeat,uMode,uSweep,uAmt,uOpacity,uFadeX,uFadeAmt;
      attribute vec3 aFrom; attribute vec3 aTo; attribute vec3 aCF; attribute vec3 aCT; attribute float aAF; attribute float aAT; attribute vec4 aRand;
      varying vec3 vC; varying float vA; varying float vK;
      float ease(float t){ return t<.5 ? 4.*t*t*t : 1.-pow(-2.*t+2.,3.)/2.; }
      void main(){
        float p = ease(clamp((uP - aRand.x*.4)/.6, 0., 1.));
        vec3 pos = mix(aFrom, aTo, p);
        float fly = sin(p*3.14159265);
        pos += vec3(sin(aRand.w*12.57+uT*.9), cos(aRand.w*9.1+uT*1.1), sin(aRand.w*5.3+uT*.7)) * fly * .9;
        pos += vec3(sin(uT*.6+aRand.z*6.28), cos(uT*.5+aRand.w*6.28), sin(uT*.45+aRand.y*6.28)) * (.022 + uChaos*.22);
        float bright = 1.;
        if(uMode > .5 && uMode < 1.5){            // ECG monitor sweep
          float dx = uSweep - pos.x;
          float trail = dx > 0. ? exp(-dx*.45) : exp(dx*10.);
          bright = mix(1., .32 + 2.2*trail, uAmt);
        } else if(uMode > 1.5 && uMode < 2.5){    // MRI scan band
          float bnd = exp(-pow(pos.y-uSweep, 2.)*14.);
          bright = mix(1., .7 + 2.3*bnd, uAmt);
        } else if(uMode > 2.5 && pos.x < -.45){   // talking waveform
          float s = .25 + .75*abs(sin(uT*4.2 + pos.x*2.3))*(.55+.45*sin(uT*1.9+pos.x*.8));
          pos.y *= mix(1., s, uAmt);
        }
        if(uBeat > 0.){                            // heartbeat lub-dub
          float ph = fract(uT*1.1);
          float bt = exp(-pow((ph-.08)*14.,2.)) + .6*exp(-pow((ph-.27)*14.,2.));
          pos *= 1. + bt*.075*uBeat; bright += bt*.6*uBeat;
        }
        vec4 mv = modelViewMatrix * vec4(pos,1.);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize*(.55 + aRand.y*.9)*uPR*(10./-mv.z)*(1. + fly*.7);
        vC = mix(aCF, aCT, p);
        vK = mix(aAF, aAT, p) * bright;
        vA = uOpacity * smoothstep(32., 6., -mv.z);
        float wx = (modelMatrix * vec4(pos,1.)).x;   // fade out behind the text column
        vA *= mix(1., smoothstep(uFadeX-1.4, uFadeX+1.4, wx), uFadeAmt);
      }`,
    fragmentShader:`
      varying vec3 vC; varying float vA; varying float vK;
      void main(){
        float d = length(gl_PointCoord - .5);
        if(d > .5) discard;
        float a = smoothstep(.5, .28, d) * vA * clamp(vK*1.05, 0., 1.);
        gl_FragColor = vec4(vC, a);
      }`
  });
  const pts = new THREE.Points(geo,mat); pts.frustumCulled=false; spinG.add(pts);
  buildExtras();
}

/* ---- morph to a new shape: freeze current blended state into aFrom ---- */
const easeCPU = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;
function morphTo(shape){
  if(!GL.ok) return;
  const P=U.uP.value,T=U.uT.value;
  for(let i=0;i<N;i++){
    const p=easeCPU(clamp((P-aRand[i*4]*.4)/.6,0,1)),fly=Math.sin(p*Math.PI)*.9,w=aRand[i*4+3],j=i*3;
    aFrom[j]  +=(aTo[j]  -aFrom[j])*p+Math.sin(w*12.57+T*.9)*fly;
    aFrom[j+1]+=(aTo[j+1]-aFrom[j+1])*p+Math.cos(w*9.1+T*1.1)*fly;
    aFrom[j+2]+=(aTo[j+2]-aFrom[j+2])*p+Math.sin(w*5.3+T*.7)*fly;
    aCF[j]+=(aCT[j]-aCF[j])*p; aCF[j+1]+=(aCT[j+1]-aCF[j+1])*p; aCF[j+2]+=(aCT[j+2]-aCF[j+2])*p;
    aAF[i]+=(aAT[i]-aAF[i])*p;
  }
  aTo.set(shape.p); aCT.set(shape.c); aAT.set(shape.a);
  for(const k of ['position','aFrom','aTo','aCF','aCT','aAF','aAT']) geo.attributes[k].needsUpdate=true;
  U.uP.value=0;
}

/* ------------------------------------------------------------ 3D extras */
let dotTex;
function makeDotTex(){
  const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');
  const gr=g.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.3,'rgba(255,255,255,.6)');gr.addColorStop(1,'rgba(255,255,255,0)');
  g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);
}
const V3 = a => new THREE.Vector3(a[0],a[1],a[2]);
const addMat = (o={}) => Object.assign({transparent:true,depthWrite:false,blending:THREE.NormalBlending,opacity:0},o);
function lineShader(color){
  return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.NormalBlending,
    uniforms:{uPulse:{value:0},uFade:{value:0},uColor:{value:new THREE.Color(color)}},
    vertexShader:`attribute float aT; varying float vT; void main(){ vT=aT; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform float uPulse,uFade; uniform vec3 uColor; varying float vT;
      void main(){ float a=min(1., .25+1.6*exp(-pow((vT-uPulse)*9.,2.))); gl_FragColor=vec4(uColor, a*uFade); }`});
}
function makeMarker(color){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.RingGeometry(.2,.226,64),new THREE.MeshBasicMaterial(addMat({color,side:THREE.DoubleSide})));
  const pts=[];for(let k=0;k<4;k++){const a=k*Math.PI/2;pts.push(new THREE.Vector3(Math.cos(a)*.27,Math.sin(a)*.27,0),new THREE.Vector3(Math.cos(a)*.4,Math.sin(a)*.4,0))}
  const cross_=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial(addMat({color})));
  g.add(ring,cross_);g.userData.mats=[ring.material,cross_.material];return g;
}
function buildExtras(){
  dotTex = makeDotTex();

  /* globe: tower→caller signal arcs + location ping rings */
  {
    const g=new THREE.Group(),R=GLOBE.R,P=V3(GLOBE.pin),arcs=[],rings=[];
    GLOBE.towers.forEach(T=>{
      const a=V3(T).multiplyScalar(R+.3),b=P.clone().multiplyScalar(R+.02),mid=a.clone().add(b).normalize().multiplyScalar(R*1.45);
      const pts=new THREE.QuadraticBezierCurve3(a,mid,b).getPoints(80);
      const lg=new THREE.BufferGeometry().setFromPoints(pts);lg.setAttribute('aT',new THREE.BufferAttribute(new Float32Array(pts.map((_,i)=>i/80)),1));
      const m=lineShader('#0ea5c6');const l=new THREE.Line(lg,m);g.add(l);arcs.push(m);
    });
    for(let k=0;k<3;k++){
      const m=new THREE.Mesh(new THREE.RingGeometry(.07,.09,64),new THREE.MeshBasicMaterial(addMat({color:'#e5374f',side:THREE.DoubleSide})));
      m.position.copy(P).multiplyScalar(R*1.01);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),P);g.add(m);rings.push(m);
    }
    extras.globe={obj:g,update(t,f){
      arcs.forEach((m,k)=>{m.uniforms.uFade.value=f;m.uniforms.uPulse.value=((t*.55+k*.33)%1)*1.3-.15});
      rings.forEach((m,k)=>{const ph=(t*.55+k/3)%1;m.scale.setScalar(1+ph*9);m.material.opacity=(1-ph)*.9*f});
    }};
  }

  /* ct: moving scanner gantry ring + anomaly marker */
  {
    const g=new THREE.Group();
    const tm1=new THREE.MeshBasicMaterial(addMat({color:'#1e6fe8'})),tm2=new THREE.MeshBasicMaterial(addMat({color:'#0ea5c6'}));
    const t1=new THREE.Mesh(new THREE.TorusGeometry(1,.012,6,160),tm1),t2=new THREE.Mesh(new THREE.TorusGeometry(1,.05,8,160),tm2);
    [t1,t2].forEach(t=>{t.rotation.x=Math.PI/2;t.scale.set(CT.rx*1.12,CT.rz*1.12,1);g.add(t)});
    const mk=makeMarker('#e5374f');mk.position.set(CT.anom.x,CT.anomY,CT.anom.z);g.add(mk);
    extras.ct={obj:g,update(t,f){
      const y=Math.sin(t*.75)*2.5;t1.position.y=t2.position.y=y;
      tm1.opacity=.9*f;tm2.opacity=.18*f;
      const flare=Math.exp(-Math.pow((y-CT.anomY)*3,2));
      mk.lookAt(camera.position);mk.scale.setScalar(1+.12*Math.sin(t*4)+flare*.5);
      mk.userData.mats.forEach(m=>m.opacity=f*(.45+.55*flare));
    }};
  }

  /* neural: edges + signals travelling through the network */
  {
    const g=new THREE.Group(),{nodes,edges,out,L}=NEURAL,pts=[];
    edges.forEach(e=>pts.push(V3(nodes[e[0]]),V3(nodes[e[1]])));
    const lm=new THREE.LineBasicMaterial(addMat({color:'#0aa58f'}));
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),lm));
    const S=110,sp=new Float32Array(S*3),state=[];
    const firstEdges=edges.map((e,i)=>[e,i]).filter(([e])=>L[0].includes(e[0])).map(([,i])=>i);
    for(let i=0;i<S;i++)state.push({e:edges.length*Math.random()|0,t:Math.random(),v:.5+Math.random()*.7});
    const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
    const sm_=new THREE.PointsMaterial(addMat({color:'#1e6fe8',size:.14,map:dotTex,sizeAttenuation:true}));
    g.add(new THREE.Points(sg,sm_));
    extras.neural={obj:g,update(t,f,dt){
      lm.opacity=.16*f;sm_.opacity=f;
      for(let i=0;i<S;i++){const s=state[i];s.t+=dt*s.v;
        if(s.t>=1){const nx=out[edges[s.e][1]];s.e=nx?nx[Math.random()*nx.length|0]:firstEdges[Math.random()*firstEdges.length|0];s.t=0}
        const A=nodes[edges[s.e][0]],B=nodes[edges[s.e][1]];
        sp[i*3]=A[0]+(B[0]-A[0])*s.t;sp[i*3+1]=A[1]+(B[1]-A[1])*s.t;sp[i*3+2]=A[2]+(B[2]-A[2])*s.t;}
      sg.attributes.position.needsUpdate=true;
    }};
  }

  /* brain: MRI scan plane + highlighted urgent area */
  {
    const g=new THREE.Group();
    const pg=new THREE.PlaneGeometry(3.3,4.3),pm=new THREE.MeshBasicMaterial(addMat({color:'#e0457b',side:THREE.DoubleSide}));
    const plane=new THREE.Mesh(pg,pm);plane.rotation.x=-Math.PI/2;
    const em=new THREE.LineBasicMaterial(addMat({color:'#e0457b'}));const edge=new THREE.LineSegments(new THREE.EdgesGeometry(pg),em);plane.add(edge);
    g.add(plane);
    const mk=makeMarker('#ea7a12');mk.position.set(...BRAIN.anom);g.add(mk);
    extras.brain={obj:g,update(t,f){
      plane.position.y=U.uSweep.value;pm.opacity=.05*f;em.opacity=.55*f;
      mk.lookAt(camera.position);mk.scale.setScalar(1.3+.15*Math.sin(t*4));mk.userData.mats.forEach(m=>m.opacity=f*.95);
    }};
  }
  for(const k in extras){extras[k].fade=0;extras[k].obj.visible=false;spinG.add(extras[k].obj)}
}

/* --------------------------------------------------------- render loop */
const S = {cfg:CFG[0], pos:{x:0,y:0,z:0}, rot:{x:0,y:0,z:0}, scale:1, angY:0, angX:0, spinY:0, spinX:0,
           sway:0, chaos:0, beat:0, amt:0, op:0, homeY:0, homeX:0};
const mouse = {x:0,y:0,tx:0,ty:0};
let last = performance.now();

function layoutTarget(cfg){
  const p=[...cfg.pos];let sc=cfg.scale??1;
  if(small()){ p[0]=0; p[1]=cfg.center?p[1]:1.2; p[2]-=2.5; sc*=.8; }
  else{ const a=innerWidth/innerHeight; if(a<1.7&&!cfg.center){ p[0]*=Math.max(.75,a/1.78); sc*=Math.max(.78,a/1.78); } }
  return {p,sc};
}

function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min(.12,(now-last)/1000);last=now;
  if(!GL.ok) return;
  const t=(U.uT.value+=dt), cfg=S.cfg, k=1-Math.exp(-dt*2.2);
  if(U.uP.value<1) U.uP.value=Math.min(1,U.uP.value+dt/2.4);

  const {p,sc}=layoutTarget(cfg);
  S.pos.x+=(p[0]-S.pos.x)*k;S.pos.y+=(p[1]-S.pos.y)*k;S.pos.z+=(p[2]-S.pos.z)*k;
  S.rot.x+=(cfg.rot[0]-S.rot.x)*k;S.rot.y+=(cfg.rot[1]-S.rot.y)*k;S.rot.z+=(cfg.rot[2]-S.rot.z)*k;
  S.scale+=(sc-S.scale)*k;
  root.position.set(S.pos.x,S.pos.y,S.pos.z);root.rotation.set(S.rot.x,S.rot.y,S.rot.z);root.scale.setScalar(S.scale);

  const sy=REDUCED?(cfg.spinY||0)*.3:(cfg.spinY||0), sx=REDUCED?(cfg.spinX||0)*.3:(cfg.spinX||0);
  S.spinY+=(sy-S.spinY)*k;S.spinX+=(sx-S.spinX)*k;
  if(sy) S.angY+=dt*S.spinY; else S.angY+=(S.homeY-S.angY)*(1-Math.exp(-dt*1.4));
  if(sx) S.angX+=dt*S.spinX; else S.angX+=(S.homeX-S.angX)*(1-Math.exp(-dt*1.4));
  S.sway+=((cfg.sway||0)-S.sway)*k;
  spinG.rotation.set(S.angX,S.angY+Math.sin(t*.32)*S.sway,0);

  S.chaos+=((cfg.chaos||0)-S.chaos)*k;U.uChaos.value=S.chaos;
  S.beat+=((cfg.beat||0)-S.beat)*k;U.uBeat.value=S.beat;
  S.amt+=((cfg.mode?1:0)-S.amt)*k;U.uAmt.value=S.amt;
  const fd=cfg.fadeX!=null&&!small();if(fd)U.uFadeX.value=cfg.fadeX;
  U.uFadeAmt.value+=((fd?1:0)-U.uFadeAmt.value)*k;
  if(cfg.mode) U.uMode.value=cfg.mode;
  if(U.uMode.value===1) U.uSweep.value=((t*3.4)%19)-9.5;
  else if(U.uMode.value===2) U.uSweep.value=Math.sin(t*.9)*1.55+.2;
  const opT=(cfg.op??1)*(small()?.55:1);
  S.op+=(opT-S.op)*(1-Math.exp(-dt*1.6));U.uOpacity.value=S.op;

  for(const name in extras){
    const e=extras[name],target=(cfg.extra===name&&U.uP.value>.55)?1:0;
    e.fade+=(target-e.fade)*(1-Math.exp(-dt*(target?2:5)));
    e.obj.visible=e.fade>.005;
    if(e.obj.visible) e.update(t,e.fade,dt);
  }

  mouse.x+=(mouse.tx-mouse.x)*.04;mouse.y+=(mouse.ty-mouse.y)*.04;
  camera.position.set(mouse.x*.55,-mouse.y*.35,10);camera.lookAt(0,0,0);
  renderer.render(scene,camera);
}

/* ========================================================== UI / NAV */
const deck=$('#deck'), sweep=$('#sweep'), progress=$('#progress'), btnPrev=$('#prev'), btnNext=$('#next');
const notes=$('#notes');
let cur=-1, lastNav=0, runId=0;

slides.forEach((s,i)=>{
  $$('.ln',s).forEach((l,k)=>l.style.setProperty('--d',k));
  $$('.rv',s).forEach((r,k)=>r.style.setProperty('--i',k));
  const b=document.createElement('button');
  b.innerHTML=`<span>${String(i+1).padStart(2,'0')} · ${s.dataset.title}</span>`;
  b.setAttribute('aria-label',`Go to slide ${i+1}: ${s.dataset.title}`);
  b.addEventListener('click',()=>go(i));
  progress.appendChild(b);
});
$('#tot').textContent=String(TOTAL).padStart(2,'0');

const GLYPHS='ATGC';
function scramble(el,dur=950,glyphs=GLYPHS){
  const fin=el.dataset.final??(el.dataset.final=el.textContent);
  cancelAnimationFrame(el._sr);
  if(REDUCED){el.textContent=fin;return}
  const n=fin.length,rev=[...fin].map((_,i)=>(i/n)*dur*.55+Math.random()*dur*.45),t0=performance.now();
  const step=now=>{const tt=now-t0;let out='',done=true;
    for(let i=0;i<n;i++){const ch=fin[i];if(ch===' '||tt>=rev[i])out+=ch;else{done=false;out+=glyphs[Math.random()*glyphs.length|0]}}
    el.textContent=out;if(!done)el._sr=requestAnimationFrame(step)};
  el._sr=requestAnimationFrame(step);
}

function go(i,dir){
  i=clamp(i,0,TOTAL-1);
  if(i===cur) return;
  const now=performance.now();
  if(cur!==-1&&now-lastNav<260) return;
  lastNav=now;
  dir=dir??(i>cur?1:-1);
  deck.style.setProperty('--dir',dir);

  const prev=slides[cur];
  if(prev){prev.classList.remove('is-active');prev.classList.add('is-leaving');clearTimeout(prev._lt);prev._lt=setTimeout(()=>prev.classList.remove('is-leaving'),850)}
  cur=i;
  const el=slides[i],cfg=CFG[i]||CFG[0];
  clearTimeout(el._lt);el.classList.remove('is-leaving');void el.offsetWidth;el.classList.add('is-active');

  // headline decode + glitch
  $$('.ln',el).forEach((ln,k)=>{const s=$('[data-scramble]',ln);if(s)setTimeout(()=>{if(cur===i)scramble(s)},160+k*95)});
  
  // chrome
  document.documentElement.style.setProperty('--accent',cfg.accent);
  document.documentElement.style.setProperty('--gx',cfg.center||small()?'50%':'72%');
  sweep.classList.toggle('back',dir<0);sweep.classList.remove('go');void sweep.offsetWidth;sweep.classList.add('go');
  $('#cur').textContent=String(i+1).padStart(2,'0');
  [...progress.children].forEach((b,k)=>{b.classList.toggle('on',k===i);b.classList.toggle('done',k<i)});
  btnPrev.disabled=i===0;btnNext.disabled=i===TOTAL-1;
  $('#notesBody').innerHTML=$('.notes',el)?.innerHTML||'';
  history.replaceState(null,'',`#${i+1}`);

  // 3D
  if(GL.ok){
    S.cfg=cfg;
    if(!cfg.spinY) S.homeY=Math.round(S.angY/(Math.PI*2))*Math.PI*2;
    if(!cfg.spinX) S.homeX=Math.round(S.angX/(Math.PI*2))*Math.PI*2;
    morphTo(SHAPE_CACHE[cfg.shape]);
  }

  // scene script
  const id=++runId;const alive=()=>id===runId;
  SCENES[el.dataset.scene]?.(el,alive);
}
const next=()=>go(cur+1,1), prev=()=>go(cur-1,-1);
function hit(b){b.classList.add('hit');setTimeout(()=>b.classList.remove('hit'),260)}

btnNext.addEventListener('click',next);btnPrev.addEventListener('click',prev);
addEventListener('keydown',e=>{
  if(e.altKey||e.ctrlKey||e.metaKey) return;
  switch(e.key){
    case 'ArrowRight':case 'PageDown':case ' ':e.preventDefault();hit(btnNext);next();break;
    case 'ArrowLeft':case 'PageUp':e.preventDefault();hit(btnPrev);prev();break;
    case 'Home':go(0,-1);break;
    case 'End':go(TOTAL-1,1);break;
    case 's':case 'S':notes.classList.toggle('open');break;
    case 'f':case 'F':document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen?.();break;
  }
});
let tx0=null,ty0=null;
addEventListener('touchstart',e=>{tx0=e.touches[0].clientX;ty0=e.touches[0].clientY},{passive:true});
addEventListener('touchend',e=>{if(tx0===null)return;const dx=e.changedTouches[0].clientX-tx0,dy=e.changedTouches[0].clientY-ty0;
  if(Math.abs(dx)>60&&Math.abs(dx)>Math.abs(dy)*1.4)(dx<0?next:prev)();tx0=null},{passive:true});
addEventListener('pointermove',e=>{mouse.tx=e.clientX/innerWidth*2-1;mouse.ty=e.clientY/innerHeight*2-1});
addEventListener('resize',()=>{if(!GL.ok)return;renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()});

// presenter clock
const t0=Date.now();
setInterval(()=>{const s=Math.floor((Date.now()-t0)/1000);$('#clock').textContent=`T+${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`},1000);

/* ============================================================ SCENES */
async function type(el,text,alive,speed=22){el.textContent='';for(const ch of text){if(!alive())return;el.textContent+=ch;await sleep(speed)}}
const fmt=s=>`${String(Math.floor(s/60)).padStart(2,'0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function countUp(el,to,dur,alive,pad=0){const t0=performance.now();const f=now=>{if(!alive())return;const p=Math.min(1,(now-t0)/dur),v=Math.round(easeCPU(p)*to);el.textContent=String(v).padStart(pad,'0');if(p<1)requestAnimationFrame(f)};requestAnimationFrame(f)}

// scans tiles (illustrative shift)
const tilesEl=$('#tiles'),ANOM=new Set([17,44,71]);
for(let i=0;i<81;i++){const d=document.createElement('i');d.className='tile'+(ANOM.has(i)?' anom':'');tilesEl.appendChild(d)}

// tilted history cards follow the pointer
$$('[data-tilt]').forEach(c=>{
  c.addEventListener('pointermove',e=>{const r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    c.style.setProperty('--ry',`${x*16}deg`);c.style.setProperty('--rx',`${-y*12}deg`)});
  c.addEventListener('pointerleave',()=>{c.style.removeProperty('--ry');c.style.removeProperty('--rx')});
});

const SCENES={
  async hook(el,alive){
    const bubs=$$('.bub',el);bubs.forEach(b=>{b.classList.remove('show','strike');$('.txt',b).textContent=''});
    const tm=$('#callTimer'),st=performance.now();
    (function tick(){if(!alive())return;tm.textContent=fmt((performance.now()-st)/1000);requestAnimationFrame(tick)})();
    await sleep(1100);
    for(const b of bubs){
      if(!alive())return;b.classList.add('show');
      await type($('.txt',b),b.dataset.text,alive,b.classList.contains('sys')?14:26);
      await sleep(700);if(!alive())return;
      if(b.dataset.strike){b.classList.add('strike');await sleep(650)}
    }
  },
  async geo(el,alive){
    const steps=$$('.step',el),lock=$('#lockBadge');
    steps.forEach(s=>{s.classList.remove('run','ok');$('.st',s).textContent='Standby'});
    lock.className='lock';lock.textContent='Searching';
    const net=$('#roNet'),rng=$('#roRange'),pos=$('#roPos');
    [net,rng,pos].forEach(e=>{cancelAnimationFrame(e._sr);delete e.dataset.final});
    net.textContent='0 / 3 towers linked';rng.textContent='T1 ---m · T2 ---m · T3 ---m';pos.textContent='x ----- · y -----';$('#roUnit').textContent='—';
    await sleep(1300);
    const labels=['Connecting','Processing','Locating','Sending'],done=['Received','Done','Located','Sent'];
    for(let k=0;k<steps.length;k++){
      if(!alive())return;const s=steps[k];s.classList.add('run');$('.st',s).textContent=labels[k];
      // step 2: link to the three cell towers + measure range to each; step 3: position inside that network grid
      if(k===1){(async()=>{for(let t=1;t<=3;t++){await sleep(260);if(!alive())return;net.textContent=`${t} / 3 towers linked`}})();
        rng.dataset.final='T1 412m · T2 286m · T3 537m';scramble(rng,900,'0123456789')}
      if(k===2){pos.dataset.final='x +0.284 · y −0.391 km';scramble(pos,900,'0123456789')}
      await sleep(950);if(!alive())return;
      s.classList.remove('run');s.classList.add('ok');$('.st',s).textContent=done[k];
      if(k===2){lock.className='lock on';lock.textContent='Located'}
      if(k===3){lock.className='lock go';lock.textContent='Sent';$('#roUnit').textContent='Ambulance · en route'}
    }
  },
  async scans(el,alive){
    const tiles=$$('.tile',el),clock=$('#shiftClock'),cnt=$('#shiftCount'),fill_=$('#focusFill');
    tiles.forEach(t=>t.classList.remove('seen','tired'));clock.textContent='00:00';cnt.textContent='00';
    fill_.style.transition='none';fill_.style.width='100%';fill_.style.backgroundPosition='100% 0';
    await sleep(1200);if(!alive())return;
    fill_.style.transition='width 5.6s linear, background-position 5.6s linear';fill_.style.width='28%';fill_.style.backgroundPosition='0 0';
    for(let i=0;i<tiles.length;i++){
      if(!alive())return;tiles[i].classList.add('seen');if(i>45&&Math.random()<.7)tiles[i].classList.add('tired');
      const mins=Math.round((i+1)/tiles.length*480);clock.textContent=`${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;
      cnt.textContent=String(i+1).padStart(2,'0');await sleep(68);
    }
  },
  async copilot(el,alive){const s=$('#pilotSwitch');s.classList.remove('co');await sleep(1500);if(alive())s.classList.add('co')},
  async practice(el,alive){
    const q=$('#queue'),items=['a','b','c'].map(id=>$(`.q[data-id="${id}"]`,q)),st=$('#qStatus'),mri=$('#mri'),ms=$('#mriState');
    items.forEach(it=>{q.appendChild(it);it.classList.remove('scan','clear','flag');it.style.transform='';$('.pill',it).textContent='Queued'});
    mri.classList.remove('found');ms.textContent='Scanning';ms.style.color='';st.textContent='Analysing…';
    const lines=$$('.cl',el),vals=$$('.v',el),btn=$('#approve');
    lines.forEach(l=>{l.classList.remove('show');$('.txt',l).textContent=''});vals.forEach(v=>{v.textContent='';v.classList.remove('fill')});
    btn.className='approve';$('span',btn).textContent='Doctor approves';
    await sleep(1300);
    // 01 diagnostic assistance: highlight suspicious area + prioritise urgent case
    for(const it of items){
      if(!alive())return;it.classList.remove('scan');void it.offsetWidth;it.classList.add('scan');$('.pill',it).textContent='Scanning';
      await sleep(520);if(!alive())return;
      if(it.dataset.urgent){it.classList.add('flag');$('.pill',it).textContent='Urgent';mri.classList.add('found');ms.textContent='Area flagged';ms.style.color='var(--red)'}
      else{it.classList.add('clear');$('.pill',it).textContent='Routine'}
    }
    await sleep(400);if(!alive())return;
    const urgent=items[2],rects=new Map(items.map(it=>[it,it.getBoundingClientRect().top]));
    q.prepend(urgent);
    items.forEach(it=>{const d=rects.get(it)-it.getBoundingClientRect().top;it.style.transition='none';it.style.transform=`translateY(${d}px)`});
    void q.offsetWidth;
    items.forEach(it=>{it.style.transition='transform .8s cubic-bezier(.16,1,.3,1), border-color .4s, background .4s';it.style.transform=''});
    st.innerHTML='Urgent case first · <b>doctor reviews</b>';
    // 02 ambient scribing: conversation -> draft note -> doctor approves
    await sleep(700);
    for(const l of lines){
      if(!alive())return;l.classList.add('show');await type($('.txt',l),l.dataset.text,alive,20);await sleep(250);if(!alive())return;
      if(l.dataset.fill){for(const k of l.dataset.fill.split(',')){const v=$(`.v[data-k="${k}"]`,el);v.textContent=v.dataset.v;v.classList.add('fill');await sleep(280)}}
    }
    if(!alive())return;btn.classList.add('ready');
    await sleep(2000);if(!alive())return;btn.classList.remove('ready');btn.classList.add('done');$('span',btn).textContent='Approved by doctor';
  }
};
$('#approve').addEventListener('click',e=>{const b=e.currentTarget;b.classList.remove('ready');b.classList.add('done');$('span',b).textContent='Approved by doctor'});

/* ============================================================ BOOT */
const SHAPE_CACHE={};
async function boot(){
  initGL();
  const names=[...new Set(CFG.map(c=>c.shape))],bar=$('#ldBar'),pct=$('#ldPct'),seq=$('#ldSeq');
  let alive=true;(function ld(){if(!alive)return;let s='';for(let i=0;i<12;i++)s+='ATGC'[Math.random()*4|0];seq.textContent=s;setTimeout(ld,70)})();
  for(let k=0;k<names.length;k++){
    if(GL.ok){rnd=mulberry32(1000+k);SHAPE_CACHE[names[k]]=SHAPES[names[k]](N)}
    const p=Math.round((k+1)/names.length*100);bar.style.width=p+'%';pct.textContent=p+'%';
    await sleep(40);
  }
  // warm-up: compile every shader + upload every extra's geometry now (behind the loader),
  // otherwise the first visit to slides with 3D extras freezes for ~0.5–1s
  if(GL.ok){
    for(const k in extras) extras[k].obj.visible=true;
    renderer.compile(scene,camera);renderer.render(scene,camera);
    for(const k in extras) extras[k].obj.visible=false;
    await sleep(40);
  }
  requestAnimationFrame(frame);
  await sleep(250);alive=false;seq.textContent='ATGC · READY';
  $('#loader').classList.add('done');
  const start=clamp((parseInt(location.hash.slice(1))||1)-1,0,TOTAL-1);
  S.homeY=0;S.homeX=0;
  go(start,1);
}
boot();
})();
