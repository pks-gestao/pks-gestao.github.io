/* Painel PKS no celular (pedido do Chai, 23/11/2026), no formato do Painel Vaeso: tela inicial em blocos e, em cada assunto,
   o número do mês em destaque, gráfico Dia/Semana/Mês, cartões de projeção e comparação e os detalhes principais.
   Usa o mesmo login e os mesmos dados do site (../supa.js). O PCP aponta produção pela mesma função do site (pks-vaeso); o resto é só leitura. As contas seguem as do sistema (plataforma-nf/modulos.js):
   - faturamento = itens com CFOP de receita; devoluções = entradas com CFOP x201, x202, x410, x411 (valor + IPI);
   - custo de compra = valor sem IPI, menos desconto, mais frete e despesas, menos ICMS; nas compras e industrializações
     (x101, x102, x124, x125, x401, x403) menos PIS 1,65% e COFINS 7,6%;
   - projeção do mês = faturado ÷ dias úteis já passados × dias úteis do mês (segunda a sexta). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=(a,b)=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:a,maximumFractionDigits:b});
const F0=nf(0,0),F2=nf(2,2),F1=nf(1,1);
const brl0=v=>(v<0?'−':'')+'R$ '+F0.format(Math.abs(+v||0));
const brl=v=>(v<0?'−':'')+'R$ '+F2.format(Math.abs(+v||0));
const n0=v=>F0.format(+v||0);
const curto=v=>{v=+v||0;const a=Math.abs(v);return a>=1e6?nf(0,2).format(v/1e6)+' mi':a>=1e3?F0.format(v/1e3)+' mil':F0.format(v)};
const pct=v=>isFinite(v)?(v>0?'+':v<0?'−':'')+F1.format(Math.abs(v*100))+'%':'–';
const dt=s=>s?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(0,4):'';
const ddmm=s=>s?s.slice(8,10)+'/'+s.slice(5,7):'';
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const isoDe=s=>{const [a,m,d]=s.split('-').map(Number);return new Date(a,m-1,d)};
const somaDias=(s,n)=>{const d=isoDe(s);d.setDate(d.getDate()+n);return isoD(d)};
const fimMes=m=>isoD(new Date(+m.slice(0,4),+m.slice(5,7),0));
const mesMais=(m,n)=>isoD(new Date(+m.slice(0,4),+m.slice(5,7)-1+n,1)).slice(0,7);
const HOJE=isoD(new Date());
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const mesNome=m=>MESES[+m.slice(5,7)-1]+' '+m.slice(0,4);
const DIAS=['dom','seg','ter','qua','qui','sex','sáb'];
const pl=(n,a,b)=>n0(n)+' '+(n===1?a:b);
const nomeCurto=s=>String(s||'').replace(/\b(LTDA|S\/A|S\.A\.|EIRELI|ME|EPP)\b\.?/gi,'').trim().split(/\s+/).slice(0,3).join(' ');
const quandoTxt=v=>new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',',' às');
const linhasDe=j=>j.linhas.map(r=>Object.fromEntries(j.colunas.map((c,i)=>[c,r[i]])));
const RECEITA=new Set(['101','102','103','104','105','106','109','110','111','116','117','118','119','120','122','123','124','125','401','402','403','405','551']);
const DEVOL=new Set(['201','202','410','411']);
const diasUteis=(de,ate)=>{let n=0;for(let d=de;d<=ate;d=somaDias(d,1)){const w=isoDe(d).getDay();if(w&&w<6)n++}return n};

const ST={tela:'inicio',mes:HOJE.slice(0,7),fat:{esc:'mes',dev:false},cnf:{sub:null,todos:false,aberto:null},pcp:{prodz:false,aba:'abertas',aberta:null,q:'',ap:null,msg:''},
  dados:{},custos:{},ops:null,prods:{},marcas:{},sync:null,abas:[],nome:''};

/* ---------- tema (o mesmo do site: pks_tema) ---------- */
function aplicaTema(t){document.documentElement.dataset.theme=t;document.querySelector('meta[name=theme-color]')?.setAttribute('content',t==='dark'?'#18191c':'#f1f2f4')}
try{aplicaTema(localStorage.getItem('pks_tema')||'light')}catch{aplicaTema('light')}

