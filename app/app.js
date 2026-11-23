/* Painel PKS no celular (pedido do Chai, 23/11/2026): Faturamento, Custo das entradas e PCP (ordens de produção da Vaeso).
   Usa o mesmo login e os mesmos dados do site (../supa.js: Supabase, tabela arquivos e coleções em pks.docs).
   Só leitura. As contas seguem as do sistema (plataforma-nf/modulos.js): receita pelos CFOPs de receita, custo de compra
   sem IPI e sem ICMS, com crédito de PIS 1,65% e COFINS 7,6% nas compras e industrializações. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(min,max)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:min,maximumFractionDigits:max});
const F0=fmt(0,0),F2=fmt(2,2);
const brl0=v=>(v<0?'−':'')+'R$ '+F0.format(Math.abs(+v||0));
const brl=v=>(v<0?'−':'')+'R$ '+F2.format(Math.abs(+v||0));
const n0=v=>F0.format(+v||0);
const curto=v=>{v=+v||0;const a=Math.abs(v);return a>=1e6?fmt(0,2).format(v/1e6)+' mi':a>=1e3?F0.format(v/1e3)+' mil':F0.format(v)};
const dt=s=>s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'';
const ddmm=s=>s?s.slice(8,10)+'/'+s.slice(5,7):'';
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const isoDe=s=>{const [a,m,d]=s.split('-').map(Number);return new Date(a,m-1,d)};
const somaDias=(s,n)=>{const d=isoDe(s);d.setDate(d.getDate()+n);return isoD(d)};
const HOJE=isoD(new Date()),ANO=+HOJE.slice(0,4);
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DIAS=['dom','seg','ter','qua','qui','sex','sáb'];
const pl=(n,a,b)=>n0(n)+' '+(n===1?a:b);
const casa=(txt,q)=>!q||String(q).toLowerCase().split(/\s+/).filter(Boolean).every(w=>txt.toLowerCase().includes(w));
const nomeCurto=s=>String(s||'').split(/\s+/).slice(0,3).join(' ');
const doc=c=>{c=String(c||'');return c.length===14?c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):c.length===11?c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'):c};
const linhasDe=j=>j.linhas.map(r=>Object.fromEntries(j.colunas.map((c,i)=>[c,r[i]])));
const RECEITA=new Set(['101','102','103','104','105','106','109','110','111','116','117','118','119','120','122','123','124','125','401','402','403','405','551']);
const ehReceita=c=>RECEITA.has(String(c||'').slice(1));

const ST={aba:null,abas:[],fat:{esc:'mes',sel:null,cli:'todos',lim:20,aberta:null},cnf:{q:'',sub:'todas',rec:true,lim:30,aberto:null},pcp:{aba:'abertas',q:'',aberta:null},
  dados:{},db:null,custos:{},ops:null,sync:null};

/* ---------- tema (o mesmo do site: pks_tema) ---------- */
function aplicaTema(t){document.documentElement.dataset.theme=t;document.querySelector('meta[name=theme-color]')?.setAttribute('content',t==='dark'?'#18191c':'#26282c')}
try{aplicaTema(localStorage.getItem('pks_tema')||'light')}catch{aplicaTema('light')}
$('tema').addEventListener('click',()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';aplicaTema(t);try{localStorage.setItem('pks_tema',t)}catch{}});
$('hoje').textContent=new Date().toLocaleDateString('pt-BR',{weekday:'short',day:'numeric',month:'short'}).replace(/\./g,'');

const carregar=nome=>ST.dados[nome]||(ST.dados[nome]=fetch(nome+'.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}));
const esperando=t=>`<div class="vazio">${t}</div>`;

/* ---------- acesso ---------- */
const TELAS=[['fat','Faturamento','faturamento','<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],['cnf','Custo entradas','custonf','<path d="M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2 2.7 5 3.3 5 1.6 5 3.6-2.2 3.1-5 3.1-5-1.2-5-3.1"/>'],['pcp','PCP','pcpvaeso','<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h6M7 17h8"/>']];
async function inicia(){
  const u=await window.claude.use('user'),db=await window.claude.use('db');ST.db=db;
  const me=await u.me();let abas=[];
  if(me.isOwner)abas=TELAS.map(t=>t[0]);
  else{try{const s=await db.doc('usuarios/'+me.id).get();const reg=s.exists?s.data():null;abas=TELAS.filter(t=>(reg?.abas||[]).includes(t[2])).map(t=>t[0])}catch{}}
  ST.abas=abas;
  if(!abas.length){$('tela').innerHTML=esperando('<b>Seu acesso ainda não foi liberado.</b><br>Peça ao administrador do Sistema PKS para liberar Faturamento, Custo NF entrada ou PCP.');return}
  $('nav').innerHTML=TELAS.filter(t=>abas.includes(t[0])).map(([k,l,,ic])=>`<button type="button" data-aba="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg><span>${l}</span></button>`).join('');
  $('nav').hidden=abas.length<2;
  if(abas.includes('cnf'))db.collection('custos').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());ST.custos=o;if(ST.aba==='cnf')desenha()},()=>{});
  if(abas.includes('pcp')){db.collection('vaeso_ops').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());ST.ops=o;if(ST.aba==='pcp')desenha()},()=>{ST.ops={};if(ST.aba==='pcp')desenha()});
    db.doc('meta/vaeso_sync').onSnapshot(s=>{ST.sync=s.exists?s.data():null;if(ST.aba==='pcp')desenha()},()=>{})}
  const h=location.hash.slice(1);vai(abas.includes(h)?h:abas[0]);
}
function vai(a){ST.aba=a;for(const b of document.querySelectorAll('#nav button'))b.setAttribute('aria-current',b.dataset.aba===a?'page':'false');
  $('titulo').textContent=TELAS.find(t=>t[0]===a)[1];if(location.hash!=='#'+a)history.replaceState(null,'','#'+a);scrollTo(0,0);desenha()}
