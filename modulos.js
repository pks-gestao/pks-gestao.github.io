/* Módulos Cadastros, Entradas NF-e, Faturamento, Estruturas, Roteiro e Contabilidade.
   Usa os utilitários da página (S, $, esc, money, qty, dt, toast). Dados em dados/*.json; custos manuais e DRE no banco. */
(function(){
const M={dados:{},carregando:{},est:{},ui:{},custosManuais:{},dreValores:{},classif:{},form:{},dbOk:false};
window.MOD=M;

/* ---------- utilidades ---------- */
const brl=v=>(+v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
/* Regra geral: no máximo duas casas decimais em todas as telas. */
const num=(v,d=2)=>(+v||0).toLocaleString('pt-BR',{minimumFractionDigits:0,maximumFractionDigits:Math.min(d,2)});
const pct=v=>isFinite(v)?(v*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%':'–';
const COLL=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
const ano=new Date().getFullYear();
const hojeISO=new Date().toISOString().slice(0,10);
function ui(k,def){if(!(k in M.ui))M.ui[k]=typeof def==='function'?def():def;return M.ui[k]}

async function carregar(nome){
  if(M.dados[nome])return M.dados[nome];
  if(!M.carregando[nome])M.carregando[nome]=fetch('dados/'+nome+'.json').then(r=>{if(!r.ok)throw new Error(r.status);return r.json()}).then(j=>{M.dados[nome]=j;return j});
  return M.carregando[nome];
}
const linhasDe=j=>j.linhas.map(r=>Object.fromEntries(j.colunas.map((c,i)=>[c,r[i]])));

/* CFOP: classifica a operação. Receita conta no faturamento; retorno devolve material do cliente; remessa gera retorno depois. */
function tipoCfop(c){
  const s=String(c||'').slice(1);
  if(['101','102','103','104','105','106','109','110','111','116','117','118','119','120','122','123','124','125','401','402','403','405','551'].includes(s))return {t:'Receita',ret:'Não',cl:'p-done'};
  if(['902','903','906','907','913','916','921','925'].includes(s))return {t:'Retorno',ret:'É retorno',cl:'p-info'};
  if(['901','905','908','910','911','912','914','915','917','920','924','949'].includes(s))return {t:'Remessa',ret:s==='949'?'Conferir':'Sim',cl:'p-warn'};
  if(['201','202','208','209','210','410','411','412','413','503','553','556','660','661','662'].includes(s))return {t:'Devolução',ret:'Não',cl:'p-stop'};
  return {t:'Outra',ret:'Conferir',cl:'p-open'};
}
const CFOP_DESC={'5101':'Venda de produção do estabelecimento','6101':'Venda de produção do estabelecimento (fora do estado)','5102':'Venda de mercadoria adquirida','6102':'Venda de mercadoria adquirida (fora do estado)',
'5124':'Industrialização efetuada para outra empresa','6124':'Industrialização efetuada para outra empresa (fora do estado)','5125':'Industrialização para outra empresa, quando a mercadoria não transitar',
'5901':'Remessa para industrialização por encomenda','6901':'Remessa para industrialização (fora do estado)','5902':'Retorno de mercadoria usada na industrialização por encomenda','6902':'Retorno de mercadoria usada na industrialização (fora do estado)',
'5903':'Retorno de mercadoria recebida para industrialização e não aplicada','6903':'Retorno não aplicado (fora do estado)','5915':'Remessa para conserto','5916':'Retorno de conserto','5949':'Outra saída não especificada','6949':'Outra saída não especificada (fora do estado)',
'5910':'Remessa em bonificação, doação ou brinde','5912':'Remessa para demonstração','5913':'Retorno de demonstração','5405':'Venda de mercadoria com ST','5403':'Venda com ST (contribuinte substituto)'};
/* Descrições definidas pelo usuário (13/11/2026). Valem sobre as padrão. */
Object.assign(CFOP_DESC,{'1257':'Energia elétrica','1302':'Telecomunicação','1911':'Amostra grátis','1924':'Entrada industrialização conta terceiros','2252':'Energia elétrica','2302':'Telecomunicação','2352':'Frete','2555':'Entrada ativo terceiros','2911':'Amostra grátis','2920':'Entrada vasilhames','5105':'Venda estabelecimento entrega em outro','5551':'Venda bem ativo imobilizado','5656':'Venda combust lubrificantes','5909':'Retorno comodato','5911':'Amostra grátis','5924':'Remessa para industrialização por conta','5929':'Evitar bitributação referenciando NF já emitida','6106':'Venda estabelecimento entrega em outro','6107':'Venda para não contribuinte','6251':'Venda energia elétrica','6909':'Retorno comodato','6911':'Amostra grátis','6920':'Retorno vasilhames'});

/* Tabela genérica: colunas ordenáveis, busca e paginação. */
function tabela(id,cols,rows,o={}){
  const st=ui('tb_'+id,()=>({k:o.ordem||null,desc:!!o.desc,pag:0}));
  let rs=rows;
  if(st.k){const c=cols.find(c=>c.k===st.k);if(c){const g=c.v||(r=>r[c.k]);const sg=st.desc?-1:1;
    rs=rows.map(r=>[g(r),r]).sort(([a],[b])=>{const va=a===null||a===undefined||a==='',vb=b===null||b===undefined||b==='';if(va||vb)return va===vb?0:va?1:-1;return sg*(typeof a==='number'&&typeof b==='number'?a-b:COLL.compare(String(a),String(b)))}).map(p=>p[1])}}
  const por=o.porPagina||100,pags=Math.max(1,Math.ceil(rs.length/por));if(st.pag>=pags)st.pag=pags-1;
  const vis=rs.slice(st.pag*por,st.pag*por+por);
  let h=`<div class="scroll"><table class="${o.cls||''}"><thead><tr>${cols.map(c=>{const on=st.k===c.k;return `<th class="${c.num?'num':''}"${on?` aria-sort="${st.desc?'descending':'ascending'}"`:''}><button type="button" class="sort" data-mt="${id}" data-mk="${esc(c.k)}" title="Ordenar por ${esc(c.l)}">${esc(c.l)}<i aria-hidden="true">${on?(st.desc?'▼':'▲'):'↕'}</i></button></th>`}).join('')}</tr></thead><tbody>`;
  if(!vis.length)h+=`<tr><td colspan="${cols.length}" class="empty">${o.vazio||'Nada com esse filtro.'}</td></tr>`;
  for(const r of vis){h+=`<tr${o.linha?o.linha(r):''}>${cols.map(c=>`<td class="${c.num?'num':''} ${c.cls?c.cls(r):''}">${c.f?c.f(r):esc(r[c.k]??'')}</td>`).join('')}</tr>`;if(o.depois)h+=o.depois(r)||''}
  if(o.total)h+=`<tr class="tot">${o.total(rs)}</tr>`;
  h+='</tbody></table></div>';
  if(pags>1)h+=`<div class="tools pagin"><button class="act" data-mp="${id}" data-dir="-1" ${st.pag===0?'disabled':''}>Anterior</button><span class="small muted">Página ${st.pag+1} de ${pags} · ${rs.length.toLocaleString('pt-BR')} linhas</span><button class="act" data-mp="${id}" data-dir="1" ${st.pag>=pags-1?'disabled':''}>Próxima</button></div>`;
  else h+=`<p class="small muted">${rs.length.toLocaleString('pt-BR')} linha${rs.length===1?'':'s'}</p>`;
  return h;
}
const MES_N=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const isoD=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function perTexto(p){if(p.modo==='dias')return 'Últimos '+p.n+' dias';if(p.modo==='mes')return MES_N[+p.de.slice(5,7)-1]+'/'+p.de.slice(0,4);if(p.modo==='int')return dt(p.de)+' a '+dt(p.ate);return 'Ano '+p.de.slice(0,4)}
function periodoUI(k){const p=ui('per_'+k,()=>({de:ano+'-01-01',ate:hojeISO,modo:'ano'}));
  const hoje=new Date(),meses=[];for(let m=0;m<13;m++){const d=new Date(hoje.getFullYear(),hoje.getMonth()-m,1);meses.push(isoD(d).slice(0,7))}
  const ativo=(modo,v)=>p.modo===modo&&(v===undefined||String(p.n||p.de.slice(0,7))===String(v))?' aria-pressed="true"':'';
  return `<details class="per-pop" data-perbox="${k}"><summary><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg><span class="muted">Período</span> <b>${esc(perTexto(p))}</b><i aria-hidden="true">▾</i></summary><div class="per-menu">
  <div class="per-rap">${[30,60,90].map(n=>`<button type="button" data-perop="${k}" data-tipo="dias" data-v="${n}"${ativo('dias',n)}>Últimos ${n} dias</button>`).join('')}<button type="button" data-perop="${k}" data-tipo="ano"${ativo('ano')}>Ano ${ano}</button></div>
  <label class="per-l">Mês<select data-permes="${k}"><option value="">Escolha o mês</option>${meses.map(m=>`<option value="${m}" ${p.modo==='mes'&&p.de.slice(0,7)===m?'selected':''}>${MES_N[+m.slice(5)-1]}/${m.slice(0,4)}</option>`).join('')}</select></label>
  <div class="per-l">Intervalo<div class="per-int"><input type="date" id="perDe_${k}" value="${p.de}" aria-label="Data inicial"><span>a</span><input type="date" id="perAte_${k}" value="${p.ate}" aria-label="Data final"><button type="button" class="bt" data-peraplica="${k}">Aplicar</button></div></div>
  </div></details>`}

const noPeriodo=(k,d)=>{const p=ui('per_'+k,()=>({de:ano+'-01-01',ate:hojeISO}));return (!p.de||d>=p.de)&&(!p.ate||d<=p.ate)};
function selUI(k,ops,rot,def='todos'){const v=ui(k,def);return `<label class="campo"><span>${esc(rot)}</span><select data-mf="${k}">${ops.map(([val,l])=>`<option value="${esc(val)}" ${v===val?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`}
function buscaUI(k,ph){return `<label class="campo cresce"><span>Busca</span><input type="search" id="mb_${k}" data-mb="${k}" placeholder="${esc(ph)}" value="${esc(ui('b_'+k,''))}"></label>`}
const casa=(txt,q)=>!q||String(q).toLowerCase().split(/\s+/).filter(Boolean).every(w=>txt.toLowerCase().includes(w));
const esperando=t=>`<div class="empty">${t}</div>`;

/* ---------- Faturamento ---------- */
function fatLinhas(){const j=M.dados.faturamento;if(!j)return null;if(!M.fat)M.fat=linhasDe(j).filter(l=>l.status!=='canceled');return M.fat}
const PRINCIPAIS=[['ALLIAGE','Alliage'],['DOCOL','Docol'],['VAESO','Vaeso']];

/* Barras do faturamento (CFOPs de receita) por mês, no período e cliente escolhidos. */
/* Linha tracejada ligando o topo das barras do faturamento (desenhada depois do layout). */
function linhaFat(){const box=document.querySelector('.fat-graf .nfa-barras');if(!box)return;box.querySelector('svg.fat-linha')?.remove();
  const b=box.getBoundingClientRect(),P=[...box.querySelectorAll('.nfa-bar i')].map(i=>{const r=i.getBoundingClientRect();return [r.left-b.left+r.width/2,r.top-b.top]});if(P.length<2)return;
  box.insertAdjacentHTML('beforeend',`<svg class="fat-linha" width="${b.width}" height="${b.height}" aria-hidden="true"><polyline points="${P.map(p=>p.join(',')).join(' ')}"/>${P.map(([x,y])=>`<circle cx="${x}" cy="${y}" r="3"/>`).join('')}</svg>`)}
addEventListener('resize',()=>{if(M.atual==='faturamento')linhaFat()});
/* Gráfico com Mês (padrão: o ano todo), Semana (últimas 12, segunda a domingo) e Dia (o mês atual). Pedido do Chai, 23/11/2026.
   Segue o filtro de cliente, não o período. Clicar numa coluna leva o período da tela para ela e mostra as notas. */
const isoDe=s=>{const [a,m,d]=s.split('-').map(Number);return new Date(a,m-1,d)};
const somaDias=(s,n)=>{const d=isoDe(s);d.setDate(d.getDate()+n);return isoD(d)};
const DIAS_SEM=['dom','seg','ter','qua','qui','sex','sáb'];
function colunasFat(base,esc_){
  const rec=base.filter(l=>tipoCfop(l.cfop).t==='Receita');
  const junta=(de,ate)=>{const v=rec.filter(l=>l.data>=de&&l.data<=ate);return {v:v.reduce((a,l)=>a+l.total,0),notas:new Set(v.map(l=>l.chave)).size,cli:new Set(v.map(l=>l.destNome)).size}};
  if(esc_==='dia'){const m=hojeISO.slice(0,7),ult=new Date(+m.slice(0,4),+m.slice(5,7),0).getDate();
    return Array.from({length:ult},(_,i)=>{const d=m+'-'+String(i+1).padStart(2,'0');return {de:d,ate:d,rot:String(i+1),nome:`${DIAS_SEM[isoDe(d).getDay()]}, ${dt(d)}`,futuro:d>hojeISO,...junta(d,d)}})}
  if(esc_==='semana'){const h=isoDe(hojeISO),seg=somaDias(hojeISO,-((h.getDay()+6)%7));
    return Array.from({length:12},(_,i)=>{const de=somaDias(seg,-7*(11-i)),ate=somaDias(de,6);return {de,ate,rot:dt(de).slice(0,5),nome:`Semana de ${dt(de).slice(0,5)} a ${dt(ate)}`,...junta(de,ate)}})}
  return Array.from({length:12},(_,i)=>{const m=ano+'-'+String(i+1).padStart(2,'0'),ate=isoD(new Date(ano,i+1,0));return {de:m+'-01',ate,mes:m,rot:MESES[i].slice(0,3),nome:`${MESES[i]}/${ano}`,futuro:m>hojeISO.slice(0,7),...junta(m+'-01',ate)}});
}
function grafFat(base){
  const e=ui('fat_esc','mes');const C=colunasFat(base,e);
  const max=Math.max(1,...C.map(c=>c.v));const tot=C.reduce((a,c)=>a+c.v,0);
  const n0=v=>v?Math.round(v/1000).toLocaleString('pt-BR')+' mil':'';
  const tit={mes:`Faturamento por mês · ${ano}`,semana:'Faturamento por semana · últimas 12',dia:`Faturamento por dia · ${MESES[+hojeISO.slice(5,7)-1]}/${ano}`}[e];
  const pl=(n,a,b)=>n.toLocaleString('pt-BR')+' '+(n===1?a:b);
  return `${(setTimeout(linhaFat,30),'')}<div class="nfa-painel fat-graf"><div class="fat-graf-cab"><h3>${tit}</h3><span class="small muted">Total R$ ${brl(tot)}</span><div class="seg" role="group" aria-label="Agrupar o gráfico por">${[['mes','Mês'],['semana','Semana'],['dia','Dia']].map(([k,l])=>`<button type="button" data-uiset="fat_esc" data-v="${k}" aria-pressed="${e===k}">${l}</button>`).join('')}</div></div>
  <div class="nfa-barras${C.length>14?' densa':''}" role="img" aria-label="${esc(tit)}">${C.map(c=>c.futuro?`<div class="nfa-bar futuro"><small></small><span>${c.rot}</span></div>`:`<div class="nfa-bar" tabindex="0" role="button" data-fatbar="${c.de}|${c.ate}|${c.mes||''}" title="${esc(c.nome)}: R$ ${brl(c.v)} · ${pl(c.notas,'nota','notas')} · ${pl(c.cli,'cliente','clientes')}. Clique para ver as notas."><small>${n0(c.v)}</small><i style="height:${Math.max(2,c.v/max*100)}%"></i><span>${c.rot}</span></div>`).join('')}</div></div>`;
}
function renderFaturamento(){
  const box=$('v-faturamento');const L=fatLinhas();
  if(!L){box.innerHTML=esperando('Carregando o faturamento…');carregar('faturamento').then(renderFaturamento).catch(()=>box.innerHTML=esperando('Não foi possível carregar o faturamento.'));return}
  const clientes=[...new Set(L.map(l=>l.destNome))].sort(COLL.compare);
  const cfops=[...new Set(L.map(l=>l.cfop))].sort();
  const vis=ui('fat_vis','notas');
  const cli=ui('fat_cli','todos'),cf=ui('fat_cfop','todos'),tp=ui('fat_tipo','receita'),q=ui('b_fat','');
  const F=L.filter(l=>noPeriodo('fat',l.data)&&(cli==='todos'||l.destNome===cli)&&casa(`${l.nota} ${l.destNome} ${l.cod} ${l.desc} ${l.cfop} ${l.natOp}`,q)&&passaClasse('fat',classeLinha(l.cfop)));
  const soma=(rs,k)=>rs.reduce((a,r)=>a+(+r[k]||0),0);
  const base=L.filter(l=>noPeriodo('fat',l.data)&&(cli==='todos'||l.destNome===cli));
  const rec=soma(base.filter(l=>tipoCfop(l.cfop).t==='Receita'),'total'),outras=soma(base.filter(l=>tipoCfop(l.cfop).t!=='Receita'),'total');
  let dev=null;const je=M.dados.entradas;
  if(je){const C=je.colunas,iC=C.indexOf('Cod. Fiscal'),iT=C.indexOf('Vlr.Total'),iI=C.indexOf('Vlr.IPI'),iD=C.indexOf('DT Emissao'),iDg=C.indexOf('DT Digitacao'),iN=C.indexOf('Nome Fornecedor');
    const pc=cli==='todos'?'':cli.split(/\s+/)[0].toUpperCase();
    dev=je.linhas.filter(r=>{const c=String(r[iC]||'');return '12'.includes(c[0])&&['201','202','410','411'].includes(c.slice(1))&&noPeriodo('fat',String(r[iD]||r[iDg]||'').slice(0,10))&&(!pc||String(r[iN]||'').toUpperCase().includes(pc))}).reduce((a,r)=>a+(+r[iT]||0)+(+r[iI]||0),0)}
  else carregar('entradas').then(()=>{if(M.atual==='faturamento')rerender()}).catch(()=>{});
  let h=`<div class="cards3 fat-kpis"><div class="card-k verde"><span>Faturamento</span><b>${brl0(rec)}</b><small class="muted">CFOPs de receita</small></div><div class="card-k"><span>Devoluções de clientes</span><b>${dev===null?'…':brl0(dev)}</b><small class="muted">Entradas com CFOP x201, x202, x410, x411</small></div><div class="card-k"><span>Faturamento líquido</span><b>${dev===null?'…':brl0(rec-dev)}</b><small class="muted">Faturamento menos devoluções</small></div></div>${grafFat(L.filter(l=>cli==='todos'||l.destNome===cli))}
  <div class="tools filtros">${periodoUI('fat')}${selUI('fat_cli',[['todos','Todos os clientes'],...PRINCIPAIS.map(([k,l])=>[clientes.find(c=>c.includes(k))||k,'★ '+l]),...clientes.map(c=>[c,c])],'Cliente')}${filtroClasseUI('fat')}${buscaUI('fat','Nota, produto, cliente')}</div>
  <div class="tools"><div class="seg" role="group" aria-label="Visão">${[['notas','Notas'],['itens','Itens das notas'],['cliente','Por cliente'],['produto','Por produto'],['mes','Por mês'],['cfop','Por CFOP']].map(([k,l])=>`<button data-fv="${k}" aria-pressed="${vis===k}">${l}</button>`).join('')}</div>
  <span class="small muted">${F.length.toLocaleString('pt-BR')} itens · R$ ${brl(soma(F,'total'))} · Qtd. ${num(soma(F,'q'),3)} · Fonte: Qive, notas emitidas, atualizado em ${dt(M.dados.faturamento.geradoEm.slice(0,10))}</span></div>`;
  const tipoCel=r=>{const t=tipoCfop(r.cfop);return `<span class="pill ${t.cl}" title="${esc(CFOP_DESC[r.cfop]||'')}">${t.t}</span>`};
  if(vis==='notas'){
    /* Notas do período com o cliente de cada uma (pedido do Chai, 23/11/2026). Clicar na nota abre os produtos embaixo, um por vez. */
    const g=new Map();for(const l of F){const o=g.get(l.chave)||{k:l.chave,data:l.data,nota:l.nota,serie:l.serie,cli:l.destNome,cnpj:l.destCnpj,natOp:l.natOp,cfop:l.cfop,total:0,itens:[]};o.total+=l.total;o.itens.push(l);g.set(l.chave,o)}
    const R=[...g.values()];const aberto=ui('fatn_open',()=>new Set());
    const doc=c=>{c=String(c||'');return c.length===14?c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,'$1.$2.$3/$4-$5'):c.length===11?c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/,'$1.$2.$3-$4'):c};
    const cols=[{k:'data',l:'Emissão',f:r=>`<span class="seta">${aberto.has(r.k)?'▾':'›'}</span> ${dt(r.data)}`},{k:'nota',l:'Nota',v:r=>+r.nota||r.nota,cls:()=>'mono',f:r=>esc(String(+r.nota||r.nota))},
      {k:'cli',l:'Cliente',cls:()=>'trunca',f:r=>`<span title="${esc(r.cli)}">${esc(r.cli)}</span><small class="muted fat-doc">${esc(doc(r.cnpj))}</small>`},
      {k:'natOp',l:'Natureza',cls:()=>'trunca',f:r=>`<span class="small" title="${esc(r.natOp)}">${esc(r.natOp)}</span>`},{k:'_t',l:'Tipo',v:r=>tipoCfop(r.cfop).t,f:r=>tipoCel(r)},
      {k:'nItens',l:'Itens',num:1,v:r=>r.itens.length,f:r=>r.itens.length},{k:'total',l:'Valor',num:1,f:r=>brl(r.total)}];
    const det=r=>`<tr><td colspan="${cols.length}" class="detail"><div class="inner"><table><thead><tr><th>Código</th><th>Descrição</th><th>CFOP</th><th class="num">Qtd.</th><th>UM</th><th class="num">Vlr. unit.</th><th class="num">Vlr. total</th></tr></thead><tbody>${r.itens.map(i=>`<tr><td class="mono">${esc(i.cod)}</td><td>${esc(i.desc)}</td><td class="mono" title="${esc(CFOP_DESC[i.cfop]||'')}">${esc(i.cfop)}</td><td class="num">${num(i.q,3)}</td><td>${esc(i.un)}</td><td class="num">${num(i.unit,4)}</td><td class="num">${brl(i.total)}</td></tr>`).join('')}<tr class="tot"><td colspan="6"><b>Total da nota</b></td><td class="num"><b>${brl(r.total)}</b></td></tr></tbody></table></div></td></tr>`;
    h+=tabela('fat_notas',cols,R,{ordem:'data',desc:true,porPagina:50,cls:'compacto fit',vazio:'Nenhuma nota com esse filtro.',
      linha:r=>` data-fatnota="${esc(r.k)}" class="row" tabindex="0" aria-expanded="${aberto.has(r.k)}"`,depois:r=>aberto.has(r.k)?det(r):'',
      total:rs=>`<td colspan="${cols.length-2}"><b>${rs.length.toLocaleString('pt-BR')} nota${rs.length===1?'':'s'}</b></td><td class="num"><b>${rs.reduce((a,r)=>a+r.itens.length,0).toLocaleString('pt-BR')}</b></td><td class="num"><b>${brl(soma(rs,'total'))}</b></td>`});
  }else if(vis==='itens'){
    const FC=[{k:'data',l:'Emissão',f:r=>dt(r.data)},{k:'nota',l:'Nota',cls:()=>'mono'},{k:'destNome',l:'Cliente',oculta:1,cls:()=>'trunca'},
      {k:'cod',l:'Código',cls:()=>'mono'},{k:'desc',l:'Descrição',cls:()=>'trunca',f:r=>`<span title="${esc(r.desc)}">${esc(r.desc)}</span>`},
      {k:'_fin',l:'Financeiro',v:r=>classeLinha(r.cfop).fin,f:r=>SN(classeLinha(r.cfop).fin)},{k:'_est',l:'Estoque',v:r=>classeLinha(r.cfop).est,f:r=>SN(classeLinha(r.cfop).est)},
      {k:'q',l:'Qtd.',num:1,f:r=>num(r.q,3)},{k:'un',l:'UM'},{k:'unit',l:'Vlr. unit.',num:1,f:r=>num(r.unit,4)},{k:'total',l:'Vlr. total',num:1,f:r=>brl(r.total)},
      {k:'imp',l:'Impostos',num:1,oculta:1,v:r=>r.icms+r.ipi+r.pis+r.cofins,f:r=>brl(r.icms+r.ipi+r.pis+r.cofins)},{k:'icms',l:'ICMS',num:1,oculta:1,f:r=>brl(r.icms)},{k:'ipi',l:'IPI',num:1,oculta:1,f:r=>brl(r.ipi)},{k:'pis',l:'PIS',num:1,oculta:1,f:r=>brl(r.pis)},{k:'cofins',l:'COFINS',num:1,oculta:1,f:r=>brl(r.cofins)}];
    const visC=ui('fat_cols2',()=>new Set(FC.filter(c=>!c.oculta).map(c=>c.k)));const cols=FC.filter(c=>visC.has(c.k));const oc=FC.length-cols.length;
    h+=`<div class="tools barra"><span class="cresce"></span><details class="colsel"><summary>Colunas <span class="small muted">${oc} oculta${oc===1?'':'s'}</span></summary><div class="colsel-menu">${FC.filter(c=>c.k!=='cod'&&c.k!=='desc').map(c=>`<label><input type="checkbox" data-fatcol="${c.k}" ${visC.has(c.k)?'checked':''}> ${esc(c.l)}</label>`).join('')}</div></details></div>`;
    const tot={q:soma(F,'q'),total:soma(F,'total'),icms:soma(F,'icms'),ipi:soma(F,'ipi'),pis:soma(F,'pis'),cofins:soma(F,'cofins')};tot.imp=tot.icms+tot.ipi+tot.pis+tot.cofins;
    h+=tabela('fat_itens',cols,F,{ordem:'data',desc:true,cls:'compacto fit',total:()=>cols.map((c,ix)=>ix===0?'<td><b>Total</b></td>':c.k in tot?`<td class="num"><b>${c.k==='q'?num(tot.q,3):brl(tot[c.k])}</b></td>`:'<td></td>').join('')});
  }else{
    const chave={cliente:l=>l.destNome,produto:l=>l.cod+'|'+l.desc+'|'+l.un,mes:l=>l.data.slice(0,7),cfop:l=>l.cfop}[vis];
    const g=new Map();
    for(const l of F){const k=chave(l);const o=g.get(k)||{k,q:0,total:0,imp:0,notas:new Set(),ult:'',clientes:new Set()};o.q+=l.q;o.total+=l.total;o.imp+=l.icms+l.ipi+l.pis+l.cofins;o.notas.add(l.nota);if(l.data>o.ult)o.ult=l.data;o.clientes.add(l.destNome);g.set(k,o)}
    const R=[...g.values()].map(o=>({...o,nNotas:o.notas.size,preco:o.q?o.total/o.q:0,nCli:o.clientes.size}));
    const rot={cliente:'Cliente',produto:'Produto',mes:'Mês',cfop:'CFOP'}[vis];
    const primeira={k:'k',l:rot,f:r=>vis==='produto'?`<span class="mono">${esc(r.k.split('|')[0])}</span> <span class="small">${esc(r.k.split('|')[1])}</span>`:vis==='mes'?esc(r.k.slice(5)+'/'+r.k.slice(0,4)):vis==='cfop'?`<span class="mono">${esc(r.k)}</span> <span class="small">${esc(CFOP_DESC[r.k]||'')}</span> <span class="pill ${tipoCfop(r.k).cl}">${tipoCfop(r.k).t}</span>`:esc(r.k)};
    const cols=[primeira];if(vis==='produto')cols.push({k:'_um',l:'UM',v:r=>r.k.split('|')[2],f:r=>esc(r.k.split('|')[2])});
    cols.push({k:'q',l:'Qtd.',num:1,f:r=>num(r.q,3)},{k:'total',l:'Valor',num:1,f:r=>brl(r.total)},{k:'preco',l:'Preço médio',num:1,f:r=>num(r.preco,4)},{k:'nNotas',l:'Notas',num:1},{k:'ult',l:'Último fat.',f:r=>dt(r.ult)});
    if(vis!=='cliente')cols.push({k:'nCli',l:'Clientes',num:1});
    h+=tabela('fat_'+vis,cols,R,{ordem:vis==='mes'?'k':'total',desc:vis!=='mes',cls:'compacto fit',total:rs=>`<td colspan="${vis==='produto'?2:1}"><b>Total</b></td><td class="num"><b>${num(soma(rs,'q'),3)}</b></td><td class="num"><b>${brl(soma(rs,'total'))}</b></td><td></td><td colspan="${vis!=='cliente'?3:2}"></td>`});
  }
  box.innerHTML=h;
}

/* ---------- Faturamento › Formação de preço: margem de contribuição por produto (modelo da Formação de Preço do Gestão Vaeso, pedido do Chai, 23/11/2026) ----------
   Preço = preço médio faturado no período (CFOPs de receita) ou o preço digitado para simular (formacao/<cod>.precoSim).
   Custo = ficha da Estruturas › Formação de preço: matéria-prima (kg), injeção (roteiro), embalagem e outros insumos.
   Valores que valem só nesta aba (não mudam Custo NF entrada nem Estrutura):
     config/fpvenda.mpKg[<MP>] = R$/kg; config/fpvenda.horaMaq = valor da hora máquina (padrão R$ 70);
     formacao/<cod>.injOv[<peça>] = {cav, ciclo} (peças/hora = cavidades × 3600 ÷ ciclo); formacao/<cod>.embSim = embalagem por peça.
   Industrialização (mais da metade do valor em x124/x125): o material que o cliente envia (entradas x901) sai do custo.
   Impostos e frete: premissas em config/fpvenda. ICMS por dentro do preço; PIS e COFINS sobre (preço − ICMS); frete sobre o preço.
   MC = preço − impostos − custo − frete; MC % sobre o preço. Sem estrutura ou com custo incompleto: fora da MC média.
   Pedidos do Chai (23/11/2026): sem comissão, sem textos explicativos, no máximo 2 casas, % ao lado do valor, tabela inteira numa tela, gaveta lateral. */
const FPV_GRUPOS=[['todos','Todos'],...PRINCIPAIS,['outros','Outros clientes']];
/* Ordem das colunas: código em ordem numérica (9 antes de 10); códigos com letra depois dos numéricos (pedido do Chai, 23/11/2026). */
const fpvNum=c=>/^[\d.\-]+$/.test(c);
function fpvOrdem(a,b){const x=String(a.cod),y=String(b.cod),nx=fpvNum(x),ny=fpvNum(y);
  if(nx&&ny){const d=BigInt(x.replace(/\D/g,'')||0)-BigInt(y.replace(/\D/g,'')||0);return d<0n?-1:d>0n?1:COLL.compare(x,y)}
  if(nx!==ny)return nx?-1:1;return COLL.compare(x,y)}
/* Produtos fora da Formação de preço (pedido do Chai, 23/11/2026). */
const FPV_FORA=new Set(['9090001']);
const vazio=v=>v===undefined||v===null||v==='';
function fpvPrem(){const c=M.fpv||{},d={icms:12,pis:1.65,cofins:7.6,frete:+cfg().fretePct||0,modo:'prem',horaMaq:HORA_MAQ};const o={};for(const k in d)o[k]=vazio(c[k])?d[k]:c[k];o.mpKg=c.mpKg||{};return o}
/* Material do cliente: produtos das entradas com CFOP 1901/2901 (remessa para industrialização). */
function materialCliente(){if(M._fpvCli)return M._fpvCli;const j=M.dados.entradas,s=new Set();if(!j)return s;
  const iC=j.colunas.indexOf('Cod. Fiscal'),iP=j.colunas.indexOf('Produto');for(const r of j.linhas)if(['1901','2901'].includes(String(r[iC])))s.add(String(r[iP]).trim());return M._fpvCli=s}
function fpvLinhas(){
  const g=new Map();
  for(const l of fatLinhas()){if(tipoCfop(l.cfop).t!=='Receita'||!noPeriodo('fpv',l.data)||FPV_FORA.has(String(l.cod)))continue;
    const o=g.get(l.cod)||{cod:l.cod,desc:l.desc,un:l.un,q:0,fat:0,icms:0,pis:0,cofins:0,ind:0,cli:new Map()};
    o.q+=l.q;o.fat+=l.total;o.icms+=l.icms;o.pis+=l.pis;o.cofins+=l.cofins;if(['124','125'].includes(String(l.cfop).slice(1)))o.ind+=l.total;o.cli.set(l.destNome,(o.cli.get(l.destNome)||0)+l.total);g.set(l.cod,o)}
  return [...g.values()].filter(o=>o.q>0&&o.fat>0).map(o=>{const cp=[...o.cli].sort((a,b)=>b[1]-a[1])[0][0];const pr=PRINCIPAIS.find(([k])=>cp.toUpperCase().includes(k));
    return {...o,cliP:cp,grupo:pr?pr[0]:'outros',vae:[...o.cli.keys()].every(ehVaeso),indust:o.ind>o.fat/2}});
}
function fpvCalc(o,p){
  const f=ficha(o.cod,o.vae,o.indust?materialCliente():null),ov=M.form[o.cod]||{};
  let mp=0,ins=0,falta=f.falta;const mps=[],outros=[];
  for(const g of f.grupos)for(const l of g.linhas){
    if(l.um==='KG'){const fixo=l.cl||l.zv,k=p.mpKg[l.mp],alt=!fixo&&!vazio(k);let unit=l.unit;if(alt){if(unit===null)falta--;unit=+k}
      const val=unit===null?null:l.q*unit;mps.push({item:g.item,cod:l.mp,desc:descDe(l.mp),compraKg:custoComp(l.mp)?.v??null,g:l.q*1000,unit,val,cl:l.cl,zv:l.zv,alt});if(val!==null)mp+=val}
    else{outros.push({item:g.item,cod:l.mp,desc:descDe(l.mp),q:l.q,um:l.um||'UN',unit:l.unit,val:l.val,cl:l.cl,zv:l.zv});if(l.val!==null)ins+=l.val}}
  const io=ov.injOv||{};
  const injs=formacao(o.cod,o.vae).inj.filter(r=>r.injeta).map(r=>{const e=io[r.peca]||{};const cav=vazio(e.cav)?r.cav:+e.cav,ciclo=vazio(e.ciclo)?r.ciclo:+e.ciclo,alt=!vazio(e.cav)||!vazio(e.ciclo);
    const ph=alt?(ciclo>0?cav*3600/ciclo:0):r.ph;return {...r,cav,ciclo,ph,alt,custo:ph?r.mult/ph*p.horaMaq:0}});
  const inj=injs.reduce((a,r)=>a+r.custo,0);
  const embSim=!vazio(ov.embSim),emb=embSim?+ov.embSim:f.vEmb;
  const custo=mp+ins+inj+emb;
  const motivos=[];if(f.temE){if(falta>0)motivos.push(falta+' item'+(falta===1?'':'s')+' sem custo');if(!inj)motivos.push('sem roteiro de injeção')}
  const st=!f.temE?'sem':motivos.length?'parcial':'ok';
  const pm=o.fat/o.q,sim=+ov.precoSim||0,preco=sim||pm;
  let icms,pis,cof;
  if(p.modo==='xml'){icms=preco*o.icms/o.fat;pis=preco*o.pis/o.fat;cof=preco*o.cofins/o.fat}
  else{icms=preco*p.icms/100;pis=(preco-icms)*p.pis/100;cof=(preco-icms)*p.cofins/100}
  const imp=icms+pis+cof,liq=preco-imp,frete=preco*p.frete/100,tot=custo+frete,mc=liq-tot;
  /* Outros componentes (itens comprados que não são kg) entram na linha Matéria-prima desde 23/11/2026 (pedido do Chai: sem linha Outros insumos). */
  return {...o,f,mps,outros,mpKgV:mp,mpTot:mp+ins,injs,mp:mp+ins,ins,inj,emb,embCalc:f.vEmb,embSim,custo,st,motivos,pm,sim,preco,icms,pis,cof,imp,liq,frete,tot,mc,mcp:preco?mc/preco:0};
}
function renderFpVenda(){
  const box=$('v-fpvenda');
  if(!fatLinhas()||!M.dados.estruturas||!rotLinhas()||!M.dados.entradas){box.innerHTML=esperando('Carregando faturamento, estruturas, roteiro e entradas…');Promise.all([carregar('faturamento'),carregar('estruturas'),carregar('roteiro'),carregar('entradas')]).then(()=>{if(M.atual==='fpvenda')renderFpVenda()}).catch(()=>box.innerHTML=esperando('Não foi possível carregar os dados.'));return}
  const p=fpvPrem(),gr=ui('fpv_grupo','todos'),q=ui('b_fpv',''),so=ui('fpv_custo','todos'),op=ui('fpv_op','todas'),exp=ui('fpv_exp',()=>new Set());
  const todas=fpvLinhas().map(o=>fpvCalc(o,p));
  const R=todas.filter(r=>(gr==='todos'||r.grupo===gr)&&(so==='todos'||(so==='ok'?r.st==='ok':r.st!=='ok'))&&(op==='todas'||(op==='indust')===r.indust)&&casa(`${r.cod} ${r.desc} ${[...r.cli.keys()].join(' ')}`,q)).sort(fpvOrdem);
  const ok=R.filter(r=>r.st==='ok'),fatOk=ok.reduce((a,r)=>a+r.fat,0),fatT=R.reduce((a,r)=>a+r.fat,0);
  const mcPond=fatOk?ok.reduce((a,r)=>a+r.mcp*r.fat,0)/fatOk:null,mcSimp=ok.length?ok.reduce((a,r)=>a+r.mcp,0)/ok.length:null;
  M._fpvExport=()=>R;
  const pc=v=>isFinite(v)?(v*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1}).replace('-','−')+'%':'–';
  const pc2=v=>(+v||0).toLocaleString('pt-BR',{maximumFractionDigits:2})+'%';
  const v2=v=>Math.abs(+v||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
  /* Preço de venda com 3 casas (pedido do Chai, 23/11/2026); os demais valores com 2. */
  const v3=v=>Math.abs(+v||0).toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
  const cor=v=>v===null?'':v<0?' neg':' pos';
  const pin=(k,l)=>`<label class="fpv-pin"><span>${l}</span><span class="pct-in"><input class="custo" type="text" inputmode="decimal" id="fpvp_${k}" data-fpvprem="${k}" value="${String(p[k]).replace('.',',')}" aria-label="${l} em %"${p.modo==='xml'&&['icms','pis','cofins'].includes(k)?' disabled':''}> %</span></label>`;
  let h=`<div class="tools fpv-topo"><div class="seg" role="group" aria-label="Grupo de clientes">${FPV_GRUPOS.map(([k,l])=>`<button type="button" data-uiset="fpv_grupo" data-v="${k}" aria-pressed="${gr===k}">${esc(l)}</button>`).join('')}</div>
  <span class="cresce"></span><button type="button" class="bt" id="fpvExcel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>Exportar Excel</button><button type="button" class="bt" id="fpvPdf"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/></svg>PDF</button></div>
  <div class="tools filtros">${periodoUI('fpv')}${selUI('fpv_op',[['todas','Venda e industrialização'],['venda','Só venda'],['indust','Só industrialização']],'Operação','todas')}${selUI('fpv_custo',[['todos','Todos'],['ok','Com custo completo'],['falta','Sem custo ou parcial']],'Custo')}${buscaUI('fpv','Produto, código ou cliente')}</div>
  <div class="cards3 fpv-kpis"><div class="card-k verde"><span>MC média ponderada</span><b class="${cor(mcPond)}">${mcPond===null?'–':pc(mcPond)}</b><small class="muted">Pelo faturamento do período · média simples <b>${mcSimp===null?'–':pc(mcSimp)}</b></small></div>
  <div class="card-k"><span>Faturamento do período</span><b>${brl0(fatT)}</b><small class="muted">${esc(perTexto(ui('per_fpv',()=>({}))))} · ${R.length} produto${R.length===1?'':'s'}</small></div>
  <div class="card-k"><span>Produtos com custo completo</span><b>${ok.length} de ${R.length}</b><small class="muted">${brl0(fatOk)} do faturamento entra na MC média</small></div></div>
  <details class="fpv-prem"${ui('fpv_premab',false)?' open':''}><summary>Premissas <span class="small muted">ICMS ${p.modo==='xml'?'das notas':pc2(p.icms)} · PIS ${p.modo==='xml'?'das notas':pc2(p.pis)} · COFINS ${p.modo==='xml'?'das notas':pc2(p.cofins)} · Frete ${pc2(p.frete)} · Hora máquina R$ ${v2(p.horaMaq)}</span></summary>
  <div class="fpv-prem-in"><div class="seg" role="group" aria-label="Impostos">${[['prem','Impostos pelas premissas'],['xml','Impostos das notas (XML)']].map(([k,l])=>`<button type="button" data-fpvmodo="${k}" aria-pressed="${p.modo===k}">${l}</button>`).join('')}</div>
  ${pin('icms','ICMS')}${pin('pis','PIS')}${pin('cofins','COFINS')}${pin('frete','Frete s/ vendas')}</div></details>`;
  if(!R.length){box.innerHTML=h+esperando('Nenhum produto faturado com esse filtro.');return}
  const val=(v,P,o={})=>`<td class="num${o.cls||''}"><span class="fpv-v">${o.neg&&v>0.005?'−':''}${v2(v)}</span><small>${pc(P?v/P:NaN)}</small></td>`;
  const semC=r=>`<td class="num fpv-semc">${r.st==='sem'?'Sem custo':'–'}</td>`;
  const tg=(k,l)=>`<button type="button" class="fpv-tg" data-fpvexp="${k}" aria-expanded="${exp.has(k)}"><i aria-hidden="true">${exp.has(k)?'▾':'▸'}</i>${l}</button>`;
  const lin=(rot,cel,cls='')=>`<tr class="${cls}"><th scope="row" class="fpv-rot">${rot}</th>${R.map(cel).join('')}</tr>`;
  const ini=d=>esc(String(d||'').replace(/[^A-Za-zÀ-ú0-9 ]/g,' ').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase()||'?');
  const status=r=>r.st==='ok'?'':r.st==='sem'?'<span class="pill p-stop">Sem custo</span>':`<span class="pill p-warn" title="${esc(r.motivos.join(' · '))}">Parcial</span>`;
  const qd=ui('fpv_q',null);
  let t=`<div class="fpv-wrap"><table class="fpv"><thead><tr><th class="fpv-rot fpv-canto">Produto</th>${R.map(r=>`<th class="fpv-prod" scope="col"><div class="fpv-cab"><span class="fpv-ic" aria-hidden="true">${ini(r.desc)}</span><b title="${esc(r.desc)}">${esc(r.desc)}</b></div><small class="mono" title="${esc([...r.cli.keys()].join(', '))}">${esc(r.cod)}</small><span class="fpv-tags">${r.indust?'<span class="pill p-info" title="Mais da metade do valor em CFOP x124/x125. O material que o cliente envia (remessa x901) não entra no custo.">Industrialização</span>':''}${status(r)}</span></th>`).join('')}</tr></thead><tbody>`;
  t+=lin('Preço de venda',(r,i)=>`<td class="num fpv-preco"><input class="custo${r.sim?' manual':''}" type="text" inputmode="decimal" id="fpvpr_${i}" data-fpvpreco="${esc(r.cod)}" value="${v3(r.preco)}" title="Preço médio faturado: ${v3(r.pm)} · ${num(r.q,0)} ${esc((r.un||'').toLowerCase())}" aria-label="Preço de venda de ${esc(r.desc)}">${r.sim?`<button type="button" class="fpv-lk" data-fpvlimpa="${esc(r.cod)}" title="Voltar ao preço médio faturado (${v3(r.pm)})" aria-label="Voltar ao preço médio">↺</button>`:''}<small class="fpv-pm" title="Preço médio faturado no período">atual ${v3(r.pm)}</small></td>`,'fpv-l-preco');
  t+=lin(`${tg('imp','(−) Impostos')} <span class="fpv-pp">${p.modo==='xml'?'notas':pc((p.icms+(100-p.icms)*(p.pis+p.cofins)/100)/100)}</span>`,r=>val(r.imp,r.preco,{neg:1}));
  if(exp.has('imp'))t+=lin('ICMS',r=>val(r.icms,r.preco,{neg:1}),'fpv-sub')+lin('PIS',r=>val(r.pis,r.preco,{neg:1}),'fpv-sub')+lin('COFINS',r=>val(r.cof,r.preco,{neg:1}),'fpv-sub');
  t+=lin('(=) Preço líquido',r=>val(r.liq,r.preco),'fpv-forte');
  const clic=(r,k,v)=>r.st==='sem'?semC(r):`<td class="num fpv-clic${qd&&qd.cod===r.cod&&qd.k===k?' on':''}" data-fpvq="${k}|${esc(r.cod)}" role="button" tabindex="0" title="Abrir ${k==='mp'?'a matéria-prima':'o custo de injeção'} deste produto"><span class="fpv-v">${v>0.005?'−':''}${v2(v)}</span><small>${pc(r.preco?v/r.preco:NaN)}</small></td>`;
  t+=lin('Matéria-prima',r=>clic(r,'mp',r.mp));
  t+=lin('Custo injeção',r=>clic(r,'inj',r.inj));
  t+=lin('Embalagem',(r,i)=>r.st==='sem'?semC(r):`<td class="num fpv-preco fpv-emb"><input class="custo${r.embSim?' manual':''}" type="text" inputmode="decimal" id="fpve_${i}" data-fpvemb="${esc(r.cod)}" value="${v2(r.emb)}" title="Calculada pela estrutura: ${v2(r.embCalc)}" aria-label="Embalagem por peça de ${esc(r.desc)}">${r.embSim?`<button type="button" class="fpv-lk" data-fpvembl="${esc(r.cod)}" title="Voltar à embalagem calculada (${v2(r.embCalc)})" aria-label="Voltar à embalagem calculada">↺</button>`:''}<small>${pc(r.preco?r.emb/r.preco:NaN)}</small></td>`);
  t+=lin(`Frete s/ vendas <span class="fpv-pp">${pc2(p.frete)}</span>`,r=>val(r.frete,r.preco,{neg:1}));
  t+=lin('Total custos',r=>r.st==='sem'?semC(r):val(r.tot,r.preco,{neg:1}),'fpv-forte');
  t+=lin('MC',r=>r.st==='sem'?semC(r):`<td class="num fpv-mc${r.mc<0?' neg':' pos'}${r.st==='parcial'?' parcial':''}"${r.st==='parcial'?` title="Custo parcial: ${esc(r.motivos.join(' · '))}"`:''}><span class="fpv-v">${r.mc<-0.005?'−':''}${v2(r.mc)}</span><b>${pc(r.mcp)}</b></td>`,'fpv-l-mc');
  t+='</tbody></table></div>';
  /* Quadro de baixo: todas as matérias-primas com o R$/kg usado aqui e a hora máquina. Vale só nesta aba. */
  const usoMp=new Map();for(const r of R)for(const x of r.mps)if(!x.cl&&!x.zv)usoMp.set(x.cod,(usoMp.get(x.cod)||0)+1);
  const qb=ui('b_fpvmp','');
  const MPs=materiasPrimas().map(c=>({c,d:descDe(c),compra:custoComp(c)?.v??null,alt:p.mpKg[c],n:usoMp.get(c)||0})).filter(x=>casa(`${x.c} ${x.d}`,qb)).sort((a,b)=>b.n-a.n||COLL.compare(a.d,b.d));
  t+=`<div class="fpv-mat"><div class="fpv-mat-cab"><h3>Materiais e hora máquina</h3><label class="busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg><input type="search" id="mb_fpvmp" data-mb="fpvmp" placeholder="Buscar material…" value="${esc(qb)}" aria-label="Buscar material"></label></div>
  <div class="scroll fpv-mat-l"><table class="compacto"><thead><tr><th>Código</th><th>Material</th><th class="num">Última compra R$/kg</th><th class="num">R$/kg na formação</th><th class="num">Produtos na tela</th></tr></thead><tbody>${MPs.map(x=>`<tr><td class="mono">${esc(x.c)}</td><td>${esc(x.d)}</td><td class="num">${x.compra===null?'<span class="txt-stop">sem custo</span>':v2(x.compra)}</td><td class="num"><input class="custo${vazio(x.alt)?'':' manual'}" type="text" inputmode="decimal" id="fpvkg_${esc(x.c)}" data-fpvkg="${esc(x.c)}" value="${vazio(x.alt)?'':v2(x.alt)}" placeholder="${x.compra===null?'preencher':v2(x.compra)}" aria-label="R$ por kg de ${esc(x.d)}"></td><td class="num">${x.n||''}</td></tr>`).join('')||'<tr><td colspan="5" class="empty">Nenhum material com essa busca.</td></tr>'}</tbody></table></div>
  <div class="fpv-hora"><label class="fpv-pin"><span>Valor da hora máquina (todos os itens)</span><span class="pct-in">R$ <input class="custo" type="text" inputmode="decimal" id="fpvp_horaMaq" data-fpvprem="horaMaq" value="${v2(p.horaMaq)}" aria-label="Valor da hora máquina em reais"></span></label></div>
  <p class="small muted">Valores digitados aqui mudam só a Formação de preço. Em branco, vale a última compra.</p></div>`;
  /* Gaveta lateral do produto clicado: matéria-prima ou injeção. */
  const rq=qd&&R.find(r=>r.cod===qd.cod);
  if(rq){const peso=rq.mps.reduce((a,x)=>a+x.g,0);
    const cab=`<div class="fpv-gav-cab"><div><small class="muted">${esc(rq.cod)} · ${qd.k==='mp'?num(peso,1)+' g de matéria-prima':num(rq.injs.length,0)+' processo'+(rq.injs.length===1?'':'s')+' de injeção'}</small><h3>${qd.k==='mp'?'Matéria-prima':'Custo injeção'} · ${esc(rq.desc)}</h3></div><button type="button" class="fpv-x" data-fpvfecha="1" aria-label="Fechar">×</button></div>`;
    let corpo;
    if(qd.k==='mp')corpo=`<div class="scroll"><table class="compacto"><thead><tr><th>Item</th><th>Polímero</th><th class="num">Peso (g)</th><th class="num">R$ por kg</th><th class="num">Total</th></tr></thead><tbody>${rq.mps.length?rq.mps.map((x,i)=>`<tr><td>${esc(x.item)}</td><td>${esc(x.desc)}${x.cl?' <span class="pill p-info" title="Enviado pelo cliente (remessa para industrialização): sem custo">cliente</span>':x.zv?' <span class="pill p-info">Vaeso</span>':x.alt?' <span class="pill p-info" title="R$/kg digitado no quadro Materiais">formação</span>':''}</td><td class="num">${num(x.g,2)}</td><td class="num">${x.cl||x.zv?v2(0):`<input class="custo${x.alt?' manual':''}" type="text" inputmode="decimal" id="fpvgkg_${i}" data-fpvkg="${esc(x.cod)}" value="${x.unit===null?'':v2(x.unit)}" placeholder="${x.compraKg===null?'preencher':v2(x.compraKg)}" title="Vale para todos os produtos desta aba que usam ${esc(x.desc)}. Em branco, volta à última compra." aria-label="R$ por kg de ${esc(x.desc)}">`}</td><td class="num">${x.val===null?'–':v2(x.val)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">Sem matéria-prima em kg na estrutura.</td></tr>'}<tr class="tot"><td colspan="2"><b>Custo de matéria-prima</b></td><td class="num"><b>${num(peso,2)}</b></td><td></td><td class="num"><b>${v2(rq.mpKgV)}</b></td></tr></tbody></table></div>${rq.outros.length?`<h4 class="fpv-gav-sub">Outros componentes</h4><div class="scroll"><table class="compacto"><thead><tr><th>Item</th><th>Componente</th><th class="num">Qtd.</th><th>UM</th><th class="num">R$ por un.</th><th class="num">Total</th></tr></thead><tbody>${rq.outros.map(x=>`<tr><td>${esc(x.item)}</td><td>${esc(x.desc)} <span class="mono small muted">${esc(x.cod)}</span>${x.cl?' <span class="pill p-info" title="Enviado pelo cliente: sem custo">cliente</span>':x.zv?' <span class="pill p-info">Vaeso</span>':''}</td><td class="num">${num(x.q,2)}</td><td>${esc(String(x.um).toLowerCase())}</td><td class="num">${x.unit===null?'<span class="txt-stop">sem custo</span>':v2(x.unit)}</td><td class="num">${x.val===null?'–':v2(x.val)}</td></tr>`).join('')}<tr class="tot"><td colspan="5"><b>Custo dos componentes</b></td><td class="num"><b>${v2(rq.ins)}</b></td></tr></tbody></table></div><div class="fpv-gav-tot"><span>Total da linha Matéria-prima</span><b>${v2(rq.mpTot)}</b></div>`:''}<p class="small muted">O R$ por kg vale para todos os produtos desta aba que usam o material e é o mesmo do quadro Materiais, no fim da tela. Mudar aqui ou lá muda a conta e a margem; Custo NF entrada e Estrutura não mudam.</p>`;
    else{const io=(M.form[rq.cod]||{}).injOv||{};
      corpo=`<div class="scroll"><table class="compacto"><thead><tr><th>Peça</th><th>Molde</th><th class="num">Cavidades</th><th class="num">Ciclo (s)</th><th class="num">Peças/hora</th><th class="num">Qtd.</th><th class="num">Hora máq.</th><th class="num">Custo/peça</th></tr></thead><tbody>${rq.injs.length?rq.injs.map((x,i)=>`<tr><td>${esc(x.desc||x.peca)}<small class="mono muted fpv-blk">${esc(x.peca)}</small></td><td class="mono">${esc(x.molde||'')}</td><td class="num"><input class="custo fpv-in-s${vazio(io[x.peca]?.cav)?'':' manual'}" type="text" inputmode="numeric" id="fpvi_${i}_cav" data-fpvinj="${esc(rq.cod)}|${esc(x.peca)}|cav" value="${num(x.cav,2)}" aria-label="Cavidades de ${esc(x.peca)}"></td><td class="num"><input class="custo fpv-in-s${vazio(io[x.peca]?.ciclo)?'':' manual'}" type="text" inputmode="decimal" id="fpvi_${i}_ciclo" data-fpvinj="${esc(rq.cod)}|${esc(x.peca)}|ciclo" value="${num(x.ciclo,2)}" aria-label="Ciclo em segundos de ${esc(x.peca)}">${x.alt?`<button type="button" class="fpv-lk" data-fpvinjl="${esc(rq.cod)}|${esc(x.peca)}" title="Voltar ao roteiro" aria-label="Voltar ao roteiro">↺</button>`:''}</td><td class="num">${num(x.ph,0)}</td><td class="num">${num(x.mult,2)}</td><td class="num">${v2(p.horaMaq)}</td><td class="num">${v2(x.custo)}</td></tr>`).join(''):'<tr><td colspan="8" class="empty">Sem roteiro de injeção.</td></tr>'}<tr class="tot"><td colspan="7"><b>Custo injeção por produto</b></td><td class="num"><b>${v2(rq.inj)}</b></td></tr></tbody></table></div><p class="small muted">Peças/hora = cavidades × 3.600 ÷ ciclo. Cavidades e ciclo mudados aqui valem só para este produto nesta aba. A hora máquina fica no quadro Materiais, no fim da tela.</p>`}
    t+=`<div class="fpv-fundo" data-fpvfecha="1"></div><aside class="fpv-gav" role="dialog" aria-modal="true" aria-label="${qd.k==='mp'?'Matéria-prima':'Custo injeção'} de ${esc(rq.desc)}">${cab}${corpo}</aside>`}
  box.innerHTML=h+t;
}
function exportaFpv(){const R=M._fpvExport&&M._fpvExport();if(!R)return;
  const C=[['Código',r=>r.cod],['Descrição',r=>r.desc],['Cliente principal',r=>r.cliP],['Operação',r=>r.indust?'Industrialização':'Venda'],['Situação do custo',r=>r.st==='ok'?'Completo':r.st==='sem'?'Sem custo':'Parcial: '+r.motivos.join(', ')],['Qtd. período',r=>r.q],['Faturamento período',r=>r.fat],['Preço médio',r=>({n:r.pm,d:3})],['Preço de venda',r=>({n:r.preco,d:3})],['ICMS',r=>r.icms],['PIS',r=>r.pis],['COFINS',r=>r.cof],['Impostos',r=>r.imp],['Preço líquido',r=>r.liq],['Matéria-prima (total da linha)',r=>r.mpTot],['dos quais matéria-prima em kg',r=>r.mpKgV],['dos quais outros componentes',r=>r.ins],['Custo injeção',r=>r.inj],['Embalagem',r=>r.emb],['Custo do produto',r=>r.custo],['Frete',r=>r.frete],['Total custos',r=>r.tot],['MC R$',r=>r.st==='sem'?'':r.mc],['MC %',r=>r.st==='sem'?'':Math.round(r.mcp*1000)/10]];
  const cel=v=>v&&typeof v==='object'?v.n.toFixed(v.d).replace('.',','):typeof v==='number'?String(Math.round(v*100)/100).replace('.',','):'"'+String(v??'').replace(/"/g,'""')+'"';
  const lin=[C.map(c=>c[0]).join(';'),...R.map(r=>C.map(c=>cel(c[1](r))).join(';'))];
  baixaCsv('formacao-preco-mc.csv',String.fromCharCode(65279)+lin.join(String.fromCharCode(13,10)))}

/* ---------- Classificação: fornecedores e CFOP ---------- */
/* Cada fornecedor e cada CFOP recebe "gera financeiro" e "movimenta estoque" (sim/não). Fica na coleção classif. */
const SUF_ENT={'101':'Compra para industrialização','102':'Compra para comercialização','124':'Industrialização efetuada por outra empresa','201':'Devolução de venda de produção','202':'Devolução de venda de mercadoria','352':'Aquisição de serviço de transporte (indústria)','353':'Aquisição de serviço de transporte (comércio)','401':'Compra para industrialização com ST','403':'Compra para comercialização com ST','406':'Compra de ativo imobilizado com ST','407':'Compra de uso e consumo com ST','551':'Compra de ativo imobilizado','556':'Compra de material de uso e consumo','653':'Compra de combustível para consumo','901':'Entrada para industrialização por encomenda','902':'Retorno de mercadoria remetida para industrialização','903':'Entrada de mercadoria remetida e não aplicada','908':'Entrada de bem em comodato','910':'Entrada em bonificação, doação ou brinde','912':'Entrada para demonstração','915':'Entrada para conserto ou reparo','916':'Retorno de mercadoria remetida para conserto','922':'Lançamento de simples faturamento (entrega futura)','933':'Aquisição de serviço tributado pelo ISSQN','949':'Outra entrada não especificada'};
const SUF_SAI={'101':'Venda de produção do estabelecimento','102':'Venda de mercadoria adquirida','124':'Industrialização efetuada para outra empresa','125':'Industrialização para outra empresa (sem trânsito)','201':'Devolução de compra para industrialização','202':'Devolução de compra para comercialização','401':'Venda de produção com ST','403':'Venda de mercadoria com ST','405':'Venda de mercadoria com ST (substituído)','556':'Devolução de compra de uso e consumo','901':'Remessa para industrialização por encomenda','902':'Retorno de mercadoria usada na industrialização','903':'Retorno de mercadoria recebida e não aplicada','910':'Remessa em bonificação, doação ou brinde','912':'Remessa para demonstração','913':'Retorno de demonstração','915':'Remessa para conserto ou reparo','916':'Retorno de conserto ou reparo','949':'Outra saída não especificada'};
function descCfop(c){c=String(c||'');if(CFOP_DESC[c])return CFOP_DESC[c];const s=c.slice(1);const ent='123'.includes(c[0]);const d=(ent?SUF_ENT:SUF_SAI)[s];return d?d+(c[0]==='2'||c[0]==='6'?' (fora do estado)':c[0]==='3'||c[0]==='7'?' (exterior)':''):''}
const cls=(tipo,id)=>M.classif[tipo+'_'+id]||{};
/* Linha: vale a classificação do CFOP; sem ela, a do fornecedor. */
/* Fornecedor: vale a escolha manual; sem ela, a dos CFOPs que ele usa, se todos concordam. Se discordam, fica "diverge" até o usuário escolher. */
function classeForn(k){
  const man=cls('forn',k);const f=(M.dados.fornecedores||[]).find(x=>x.k===k);const out={};
  for(const campo of ['fin','est']){
    if(man[campo]){out[campo]=man[campo];out[campo+'Src']='manual';continue}
    const vs=new Set((f?f.cfops:[]).map(c=>cls('cfop',c)[campo]||''));
    if(vs.size===1&&!vs.has('')){out[campo]=[...vs][0];out[campo+'Src']='cfop'}
    else{out[campo]='';out[campo+'Src']=vs.size>1&&[...vs].some(Boolean)?'diverge':''}
  }
  return out;
}
function classeLinha(cfop,forn){const c=cls('cfop',cfop),f=forn?classeForn(forn):{};return {fin:c.fin||f.fin||'',est:c.est||f.est||''}}
const SN=v=>v==='sim'?'<span class="pill p-done">Sim</span>':v==='nao'?'<span class="pill p-open">Não</span>':'<span class="muted">–</span>';
function filtroClasseUI(k){const d=k==='forn'?[]:[];return selUI(k+'_fin',[['todos','Todos'],['sim','Gera financeiro'],['nao','Não gera financeiro'],...d,['sem','Sem classificação']],'Financeiro')+selUI(k+'_est',[['todos','Todos'],['sim','Movimenta estoque'],['nao','Não movimenta estoque'],...d,['sem','Sem classificação']],'Estoque')}
/* Produtos: caixas "Gera financeiro" e "Movimenta estoque", marcadas por padrão; marcada = só itens com "sim". */
function chkClasseUI(k){return ['fin','est'].map(c=>`<label class="chk-cls"><input type="checkbox" data-uichk="${k}_${c}chk" ${ui(k+'_'+c+'chk',true)?'checked':''}> ${c==='fin'?'Gera financeiro':'Movimenta estoque'}</label>`).join('')}
function passaChk(k,c){return (!ui(k+'_finchk',true)||c.fin==='sim')&&(!ui(k+'_estchk',true)||c.est==='sim')}
function passaClasse(k,c){const f=ui(k+'_fin','todos'),e=ui(k+'_est','todos');const ok=(v,x,src)=>v==='todos'||(v==='div'?src==='diverge':v==='sem'?!x:x===v);return ok(f,c.fin,c.finSrc)&&ok(e,c.est,c.estSrc)}
function selClasse(tipo,id,campo){const v=cls(tipo,id)[campo]||'';return `<select class="clsel ${v}" data-cls="${tipo}" data-id="${esc(id)}" data-campo="${campo}" aria-label="${campo==='fin'?'Gera financeiro':'Movimenta estoque'}"><option value="" ${!v?'selected':''}>–</option><option value="sim" ${v==='sim'?'selected':''}>Sim</option><option value="nao" ${v==='nao'?'selected':''}>Não</option></select>`}
function celForn(r,campo){
  const src=r[campo+'Src'],v=r[campo];
  if(src==='cfop')return `<span title="Pelos CFOPs do fornecedor">${SN(v)}</span>`;
  if(src==='diverge')return `<span class="pill p-info" title="Cada nota segue a classificação do seu CFOP">Por CFOP</span>`;
  return selClasse('forn',r.k,campo);
}
function linhasFornCfop(){
  const nomes=new Map((M.dados.fornecedores||[]).map(f=>[f.k,f.nome]));const g=new Map();
  for(const n of notasEntrada()){const fk=n.forn||'';if(!fk&&!n.nome)continue;
    for(const i of n.itens){const k=(fk||n.nome)+'|'+i.cfop;let o=g.get(k);
      if(!o){o={k,forn:fk,nome:nomes.get(fk)||n.nome||'',cfop:i.cfop,n:0,total:0,notas:new Set(),ultima:''};g.set(k,o)}
      o.n++;o.total+=i.total;o.notas.add(n.k);if(n.emissao>o.ultima)o.ultima=n.emissao}}
  const R=[...g.values()];const tot=new Map();for(const r of R){const fk=r.forn||r.nome;tot.set(fk,(tot.get(fk)||0)+r.total)}
  const nC=new Map();for(const r of R){const fk=r.forn||r.nome;nC.set(fk,(nC.get(fk)||0)+1)}
  return R.map(r=>{const c=cls('cfop',r.cfop),fk=r.forn||r.nome;return {...r,nNotas:r.notas.size,gTot:tot.get(fk),nCfop:nC.get(fk),cat:c.cat||'',fin:c.fin||'',est:c.est||''}});
}
function renderForn(){
  const box=$('v-forn');
  if(!M.dados.fornecedores||!M.dados.entradas){box.innerHTML=esperando('Carregando os fornecedores…');Promise.all([carregar('fornecedores'),carregar('entradas')]).then(renderForn).catch(()=>box.innerHTML=esperando('Não foi possível carregar os fornecedores.'));return}
  const q=ui('b_forn',''),catF=ui('forn_cat','todos');
  const todas=linhasFornCfop();
  const R=todas.filter(r=>casa(`${r.forn} ${r.nome} ${r.cfop} ${descCfop(r.cfop)}`,q)&&passaClasse('forn',r)&&(catF==='todos'||(catF==='sem'?!r.cat:r.cat===catF)));
  const nForn=new Set(todas.map(r=>r.forn||r.nome)).size,semCat=todas.filter(r=>!r.cat).length;
  box.innerHTML=`<div class="tools filtros">${buscaUI('forn','Código, nome ou CFOP')}${selUI('forn_cat',[['todos','Todas'],...categorias().map(c=>[c,c]),['sem','Sem classificação']],'Classificação')}${filtroClasseUI('forn')}</div><p class="small muted">${nForn} fornecedores em ${todas.length} linhas: uma por CFOP usado. A classificação, o financeiro e o estoque vêm do CFOP; ${semCat} linha${semCat===1?'':'s'} com CFOP sem classificação. Clique em "classificar" para abrir o CFOP.</p>`+
  tabela('forn',[{k:'forn',l:'Código',cls:()=>'mono'},{k:'nome',l:'Fornecedor',cls:()=>'trunca',f:r=>`<span title="${esc(r.nome)}">${r.nome?esc(r.nome):'<span class="muted">Sem nome</span>'}</span>${r.nCfop>1?` <span class="small muted">· ${r.nCfop} CFOPs</span>`:''}`},
    {k:'cfop',l:'CFOP',cls:()=>'mono'},{k:'_d',l:'Descrição do CFOP',cls:()=>'trunca',v:r=>descCfop(r.cfop),f:r=>`<span title="${esc(descCfop(r.cfop))}">${esc(descCfop(r.cfop)||'–')}</span>`},
    {k:'nNotas',l:'Notas',num:1},{k:'total',l:'Valor',num:1,v:r=>r.gTot+r.total/1e9,f:r=>brl(r.total)},{k:'ultima',l:'Última',f:r=>dt(r.ultima)},
    {k:'cat',l:'Classificação',f:r=>r.cat?`<span class="pill cat-pill" style="--cc:${corCat(r.cat)}">${esc(r.cat)}</span>`:`<button class="lnk" data-ircfop="${esc(r.cfop)}">classificar</button>`},
    {k:'fin',l:'Financeiro',f:r=>SN(r.fin)},{k:'est',l:'Estoque',f:r=>SN(r.est)}],R,{ordem:'total',desc:true,cls:'compacto fit',porPagina:100});
}
function cfopsTodos(){
  const m=new Map();const add=(c,o,v)=>{if(!c)return;const x=m.get(c)||{c,ent:0,sai:0,vEnt:0,vSai:0};x[o]++;x[o==='ent'?'vEnt':'vSai']+=+v||0;m.set(c,x)};
  for(const l of fatLinhas()||[])add(l.cfop,'sai',l.total);
  const j=M.dados.entradas;if(j){const iC=j.colunas.indexOf('Cod. Fiscal'),iT=j.colunas.indexOf('Vlr.Total');for(const r of j.linhas)add(r[0]==='Qive'?cfopEntrada(r[iC]):String(r[iC]||''),'ent',r[iT])}
  return [...m.values()];
}
function renderCfop(){
  const box=$('v-cfop');
  if(!fatLinhas()||!M.dados.entradas){box.innerHTML=esperando('Carregando os CFOPs…');Promise.all([carregar('faturamento'),carregar('entradas')]).then(renderCfop).catch(()=>box.innerHTML=esperando('Não foi possível carregar os CFOPs.'));return}
  const q=ui('b_cfop',''),lado=ui('cfop_lado','Entrada');
  const all=cfopsTodos();
  const R=all.map(x=>({...x,desc:descCfop(x.c),lado:'123'.includes(x.c[0])?'Entrada':'Saída',n:x.ent+x.sai,valor:x.vEnt+x.vSai,tipo:'123'.includes(x.c[0])?'':tipoCfop(x.c).t,fin:cls('cfop',x.c).fin||'',est:cls('cfop',x.c).est||''})).filter(r=>r.lado===lado&&casa(`${r.c} ${r.desc}`,q)&&passaClasse('cfop',r));
  const feitos=all.filter(x=>cls('cfop',x.c).fin||cls('cfop',x.c).est).length;
  const nLado=l=>all.filter(x=>('123'.includes(x.c[0])?'Entrada':'Saída')===l).length;
  box.innerHTML=`<nav class="nfa-tabs cfop-abas" aria-label="Tipo de CFOP">${[['Entrada','CFOP de entrada'],['Saída','CFOP de saída']].map(([k,l])=>`<button data-uiset="cfop_lado" data-v="${k}" aria-pressed="${lado===k}">${l} <span class="small">${nLado(k)}</span></button>`).join('')}</nav><div class="tools filtros">${buscaUI('cfop','CFOP ou descrição')}${filtroClasseUI('cfop')}<span class="cresce"></span><label class="campo"><span>Nova classificação</span><input id="novaCat" placeholder="Ex.: Manutenção" maxlength="40"></label><button class="bt" data-novacat="1">+ Criar</button></div><p class="small muted">${feitos} de ${all.length} com financeiro ou estoque. ${all.filter(x=>cls('cfop',x.c).cat).length} com classificação. Os fornecedores puxam a classificação dos CFOPs que usam.</p>`+
  tabela('cfop',[{k:'c',l:'CFOP',cls:()=>'mono'},{k:'desc',l:'Descrição',cls:()=>'trunca',f:r=>r.desc?esc(r.desc):'<span class="muted">Sem descrição cadastrada</span>'},...(lado==='Saída'?[{k:'tipo',l:'Tipo',f:r=>r.tipo?`<span class="pill ${tipoCfop(r.c).cl}">${r.tipo}</span>`:''}]:[]),{k:'n',l:'Itens',num:1},{k:'valor',l:'Valor',num:1,f:r=>brl(r.valor)},{k:'cat',l:'Classificação',v:r=>cls('cfop',r.c).cat||'',f:r=>selCat(r.c,'cfop')},{k:'fin',l:'Financeiro',f:r=>selClasse('cfop',r.c,'fin')},{k:'est',l:'Estoque',f:r=>selClasse('cfop',r.c,'est')}],R,{ordem:'n',desc:true,cls:'compacto fit'});
}

/* ---------- Cadastros: clientes e produtos ---------- */
function renderClientes(){
  const box=$('v-clientes');const L=fatLinhas();
  if(!L){box.innerHTML=esperando('Carregando os clientes…');carregar('faturamento').then(renderClientes).catch(()=>box.innerHTML=esperando('Não foi possível carregar os clientes.'));return}
  const q=ui('b_cli','');
  const porCli=new Map();
  for(const l of L){if(!noPeriodo('cli',l.data))continue;const o=porCli.get(l.destNome)||{nome:l.destNome,cnpj:l.destCnpj,receita:0,retorno:0,outras:0,notas:new Set(),prods:new Set(),primeiro:l.data,ultimo:l.data};
    const t=tipoCfop(l.cfop).t;if(t==='Receita')o.receita+=l.total;else if(t==='Retorno')o.retorno+=l.total;else o.outras+=l.total;
    o.notas.add(l.nota);o.prods.add(l.cod);if(l.data<o.primeiro)o.primeiro=l.data;if(l.data>o.ultimo)o.ultimo=l.data;porCli.set(l.destNome,o)}
  const ehP=n=>PRINCIPAIS.some(([k])=>n.includes(k));
  const R=[...porCli.values()].map(o=>({...o,nNotas:o.notas.size,nProd:o.prods.size,principal:ehP(o.nome)?1:0})).filter(r=>casa(`${r.nome} ${r.cnpj}`,q));
  box.innerHTML=`<div class="tools filtros">${periodoUI('cli')}${buscaUI('cli','Nome ou CNPJ')}</div>`+
  tabela('cli',[{k:'principal',l:'',v:r=>r.principal,f:r=>r.principal?'<span title="Cliente principal">★</span>':''},{k:'nome',l:'Cliente',cls:()=>'trunca',f:r=>`<span title="${esc(r.nome)}">${esc(r.nome)}</span>`},{k:'cnpj',l:'CNPJ',cls:()=>'mono'},{k:'receita',l:'Receita',num:1,f:r=>brl(r.receita)},{k:'retorno',l:'Retorno',num:1,f:r=>r.retorno?brl(r.retorno):'<span class="muted">–</span>'},{k:'outras',l:'Outras saídas',num:1,f:r=>r.outras?brl(r.outras):'<span class="muted">–</span>'},{k:'nNotas',l:'Notas',num:1},{k:'nProd',l:'Produtos',num:1},{k:'primeiro',l:'Primeiro',f:r=>dt(r.primeiro)},{k:'ultimo',l:'Último',f:r=>dt(r.ultimo)}],R,{ordem:'receita',desc:true,cls:'compacto fit'});
}
function renderProdutos(){
  const box=$('v-produtos');const L=fatLinhas();
  if(!L||!M.dados.estruturas){box.innerHTML=esperando('Carregando os produtos…');Promise.all([carregar('faturamento'),carregar('estruturas')]).then(renderProdutos).catch(()=>box.innerHTML=esperando('Não foi possível carregar os produtos.'));return}
  const aba=ui('prod_aba','saidas');const abas=`<nav class="nfa-tabs cfop-abas" aria-label="Tipo de produto">${[['saidas','Saídas (faturamento)'],['entradas','Entradas (compras)']].map(([k,l])=>`<button data-uiset="prod_aba" data-v="${k}" aria-pressed="${aba===k}">${l}</button>`).join('')}</nav>`;
  if(aba==='entradas'){renderProdEntradas(box,abas);return}
  const E=M.dados.estruturas;
  const cfops=[...new Set(L.map(l=>l.cfop))].sort();const clientes=[...new Set(L.map(l=>l.destNome))].sort(COLL.compare);
  const cf=ui('prod_cfop','todos'),cli=ui('prod_cli','todos'),q=ui('b_prod','');
  const g=new Map();
  for(const l of L){if(!noPeriodo('prod',l.data)||(cf!=='todos'&&l.cfop!==cf)||(cli!=='todos'&&l.destNome!==cli)||!passaChk('prod',classeLinha(l.cfop)))continue;
    const o=g.get(l.cod)||{cod:l.cod,desc:l.desc,un:l.un,ncm:l.ncm,cfops:new Set(),clientes:new Set(),q:0,total:0,notas:new Set(),ultimo:''};
    o.cfops.add(l.cfop);o.clientes.add(l.destNome);o.q+=l.q;o.total+=l.total;o.notas.add(l.nota);if(l.data>o.ultimo)o.ultimo=l.data;g.set(l.cod,o)}
  const R=[...g.values()].map(o=>({...o,cfopTxt:[...o.cfops].sort().join(', '),cliTxt:[...o.clientes].sort(COLL.compare).join(', '),preco:o.q?o.total/o.q:0,nNotas:o.notas.size,estrutura:E.arvore[o.cod]?'Sim':'Não'})).filter(r=>casa(`${r.cod} ${r.desc} ${r.ncm} ${r.cliTxt}`,q));
  box.innerHTML=abas+`<div class="tools filtros">${periodoUI('prod')}${selUI('prod_cfop',[['todos','Todos os CFOPs'],...cfops.map(c=>[c,c+' · '+(descCfop(c)||tipoCfop(c).t)])],'CFOP')}${selUI('prod_cli',[['todos','Todos os clientes'],...clientes.map(c=>[c,c])],'Cliente')}${buscaUI('prod','Código, descrição, NCM ou cliente')}${chkClasseUI('prod')}</div>`+
  tabela('prod',[{k:'cod',l:'Código',cls:()=>'mono'},{k:'desc',l:'Descrição',cls:()=>'trunca',f:r=>`<span title="${esc(r.desc)}">${esc(r.desc)}</span>`},{k:'un',l:'UM'},{k:'cliTxt',l:'Cliente',cls:()=>'estreita',f:r=>`<span title="${esc(r.cliTxt)}">${esc(r.cliTxt)}</span>`},{k:'q',l:'Qtde',num:1,f:r=>num(r.q,0)},{k:'preco',l:'Preço',num:1,f:r=>num(r.preco,2)},{k:'total',l:'Valor',num:1,f:r=>brl(r.total)},{k:'ultimo',l:'Último',f:r=>dt(r.ultimo)}],R,{ordem:'total',desc:true,cls:'compacto fit'});
}

/* ---------- Entradas: NF-e ---------- */
/* ---------- Entradas: análise de NF-e, CT-e e NFS-e ---------- */
/* Classificação do fornecedor (categoria) fica em classif/forn_<código>.cat. A lista de categorias fica em config/categorias. */
const CAT_PADRAO=['Matéria-prima','Industrialização','Fretes','Prestador Serviço','Embalagem','Imobilizado em andamento','Uso e consumo','Telefonia'];
const categorias=()=>(M.cats&&M.cats.length)?M.cats:CAT_PADRAO;
const SEM_CAT='Sem classificação',DEMAIS='Demais categorias';
const corCat=c=>{const i=categorias().indexOf(c);return i>=0&&i<8?`var(--c${i+1})`:c===SEM_CAT?'var(--c-sem)':'var(--c0)'};
const n0=v=>Math.round(+v||0).toLocaleString('pt-BR');
const mesTxt=m=>MESES[+m.slice(5,7)-1]+'/'+m.slice(0,4);
function tipoDocLinha(cfop,tes){const s=String(cfop||'').slice(1);if(s==='352'||s==='353')return 'CT-e';if(s==='933'||String(tes)==='91'||String(tes)==='091')return 'NFS-e';return 'NF-e'}
function selCat(k,tipo='forn'){const v=cls(tipo,k).cat||'';return `<select class="clsel cat" data-cls="${tipo}" data-id="${esc(k)}" data-campo="cat" aria-label="Classificação"><option value="" ${!v?'selected':''}>–</option>${categorias().map(c=>`<option ${v===c?'selected':''}>${esc(c)}</option>`).join('')}</select>`}
/* Notas agrupadas: planilha do Protheus e Qive (NF-e) mais CT-e e NFS-e do Qive que não estão na planilha. */
/* No XML do Qive o CFOP é o de saída do fornecedor (5xxx/6xxx/7xxx). Para classificar a entrada, troca o primeiro dígito (5901 vira 1901). */
const cfopEntrada=c=>{c=String(c||'');return /^[567]\d{3}$/.test(c)?String(+c[0]-4)+c.slice(1):c};
function baseEntradas(){
  if(M._nfBase)return M._nfBase;
  const j=M.dados.entradas,C=j.colunas,ix=n=>C.indexOf(n);
  const I={doc:ix('Documento'),forn:ix('Forn/Cliente'),nome:ix('Nome Fornecedor'),em:ix('DT Emissao'),dig:ix('DT Digitacao'),cf:ix('Cod. Fiscal'),tes:ix('Tipo Entrada'),tot:ix('Vlr.Total'),ipi:ix('Vlr.IPI'),prod:ix('Produto'),desc:ix('Desc.Produto'),un:ix('Unidade'),q:ix('Quantidade'),unit:ix('Vlr.Unitario'),serie:ix('Serie')};
  const g=new Map();
  for(const r of j.linhas){
    const doc=String(r[I.doc]||'').padStart(9,'0'),forn=String(r[I.forn]||''),k=doc+'|'+(forn||r[I.nome]);
    let n=g.get(k);
    if(!n){n={k,doc,serie:String(r[I.serie]||''),forn,nome:r[I.nome]||'',emissao:String(r[I.em]||r[I.dig]||'').slice(0,10),origem:r[0],tipo:tipoDocLinha(r[I.cf],r[I.tes]),itens:[],valor:0};g.set(k,n)}
    const v=(+r[I.tot]||0)+(+r[I.ipi]||0);n.valor+=v;
    const cx=String(r[I.cf]||'');n.itens.push({prod:String(r[I.prod]??''),desc:r[I.desc]||'',un:r[I.un]||'',q:+r[I.q]||0,unit:+r[I.unit]||0,total:v,cfop:cfopEntrada(cx),cfopXml:cx});
  }
  M._nfBase=[...g.values()];return M._nfBase;
}
function notasEntrada(){
  const base=baseEntradas();const vistos=new Set(base.map(n=>n.doc+'|'+n.forn));const out=[...base];
  for(const n of (typeof S!=='undefined'&&S.notasTodas)||[]){
    if(n.tipo==='NF-e'||n.cancelada||!n.emissao)continue;
    const doc=String(n.doc||'').padStart(9,'0');if(n.forn&&vistos.has(doc+'|'+n.forn))continue;
    const cf=String(cfopInfo(n).v||'').split(',')[0].trim();
    const it=itensDe(n);
    out.push({k:'q'+n.seq,doc,serie:n.serie||'',forn:n.forn||'',nome:n.nome||'',emissao:n.emissao,origem:'Qive',tipo:n.tipo,valor:+n.valorTotal||0,
      itens:it.length?it.map(i=>({prod:i.prod||'',desc:i.desc||i.xmlDesc||'',un:i.um||'',q:+i.q||0,unit:+i.unit||0,total:+i.total||0,cfop:String(i.cfop||cf||'')})):[{prod:'',desc:n.natOp||'',un:'',q:1,unit:+n.valorTotal||0,total:+n.valorTotal||0,cfop:cf}]});
  }
  return out;
}
/* Categoria da nota: a do fornecedor. Sem ela, CT-e entra como Fretes e NFS-e como Prestador Serviço. */
/* Classificação do item: a do CFOP; sem ela, a do fornecedor; sem as duas, CT-e é Fretes e NFS-e é Prestador Serviço. */
function catItem(i,n){const c=cls('cfop',i.cfop).cat||(n.forn?cls('forn',n.forn).cat:'');if(c)return c;if(n.tipo==='CT-e'&&categorias().includes('Fretes'))return 'Fretes';if(n.tipo==='NFS-e'&&categorias().includes('Prestador Serviço'))return 'Prestador Serviço';return SEM_CAT}
function catsNota(n){const m=new Map();for(const i of n.itens){const c=catItem(i,n);m.set(c,(m.get(c)||0)+i.total)}return [...m.entries()].sort((a,b)=>b[1]-a[1])}
function catNota(n){const cs=catsNota(n);return {c:cs.length?cs[0][0]:SEM_CAT,todas:cs.map(x=>x[0])}}
/* Financeiro e estoque da nota pelos CFOPs dos itens: Sim, Não ou Parcial. */
function fe(n,campo){const vs=new Set(n.itens.map(i=>classeLinha(i.cfop,n.forn)[campo]||''));if(vs.size===1)return [...vs][0];return vs.has('sim')?'parcial':''}
const valorCampo=(n,campo)=>n.itens.reduce((a,i)=>a+(classeLinha(i.cfop,n.forn)[campo]==='sim'?i.total:0),0);
const SNP=v=>v==='parcial'?'<span class="pill p-ready" title="Parte dos itens">Parcial</span>':SN(v);
function renderNfe(){
  const box=$('v-nfe');const j=M.dados.entradas;
  if(!j){box.innerHTML=esperando('Carregando as entradas…');carregar('entradas').then(renderNfe).catch(()=>box.innerHTML=esperando('Não foi possível carregar as entradas.'));return}
  const todas=notasEntrada();
  const meses=[...new Set(todas.map(n=>n.emissao.slice(0,7)).filter(m=>/^\d{4}-\d{2}$/.test(m)))].sort().reverse();
  const aba=ui('nfa_aba','todas'),mes=ui('nfa_mes',meses[0]||''),catF=ui('nfa_cat','todos'),finF=ui('nfa_fin','todos'),q=ui('b_nfa','');
  const dTipo=n=>aba==='todas'||n.tipo===aba;
  const passa=n=>{if(catF!=='todos'&&!catsNota(n).some(([c])=>c===catF))return false;const f=fe(n,'fin');if(finF==='sim'&&!(f==='sim'||f==='parcial'))return false;if(finF==='nao'&&f!=='nao')return false;return true};
  const doMes=m=>todas.filter(n=>(mes==='ano'?n.emissao.slice(0,4)===m:n.emissao.slice(0,7)===m)&&dTipo(n)&&passa(n));
  const F=doMes(mes==='ano'?String(new Date().getFullYear()):mes);
  const ant=mes&&mes!=='ano'?(()=>{const d=new Date(+mes.slice(0,4),+mes.slice(5,7)-2,1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')})():null;
  const A=ant?doMes(ant):null;
  const soma=L=>L.reduce((a,n)=>a+n.valor,0);
  const tot=soma(F),vFin=F.reduce((a,n)=>a+valorCampo(n,'fin'),0),vEst=F.reduce((a,n)=>a+valorCampo(n,'est'),0);
  const nFin=F.filter(n=>['sim','parcial'].includes(fe(n,'fin'))).length,nEst=F.filter(n=>['sim','parcial'].includes(fe(n,'est'))).length;
  const semC=F.filter(n=>catsNota(n).some(([c])=>c===SEM_CAT)),vSem=F.reduce((a,n)=>a+(catsNota(n).find(([c])=>c===SEM_CAT)?.[1]||0),0);
  const varia=(a,b)=>{if(!b)return '';const p=(a-b)/b*100;return `<span class="${p>=0?'up':'down'}">${p>=0?'↑':'↓'} ${Math.abs(p).toFixed(0)}%</span> vs. anterior`};
  const pct=(a,b)=>b?Math.round(a/b*100)+'%':'0%';
  const abas=[['todas','Análise de Entradas'],['NF-e','NF-e'],['CT-e','CT-e'],['NFS-e','NFS-e']];
  let h=`<div class="nfa-topo"><nav class="nfa-tabs" aria-label="Tipo de documento">${abas.map(([k,l])=>`<button data-uiset="nfa_aba" data-v="${k}" aria-pressed="${aba===k}">${l}</button>`).join('')}</nav>
  <label class="per-sel">Período <select data-mf="nfa_mes">${[...meses.map(m=>[m,mesTxt(m)]),['ano','Ano '+new Date().getFullYear()]].map(([v,l])=>`<option value="${v}" ${mes===v?'selected':''}>${l}</option>`).join('')}</select></label></div>
  <div class="tools filtros">${selUI('nfa_cat',[['todos','Todas'],...categorias().map(c=>[c,c]),[SEM_CAT,SEM_CAT]],'Classificação')}${selUI('nfa_fin',[['todos','Gera e não gera'],['sim','Gera financeiro'],['nao','Não gera financeiro']],'Financeiro')}</div>
  <div class="nfa-kpis">
    <div class="nfa-kpi"><span>Notas de entrada</span><b>${F.length}</b><small>${A?varia(F.length,A.length):''}</small></div>
    <div class="nfa-kpi"><span>Total de NF</span><b>${brl0(tot)}</b><small>${A?varia(tot,soma(A)):''}</small></div>
    <div class="nfa-kpi"><span>Com financeiro</span><b>${brl0(vFin)}</b><small class="ok">${nFin} notas · ${pct(vFin,tot)}</small></div>
    <div class="nfa-kpi"><span>Movimentam estoque</span><b>${brl0(vEst)}</b><small class="ok">${nEst} notas · ${pct(vEst,tot)}</small></div>
    <div class="nfa-kpi"><span>Sem classificação</span><b>${semC.length}</b><small class="warn">${brl0(vSem)}${semC.length?' · revisar':''}</small></div>
  </div>`;
  /* Valor por categoria: até 8 categorias da lista com cor própria; as demais juntas. */
  const g=new Map();
  for(const n of F){const vistos=new Set();for(let [c,v] of catsNota(n)){const i=categorias().indexOf(c);if(c!==SEM_CAT&&(i<0||i>=8))c=DEMAIS;const o=g.get(c)||{c,v:0,n:0};o.v+=v;if(!vistos.has(c)){o.n++;vistos.add(c)}g.set(c,o)}}
  const G=[...g.values()].sort((a,b)=>b.v-a.v);const max=Math.max(1,...G.map(x=>x.v));
  const curto=c=>({'Matéria-prima':'MP','Industrialização':'Ind.','Prestador Serviço':'Serv.','Embalagem':'Emb.','Imobilizado em andamento':'Imob. and.','Uso e consumo':'Uso cons.','Telefonia':'Telef.','Sem classificação':'Sem class.','Demais categorias':'Demais'})[c]||c;
  const barras=G.filter(x=>x.c!==SEM_CAT);
  h+=`<div class="nfa-graf"><div class="nfa-painel"><h3>Valor por classificação</h3>${barras.length?`<div class="nfa-barras" role="img" aria-label="Valor por classificação">${barras.map(x=>`<div class="nfa-bar" tabindex="0" title="${esc(x.c)}: R$ ${brl(x.v)} · ${x.n} nota${x.n>1?'s':''}"><small>${n0(x.v)}</small><i style="height:${Math.max(2,x.v/max*100)}%;background:${corCat(x.c)}"></i><span>${esc(curto(x.c))}</span></div>`).join('')}</div>`:esperando('Nenhuma nota classificada no período.')}</div>`;
  /* Rosca: fatias com 2px de espaço entre elas. */
  let ang=0;const R=70,r0=48,arcos=[];
  const pt=(a,rr)=>[100+rr*Math.sin(a),100-rr*Math.cos(a)];
  for(const x of G){const a=x.v/(tot||1)*Math.PI*2;if(a<=0)continue;const gap=G.length>1?0.02:0;const a0=ang+gap/2,a1=ang+a-gap/2;ang+=a;if(a1<=a0)continue;
    const big=a1-a0>Math.PI?1:0;const [x0,y0]=pt(a0,R),[x1,y1]=pt(a1,R),[x2,y2]=pt(a1,r0),[x3,y3]=pt(a0,r0);
    arcos.push(G.length===1?`<circle cx="100" cy="100" r="${(R+r0)/2}" fill="none" stroke="${corCat(x.c)}" stroke-width="${R-r0}"><title>${esc(x.c)}: R$ ${brl(x.v)}</title></circle>`:`<path d="M${x0},${y0}A${R},${R} 0 ${big} 1 ${x1},${y1}L${x2},${y2}A${r0},${r0} 0 ${big} 0 ${x3},${y3}Z" fill="${corCat(x.c)}"><title>${esc(x.c)}: R$ ${brl(x.v)} (${pct(x.v,tot)})</title></path>`)}
  h+=`<div class="nfa-painel"><h3>Distribuição por classificação</h3><div class="nfa-rosca"><svg viewBox="0 0 200 200" role="img" aria-label="Distribuição do valor por classificação">${arcos.join('')}<text x="100" y="98" text-anchor="middle" class="r-v">${brl0(tot)}</text><text x="100" y="116" text-anchor="middle" class="r-l">valor total</text></svg>
  <table class="nfa-leg"><tbody>${G.map(x=>`<tr><td><i style="background:${corCat(x.c)}"></i>${esc(x.c)}</td><td class="num"><b>${brl0(x.v)}</b></td><td class="num muted">${pct(x.v,tot)}</td></tr>`).join('')}</tbody></table></div></div></div>`;
  /* Cartões por categoria */
  h+=`<div class="nfa-cats">${G.map(x=>`<button class="nfa-cat" style="--cc:${corCat(x.c)}" data-uiset="nfa_cat" data-v="${esc(catF===x.c?'todos':x.c)}" aria-pressed="${catF===x.c}"><span>${esc(x.c)}</span><b class="${x.c===SEM_CAT?'warn':''}">${brl0(x.v)}</b><small>${x.n} nota${x.n>1?'s':''}</small></button>`).join('')}</div>`;
  /* Lista de notas */
  const L=F.filter(n=>casa(`${n.doc} ${n.nome} ${n.forn}`,q));
  M._nfaExport=()=>L;
  const aberto=ui('nfa_open',()=>new Set());
  h+=`<div class="nfa-lista"><div class="tools barra"><h3>Notas fiscais de entrada <span class="pill p-done">${L.length} registros</span></h3><span class="cresce"></span>${buscaUI('nfa','Buscar nota ou fornecedor')}<button class="bt" id="nfaExport">Exportar</button></div>`+
  tabela('nfa',[{k:'doc',l:'Nº NF',f:r=>`<span class="seta">${aberto.has(r.k)?'▾':'›'}</span> ${esc(String(+r.doc||r.doc))}`},{k:'emissao',l:'Emissão',f:r=>dt(r.emissao)},{k:'tipo',l:'Tipo',f:r=>`<span class="tag">${esc(r.tipo)}</span>`},{k:'nome',l:'Fornecedor',cls:()=>'trunca',f:r=>`<span title="${esc(r.forn)}">${esc(r.nome||r.forn)}</span>`},{k:'valor',l:'Valor total',num:1,f:r=>'R$ '+brl(r.valor)},{k:'_c',l:'Classificação',v:r=>catNota(r).c,f:r=>{const c=catNota(r);return `<span class="pill cat-pill" style="--cc:${corCat(c.c)}" title="${esc(c.todas.join(', '))}">${esc(c.c)}${c.todas.length>1?' +'+(c.todas.length-1):''}</span>`}},{k:'_f',l:'Financeiro',v:r=>fe(r,'fin'),f:r=>SNP(fe(r,'fin'))},{k:'_e',l:'Estoque',v:r=>fe(r,'est'),f:r=>SNP(fe(r,'est'))}],L,{ordem:'emissao',desc:true,porPagina:50,cls:'compacto fit',linha:r=>` data-nfopen="${esc(r.k)}" class="row" tabindex="0" aria-expanded="${aberto.has(r.k)}"`,depois:r=>aberto.has(r.k)?`<tr><td colspan="8" class="detail"><div class="inner"><table><thead><tr><th>Produto</th><th>Descrição</th><th class="num">Qtde.</th><th>UM</th><th class="num">Unit.</th><th class="num">Total</th><th>CFOP</th><th>Classificação</th><th>Financeiro</th><th>Estoque</th></tr></thead><tbody>${r.itens.map(i=>{const c=classeLinha(i.cfop,r.forn);return `<tr><td class="mono">${esc(i.prod)}</td><td>${esc(i.desc)}</td><td class="num">${num(i.q,2)}</td><td>${esc(i.un)}</td><td class="num">${num(i.unit,2)}</td><td class="num">${brl(i.total)}</td><td class="mono" title="${esc(descCfop(i.cfop))}${i.cfopXml&&i.cfopXml!==i.cfop?' · No XML: '+esc(i.cfopXml):''}">${esc(i.cfop)}</td><td>${esc(catItem(i,r))}</td><td>${SN(c.fin)}</td><td>${SN(c.est)}</td></tr>`}).join('')}</tbody></table></div></td></tr>`:''})+'</div>';
  box.innerHTML=h;
}
function exportaNfa(){const L=M._nfaExport&&M._nfaExport();if(!L)return;
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',n2=v=>String(Math.round(v*100)/100).replace('.',',');
  const lin=['Nº NF;Série;Emissão;Tipo;Código;Fornecedor;Valor total;Classificação;Financeiro;Estoque',...L.map(n=>[q(n.doc),q(n.serie),q(n.emissao),q(n.tipo),q(n.forn),q(n.nome),n2(n.valor),q(catNota(n).todas.join(', ')),q(fe(n,'fin')),q(fe(n,'est'))].join(';'))];
  baixaCsv('notas-de-entrada-'+ui('nfa_mes','')+'.csv',String.fromCharCode(65279)+lin.join(String.fromCharCode(13,10)));
}

/* ---------- Home: painel de controle ---------- */
const ICH={forn:'<path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/>',ent:'<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',fat:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',pend:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>'};
const haQuanto=iso=>{const ms=Date.now()-new Date(iso).getTime();if(!(ms>=0))return '';const m=Math.round(ms/60000);if(m<60)return 'há '+Math.max(1,m)+' min';const h=Math.round(m/60);if(h<24)return 'há '+h+' h';const d=Math.round(h/24);return d===1?'ontem':'há '+d+' dias'};
const dCurta=iso=>{const d=new Date(iso);return isNaN(d)?'':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}).replace(/\./g,'').replace(/ de /g,' ')};
function renderHome(){
  const box=$('v-home');
  const falta=['fornecedores','entradas','faturamento'].filter(k=>!M.dados[k]);
  if(falta.length){box.innerHTML=esperando('Carregando o painel…');Promise.all(falta.map(carregar)).then(()=>{if(M.atual==='home')renderHome()}).catch(()=>box.innerHTML=esperando('Não foi possível carregar o painel.'));return}
  const hoje=new Date(),mes=hoje.toISOString().slice(0,7),dAnt=new Date(hoje.getFullYear(),hoje.getMonth()-1,1),ant=dAnt.getFullYear()+'-'+String(dAnt.getMonth()+1).padStart(2,'0');
  const varia=(a,b)=>{if(!b)return '<span class="muted">sem base no mês anterior</span>';const p=(a-b)/b*100;return `<span class="${p>=0?'up':'down'}">${p>=0?'↑':'↓'} ${Math.abs(p).toFixed(1).replace('.',',')}%</span> em relação ao mês anterior`};
  const F=M.dados.fornecedores,classif=F.filter(f=>cls('forn',f.k).cat).length;
  const NE=notasEntrada(),eM=NE.filter(n=>n.emissao.slice(0,7)===mes).length,eA=NE.filter(n=>n.emissao.slice(0,7)===ant).length;
  const L=fatLinhas()||[],rec=m=>L.filter(l=>l.data.slice(0,7)===m&&tipoCfop(l.cfop).t==='Receita').reduce((a,l)=>a+l.total,0),fM=rec(mes),fA=rec(ant);
  const notas=(typeof S!=='undefined'&&S.notas)||[],pend=notas.filter(n=>n.status==='em_aberto'||n.status==='pronta').length,prontas=notas.filter(n=>n.status==='pronta').length;
  const fatTxt=v=>v>=1e6?'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi':v>=1e3?'R$ '+Math.round(v/1e3).toLocaleString('pt-BR')+' mil':'R$ '+Math.round(v).toLocaleString('pt-BR');
  const kpi=(ic,t,v,sub,href)=>`<button class="home-kpi" data-ir="${href}"><span class="cab">${t}<span class="ico"><svg viewBox="0 0 24 24" aria-hidden="true">${ICH[ic]}</svg></span></span><b>${v}</b><small>${sub}</small></button>`;
  let h=`<div class="home-banner"><div><span class="olho">Sistema PKS · Gestão</span><h3>Uma visão clara do seu negócio.</h3><p>Entradas, faturamento, estruturas e contabilidade em um só lugar.</p></div><button class="bt-red" data-ir="forn">Acessar cadastros →</button></div>
  <div class="home-kpis">${kpi('forn','Fornecedores cadastrados',F.length.toLocaleString('pt-BR'),`<span class="up">${classif}</span> com classificação`,'forn')}${kpi('ent','Entradas no mês',eM.toLocaleString('pt-BR'),varia(eM,eA),'nfe')}${kpi('fat','Faturamento no mês',fatTxt(fM),varia(fM,fA),'faturamento')}${kpi('pend','Notas para lançar',pend,pend?`<span class="at">● ${prontas} pronta${prontas===1?'':'s'}, ${pend-prontas} em aberto</span>`:'Nenhuma pendente','notas')}</div>`;
  /* Atualizações recentes de classificação */
  const nomeF=new Map(F.map(f=>[f.k,f.nome]));
  const up=Object.entries(M.classif).filter(([,d])=>d.em).sort((a,b)=>String(b[1].em).localeCompare(String(a[1].em))).slice(0,5);
  const linhaUp=([id,d])=>{const [tipo,cod]=[id.slice(0,id.indexOf('_')),id.slice(id.indexOf('_')+1)];const nome=tipo==='forn'?(nomeF.get(cod)||'Fornecedor '+cod):(descCfop(cod)||'CFOP '+cod);const ok=(d.fin&&d.est)||d.cat;
    return `<tr><td class="mono">${esc(cod)}</td><td class="trunca">${esc(nome)}</td><td>${tipo==='forn'?'Fornecedor':'CFOP'}</td><td>${dCurta(d.em)}</td><td><span class="st-pill ${ok?'red':''}">${ok?'Atualizado':'Revisar'}</span></td></tr>`};
  h+=`<div class="home-duo"><div><h3>Classificações recentes <a href="#forn">Ver todos →</a></h3><div class="home-card">${up.length?`<table class="compacto"><thead><tr><th>Código</th><th>Nome</th><th>Cadastro</th><th>Última atualização</th><th>Status</th></tr></thead><tbody>${up.map(linhaUp).join('')}</tbody></table>`:'<p class="small muted">Nenhuma classificação feita ainda.</p>'}</div></div>`;
  /* Atividade recente das notas */
  const ST={lancada:'Nota lançada',pronta:'Nota pronta para lançar',em_aberto:'Nova entrada registrada'};
  const at=((typeof S!=='undefined'&&S.notasTodas)||[]).filter(n=>n.statusEm&&ST[n.status]).sort((a,b)=>String(b.statusEm).localeCompare(String(a.statusEm))).slice(0,4);
  h+=`<div><h3>Atividade recente <a href="#lancadas">Ver histórico →</a></h3><div class="home-card">${at.length?`<ul class="ativ">${at.map(n=>`<li><div><b>${ST[n.status]}</b><span>${esc(n.nome||'')} · ${esc(n.tipo||'')} ${esc(String(+n.doc||n.doc||''))}</span></div><time datetime="${esc(n.statusEm)}" title="${esc(dCurta(n.statusEm))}">${haQuanto(n.statusEm)}</time></li>`).join('')}</ul>`:'<p class="small muted">Nenhuma atividade registrada.</p>'}</div></div></div>
  <div class="home-rod"><span>Sistema PKS</span><span>Gestão com clareza</span></div>`;
  box.innerHTML=h;
}

/* ---------- Estruturas: formação de preço ---------- */
/* Para cada produto faturado: insumos (da estrutura do produto), injeção (roteiro: cavidades, ciclo, peças/hora) e embalagem. */
const np=v=>brl(v);
const EMB_RE=/^\s*(CAIXA|CX\b|SACO|SACOLA|FILME|ETIQUETA|CANTONEIRA|FITA|PAPEL[AÃ]O|EMBALAGEM|COLMEIA|DIVISOR|PALLET|PL[AÁ]STICO BOLHA|STRETCH)/i;
function formacao(cod,vae){
  const E=M.dados.estruturas;const ls=E.arvore[cod]?arvoreLinhas(cod,0,1,[],new Set([cod]),vae):[];
  const folhas=ls.filter(l=>!l.temE).map(l=>({comp:l.comp,desc:l.desc,q:l.q*l.mult,unit:l.custo,falta:l.falta,zv:l.zv,c:l.c}));
  const ins=folhas.filter(f=>!EMB_RE.test(f.desc)),emb=folhas.filter(f=>EMB_RE.test(f.desc));
  const pecas=[{cod,mult:1,desc:E.produtos[cod]?.desc||''},...ls.filter(l=>l.temE).map(l=>({cod:l.comp,mult:l.q*l.mult,desc:l.desc}))];
  const inj=[];for(const p of pecas)for(const r of (rotLinhas()||[]))if(String(r.Produto)===String(p.cod)){const injeta=/INJE/i.test(r.Descricao||'')&&r.pecasHora;const h=injeta?p.mult/r.pecasHora:0;inj.push({peca:p.cod,desc:p.desc,mult:p.mult,molde:r.Ferramenta,op:r['Descr. Oper.'],cav:r.CAVIDADES,ciclo:r.CICLO,ph:r.pecasHora,h,custo:h*HORA_MAQ,injeta})}
  const soma=(L,f)=>L.reduce((a,x)=>a+f(x),0);
  const vIns=soma(ins,f=>f.unit===null?0:f.q*f.unit),vEmb=soma(emb,f=>f.unit===null?0:f.q*f.unit),vInj=soma(inj,r=>r.custo);
  return {ins,emb,inj,vIns,vEmb,vInj,custo:vIns+vEmb+vInj,falta:soma(folhas,f=>f.falta?1:0),temE:!!E.arvore[cod],temR:inj.some(r=>r.injeta)};
}
function linhasFormacao(){
  const L=fatLinhas();const g=new Map();
  for(const l of L){if(!l.data.startsWith(String(ano))||tipoCfop(l.cfop).t!=='Receita')continue;
    const o=g.get(l.cod)||{cod:l.cod,desc:l.desc,un:l.un,cli:new Set(),q:0,total:0,imp:0};o.q+=l.q;o.total+=l.total;o.imp+=l.icms+l.pis+l.cofins;o.cli.add(l.destNome);g.set(l.cod,o)}
  return [...g.values()];
}
/* ---------- Formação de preço: ficha por produto (matéria-prima, processo e embalagem) ---------- */
/* Escolhas do usuário por produto ficam na coleção formacao: {mp:{linha:código}, pcsCx, cxsPallet, tipo}. */
const CAIXA_RE=/^\s*(CAIXA|CX\b|SACO|SACOLA)/i;
const injetora=d=>{const m=String(d||'').match(/(\d+)\s*T(ON)?\b/i);return m?m[1]+'T':''};
const umDe=c=>String(M.dados.estruturas.custos[c]?.um||'').toUpperCase();
const descDe=c=>M.dados.estruturas.descricoes[c]||M.dados.estruturas.produtos[c]?.desc||c;
function materiasPrimas(){if(M._mps)return M._mps;const E=M.dados.estruturas;const s=new Set();for(const a of Object.values(E.arvore))for(const [c] of a)if(!E.arvore[c]&&umDe(c)==='KG')s.add(c);M._mps=[...s].sort((a,b)=>COLL.compare(descDe(a),descDe(b)));return M._mps}
function caixasTodas(){if(M._cxs)return M._cxs;const E=M.dados.estruturas;const s=new Set();for(const a of Object.values(E.arvore))for(const [c] of a)if(CAIXA_RE.test(descDe(c)))s.add(c);M._cxs=[...s].sort((a,b)=>COLL.compare(descDe(a),descDe(b)));return M._cxs}
function procDe(cod){const r=(rotLinhas()||[]).find(r=>String(r.Produto)===String(cod)&&/INJE/i.test(r.Descricao||''));return r?{cav:r.CAVIDADES,ciclo:r.CICLO,ph:r.pecasHora,inj:injetora(r.Descricao),molde:r.Ferramenta}:null}
/* cl: códigos que o cliente envia (remessa x901); na industrialização entram com custo zero e não abrem a estrutura. */
function ficha(cod,vae,cl=null){
  const E=M.dados.estruturas,ov=M.form[cod]||{},mpOv=ov.mp||{};const doCli=c=>!!cl&&cl.has(String(c));
  const custo=c=>{if(doCli(c))return {v:0,cl:true};if(vae&&zeraVaeso(c))return {v:0,zv:true};const k=custoComp(c);return k?{v:k.v}:{v:null}};
  const folhas=(c,mult,vis,acc)=>{for(const [x,q,pr] of E.arvore[c]||[]){const qq=q*(1+(pr||0)/100)*mult;if(E.arvore[x]&&!vis.has(x)&&!doCli(x)){const nv=new Set(vis);nv.add(x);folhas(x,qq,nv,acc)}else acc.push({c:x,q:qq})}return acc};
  const grupos=[],emb=[],soltas=[];
  for(const [x,q,pr] of E.arvore[cod]||[]){const qq=q*(1+(pr||0)/100);
    if(E.arvore[x]&&!doCli(x))grupos.push({item:descDe(x),cod:x,proc:procDe(x),linhas:folhas(x,qq,new Set([cod,x]),[])});
    else if(EMB_RE.test(descDe(x)))emb.push({c:x,q:qq});
    else soltas.push({c:x,q:qq})}
  if(soltas.length){const pp=procDe(cod);if(pp&&!grupos.length)grupos.unshift({item:descDe(cod),cod,proc:pp,linhas:soltas});else for(const s of soltas)grupos.push({item:descDe(s.c),cod:s.c,proc:null,linhas:[s]})}
  let mp=0,peso=0,falta=0;
  for(const g of grupos)for(const l of g.linhas){l.key=g.cod+'>'+l.c;l.mp=mpOv[l.key]||l.c;l.um=umDe(l.mp)||umDe(l.c)||(l.q<0.1?'KG':'');const k=custo(l.mp);l.unit=k.v;l.zv=k.zv;l.cl=k.cl;l.val=k.v===null?null:l.q*k.v;if(k.v===null)falta++;else mp+=l.val;if(l.um==='KG')peso+=l.q*1000}
  /* Embalagem: caixa (ou saco) define peças por caixa; os outros itens entram pelo custo da estrutura. */
  const cxE=emb.find(e=>CAIXA_RE.test(descDe(e.c)));const tipo=ov.tipo||cxE?.c||'';
  const pcsCx=+ov.pcsCx||(cxE&&cxE.q?Math.round(1/cxE.q):0),cxsPallet=+ov.cxsPallet||0;
  let vEmb=0;if(tipo&&pcsCx){const k=custo(tipo);if(k.v!==null)vEmb+=k.v/pcsCx}
  for(const e of emb)if(e!==cxE){const k=custo(e.c);if(k.v!==null)vEmb+=e.q*k.v}
  const vInj=horasPorPeca(cod)*HORA_MAQ;
  return {grupos,emb,tipo,pcsCx,cxsPallet,pcsPallet:pcsCx&&cxsPallet?pcsCx*cxsPallet:0,mp,peso,falta,vEmb,vInj,cmv:mp+vInj+vEmb,n:grupos.reduce((a,g)=>a+g.linhas.length,0),temE:!!E.arvore[cod]};
}
function renderFormacao(){
  const box=$('v-formacao');
  if(!fatLinhas()||!M.dados.estruturas||!rotLinhas()){box.innerHTML=esperando('Carregando a formação de preço…');Promise.all([carregar('faturamento'),carregar('estruturas'),carregar('roteiro')]).then(renderFormacao).catch(()=>box.innerHTML=esperando('Não foi possível carregar a formação de preço.'));return}
  const q=ui('b_fp',''),cliF=ui('fp_cli','todos'),so=ui('fp_estr','com');
  const com=(+cfg().comissaoPct||0)/100,fre=(+cfg().fretePct||0)/100;
  const base=linhasFormacao();const clientes=[...new Set(base.flatMap(o=>[...o.cli]))].sort(COLL.compare);
  const E=M.dados.estruturas;
  const R=base.filter(o=>(cliF==='todos'||o.cli.has(cliF))&&(so==='todos'||(so==='com'?!!E.arvore[o.cod]:!E.arvore[o.cod]))&&casa(`${o.cod} ${o.desc} ${[...o.cli].join(' ')}`,q)).sort((a,b)=>b.q-a.q);
  const st=ui('tb_fp',()=>({pag:0})),por=20,pags=Math.max(1,Math.ceil(R.length/por));if(st.pag>=pags)st.pag=pags-1;
  const vis=R.slice(st.pag*por,st.pag*por+por);const aberto=ui('fp_open',()=>new Set());
  let h=`<div class="tools filtros">${selUI('fp_cli',[['todos','Todos os clientes'],...clientes.map(c=>[c,c])],'Cliente')}${selUI('fp_estr',[['com','Com estrutura'],['sem','Sem estrutura'],['todos','Todos']],'Estrutura','com')}${buscaUI('fp','Produto, descrição ou cliente')}</div>
<div class="fp-lista">`;
  for(const o of vis){
    const vae=ehVaeso(cliF)||[...o.cli].every(ehVaeso);const f=ficha(o.cod,vae);const ab=aberto.has(o.cod);
    const preco=o.q?o.total/o.q:0,impP=o.total?o.imp/o.total:0,mAt=preco?(preco*(1-impP-com-fre)-f.cmv)/preco:null;
    const prim=[...new Set([...o.cli].map(c=>c.split(/[\s,.\/-]+/)[0]))].join(', ');
    h+=`<div class="fp-card${ab?' aberto':''}"><div class="fp-cab" data-fpopen="${esc(o.cod)}" role="button" tabindex="0" aria-expanded="${ab}"><span class="seta">${ab?'▾':'›'}</span><span class="fp-nome" title="${esc(o.desc)}">${esc(o.desc)}<small class="mono">${esc(o.cod)}</small></span>
      <span class="pill p-open">${f.temE?f.n+' componente'+(f.n===1?'':'s'):'sem estrutura'}</span><span class="pill fp-cli" title="${esc([...o.cli].join(', '))}">${esc(prim)}</span>${f.falta?`<span class="pill p-stop" title="Itens sem custo">${f.falta} sem custo</span>`:''}${vae?'<span class="pill p-info" title="Caixa e master sem custo">Vaeso</span>':''}
      <span class="cresce"></span>
      <button class="bt fp-bt" data-fpest="${esc(o.cod)}">Nome e custos</button></div>${ab?fichaHTML(o.cod,f):''}</div>`;
  }
  h+='</div>';
  if(pags>1)h+=`<div class="tools pagin"><button class="act" data-mp="fp" data-dir="-1" ${st.pag===0?'disabled':''}>Anterior</button><span class="small muted">Página ${st.pag+1} de ${pags} · ${R.length} produtos</span><button class="act" data-mp="fp" data-dir="1" ${st.pag>=pags-1?'disabled':''}>Próxima</button></div>`;
  box.innerHTML=h;
}
function fichaHTML(cod,f){
  if(!f.temE)return `<div class="fp-vazio small muted">Produto sem estrutura cadastrada. Cadastre a estrutura para montar a ficha.</div>`;
  const mps=materiasPrimas(),cxs=caixasTodas(),total=f.n;
  const n2=v=>v===null?'<span class="txt-stop">sem custo</span>':num(v,2),dash='<span class="muted">·</span>';
  let rows='',first=true;
  for(const g of f.grupos)g.linhas.forEach((l,i)=>{
    const kg=l.um==='KG';
    const sel=kg?`<select class="fp-sel" data-fpmp="${esc(cod)}" data-key="${esc(l.key)}" title="${esc(descDe(l.mp))}" aria-label="Matéria-prima">${(mps.includes(l.mp)?mps:[l.mp,...mps]).map(c=>`<option value="${esc(c)}" ${c===l.mp?'selected':''}>${esc(descDe(c))}</option>`).join('')}</select>`:`<span class="fp-mpnome" title="${esc(descDe(l.c))}">${esc(descDe(l.c))}</span>`;
    const proc=i===0?(g.proc?`<td class="fp-p num" rowspan="${g.linhas.length}">${num(g.proc.cav,0)}</td><td class="fp-p num" rowspan="${g.linhas.length}">${num(g.proc.ciclo,0)}</td><td class="fp-p num" rowspan="${g.linhas.length}">${g.proc.ph?num(g.proc.ph,0):'–'}</td><td class="fp-p" rowspan="${g.linhas.length}" title="Molde ${esc(g.proc.molde||'')}">${esc(g.proc.inj||'–')}</td>`:`<td class="fp-p num" rowspan="${g.linhas.length}">${dash}</td><td class="fp-p num" rowspan="${g.linhas.length}">${dash}</td><td class="fp-p num" rowspan="${g.linhas.length}">${dash}</td><td class="fp-p" rowspan="${g.linhas.length}">${dash}</td>`):'';
    const embC=first?`<td class="fp-e num" rowspan="${total}"><input class="fp-in" type="number" min="1" step="1" data-fpf="${esc(cod)}" data-campo="pcsCx" value="${f.pcsCx||''}" aria-label="Peças por caixa"></td><td class="fp-e num" rowspan="${total}"><b>${f.pcsPallet||'–'}</b></td><td class="fp-e num" rowspan="${total}"><input class="fp-in" type="number" min="1" step="1" data-fpf="${esc(cod)}" data-campo="cxsPallet" value="${f.cxsPallet||''}" placeholder="–" aria-label="Caixas por pallet"></td><td class="fp-e" rowspan="${total}"><select class="fp-sel" data-fpf="${esc(cod)}" data-campo="tipo" aria-label="Tipo de caixa"><option value="">–</option>${cxs.map(c=>`<option value="${esc(c)}" ${c===f.tipo?'selected':''}>${esc(descDe(c))}</option>`).join('')}</select></td>`:'';
    first=false;
    rows+=`<tr>${i===0?`<td class="fp-item" rowspan="${g.linhas.length}" title="${esc(g.cod)}">${esc(g.item)}</td>`:''}<td class="fp-m">${sel}</td><td class="fp-m num">${kg?num(l.q*1000,l.q*1000<1?2:l.q*1000<10?1:0):num(l.q,l.q<1?4:0)+' '+esc((l.um||'un').toLowerCase())}</td><td class="fp-m num">${l.unit===null?'–':np(l.unit)}${l.zv?' <span class="pill p-info">Vaeso</span>':kg?' <span class="tag">MP</span>':''}</td><td class="fp-m num mono">${l.val===null?n2(null):num(l.val,4)}</td>${proc}${embC}</tr>`;
  });
  return `<div class="fp-ficha"><table><thead><tr class="fp-g"><th></th><th colspan="4" class="fp-m">Matéria-prima</th><th colspan="4" class="fp-p">Processo <span>da ficha de moldes</span></th><th colspan="4" class="fp-e">Embalagem</th></tr>
  <tr><th>Item</th><th class="fp-m">MP</th><th class="fp-m num">Peso (g)</th><th class="fp-m num">Valor/kg</th><th class="fp-m num">Custo MP</th><th class="fp-p num">Cavid.</th><th class="fp-p num">Ciclo (s)</th><th class="fp-p num">Peças/h</th><th class="fp-p">Injetora</th><th class="fp-e num">Pçs/cx</th><th class="fp-e num">Pçs/pallet</th><th class="fp-e num">Cxs/pallet</th><th class="fp-e">Tipo de caixa</th></tr></thead>
  <tbody>${rows}<tr class="fp-tot"><td colspan="2">Total do produto</td><td class="num">${num(f.peso,0)}</td><td></td><td class="num mono">${num(f.mp,4)}</td><td colspan="4" class="num">${np(f.vInj)}</td><td colspan="4" class="num">${np(f.vEmb)}</td></tr></tbody></table></div>`;
}
async function salvaFicha(cod,patch,msg='Ficha salva.'){
  const atual={...(M.form[cod]||{}),...patch,em:new Date().toISOString()};M.form[cod]=atual;rerender();
  if(!S.db){toast('Sem conexão com a base. A alteração não foi salva.');return}
  try{await S.db.doc('formacao/'+String(cod).replace(/[^A-Za-z0-9_:.-]/g,'-')).set(atual);toast(msg)}catch{toast('Não foi salvo. Tente novamente.')}
}

/* Fecha a gaveta lateral da Formação de preço e devolve o foco à célula clicada. */
function fpvFecha(){M.ui.fpv_q=null;rerender();const v=M._fpvVolta;if(v)document.querySelector(`td[data-fpvq="${CSS.escape(v)}"]`)?.focus()}
/* Premissas da Faturamento › Formação de preço (config/fpvenda). */
async function salvaFpv(patch){
  const atual={...(M.fpv||{}),...patch,em:new Date().toISOString()};M.fpv=atual;rerender();
  if(!S.db){toast('Sem conexão com a base. A premissa não foi salva.');return}
  try{await S.db.doc('config/fpvenda').set(atual);toast('Premissa salva.')}catch{toast('A premissa não foi salva. Tente novamente.')}
}
document.addEventListener('toggle',e=>{if(e.target.classList?.contains('fpv-prem'))M.ui.fpv_premab=e.target.open},true);

/* ---------- Cadastros: produtos de entrada (comprados) ---------- */
/* Entradas: itens comprados que não são faturados e itens da estrutura sem compra no ano.
   O usuário completa UM, classificação, fornecedor e custo destes últimos; fica em custos/<código> e o custo entra na estrutura. */
function renderProdEntradas(box,abas){
  const j=M.dados.entradas,E=M.dados.estruturas;
  if(!j||!E){box.innerHTML=abas+esperando('Carregando as entradas…');Promise.all([carregar('entradas'),carregar('estruturas')]).then(()=>renderProdutos()).catch(()=>box.innerHTML=abas+esperando('Não foi possível carregar as entradas.'));return}
  const fat=new Set((fatLinhas()||[]).map(l=>String(l.cod))),CP=clientesPorProduto(),ano=String(new Date().getFullYear());
  const C=j.colunas,ix=n=>C.indexOf(n),I={p:ix('Produto'),d:ix('Desc.Produto'),u:ix('Unidade'),q:ix('Quantidade'),un:ix('Vlr.Unitario'),t:ix('Vlr.Total'),cf:ix('Cod. Fiscal'),f:ix('Nome Fornecedor'),fc:ix('Forn/Cliente'),e:ix('DT Emissao'),g:ix('DT Digitacao'),cc:ix('C Contabil')};
  const q=ui('b_prode',''),cli=ui('prode_cli','todos'),sit=ui('prode_sit','todos'),g=new Map(),comprou=new Set();
  for(const r of j.linhas){if(r[0]!=='Protheus')continue;const cod=String(r[I.p]??'').trim();if(!cod||fat.has(cod))continue;const d=String(r[I.e]||r[I.g]||'').slice(0,10);if(d.slice(0,4)===ano)comprou.add(cod);if(!noPeriodo('prode',d)||!passaChk('prode',classeLinha(String(r[I.cf]||''),String(r[I.fc]||''))))continue;
    const o=g.get(cod)||{cod,desc:r[I.d]||'',un:r[I.u]||'',q:0,total:0,forn:new Set(),cfops:new Set(),ult:'',ultUnit:0,ultForn:'',ultCf:'',ultFc:'',conta:String(r[I.cc]||'')};
    o.q+=+r[I.q]||0;o.total+=+r[I.t]||0;o.forn.add(r[I.f]||r[I.fc]);o.cfops.add(String(r[I.cf]||''));if(d>=o.ult){o.ult=d;o.ultUnit=+r[I.un]||0;o.ultForn=r[I.f]||r[I.fc];o.ultCf=String(r[I.cf]||'');o.ultFc=String(r[I.fc]||'')}g.set(cod,o)}
  let R=[...g.values()].map(o=>{const m=M.custosManuais[o.cod]||{};return {...o,fornTxt:[...o.forn].filter(Boolean).join(', '),cfopTxt:[...o.cfops].sort().join(', '),nForn:o.forn.size,cat:m.cat||catItem({cfop:o.ultCf},{forn:o.ultFc,tipo:'NF-e'}),sub:m.sub||'',pend:false}});
  const folhas=new Set();for(const p of Object.keys(E.arvore))for(const [c] of E.arvore[p])if(!E.arvore[c])folhas.add(String(c));
  const semCompra=[...folhas].filter(c=>!fat.has(c)&&!comprou.has(c)&&!g.has(c)).map(cod=>{const m=M.custosManuais[cod]||{},k=custoComp(cod);
    const it={cod,desc:E.descricoes[cod]||E.produtos[cod]?.desc||'',un:m.un||E.custos[cod]?.um||'',cat:m.cat||'',sub:m.sub||'',ultForn:m.forn||'',fornTxt:m.forn||'',custo:k?k.v:null,origem:k?.origem||'',total:0,q:0,ult:'',conta:'',cfopTxt:'',pend:true};
    it.ok=!!(it.un&&it.cat&&it.custo!==null);return it});
  const nPend=semCompra.filter(r=>!r.ok).length;
  R=R.concat(semCompra).filter(r=>casa(`${r.cod} ${r.desc} ${r.fornTxt} ${r.cat} ${r.sub}`,q)&&(cli==='todos'||CP.get(r.cod)?.has(cli))&&(sit==='todos'||(sit==='compra'?!r.pend:sit==='sem'?r.pend:r.pend&&!r.ok)));
  const tr='<span class="muted">–</span>';
  const catSel=r=>`<select class="fp-sel" data-itcampo="cat" data-cod="${esc(r.cod)}" aria-label="Classificação de ${esc(r.cod)}"><option value="" ${!r.cat?'selected':''}>${r.pend?'pendente':'–'}</option>${[...new Set([...categorias(),...(r.cat&&r.cat!==SEM_CAT?[r.cat]:[])])].map(c=>`<option ${r.cat===c?'selected':''}>${esc(c)}</option>`).join('')}</select>`;
  box.innerHTML=abas+`<div class="tools filtros">${periodoUI('prode')}${selUI('prode_cli',[['todos','Todos os clientes'],...listaClientesEst().map(c=>[c,c])],'Cliente')}${selUI('prode_sit',[['todos','Todos'],['compra','Com compra'],['sem','Estrutura sem compra em '+ano],['pend','Pendentes de classificar']],'Situação')}${buscaUI('prode','Código, descrição ou fornecedor')}${chkClasseUI('prode')}</div><p class="small muted">${semCompra.length} itens da estrutura sem compra em ${ano}${nPend?`, <b class="txt-stop">${nPend} pendentes</b>`:''}. O que for preenchido fica salvo e o custo entra na estrutura.</p>`+
  tabela('prode',[{k:'cod',l:'Código',cls:()=>'mono'},{k:'desc',l:'Descrição',cls:()=>'trunca',f:r=>`<span title="${esc(r.desc)}">${esc(r.desc)}</span>`},
    {k:'un',l:'UM',f:r=>r.pend?`<input class="fp-in it-um" data-itcampo="un" data-cod="${esc(r.cod)}" value="${esc(r.un)}" placeholder="UM" aria-label="Unidade de ${esc(r.cod)}">`:esc(r.un)},
    {k:'cat',l:'Classificação',f:catSel},
    {k:'sub',l:'Subclassificação',f:r=>`<select class="fp-sel" data-itcampo="sub" data-cod="${esc(r.cod)}" aria-label="Subclassificação de ${esc(r.cod)}"><option value="" ${!r.sub?'selected':''}>–</option>${[...new Set([...SUBCLS,...(r.sub?[r.sub]:[])])].map(x=>`<option ${r.sub===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`},
    {k:'conta',l:'Conta',cls:()=>'mono',f:r=>r.pend?tr:esc(r.conta)},
    {k:'q',l:'Qtde',num:1,f:r=>r.pend?tr:num(r.q,0)},
    {k:'ultUnit',l:'Último preço',num:1,v:r=>r.pend?r.custo:r.ultUnit,f:r=>r.pend?`<input class="custo ${r.custo===null?'falta':''} ${r.origem==='manual'?'manual':''}" type="text" inputmode="decimal" data-custo="${esc(r.cod)}" value="${r.custo===null?'':num(r.custo,2)}" placeholder="pendente" aria-label="Custo unitário de ${esc(r.cod)}">`:num(r.ultUnit,2)},
    {k:'total',l:'Valor',num:1,f:r=>r.pend?tr:brl(r.total)},
    {k:'ult',l:'Última',v:r=>r.pend?(r.ok?'1':'0'):r.ult,f:r=>r.pend?(r.ok?'<span class="pill p-done">Classificado</span>':'<span class="pill p-stop">Pendente</span>'):dt(r.ult)}],R,{ordem:'total',desc:true,cls:'compacto fit'});
}

/* ---------- Entradas: custo NF de entrada por material ---------- */
/* Subclassificações digitadas em Cadastros › Produtos › Entradas (custos/<código>.sub). */
const SUBCLS=['Polímero','Master','Componentes','Injetados'];
const subclasses=()=>[...new Set([...SUBCLS,...Object.values(M.custosManuais).map(m=>String(m.sub||'').trim()).filter(Boolean)])];
/* Custo de compra = valor do item sem IPI (menos desconto, mais frete e despesas) menos ICMS; nas compras e industrializações
   (x101, x102, x124, x125, x401, x403) menos PIS 1,65% e COFINS 7,6% sobre essa base. O mesmo custo vai para a estrutura e a formação de preço. */
const CRED_PC=new Set(['101','102','124','125','401','403']);
function comprasItens(){
  if(M._cnf)return M._cnf;const j=M.dados.entradas,C=j.colunas,ix=n=>C.indexOf(n);
  const I={p:ix('Produto'),d:ix('Desc.Produto'),u:ix('Unidade'),q:ix('Quantidade'),un:ix('Vlr.Unitario'),t:ix('Vlr.Total'),icms:ix('Vlr.ICMS'),ipi:ix('Vlr.IPI'),cf:ix('Cod. Fiscal'),f:ix('Nome Fornecedor'),fc:ix('Forn/Cliente'),e:ix('DT Emissao'),g:ix('DT Digitacao'),doc:ix('Documento'),ds:ix('Desconto'),fr:ix('Vlr. Frete'),dp:ix('Vlr. Despesa'),gr:C.indexOf('Grupo')};
  const out=[];
  for(const r of j.linhas){const q=+r[I.q]||0,t=+r[I.t]||0;if(!q||!t)continue;
    const qive=r[0]==='Qive',cf=qive?cfopEntrada(r[I.cf]):String(r[I.cf]||''),icms=+r[I.icms]||0,ipi=+r[I.ipi]||0;
    const v=x=>x>=0?+r[x]||0:0,base=t-v(I.ds)+v(I.fr)+v(I.dp)-icms,pis=CRED_PC.has(cf.slice(1))?base*0.0165:0,cof=CRED_PC.has(cf.slice(1))?base*0.076:0,custo=base-pis-cof;
    const forn=String(r[I.f]||r[I.fc]||''),cod=String(r[I.p]??'').trim();
    out.push({key:qive?'q:'+(r[I.fc]||forn)+'|'+cod:'p:'+cod,cod,desc:String(r[I.d]||cod),un:String(r[I.u]||'').toUpperCase(),q,preco:t/q,total:t,icms,ipi,pis,cof,custo:custo/q,forn,fc:String(r[I.fc]||''),data:String(r[I.e]||r[I.g]||'').slice(0,10),doc:String(r[I.doc]||''),cfop:cf,grupo:qive?'':String(r[I.gr]??''),origem:r[0]});
  }
  M._cnf=out;return out;
}
const nomeCurto=s=>String(s||'').split(/\s+/).slice(0,2).join(' ');
const ddmm=d=>d?d.slice(8,10)+'/'+d.slice(5,7):'';
function spark(v){if(v.length<2)return '';const mn=Math.min(...v),mx=Math.max(...v),w=64,h=22,x=i=>4+i*(w-8)/(v.length-1),y=a=>mx===mn?h/2:3+(1-(a-mn)/(mx-mn))*(h-6);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${v.map((a,i)=>x(i)+','+y(a)).join(' ')}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="${x(v.length-1)}" cy="${y(v[v.length-1])}" r="2.5" fill="currentColor"/></svg>`}
function renderCustoNf(){
  const box=$('v-custonf');
  if(!M.dados.entradas){box.innerHTML=esperando('Carregando as compras…');carregar('entradas').then(renderCustoNf).catch(()=>box.innerHTML=esperando('Não foi possível carregar as compras.'));return}
  const catF=ui('cnf_cat','todos'),grF=ui('cnf_sub','todos'),q=ui('b_cnf',''),rec=ui('cnf_rec','rec');
  const itens=comprasItens();const g=new Map();
  for(const it of itens){const o=g.get(it.key)||{key:it.key,cod:it.cod,desc:it.desc,un:it.un,grupo:it.grupo,L:[]};o.L.push(it);g.set(it.key,o)}
  const lim=new Date();lim.setDate(lim.getDate()-90);const limISO=isoD(lim);
  let R=[...g.values()].map(o=>{o.L.sort((a,b)=>b.data.localeCompare(a.data));const u=o.L.slice(0,5),ult=u[0];const med=u.reduce((a,x)=>a+x.custo*x.q,0)/u.reduce((a,x)=>a+x.q,0);
    const cat=catItem({cfop:ult.cfop},{forn:ult.fc,tipo:'NF-e'}),sub=o.key.startsWith('p:')?((M.custosManuais[o.cod]||{}).sub||''):'';return {...o,sub,u,ult,med,var:med?(ult.custo-med)/med:0,cat,data:ult.data}});
  const grupos=subclasses();
  R=R.filter(r=>(rec==='todos'||r.data>=limISO)&&(catF==='todos'||r.cat===catF)&&(grF==='todos'||(grF==='_sem'?!r.sub:r.sub===grF))&&casa(`${r.cod} ${r.desc} ${r.L.map(x=>x.forn).join(' ')}`,q)).sort((a,b)=>b.data.localeCompare(a.data));
  M._cnfExport=()=>R;
  const st=ui('tb_cnf',()=>({pag:0})),por=40,pags=Math.max(1,Math.ceil(R.length/por));if(st.pag>=pags)st.pag=pags-1;const vis=R.slice(st.pag*por,st.pag*por+por);
  const aberto=ui('cnf_open',()=>new Set());const uni=r=>`<small>/${esc((r.un||'un').toLowerCase())}</small>`;
  let h=`<div class="cnf-bar"><label class="cnf-f">Classificação<select data-mf="cnf_cat">${[['todos','Todas'],...categorias().map(c=>[c,c]),[SEM_CAT,SEM_CAT]].map(([v,l])=>`<option value="${esc(v)}" ${catF===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
    <label class="cnf-f">Subclassificação<select data-mf="cnf_sub"><option value="todos">Todas</option>${grupos.map(x=>`<option value="${esc(x)}" ${grF===x?'selected':''}>${esc(x)}</option>`).join('')}<option value="_sem" ${grF==='_sem'?'selected':''}>Sem subclassificação</option></select></label>
    <label class="busca cnf-busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg><input type="search" id="mb_cnf" data-mb="cnf" placeholder="Buscar produto ou fornecedor…" value="${esc(q)}"></label>
    <div class="cnf-seg">${[['rec','Mais recentes'],['todos','Todos']].map(([k,l])=>`<button data-uiset="cnf_rec" data-v="${k}" aria-pressed="${rec===k}">${l}</button>`).join('')}</div>
    <button class="bt" id="cnfPrint">Imprimir</button><button class="bt" id="cnfExcel">Excel</button></div>
  <div class="cnf-head"><span>Material</span><span class="num">Custo médio <small>5 NF</small></span><span class="num">Última compra</span><span class="num">Variação</span><span>Tendência</span><span></span></div><div class="cnf-lista">`;
  for(const r of vis){const ab=aberto.has(r.key),u=r.ult,v=r.var,vt=Math.abs(v)<0.0005?'=':(v>0?'+':'')+(v*100).toFixed(1).replace('.',',')+'%';
    h+=`<div class="cnf-card${ab?' aberto':''}"><div class="cnf-row" data-cnfopen="${esc(r.key)}" role="button" tabindex="0" aria-expanded="${ab}">
      <span class="cnf-mat"><b title="${esc(r.desc)}">${esc(r.desc)}</b><small>${esc(nomeCurto(u.forn))} · ${ddmm(u.data)}${r.cat&&r.cat!==SEM_CAT?' · '+esc(r.cat):''}${r.sub?' · '+esc(r.sub):''}</small></span>
      <span class="num">R$ ${brl(r.med)} ${uni(r)}</span><span class="num"><b>R$ ${brl(u.custo)}</b> ${uni(r)}</span>
      <span class="num"><span class="cnf-var ${vt==='='?'':v>0?'sobe':'cai'}">${vt}</span></span><span class="cnf-tend">${spark(r.u.map(x=>x.custo).reverse())}</span><span class="seta">${ab?'⌄':'›'}</span></div>`;
    if(ab){const pct=(a,b)=>b?num(a/b*100,2)+'%':'–';
      h+=`<div class="cnf-det"><div class="cnf-ult"><div class="cnf-k cnf-k2"><span>Fornecedor da última compra</span><b title="${esc(u.forn)}">${esc(u.forn)}</b></div>
        <div class="cnf-k"><span>Data</span><b>${dt(u.data)}</b></div><div class="cnf-k"><span>NF</span><b>${esc(String(+u.doc||u.doc))}</b></div>
        <div class="cnf-k"><span>Quantidade</span><b>${num(u.q,2)} <small>${esc((r.un||'un').toLowerCase())}</small></b></div><div class="cnf-k"><span>Preço na NF</span><b>R$ ${brl(u.preco)}</b></div>
        <div class="cnf-k"><span>IPI (fora do custo)</span><b>${pct(u.ipi,u.total)}</b></div><div class="cnf-k"><span>ICMS</span><b>${pct(u.icms,u.total)}</b></div>
        <div class="cnf-k"><span>PIS 1,65%</span><b>R$ ${brl(u.pis)}</b></div><div class="cnf-k"><span>COFINS 7,6%</span><b>R$ ${brl(u.cof)}</b></div>
        <div class="cnf-k cnf-k2 cnf-tot"><span>Custo da última compra</span><b>R$ ${brl(u.custo)} ${uni(r)}</b></div></div>
        <div class="cnf-hist"><span class="cnf-tit">Últimas ${r.u.length} compras</span><div class="inner"><table><thead><tr><th>Data</th><th>Fornecedor</th><th>NF</th><th class="num">Quantidade</th><th class="num">Preço NF</th><th class="num">Custo</th></tr></thead><tbody>${r.u.map((x,i)=>`<tr class="${i===0?'cnf-sel':''}"><td>${ddmm(x.data)}</td><td>${esc(nomeCurto(x.forn))}</td><td class="mono">${esc(String(+x.doc||x.doc))}</td><td class="num">${num(x.q,2)} <small class="muted">${esc((r.un||'un').toLowerCase())}</small></td><td class="num">R$ ${brl(x.preco)}</td><td class="num"><b>R$ ${brl(x.custo)}</b></td></tr>`).join('')}<tr class="tot"><td colspan="5">Custo médio</td><td class="num"><b>R$ ${brl(r.med)}</b></td></tr></tbody></table></div></div></div>`}
    h+='</div>';
  }
  h+='</div>';
  if(!vis.length)h+=esperando(rec==='rec'?'Nenhuma compra nos últimos 90 dias com esse filtro. Clique em Todos para ver as anteriores.':'Nenhum material com esse filtro.');
  if(pags>1)h+=`<div class="tools pagin"><button class="act" data-mp="cnf" data-dir="-1" ${st.pag===0?'disabled':''}>Anterior</button><span class="small muted">Página ${st.pag+1} de ${pags} · ${R.length} materiais</span><button class="act" data-mp="cnf" data-dir="1" ${st.pag>=pags-1?'disabled':''}>Próxima</button></div>`;
  box.innerHTML=h;
}
function exportaCnf(){const R=M._cnfExport&&M._cnfExport();if(!R)return;
  const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',n2=v=>String(Math.round(v*100)/100).replace('.',',');
  const lin=['Código;Material;Unidade;Classificação;Custo médio (5 NF);Última compra;Variação %;Fornecedor;Data;NF',...R.map(r=>[q(r.cod),q(r.desc),q(r.un),q(r.cat),n2(r.med),n2(r.ult.custo),n2(r.var*100),q(r.ult.forn),q(r.ult.data),q(r.ult.doc)].join(';'))];
  baixaCsv('custo-nf-entrada.csv',String.fromCharCode(65279)+lin.join(String.fromCharCode(13,10)));
}

/* ---------- Estoque de produtos de venda (pedido do Chai, 25/11/2026) ---------- */
/* Uma linha por produto e cliente, dos CFOPs de receita. Só a Vaeso tem saldo por enquanto:
   entrada = apontamento de produção das ordens (vaeso_ops, total confirmado de cada item, no dia da confirmação);
   saída = NF de receita emitida para a Vaeso e não cancelada. Estoque inicial zerado em 25/11/2026 (Chai): só conta o que veio depois (ESTOQUE_ZERO).
   Saldo negativo = saiu na nota mais do que foi apontado. Os outros clientes ainda não têm entrada: saldo null. */
const ESTOQUE_ZERO={em:'2026-11-25T18:29:55Z',dia:'2026-11-25',nota:28230};
/* Entradas de um item de ordem. Cada apontamento grava em estoque_mov a diferença (delta) do total; o que mudou sem registro
   (apontamento que a Vaeso recebeu depois, registro que falhou) entra como a diferença que falta, no dia da última confirmação. */
function entradasDoItem(total,em,logs,depoisDoZero,dia){
  const out=[],diaDe=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v:dia(v),poe=(q,v,id)=>{if(q&&v&&depoisDoZero(v))out.push({id,data:diaDe(v),em:v,q})};
  if(!logs.length){poe(total,em,'u|'+em);return out}
  const L=[...logs].sort((a,b)=>String(a.em).localeCompare(String(b.em)));let soma=+L[0].antes||0;poe(soma,L[0].antesEm,'u|'+L[0].antesEm);
  for(const l of L){const ant=+l.antes||0;if(ant!==soma){poe(ant-soma,l.em,'a|'+l._id);soma=ant}poe(+l.delta||0,l.em,'m|'+l._id);soma+=+l.delta||0}
  if(total!==soma)poe(total-soma,em||L[L.length-1].em,'f|'+(em||L[L.length-1].em));
  return out;
}
function estoquePks(linhas,ops,logs,zero,ehReceita,ehDaVaeso,dia){
  const g=new Map(),cod=v=>String(v||'').trim().toUpperCase(),vaeso=linhas.find(l=>ehDaVaeso(l.destNome))?.destNome||'VAESO';
  const depois=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)?v>zero.dia:Date.parse(v)>Date.parse(zero.em),porItem={};
  for(const [id,l] of Object.entries(logs||{})){const k=l.op_id+'|'+l.produto_id;(porItem[k]=porItem[k]||[]).push({...l,_id:id})}
  const linha=(c,cli,desc,un)=>{const k=c+'|'+cli;let o=g.get(k);if(!o){o={k,cod:c,desc,un,cli,vae:ehDaVaeso(cli),ent:0,sai:0,saldo:null,mov:[],ult:''};g.set(k,o)}return o};
  for(const l of linhas){if(!ehReceita(l.cfop))continue;const c=cod(l.cod);if(!c)continue;const o=linha(c,l.destNome,l.desc,l.un);
    if(l.data>=o.ult){o.ult=l.data;o.desc=l.desc||o.desc}
    if(o.vae&&l.data>=zero.dia&&+l.nota>zero.nota){o.sai+=+l.q||0;o.mov.push({data:l.data,em:l.data+'T99',tipo:'saida',doc:'NF '+(+l.nota||l.nota),q:-(+l.q||0)})}}
  for(const p of Object.values(ops||{}))for(const it of p.itens||[]){const c=cod(it.sku);if(!c)continue;const o=linha(c,vaeso,it.descricao||'','UN');
    const doc=(/^\d+$/.test(String(p.numero||''))?'OC '+p.numero:String(p.numero||'OC '+p.id))+(it.op_pks?' · OP '+it.op_pks:'');
    for(const e of entradasDoItem(+it.produzido?.qtd||0,it.produzido?.em||'',porItem[p.id+'|'+it.produto_id]||[],depois,dia)){o.ent+=e.q;o.mov.push({data:e.data,em:e.em,tipo:e.q<0?'estorno':'entrada',doc,q:e.q})}}
  for(const o of g.values()){if(!o.vae)continue;o.mov.sort((a,b)=>a.data.localeCompare(b.data)||String(a.em).localeCompare(String(b.em)));
    let sd=0;for(const m of o.mov){sd=Math.round((sd+m.q)*1000)/1000;m.saldo=sd;m.cod=o.cod;m.desc=o.desc;m.cli=o.cli;m.un=o.un}o.saldo=sd;o.mov.reverse()}
  return [...g.values()];
}
const MOV_TIPO={entrada:['Entrada · apontamento','p-done'],estorno:['Estorno de apontamento','p-ready'],saida:['Saída · nota fiscal','p-info']};
const movTipo=m=>`<span class="pill ${MOV_TIPO[m.tipo][1]}">${MOV_TIPO[m.tipo][0]}</span>`,movQ=m=>`<b class="${m.q<0?'txt-stop':''}">${m.q>0?'+':m.q<0?'−':''}${num(Math.abs(m.q),2)}</b>`;
/* Carrega o que as duas telas do Estoque usam; devolve null enquanto espera */
function estoqueDados(box,fn){
  const L=fatLinhas();
  if(!L){box.innerHTML=esperando('Carregando o estoque…');carregar('faturamento').then(()=>{if(['estoque','estmov'].includes(M.atual))rerender()}).catch(()=>box.innerHTML=esperando('Não foi possível carregar os produtos.'));return null}
  if((!M.vxPronto||!M.movPronto)&&S.db){box.innerHTML=esperando('Carregando as movimentações…');return null}
  return estoquePks(L,M.vxOps,M.estMov,ESTOQUE_ZERO,c=>tipoCfop(c).t==='Receita',ehVaeso,diaSP);
}
const estCliUI=(k,clientes)=>selUI(k,[['todos','Todos os clientes'],...PRINCIPAIS.map(([c,l])=>[clientes.find(x=>x.includes(c))||c,'★ '+l]),...clientes.map(c=>[c,c])],'Cliente');
function renderEstoque(){
  const box=$('v-estoque'),T=estoqueDados(box);if(!T)return;
  const clientes=[...new Set(T.map(r=>r.cli))].sort(COLL.compare),cli=ui('est_pcli','todos'),q=ui('b_estq',''),aberto=ui('estq_open',()=>new Set());
  const R=T.filter(r=>(cli==='todos'||r.cli===cli)&&casa(`${r.cod} ${r.desc} ${r.cli}`,q)),soma=(rs,k)=>rs.reduce((a,r)=>a+(r[k]||0),0),semV='<span class="muted">–</span>';
  const cols=[{k:'cod',l:'Código',cls:()=>'mono',f:r=>`<span class="seta">${aberto.has(r.k)?'▾':'›'}</span> ${esc(r.cod)}`},{k:'desc',l:'Descrição',cls:()=>'trunca',f:r=>`<span title="${esc(r.desc)}">${esc(r.desc)}</span>`},
    {k:'cli',l:'Cliente',cls:()=>'trunca',f:r=>`<span title="${esc(r.cli)}">${esc(r.cli)}</span>`},{k:'un',l:'UM'},
    {k:'ent',l:'Entradas',num:1,v:r=>r.vae?r.ent:null,f:r=>r.vae?num(r.ent,2):semV},{k:'sai',l:'Saídas',num:1,v:r=>r.vae?r.sai:null,f:r=>r.vae?num(r.sai,2):semV},
    {k:'saldo',l:'Saldo estoque',num:1,f:r=>r.saldo===null?semV:`<b class="${r.saldo<0?'txt-stop':''}">${num(r.saldo,2)}</b>`}];
  const det=r=>`<tr><td colspan="7" class="detail">${r.mov.length?`<div class="inner"><table><thead><tr><th>Data</th><th>Movimento</th><th>Documento</th><th class="num">Quantidade</th><th class="num">Saldo</th></tr></thead><tbody>${r.mov.map(m=>`<tr><td>${dt(m.data)}</td><td>${movTipo(m)}</td><td>${esc(m.doc)}</td><td class="num">${movQ(m)}</td><td class="num">${num(m.saldo,2)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small muted">Nenhuma movimentação neste produto.</p>'}</td></tr>`;
  box.innerHTML=`<div class="tools filtros">${estCliUI('est_pcli',clientes)}${buscaUI('estq','Código, descrição ou cliente')}</div>`+
  tabela('estq',cols,R,{ordem:'saldo',desc:true,porPagina:50,cls:'compacto fit',vazio:'Nenhum produto com esse filtro.',
    linha:r=>` data-estq="${esc(r.k)}" class="row" tabindex="0" aria-expanded="${aberto.has(r.k)}"`,depois:r=>aberto.has(r.k)?det(r):'',
    total:rs=>`<td colspan="4"><b>${rs.length.toLocaleString('pt-BR')} produto${rs.length===1?'':'s'}</b></td><td class="num"><b>${num(soma(rs,'ent'),2)}</b></td><td class="num"><b>${num(soma(rs,'sai'),2)}</b></td><td class="num"><b>${num(soma(rs,'saldo'),2)}</b></td>`});
}
/* Estoque › Movimentações: todas as entradas e saídas */
function renderEstMov(){
  const box=$('v-estmov'),T=estoqueDados(box);if(!T)return;
  const V=T.flatMap(r=>r.mov),clientes=[...new Set(T.filter(r=>r.vae).map(r=>r.cli))].sort(COLL.compare),cli=ui('estm_cli','todos'),tp=ui('estm_tipo','todos'),q=ui('b_estm','');
  const R=V.filter(m=>noPeriodo('estm',m.data)&&(cli==='todos'||m.cli===cli)&&(tp==='todos'||m.tipo===tp)&&casa(`${m.cod} ${m.desc} ${m.doc} ${m.cli}`,q));
  const cols=[{k:'data',l:'Data',v:m=>m.data+' '+m.em,f:m=>dt(m.data)},{k:'tipo',l:'Movimento',f:movTipo},{k:'cod',l:'Código',cls:()=>'mono'},{k:'desc',l:'Descrição',cls:()=>'trunca',f:m=>`<span title="${esc(m.desc)}">${esc(m.desc)}</span>`},
    {k:'cli',l:'Cliente',cls:()=>'trunca',f:m=>`<span title="${esc(m.cli)}">${esc(m.cli)}</span>`},{k:'doc',l:'Documento'},{k:'q',l:'Quantidade',num:1,f:movQ},{k:'un',l:'UM'}];
  const tot=rs=>rs.reduce((a,m)=>a+m.q,0);
  box.innerHTML=`<div class="tools filtros">${periodoUI('estm')}${estCliUI('estm_cli',clientes)}${selUI('estm_tipo',[['todos','Todas'],['entrada','Entradas'],['saida','Saídas'],['estorno','Estornos']],'Movimento')}${buscaUI('estm','Código, descrição, OC ou NF')}</div>`+
  tabela('estm',cols,R,{ordem:'data',desc:true,porPagina:50,cls:'compacto fit',vazio:'Nenhuma movimentação com esse filtro.',
    total:rs=>`<td colspan="6"><b>${rs.length.toLocaleString('pt-BR')} ${rs.length===1?'movimentação':'movimentações'}</b></td><td class="num"><b>${tot(rs)<0?'−':''}${num(Math.abs(tot(rs)),2)}</b></td><td></td>`});
}
/* Registra no item a diferença que o apontamento trouxe (estoque_mov). Se falhar, entradasDoItem completa pela diferença. */
function registraMov(db,r,antes,antesEm,depois){
  const delta=depois-antes;if(!db||!delta)return;
  return db.doc(`estoque_mov/${r.op_id}|${r.produto_id}|${Date.now()}`).set({op_id:r.op_id,produto_id:r.produto_id,sku:r.sku,antes,antesEm,depois,delta,em:new Date().toISOString()}).catch(()=>{});
}

/* ---------- PCP: ordens de produção Vaeso (integração com o Gestão Vaeso) ---------- */
/* A Vaeso cria as ordens no Gestão Vaeso; a função pks-vaeso do Supabase copia para vaeso_ops a cada 10 min.
   A PKS confirma o produzido (Igual / Menos / Mais); a função grava em vaeso_prod e manda para a Vaeso.
   A confirmação só existe no site (window.pksFuncao); dentro do Claude a tela fica só de leitura. */
/* Uma ordem de compra da Vaeso para a PKS, com os itens (op_pks = número da OP da PKS, quando a Vaeso informa). */
const vxNumero=o=>/^\d+$/.test(String(o.numero||''))?'OC '+o.numero:String(o.numero||'OC '+o.id);
function vxOrdens(){
  return Object.values(M.vxOps||{}).map(o=>{
    const itens=(o.itens||[]).map(it=>{const id=o.id+'|'+it.produto_id;return {k:id,op_id:o.id,numero:vxNumero(o),status:o.status,produto_id:it.produto_id,sku:it.sku||'',desc:it.descricao||'',
      opPks:it.op_pks||'',qtd:+it.qtd||0,entregue:+it.entregue||0,prod:it.produzido||null,env:(M.vxProd||{})[id]}});
    const ped=itens.reduce((a,r)=>a+r.qtd,0),feito=itens.reduce((a,r)=>a+(r.prod?r.prod.qtd:0),0);
    return {id:o.id,numero:vxNumero(o),emitida:o.emitida_em||'',prevista:o.prevista_em||'',status:o.status,obs:o.obs||'',itens,ped,feito,pct:ped?Math.min(100,feito/ped*100):0}})
    .sort((a,b)=>a.emitida.localeCompare(b.emitida)||String(a.numero).localeCompare(String(b.numero),'pt-BR',{numeric:true}));
}
const vxLinhas=()=>vxOrdens().flatMap(o=>o.itens);
/* Produzidos nos últimos 7 dias (pedido do Chai, 25/11/2026, como na Visão PKS do Gestão): por produto e por dia de São Paulo.
   A PKS guarda só a última confirmação de cada item: o total apontado conta no dia dessa confirmação. */
const diaSP=d=>new Date(d).toLocaleDateString('sv-SE',{timeZone:'America/Sao_Paulo'});
function produzidosNosDias(ops,hoje){
  const dias=Array.from({length:7},(_,i)=>{const d=new Date(hoje+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-6+i);return d.toISOString().slice(0,10)});
  const porDia=Object.fromEntries(dias.map(d=>[d,0])),g=new Map();let total=0;
  for(const o of Object.values(ops||{}))for(const it of o.itens||[]){const p=it.produzido,q=+p?.qtd||0;if(!q||!p.em||isNaN(new Date(p.em)))continue;
    const d=/^\d{4}-\d{2}-\d{2}$/.test(p.em)?p.em:diaSP(p.em);if(!(d in porDia))continue;
    const k=it.sku||it.descricao||String(it.produto_id),l=g.get(k)||{sku:it.sku||'',desc:it.descricao||'',dias:{},total:0};
    l.dias[d]=(l.dias[d]||0)+q;l.total+=q;porDia[d]+=q;total+=q;g.set(k,l)}
  return {dias,porDia,total,linhas:[...g.values()].sort((a,b)=>b.total-a.total||a.sku.localeCompare(b.sku))};
}
const diaCurto=d=>['dom','seg','ter','qua','qui','sex','sáb'][new Date(d+'T12:00:00Z').getUTCDay()]+' '+ddmm(d);
function quadroProduzidos(){
  const hoje=diaSP(Date.now()),r=produzidosNosDias(M.vxOps,hoje),ab=ui('vx_prodz','aberto')==='aberto',rot=d=>d===hoje?'hoje':diaCurto(d);
  return `<section class="nfa-painel vx-prodz" aria-label="Produzidos nos últimos 7 dias"><div class="vx-pz-t"><h3>Produzidos <small class="muted">últimos 7 dias</small></h3><b>${n0(r.total)} pç</b>${r.linhas.length?`<button type="button" class="bt vx-bt" data-uiset="vx_prodz" data-v="${ab?'fechado':'aberto'}" aria-expanded="${ab}">${ab?'Ocultar produtos':'Ver por produto'}</button>`:''}</div>
  <div class="vx-pz-d">${r.dias.map(d=>`<div class="${d===hoje?'hoje':''}"><span>${rot(d)}</span><b>${n0(r.porDia[d])}</b></div>`).join('')}</div>
  ${!r.linhas.length?'<p class="small muted">Nenhuma produção apontada nos últimos 7 dias.</p>':ab?`<div class="scroll"><table class="compacto fit"><thead><tr><th>Produto</th>${r.dias.map(d=>`<th class="num">${diaCurto(d)}</th>`).join('')}<th class="num">Total</th></tr></thead><tbody>${r.linhas.map(l=>`<tr><td><span class="mono muted">${esc(l.sku)}</span> ${esc(l.desc)}</td>${r.dias.map(d=>`<td class="num">${l.dias[d]?n0(l.dias[d]):'<span class="muted">–</span>'}</td>`).join('')}<td class="num"><b>${n0(l.total)}</b></td></tr>`).join('')}<tr class="tot"><td><b>Total · ${r.linhas.length} produto${r.linhas.length===1?'':'s'}</b></td>${r.dias.map(d=>`<td class="num"><b>${n0(r.porDia[d])}</b></td>`).join('')}<td class="num"><b>${n0(r.total)}</b></td></tr></tbody></table></div>`:''}</section>`;
}
/* PCP › Protheus (pedido do Chai, 26/11/2026): os apontamentos feitos aqui, um por linha e por data, para outra pessoa lançar no
   Protheus. Marcar "Apontado" grava em protheus_apont/<id do apontamento> e a linha sai dos pendentes. Só no site: sem Vaeso e sem painel. */
function apontamentosPks(ops,logs,dia){
  const porItem={},out=[];
  for(const [id,l] of Object.entries(logs||{})){const k=l.op_id+'|'+l.produto_id;(porItem[k]=porItem[k]||[]).push({...l,_id:id})}
  for(const p of Object.values(ops||{}))for(const it of p.itens||[]){const k=p.id+'|'+it.produto_id;
    for(const e of entradasDoItem(+it.produzido?.qtd||0,it.produzido?.em||'',porItem[k]||[],()=>true,dia))
      out.push({id:k+'|'+e.id,data:e.data,em:e.em,q:e.q,oc:vxNumero(p),op:it.op_pks||'',sku:it.sku||'',desc:it.descricao||'',total:+it.qtd||0})}
  return out;
}
function renderProtheus(box,topo){
  if(!M.movPronto||!M.prtPronto){box.innerHTML=topo+esperando('Carregando os apontamentos…');return}
  const A=apontamentosPks(M.vxOps,M.estMov,diaSP),feito=M.prtApont||{},f=ui('prt_f','pendentes'),q=ui('b_prt','');
  const pend=A.filter(a=>!feito[a.id]),fim=A.filter(a=>feito[a.id]);
  const R=(f==='pendentes'?pend:fim).filter(a=>casa(`${a.op} ${a.sku} ${a.desc} ${a.oc}`,q));
  const cols=[{k:'data',l:'Data',v:a=>a.em,f:a=>dt(a.data)},{k:'op',l:'OP PKS',cls:()=>'mono',f:a=>a.op?esc(a.op):'<span class="muted">sem OP</span>'},{k:'sku',l:'Código',cls:()=>'mono'},
    {k:'desc',l:'Descrição',cls:()=>'trunca',f:a=>`<span title="${esc(a.desc)}">${esc(a.desc)}</span><small class="muted vx-quem">${esc(a.oc)}</small>`},{k:'total',l:'Total OP',num:1,f:a=>num(a.total,2)},
    {k:'q',l:'Produção apontada',num:1,f:a=>`<b class="${a.q<0?'txt-stop':''}">${a.q<0?'−'+num(-a.q,2)+' <small>(estorno)</small>':num(a.q,2)}</b>`},
    f==='pendentes'?{k:'_ap',l:'Apontar no Protheus',v:()=>0,f:a=>`<button type="button" class="bt vx-bt" data-prt="${esc(a.id)}" ${M.prtOcup?'disabled':''}>Apontado</button>`}
      :{k:'_ap',l:'Apontado no Protheus',v:a=>feito[a.id]?.em||'',f:a=>`<span class="pill p-done">Produzido</span><small class="muted vx-quem">${dt(String(feito[a.id]?.em||'').slice(0,10))}${feito[a.id]?.por?' · '+esc(feito[a.id].por):''}</small> <button type="button" class="lnk" data-prtvolta="${esc(a.id)}">voltar</button>`}];
  box.innerHTML=topo+`<nav class="nfa-tabs vx-abas" aria-label="Situação no Protheus">${[['pendentes','Pendentes',pend.length],['apontados','Apontados',fim.length]].map(([k,l,n])=>`<button data-uiset="prt_f" data-v="${k}" aria-pressed="${f===k}">${l} <span class="small">${n}</span></button>`).join('')}</nav>
  <div class="tools filtros">${buscaUI('prt','OP, código, descrição ou OC')}</div>`+
  tabela('prt_'+f,cols,R,{ordem:'data',desc:f!=='pendentes',porPagina:50,cls:'compacto fit',vazio:f==='pendentes'?'Nenhum apontamento pendente no Protheus.':'Nenhum apontamento marcado ainda.'});
}
async function marcaProtheus(id,on){
  if(!S.db){toast('Sem conexão com a base. Nada foi gravado.');return}
  M.prtOcup=true;rerender();
  try{if(on)await S.db.doc('protheus_apont/'+id).set({em:new Date().toISOString(),por:S.perfil||''});else await S.db.doc('protheus_apont/'+id).delete();
    const s=await S.db.collection('protheus_apont').get();const o={};s.docs.forEach(d=>o[d.id]=d.data());M.prtApont=o;toast(on?'Marcado como apontado no Protheus.':'Voltou para pendentes.')}
  catch{toast('Não foi possível gravar. Tente de novo.')}
  M.prtOcup=false;rerender();
}
function renderPcpVaeso(){
  const box=$('v-pcpvaeso');
  if(!M.vxPronto){box.innerHTML=esperando('Carregando as ordens de produção da Vaeso…');return}
  const tela=ui('vx_tela','ordens'),navTela=`<nav class="nfa-tabs vx-telas" aria-label="Telas do PCP">${[['ordens','Ordens'],['protheus','Protheus']].map(([k,l])=>`<button data-uiset="vx_tela" data-v="${k}" aria-pressed="${tela===k}">${l}</button>`).join('')}</nav>`;
  if(tela==='protheus'){renderProtheus(box,navTela);return}
  const O=vxOrdens(),q=ui('b_vx',''),aba=ui('vx_aba','abertas'),aberto=ui('vx_open',()=>new Set()),ordAb=ui('vx_ord',()=>new Set()),site=!!window.pksFuncao;
  const abertas=O.filter(o=>o.status==='aberta'),fin=O.filter(o=>o.status!=='aberta');
  const casaO=o=>casa(`${o.numero} ${o.obs} ${o.itens.map(r=>r.sku+' '+r.desc+' '+r.opPks).join(' ')}`,q);
  const lista=(aba==='abertas'?abertas:fin).filter(casaO),meta=M.vxMeta||{},itAb=abertas.flatMap(o=>o.itens);
  const kpi=(t,v,s)=>`<div class="card-k"><span>${t}</span><b>${v}</b>${s?`<small class="muted">${s}</small>`:''}</div>`;
  const quando=meta.ultimoPuxar||meta.em?new Date(meta.ultimoPuxar||meta.em).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'–';
  let h=navTela+`<p class="vx-busca">Última busca na Vaeso: ${quando} · a cada 10 minutos${meta.erro?` · <span class="txt-stop">Erro: ${esc(meta.erro)}</span>`:''}</p>${quadroProduzidos()}<div class="cards3">${kpi('Ordens em aberto',n0(abertas.length),n0(itAb.length)+' itens')}${kpi('Itens sem confirmação',n0(itAb.filter(r=>!r.prod).length),'produção ainda não informada')}${kpi('Peças pedidas em aberto',n0(itAb.reduce((a,r)=>a+r.qtd,0)),'')}</div>
  <nav class="nfa-tabs vx-abas" aria-label="Situação das ordens">${[['abertas','Em aberto',abertas.length],['finalizadas','Finalizadas',fin.length]].map(([k,l,n])=>`<button data-uiset="vx_aba" data-v="${k}" aria-pressed="${aba===k}">${l} <span class="small">${n}</span></button>`).join('')}</nav>
  <div class="tools filtros">${buscaUI('vx','OC, OP da PKS, SKU ou descrição')}</div>`;
  if(!site)h+=`<p class="small muted">A confirmação do produzido é feita no site do PKS (pks-gestao.github.io). Aqui a lista é só para consulta.</p>`;
  if(!lista.length)h+=esperando(O.length?(aba==='abertas'?'Nenhuma ordem em aberto com esse filtro.':'Nenhuma ordem finalizada com esse filtro.'):'Nenhuma ordem recebida da Vaeso ainda.');
  const chip=r=>{if(!r.prod)return '<span class="muted">–</span>';const d=r.prod.qtd-r.qtd;
    return `${n0(r.prod.qtd)} ${Math.abs(d)<1?'<span class="pill p-done">igual</span>':d<0?`<span class="pill p-stop">−${n0(-d)}</span>`:`<span class="pill p-info">+${n0(d)}</span>`}<span class="small muted vx-quem">${dt(String(r.prod.em||'').slice(0,10))} · ${esc(r.prod.por||'')}</span>`};
  const finLin=r=>r.status==='aberta'&&r.prod&&(r.prod.conferencia==='igual'||r.prod.conferencia==='mais'||+r.prod.qtd>=Math.round(r.qtd)||((M.vxLin||{})[r.k]?.encerrada&&+M.vxLin[r.k].qtd===+r.prod.qtd))?' <span class="pill p-done" title="Linha finalizada">Finalizada</span>':'';
  const envio=r=>!r.env||r.env.acao==='desfazer'&&r.env.envio==='enviado'?'':r.env.envio==='enviado'?'<span class="small vx-ok" title="Recebido pela Vaeso">✓ enviado</span>':`<span class="small txt-stop" title="${esc(r.env.erro||'')}">a enviar</span>`;
  const stPill=o=>o.status==='aberta'?(o.feito>0?'<span class="pill p-ready">Parcial</span>':'<span class="pill p-open">Em aberto</span>'):o.status==='cancelada'?'<span class="pill p-stop">Cancelada</span>':'<span class="pill p-done">Concluída</span>';
  for(const o of lista){const oa=ordAb.has(String(o.id));
    h+=`<section class="vx-ordem${oa?' aberta':''}"><header class="vx-cab" data-vxord="${esc(o.id)}" role="button" tabindex="0" aria-expanded="${oa}"><span class="seta" aria-hidden="true">${oa?'▾':'›'}</span><div class="vx-tit"><b>${esc(o.numero)}</b> ${stPill(o)}<span class="small muted">Emissão ${dt(o.emitida)}${o.prevista?' · prevista '+dt(o.prevista):''}${o.obs?' · '+esc(o.obs):''}</span></div>
      <div class="vx-prog" title="${num(o.pct,0)}% confirmado como produzido"><span class="small"><b>${n0(o.feito)}</b> de ${n0(o.ped)} pç</span><span class="pcp-bar"><i style="width:${o.pct}%"></i></span></div>
      ${site&&o.status==='aberta'?`<button type="button" class="bt vx-bt" data-vxenc="${esc(o.id)}" ${M.vxOcupado?'disabled':''}>Encerrar</button>`:''}</header>
      ${!oa?'':`<div class="scroll"><table class="compacto fit vx-itens"><thead><tr><th>OP PKS</th><th>SKU</th><th>Descrição</th><th class="num">Pedido</th><th class="num">Entregue</th><th>Produzido PKS</th><th></th></tr></thead><tbody>${o.itens.map(r=>
      `<tr><td class="mono">${r.opPks?esc(r.opPks):'<span class="muted">–</span>'}</td><td class="mono">${esc(r.sku)}</td><td class="trunca"><span title="${esc(r.desc)}">${esc(r.desc)}</span></td><td class="num">${num(r.qtd,2)}</td><td class="num">${num(r.entregue,2)}</td><td>${chip(r)}${finLin(r)} ${envio(r)}</td>
       <td>${site&&o.status==='aberta'?`<button type="button" class="bt vx-bt" data-vxopen="${esc(r.k)}" aria-expanded="${aberto.has(r.k)}">${r.prod?'Alterar':'Produzido'}</button>`:''}</td></tr>${aberto.has(r.k)&&site&&o.status==='aberta'?vxPainel(r):''}`).join('')}</tbody></table></div>`}</section>`;
  }
  box.innerHTML=h;
  const inp=document.getElementById('vxQtd');if(inp&&M.vxFoco){inp.focus();M.vxFoco=false}
}
async function vxEncerrar(id){
  const o=vxOrdens().find(x=>String(x.id)===String(id));if(!o||!window.pksFuncao)return;
  if(!confirm(`Encerrar a ${o.numero}? Foram confirmadas ${n0(o.feito)} de ${n0(o.ped)} peças. A ordem sai da lista em aberto, aqui e na Vaeso.`))return;
  M.vxOcupado=true;rerender();
  try{const r=await window.pksFuncao('pks-vaeso',{acao:'encerrar',op_id:o.id});toast(r?.repetido?'Essa ordem já estava encerrada.':`${o.numero} encerrada na Vaeso.`)}
  catch(e){toast(e.message||'Não foi possível encerrar.')}
  M.vxOcupado=false;rerender();
}
function vxPainel(r){
  const m=ui('vx_modo',''),ocup=M.vxOcupado;
  return `<tr class="vx-painel"><td colspan="7"><div class="vx-conf"><b>${esc(r.numero)} · ${esc(r.sku)}: quanto foi produzido?</b>
    <div class="vx-opts"><button type="button" class="bt bt-red" data-vxok="${esc(r.k)}" data-conf="igual" ${ocup?'disabled':''}>Igual · ${n0(Math.round(r.qtd))}</button>
    <button type="button" class="bt" data-vxmodo="menos" aria-pressed="${m==='menos'}">Menos</button><button type="button" class="bt" data-vxmodo="mais" aria-pressed="${m==='mais'}">Mais</button>
    ${r.prod?`<button type="button" class="bt" data-vxdesf="${esc(r.k)}" ${ocup?'disabled':''}>Desfazer</button>`:''}</div>
    ${m?`<div class="vx-in"><label for="vxQtd">Quantidade produzida (${m==='menos'?'menor':'maior'} que ${n0(r.qtd)})</label><div class="vx-opts"><input id="vxQtd" type="number" inputmode="numeric" min="1" step="1" value="${esc(M.vxVal||'')}">
      <button type="button" class="bt bt-red" data-vxok="${esc(r.k)}" data-conf="${m}" ${ocup?'disabled':''}>Confirmar</button></div></div>`:''}
    ${M.vxErro?`<p class="small txt-stop" role="alert">${esc(M.vxErro)}</p>`:''}</div></td></tr>`}
async function vxEnviar(k,acao,conf){
  const r=vxLinhas().find(x=>x.k===k);if(!r||!window.pksFuncao)return;
  const corpo={acao,op_id:r.op_id,produto_id:r.produto_id};
  if(acao==='confirmar'){corpo.conferencia=conf;if(conf!=='igual'){const v=Math.round(+String(document.getElementById('vxQtd')?.value||'').replace(',','.'));
    if(!(v>0)){M.vxErro='Informe a quantidade produzida.';rerender();return}if(conf==='menos'&&v>=r.qtd||conf==='mais'&&v<=r.qtd){M.vxErro=`A quantidade precisa ser ${conf==='menos'?'menor':'maior'} que ${n0(r.qtd)}.`;rerender();return}corpo.qtd=v}}
  const antes=r.prod?+r.prod.qtd||0:0,antesEm=r.prod?.em||'',depois=acao==='desfazer'?0:conf==='igual'?Math.round(r.qtd):corpo.qtd;
  M.vxOcupado=true;M.vxErro='';rerender();
  try{const res=await window.pksFuncao('pks-vaeso',corpo);if(res?.enviado)await registraMov(S.db,r,antes,antesEm,depois);ui('vx_open',()=>new Set()).clear();M.ui.vx_modo='';M.vxVal='';
    toast(res?.enviado?(acao==='desfazer'?'Confirmação desfeita na Vaeso.':'Produção enviada à Vaeso.'):'Gravado. Será enviado à Vaeso na próxima tentativa.')}
  catch(e){M.vxErro=e.message||'Não foi possível concluir.'}
  M.vxOcupado=false;rerender();
}

/* ---------- Estruturas e custo ---------- */
function custoComp(c){
  const man=M.custosManuais[c];if(man&&man.valor!==undefined&&man.valor!==null&&man.valor!=='')return {v:+man.valor,origem:'manual',info:man};
  const k=M.dados.estruturas.custos[c];if(k)return {v:k.unit,origem:'compra',info:k};
  return null;
}
/* Vaeso: componentes de caixa (CAIXA, CX) e master entram com custo 0,00 nos produtos faturados para ela. */
const ehVaeso=n=>/VAESO/i.test(n||'');
const zeraVaeso=c=>/^\s*(CAIXA|CX\b|MASTER)/i.test(M.dados.estruturas.descricoes[c]||M.dados.estruturas.produtos[c]?.desc||'');
function custoPeca(cod,vis=new Set(),vae=false){
  const E=M.dados.estruturas;const arv=E.arvore[cod];
  if(!arv){if(vae&&zeraVaeso(cod))return {v:0,falta:0};const c=custoComp(cod);return {v:c?c.v:0,falta:c?0:1}}
  if(vis.has(cod))return {v:0,falta:0};
  const nv=new Set(vis);nv.add(cod);let v=0,falta=0;
  for(const [comp,q,perda] of arv){const qq=q*(1+(perda||0)/100);const r=E.arvore[comp]?custoPeca(comp,nv,vae):(()=>{if(vae&&zeraVaeso(comp))return {v:0,falta:0};const c=custoComp(comp);return {v:c?c.v:0,falta:c?0:1}})();v+=qq*r.v;falta+=r.falta}
  return {v,falta};
}
function arvoreLinhas(cod,nivel,mult,acc,vis,vae=false){
  const E=M.dados.estruturas;
  for(const [comp,q,perda] of E.arvore[cod]||[]){
    const qq=q*(1+(perda||0)/100);const temE=!!E.arvore[comp];
    const zv=!temE&&vae&&zeraVaeso(comp);const c=temE?null:custoComp(comp);const cp=temE?custoPeca(comp,new Set(),vae):null;
    acc.push({nivel,comp,desc:E.descricoes[comp]||E.produtos[comp]?.desc||'',q:qq,perda,temE,zv,custo:temE?cp.v:zv?0:(c?c.v:null),c,falta:temE?cp.falta:zv?0:(c?0:1),pai:cod,mult});
    if(temE&&!vis.has(comp)){const nv=new Set(vis);nv.add(comp);arvoreLinhas(comp,nivel+1,mult*qq,acc,nv,vae)}
  }
  return acc;
}
function renderEstrutura(){
  const box=$('v-estrutura');const E=M.dados.estruturas;
  if(!E){box.innerHTML=esperando('Carregando as estruturas…');carregar('estruturas').then(renderEstrutura).catch(()=>box.innerHTML=esperando('Não foi possível carregar as estruturas.'));return}
  const q=ui('b_est',''),so=ui('est_falta','todos'),cliF=ui('est_cli','todos');
  const vaeDe=p=>ehVaeso(cliF)||(p.clientes.length>0&&p.clientes.every(ehVaeso));
  const R=Object.entries(E.produtos).filter(([,p])=>!p.intermediario).map(([cod,p])=>{const vae=vaeDe(p);const c=custoPeca(cod,new Set(),vae);return {cod,...p,custo:c.v,falta:c.falta,cli:p.clientes.join(', '),prim:[...new Set(p.clientes.map(c=>c.split(/[\s,.\/-]+/)[0]))].join(', '),margem:p.q?(p.valor/p.q-c.v):null}}).filter(r=>casa(`${r.cod} ${r.desc} ${r.cli}`,q)&&(so==='todos'||(so==='falta'?r.falta>0:r.falta===0))&&(cliF==='todos'||r.clientes.includes(cliF)));
  const aberto=ui('est_open',()=>new Set());
  const totFalta=new Set();for(const [p] of Object.entries(E.arvore))for(const [comp] of E.arvore[p])if(!E.arvore[comp]&&!custoComp(comp))totFalta.add(comp);
  let h=`<div class="tools filtros">${selUI('est_cli',[['todos','Todos os clientes'],...listaClientesEst().map(c=>[c,c])],'Cliente')}${buscaUI('est','Produto, descrição ou cliente')}${selUI('est_falta',[['todos','Todos'],['falta','Com custo faltando'],['ok','Com custo completo']],'Custo')}<span class="small muted">${R.length} produtos faturados no ano com estrutura. <b class="txt-stop">${totFalta.size} componentes sem custo</b>: preencha nas células em vermelho. Valor digitado fica salvo.</span></div>`;
  const meses=Math.max(1,new Date().getMonth()+1);
  h+=tabela('est',[{k:'cod',l:'Produto',cls:()=>'mono'},{k:'desc',l:'Descrição',cls:()=>'trunca',f:r=>`<span title="${esc(r.desc)}">${esc(r.desc)}</span>`},{k:'cli',l:'Cliente',cls:()=>'estreita',v:r=>r.prim,f:r=>`<span class="small" title="${esc(r.cli)}">${esc(r.prim)}</span>`},{k:'q',l:'Qtd. ano',num:1,cls:()=>'estreita',f:r=>num(r.q,0)},{k:'media',l:'Média mês',num:1,cls:()=>'estreita',v:r=>r.q/meses,f:r=>num(r.q/meses,0)},{k:'custo',l:'Custo MP',num:1,f:r=>num(r.custo,2)},{k:'falta',l:'Faltam',num:1,cls:()=>'estreita',f:r=>r.falta?`<span class="pill p-stop">${r.falta}</span>`:'<span class="pill p-done">0</span>'},{k:'preco',l:'Preço',num:1,cls:()=>'estreita',v:r=>r.q?r.valor/r.q:null,f:r=>r.q?num(r.valor/r.q,2):'–'}],R,{ordem:'falta',desc:true,cls:'compacto fit',linha:r=>` class="row" data-est="${esc(r.cod)}" tabindex="0" aria-expanded="${aberto.has(r.cod)}"`,depois:r=>aberto.has(r.cod)?`<tr><td colspan="8" class="detail">${estDetalhe(r.cod,ehVaeso(cliF)||(r.clientes.length>0&&r.clientes.every(ehVaeso)))}</td></tr>`:''});
  if(E.semEstrutura?.length)h+=`<details class="small"><summary>${E.semEstrutura.length} produtos faturados como venda ou industrialização sem estrutura na planilha</summary><p>${E.semEstrutura.map(([c,d])=>`<span class="mono">${esc(c)}</span> ${esc(d)}`).join(' · ')}</p></details>`;
  box.innerHTML=h;
}
function estDetalhe(cod,vae=false){
  const ls=arvoreLinhas(cod,0,1,[],new Set([cod]),vae);const tot=custoPeca(cod,new Set(),vae);
  return `<div class="inner"><table><thead><tr><th>Nível</th><th>Componente</th><th>Descrição</th><th class="num">Qtd. por peça (com perda)</th><th class="num">Custo unitário</th><th>Última compra</th><th class="num">Custo por peça</th></tr></thead><tbody>${ls.map(l=>{
    const ind=`style="padding-left:${10+l.nivel*18}px"`;
    let cel;
    if(l.temE)cel=`<span class="muted small">soma da estrutura</span> ${num(l.custo,2)}`;
    else if(l.zv)cel=`<span class="pill p-info" title="Caixa e master não têm custo nos produtos da Vaeso">Vaeso</span> 0,00`;
    else{const v=l.c?l.c.v:'';const man=l.c?.origem==='manual';cel=`<input class="custo ${l.c?'':'falta'} ${man?'manual':''}" type="text" inputmode="decimal" data-custo="${esc(l.comp)}" value="${v===''?'':num(v,2)}" placeholder="preencher" aria-label="Custo unitário de ${esc(l.comp)}">`}
    const info=l.c?.origem==='compra'?`${dt(l.c.info.data)} · NF ${esc(l.c.info.doc)} · ${esc(l.c.info.um)}`:l.c?.origem==='manual'?`<span class="pill p-info">Manual</span> ${dt(String(l.c.info.em||'').slice(0,10))}`:l.temE?'':'<span class="txt-stop small">Sem compra na planilha</span>';
    return `<tr class="${!l.temE&&!l.c&&!l.zv?'linha-falta':''}"><td ${ind}>${l.nivel+1}</td><td class="mono">${esc(l.comp)}${l.temE?' <span class="pill p-open">estrutura</span>':''}</td><td>${esc(l.desc)}</td><td class="num">${num(l.q,6)}</td><td class="num">${cel}</td><td class="small">${info}</td><td class="num">${l.custo===null?'–':num(l.q*l.custo,2)}</td></tr>`}).join('')}<tr class="tot"><td colspan="6"><b>Custo MP por peça</b>${tot.falta?` <span class="pill p-stop">${tot.falta} sem custo</span>`:''}</td><td class="num"><b>${num(tot.v,2)}</b></td></tr></tbody></table></div><p class="small muted">Custo de compra da última NF na aba ENTRADAS (por data de digitação): valor sem IPI, menos ICMS, PIS 1,65% e COFINS 7,6%. Componente com estrutura própria soma os custos dele. Perda da estrutura já aplicada na quantidade.</p>`;
}

/* ---------- Roteiro ---------- */
/* Clientes de cada produto: os do produto faturado e, descendo a estrutura, os dos produtos que usam o componente. */
function clientesPorProduto(){
  if(M._cliProd)return M._cliProd;const E=M.dados.estruturas;const m=new Map();
  const desce=(cod,cls,vis)=>{if(vis.has(cod))return;vis.add(cod);const s=m.get(cod)||new Set();cls.forEach(c=>s.add(c));m.set(cod,s);for(const [comp] of (E.arvore[cod]||[]))desce(comp,cls,vis)};
  for(const [cod,p] of Object.entries(E.produtos))if(p.clientes?.length)desce(cod,p.clientes,new Set());
  M._cliProd=m;return m;
}
const listaClientesEst=()=>[...new Set(Object.values(M.dados.estruturas.produtos).flatMap(p=>p.clientes||[]))].sort(COLL.compare);
function rotLinhas(){const j=M.dados.roteiro;if(!j)return null;if(!M.rot)M.rot=linhasDe(j).map(r=>({...r,pecasHora:r['Tempo Padrao']?r['Lote Padrao']/r['Tempo Padrao']:null}));return M.rot}
function renderRoteiro(){
  const box=$('v-roteiro');const R=rotLinhas();
  if(!R||!M.dados.estruturas){box.innerHTML=esperando('Carregando o roteiro…');Promise.all([carregar('roteiro'),carregar('estruturas')]).then(renderRoteiro).catch(()=>box.innerHTML=esperando('Não foi possível carregar o roteiro.'));return}
  const E=M.dados.estruturas;const q=ui('b_rot',''),rec=ui('rot_rec','todos'),cliF=ui('rot_cli','todos');const CP=clientesPorProduto();
  const recursos=[...new Set(R.map(r=>r.Descricao))].sort(COLL.compare);
  const F=R.filter(r=>(rec==='todos'||r.Descricao===rec)&&(cliF==='todos'||CP.get(String(r.Produto))?.has(cliF))&&casa(`${r.Produto} ${E.produtos[r.Produto]?.desc||''} ${r.Ferramenta} ${r.Descricao}`,q));
  box.innerHTML=`<div class="tools filtros">${selUI('rot_cli',[['todos','Todos os clientes'],...listaClientesEst().map(c=>[c,c])],'Cliente')}${buscaUI('rot','Produto ou molde')}</div>`+
  tabela('rot',[{k:'Produto',l:'Produto',cls:()=>'mono'},{k:'_d',l:'Descrição',cls:()=>'trunca',v:r=>E.produtos[r.Produto]?.desc||'',f:r=>`<span title="${esc(E.produtos[r.Produto]?.desc||'')}">${esc(E.produtos[r.Produto]?.desc||'')}</span>`},{k:'Operacao',l:'Op.'},{k:'Descr. Oper.',l:'Operação'},{k:'Ferramenta',l:'Molde',cls:()=>'mono'},{k:'CAVIDADES',l:'Cavidades',num:1,f:r=>num(r.CAVIDADES,0)},{k:'CICLO',l:'Ciclo (s)',num:1,f:r=>num(r.CICLO,1)},{k:'pecasHora',l:'Peças/hora',num:1,f:r=>r.pecasHora===null?'–':num(r.pecasHora,1)},{k:'Setup (Hs)',l:'Setup (h)',num:1,f:r=>num(r['Setup (Hs)'],2)},{k:'Mao-de-Obra',l:'Mão de obra',num:1,f:r=>num(r['Mao-de-Obra'],2)}],F,{ordem:'Produto',cls:'compacto fit'});
}

/* ---------- Contabilidade ---------- */
const HORA_MAQ=70,EMB=0.05;
const MESES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const brl0=v=>(v<0?'−':'')+'R$ '+Math.abs(+v||0).toLocaleString('pt-BR',{maximumFractionDigits:0});
function horasPorPeca(cod,vis=new Set()){
  const R=rotLinhas()||[];const E=M.dados.estruturas;
  if(vis.has(cod))return 0;const nv=new Set(vis);nv.add(cod);
  let h=0;for(const r of R)if(r.Produto===cod&&/INJE/i.test(r.Descricao)&&r.pecasHora)h+=1/r.pecasHora;
  for(const [comp,q,perda] of (E?.arvore[cod]||[]))if(E.arvore[comp])h+=q*(1+(perda||0)/100)*horasPorPeca(comp,nv);
  return h;
}
/* Período por mês ou ano inteiro: vale para MC e DRE. */
function periodoMes(){
  const L=fatLinhas();const meses=[...new Set(L.map(l=>l.data.slice(0,7)))].sort().reverse();
  const v=ui('fech_per',()=>meses[0]||'ano');
  return {v,meses,de:v==='ano'?ano+'-01-01':v+'-01',ate:v==='ano'?hojeISO:v+'-31'};
}
function seletorPeriodo(){const p=periodoMes();
  return `<label class="per-sel"><span>Período</span><select data-mf="fech_per">${[['ano','Ano de '+ano],...p.meses.map(m=>[m,MESES[+m.slice(5)-1]+'/'+m.slice(0,4)])].map(([k,l])=>`<option value="${k}" ${p.v===k?'selected':''}>${l}</option>`).join('')}</select></label>`}
const cfg=()=>M.config||{};
function mcLinhas(cli='todos'){
  const L=fatLinhas();const E=M.dados.estruturas;const p=periodoMes();
  const com=(+cfg().comissaoPct||0)/100,fre=(+cfg().fretePct||0)/100;
  const g=new Map();
  for(const l of L){if(l.data<p.de||l.data>p.ate||tipoCfop(l.cfop).t!=='Receita'||(cli!=='todos'&&l.destNome!==cli))continue;
    const o=g.get(l.cod)||{cod:l.cod,desc:l.desc,cli:new Set(),q:0,fat:0,icms:0,piscof:0,ipi:0,mp:0,emb:0,inj:0,horas:0,semE:false,semR:false};
    o.q+=l.q;o.fat+=l.total;o.icms+=l.icms;o.piscof+=l.pis+l.cofins;o.ipi+=l.ipi;
    const temE=!!E.arvore[l.cod];o.mp+=temE?l.q*custoPeca(l.cod,new Set(),ehVaeso(l.destNome)).v:0;o.emb+=l.total*EMB;
    const hp=horasPorPeca(l.cod);o.horas+=l.q*hp;o.inj+=l.q*hp*HORA_MAQ;if(!temE)o.semE=true;if(!hp)o.semR=true;o.cli.add(l.destNome);g.set(l.cod,o)}
  return [...g.values()].map(o=>{const imp=o.icms+o.piscof;const liq=o.fat-imp;const comV=o.fat*com,freV=o.fat*fre;const cv=o.mp+o.inj+o.emb+comV+freV;const mc=liq-cv;
    return {...o,imp,liq,com:comV,frete:freV,mc,mcp:liq?mc/liq:0,custoUnit:o.q?cv/o.q:0,mpUnit:o.q?o.mp/o.q:0,preco:o.q?o.fat/o.q:0,cliTxt:[...o.cli].join(', ')}});
}
/* MC e DRE: valores em reais sem centavos. Preço e custo por peça ficam com duas casas. */
const MC_COLS=[
  {k:'cod',l:'Código',fixa:1,cls:()=>'mono'},
  {k:'desc',l:'Descrição',fixa:1,cls:()=>'trunca',f:r=>`<span title="${esc(r.desc)}">${esc(r.desc)}</span>`},
  {k:'q',l:'Qtde',num:1,f:r=>n0(r.q)},
  {k:'qMes',l:'Qtd/mês',num:1,f:r=>n0(r.qMes)},
  {k:'custoUnit',l:'Custo unit.',num:1,f:r=>num(r.custoUnit,2)},
  {k:'preco',l:'Preço',num:1,f:r=>num(r.preco,2)},
  {k:'fat',l:'Faturamento',num:1,f:r=>n0(r.fat)},
  {k:'fatMes',l:'Fat/mês',num:1,f:r=>n0(r.fatMes)},
  {k:'cliTxt',l:'Clientes',oculta:1,f:r=>`<span class="small">${esc(r.cliTxt)}</span>`},
  {k:'icms',l:'ICMS',num:1,oculta:1,f:r=>n0(r.icms)},
  {k:'piscof',l:'PIS/COFINS',num:1,oculta:1,f:r=>n0(r.piscof)},
  {k:'liq',l:'Receita líquida',num:1,oculta:1,f:r=>n0(r.liq)},
  {k:'mpUnit',l:'MP unit.',num:1,oculta:1,f:r=>num(r.mpUnit,2)},
  {k:'mp',l:'Matéria-prima',num:1,oculta:1,f:r=>n0(r.mp)+(r.semE?' <span class="pill p-warn" title="Sem estrutura: custo MP zerado">sem estrutura</span>':'')},
  {k:'inj',l:'Injeção',num:1,oculta:1,f:r=>n0(r.inj)+(r.semR?' <span class="pill p-warn" title="Sem roteiro de injeção">sem roteiro</span>':'')},
  {k:'horas',l:'Horas máquina',num:1,oculta:1,f:r=>n0(r.horas)},
  {k:'emb',l:'Embalagem',num:1,oculta:1,f:r=>n0(r.emb)},
  {k:'com',l:'Comissão',num:1,oculta:1,f:r=>n0(r.com)},
  {k:'mc',l:'MC R$',num:1,cls:()=>'destaque',f:r=>`<b class="${r.mc<0?'txt-stop':''}">${n0(r.mc)}</b>`},
  {k:'mcp',l:'MC %',num:1,cls:()=>'destaque',f:r=>`<b>${pct(r.mcp)}</b>`,csv:r=>(r.mcp*100).toFixed(1).replace('.',',')}];
function renderMC(){
  const box=$('v-mc');
  if(!fatLinhas()||!M.dados.estruturas||!rotLinhas()){box.innerHTML=esperando('Carregando faturamento, estruturas e roteiro…');Promise.all([carregar('faturamento'),carregar('estruturas'),carregar('roteiro')]).then(renderMC).catch(()=>box.innerHTML=esperando('Não foi possível carregar os dados.'));return}
  const q=ui('b_mc','');const vis=ui('mc_cols',()=>new Set(MC_COLS.filter(c=>!c.oculta).map(c=>c.k)));for(const k of ['cod','desc'])vis.add(k);if(!M.ui.mc_cols_v2){vis.add('qMes');vis.add('fatMes');M.ui.mc_cols_v2=1}
  const clientes=[...new Set(fatLinhas().filter(l=>tipoCfop(l.cfop).t==='Receita').map(l=>l.destNome))].sort(COLL.compare);let cli=ui('mc_cli','todos');if(cli!=='todos'&&!clientes.includes(cli))cli=M.ui.mc_cli='todos';
  const pm=periodoMes(),nMes=pm.v==='ano'?Math.max(1,pm.meses.filter(m=>m.startsWith(String(ano))).length):1;
  const todas=mcLinhas(cli).map(r=>({...r,qMes:r.q/nMes,fatMes:r.fat/nMes}));const R=todas.filter(r=>casa(`${r.cod} ${r.desc} ${r.cliTxt}`,q));
  const fat=todas.reduce((a,r)=>a+r.fat,0),liq=todas.reduce((a,r)=>a+r.liq,0),mc=todas.reduce((a,r)=>a+r.mc,0);
  const ocultas=MC_COLS.filter(c=>!vis.has(c.k)).length;
  M._mcExport=()=>({cols:MC_COLS.filter(c=>vis.has(c.k)),R});
  let h=`<div class="fech-topo">${seletorPeriodo()}</div>
  <div class="cards3"><div class="card-k"><span>Faturamento</span><b>${brl0(fat)}</b></div><div class="card-k"><span>MC R$</span><b>${brl0(mc)}</b></div><div class="card-k verde"><span>MC %</span><b>${pct(liq?mc/liq:0)}</b></div></div>
  <div class="tools barra"><label class="busca"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/></svg><input type="search" id="mb_mc" data-mb="mc" placeholder="Buscar produto ou cliente…" value="${esc(q)}" aria-label="Buscar produto ou cliente"></label>
  <label class="per-sel cli-sel"><span>Cliente</span><select data-mf="mc_cli" aria-label="Cliente">${[['todos','Todos os clientes'],...PRINCIPAIS.map(([k,l])=>[clientes.find(c=>c.includes(k))||'',`★ ${l}`]).filter(x=>x[0]),...clientes.map(c=>[c,c])].map(([k,l])=>`<option value="${esc(k)}" ${cli===k?'selected':''}>${esc(l)}</option>`).join('')}</select></label>
  <span class="cresce"></span><button type="button" class="bt" id="mcExport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 19h14"/></svg>Exportar Excel</button>
  <details class="colsel"><summary>Colunas <span class="small muted">${ocultas} oculta${ocultas===1?'':'s'}</span></summary><div class="colsel-menu">${MC_COLS.filter(c=>!c.fixa).map(c=>`<label><input type="checkbox" data-mccol="${c.k}" ${vis.has(c.k)?'checked':''}> ${esc(c.l)}</label>`).join('')}</div></details></div>`;
  h+=tabela('mc',MC_COLS.filter(c=>vis.has(c.k)),R,{ordem:'mcp',desc:true,cls:'compacto fech'});
  h+=`<p class="small muted">Só CFOP de receita (venda e industrialização). Faturamento = valor dos produtos. Impostos = ICMS + PIS + COFINS do XML. MC % = MC ÷ receita líquida. Qtd/mês e Fat/mês = média por mês do período. Valores em reais sem centavos. Custo unit. = matéria-prima da estrutura + injeção (horas do roteiro × R$ 70) + embalagem (5%) + comissão e frete (% definidos no DRE), por peça.</p>`;
  box.innerHTML=h;
}
/* DRE geral no formato do fechamento. Linhas automáticas vêm do faturamento e da MC. */
function renderDRE(){
  const box=$('v-dre');
  if(!fatLinhas()||!M.dados.estruturas||!rotLinhas()){box.innerHTML=esperando('Carregando os dados…');Promise.all([carregar('faturamento'),carregar('estruturas'),carregar('roteiro')]).then(renderDRE).catch(()=>box.innerHTML=esperando('Não foi possível carregar os dados.'));return}
  const R=mcLinhas();const s=k=>R.reduce((a,r)=>a+r[k],0);const p=periodoMes();const chave=p.v;const man=M.dreValores[chave]||{};const mv=k=>-Math.abs(+man[k]||0);
  const fat=s('fat'),icms=s('icms'),pc=s('piscof'),liq=fat-icms-pc,mp=s('mp'),inj=s('inj'),emb=s('emb'),com=s('com'),fre=s('frete'),mc=liq-mp-inj-emb-com-fre;
  const cf=mv('cf'),lb=mc+cf,adm=mv('dadm'),comr=mv('dcom'),pes=mv('dpes'),ebitda=lb+adm+comr+pes,dep=mv('dep'),fin=+man.rfin||0,lair=ebitda+dep+fin,ir=mv('ir'),ll=lair+ir;
  const ic='<span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="12" height="16" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/></svg></span>';
  const P=v=>fat?pct(v/fat).replace('-','−'):'–';
  const L=(t,v,o={})=>`<tr class="${o.cl||''}"><td class="${o.sub?'sub':''}">${o.icon?ic:''}${t}</td><td class="num">${o.input||brl0(v)}</td><td class="num muted">${P(v)}</td></tr>`;
  const inp=k=>`<input class="custo dre-in" type="text" inputmode="decimal" data-dre="${k}" data-dch="${chave}" value="${man[k]!==undefined&&man[k]!==''?String(man[k]).replace('.',','):''}" placeholder="a validar">`;
  const pin=k=>`<span class="pct-in"><input class="custo" type="text" inputmode="decimal" data-cfg="${k}" value="${cfg()[k]!==undefined&&cfg()[k]!==''?String(cfg()[k]).replace('.',','):''}" placeholder="0"> %</span>`;
  let h=`<div class="fech-topo">${seletorPeriodo()}</div><div class="dre-card"><table class="dre2"><thead><tr><th>DRE</th><th class="num">Valor</th><th class="num">% Fat.</th></tr></thead><tbody>`+
    L('Faturamento bruto',fat,{cl:'forte'})+L('(−) Impostos',-(icms+pc))+L('ICMS',-icms,{sub:1,icon:1})+L('PIS/COFINS',-pc,{sub:1,icon:1})+
    L('= Receita líquida',liq,{cl:'forte'})+L('(−) Matéria-prima',-mp,{icon:1})+L('(−) Injeção',-inj,{icon:1})+L('(−) Embalagem',-emb)+
    `<tr><td>${ic}(−) Comissão ${pin('comissaoPct')}</td><td class="num">${brl0(-com)}</td><td class="num muted">${P(-com)}</td></tr>`+
    `<tr><td>${ic}(−) Frete ${pin('fretePct')}</td><td class="num">${brl0(-fre)}</td><td class="num muted">${P(-fre)}</td></tr>`+
    L('= Margem de contribuição',mc,{cl:'total'})+
    `<tr class="sep"><td colspan="3">Despesas e resultado (preencher e validar)</td></tr>`+
    L('(−) Custos fixos de produção',cf,{input:inp('cf')})+L('= Lucro bruto',lb,{cl:'forte'})+L('(−) Despesas administrativas',adm,{input:inp('dadm')})+L('(−) Despesas comerciais',comr,{input:inp('dcom')})+L('(−) Despesas com pessoal',pes,{input:inp('dpes')})+
    L('= EBITDA',ebitda,{cl:'forte'})+L('(−) Depreciação e amortização',dep,{input:inp('dep')})+L('(+/−) Resultado financeiro',fin,{input:inp('rfin')})+L('= Lucro antes do IR e CSLL',lair,{cl:'forte'})+L('(−) IR e CSLL',ir,{input:inp('ir')})+L('= Lucro líquido',ll,{cl:'total'})+
    `</tbody></table></div><p class="small muted">Comissão e frete em % do faturamento valem para todos os períodos e entram na MC. As despesas abaixo da margem ficam salvas para o período escolhido: digite o valor positivo. No resultado financeiro, use negativo para despesa.</p>`;
  box.innerHTML=h;
}

/* Planilha (CSV que abre no Excel): na página publicada o download passa pela confirmação do Claude. */
async function baixaCsv(nome,texto){
  let dl=null;try{dl=await window.claude?.use?.('downloads')}catch{}
  if(dl){try{await dl.save({filename:nome,data:texto});toast('Planilha salva.')}catch(e){const c=e?.code;if(c==='declined')return;toast(c==='rate_limited'?'Já existe um download aguardando confirmação.':'Não foi possível salvar a planilha aqui.')}return}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([texto],{type:'text/csv;charset=utf-8'}));a.download=nome;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);toast('Planilha gerada.')}
/* Exporta a MC como planilha (CSV com ponto e vírgula, abre no Excel). */
function exportaMC(){const x=M._mcExport&&M._mcExport();if(!x)return;
  const lin=[x.cols.map(c=>c.l).join(';'),...x.R.map(r=>x.cols.map(c=>{const v=c.csv?c.csv(r):r[c.k];return typeof v==='number'?String(Math.round(v*100)/100).replace('.',','):'"'+String(v??'').replace(/"/g,'""')+'"'}).join(';'))];
  baixaCsv('margem-contribuicao-'+ui('fech_per','ano')+(ui('mc_cli','todos')!=='todos'?'-'+ui('mc_cli','todos').split(' ')[0].toLowerCase():'')+'.csv',String.fromCharCode(65279)+lin.join(String.fromCharCode(13,10)))}

/* ---------- Polenta: novidades da aba aberta (pedido do Chai, 26/11/2026) ---------- */
/* Quando chamado, o Polenta conta o que aconteceu por último na tela aberta, em tom animado. Cada novidade: {t (texto), mais (lista)}.
   Só lê o que a tela já tem; o que ainda não carregou fica para a próxima vez que ele for chamado. */
const quemFoi=id=>{const s=String(id||'');const n=(M.pessoas||{})[s.toLowerCase()]?.nome;if(n)return n.split(/\s+/)[0];const p=s.split('@')[0].split(/[._-]/)[0];return p?p[0].toUpperCase()+p.slice(1):'Alguém'};
function quandoFoi(d,hoje){if(d===hoje)return 'hoje';const o=new Date(hoje+'T12:00:00Z');o.setUTCDate(o.getUTCDate()-1);if(d===o.toISOString().slice(0,10))return 'ontem';return 'em '+dt(d)}
const plN=(n,a,b)=>n.toLocaleString('pt-BR')+' '+(n===1?a:b);
function novApontamentos(hoje){
  const L=[];for(const p of Object.values(M.vxOps||{}))for(const it of p.itens||[]){const x=it.produzido;if(!x?.em||!+x.qtd)continue;L.push({dia:diaSP(x.em),por:x.por||'',sku:it.sku||'',desc:it.descricao||'',q:+x.qtd,oc:vxNumero(p)})}
  if(!L.length)return [];const dia=L.reduce((m,x)=>x.dia>m?x.dia:m,''),D=L.filter(x=>x.dia===dia),g=new Map();
  for(const x of D){const k=x.por||'?';(g.get(k)||g.set(k,[]).get(k)).push(x)}
  return [...g.entries()].sort((a,b)=>b[1].length-a[1].length).map(([por,l])=>({t:`Sabia que ${por==='?'?'alguém':quemFoi(por)} apontou ${plN(l.length,'produto','produtos')} ${quandoFoi(dia,hoje)}? Foram ${n0(l.reduce((a,x)=>a+x.q,0))} peças!`,
    pergunta:'Quer saber quais são?',mais:l.map(x=>`${x.sku} · ${x.desc} · ${n0(x.q)} pç (${x.oc})`)}));
}
function novPcp(hoje){
  const out=novApontamentos(hoje),O=vxOrdens().filter(o=>o.status==='aberta'),at=O.filter(o=>o.prevista&&o.prevista<hoje);
  if(at.length)out.push({t:`Olha só: ${plN(at.length,'ordem está atrasada','ordens estão atrasadas')} na Vaeso. Bora dar um gás?`,pergunta:'Quer ver quais?',mais:at.map(o=>`${o.numero} · prevista ${dt(o.prevista)} · ${n0(o.feito)} de ${n0(o.ped)} pç`)});
  const prox=O.filter(o=>o.prevista&&o.prevista>=hoje).sort((a,b)=>a.prevista.localeCompare(b.prevista))[0];
  if(prox)out.push({t:`A próxima entrega é a ${prox.numero}, prevista para ${quandoFoi(prox.prevista,hoje).replace(/^em /,'')}. Já tem ${Math.round(prox.pct)}% produzido!`});
  if(M.movPronto&&M.prtPronto){const p=apontamentosPks(M.vxOps,M.estMov,diaSP).filter(a=>!(M.prtApont||{})[a.id]);
    if(p.length)out.push({t:`Psiu! Tem ${plN(p.length,'apontamento esperando','apontamentos esperando')} para lançar no Protheus.`,pergunta:'Quer ver a lista?',mais:p.slice(0,12).map(a=>`${a.op||'sem OP'} · ${a.sku} · ${n0(a.q)} pç`)})}
  return out;
}
function novFaturamento(hoje){
  const L=fatLinhas();if(!L){carregar('faturamento').then(()=>{if(typeof renderPolenta==='function')renderPolenta()}).catch(()=>{});return []}
  const R=L.filter(l=>tipoCfop(l.cfop).t==='Receita');if(!R.length)return [];
  const dia=R.reduce((m,l)=>l.data>m?l.data:m,''),D=R.filter(l=>l.data===dia),g=new Map();
  for(const l of D){const o=g.get(l.chave)||{n:+l.nota||l.nota,c:l.destNome,v:0};o.v+=l.total;g.set(l.chave,o)}
  const N=[...g.values()].sort((a,b)=>b.v-a.v),tot=N.reduce((a,n)=>a+n.v,0),mes=dia.slice(0,7),fm=R.filter(l=>l.data.startsWith(mes)).reduce((a,l)=>a+l.total,0);
  return [{t:`${N.length===1?'Saiu':'Saíram'} ${plN(N.length,'nota','notas')} ${quandoFoi(dia,hoje)}, somando ${brl0(tot)}! A maior foi para ${nomeCurtoCli(N[0].c)}.`,pergunta:'Quer saber quais foram?',mais:N.map(n=>`NF ${n.n} · ${nomeCurtoCli(n.c)} · ${brl0(n.v)}`)},
    {t:`No mês, o faturamento já está em ${brl0(fm)}. Vamos que vamos!`}];
}
const nomeCurtoCli=s=>String(s||'').split(/\s+/).slice(0,2).join(' ');
function novEstoque(hoje){
  if(!fatLinhas()||!M.vxPronto||!M.movPronto)return [];
  const T=estoquePks(fatLinhas(),M.vxOps,M.estMov,ESTOQUE_ZERO,c=>tipoCfop(c).t==='Receita',ehVaeso,diaSP),V=T.flatMap(r=>r.mov),out=[];
  if(V.length){const dia=V.reduce((m,x)=>x.data>m?x.data:m,''),D=V.filter(x=>x.data===dia),e=D.filter(x=>x.q>0),s=D.filter(x=>x.q<0);
    out.push({t:`${quandoFoi(dia,hoje)[0].toUpperCase()+quandoFoi(dia,hoje).slice(1)} o estoque da Vaeso teve ${plN(e.length,'entrada','entradas')} e ${plN(s.length,'saída','saídas')}!`,pergunta:'Quer ver as movimentações?',mais:D.map(x=>`${x.q>0?'+':'−'}${n0(Math.abs(x.q))} ${x.cod} · ${x.doc}`)})}
  const neg=T.filter(r=>r.saldo<0);if(neg.length)out.push({t:`Atenção: ${plN(neg.length,'produto está','produtos estão')} com saldo negativo. Saiu na nota mais do que foi apontado.`,pergunta:'Quer saber quais?',mais:neg.map(r=>`${r.cod} · ${n0(r.saldo)}`)});
  const pos=T.filter(r=>r.saldo>0);if(pos.length)out.push({t:`Tem ${plN(pos.length,'produto','produtos')} com saldo na PKS esperando a nota para a Vaeso.`,pergunta:'Quer ver quais?',mais:pos.sort((a,b)=>b.saldo-a.saldo).map(r=>`${r.cod} · ${n0(r.saldo)} pç`)});
  return out;
}
function novCusto(hoje){
  const E=M.dados.entradas;if(!E){carregar('entradas').then(()=>{if(typeof renderPolenta==='function')renderPolenta()}).catch(()=>{});return []}
  const it=comprasItens();if(!it.length)return [];const dia=it.reduce((m,x)=>x.data>m?x.data:m,''),D=it.filter(x=>x.data===dia);
  return [{t:`${new Set(D.map(x=>x.doc+'|'+x.forn)).size===1?'Chegou':'Chegaram'} ${plN(new Set(D.map(x=>x.doc+'|'+x.forn)).size,'nota de compra','notas de compra')} ${quandoFoi(dia,hoje)}, com ${plN(new Set(D.map(x=>x.key)).size,'material','materiais')}!`,pergunta:'Quer saber quais?',mais:D.map(x=>`${x.desc} · ${nomeCurtoCli(x.forn)} · R$ ${brl(x.custo)}/${String(x.un||'un').toLowerCase()}`)}];
}
M.novidades=tab=>{
  const hoje=diaSP(Date.now()),f={pcpvaeso:novPcp,estoque:novEstoque,estmov:novEstoque,faturamento:novFaturamento,fpvenda:novFaturamento,custonf:novCusto,nfe:novCusto}[tab];
  try{if(f)return f(hoje);if(tab==='home')return [...novApontamentos(hoje).slice(0,1),...novFaturamento(hoje).slice(0,1),...novEstoque(hoje).slice(0,1)]}catch(e){console.error(e)}
  return [];
};
M.carregarPessoas=db=>db.collection('pessoas').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id.toLowerCase()]=d.data());M.pessoas=o},()=>{});

/* ---------- eventos ---------- */
const RENDER={home:renderHome,estoque:renderEstoque,estmov:renderEstMov,fpvenda:renderFpVenda,pcpvaeso:renderPcpVaeso,custonf:renderCustoNf,formacao:renderFormacao,forn:renderForn,cfop:renderCfop,faturamento:renderFaturamento,clientes:renderClientes,produtos:renderProdutos,nfe:renderNfe,estrutura:renderEstrutura,roteiro:renderRoteiro,mc:renderMC,dre:renderDRE};
M.atual=null;
M.vxPainelAtivo=()=>document.activeElement?.id==='vxQtd';
/* Só um item aberto por vez. */
const umaSo=(s,k)=>{const a=s.has(k);s.clear();if(!a)s.add(k)};
M.mostrar=t=>{if(t!==M.atual){const fica={};for(const k of ['fat_cols2','mc_cols','mc_cols_v2'])if(M.ui[k]!==undefined)fica[k]=M.ui[k];M.ui={...fica,...(M._levar||{})};M._levar=null}M.atual=t;if(RENDER[t])RENDER[t]()};
function perMudou(){for(const k of Object.keys(M.ui))if(k.startsWith('tb_'))M.ui[k].pag=0;rerender()}
function rerender(){if(RENDER[M.atual]){const ae=document.activeElement,id=ae?.id,ss=ae?.selectionStart;RENDER[M.atual]();if(id){const n=document.getElementById(id);if(n&&n!==ae){n.focus();try{n.setSelectionRange(ss,ss)}catch{}}}}}
document.addEventListener('click',e=>{
  const t=e.target;
  const so=t.closest('button.sort[data-mt]');if(so){const st=ui('tb_'+so.dataset.mt,()=>({}));const k=so.dataset.mk;if(st.k===k)st.desc=!st.desc;else{st.k=k;st.desc=['q','total','preco','imp','nNotas','bruto','liq','mp','emb','inj','mc','mcp','custo','falta','saldo','ent','sai','valor','pecasHora','CAVIDADES','CICLO'].includes(k)}st.pag=0;rerender();document.querySelector(`button.sort[data-mt="${so.dataset.mt}"][data-mk="${k}"]`)?.focus();return}
  const pg=t.closest('[data-mp]');if(pg){const st=ui('tb_'+pg.dataset.mp,()=>({pag:0}));st.pag=Math.max(0,(st.pag||0)+(+pg.dataset.dir));rerender();return}
  const tf=t.closest('[data-trocaforn]');if(tf){ui('forn_edit',()=>new Set()).add(tf.dataset.trocaforn+'|'+tf.dataset.campo);rerender();return}
  const ic=t.closest('[data-ircfop]');if(ic){M._levar={b_cfop:ic.dataset.ircfop,cfop_lado:'123'.includes(String(ic.dataset.ircfop)[0])?'Entrada':'Saída'};location.hash='#cfop';return}
  const po=t.closest('[data-perop]');if(po){const k=po.dataset.perop,p=ui('per_'+k,()=>({}));if(po.dataset.tipo==='dias'){const n=+po.dataset.v,d=new Date();d.setDate(d.getDate()-n+1);Object.assign(p,{modo:'dias',n,de:isoD(d),ate:hojeISO})}else Object.assign(p,{modo:'ano',de:ano+'-01-01',ate:hojeISO});perMudou();return}
  const pa=t.closest('[data-peraplica]');if(pa){const k=pa.dataset.peraplica,de=$('perDe_'+k)?.value,at=$('perAte_'+k)?.value;if(!de||!at||de>at){toast('Informe a data inicial e a final, com a inicial antes da final.');return}Object.assign(ui('per_'+k,()=>({})),{modo:'int',de,ate:at});perMudou();return}
  const ir=t.closest('[data-ir]');if(ir){location.hash='#'+ir.dataset.ir;return}
  const us=t.closest('[data-uiset]');if(us){M.ui[us.dataset.uiset]=us.dataset.v;for(const k of Object.keys(M.ui))if(k.startsWith('tb_'))M.ui[k].pag=0;rerender();return}
  if(t.closest('#nfaExport')){exportaNfa();return}
  const nc=t.closest('[data-novacat]');if(nc){const inp=$('novaCat');const v=(inp?.value||'').trim();if(!v){inp?.focus();return}
    if(categorias().some(c=>c.toLowerCase()===v.toLowerCase())){toast('Essa classificação já existe.');return}
    if(!S.db){toast('Sem conexão com a base. A classificação não foi criada.');return}
    const lista=[...categorias(),v];S.db.doc('config/categorias').set({lista,em:new Date().toISOString()}).then(()=>{M.cats=lista;toast('Classificação criada: '+v+'.');rerender()}).catch(()=>toast('A classificação não foi criada. Tente novamente.'));return}
  const fv=t.closest('[data-fv]');if(fv){M.ui.fat_vis=fv.dataset.fv;rerender();return}
  const mv=t.closest('[data-mcv]');if(mv){M.ui.mc_vis=mv.dataset.mcv;rerender();return}
  if(t.closest('#mcExport')){exportaMC();return}
  if(t.closest('#fpvExcel')){exportaFpv();return}
  if(t.closest('#fpvPdf')){window.print();return}
  const fx=t.closest('[data-fpvexp]');if(fx){const s=ui('fpv_exp',()=>new Set());const k=fx.dataset.fpvexp;s.has(k)?s.delete(k):s.add(k);rerender();document.querySelector(`[data-fpvexp="${k}"]`)?.focus();return}
  const fq=t.closest('[data-fpvq]');if(fq){const [k,cod]=fq.dataset.fpvq.split('|');const a=M.ui.fpv_q;const abre=!(a&&a.k===k&&a.cod===cod);M.ui.fpv_q=abre?{k,cod}:null;M._fpvVolta=fq.dataset.fpvq;rerender();if(abre)document.querySelector('.fpv-gav .fpv-x')?.focus();return}
  if(t.closest('[data-fpvfecha]')){fpvFecha();return}
  const fe=t.closest('[data-fpvembl]');if(fe){salvaFicha(fe.dataset.fpvembl,{embSim:''},'Embalagem calculada de volta.');return}
  const fi=t.closest('[data-fpvinjl]');if(fi){const [cod,peca]=fi.dataset.fpvinjl.split('|');const io={...((M.form[cod]||{}).injOv||{})};delete io[peca];salvaFicha(cod,{injOv:io},'Cavidades e ciclo do roteiro de volta.');return}
  const fl=t.closest('[data-fpvlimpa]');if(fl){salvaFicha(fl.dataset.fpvlimpa,{precoSim:''},'Preço médio de volta.');return}
  const fm=t.closest('[data-fpvmodo]');if(fm){salvaFpv({modo:fm.dataset.fpvmodo});return}
  if(t.closest('input,select'))return;
  const eq=t.closest('tr[data-estq]');if(eq){umaSo(ui('estq_open',()=>new Set()),eq.dataset.estq);rerender();return}
  const fn=t.closest('tr[data-fatnota]');if(fn){umaSo(ui('fatn_open',()=>new Set()),fn.dataset.fatnota);rerender();return}
  const fc=t.closest('[data-fatbar]');if(fc){const [de,ate,mes]=fc.dataset.fatbar.split('|');Object.assign(ui('per_fat',()=>({})),mes?{modo:'mes',de,ate}:{modo:'int',de,ate});M.ui.fat_vis='notas';perMudou();document.querySelector('#v-faturamento .seg[aria-label="Visão"]')?.scrollIntoView({block:'start',behavior:'smooth'});return}
  const no=t.closest('tr[data-nfopen]');if(no){const s=ui('nfa_open',()=>new Set());const k=no.dataset.nfopen;umaSo(s,k);rerender();return}
  const ve=t.closest('[data-vxenc]');if(ve){vxEncerrar(ve.dataset.vxenc);return}
  const pr=t.closest('[data-prt]');if(pr){marcaProtheus(pr.dataset.prt,true);return}
  const pv=t.closest('[data-prtvolta]');if(pv){marcaProtheus(pv.dataset.prtvolta,false);return}
  const vr=t.closest('[data-vxord]');if(vr){umaSo(ui('vx_ord',()=>new Set()),vr.dataset.vxord);ui('vx_open',()=>new Set()).clear();M.ui.vx_modo='';M.vxErro='';M.vxVal='';rerender();document.querySelector(`[data-vxord="${CSS.escape(vr.dataset.vxord)}"]`)?.focus();return}
  const vo=t.closest('[data-vxopen]');if(vo){umaSo(ui('vx_open',()=>new Set()),vo.dataset.vxopen);M.ui.vx_modo='';M.vxErro='';M.vxVal='';rerender();return}
  const vm=t.closest('[data-vxmodo]');if(vm){M.ui.vx_modo=vm.dataset.vxmodo;M.vxErro='';M.vxFoco=true;rerender();return}
  const vk=t.closest('[data-vxok]');if(vk){vxEnviar(vk.dataset.vxok,'confirmar',vk.dataset.conf);return}
  const vd=t.closest('[data-vxdesf]');if(vd){if(confirm('Desfazer a confirmação deste item na Vaeso?'))vxEnviar(vd.dataset.vxdesf,'desfazer');return}
  const cn=t.closest('[data-cnfopen]');if(cn){const s=ui('cnf_open',()=>new Set());const k=cn.dataset.cnfopen;umaSo(s,k);rerender();return}
  if(t.closest('#cnfExcel')){exportaCnf();return}
  if(t.closest('#cnfPrint')){window.print();return}
  const fe2=t.closest('[data-fpest]');if(fe2){M._levar={b_est:fe2.dataset.fpest};location.hash='#estrutura';return}
  const fo=t.closest('[data-fpopen]');if(fo){const s=ui('fp_open',()=>new Set());const k=fo.dataset.fpopen;umaSo(s,k);rerender();return}
  const er=t.closest('tr[data-est]');if(er){const s=ui('est_open',()=>new Set());const k=er.dataset.est;umaSo(s,k);rerender();return}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&M.atual==='fpvenda'&&M.ui.fpv_q){fpvFecha();return}if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('tr[data-est],tr[data-nfopen],tr[data-fatnota],tr[data-estq],[data-fatbar],[data-vxord],[data-fpopen],[data-cnfopen],td[data-fpvq]')){e.preventDefault();e.target.click()}});
document.addEventListener('change',async e=>{
  const t=e.target;
  if(t.dataset.fpvpreco){const raw=t.value.trim();const v=raw===''?'':+raw.replace(/\./g,'').replace(',','.');if(raw!==''&&!(isFinite(v)&&v>0)){toast('Preço inválido. Use números, por exemplo 12,50.');return}salvaFicha(t.dataset.fpvpreco,{precoSim:v},v===''?'Preço médio de volta.':'Preço para simular salvo.');return}
  if(t.dataset.fpvprem){const k=t.dataset.fpvprem,raw=t.value.trim();const v=raw===''?'':+(k==='horaMaq'?raw.replace(/\./g,''):raw).replace(',','.');if(raw!==''&&!(isFinite(v)&&v>=0&&(k==='horaMaq'?v<100000:v<100))){toast(k==='horaMaq'?'Valor inválido.':'Percentual inválido.');return}salvaFpv({[k]:v});return}
  const numBr=raw=>raw===''?'':+raw.replace(/\./g,'').replace(',','.');
  if(t.dataset.fpvkg){const v=numBr(t.value.trim());if(v!==''&&!(isFinite(v)&&v>=0)){toast('Valor inválido. Use números, por exemplo 12,50.');return}const m={...(fpvPrem().mpKg)};if(v==='')delete m[t.dataset.fpvkg];else m[t.dataset.fpvkg]=v;salvaFpv({mpKg:m});return}
  if(t.dataset.fpvemb){const v=numBr(t.value.trim());if(v!==''&&!(isFinite(v)&&v>=0)){toast('Valor inválido. Use números, por exemplo 0,05.');return}salvaFicha(t.dataset.fpvemb,{embSim:v},v===''?'Embalagem calculada de volta.':'Embalagem salva.');return}
  if(t.dataset.fpvinj){const [cod,peca,campo]=t.dataset.fpvinj.split('|');const v=numBr(t.value.trim());if(v!==''&&!(isFinite(v)&&v>0)){toast('Valor inválido.');return}const io={...((M.form[cod]||{}).injOv||{})};io[peca]={...(io[peca]||{}),[campo]:v};salvaFicha(cod,{injOv:io},'Processo salvo.');return}
  if(t.dataset.fpmp){const c=t.dataset.fpmp;salvaFicha(c,{mp:{...((M.form[c]||{}).mp||{}),[t.dataset.key]:t.value}});return}
  if(t.dataset.fpf){const v=t.dataset.campo==='tipo'?t.value:Math.max(0,Math.round(+t.value||0));salvaFicha(t.dataset.fpf,{[t.dataset.campo]:v});return}
  if(t.dataset.fpm){const v=Math.max(0,Math.min(90,+String(t.value).replace(',','.')||0));M.ui.fp_margem=v;rerender();return}
  if(t.dataset.permes){if(!t.value)return;const m=t.value,f=new Date(+m.slice(0,4),+m.slice(5,7),0);Object.assign(ui('per_'+t.dataset.permes,()=>({})),{modo:'mes',de:m+'-01',ate:isoD(f)});perMudou();return}
  if(t.dataset.per){const p=ui('per_'+t.dataset.per,()=>({}));p[t.dataset.lado]=t.value;for(const k of Object.keys(M.ui))if(k.startsWith('tb_'))M.ui[k].pag=0;rerender();return}
  if(t.dataset.uichk){M.ui[t.dataset.uichk]=t.checked;for(const k of Object.keys(M.ui))if(k.startsWith('tb_'))M.ui[k].pag=0;rerender();return}
  if(t.dataset.mf){M.ui[t.dataset.mf]=t.value;for(const k of Object.keys(M.ui))if(k.startsWith('tb_'))M.ui[k].pag=0;rerender();return}
  if(t.dataset.cls){if(!S.db){toast('Sem conexão com a base. A classificação não foi salva.');return}
    const id=t.dataset.cls+'_'+t.dataset.id;const atual={...(M.classif[id]||{}),[t.dataset.campo]:t.value,em:new Date().toISOString()};
    M.classif[id]=atual;t.className='clsel '+t.value;
    try{await S.db.doc('classif/'+id.replace(/[^A-Za-z0-9_:.-]/g,'-')).set(atual);toast('Classificação salva.')}catch{toast('A classificação não foi salva. Tente novamente.')}return}
  if(t.dataset.fatcol){const v=ui('fat_cols2',()=>new Set());t.checked?v.add(t.dataset.fatcol):v.delete(t.dataset.fatcol);rerender();document.querySelector('details.colsel')?.setAttribute('open','');return}
  if(t.dataset.mccol){const v=ui('mc_cols',()=>new Set());t.checked?v.add(t.dataset.mccol):v.delete(t.dataset.mccol);rerender();document.querySelector('details.colsel')?.setAttribute('open','');return}
  if(t.dataset.cfg){const raw=t.value.trim();const v=raw===''?'':+raw.replace(',','.');if(raw!==''&&!isFinite(v)){toast('Valor inválido.');return}
    if(!S.db){toast('Sem conexão com a base.');return}
    try{await S.db.doc('config/contabilidade').set({...(M.config||{}),[t.dataset.cfg]:v,em:new Date().toISOString()});toast('Percentual salvo.')}catch{toast('Não foi possível salvar.')}return}
  if(t.dataset.itcampo){const cod=t.dataset.cod;if(!S.db){toast('Sem conexão com a base. O item não foi salvo.');return}
    const atual={...(M.custosManuais[cod]||{}),[t.dataset.itcampo]:t.value.trim(),em:new Date().toISOString()};M.custosManuais[cod]=atual;
    try{await S.db.doc('custos/'+cod).set(atual);toast('Item salvo.')}catch{toast('O item não foi salvo. Tente novamente.')}return}
  if(t.dataset.custo){const cod=t.dataset.custo;const raw=t.value.trim();const v=raw===''?null:+raw.replace(/\./g,'').replace(',','.');
    if(raw!==''&&!isFinite(v)){toast('Valor inválido. Use números, por exemplo 12,50.');return}
    if(!S.db){toast('Sem conexão com a base. O custo não foi salvo.');return}
    try{await S.db.doc('custos/'+cod).set({...(M.custosManuais[cod]||{}),valor:v,em:new Date().toISOString()});toast(v===null?'Custo manual removido.':'Custo salvo.')}catch{toast('O custo não foi salvo. Tente novamente.')}return}
  if(t.dataset.dre){const raw=t.value.trim();const v=raw===''?'':+raw.replace(/\./g,'').replace(',','.');if(raw!==''&&!isFinite(v)){toast('Valor inválido.');return}
    if(!S.db){toast('Sem conexão com a base.');return}
    const ch=t.dataset.dch;const atual={...(M.dreValores[ch]||{}),[t.dataset.dre]:v};
    try{await S.db.doc('dre/'+ch.replace(/[^0-9_-]/g,'')).set(atual);toast('Valor salvo.')}catch{toast('Não foi possível salvar.')}return}
});
document.addEventListener('input',e=>{const t=e.target;if(t.dataset?.mb){M.ui['b_'+t.dataset.mb]=t.value;const k='tb_'+({fat:'fat_'+ui('fat_vis','itens'),fpv:'',est:'est',rot:'rot',nfe:'nfa',cli:'cli',prod:'prod',mc:'mc',forn:'forn',cfop:'cfop'}[t.dataset.mb]||'');if(M.ui[k])M.ui[k].pag=0;clearTimeout(M._t);M._t=setTimeout(rerender,180)}});

/* custos manuais e DRE salvos no banco */
(function esperaDb(){if(!S.db){setTimeout(esperaDb,500);return}
  S.db.collection('custos').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.custosManuais=o;if(['estrutura','mc','dre','produtos','formacao','custonf','fpvenda'].includes(M.atual)&&!(document.activeElement?.dataset?.custo)&&!(document.activeElement?.dataset?.itcampo))rerender()},()=>{});
  S.db.collection('formacao').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.form=o;if((M.atual==='formacao'||M.atual==='fpvenda')&&!document.activeElement?.dataset?.fpf&&!document.activeElement?.dataset?.fpmp&&!document.activeElement?.dataset?.fpvpreco&&!document.activeElement?.dataset?.fpvemb&&!document.activeElement?.dataset?.fpvinj)rerender()},()=>{});
  S.db.collection('classif').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.classif=o;if(!document.activeElement?.dataset?.cls)rerender()},()=>{});
  S.db.doc('config/categorias').onSnapshot(s=>{M.cats=s.exists?(s.data().lista||[]):[];if(['forn','nfe'].includes(M.atual))rerender()},()=>{});
  S.db.collection('vaeso_ops').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.vxOps=o;M.vxPronto=true;if(['estoque','estmov'].includes(M.atual)||M.atual==='pcpvaeso'&&!M.vxPainelAtivo())rerender()},()=>{M.vxPronto=true;if(['pcpvaeso','estoque','estmov'].includes(M.atual))rerender()});
  S.db.collection('vaeso_prod').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.vxProd=o;if(M.atual==='pcpvaeso'&&!M.vxPainelAtivo())rerender()},()=>{});
  S.db.collection('estoque_mov').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.estMov=o;M.movPronto=true;if(['estoque','estmov','pcpvaeso'].includes(M.atual))rerender()},()=>{M.movPronto=true;if(['estoque','estmov','pcpvaeso'].includes(M.atual))rerender()});
  M.carregarPessoas(S.db);
  S.db.collection('protheus_apont').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.prtApont=o;M.prtPronto=true;if(M.atual==='pcpvaeso'&&!M.vxPainelAtivo())rerender()},()=>{M.prtPronto=true;if(M.atual==='pcpvaeso')rerender()});
  S.db.collection('pcp_linhas').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.vxLin=o;if(M.atual==='pcpvaeso'&&!M.vxPainelAtivo())rerender()},()=>{});
  S.db.doc('meta/vaeso_sync').onSnapshot(s=>{M.vxMeta=s.exists?s.data():null;if(M.atual==='pcpvaeso'&&!M.vxPainelAtivo())rerender()},()=>{});
  S.db.doc('config/contabilidade').onSnapshot(s=>{M.config=s.exists?s.data():{};if(['mc','dre','fpvenda'].includes(M.atual)&&!(document.activeElement?.dataset?.cfg))rerender()},()=>{});
  S.db.doc('config/fpvenda').onSnapshot(s=>{M.fpv=s.exists?s.data():{};if(M.atual==='fpvenda'&&!document.activeElement?.dataset?.fpvprem&&!document.activeElement?.dataset?.fpvkg)rerender()},()=>{});
  S.db.collection('dre').onSnapshot(s=>{const o={};s.docs.forEach(d=>o[d.id]=d.data());M.dreValores=o;if(M.atual==='dre'&&!(document.activeElement?.dataset?.dre))rerender()},()=>{});
})();
})();
/* Abre o módulo da URL ao carregar. */
setTimeout(()=>{const t=location.hash.slice(1)||'home';if(window.MOD&&t)window.MOD.mostrar(t)},0);
