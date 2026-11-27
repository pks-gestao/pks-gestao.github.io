/* Regras do apontamento no Painel PKS (pedido do Chai, 25/11/2026), sem tela e sem rede.
   - Igual à ordem ou a mais: a linha do produto vai sozinha para Finalizadas.
   - A menos: a pessoa escolhe encerrar a linha (marca em pcp_linhas) ou continuar aberta.
   A marca guarda a quantidade apontada: se o apontamento mudar depois, ela deixa de valer e a linha volta a ser avaliada.
   Só conta o produzido que a Vaeso já recebeu (vaeso_ops); apontamento "a enviar" não finaliza a linha. */
(function(raiz){
'use strict';
const vxNumero=o=>/^\d+$/.test(String(o.numero||''))?'OC '+o.numero:String(o.numero||'OC '+o.id);
const pedidoInteiro=q=>Math.round(+q||0);
/* Confere a quantidade digitada: devolve {erro} ou {qtd, conferencia} */
function conferir(modo,valor,pedido){
  if(modo==='igual')return {qtd:pedidoInteiro(pedido),conferencia:'igual'};
  const v=Number(String(valor??'').trim().replace(/\./g,'').replace(',','.'));
  if(!Number.isInteger(v)||v<=0)return {erro:'Informe a quantidade produzida, sem casas decimais.'};
  if(modo==='menos'&&v>=pedido)return {erro:'A quantidade precisa ser menor que a da ordem.'};
  if(modo==='mais'&&v<=pedido)return {erro:'A quantidade precisa ser maior que a da ordem.'};
  return {qtd:v,conferencia:modo};
}
/* semApontar (27/11/2026, pedido do Chai): linha dada como produzida só na PKS, sem apontamento, sem estoque e sem ir à Vaeso */
function situacaoLinha(item,marca,ordemAberta){
  if(!ordemAberta||marca?.semApontar)return 'finalizada';
  const p=item.produzido;if(!p)return 'aberta';
  if(p.conferencia==='igual'||p.conferencia==='mais'||+p.qtd>=pedidoInteiro(item.qtd))return 'finalizada';
  return marca&&marca.encerrada&&+marca.qtd===+p.qtd?'finalizada':'aberta';
}
function montar(ops,prods,marcas){
  return Object.values(ops||{}).map(o=>{
    const aberta=o.status==='aberta';
    const itens=(o.itens||[]).map(it=>{const k=o.id+'|'+it.produto_id,env=(prods||{})[k],p=it.produzido||null,marca=(marcas||{})[k];
      return {k,op_id:o.id,produto_id:it.produto_id,oc:vxNumero(o),sku:it.sku||'',desc:it.descricao||'',op:it.op_pks||'',qtd:+it.qtd||0,ent:+it.entregue||0,
        prod:p?+p.qtd||0:null,em:p?.em||'',por:p?.por||'',ordemAberta:aberta,sit:situacaoLinha(it,marca,aberta),
        manual:!!marca?.semApontar,marcada:!!(marca?.semApontar||p&&marca&&marca.encerrada&&+marca.qtd===+p.qtd),pendente:env&&env.envio==='pendente'?env:null}});
    const ped=itens.reduce((a,r)=>a+r.qtd,0),feito=itens.reduce((a,r)=>a+(r.prod||0),0);
    return {id:String(o.id),op_id:o.id,numero:vxNumero(o),emitida:o.emitida_em||'',prevista:o.prevista_em||'',status:o.status,itens,ped,feito,
      pct:ped?Math.min(1,feito/ped):0,abertas:itens.filter(r=>r.sit==='aberta'),finalizadas:itens.filter(r=>r.sit==='finalizada'),
      /* todas as linhas prontas, alguma a menos: a Vaeso não encerra sozinha, é preciso encerrar a ordem */
      encerrar:aberta&&itens.length>0&&itens.every(r=>r.sit==='finalizada'&&!r.pendente)&&itens.some(r=>r.marcada)&&!itens.some(r=>r.manual)}});
}
/* Busca: todas as palavras no número da ordem, no código, na descrição ou na OP de um produto, sem ligar para acento */
const limpo=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const casa=(o,q,L=o.itens)=>{const p=limpo(q).split(/\s+/).filter(Boolean);if(!p.length)return true;const tem=t=>p.every(w=>t.includes(w));const n=limpo(o.numero);
  return tem(n)||L.some(r=>tem(n+' '+limpo(r.sku+' '+r.desc+' '+r.op)))};
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
const R={diaSP,produzidosNosDias,casa,vxNumero,conferir,situacaoLinha,montar};
if(typeof module!=='undefined'&&module.exports)module.exports=R;else raiz.PCP=R;
})(typeof window!=='undefined'?window:globalThis);
