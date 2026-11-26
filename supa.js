/* Sistema PKS fora do Claude: faz o papel de window.claude.use('db'|'user'|'downloads') com o Supabase
   e entrega os arquivos de dados (dados/*.json, padrao.json, historico.json) a partir da tabela arquivos.
   Carregado antes dos scripts da página. Nada da empresa fica no GitHub: tudo vem do Supabase depois do login. */
(function(){
  const C=window.PKS_CONFIG||{};
  /* Tudo do PKS fica no esquema pks do projeto, separado do que já existe nele. */
  /* Link do convite ou do "Esqueci a senha" (26/11/2026): chega com #...type=invite|recovery; depois de entrar, pede a senha */
  const tipoLink=(/[#&]type=(invite|recovery)/.exec(location.hash)||[])[1]||'';
  const sb=window.supabase.createClient(C.url,C.anonKey,{db:{schema:'pks'}});
  let sessao=null,perfil=null;

  /* ---------- login ---------- */
  const estilo=`#pksLogin{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:#f6f5f3;font:15px system-ui,sans-serif;color:#2b2a28}
#pksLogin form{background:#fff;border:1px solid #e3e0dc;border-radius:16px;padding:28px;width:min(360px,calc(100vw - 32px));display:grid;gap:12px;box-sizing:border-box}
#pksLogin h1{margin:0 0 4px;font-size:20px}#pksLogin label{display:grid;gap:4px;font-size:13px;color:#6e6d6a}
#pksLogin input{font:15px system-ui;padding:10px 12px;border:1px solid #d6d2cd;border-radius:10px}
#pksLogin button{font:600 15px system-ui;padding:11px;border:0;border-radius:10px;background:#b22222;color:#fff;cursor:pointer}
#pksLogin .lk{all:unset;cursor:pointer;color:#8a1f1f;font-size:13px;text-align:center}#pksLogin .msg{font-size:13px;min-height:18px;color:#8a1f1f}
@media (prefers-color-scheme:dark){#pksLogin{background:#1a1a19;color:#eee}#pksLogin form{background:#242322;border-color:#3a3836}#pksLogin input{background:#1a1a19;color:#eee;border-color:#3a3836}}`;
  function telaLogin(){return new Promise(ok=>{
    const st=document.createElement('style');st.textContent=estilo;document.head.appendChild(st);
    const w=document.createElement('div');w.id='pksLogin';
    w.innerHTML=`<form><h1>Sistema PKS</h1><label>E-mail<input type="email" name="e" required autocomplete="username"></label>
      <label>Senha<input type="password" name="s" required minlength="8" autocomplete="current-password"></label>
      <button type="submit">Entrar</button><div class="msg" role="status"></div>
      <button type="button" class="lk" data-a="criar">Primeiro acesso: criar senha</button><button type="button" class="lk" data-a="esqueci">Esqueci a senha</button></form>`;
    document.body.appendChild(w);const f=w.querySelector('form'),msg=w.querySelector('.msg');
    const dados=()=>({email:f.e.value.trim().toLowerCase(),password:f.s.value});
    f.addEventListener('submit',async e=>{e.preventDefault();msg.textContent='Entrando…';
      const {data,error}=await sb.auth.signInWithPassword(dados());
      if(error){msg.textContent=/confirm/i.test(error.message)?'Confirme o e-mail pelo link que enviamos.':'E-mail ou senha incorretos.';return}
      w.remove();ok(data.session)});
    w.addEventListener('click',async e=>{const a=e.target.dataset.a;if(!a)return;const d=dados();
      if(!d.email){msg.textContent='Digite o e-mail.';return}
      if(a==='criar'){if((d.password||'').length<8){msg.textContent='Crie uma senha com pelo menos 8 caracteres.';return}
        const {error}=await sb.auth.signUp({...d,options:{emailRedirectTo:location.origin+location.pathname}});
        msg.textContent=error?'Não foi possível criar o acesso.':'Enviamos um link para o seu e-mail. Confirme e depois entre.'}
      if(a==='esqueci'){await sb.auth.resetPasswordForEmail(d.email,{redirectTo:location.origin+location.pathname});msg.textContent='Se o e-mail estiver cadastrado, enviamos o link para trocar a senha.'}});
  })}
  function telaSenha(nome,convite){return new Promise(ok=>{
    const st=document.createElement('style');st.textContent=estilo;document.head.appendChild(st);
    const w=document.createElement('div');w.id='pksLogin';
    w.innerHTML=`<form><h1>${convite?'Bem-vindo'+(nome?', '+nome.replace(/[<>&"]/g,''):'')+'!':'Nova senha'}</h1><p style="margin:0;font-size:14px;color:#6e6d6a">${convite?'Crie a senha que você vai usar para entrar no Sistema PKS.':'Digite a nova senha do Sistema PKS.'}</p>
      <label>Senha<input type="password" name="s" required minlength="8" autocomplete="new-password"></label><label>Repita a senha<input type="password" name="r" required minlength="8" autocomplete="new-password"></label>
      <button type="submit">${convite?'Criar senha e entrar':'Salvar senha'}</button><div class="msg" role="status"></div></form>`;
    document.body.appendChild(w);const f=w.querySelector('form'),msg=w.querySelector('.msg');f.s.focus();
    f.addEventListener('submit',async e=>{e.preventDefault();
      if(f.s.value.length<8){msg.textContent='Use pelo menos 8 caracteres.';return}if(f.s.value!==f.r.value){msg.textContent='As duas senhas não são iguais.';return}
      msg.textContent='Salvando…';const {error}=await sb.auth.updateUser({password:f.s.value});
      if(error){msg.textContent=/different|same/i.test(error.message)?'Escolha uma senha diferente da anterior.':'Não foi possível salvar. Peça um novo link ao administrador.';return}
      w.remove();ok()})})}

  const pronto=(async()=>{
    if(document.readyState==='loading')await new Promise(r=>document.addEventListener('DOMContentLoaded',r,{once:true}));
    const {data}=await sb.auth.getSession();sessao=data.session||await telaLogin();
    if(tipoLink&&data.session){history.replaceState(null,'',location.pathname+location.search);await telaSenha(sessao.user.user_metadata?.nome||'',tipoLink==='invite')}
    const email=sessao.user.email.toLowerCase();
    const r=await sb.from('usuarios').select('*').eq('email',email).maybeSingle();perfil=r.data||null;
    botaoSair();return {email,perfil};
  })();
  function botaoSair(){const p=document.querySelector('.perfil');if(!p||p.querySelector('.pks-sair'))return;
    const b=document.createElement('button');b.type='button';b.className='pks-sair';b.textContent='Sair';
    b.style.cssText='all:unset;cursor:pointer;margin-left:auto;font-size:12px;opacity:.8;text-decoration:underline';
    b.onclick=async()=>{await sb.auth.signOut();location.reload()};p.appendChild(b)}

  /* ---------- banco: mesmo formato do db do Claude ---------- */
  const snapDoc=(id,data)=>({id,exists:data!=null,data:()=>data==null?undefined:data});
  const snapCol=docs=>({docs:docs.map(d=>({id:d.id,exists:true,data:()=>d.data})),size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:false}});
  const deUsuario=r=>({id:r.email,data:{setor:r.setor,abas:r.abas||[],admin:r.admin}});
  async function lerCol(c){
    if(c==='usuarios'){const {data,error}=await sb.from('usuarios').select('*');if(error)throw error;return data.map(deUsuario)}
    const {data,error}=await sb.from('docs').select('id,data').eq('colecao',c);if(error)throw error;return data}
  async function lerDoc(c,id){
    if(c==='usuarios'){const {data,error}=await sb.from('usuarios').select('*').eq('email',id).maybeSingle();if(error)throw error;return data?deUsuario(data).data:null}
    const {data,error}=await sb.from('docs').select('data').eq('colecao',c).eq('id',id).maybeSingle();if(error)throw error;return data?data.data:null}
  async function gravar(c,id,obj){
    if(c==='usuarios'){const atual=await lerDoc(c,id);const {error}=await sb.from('usuarios').upsert({email:id,setor:obj.setor??atual?.setor??'',abas:obj.abas??atual?.abas??[],admin:atual?.admin??false,em:new Date().toISOString()});if(error)throw error;return}
    const {error}=await sb.from('docs').upsert({colecao:c,id,data:obj,em:new Date().toISOString()});if(error)throw error}
  async function apagar(c,id){const q=c==='usuarios'?sb.from('usuarios').delete().eq('email',id):sb.from('docs').delete().eq('colecao',c).eq('id',id);const {error}=await q;if(error)throw error}
  /* tempo real: um canal por coleção; cada mudança relê a coleção ou o documento */
  const ouvintes={};let nCanal=0;
  function ouvir(c,fn){(ouvintes[c]=ouvintes[c]||new Set()).add(fn);
    if(ouvintes[c].size===1){const tab=c==='usuarios'?'usuarios':'docs';const filtro=c==='usuarios'?{}:{filter:'colecao=eq.'+c};
      sb.channel('pks'+(nCanal++)).on('postgres_changes',{event:'*',schema:'pks',table:tab,...filtro},()=>ouvintes[c].forEach(f=>f())).subscribe()}
    return()=>ouvintes[c].delete(fn)}
  const parte=p=>{const i=p.indexOf('/');return [p.slice(0,i),p.slice(i+1)]};
  function colecao(c){const o={
      onSnapshot(cb,err){const run=()=>lerCol(c).then(d=>cb(snapCol(d))).catch(e=>err&&err(e));run();return ouvir(c,run)},
      get:async()=>snapCol(await lerCol(c)),doc:id=>documento(c+'/'+id),where:()=>o,orderBy:()=>o,limit:()=>o};return o}
  function documento(p){const [c,id]=parte(p);return {id,
      onSnapshot(cb,err){const run=()=>lerDoc(c,id).then(d=>cb(snapDoc(id,d))).catch(e=>err&&err(e));run();return ouvir(c,run)},
      get:async()=>snapDoc(id,await lerDoc(c,id)),
      set:async d=>gravar(c,id,d),
      update:async patch=>gravar(c,id,{...(await lerDoc(c,id)||{}),...patch}),
      delete:async()=>apagar(c,id)}}
  const db={collection:colecao,doc:documento};

  /* ---------- usuário ---------- */
  const user={
    me:async()=>{const {email,perfil}=await pronto;return {id:email,name:email,email,avatarUrl:'',color:'#6e6d6a',isOwner:!!perfil?.admin,canEdit:!!perfil?.admin}},
    id:async()=>(await pronto).email,isOwner:async()=>!!(await pronto).perfil?.admin,canEdit:async()=>!!(await pronto).perfil?.admin,can:async()=>null,
    profiles:async ids=>Object.fromEntries(ids.map(i=>[i,{id:i,name:i,email:i,guest:false,isMe:false}])),
    search:async q=>{q=String(q||'').trim().toLowerCase();return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q)?[{id:q,name:q,email:q,guest:false}]:[]}};

  /* ---------- downloads ---------- */
  const downloads={save:async({filename,data})=>{const a=document.createElement('a');a.href=URL.createObjectURL(data instanceof Blob?data:new Blob([data]));a.download=filename;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);return {status:'saved'}}};

  /* Funções do servidor (Edge Functions), só no site: ex. integração com o Gestão Vaeso */
  window.pksFuncao=async(nome,corpo)=>{await pronto;const {data,error}=await sb.functions.invoke(nome,{body:corpo});
    if(error){let msg='Não foi possível concluir.';try{msg=(await error.context.json()).erro||msg}catch{}throw new Error(msg)}return data};

  const CAPS={db,user,downloads};
  window.claude={use:async k=>{await pronto;return CAPS[k]||null}};

  /* ---------- arquivos de dados ---------- */
  const fetchOriginal=window.fetch.bind(window);
  window.fetch=async(u,o)=>{const m=typeof u==='string'&&u.match(/^(?:\.\/)?(?:dados\/)?([a-z_]+)\.json$/);
    if(!m)return fetchOriginal(u,o);await pronto;
    const {data,error}=await sb.from('arquivos').select('conteudo').eq('nome',m[1]).maybeSingle();
    if(error||!data)return new Response('{}',{status:404});
    return new Response(JSON.stringify(data.conteudo),{status:200,headers:{'content-type':'application/json'}})};
})();
