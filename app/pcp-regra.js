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
function situacaoLinha(item,marca,ordemAberta){
  if(!ordemAberta)return 'finalizada';
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
        marcada:!!(p&&marca&&marca.encerrada&&+marca.qtd===+p.qtd),pendente:env&&env.envio==='pendente'?env:null}});
    const ped=itens.reduce((a,r)=>a+r.qtd,0),feito=itens.reduce((a,r)=>a+(r.prod||0),0);
    return {id:String(o.id),op_id:o.id,numero:vxNumero(o),emitida:o.emitida_em||'',prevista:o.prevista_em||'',status:o.status,itens,ped,feito,
      pct:ped?Math.min(1,feito/ped):0,abertas:itens.filter(r=>r.sit==='aberta'),finalizadas:itens.filter(r=>r.sit==='finalizada'),
      /* todas as linhas prontas, alguma a menos: a Vaeso não encerra sozinha, é preciso encerrar a ordem */
      encerrar:aberta&&itens.length>0&&itens.every(r=>r.sit==='finalizada'&&!r.pendente)&&itens.some(r=>r.marcada)}});
}
const R={vxNumero,conferir,situacaoLinha,montar};
if(typeof module!=='undefined'&&module.exports)module.exports=R;else raiz.PCP=R;
})(typeof window!=='undefined'?window:globalThis);
