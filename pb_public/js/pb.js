// Minimal PocketBase client (fetch-based) for this app
class PB {
  constructor(baseUrl = '') { this.baseUrl = baseUrl.replace(/\/$/, ''); this.authStore = { token: localStorage.getItem('pb_token') || '', model: JSON.parse(localStorage.getItem('pb_model') || 'null') }; }
  saveAuth(token, model){ this.authStore.token = token||''; this.authStore.model = model||null; localStorage.setItem('pb_token', this.authStore.token); localStorage.setItem('pb_model', JSON.stringify(this.authStore.model)); }
  clear(){ this.saveAuth('', null); }
  get isValid(){ return !!this.authStore.token; }
  async request(path, opts={}){
    const headers = Object.assign({}, opts.headers||{});
    if(this.authStore.token) headers.Authorization = this.authStore.token;
    let body = opts.body;
    const isForm = body instanceof FormData;
    if(!isForm) headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    if(body && !isForm && typeof body !== 'string'){ body = JSON.stringify(body); }
    if(isForm) delete headers['Content-Type'];
    const res = await fetch(this.baseUrl + path, { ...opts, headers, body });
    const text = await res.text(); let data; try{ data = text?JSON.parse(text):null; }catch{ data = text; }
    if(!res.ok){ const err = new Error((data&&(data.message||data.error))||res.statusText); err.status=res.status; err.data=data; throw err; }
    return data;
  }
  collection(name){ return new PBCollection(this, name); }
  async authWithPassword(identity, password){ const d = await this.request('/api/collections/users/auth-with-password',{method:'POST',body:{identity,password}}); this.saveAuth(d.token, d.record); return d; }
  async authRefresh(){ const d = await this.request('/api/collections/users/auth-refresh',{method:'POST'}); this.saveAuth(d.token, d.record); return d; }
  fileUrl(record, filename){ if(!filename) return ''; return `${this.baseUrl}/api/files/${record.collectionId||record.collectionName}/${record.id}/${filename}`; }

  async realtimeInit(subs, onEvent){
    try {
      if(this._es) { try{ this._es.close(); }catch{} }
      const es = new EventSource(this.baseUrl + '/api/realtime');
      this._es = es;
      const submitSubs = async (clientId)=>{
        try{
          await fetch(this.baseUrl + '/api/realtime', {
            method:'POST',
            headers:{'Content-Type':'application/json', ...(this.authStore.token?{Authorization:this.authStore.token}:{})},
            body: JSON.stringify({clientId, subscriptions: subs})
          });
        }catch(e){}
      };
      es.addEventListener('PB_CONNECT', async (ev)=>{
        try{
          const data = JSON.parse(ev.data||'{}');
          this._clientId = data.clientId;
          await submitSubs(this._clientId);
        }catch(e){}
      });
      const handle = (ev)=>{
        try{
          const data = JSON.parse(ev.data||'{}');
          // normalize: include topic from event name when possible
          if(!data.topic && ev.type && ev.type !== 'message') data.topic = ev.type;
          onEvent(data);
        }catch(e){}
      };
      es.onmessage = handle;
      (subs||[]).forEach(topic=>{
        try{ es.addEventListener(topic, handle); }catch(e){}
      });
      es.onerror = ()=>{};
    } catch(e){}
  }
}
class PBCollection{
  constructor(pb,name){ this.pb=pb; this.name=name; }
  async getList(page=1, perPage=50, params={}){ const q = new URLSearchParams({page,perPage,...params}); return this.pb.request(`/api/collections/${this.name}/records?${q}`); }
  async getFullList(params={}){ const q = new URLSearchParams({perPage:200,...params}); const r = await this.pb.request(`/api/collections/${this.name}/records?${q}`); return r.items||[]; }
  async getOne(id, params={}){ const q = new URLSearchParams(params); const s=q.toString(); return this.pb.request(`/api/collections/${this.name}/records/${id}${s?`?${s}`:''}`); }
  async create(body){ return this.pb.request(`/api/collections/${this.name}/records`,{method:'POST',body}); }
  async update(id, body){ return this.pb.request(`/api/collections/${this.name}/records/${id}`,{method:'PATCH',body}); }
  async delete(id){ return this.pb.request(`/api/collections/${this.name}/records/${id}`,{method:'DELETE'}); }
}
window.PB = PB;