function desenha(){({fat:telaFat,cnf:telaCnf,pcp:telaPcp})[ST.aba]?.()}

/* ---------- Faturamento ---------- */
const PRINCIPAIS=[['todos','Todos'],['ALLIAGE','Alliage'],['DOCOL','Docol'],['VAESO','Vaeso']];
let FAT=null;
function fatBase(){if(FAT)return FAT;const j=ST.dados.fatJ;
  const L=linhasDe(j).filter(l=>l.status!=='canceled');const g=new Map();
  for(const l of L){const o=g.get(l.chave)||{k:l.chave,data:l.data,nota:l.nota,cli:l.destNome,cnpj:l.destCnpj,natOp:l.natOp,rec:0,total:0,itens:[]};o.total+=+l.total||0;if(ehReceita(l.cfop))o.rec+=+l.total||0;o.itens.push(l);g.set(l.chave,o)}
  FAT={notas:[...g.values()],geradoEm:j.geradoEm||''};return FAT}
function colunas(notas,e){
  const junta=(de,ate)=>{const v=notas.filter(n=>n.rec>0&&n.data>=de&&n.data<=ate);return {v:v.reduce((a,n)=>a+n.rec,0),notas:v.length,cli:new Set(v.map(n=>n.cli)).size}};
  if(e==='dia'){const m=HOJE.slice(0,7),ult=new Date(+m.slice(0,4),+m.slice(5,7),0).getDate();
    return Array.from({length:ult},(_,i)=>{const d=m+'-'+String(i+1).padStart(2,'0');return {id:d,de:d,ate:d,rot:String(i+1),nome:`${DIAS[isoDe(d).getDay()]}, ${dt(d)}`,futuro:d>HOJE,...junta(d,d)}})}
  if(e==='semana'){const seg=somaDias(HOJE,-((isoDe(HOJE).getDay()+6)%7));
    return Array.from({length:12},(_,i)=>{const de=somaDias(seg,-7*(11-i)),ate=somaDias(de,6);return {id:de,de,ate,rot:ddmm(de),nome:`Semana de ${ddmm(de)} a ${dt(ate)}`,...junta(de,ate)}})}
  return Array.from({length:12},(_,i)=>{const m=ANO+'-'+String(i+1).padStart(2,'0'),ate=isoD(new Date(ANO,i+1,0));return {id:m,de:m+'-01',ate,rot:MESES[i].slice(0,3),nome:`${MESES[i]}/${ANO}`,futuro:m>HOJE.slice(0,7),...junta(m+'-01',ate)}});
}
function grafico(C,sel){
  const W=340,H=150,top=18,base=H-20,n=C.length,iOn=C.findIndex(c=>c.id===sel),gap=n>14?2:6,bw=(W-gap*(n-1))/n,max=Math.max(1,...C.map(c=>c.v));
  const bars=C.map((c,i)=>{const x=i*(bw+gap),h=c.futuro?0:Math.max(c.v?3:1,(c.v/max)*(base-top)),y=base-h,on=c.id===sel;
    const rot=n<=14||on||(i%3===0&&Math.abs(i-iOn)>1)?`<text x="${x+bw/2}" y="${H-5}" class="g-rot${on?' on':''}">${esc(c.rot)}</text>`:'';
    const val=n<=14&&c.v&&!c.futuro?`<text x="${x+bw/2}" y="${y-4}" class="g-val">${esc(curto(c.v))}</text>`:'';
    return `<g${c.futuro?'':` class="g-col" data-col="${c.id}" role="button" tabindex="0" aria-label="${esc(c.nome)}: ${esc(brl(c.v))}"`}>${c.futuro?'':`<rect x="${x}" y="${top-14}" width="${bw}" height="${base-top+14}" fill="transparent"/>`}<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="${n>14?1.5:4}" class="g-bar${on?' on':''}${c.futuro?' fut':''}"/>${val}${rot}</g>`}).join('');
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Faturamento por coluna"><line x1="0" x2="${W}" y1="${base}" y2="${base}" class="g-eixo"/>${bars}</svg>`;
}
async function telaFat(){
  const box=$('tela');
  if(!ST.dados.fatJ){box.innerHTML=esperando('Carregando o faturamento…');try{ST.dados.fatJ=await carregar('faturamento')}catch{box.innerHTML=esperando('Não foi possível carregar o faturamento.');return}if(ST.aba!=='fat')return}
  const B=fatBase(),f=ST.fat;
  const notas=f.cli==='todos'?B.notas:B.notas.filter(n=>String(n.cli).toUpperCase().includes(f.cli));
  const mes=HOJE.slice(0,7),mesAnt=isoD(new Date(ANO,+mes.slice(5)-2,1)).slice(0,7);
  const soma=fn=>notas.filter(fn).reduce((a,n)=>a+n.rec,0);
  const fM=soma(n=>n.data.startsWith(mes)),fA=soma(n=>n.data.startsWith(mesAnt)),fY=soma(n=>n.data.startsWith(String(ANO)));
  const nM=notas.filter(n=>n.rec>0&&n.data.startsWith(mes));
  const C=colunas(notas,f.esc);const vivas=C.filter(c=>!c.futuro);
  if(!C.some(c=>c.id===f.sel&&!c.futuro))f.sel=([...vivas].reverse().find(c=>c.v>0)||vivas[vivas.length-1]||{}).id;
  const s=C.find(c=>c.id===f.sel)||{de:HOJE,ate:HOJE,nome:'',v:0,notas:0,cli:0};
  const lista=notas.filter(n=>n.data>=s.de&&n.data<=s.ate).sort((a,b)=>b.data.localeCompare(a.data)||String(b.nota).localeCompare(String(a.nota)));
  let h=`<div class="chips" role="group" aria-label="Cliente">${PRINCIPAIS.map(([k,l])=>`<button type="button" data-fcli="${k}" aria-pressed="${f.cli===k}">${l}</button>`).join('')}</div>
  <section class="heroi"><span>Faturamento em ${MESES[+mes.slice(5)-1].toLowerCase()}</span><b>${brl0(fM)}</b><small>${pl(nM.length,'nota','notas')} · ${pl(new Set(nM.map(n=>n.cli)).size,'cliente','clientes')} · mês anterior ${brl0(fA)}</small></section>
  <div class="kpis"><div class="kpi"><span>No ano</span><b>${brl0(fY)}</b></div><div class="kpi"><span>Média por mês (jan a ${MESES[+mes.slice(5)-1].slice(0,3).toLowerCase()})</span><b>${brl0(fY/Math.max(1,+mes.slice(5)))}</b></div></div>
  <section class="cartao"><div class="cab"><h2>${{mes:'Por mês · '+ANO,semana:'Por semana',dia:'Por dia · '+MESES[+mes.slice(5)-1]}[f.esc]}</h2><div class="seg" role="group" aria-label="Agrupar por">${[['mes','Mês'],['semana','Semana'],['dia','Dia']].map(([k,l])=>`<button type="button" data-fesc="${k}" aria-pressed="${f.esc===k}">${l}</button>`).join('')}</div></div>
  ${grafico(C,f.sel)}<p class="sel"><b>${esc(s.nome)}</b> ${brl(s.v)} · ${pl(s.notas,'nota','notas')} · ${pl(s.cli,'cliente','clientes')}</p></section>
  <section class="cartao"><div class="cab"><h2>Notas · ${esc(s.nome)}</h2><span class="mudo">${n0(lista.length)}</span></div><ul class="lista">`;
  for(const n of lista.slice(0,f.lim)){const ab=f.aberta===n.k;
    h+=`<li class="${ab?'aberta':''}"><button type="button" class="linha" data-fnota="${esc(n.k)}" aria-expanded="${ab}"><span class="l1"><b>${esc(nomeCurto(n.cli))}</b><b class="num">${brl(n.total)}</b></span><span class="l2">NF ${esc(String(+n.nota||n.nota))} · ${dt(n.data)}${n.rec>0?'':' · <i class="tag">'+esc(n.natOp||'sem receita')+'</i>'}</span></button>`;
    if(ab)h+=`<div class="det"><p class="mudo">${esc(n.cli)}${n.cnpj?' · '+esc(doc(n.cnpj)):''}</p>${n.itens.map(i=>`<div class="item"><span><b>${esc(i.desc)}</b><small>${esc(i.cod)} · ${F0.format(+i.q||0)} ${esc(i.un||'')} × ${brl(i.unit)} · CFOP ${esc(i.cfop)}</small></span><b class="num">${brl(i.total)}</b></div>`).join('')}<div class="item tot"><span>Total da nota</span><b class="num">${brl(n.total)}</b></div></div>`;
    h+='</li>'}
  h+='</ul>';
  if(!lista.length)h+=esperando('Nenhuma nota nesse período.');
  if(lista.length>f.lim)h+=`<button type="button" class="mais" data-fmais>Ver mais ${Math.min(20,lista.length-f.lim)}</button>`;
  h+=`</section><p class="rodape">Fonte: Qive, notas emitidas. Atualizado em ${dt(B.geradoEm.slice(0,10))}.</p>`;
  box.innerHTML=h;
}

