// Shortcuts for the page controls and the 2D drawing surface.
const $=id=>document.getElementById(id);
const C=$('c'),X=C.getContext('2d');
const watermark=new Image();
watermark.onload=render;
watermark.onerror=()=>console.error('Could not load watermark image: CDEV-2.png');
watermark.src='CDEV-2.png';

// Shared colors and the options shown in both background color palettes.
const F='"VT323",monospace',INK='#1b1b2f',BLUE='#4D6BCC',MINT='#ECFAE4',PINK='#FDBCC6',LAV='#9CA3EF';
const COLORS=['#87C0EF','#9CA3EF','#FDBCC6','#ECFAE4'];
let bg=COLORS[0],inner=MINT,img=null,dirty=false;

// Initial copy for each template; changing templates replaces inputs only until
// the user starts editing, so their custom text is not overwritten.
const SAMPLES={
  anuncio:{ttl:'Seu cardápio online em poucos dias',txt:'Páginas de pedidos para cafeterias, padarias e confeitarias.',cta:'Peça um orçamento',win:'Novidade.exe'},
  dica:{ttl:'Dica do dia',txt:'Deixe o cardápio fácil de achar: cliente que não encontra o preço vai embora. Coloque o link na bio e no Google Maps.',cta:'Mais dicas no perfil',win:'Dica.txt'},
  depoimento:{ttl:'Nome do cliente, Nome do negócio',txt:'Escreva aqui o depoimento real do cliente.',cta:'Cliente satisfeito',win:'Depoimento.doc'},
  portfolio:{ttl:'Nome do projeto',txt:'Descreva em uma frase o que você entregou.',cta:'Ver projeto',win:'Portfolio.exe'}
};
function fill(){const s=SAMPLES[$('tpl').value];for(const k in s)$(k).value=s[k]}

// Draw a raised or inset Windows-style box using layered rectangles.
function box(x,y,w,h,face,up,t){
  const hi=up?'#ffffff':'#5a6592',lo=up?INK:'#ffffff',m1=up?'#c8d9d0':INK,m2=up?'#8a93b8':'#c8d9d0';
  X.fillStyle=face;X.fillRect(x,y,w,h);
  X.fillStyle=hi;X.fillRect(x,y,w,t);X.fillRect(x,y,t,h);
  X.fillStyle=lo;X.fillRect(x,y+h-t,w,t);X.fillRect(x+w-t,y,t,h);
  X.fillStyle=m1;X.fillRect(x+t,y+t,w-2*t,t);X.fillRect(x+t,y+t,t,h-2*t);
  X.fillStyle=m2;X.fillRect(x+t,y+h-2*t,w-2*t,t);X.fillRect(x+w-2*t,y+t,t,h-2*t);
}

// Break text into lines that fit within a pixel width, keeping explicit newlines.
function wrap(t,mw){const o=[];t.split('\n').forEach(p=>{let l='';p.split(' ').forEach(w=>{const n=l?l+' '+w:w;if(X.measureText(n).width>mw&&l){o.push(l);l=w}else l=n});o.push(l)});return o}

// Try decreasing font sizes until the wrapped text fits the available height.
function fit(t,mw,mh,a,b,lh){let sz=Math.round(a),L;for(;sz>=b;sz-=2){X.font=sz+'px '+F;L=wrap(t,mw);if(L.length*sz*lh<=mh)break}sz=Math.max(sz,Math.round(b));X.font=sz+'px '+F;L=wrap(t,mw);return{L,sz}}

// Draw a multiline text block, centered vertically and aligned left or center.
function block(t,x,y,w,h,a,b,al,col){
  const lh=1.05,f=fit(t,w,h,a,b,lh),bh=f.L.length*f.sz*lh,oy=Math.max(0,(h-bh)/2);
  X.font=f.sz+'px '+F;X.textAlign=al;X.textBaseline='top';X.fillStyle=col;
  f.L.forEach((l,i)=>X.fillText(l,al==='center'?x+w/2:x,y+oy+i*f.sz*lh));
}

// Draw one unwrapped line of text at the requested position and style.
function txt(t,x,y,sz,al,col){X.font=sz+'px '+F;X.textAlign=al;X.textBaseline='top';X.fillStyle=col;X.fillText(t,x,y)}