const carregar=nome=>ST.dados[nome]||(ST.dados[nome]=fetch(nome+'.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}));
const esperando=t=>`<div class="vazio">${t}</div>`;
const IC={lupa:'<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',fat:'<path d="M5 20V11M11 20V5M17 20v-6"/>',cnf:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',pcp:'<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h5M8 17h7"/>',
  volta:'<path d="M15 6l-6 6 6 6"/>',cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',sai:'<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',tema:'<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',seta:'<path d="M9 6l6 6-6 6"/>',dev:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'};
const svg=(k,cl='')=>`<svg class="${cl}" viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
const TELAS=[['faturamento','Faturamento','Acompanhe o desempenho do faturamento.','faturamento','fat'],['custo','Custo das entradas','Monitore o custo das matérias-primas.','custonf','cnf'],['pcp','PCP','Ordens de produção da Vaeso.','pcpvaeso','pcp']];

/* ---------- acesso ---------- */
async function inicia(){
  const u=await window.claude.use('user'),db=await window.claude.use('db');
  const me=await u.me();ST.nome=String(me.email||me.name||'').split('@')[0].split(/[._-]/)[0];ST.nome=ST.nome?ST.nome[0].toUpperCase()+ST.nome.slice(1):'';
  let liberadas=[];
  if(me.isOwner)liberadas=TELAS.map(t=>t[0]);
  else{try{const s=await db.doc('usuarios/'+me.id).get();const reg=s.exists?s.data():null;liberadas=TELAS.filter(t=>(reg?.abas||[]).includes(t[3])).map(t=>t[0])}catch{}}
  ST.abas=liberadas;
  if(liberadas.includes('custo'))db.collection('custos').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());ST.custos=o;if(ST.tela==='custo')desenha()},()=>{});
  if(liberadas.includes('pcp')){db.collection('vaeso_ops').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());ST.ops=o;if(['pcp','inicio'].includes(ST.tela))desenha()},()=>{ST.ops={};desenha()});
    ST.db=db;
    db.collection('vaeso_prod').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());ST.prods=o;if(ST.tela==='pcp')desenha()},()=>{});
    db.collection('pcp_linhas').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());ST.marcas=o;if(['pcp','inicio'].includes(ST.tela))desenha()},()=>{});
    db.doc('meta/vaeso_sync').onSnapshot(s=>{ST.sync=s.exists?s.data():null;if(ST.tela==='pcp')desenha()},()=>{})}
  addEventListener('hashchange',rota);rota();
}
function rota(){const h=location.hash.slice(1);ST.tela=ST.abas.includes(h)?h:'inicio';scrollTo(0,0);desenha()}
function desenha(){
  const box=$('tela');
  if(!ST.abas.length){box.innerHTML=topo()+esperando('<b>Seu acesso ainda não foi liberado.</b><br>Peça ao administrador do Sistema PKS para liberar Faturamento, Custo NF entrada ou Ordens de produção Vaeso.');return}
  ({inicio:telaInicio,faturamento:telaFat,custo:telaCnf,pcp:telaPcp})[ST.tela]();mostraAba()}
new MutationObserver(mostraAba).observe($('tela'),{childList:true});

/* ---------- topo: faixa do painel, mês, tema e sair ---------- */
function topo(comMes,atualizado){
  const meses=[];for(let i=0;i<12;i++)meses.push(mesMais(HOJE.slice(0,7),-i));
  return `<header class="faixa">${ST.tela!=='inicio'?`<a class="volta" href="#inicio" aria-label="Voltar ao início">${svg('volta')}</a>`:''}<b>PAINEL PKS</b><span class="selo" aria-hidden="true">PKS</span></header>
  <div class="barra">${comMes?`<label class="mes">${svg('cal','ic-mes')}<select id="mesSel" aria-label="Mês">${meses.map(m=>`<option value="${m}" ${m===ST.mes?'selected':''}>${mesNome(m)}</option>`).join('')}</select></label>`:'<span class="cresce"></span>'}
  <button type="button" class="bt-ic" id="temaBt" aria-label="Trocar entre tema claro e escuro">${svg('tema')}</button><button type="button" class="bt-ic" id="sairBt" aria-label="Sair">${svg('sai')}</button></div>
  ${ST.tela==='inicio'?abas():''}${atualizado?`<p class="atual">${atualizado}</p>`:''}`;
}

/* Abas: rolam para o lado na faixa; arrastar a tela para o lado passa para a vizinha */
const listaAbas=()=>['inicio',...TELAS.map(x=>x[0]).filter(k=>ST.abas.includes(k))];
const nomeAba=k=>k==='inicio'?'Início':TELAS.find(x=>x[0]===k)[1];
function abas(){if(!ST.abas.length)return '';return `<nav class="abas" aria-label="Telas do painel">${listaAbas().map(k=>`<a href="#${k}"${k===ST.tela?' aria-current="page"':''}>${nomeAba(k)}</a>`).join('')}</nav>`}
function mostraAba(){const n=document.querySelector('.abas'),a=n?.querySelector('[aria-current]');if(a)n.scrollLeft=a.offsetLeft-n.offsetLeft-(n.clientWidth-a.offsetWidth)/2}

/* ---------- início ---------- */
function telaInicio(){
  const box=$('tela');const linha={};
  const fj=ST.dados.fatJ;if(fj&&ST.abas.includes('faturamento')){const B=fatBase();linha.faturamento=`${brl0(B.porMes.get(HOJE.slice(0,7))||0)} em ${MESES[+HOJE.slice(5,7)-1].toLowerCase()}`}
  if(ST.ops){const ab=PCP.montar(ST.ops,ST.prods,ST.marcas).filter(o=>o.abertas.length);const at=ab.filter(o=>o.prevista&&o.prevista<HOJE).length;linha.pcp=`${pl(ab.length,'ordem aberta','ordens abertas')}${at?` · ${at} atrasada${at>1?'s':''}`:''}`}
  const hr=new Date().getHours();
  box.innerHTML=topo(false)+`<section class="ola"><span class="olho">Visão geral</span><h1>${hr<12?'Bom dia':hr<18?'Boa tarde':'Boa noite'}${ST.nome?', '+esc(ST.nome):''}</h1><p>Acesse seus indicadores e operações.</p></section>
  <div class="blocos">${TELAS.filter(t=>ST.abas.includes(t[0])).map(([k,t,d,,ic])=>`<a class="bloco" href="#${k}"><span class="bola">${svg(ic)}</span><span class="bt-t"><b>${t}</b>${svg('seta','chev')}</span><small>${d}</small>${linha[k]?`<em>${esc(linha[k])}</em>`:''}</a>`).join('')}</div>
  <footer class="marca"><span class="selo grande" aria-hidden="true">PKS</span><span>PKS Plásticos<br><small>Sistema PKS · gestão</small></span></footer>`;
  if(!fj&&ST.abas.includes('faturamento'))carregar('faturamento').then(j=>{ST.dados.fatJ=j;if(ST.tela==='inicio')telaInicio()}).catch(()=>{});
}

/* ---------- Faturamento ---------- */
let FAT=null;
function fatBase(){if(FAT)return FAT;const j=ST.dados.fatJ;
  const L=linhasDe(j).filter(l=>l.status!=='canceled'&&RECEITA.has(String(l.cfop||'').slice(1)));
  const g=new Map(),porMes=new Map();
  for(const l of L){const v=+l.total||0;const o=g.get(l.chave)||{k:l.chave,data:l.data,cli:l.destNome,v:0};o.v+=v;g.set(l.chave,o);porMes.set(l.data.slice(0,7),(porMes.get(l.data.slice(0,7))||0)+v)}
  const ger=String(j.geradoEm||'').slice(0,10)||HOJE;
  FAT={notas:[...g.values()],porMes,corte:somaDias(ger,-1),geradoEm:j.geradoEm||''};return FAT}
let DEV=null;
function devBase(){if(DEV)return DEV;const j=ST.dados.entJ,C=j.colunas,ix=n=>C.indexOf(n);
  const I={cf:ix('Cod. Fiscal'),t:ix('Vlr.Total'),ipi:ix('Vlr.IPI'),e:ix('DT Emissao'),g:ix('DT Digitacao'),n:ix('Nome Fornecedor'),d:ix('Documento')};
  const g=new Map();
  for(const r of j.linhas){const c=String(r[I.cf]||'');if(!'12'.includes(c[0])||!DEVOL.has(c.slice(1)))continue;
    const data=String(r[I.e]||r[I.g]||'').slice(0,10),k=String(r[I.d])+'|'+r[I.n];const o=g.get(k)||{data,nome:r[I.n]||'',doc:String(r[I.d]||''),v:0};o.v+=(+r[I.t]||0)+(+r[I.ipi]||0);g.set(k,o)}
  DEV=[...g.values()];return DEV}
function linha(pts,{rotulos='todos'}={}){
  const W=340,H=170,l=38,r=10,t=18,b=22,w=W-l-r,h=H-t-b,n=pts.length,vivos=pts.filter(p=>!p.futuro);
  const max=Math.max(1,...vivos.map(p=>p.v));const passo=[1,2,2.5,5,10].map(x=>x*10**Math.floor(Math.log10(max/4))).find(x=>x*4>=max)||max/4;const topo=passo*4;
  const x=i=>l+(n===1?w/2:i*w/(n-1)),y=v=>t+h-(v/topo)*h;
  const grade=[0,1,2,3,4].map(i=>`<line x1="${l}" x2="${W-r}" y1="${y(i*passo)}" y2="${y(i*passo)}" class="g-grade"/><text x="${l-5}" y="${y(i*passo)+3}" class="g-ey">${i?curto(i*passo).replace(' mil','k').replace(' mi','mi'):'0'}</text>`).join('');
  const P=pts.map((p,i)=>[x(i),y(p.v),p,i]).filter(a=>!a[2].futuro);
  const caminho=P.map((a,i)=>(i?'L':'M')+a[0].toFixed(1)+' '+a[1].toFixed(1)).join(' ');
  const area=P.length?caminho+` L${P[P.length-1][0].toFixed(1)} ${t+h} L${P[0][0].toFixed(1)} ${t+h} Z`:'';
  const imax=P.reduce((m,a)=>a[2].v>(m?m[2].v:-1)?a:m,null);
  const mostraVal=a=>rotulos==='todos'||a===imax||a===P[P.length-1];
  const eixo=pts.map((p,i)=>(n<=12?(i%2===0||i===n-1):(i%5===0||i===n-1))?`<text x="${x(i)}" y="${H-5}" class="g-ex">${esc(p.rot)}</text>`:'').join('');
  return `<svg class="graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de faturamento">${grade}<path d="${area}" class="g-area"/><path d="${caminho}" class="g-linha"/>
    ${P.map(a=>`<g><circle cx="${a[0]}" cy="${a[1]}" r="${n>14?2.4:3.6}" class="g-pt${a[2].parcial?' parcial':''}"><title>${esc(a[2].nome)}: ${esc(brl(a[2].v))}</title></circle>${mostraVal(a)&&a[2].v?`<text x="${a[0]}" y="${a[1]-8}" class="g-v">${esc(curto(a[2].v))}</text>`:''}</g>`).join('')}${eixo}</svg>`;
}
async function telaFat(){
  const box=$('tela');
  if(!ST.dados.fatJ){box.innerHTML=topo(true)+esperando('Carregando o faturamento…');try{ST.dados.fatJ=await carregar('faturamento')}catch{box.innerHTML=topo(true)+esperando('Não foi possível carregar o faturamento.');return}if(ST.tela!=='faturamento')return}
  if(!ST.dados.entJ)carregar('entradas').then(j=>{ST.dados.entJ=j;if(ST.tela==='faturamento')telaFat()}).catch(()=>{});
  const B=fatBase(),m=ST.mes,f=ST.fat,ano=m.slice(0,4),mAnt=mesMais(m,-1),atual=m===HOJE.slice(0,7);
  const fM=B.porMes.get(m)||0,fAnt=B.porMes.get(mAnt)||0;
  const D=ST.dados.entJ?devBase().filter(d=>d.data.startsWith(m)):null,dev=D?D.reduce((a,d)=>a+d.v,0):null;
  const fim=fimMes(m),corte=B.corte<fim?B.corte:fim;
  const duTot=diasUteis(m+'-01',fim),duPas=atual?Math.max(1,diasUteis(m+'-01',corte)):duTot,proj=atual?fM/duPas*duTot:fM;
  const mesesAno=Array.from({length:12},(_,i)=>ano+'-'+String(i+1).padStart(2,'0'));
  const acum=mesesAno.filter(x=>x<=m).reduce((a,x)=>a+(B.porMes.get(x)||0),0),nMes=+m.slice(5,7),media=acum/nMes;
  const notasM=B.notas.filter(n=>n.data.startsWith(m));
  let pts;
  if(f.esc==='dia')pts=Array.from({length:+fim.slice(8)},(_,i)=>{const d=m+'-'+String(i+1).padStart(2,'0');return {rot:String(i+1),nome:`${DIAS[isoDe(d).getDay()]}, ${dt(d)}`,v:notasM.filter(n=>n.data===d).reduce((a,n)=>a+n.v,0),futuro:d>B.corte&&atual}});
  else if(f.esc==='semana'){const ref=atual?B.corte:fim,seg=somaDias(ref,-((isoDe(ref).getDay()+6)%7));
    pts=Array.from({length:10},(_,i)=>{const de=somaDias(seg,-7*(9-i)),ate=somaDias(de,6);return {rot:ddmm(de),nome:`Semana de ${ddmm(de)} a ${dt(ate)}`,v:B.notas.filter(n=>n.data>=de&&n.data<=ate).reduce((a,n)=>a+n.v,0),parcial:ate>=ref}})}
  else pts=mesesAno.map(x=>({rot:MESES[+x.slice(5)-1].slice(0,3),nome:mesNome(x),v:B.porMes.get(x)||0,futuro:x>m,parcial:x===m&&atual}));
  const cli=new Map();for(const n of notasM)cli.set(n.cli,(cli.get(n.cli)||0)+n.v);
  const top=[...cli.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6),topMax=top.length?top[0][1]:1;
  const ritmo=fAnt?proj/fAnt-1:NaN;
  const anoMax=Math.max(1,...mesesAno.map(x=>x===m&&atual?proj:(B.porMes.get(x)||0)));
  let h=topo(true,`Atualizado em ${B.geradoEm?new Date(B.geradoEm).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',',' às'):'–'}`)+
  `<section class="heroi"><span class="olho">Faturamento do mês</span><b>${brl0(fM)}</b><span class="pilula">${dev===null?'Devoluções …':`Devoluções <i class="neg">${brl0(-dev)}</i> · Líquido <strong>${brl0(fM-dev)}</strong>`}</span></section>
  <section class="cartao"><div class="cab"><h2>${svg('fat','ic')}Faturamento por ${{mes:'mês',semana:'semana',dia:'dia'}[f.esc]}</h2><div class="seg" role="group" aria-label="Agrupar por">${[['dia','Dia'],['semana','Semana'],['mes','Mês']].map(([k,l])=>`<button type="button" data-esc="${k}" aria-pressed="${f.esc===k}">${l}</button>`).join('')}</div></div>
  <p class="leg"><i></i>${{mes:'Faturamento mensal no ano',semana:'Últimas 10 semanas',dia:'Faturamento diário no mês'}[f.esc]}</p>${linha(pts,{rotulos:f.esc==='mes'?'todos':'pontas'})}</section>
  <div class="kpis">
    <div class="kpi c1"><span>${atual?'Projeção do mês':'Notas no mês'}</span><b>${atual?brl0(proj):n0(notasM.length)}</b>${atual?`<small>${duPas} de ${duTot} dias úteis</small>`:''}</div>
    <div class="kpi c2"><span>${atual?'Ritmo vs mês anterior':'Vs mês anterior'}</span><b class="${ritmo<0?'neg':'pos'}">${pct(ritmo)}</b></div>
    <div class="kpi c3"><span>Mês anterior (fechado)</span><b>${brl0(fAnt)}</b></div>
    <div class="kpi c4"><span>Acumulado no ano</span><b>${brl0(acum)}</b><small>média mensal ${brl0(media)}</small></div></div>
  ${D?`<section class="cartao dobra${f.dev?' aberta':''}"><button type="button" class="cab bt-dobra" data-dev aria-expanded="${f.dev}"><h2>${svg('dev','ic')}Devoluções</h2><span class="neg forte">${brl0(-dev)}</span></button>
    ${f.dev?(D.length?`<ul class="mini">${D.sort((a,b)=>b.v-a.v).map(d=>`<li><span><b>${esc(nomeCurto(d.nome))}</b><small>NF ${esc(String(+d.doc||d.doc))} · ${dt(d.data)}</small></span><b class="neg">${brl(-d.v)}</b></li>`).join('')}</ul>`:'<p class="mudo">Nenhuma devolução no mês.</p>'):''}</section>`:''}
  <section class="cartao"><div class="cab"><h2>Maiores clientes do mês</h2><span class="mudo">${pl(cli.size,'cliente','clientes')}</span></div>
    ${top.length?`<ul class="hbar">${top.map(([c,v])=>`<li><span class="hb-n">${esc(nomeCurto(c))}</span><span class="hb-b"><i style="width:${Math.max(2,v/topMax*100)}%"></i></span><b>${curto(v)}</b></li>`).join('')}</ul>`:'<p class="mudo">Nenhuma nota no mês.</p>'}</section>
  <section class="cartao"><div class="cab"><h2>Faturamento no ano</h2></div><p class="leg3"><span><i class="r"></i>Realizado</span><span><i class="a"></i>Mês em andamento</span><span><i class="p"></i>Projeção</span></p>
    <ul class="hbar ano">${mesesAno.filter(x=>x<=m||(atual&&x===m)).map(x=>{const v=B.porMes.get(x)||0,and=x===m&&atual;
      return `<li><span class="hb-n">${MESES[+x.slice(5)-1].slice(0,3)}</span><span class="hb-b">${and?`<i class="p" style="width:${proj/anoMax*100}%"></i>`:''}<i class="${and?'a':'r'}" style="width:${Math.max(1,v/anoMax*100)}%"></i></span><b>${curto(v)}${and?` <small>· proj. ${curto(proj)}</small>`:''}</b></li>`}).join('')}</ul></section>
  <p class="rodape">Notas emitidas (Qive), CFOPs de receita.</p>`;
  box.innerHTML=h;
}

/* ---------- Custo das entradas ---------- */
const CRED_PC=new Set(['101','102','124','125','401','403']);
const cfopEntrada=c=>{c=String(c||'');return /^[567]\d{3}$/.test(c)?String(+c[0]-4)+c.slice(1):c};
const SUBS=['Polímero','Master','Componentes','Injetados'];
let CNF=null;
function cnfBase(){if(CNF)return CNF;const j=ST.dados.entJ,C=j.colunas,ix=n=>C.indexOf(n);
  const I={p:ix('Produto'),d:ix('Desc.Produto'),u:ix('Unidade'),q:ix('Quantidade'),t:ix('Vlr.Total'),icms:ix('Vlr.ICMS'),ipi:ix('Vlr.IPI'),cf:ix('Cod. Fiscal'),f:ix('Nome Fornecedor'),fc:ix('Forn/Cliente'),e:ix('DT Emissao'),g:ix('DT Digitacao'),doc:ix('Documento'),ds:ix('Desconto'),fr:ix('Vlr. Frete'),dp:ix('Vlr. Despesa')};
  const g=new Map();
  for(const r of j.linhas){const q=+r[I.q]||0,t=+r[I.t]||0;if(!q||!t)continue;
    const qive=r[0]==='Qive',cf=qive?cfopEntrada(r[I.cf]):String(r[I.cf]||''),v=x=>x>=0?+r[x]||0:0,icms=+r[I.icms]||0;
    const base=t-v(I.ds)+v(I.fr)+v(I.dp)-icms,cred=CRED_PC.has(cf.slice(1))?base*(0.0165+0.076):0;
    const forn=String(r[I.f]||r[I.fc]||''),cod=String(r[I.p]??'').trim(),key=qive?'q:'+(r[I.fc]||forn)+'|'+cod:'p:'+cod;
    const ipi=+r[I.ipi]||0,pago=t-v(I.ds)+v(I.fr)+v(I.dp)+ipi;
    const it={q,pago,cfop:cf,compra:pago/q,custo:(base-cred)/q,ipi:ipi/q,icms:icms/q,pis:cred?base*0.0165/q:0,cofins:cred?base*0.076/q:0,forn,data:String(r[I.e]||r[I.g]||'').slice(0,10),doc:String(r[I.doc]||'')};
    const o=g.get(key)||{key,cod,desc:String(r[I.d]||cod),un:String(r[I.u]||'').toLowerCase()||'un',L:[]};o.L.push(it);g.set(key,o)}
  CNF=[...g.values()].map(o=>{o.L.sort((a,b)=>b.data.localeCompare(a.data));const u=o.L.slice(0,5),ult=u[0],qt=u.reduce((a,x)=>a+x.q,0),med=u.reduce((a,x)=>a+x.compra*x.q,0)/qt,medC=u.reduce((a,x)=>a+x.custo*x.q,0)/qt;
    return {...o,u,ult,med,medC,var:med?(ult.compra-med)/med:0,data:ult.data,valor90:o.L.filter(x=>x.data>=somaDias(HOJE,-90)).reduce((a,x)=>a+x.pago,0)}});
  return CNF}
async function telaCnf(){
  const box=$('tela');
  if(!ST.dados.entJ){box.innerHTML=topo(true)+esperando('Carregando as compras…');try{ST.dados.entJ=await carregar('entradas')}catch{box.innerHTML=topo(true)+esperando('Não foi possível carregar as compras.');return}if(ST.tela!=='custo')return}
  const c=ST.cnf,m=ST.mes,R=cnfBase(),subDe=r=>r.key.startsWith('p:')?String((ST.custos[r.cod]||{}).sub||''):'';
  const temSub=SUBS.filter(s=>R.some(r=>subDe(r)===s));
  if(c.sub===null)c.sub=temSub[0]||'todas';
  const doMes=R.flatMap(r=>r.L.filter(x=>x.data.startsWith(m)).map(x=>({...x,r})));
  const comprado=doMes.reduce((a,x)=>a+x.pago,0),nfs=new Set(doMes.map(x=>x.doc+'|'+x.forn)).size;
  const lim=somaDias(HOJE,-90);
  const lista=R.filter(r=>(c.sub==='todas'?r.L.length>=2:subDe(r)===c.sub)&&(c.todos||r.data>=lim)).sort((a,b)=>c.sub==='todas'?b.valor90-a.valor90||b.data.localeCompare(a.data):a.desc.localeCompare(b.desc,'pt-BR'));
  const vis=c.todos?lista:lista.slice(0,c.sub==='todas'?15:40);
  const sobe=lista.filter(r=>r.var>0.0005).length,cai=lista.filter(r=>r.var<-0.0005).length;
  let h=topo(true,ST.dados.entJ.geradoEm?'Atualizado em '+quandoTxt(ST.dados.entJ.geradoEm):'')+
  `<section class="heroi"><span class="olho">Comprado em ${MESES[+m.slice(5)-1].toLowerCase()}</span><b>${brl0(comprado)}</b><span class="pilula">${pl(nfs,'nota','notas')} · ${pl(new Set(doMes.map(x=>x.r.key)).size,'material','materiais')}</span></section>
  <div class="chips" role="group" aria-label="Subclassificação">${[...temSub,'todas'].map(k=>`<button type="button" data-sub="${esc(k)}" aria-pressed="${c.sub===k}">${k==='todas'?'Mais comprados':esc(k)}</button>`).join('')}</div>
  <div class="kpis"><div class="kpi c1"><span>Subiram</span><b class="neg">${n0(sobe)}</b><small>preço acima da média</small></div><div class="kpi c2"><span>Caíram</span><b class="pos">${n0(cai)}</b><small>preço abaixo da média</small></div></div>
  <section class="cartao"><div class="cab"><h2>${svg('cnf','ic')}Preço de compra</h2><span class="mudo">${c.todos?'todas as compras':'últimos 90 dias'}</span></div><ul class="precos">`;
  for(const r of vis){const ab=c.aberto===r.key,v=r.var,vt=Math.abs(v)<0.0005?'=':pct(v);
    h+=`<li class="${ab?'aberta':''}"><button type="button" class="preco" data-cnf="${esc(r.key)}" aria-expanded="${ab}"><span class="p1"><b>${esc(r.desc)}</b><span class="var ${vt==='='?'':v>0?'sobe':'cai'}">${vt}</span></span>
      <span class="p2"><small>${esc(nomeCurto(r.ult.forn))} · ${ddmm(r.data)}</small><span class="pv"><b>${brl(r.ult.compra)}</b><small>/${esc(r.un)}</small></span></span></button>`;
    if(ab){const x0=r.ult,d4=v=>Math.abs(v)<0.1&&v?'R$ '+nf(2,4).format(v):brl(v),li=(n,v,cl='')=>`<li class="${cl}"><span>${n}</span><b>${v}</b></li>`;
      h+=`<div class="tab"><ul class="conta">${li('Preço de compra com impostos',d4(x0.compra))}${x0.ipi?li('IPI','− '+d4(x0.ipi),'men'):''}${x0.icms?li('ICMS','− '+d4(x0.icms),'men'):''}${x0.pis?li('PIS 1,65%','− '+d4(x0.pis),'men')+li('COFINS 7,6%','− '+d4(x0.cofins),'men'):''}${li('Custo por '+esc(r.un),d4(x0.custo),'fim')}</ul>
      ${x0.ipi||x0.icms||x0.pis?'':`<p class="mudo">Esta nota não tem imposto destacado${x0.cfop?' (CFOP '+esc(x0.cfop)+')':''}.</p>`}<p class="mudo">Últimas ${r.u.length} compras · preço médio ${brl(r.med)} · custo médio ${brl(r.medC)}</p><table><thead><tr><th>Data</th><th>Fornecedor</th><th class="n">Qtde</th><th class="n">Com imp.</th><th class="n">Custo</th></tr></thead><tbody>${r.u.map(x=>`<tr><td>${ddmm(x.data)}</td><td>${esc(nomeCurto(x.forn).split(' ').slice(0,2).join(' '))}</td><td class="n">${nf(0,2).format(x.q)}</td><td class="n">${F2.format(x.compra)}</td><td class="n"><b>${F2.format(x.custo)}</b></td></tr>`).join('')}</tbody></table></div>`}
    h+='</li>'}
  h+=`</ul>${!vis.length?'<p class="mudo">Nenhuma compra nesse grupo nos últimos 90 dias.</p>':''}${lista.length>vis.length||c.todos?`<button type="button" class="mais" data-todos>${c.todos?'Só os últimos 90 dias':'Ver todos ('+n0(lista.length)+')'}</button>`:''}</section>`;
  box.innerHTML=h;
}

/* ---------- PCP: ordens de produção da Vaeso ---------- */
function quadroProduzidos(){
  const hoje=PCP.diaSP(Date.now()),r=PCP.produzidosNosDias(ST.ops,hoje),ab=ST.pcp.prodz,dn=d=>d===hoje?'hoje':DIAS[isoDe(d).getDay()]+' '+ddmm(d);
  return `<section class="cartao dobra${ab?' aberta':''}"><button type="button" class="cab bt-dobra" data-prodz aria-expanded="${ab}"><h2>Produzidos <small class="mudo">últimos 7 dias</small></h2><span class="pz-t"><b>${n0(r.total)} pç</b>${svg('seta','chev')}</span></button>
  ${!ab?'':`<div class="pz-d">${r.dias.map(d=>`<div class="${d===hoje?'hoje':''}"><span>${dn(d)}</span><b>${n0(r.porDia[d])}</b></div>`).join('')}</div>${r.linhas.length?`<ul class="mini">${r.linhas.map(l=>`<li><span><b>${esc(l.desc||l.sku)}</b><small>${esc(l.sku)} · ${r.dias.filter(d=>l.dias[d]).map(d=>dn(d)+': '+n0(l.dias[d])).join(' · ')}</small></span><span class="n"><b>${n0(l.total)}</b></span></li>`).join('')}</ul>`:'<p class="mudo">Nenhuma produção apontada nos últimos 7 dias.</p>'}`}</section>`;
}
function telaPcp(){
  const box=$('tela');
  if(!ST.ops){box.innerHTML=topo(false)+esperando('Carregando as ordens de produção…');return}
  const p=ST.pcp,O=PCP.montar(ST.ops,ST.prods,ST.marcas).filter(o=>o.status!=='cancelada');
  const ab=O.filter(o=>o.status==='aberta'&&(o.abertas.length||o.encerrar)).sort((a,b)=>(a.prevista||'9').localeCompare(b.prevista||'9'));
  const comLinha=ab.filter(o=>o.abertas.length),linAb=ab.flatMap(o=>o.abertas);
  const fin=O.filter(o=>o.finalizadas.length).sort((a,b)=>{const u=o=>o.finalizadas.reduce((m,r)=>r.em>m?r.em:m,'')||o.prevista;return u(b).localeCompare(u(a))});
  const nFin=fin.reduce((a,o)=>a+o.finalizadas.length,0);
  const ped=linAb.reduce((a,r)=>a+r.qtd,0),feito=linAb.reduce((a,r)=>a+(r.prod||0),0);
  let h=topo(false,ST.sync?.ultimoPuxar?'Atualizado em '+quandoTxt(ST.sync.ultimoPuxar):'')+
  `<section class="heroi"><span class="olho">Linhas em aberto</span><b>${n0(linAb.length)}</b><span class="pilula">${pl(comLinha.length,'ordem','ordens')} · ${n0(ped)} peças · <strong>${F0.format(ped?feito/ped*100:0)}% produzido</strong></span></section>
  ${quadroProduzidos()}
  <div class="seg largo" role="group" aria-label="Situação">${[['abertas','Em aberto',linAb.length],['finalizadas','Finalizadas',nFin]].map(([k,l,n])=>`<button type="button" data-paba="${k}" aria-pressed="${p.aba===k}">${l} ${n0(n)}</button>`).join('')}</div>
  ${p.msg?`<p class="aviso${p.msgErro?' erro':''}" role="status">${esc(p.msg)}</p>`:''}`;
  const lista=(p.aba==='abertas'?ab:fin).filter(o=>PCP.casa(o,p.q,p.aba==='abertas'?o.abertas:o.finalizadas));
  h+=`<label class="busca">${svg('lupa')}<input type="search" id="pcpQ" placeholder="Ordem, código ou descrição" autocomplete="off" value="${esc(p.q)}" aria-label="Buscar por número da ordem, código ou descrição do produto"></label>`;
  if(lista.length)h+='<ul class="ordens">';
  for(const o of lista){const aberto=p.aberta===o.id,late=p.aba==='abertas'&&o.prevista&&o.prevista<HOJE,L=p.aba==='abertas'?o.abertas:o.finalizadas;
    h+=`<li class="${aberto?'aberta':''}"><button type="button" class="ordem" data-ord="${esc(o.id)}" aria-expanded="${aberto}"><span class="on"><b>${esc(o.numero)}</b>${o.prevista?`<small class="${late?'neg':''}">${late?'atrasada · ':''}prevista ${ddmm(o.prevista)}</small>`:''}${L.some(r=>r.pendente)?'<small class="neg">apontamento a enviar</small>':''}${p.aba==='abertas'&&o.encerrar?'<small class="neg">falta encerrar a ordem</small>':''}</span>${svg('seta','chev')}</button>
    ${aberto?`<div class="prods">${L.map(linhaPcp).join('')}${p.aba==='abertas'&&o.encerrar?`<p class="mudo">Todas as linhas foram finalizadas, mas a ordem continua aberta na Vaeso.</p><button type="button" class="ac prim" data-encoc="${esc(o.id)}" ${p.ocup?'disabled':''}>Encerrar ${esc(o.numero)}</button>`:''}</div>`:''}</li>`}
  if(lista.length)h+='</ul>';else h+=esperando(p.q?'Nenhuma ordem com essa busca.':p.aba==='abertas'?'Nenhuma linha em aberto.':'Nenhuma linha finalizada.');
  const ae=document.activeElement,naBusca=ae?.id==='pcpQ',pos=naBusca?ae.selectionStart:0;
  const foco=document.activeElement?.id==='apQtd';
  box.innerHTML=h;
  const inp=$('apQtd');if(inp&&(foco||p.foco)){p.foco=false;inp.focus()}
  if(naBusca){const n=$('pcpQ');n.focus();n.setSelectionRange(pos,pos)}
}
function linhaPcp(r){
  const p=ST.pcp,a=p.ap&&p.ap.k===r.k?p.ap:null,d=r.prod===null?null:r.prod-r.qtd;
  const selo=d===null?'':Math.abs(d)<1?'<i class="ok">igual</i>':d<0?`<i class="falta">−${n0(-d)}</i>`:`<i class="mais">+${n0(d)}</i>`;
  return `<div class="lin"><div class="lin-t"><span><b>${esc(r.desc||r.sku)}</b><small>${esc(r.sku)}${r.op?' · OP '+esc(r.op):''}${r.ent?' · entregue '+n0(r.ent):''}</small></span><span class="lin-q"><small>pedido</small><b>${n0(r.qtd)}</b></span><span class="lin-q"><small>produzido</small><b>${r.prod===null?'–':n0(r.prod)}</b>${selo}</span></div>
  ${r.pendente?`<p class="aviso erro">${r.pendente.acao==='desfazer'?'Desfazer':'Apontamento de '+n0(r.pendente.qtd)} ainda não recebido pela Vaeso; o sistema tenta de novo a cada 10 minutos.${r.pendente.erro?' '+esc(r.pendente.erro):''}</p>`:''}
  ${a?painelAp(r,a):!r.ordemAberta?'':`<div class="acoes">${r.sit==='aberta'?`<button type="button" class="ac prim" data-ap="${esc(r.k)}" ${p.ocup?'disabled':''}>${r.prod===null?'Apontar':'Alterar apontamento'}</button>`:`${r.marcada?`<button type="button" class="ac" data-reabre="${esc(r.k)}" ${p.ocup?'disabled':''}>Reabrir linha</button>`:`<button type="button" class="ac" data-ap="${esc(r.k)}" ${p.ocup?'disabled':''}>Alterar apontamento</button>`}`}</div>`}</div>`;
}
function painelAp(r,a){
  const o=ST.pcp.ocup?'disabled':'';
  if(a.perg)return `<div class="ap"><b>Foram ${n0(a.qtd)} de ${n0(r.qtd)} peças. Encerrar esta linha ou continuar aberta?</b>${a.ultima?`<p class="mudo">É a última linha aberta: ao encerrar, a ${esc(r.oc)} também é encerrada na Vaeso.</p>`:''}
    <div class="acoes"><button type="button" class="ac prim" data-fim="encerra" ${o}>Encerrar linha</button><button type="button" class="ac" data-fim="continua" ${o}>Continuar aberta</button><button type="button" class="ac" data-fim="cancela" ${o}>Voltar</button></div>${a.erro?`<p class="aviso erro" role="alert">${esc(a.erro)}</p>`:''}</div>`;
  return `<div class="ap"><b>Quanto foi produzido no total?</b><div class="acoes"><button type="button" class="ac prim" data-modo="igual" ${o}>Igual à ordem · ${n0(r.qtd)}</button><button type="button" class="ac" data-modo="mais" aria-pressed="${a.modo==='mais'}" ${o}>A mais</button><button type="button" class="ac" data-modo="menos" aria-pressed="${a.modo==='menos'}" ${o}>A menos</button></div>
    ${a.modo?`<label class="ap-q"><span>Total produzido (${a.modo==='menos'?'menor':'maior'} que ${n0(r.qtd)})</span><input id="apQtd" type="text" inputmode="numeric" autocomplete="off" value="${esc(a.val||'')}"></label><button type="button" class="ac prim" data-apok ${o}>${ST.pcp.ocup?'Enviando…':'Confirmar'}</button>`:ST.pcp.ocup?'<p class="mudo">Enviando…</p>':''}
    ${a.erro?`<p class="aviso erro" role="alert">${esc(a.erro)}</p>`:''}
    <div class="acoes">${r.prod!==null?`<button type="button" class="ac" data-desf ${o}>Desfazer apontamento</button>`:''}<button type="button" class="ac" data-apfecha ${o}>Fechar</button></div></div>`;
}
const linhas=()=>PCP.montar(ST.ops,ST.prods,ST.marcas).flatMap(o=>o.itens);
const ordemDe=id=>PCP.montar(ST.ops,ST.prods,ST.marcas).find(o=>o.id===String(id));
async function relerPcp(){for(const [c,k] of [['vaeso_ops','ops'],['vaeso_prod','prods'],['pcp_linhas','marcas']]){const s=await ST.db.collection(c).get();const o={};s.docs.forEach(d=>o[d.id]=d.data());ST[k]=o}}
function avisa(m,erro){ST.pcp.msg=m;ST.pcp.msgErro=!!erro}
/* Encerra a ordem na Vaeso quando todas as linhas acabaram e alguma ficou a menos */
async function encerraOrdem(id){const o=ordemDe(id);if(!o?.encerrar)return false;await window.pksFuncao('pks-vaeso',{acao:'encerrar',op_id:o.op_id});return true}
/* Registra no item a diferença que o apontamento trouxe (estoque_mov, usado no Estoque do site) */
function registraMov(r,depois){const antes=r.prod||0,delta=depois-antes;if(!delta)return;
  return ST.db.doc(`estoque_mov/${r.k}|${Date.now()}`).set({op_id:r.op_id,produto_id:r.produto_id,sku:r.sku,antes,antesEm:r.em||'',depois,delta,em:new Date().toISOString()}).catch(()=>{})}
/* Aponta o total produzido. encerra: true (encerrar a linha a menos), false (continuar aberta) */
async function aponta(r,qtd,conferencia,encerra){
  const p=ST.pcp;if(p.ocup)return;p.ocup=true;p.msg='';if(p.ap)p.ap.erro='';desenha();
  let enviado=false,feito=false;
  try{
    const corpo={acao:'confirmar',op_id:r.op_id,produto_id:r.produto_id,conferencia};if(conferencia!=='igual')corpo.qtd=qtd;
    enviado=!!(await window.pksFuncao('pks-vaeso',corpo))?.enviado;feito=true;if(enviado)await registraMov(r,qtd);
    if(conferencia==='menos'&&encerra)await ST.db.doc('pcp_linhas/'+r.k).set({encerrada:true,qtd,op_id:r.op_id,produto_id:r.produto_id,em:new Date().toISOString()});
    else if(ST.marcas[r.k])await ST.db.doc('pcp_linhas/'+r.k).delete();
    await relerPcp();
    const fechou=enviado&&await encerraOrdem(r.op_id);if(fechou)await relerPcp();
    p.ap=null;
    avisa(!enviado?'Apontamento gravado, mas a Vaeso ainda não recebeu. O sistema tenta de novo a cada 10 minutos.':fechou?`Produção enviada. ${r.oc} encerrada na Vaeso.`:conferencia==='menos'&&!encerra?'Produção enviada. A linha continua aberta.':'Produção enviada. Linha finalizada.',!enviado);
  }catch(e){
    const m=e.message||'Não foi possível concluir.';
    if(feito){await relerPcp().catch(()=>{});p.ap=null;avisa('A produção foi apontada, mas o encerramento não foi concluído: '+m,true)}
    else if(p.ap)p.ap.erro=m;else avisa(m,true)}
  p.ocup=false;desenha();
}
async function fazPcp(fn,ok){const p=ST.pcp;if(p.ocup)return;p.ocup=true;p.msg='';desenha();
  try{const r=await fn();await relerPcp();p.ap=null;avisa(r||ok)}catch(e){avisa(e.message||'Não foi possível concluir.',true)}p.ocup=false;desenha()}
function confirmaAp(modo){
  const p=ST.pcp,a=p.ap,r=a&&linhas().find(x=>x.k===a.k);if(!r||p.ocup)return;
  const c=PCP.conferir(modo,a.val,r.qtd);if(c.erro){a.erro=c.erro;desenha();return}
  if(c.conferencia!=='menos'){aponta(r,c.qtd,c.conferencia);return}
  a.perg=true;a.qtd=c.qtd;a.erro='';a.ultima=ordemDe(r.op_id).itens.every(x=>x.k===r.k||x.sit==='finalizada');desenha();
}

/* ---------- eventos ---------- */
document.addEventListener('click',async e=>{const t=e.target;
  if(t.closest('#temaBt')){const v=document.documentElement.dataset.theme==='dark'?'light':'dark';aplicaTema(v);try{localStorage.setItem('pks_tema',v)}catch{}return}
  if(t.closest('#sairBt')){document.querySelector('.pks-sair')?.click();return}
  const es=t.closest('[data-esc]');if(es){ST.fat.esc=es.dataset.esc;desenha();return}
  if(t.closest('[data-dev]')){ST.fat.dev=!ST.fat.dev;desenha();return}
  const sb=t.closest('[data-sub]');if(sb){ST.cnf.sub=sb.dataset.sub;ST.cnf.aberto=null;ST.cnf.todos=false;desenha();return}
  if(t.closest('[data-todos]')){ST.cnf.todos=!ST.cnf.todos;desenha();return}
  const cn=t.closest('[data-cnf]');if(cn){ST.cnf.aberto=ST.cnf.aberto===cn.dataset.cnf?null:cn.dataset.cnf;desenha();return}
  const P=ST.pcp,pa=t.closest('[data-paba]');if(pa){P.aba=pa.dataset.paba;P.ap=null;P.aberta=null;P.msg='';desenha();return}
  if(t.closest('[data-prodz]')){P.prodz=!P.prodz;desenha();return}
  if(P.ocup)return;
  const od=t.closest('[data-ord]');if(od){P.aberta=P.aberta===od.dataset.ord?null:od.dataset.ord;P.ap=null;P.msg='';desenha();return}
  const ap=t.closest('[data-ap]');if(ap){P.ap={k:ap.dataset.ap,modo:'',val:'',erro:''};P.msg='';desenha();return}
  if(t.closest('[data-apfecha]')){P.ap=null;desenha();return}
  const mo=t.closest('[data-modo]');if(mo&&P.ap){if(mo.dataset.modo==='igual')confirmaAp('igual');else{P.ap.modo=mo.dataset.modo;P.ap.erro='';P.foco=true;desenha()}return}
  if(t.closest('[data-apok]')&&P.ap){confirmaAp(P.ap.modo);return}
  const fi=t.closest('[data-fim]');if(fi&&P.ap){if(fi.dataset.fim==='cancela'){P.ap.perg=false;desenha();return}const r=linhas().find(x=>x.k===P.ap.k);if(r)aponta(r,P.ap.qtd,'menos',fi.dataset.fim==='encerra');return}
  if(t.closest('[data-desf]')&&P.ap){const r=linhas().find(x=>x.k===P.ap.k);if(r&&confirm('Desfazer o apontamento deste produto, aqui e na Vaeso?'))fazPcp(async()=>{const x=await window.pksFuncao('pks-vaeso',{acao:'desfazer',op_id:r.op_id,produto_id:r.produto_id});if(x?.enviado)await registraMov(r,0);if(ST.marcas[r.k])await ST.db.doc('pcp_linhas/'+r.k).delete();return x?.enviado?'Apontamento desfeito.':'Gravado. Será desfeito na Vaeso na próxima tentativa.'});return}
  const rb=t.closest('[data-reabre]');if(rb){fazPcp(()=>ST.db.doc('pcp_linhas/'+rb.dataset.reabre).delete().then(()=>''),'Linha reaberta.');return}
  const eo=t.closest('[data-encoc]');if(eo){const o=ordemDe(eo.dataset.encoc);if(o&&confirm(`Encerrar a ${o.numero} aqui e na Vaeso? Foram produzidas ${n0(o.feito)} de ${n0(o.ped)} peças.`))fazPcp(()=>encerraOrdem(o.id).then(()=>''),`${o.numero} encerrada na Vaeso.`);return}
});
document.addEventListener('input',e=>{if(e.target.id==='pcpQ'){ST.pcp.q=e.target.value;desenha();return}if(e.target.id==='apQtd'&&ST.pcp.ap)ST.pcp.ap.val=e.target.value});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='apQtd'&&ST.pcp.ap&&!ST.pcp.ocup){e.preventDefault();confirmaAp(ST.pcp.ap.modo)}});
/* Arrastar a tela para o lado troca de aba (menos dentro do que já rola para o lado e dos campos) */
(function(){const m=$('tela');let g=null;
  const solta=()=>{if(!g)return;g=null;m.style.transition='transform .18s';m.style.transform='';setTimeout(()=>{m.style.transition=''},200)};
  m.addEventListener('touchstart',e=>{g=null;if(e.touches.length!==1||!ST.abas.length)return;const x=e.touches[0].clientX;
    if(x<20||x>innerWidth-20||e.target.closest('.abas,.chips,.tab,input,select'))return;g={x,y:e.touches[0].clientY,dx:0,on:false}},{passive:true});
  m.addEventListener('touchmove',e=>{if(!g)return;const dx=e.touches[0].clientX-g.x,dy=e.touches[0].clientY-g.y;
    if(!g.on){if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){g=null;return}if(Math.abs(dx)<14)return;g.on=true}
    const L=listaAbas(),i=L.indexOf(ST.tela),tem=L[i+(dx<0?1:-1)];g.dx=dx;m.style.transform=`translateX(${dx*(tem?.6:.15)}px)`},{passive:true});
  m.addEventListener('touchend',()=>{if(!g)return;const L=listaAbas(),para=g.on&&Math.abs(g.dx)>60?L[L.indexOf(ST.tela)+(g.dx<0?1:-1)]:null;solta();if(para)location.hash='#'+para});
  m.addEventListener('touchcancel',solta)})();
document.addEventListener('change',e=>{if(e.target.id==='mesSel'){ST.mes=e.target.value;desenha()}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')desenha()});

if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js',{scope:'./'}).catch(()=>{}));
inicia().catch(()=>{$('tela').innerHTML=esperando('Não foi possível abrir o painel. Verifique a internet e tente de novo.')});
})();