/* ---------- Custo das entradas ---------- */
const CRED_PC=new Set(['101','102','124','125','401','403']);
const cfopEntrada=c=>{c=String(c||'');return /^[567]\d{3}$/.test(c)?String(+c[0]-4)+c.slice(1):c};
const SUBS=['Polímero','Master','Componentes','Injetados'];
let CNF=null;
function cnfBase(){if(CNF)return CNF;const j=ST.dados.entJ,C=j.colunas,ix=n=>C.indexOf(n);
  const I={p:ix('Produto'),d:ix('Desc.Produto'),u:ix('Unidade'),q:ix('Quantidade'),t:ix('Vlr.Total'),icms:ix('Vlr.ICMS'),cf:ix('Cod. Fiscal'),f:ix('Nome Fornecedor'),fc:ix('Forn/Cliente'),e:ix('DT Emissao'),g:ix('DT Digitacao'),doc:ix('Documento'),ds:ix('Desconto'),fr:ix('Vlr. Frete'),dp:ix('Vlr. Despesa')};
  const g=new Map();
  for(const r of j.linhas){const q=+r[I.q]||0,t=+r[I.t]||0;if(!q||!t)continue;
    const qive=r[0]==='Qive',cf=qive?cfopEntrada(r[I.cf]):String(r[I.cf]||''),v=x=>x>=0?+r[x]||0:0;
    const base=t-v(I.ds)+v(I.fr)+v(I.dp)-(+r[I.icms]||0),cred=CRED_PC.has(cf.slice(1))?base*(0.0165+0.076):0;
    const forn=String(r[I.f]||r[I.fc]||''),cod=String(r[I.p]??'').trim(),key=qive?'q:'+(r[I.fc]||forn)+'|'+cod:'p:'+cod;
    const it={q,preco:t/q,custo:(base-cred)/q,forn,data:String(r[I.e]||r[I.g]||'').slice(0,10),doc:String(r[I.doc]||'')};
    const o=g.get(key)||{key,cod,desc:String(r[I.d]||cod),un:String(r[I.u]||'').toLowerCase()||'un',L:[]};o.L.push(it);g.set(key,o)}
  CNF=[...g.values()].map(o=>{o.L.sort((a,b)=>b.data.localeCompare(a.data));const u=o.L.slice(0,5),ult=u[0],med=u.reduce((a,x)=>a+x.custo*x.q,0)/u.reduce((a,x)=>a+x.q,0);
    return {...o,u,ult,med,var:med?(ult.custo-med)/med:0,data:ult.data}}).sort((a,b)=>b.data.localeCompare(a.data));
  return CNF}