// Make a centered call-to-action button sized to its label.
function button(t,cx,y,h,s){
  X.font=56*s+'px '+F;const bw=X.measureText(t).width+90*s;
  box(cx-bw/2,y,bw,h,PINK,true,4*s);
  X.textAlign='center';X.textBaseline='middle';X.fillStyle=INK;X.fillText(t,cx,y+h/2+3*s);
}

// Draw the main faux application window and return its inner content rectangle.
function win(x,y,w,h,title,s){
  box(x,y,w,h,inner,true,4*s);
  const p=10*s,tb=64*s;
  X.fillStyle=BLUE;X.fillRect(x+p,y+p,w-2*p,tb);
  X.font=46*s+'px '+F;X.textAlign='left';X.textBaseline='middle';X.fillStyle='#fff';X.fillText(title,x+p+16*s,y+p+tb/2+3*s);
  const bs=46*s;
  ['_','□','×'].forEach((g,i)=>{
    const bx=x+w-p-6*s-(3-i)*(bs+4*s)+4*s,by=y+p+(tb-bs)/2;
    box(bx,by,bs,bs,inner,true,3*s);
    X.font=40*s+'px '+F;X.textAlign='center';X.fillStyle=INK;X.fillText(g,bx+bs/2,by+bs/2+3*s);
  });
  return{x:x+p,y:y+p+tb+p,w:w-2*p,h:h-tb-3*p};
}

// Scale an uploaded image to cover a box, cropping excess from the center.
function cover(im,x,y,w,h){const r=Math.max(w/im.width,h/im.height),sw=w/r,sh=h/r;X.drawImage(im,(im.width-sw)/2,(im.height-sh)/2,sw,sh,x,y,w,h)}

// Redraw the complete post. All layout measurements scale from a 1080px width,
// allowing one set of template layouts to work for square, feed, and story sizes.
function render(){
  const[W,H]=$('fmt').value.split('x').map(Number),s=W/1080,tpl=$('tpl').value;
  C.width=W;C.height=H;
  // Paint the chosen background and a subtle repeating pixel pattern.
  X.fillStyle=bg;X.fillRect(0,0,W,H);
  X.fillStyle='rgba(255,255,255,.4)';
  for(let i=0;i<W;i+=36*s)for(let j=0;j<H;j+=36*s)X.fillRect(i,j,4*s,4*s);
  const m=64*s,tbH=84*s,avail=H-tbH-2*m,wh=Math.min(avail,1180*s),wy=m+(avail-wh)/2;
  const r=win(m,wy,W-2*m,wh,$('win').value,s);
  const pd=44*s,x=r.x+pd,w=r.w-2*pd,T=$('ttl').value,B=$('txt').value,A=$('cta').value;
  // Each branch lays out the same user fields differently for a template.
  if(tpl==='anuncio'){
    const bh=100*s,by=r.y+r.h-pd-bh,ah=by-r.y-pd;
    block(T,x,r.y+pd,w,ah*.55,150*s,60*s,'center',INK);
    block(B,x,r.y+pd+ah*.55,w,ah*.45-20*s,64*s,34*s,'center','#2b3a73');
    button(A,r.x+r.w/2,by,bh,s);
  }else if(tpl==='dica'){
    const ic=130*s;
    box(x,r.y+pd,ic,ic,PINK,true,4*s);
    txt('!',x+ic/2,r.y+pd+ic*.12,110*s,'center',INK);
    block(T,x+ic+30*s,r.y+pd,w-ic-30*s,ic,96*s,48*s,'left',INK);
    const ty=r.y+pd+ic+36*s;
    block(B,x,ty,w,r.y+r.h-pd-70*s-ty,66*s,34*s,'left',INK);
    txt('> '+A,x,r.y+r.h-pd-46*s,50*s,'left',BLUE);
  }else if(tpl==='depoimento'){
    txt('"',x,r.y+pd-40*s,260*s,'left',BLUE);
    const ty=r.y+pd+130*s;
    block(B,x,ty,w,r.y+r.h-pd-160*s-ty,76*s,36*s,'left',INK);
    txt('— '+T,x,r.y+r.h-pd-110*s,52*s,'left',BLUE);
    txt(A,x,r.y+r.h-pd-48*s,42*s,'left','#2b3a73');
  }else{
    const iy=r.y+pd,ih=r.h*.52;
    box(x,iy,w,ih,'#fff',false,4*s);
    const b=8*s;
    if(img)cover(img,x+b,iy+b,w-2*b,ih-2*b);
    else{X.fillStyle=LAV;X.fillRect(x+b,iy+b,w-2*b,ih-2*b);txt('[ imagem ]',x+w/2,iy+ih/2-30*s,60*s,'center',INK)}
    const ty=iy+ih+24*s;
    block(T,x,ty,w,96*s,80*s,44*s,'left',INK);
    const by=ty+100*s;
    block(B,x,by,w,r.y+r.h-pd-60*s-by,54*s,30*s,'left','#2b3a73');
    txt('> '+A,x,r.y+r.h-pd-46*s,46*s,'left',BLUE);
  }
  // taskbar
  // The bottom taskbar and footer are shared by every post design.
  box(0,H-tbH,W,tbH,MINT,true,3*s);
  const startLabel='Iniciar',logoSize=tbH-24*s;
  X.font=44*s+'px '+F;
  const sb=Math.max(230*s,12*s+logoSize+10*s+X.measureText(startLabel).width+24*s);
  box(14*s,H-tbH+12*s,sb,tbH-24*s,MINT,true,3*s);
  // Replace the original Start icon and label with the provided solid logo.
  if(watermark.complete&&watermark.naturalWidth){
    const logoX=14*s+12*s,logoY=H-tbH+12*s;
    X.drawImage(watermark,logoX,logoY,logoSize,logoSize);
    txt(startLabel,logoX+logoSize+10*s,H-tbH+24*s,44*s,'left',INK);
  }
  const f=$('foot').value;
  const fw=Math.min(X.measureText(f).width+50*s,W-sb-60*s);
  box(W-fw-14*s,H-tbH+12*s,fw,tbH-24*s,MINT,false,3*s);
  txt(f,W-14*s-fw/2,H-tbH+24*s,44*s,'center',INK);
}

// Build a palette, keep its selected button highlighted, and redraw on selection.
function addSwatches(id,initial,onChange){
  const sw=$(id);
  COLORS.forEach((c,i)=>{
    const b=document.createElement('button');
    b.style.background=c;b.title=c;b.setAttribute('aria-label',c);
    if(c===initial)b.className='on';
    b.onclick=()=>{
      onChange(c);
      [...sw.children].forEach(x=>x.classList.remove('on'));
      b.classList.add('on');render();
    };
    sw.appendChild(b);
  });
}
addSwatches('sw',bg,c=>{bg=c});
addSwatches('inner-sw',inner,c=>{inner=c});

// Text, footer, format, and template controls update the preview immediately.
['ttl','txt','cta','win'].forEach(id=>$(id).addEventListener('input',()=>{dirty=true;render()}));
['foot','fmt'].forEach(id=>$(id).addEventListener('input',render));
$('tpl').addEventListener('change',()=>{if(!dirty)fill();render()});

// Load a local image into memory and redraw when the browser has decoded it.
$('file').addEventListener('change',e=>{
  const f=e.target.files[0];if(!f)return;
  const im=new Image();im.onload=()=>{img=im;render()};im.src=URL.createObjectURL(f);
});

// Export the canvas as PNG. Use the host download service when available,
// otherwise trigger a standard browser download.
$('dl').onclick=()=>{
  C.toBlob(async b=>{
    const name='post-'+$('tpl').value+'-'+Date.now()+'.png',msg=$('msg');
    try{
      const d=window.claude&&await window.claude.use('downloads');
      if(d){await d.save({filename:name,data:b});msg.textContent='Arquivo enviado para download.';return}
    }catch(e){if(e&&e.code==='declined'){msg.textContent='Download cancelado.';return}}
    const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();
    msg.textContent='Baixando '+name;
  },'image/png');
};

// Populate the initial form and preview; redraw again after the web font loads.
fill();render();
if(document.fonts){document.fonts.load('48px VT323').then(render).catch(()=>{});document.fonts.ready.then(render)}