function spark(v){if(v.length<2)return '';const mn=Math.min(...v),mx=Math.max(...v),w=60,h=22,x=i=>3+i*(w-6)/(v.length-1),y=a=>mx===mn?h/2:3+(1-(a-mn)/(mx-mn))*(h-6);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${v.map((a,i)=>x(i)+','+y(a)).join(' ')}"/><circle cx="${x(v.length-1)}" cy="${y(v[v.length-1])}" r="2.4"/></svg>`}
async function telaCnf(){
  const box=$('tela');
  if(!ST.dados.entJ){box.innerHTML=esperando('Carregando as compras…');try{ST.dados.entJ=await carregar('entradas')}catch{box.innerHTML=esperando('Não foi possível carregar as compras.');return}if(ST.aba!=='cnf')return}
  const c=ST.cnf,lim90=somaDias(HOJE,-90);
  const subDe=r=>r.key.startsWith('p:')?String((ST.custos[r.cod]||{}).sub||''):'';
  const R=cnfBase().filter(r=>(!c.rec||r.data>=lim90)&&(c.sub==='todas'||subDe(r)===c.sub)&&casa(`${r.cod} ${r.desc} ${r.L.map(x=>x.forn).join(' ')}`,c.q));
  const sobe=R.filter(r=>r.var>0.0005).length,cai=R.filter(r=>r.var<-0.0005).length;
  let h=`<label class="busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg><input type="search" id="cnfQ" placeholder="Material ou fornecedor" value="${esc(c.q)}" aria-label="Buscar material ou fornecedor"></label>
  <div class="chips" role="group" aria-label="Subclassificação">${[['todas','Todas'],...SUBS.map(s=>[s,s])].map(([k,l])=>`<button type="button" data-csub="${esc(k)}" aria-pressed="${c.sub===k}">${esc(l)}</button>`).join('')}</div>
  <div class="cab-lista"><div class="seg" role="group" aria-label="Período">${[[1,'Últimos 90 dias'],[0,'Todos']].map(([k,l])=>`<button type="button" data-crec="${k}" aria-pressed="${+c.rec===k}">${l}</button>`).join('')}</div><span class="mudo">${pl(R.length,'material','materiais')} · <span class="t-sobe">${n0(sobe)} subiram</span> · <span class="t-cai">${n0(cai)} caíram</span></span></div>
  <ul class="lista cartoes">`;
  for(const r of R.slice(0,c.lim)){const ab=c.aberto===r.key,u=r.ult,v=r.var,vt=Math.abs(v)<0.0005?'=':(v>0?'+':'−')+fmt(1,1).format(Math.abs(v*100))+'%';
    h+=`<li class="${ab?'aberta':''}"><button type="button" class="linha" data-cnf="${esc(r.key)}" aria-expanded="${ab}"><span class="l1"><b class="corta">${esc(r.desc)}</b><span class="var ${vt==='='?'':v>0?'sobe':'cai'}">${vt}</span></span>
      <span class="l3"><span><small>Última compra</small><b>${brl(u.custo)}<i>/${esc(r.un)}</i></b></span><span><small>Média 5 NF</small><b>${brl(r.med)}<i>/${esc(r.un)}</i></b></span>${spark(r.u.map(x=>x.custo).reverse())}</span>
      <span class="l2">${esc(nomeCurto(u.forn))} · ${dt(u.data)}${subDe(r)?' · '+esc(subDe(r)):''}</span></button>`;
    if(ab)h+=`<div class="det">${r.u.map((x,i)=>`<div class="item${i?'':' destaque'}"><span><b>${dt(x.data)} · NF ${esc(String(+x.doc||x.doc))}</b><small>${esc(nomeCurto(x.forn))} · ${fmt(0,2).format(x.q)} ${esc(r.un)} · preço NF ${brl(x.preco)}</small></span><b class="num">${brl(x.custo)}</b></div>`).join('')}<div class="item tot"><span>Custo médio</span><b class="num">${brl(r.med)}</b></div><p class="mudo">Custo = preço sem IPI e sem ICMS${'; nas compras e industrializações, sem PIS 1,65% e COFINS 7,6%'}.</p></div>`;
    h+='</li>'}
  h+='</ul>';
  if(!R.length)h+=esperando(c.rec?'Nenhuma compra nos últimos 90 dias com esse filtro.':'Nenhum material com esse filtro.');
  if(R.length>c.lim)h+=`<button type="button" class="mais" data-cmais>Ver mais ${Math.min(30,R.length-c.lim)}</button>`;
  box.innerHTML=h;
}

/* ---------- PCP: ordens de produção da Vaeso ---------- */
const vxNumero=o=>/^\d+$/.test(String(o.numero||''))?'OC '+o.numero:String(o.numero||'OC '+o.id);
function telaPcp(){
  const box=$('tela');if(!ST.ops){box.innerHTML=esperando('Carregando as ordens de produção…');return}
  const p=ST.pcp;
  const O=Object.values(ST.ops).map(o=>{const itens=(o.itens||[]).map(it=>({sku:it.sku||'',desc:it.descricao||'',op:it.op_pks||'',qtd:+it.qtd||0,ent:+it.entregue||0,prod:it.produzido||null}));
    const ped=itens.reduce((a,r)=>a+r.qtd,0),feito=itens.reduce((a,r)=>a+(r.prod?+r.prod.qtd||0:0),0);
    return {id:String(o.id),numero:vxNumero(o),emitida:o.emitida_em||'',prevista:o.prevista_em||'',status:o.status,obs:o.obs||'',itens,ped,feito,pct:ped?Math.min(100,feito/ped*100):0}})
    .sort((a,b)=>(a.prevista||a.emitida).localeCompare(b.prevista||b.emitida));
  const ab=O.filter(o=>o.status==='aberta'),fin=O.filter(o=>o.status!=='aberta').reverse(),itAb=ab.flatMap(o=>o.itens);
  const lista=(p.aba==='abertas'?ab:fin).filter(o=>casa(`${o.numero} ${o.obs} ${o.itens.map(r=>r.sku+' '+r.desc+' '+r.op).join(' ')}`,p.q));
  const atras=ab.filter(o=>o.prevista&&o.prevista<HOJE).length;
  const quando=ST.sync?.em?new Date(ST.sync.em).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'–';
  let h=`<section class="heroi"><span>Ordens em aberto</span><b>${n0(ab.length)}</b><small>${pl(itAb.length,'item','itens')} · ${n0(itAb.reduce((a,r)=>a+r.qtd,0))} peças pedidas${atras?` · <em>${pl(atras,'atrasada','atrasadas')}</em>`:''}</small></section>
  <div class="kpis"><div class="kpi"><span>Sem produzido</span><b>${n0(itAb.filter(r=>!r.prod).length)}</b></div><div class="kpi"><span>Peças produzidas</span><b>${n0(ab.reduce((a,o)=>a+o.feito,0))}</b></div></div>
  <div class="seg largo" role="group" aria-label="Situação">${[['abertas','Em aberto',ab.length],['finalizadas','Finalizadas',fin.length]].map(([k,l,n])=>`<button type="button" data-paba="${k}" aria-pressed="${p.aba===k}">${l} ${n0(n)}</button>`).join('')}</div>
  <label class="busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg><input type="search" id="pcpQ" placeholder="OC, OP, SKU ou produto" value="${esc(p.q)}" aria-label="Buscar ordem"></label><ul class="lista cartoes">`;
  const st=o=>o.status==='aberta'?(o.prevista&&o.prevista<HOJE?'<span class="pill atraso">Atrasada</span>':o.feito>0?'<span class="pill parcial">Parcial</span>':'<span class="pill aberta">Em aberto</span>'):o.status==='cancelada'?'<span class="pill atraso">Cancelada</span>':'<span class="pill ok">Concluída</span>';
  for(const o of lista){const aberta=p.aberta===o.id;
    h+=`<li class="${aberta?'aberta':''}"><button type="button" class="linha" data-pord="${esc(o.id)}" aria-expanded="${aberta}"><span class="l1"><b>${esc(o.numero)}</b>${st(o)}</span>
      <span class="l2">Emissão ${dt(o.emitida)}${o.prevista?' · prevista '+dt(o.prevista):''} · ${pl(o.itens.length,'item','itens')}</span>
      <span class="prog"><span class="barra"><i style="width:${o.pct}%"></i></span><small><b>${n0(o.feito)}</b> de ${n0(o.ped)} pç</small></span></button>`;
    if(aberta)h+=`<div class="det">${o.obs?`<p class="mudo">${esc(o.obs)}</p>`:''}${o.itens.map(r=>{const d=r.prod?(+r.prod.qtd||0)-r.qtd:null;
      return `<div class="item"><span><b>${esc(r.desc||r.sku)}</b><small>${esc(r.sku)}${r.op?' · OP '+esc(r.op):''} · pedido ${n0(r.qtd)} · entregue ${n0(r.ent)}</small></span><span class="num">${r.prod?`<b>${n0(r.prod.qtd)}</b><small class="${Math.abs(d)<1?'t-ok':d<0?'t-sobe':'t-cai'}">${Math.abs(d)<1?'igual':d<0?'−'+n0(-d):'+'+n0(d)}</small>`:'<small class="mudo">sem produzido</small>'}</span></div>`}).join('')}</div>`;
    h+='</li>'}
  h+='</ul>';
  if(!lista.length)h+=esperando(O.length?'Nenhuma ordem com esse filtro.':'Nenhuma ordem recebida da Vaeso ainda.');
  h+=`<p class="rodape">Ordens do Gestão Vaeso, buscadas a cada 10 minutos. Última busca: ${esc(quando)}.${ST.sync?.erro?' Erro: '+esc(ST.sync.erro):''} O produzido é confirmado no site do Sistema PKS.</p>`;
  box.innerHTML=h;
}

/* ---------- eventos ---------- */
document.addEventListener('click',e=>{const t=e.target;
  const nb=t.closest('#nav button');if(nb){vai(nb.dataset.aba);return}
  const g=t.closest('[data-col]');if(g){ST.fat.sel=g.dataset.col;ST.fat.lim=20;ST.fat.aberta=null;desenha();return}
  const a=t.closest('[data-fesc]');if(a){ST.fat.esc=a.dataset.fesc;ST.fat.sel=null;ST.fat.aberta=null;desenha();return}
  const cl=t.closest('[data-fcli]');if(cl){ST.fat.cli=cl.dataset.fcli;ST.fat.aberta=null;desenha();return}
  const fn=t.closest('[data-fnota]');if(fn){ST.fat.aberta=ST.fat.aberta===fn.dataset.fnota?null:fn.dataset.fnota;desenha();return}
  if(t.closest('[data-fmais]')){ST.fat.lim+=20;desenha();return}
  const cs=t.closest('[data-csub]');if(cs){ST.cnf.sub=cs.dataset.csub;ST.cnf.lim=30;desenha();return}
  const cr=t.closest('[data-crec]');if(cr){ST.cnf.rec=cr.dataset.crec==='1';ST.cnf.lim=30;desenha();return}
  const cn=t.closest('[data-cnf]');if(cn){ST.cnf.aberto=ST.cnf.aberto===cn.dataset.cnf?null:cn.dataset.cnf;desenha();return}
  if(t.closest('[data-cmais]')){ST.cnf.lim+=30;desenha();return}
  const pa=t.closest('[data-paba]');if(pa){ST.pcp.aba=pa.dataset.paba;ST.pcp.aberta=null;desenha();return}
  const po=t.closest('[data-pord]');if(po){ST.pcp.aberta=ST.pcp.aberta===po.dataset.pord?null:po.dataset.pord;desenha();return}
});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-col]')){e.preventDefault();e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}))}});
let tBusca;
document.addEventListener('input',e=>{const id=e.target.id;if(id!=='cnfQ'&&id!=='pcpQ')return;
  if(id==='cnfQ'){ST.cnf.q=e.target.value;ST.cnf.lim=30}else ST.pcp.q=e.target.value;
  clearTimeout(tBusca);tBusca=setTimeout(()=>{const pos=e.target.selectionStart;desenha();const n=$(id);if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch{}}},200)});
/* Voltar ao app relê as ordens (o faturamento e as compras mudam uma vez por dia). */
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ST.aba)desenha()});

if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(()=>{}));
inicia().catch(()=>{$('tela').innerHTML=esperando('Não foi possível abrir o painel. Verifique a internet e tente de novo.')});
})();
