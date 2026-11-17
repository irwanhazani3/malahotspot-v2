(function(){
  const pb = new PB('');
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
  const esc = (s='')=>String(s==null?'':s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const state = { view:'dashboard', page:1, search:'', filterAktif:true, detail:null, cache:{}, notif:{total:0, by:{}} };

  function witaDisplay(v){ if(!v) return ''; const d=new Date(v); if(isNaN(d)) return String(v); const w=new Date(d.getTime()+8*3600*1000); const p=n=>String(n).padStart(2,'0'); return `${w.getUTCFullYear()}-${p(w.getUTCMonth()+1)}-${p(w.getUTCDate())} ${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`; }
  function toast(msg, opts={}){
    let t=$('#toasts'); if(!t){t=document.createElement('div');t.id='toasts';document.body.appendChild(t);}
    const d=document.createElement('div'); d.className='toast'; d.textContent=msg; t.appendChild(d);
    if(opts.onclick) d.onclick = ()=>{ try{opts.onclick();}catch(e){} d.remove(); };
    setTimeout(()=>d.remove(),4500);
    try{
      if(opts.browser && 'Notification' in window && Notification.permission === 'granted' && document.hidden){
        const n = new Notification('Malahotspot', { body: msg });
        if(opts.onclick) n.onclick = ()=>{ window.focus(); try{opts.onclick();}catch(e){} n.close(); };
      }
    }catch(e){}
  }
  async function ensureNotifyPermission(){
    try{ if(!('Notification' in window)) return false; if(Notification.permission==='granted') return true; if(Notification.permission==='denied') return false; const p = await Notification.requestPermission(); return p==='granted'; }catch(e){ return false; }
  }
  function me(){ return pb.authStore.model; }
  function isAdmin(){ return me() && me().role==='admin'; }
  async function ensureAuth(){ if(!pb.isValid) return false; try{ await pb.authRefresh(); return true; }catch{ pb.clear(); return false; } }
  async function loadCache(){
    try{
      if(!state.cache.users) state.cache.users=(await pb.collection('users').getList(1,200)).items;
      if(!state.cache.pelanggan) state.cache.pelanggan=(await pb.collection('pelanggan').getList(1,200,{filter:'diarsipkan = false'})).items;
      if(!state.cache.barang) state.cache.barang=(await pb.collection('inventaris_non_perangkat').getList(1,200,{filter:'diarsipkan = false'})).items;
      if(!state.cache.gangguan) state.cache.gangguan=(await pb.collection('layanan_gangguan').getList(1,200,{filter:'diarsipkan = false'})).items;
      if(!state.cache.perangkat) state.cache.perangkat=(await pb.collection('inventaris_perangkat').getList(1,500)).items;
    }catch{}
  }
  const nameOf=(arr,id,fallback=id)=>{ const x=(arr||[]).find(i=>i.id===id); return x?(x.nama||x.nama_barang||x.email||x.keluhan||x.id): (fallback||'-'); };

  const MODULES = [
    {key:'users', label:'Akun', admin:true, cols:['nama','email','role','telepon','aktif']},
    {key:'pelanggan', label:'Pelanggan', cols:['nama','nowa','keterangan_lokasi','sn_perangkat']},
    {key:'layanan_gangguan', label:'Gangguan', cols:['pelanggan','keluhan','status','ditugaskan_ke'], task:true},
    {key:'perbaikan', label:'Perbaikan', cols:['pelanggan','tanggal','status','teknisi','tindakan'], task:true},
    {key:'pemasangan', label:'Pemasangan', cols:['pelanggan','tanggal','status','ditugaskan_ke'], task:true},
    {key:'absen_hadir', label:'Absen', cols:['teknisi','tanggal','jam_masuk','keterangan','metode']},
    {key:'inventaris_perangkat', label:'Inv. Perangkat', cols:['nama','tipe','sn_serial','kondisi','lokasi_pemegang']},
    {key:'inventaris_non_perangkat', label:'Inv. Non Perangkat', cols:['nama_barang','satuan','stok','stok_minimum']},
    {key:'mutasi_inventaris', label:'Mutasi Inventaris', cols:['barang','jenis','jumlah','stok_sesudah','tanggal','keterangan']},
    {key:'usulan_perubahan', label:'Usulan', cols:['modul','record_id','status','pemohon']},
    {key:'riwayat', label:'Riwayat', admin:true, cols:['waktu','aktor','aksi','modul','record_id']},
  ];

  function layout(content){
    const u=me();
    const navItems=[['dashboard','Dashboard'],['tugas_saya','Tugas Saya'],['qr_absen','QR Absen'],['pengumuman','Pengumuman'],['pesan','Pesan'],...MODULES.filter(m=>!m.admin||isAdmin()).map(m=>[m.key,m.label]),['logout','Keluar']];
    const nav = navItems.map(([k,l])=>{
      const c = (state.notif && state.notif.by && state.notif.by[k]) || 0;
      const badge = `<span id="navBadge-${esc(k)}" class="notif-badge nav-badge" data-key="${esc(k)}" style="${c>0?'':'display:none'}">${c>99?'99+':c}</span>`;
      return `<button data-nav="${k}" class="nav-btn ${state.view===k?'active':''}"><span class="nav-btn-left"><span>${esc(l)}</span></span>${badge}</button>`;
    }).join('');
    const total = (state.notif && state.notif.total) || 0;
    const n = total ? `<span id="notifBadge" class="notif-badge">${total>99?'99+':total}</span>` : `<span id="notifBadge" class="notif-badge" style="display:none"></span>`;
    const initials = (u?.nama||u?.email||'A').trim().slice(0,2).toUpperCase();
    const currentLabel = (navItems.find(x=>x[0]===state.view)||['','Halaman'])[1];
    const isLight = document.documentElement.classList.contains('light');
    const themeLabel = isLight ? 'Mode Malam' : 'Mode Siang';
    return `<div class="app app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sb-top">
          <div class="sb-brand">
            <div class="brand-left">
              <div class="brand-logo">RN</div>
              <div>
                <div style="display:flex;align-items:center;gap:6px"><span class="brand-name">Malahotspot</span><span class="brand-tag">Admin</span></div>
                <div class="brand-sub">Hotspot Management</div>
              </div>
            </div>
          </div>
          <nav id="mainNav" class="sb-nav">${nav}</nav>
        </div>
        <div class="sb-footer">
          <div class="sb-user">
            <div class="sb-avatar">${esc(initials)}</div>
            <div class="sb-user-info">
              <div class="sb-user-name">${esc(u?.nama||u?.email||'')}</div>
              <div class="sb-user-role">${esc(u?.role||'')}</div>
            </div>
          </div>
        </div>
      </aside>
      <div class="main-wrapper">
        <header class="topbar">
          <div class="topbar-inner">
            <div>
              <div class="topbar-title">${esc(currentLabel)}</div>
              <div class="topbar-sub">${esc(u?.nama||u?.email||'')} · ${esc(u?.role||'')}</div>
            </div>
            <div class="topbar-right">
              <button id="themeToggle" class="btn btn-ghost" title="Ganti tema">${esc(themeLabel)}</button>
              <button id="btnNotif" class="btn btn-ghost notif-btn" title="Notifikasi">Notifikasi ${n}</button>
              <button id="menuToggle" class="btn btn-ghost menu-toggle" aria-label="Menu">Menu</button>
            </div>
          </div>
        </header>
        <main class="container">${content}</main>
      </div>
      <div id="toasts"></div>
    </div>`;
  }
  function loginView(err=''){ return `<div class="login card"><h2>Login</h2><p class="muted">Malahotspot Admin</p>${err?`<div class="error">${esc(err)}</div>`:''}<form id="loginForm"><label>Email/Identitas</label><input name="identity" required><label>Kata sandi</label><input name="password" type="password" required><div style="margin-top:10px"><button class="btn" type="submit">Masuk</button></div></form></div>`; }

  async function render(){
    const app=$('#app'); if(!(await ensureAuth())){ app.innerHTML=loginView(); $('#loginForm').onsubmit=onLogin; return; }
    await loadCache();
    let html=''; try{
      if(state.view==='dashboard') html=await dashboardView();
      else if(state.view==='tugas_saya') html=await tugasSayaView();
      else if(state.view==='qr_absen') html=await qrAbsenView();
      else if(state.view==='pengumuman') html=await pengumumanView();
      else if(state.view==='pesan') html=await pesanView();
      else html=await moduleView(state.view);
    }catch(e){ html=`<div class="card error">${esc(e.message||e)}</div>`; }
    app.innerHTML=layout(html); bindNav(); bindActions();
  }
  async function onLogin(ev){ ev.preventDefault(); const fd=new FormData(ev.target); try{ await pb.authWithPassword(fd.get('identity'), fd.get('password')); state.cache={}; state.view='dashboard'; render(); }catch(e){ $('#app').innerHTML=loginView(e.message||'Login gagal'); $('#loginForm').onsubmit=onLogin; } }
  function computeNotifTotal(){
    if(!state.notif || !state.notif.by) return 0;
    return Object.values(state.notif.by).reduce((a,b)=>a + (Number(b)||0), 0);
  }
  function updateNotifBadge(){
    const b = $('#notifBadge'); 
    const total = computeNotifTotal();
    state.notif.total = total;
    if(b){
      if(total>0){ b.textContent = total>99?'99+':String(total); b.style.display='inline-flex'; }
      else { b.textContent=''; b.style.display='none'; }
    }
    $$('.nav-badge[data-key]').forEach(el=>{
      const k = el.dataset.key;
      const c = (state.notif && state.notif.by && state.notif.by[k]) || 0;
      if(c>0){ el.textContent = c>99?'99+':String(c); el.style.display='inline-flex'; }
      else { el.textContent=''; el.style.display='none'; }
    });
  }
  function addNotif(kind, n=1){
    if(!state.notif) state.notif={total:0, by:{}};
    if(!state.notif.by) state.notif.by={};
    const keys = Array.isArray(kind) ? kind : [kind];
    keys.filter(Boolean).forEach(k=>{
      state.notif.by[k] = (state.notif.by[k]||0) + n;
    });
    updateNotifBadge();
  }
  function clearNotif(kind){
    if(!state.notif) state.notif={total:0, by:{}};
    if(!state.notif.by) state.notif.by={};
    if(kind==='all'){ state.notif.by = {}; }
    else {
      const keys = Array.isArray(kind) ? kind : [kind];
      keys.filter(Boolean).forEach(k=>{ state.notif.by[k]=0; });
    }
    updateNotifBadge();
  }
  function applyTheme(theme){
    const t = theme || localStorage.getItem('theme') || 'dark';
    if(t==='light') document.documentElement.classList.add('light');
    else document.documentElement.classList.remove('light');
  }
  function updateThemeToggleLabel(){
    const tt = $('#themeToggle');
    if(!tt) return;
    const isLight = document.documentElement.classList.contains('light');
    tt.textContent = isLight ? 'Mode Malam' : 'Mode Siang';
  }
  function toggleTheme(){
    const isLight = document.documentElement.classList.toggle('light');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
    updateThemeToggleLabel();
  }
  function bindNav(){
    $$('[data-nav]').forEach(b=>b.onclick=()=>{ 
      const v=b.dataset.nav; 
      if(v==='logout'){pb.clear();render();return;} 
      clearNotif(v);
      state.view=v; state.page=1; state.search=''; state.detail=null; 
      render(); 
    });
    const nb=$('#btnNotif'); if(nb) nb.onclick=async()=>{ clearNotif('all'); const ok=await ensureNotifyPermission(); toast(ok?'Notifikasi browser aktif':'Izin notifikasi ditolak/tidak tersedia'); };
    const mt=$('#menuToggle'), sb=$('#sidebar');
    if(mt && sb){ mt.onclick=()=>sb.classList.toggle('open'); }
    const tt=$('#themeToggle');
    if(tt) tt.onclick=toggleTheme;
  }

  async function dashboardView(){
    const cards=[
      ['pelanggan','Pelanggan Aktif'],
      ['layanan_gangguan','Gangguan Aktif'],
      ['perbaikan','Perbaikan Aktif'],
      ['pemasangan','Pemasangan Aktif'],
      ['inventaris_non_perangkat','Stok Non-Perangkat']
    ];
    let out='<div><div class="kpi-grid">';
    for(const [c,label] of cards){
      try{
        const r=await pb.collection(c).getList(1,1,{filter:'diarsipkan = false'});
        out+=`<div class="kpi-card kpi-link" data-nav="${esc(c)}" role="button" tabindex="0" title="Buka ${esc(label)}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">${r.totalItems||0}</div></div>`;
      }catch{
        out+=`<div class="kpi-card kpi-link" data-nav="${esc(c)}" role="button" tabindex="0" title="Buka ${esc(label)}"><div class="kpi-label">${esc(label)}</div><div class="kpi-value">-</div></div>`;
      }
    }
    out+='</div></div><div class="card"><h3>Pengumuman Aktif</h3><div id="ann"></div></div>';
    setTimeout(async()=>{ try{ const a=await pb.collection('pengumuman').getList(1,5,{filter:'diarsipkan = false',sort:'-dibuat_pada'}); $('#ann').innerHTML=a.items.length?a.items.map(x=>`<div class="card" style="margin-top:10px"><b>${esc(x.judul)}</b><div style="margin-top:4px">${esc(x.isi)}</div><div class="muted" style="margin-top:6px">${esc(witaDisplay(x.dibuat_pada))}</div></div>`).join(''):'<div class="muted">Belum ada pengumuman.</div>'; }catch(e){ $('#ann').innerHTML=`<div class="muted">${esc(e.message)}</div>`; } },0);
    return out;
  }

  async function tugasSayaView(){
    const uid=me().id; let html='<div class="card"><h2>Tugas Saya</h2></div>';
    for(const [col,label,field] of [['layanan_gangguan','Layanan Gangguan','ditugaskan_ke'],['pemasangan','Pemasangan','ditugaskan_ke'],['perbaikan','Perbaikan','teknisi']]){
      try{ const r=await pb.collection(col).getList(1,50,{filter:`${field} = "${uid}" && diarsipkan = false`, sort:'-diubah_pada'});
        html+=`<div class="card"><h3>${label}</h3>`+(r.items.length?`<div class="table-wrap"><table><tr><th>ID</th><th>Status</th><th>Info</th><th></th></tr>${r.items.map(it=>`<tr><td>${esc(it.id.slice(0,8))}</td><td>${esc(it.status||'')}</td><td>${esc((it.keluhan||it.tindakan||'').slice(0,60))}</td><td><button class="btn" data-open="${col}:${it.id}">Buka</button></td></tr>`).join('')}</table></div>`:'<div class="muted">Tidak ada.</div>')+'</div>';
      }catch(e){ html+=`<div class="card"><h3>${label}</h3><div class="error">${esc(e.message)}</div></div>`; }
    } return html;
  }

  async function qrAbsenView(){
    if(isAdmin()){
      return `<div class="card"><h2>QR Absen (Admin)</h2><div class="row"><button class="btn" id="genQr">Tampilkan/Refresh QR</button><button class="btn" id="refreshToday">Refresh Absen Hari Ini</button><span id="qrInfo" class="muted"></span></div>
        <div id="qrBox" style="margin:10px 0"></div><h3>Absen Hari Ini (WITA)</h3><div id="todayAbs" class="muted">Memuat...</div></div>`;
    }
    return `<div class="card"><h2>Absen Saya</h2><p class="muted">Pindai QR kantor atau input Izin/Sakit (mandiri).</p>
      <div class="row"><button class="btn" id="scanQrBtn">Pindai QR</button></div>
      <video id="qrVideo" style="max-width:320px;display:none;margin-top:8px;border-radius:8px"></video><div id="scanMsg" class="muted"></div>
      <hr><h3>Input Izin/Sakit</h3><form id="izinForm" class="grid"><div><label>Keterangan</label><select name="keterangan"><option>Izin</option><option>Sakit</option></select></div>
      <div style="grid-column:1/-1"><label>Alasan</label><textarea name="alasan" required></textarea></div><div><button class="btn" type="submit">Kirim</button></div></form></div>`;
  }

  async function pengumumanView(){
    const canManage=isAdmin(); let list={items:[]}; try{ list=await pb.collection('pengumuman').getList(1,50,{sort:'-dibuat_pada'});}catch(e){return `<div class="card error">${esc(e.message)}</div>`;}
    const form = canManage?`<div class="card"><h3>Buat Pengumuman</h3><form id="annForm"><label>Judul</label><input name="judul" required><label>Isi</label><textarea name="isi" required></textarea><label>Foto (opsional)</label><input type="file" name="foto" accept="image/jpeg,image/png,image/webp"><div style="margin-top:8px"><button class="btn">Kirim</button></div></form></div>`:'';
    const items=list.items.map(x=>`<div class="card"><b>${esc(x.judul)}</b> ${x.diarsipkan?'<span class="badge">nonaktif</span>':''}<div>${esc(x.isi)}</div>${x.foto?`<div style="margin-top:6px"><a href="${esc(pb.fileUrl(x,x.foto))}" target="_blank" rel="noopener"><img src="${esc(pb.fileUrl(x,x.foto))}" alt="foto" style="max-width:220px;border:1px solid var(--border);border-radius:8px"></a></div>`:''}<div class="muted">${esc(witaDisplay(x.dibuat_pada))}</div>${canManage?`<div class="row" style="margin-top:6px"><button class="btn" data-ann-arc="${x.id}:${x.diarsipkan?'1':'0'}">${x.diarsipkan?'Pulihkan':'Arsipkan'}</button></div>`:''}</div>`).join('');
    return `<div class="card"><h2>Pengumuman</h2></div>${form}<div>${items||'<div class="card muted">Belum ada.</div>'}</div>`;
  }

  async function pesanView(){
    const users=(state.cache.users||[]).filter(u=>u.id!==me().id);
    let list={items:[]}; try{ list=await pb.collection('pesan_langsung').getList(1,50,{sort:'-dibuat_pada'});}catch(e){}
    const myId=me().id; const mine=list.items.filter(m=>m.pengirim===myId||m.penerima===myId||String(m.percakapan||'').includes(myId));
    return `<div class="card"><h2>Pesan Langsung (1-lawan-1)</h2><form id="msgForm" class="grid"><div><label>Penerima</label><select name="penerima" required><option value="">Pilih</option>${users.map(u=>`<option value="${esc(u.id)}">${esc(u.nama||u.email||u.id)}</option>`).join('')}</select></div>
      <div style="grid-column:1/-1"><label>Isi</label><textarea name="isi" required></textarea></div><div style="grid-column:1/-1"><label>Foto (opsional)</label><input type="file" name="foto" accept="image/jpeg,image/png,image/webp"></div><div><button class="btn">Kirim</button></div></form></div>
      <div class="card"><h3>Pesan Terbaru</h3>${mine.length?`<div class="table-wrap"><table><tr><th>Waktu</th><th>Dari</th><th>Ke</th><th>Isi</th><th>Foto</th></tr>${mine.map(m=>`<tr><td>${esc(witaDisplay(m.dibuat_pada))}</td><td>${esc(m.pengirim===myId?'Saya':nameOf(state.cache.users,m.pengirim,m.pengirim))}</td><td>${esc(m.penerima===myId?'Saya':nameOf(state.cache.users,m.penerima,m.penerima))}</td><td>${esc(m.isi)}</td><td>${m.foto?`<a href="${esc(pb.fileUrl(m,m.foto))}" target="_blank" rel="noopener">Lihat</a>`:''}</td></tr>`).join('')}</table></div>`:'<div class="muted">Belum ada pesan.</div>'}</div>`;
  }

  function getMod(k){ return MODULES.find(m=>m.key===k); }
  async function moduleView(key){
    if(state.detail) return detailView(key, state.detail);
    const mod=getMod(key); if(!mod) return '<div class="card">Modul tidak ditemukan.</div>';
    if(mod.admin && !isAdmin()) return '<div class="card">Khusus admin.</div>';
    const noArchive = (key === 'riwayat');
    const aktif = state.filterAktif!==false;
    let filter = '';
    if(key === 'users'){ filter = aktif ? 'aktif = true' : 'aktif = false'; }
    else if(!noArchive) { filter = aktif?'diarsipkan = false':'diarsipkan = true'; }
    if(state.search){
      const sv=state.search.replace(/"/g,'');
      const smap = {
        users:['id','nama','email','telepon','role'],
        pelanggan:['id','nama','nowa','sn_perangkat','koneksi','vlan','keterangan_lokasi','teknisi.nama'],
        layanan_gangguan:['id','keluhan','status','pelanggan.nama','ditugaskan_ke.nama'],
        perbaikan:['id','tindakan','status','pelanggan.nama','teknisi.nama'],
        pemasangan:['id','status','pelanggan.nama','ditugaskan_ke.nama'],
        absen_hadir:['id','keterangan','metode','alasan','teknisi.nama'],
        inventaris_perangkat:['id','nama','tipe','sn_serial','kondisi','lokasi_pemegang'],
        inventaris_non_perangkat:['id','nama_barang','keterangan','satuan'],
        mutasi_inventaris:['id','jenis','keterangan','referensi_id','referensi_modul','barang.nama_barang'],
        usulan_perubahan:['id','modul','record_id','status','alasan_tolak','pemohon.nama'],
        riwayat:['id','modul','record_id','aksi','catatan','aktor.nama'],
        pengumuman:['id','judul','isi']
      };
      const fields = smap[key] || ['id'];
      const q = fields.map(f=>`${f} ~ "${sv}"`).join(' || ');
      filter += filter ? ` && (${q})` : `(${q})`;
    }
    const sort = key==='users' ? '-created' : (key==='riwayat' ? '-waktu' : '-dibuat_pada');
    let list={items:[],page:1,totalPages:1,totalItems:0}; try{ list=await pb.collection(key).getList(state.page||1,50,{filter, sort});}catch(e){ return `<div class="card"><h2>${esc(mod.label)}</h2><div class="error">${esc(e.message)}</div></div>`; }
    const cols=mod.cols; const rows=list.items.map(it=>`<tr>${cols.map(c=>`<td>${cell(key,c,it)}</td>`).join('')}<td><button class="btn" data-open="${key}:${it.id}">Buka</button></td></tr>`).join('');
    let extraTop = '';
    if(key==='inventaris_perangkat' && aktif){
      try{
        const all = await pb.collection('inventaris_perangkat').getList(1,500,{filter:'diarsipkan = false'});
        const map = {};
        for(const it of (all.items||[])){
          const nm=it.nama||'-', tp=it.tipe||'-', kd=it.kondisi||'-';
          const k = nm+'||'+tp+'||'+kd;
          if(!map[k]) map[k]={nama:nm, tipe:tp, kondisi:kd, jumlah:0};
          map[k].jumlah++;
        }
        let recaps = Object.values(map);
        const sortKey = state.rekapSort || 'nama';
        const cmpStr = (a,b)=>String(a||'').localeCompare(String(b||''), 'id');
        if(sortKey==='nama') recaps.sort((a,b)=>cmpStr(a.nama,b.nama)||cmpStr(a.tipe,b.tipe)||cmpStr(a.kondisi,b.kondisi));
        else if(sortKey==='tipe') recaps.sort((a,b)=>cmpStr(a.tipe,b.tipe)||cmpStr(a.nama,b.nama)||cmpStr(a.kondisi,b.kondisi));
        else if(sortKey==='kondisi') recaps.sort((a,b)=>cmpStr(a.kondisi,b.kondisi)||cmpStr(a.nama,b.nama)||cmpStr(a.tipe,b.tipe));
        else if(sortKey==='jumlah_desc') recaps.sort((a,b)=>(b.jumlah-a.jumlah)||cmpStr(a.nama,b.nama)||cmpStr(a.tipe,b.tipe));
        else if(sortKey==='jumlah_asc') recaps.sort((a,b)=>(a.jumlah-b.jumlah)||cmpStr(a.nama,b.nama)||cmpStr(a.tipe,b.tipe));
        const opts = [['nama','Nama'],['tipe','Tipe'],['kondisi','Kondisi'],['jumlah_desc','Jumlah (terbanyak)'],['jumlah_asc','Jumlah (tersedikit)']];
        const sortSel = `<label style="margin:0">Urutkan menurut</label><select id="rekapSort" style="max-width:220px">${opts.map(([v,l])=>`<option value="${v}" ${sortKey===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
        extraTop = `<div class="card"><div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><div><h3 style="margin:0">Rekap Unit (Data aktif)</h3><p class="muted" style="margin:4px 0 0">Jumlah dihitung otomatis dari unit (bukan input manual).</p></div><div class="row" style="gap:6px;align-items:center">${sortSel}</div></div>${recaps.length?`<div class="table-wrap"><table><thead><tr><th>Nama</th><th>Tipe</th><th>Kondisi</th><th>Jumlah</th></tr></thead><tbody>${recaps.map(r=>`<tr><td>${esc(r.nama)}</td><td>${esc(r.tipe)}</td><td>${esc(r.kondisi)}</td><td><b>${r.jumlah}</b></td></tr>`).join('')}</tbody></table></div>`:'<div class="muted">Belum ada data.</div>'}</div>`;
      }catch(e){ extraTop = `<div class="card"><div class="error">Gagal memuat rekap: ${esc(e.message)}</div></div>`; }
    }
    const viewLabel = key==='users' ? (aktif?'Akun aktif':'Akun nonaktif') : (noArchive ? 'Semua data' : (aktif?'Data aktif':'Data nonaktif'));
    const aktifToggle = noArchive ? '' : `<label style="display:flex;gap:4px;align-items:center"><input type="checkbox" id="aktifOnly" ${aktif?'checked':''}> ${key==='users'?'Aktif':'Data aktif'}</label>`;
    return `${extraTop}<div class="card"><div class="toolbar"><h2>${esc(mod.label)} <span class="badge">${esc(viewLabel)}</span></h2><div class="row"><input id="searchBox" placeholder="Cari..." value="${esc(state.search||'')}">${aktifToggle}<button class="btn" id="btnSearch">Cari</button>${canCreate(key)?`<button class="btn" id="btnNew" data-new="${key}">+ Tambah</button>`:''}</div></div>
      <div class="table-wrap" style="overflow:auto"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}<th>Aksi</th></tr></thead><tbody>${rows||'<tr><td colspan="99" class="muted">Tidak ada data.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:8px"><span class="muted">Hal ${list.page}/${list.totalPages} (${list.totalItems})</span><button class="btn" id="prevPage" ${list.page<=1?'disabled':''}>Prev</button><button class="btn" id="nextPage" ${list.page>=list.totalPages?'disabled':''}>Next</button></div></div>`;
  }

  async function detailView(key,id){
    let rec; try{ rec=await pb.collection(key).getOne(id);}catch(e){ return `<div class="card error">${esc(e.message)}</div>`; }
    const mod=getMod(key); const canArc = isAdmin() && rec.diarsipkan!==undefined;
    let extra='';
    if(key==='usulan_perubahan'){
      const st=rec.status; const mine = rec.pemohon===me().id;
      extra = `<div class="card" style="margin-top:8px"><h3>Aksi Usulan</h3>${isAdmin() && st==='Menunggu'?`<label>Nilai usulan (JSON, untuk "Ubah lalu setujui")</label><textarea id="uNilai" rows="4">${esc(typeof rec.nilai_usulan==='string'?rec.nilai_usulan:JSON.stringify(rec.nilai_usulan||{},null,2))}</textarea><div class="row" style="margin-top:8px"><button class="btn" id="uApprove">Setujui</button><button class="btn" id="uApproveEdit">Ubah lalu Setujui</button><button class="btn" id="uReject">Tolak</button></div>`:''}${mine && st==='Menunggu'?`<div class="row" style="margin-top:8px"><button class="btn" id="uWithdraw">Tarik Usulan Saya</button></div>`:''}<div id="uMsg" class="muted"></div></div>`;
    }
    if(key==='users' && isAdmin()){
      try{
        const [g,p,rp] = await Promise.all([
          pb.collection('layanan_gangguan').getList(1,50,{filter:`ditugaskan_ke = "${id}" && diarsipkan = false`}),
          pb.collection('pemasangan').getList(1,50,{filter:`ditugaskan_ke = "${id}" && diarsipkan = false`}),
          pb.collection('perbaikan').getList(1,50,{filter:`teknisi = "${id}" && diarsipkan = false`})
        ]);
        const rows = [
          ...g.items.map(x=>({modul:'Gangguan', id:x.id, status:x.status, info:x.keluhan||''})),
          ...p.items.map(x=>({modul:'Pemasangan', id:x.id, status:x.status, info:''})),
          ...rp.items.map(x=>({modul:'Perbaikan', id:x.id, status:x.status, info:x.tindakan||''}))
        ];
        const techOptions = (state.cache.users||[]).filter(u=>u.id!==id && u.aktif!==false).map(u=>`<option value="${esc(u.id)}">${esc(u.nama||u.email||u.id)} (${esc(u.role||'')})</option>`).join('');
        extra += `<div class="card" style="margin-top:8px"><h3>Penugasan Aktif</h3><p class="muted">Sebelum menonaktifkan teknisi, pindahkan atau kosongkan penugasan berikut (sesuai aturan).</p>
        ${rows.length?`<div class="row" style="margin:8px 0"><label style="margin:0">Pindahkan semua ke</label><select id="reassignTo" style="max-width:260px"><option value="">-- pilih teknisi --</option>${techOptions}</select><button class="btn" id="bulkReassign">Pindahkan Semua</button><button class="btn" id="bulkClear">Kosongkan Semua</button></div>`:''}
        ${rows.length?`<div class="table-wrap"><table><thead><tr><th>Modul</th><th>ID</th><th>Status</th><th>Info</th><th>Aksi</th></tr></thead><tbody>${rows.map(t=>`<tr><td>${esc(t.modul)}</td><td>${esc(t.id.slice(0,8))}</td><td>${esc(t.status||'')}</td><td>${esc(String(t.info).slice(0,50))}</td><td><button class="btn" data-open="${t.modul==='Gangguan'?'layanan_gangguan':t.modul==='Pemasangan'?'pemasangan':'perbaikan'}:${t.id}">Buka</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="muted">Tidak ada penugasan aktif.</div>'}</div>`;
      }catch(e){ extra += `<div class="card"><div class="error">${esc(e.message)}</div></div>`; }
    }
    let comments='';
    if(mod && mod.task){
      let cm=[]; try{ cm=(await pb.collection('komentar_tugas').getList(1,50,{filter:`modul_referensi = "${key}" && referensi_id = "${id}"`, sort:'dibuat_pada'})).items; }catch{}
      comments = `<div class="card"><h3>Komentar Tugas</h3><div>${cm.map(c=>`<div class="card"><div>${esc(c.isi)}</div>${c.foto?`<div style="margin-top:6px"><a href="${esc(pb.fileUrl(c,c.foto))}" target="_blank" rel="noopener"><img src="${esc(pb.fileUrl(c,c.foto))}" alt="foto" style="max-width:180px;border:1px solid var(--border);border-radius:8px"></a></div>`:''}<div class="muted">${esc(nameOf(state.cache.users,c.pengirim,c.pengirim))} · ${esc(witaDisplay(c.dibuat_pada))}</div></div>`).join('')||'<div class="muted">Belum ada komentar.</div>'}</div>
        <form id="commentForm"><label>Tambah komentar</label><textarea name="isi" required></textarea><label>Foto (opsional)</label><input type="file" name="foto" accept="image/jpeg,image/png,image/webp"><div style="margin-top:6px"><button class="btn">Kirim</button></div></form></div>`;
    }
    const photoFields = ['foto_rumah','foto_perangkat','foto_sebelum','foto_sesudah','foto'];
    const photos = photoFields.filter(f=>rec[f]).map(f=>`<div style="margin:6px 0"><div class="muted">${esc(f)}</div><a href="${esc(pb.fileUrl(rec, rec[f]))}" target="_blank" rel="noopener"><img src="${esc(pb.fileUrl(rec, rec[f]))}" alt="${esc(f)}" style="max-width:220px;border:1px solid var(--border);border-radius:8px"></a></div>`).join('');
    return `<div class="card"><div class="row" style="justify-content:space-between"><h2>Detail ${esc(mod?mod.label:key)}</h2><div><button class="btn" id="backBtn">Kembali</button> ${canArc?`<button class="btn" id="arcBtn">${rec.diarsipkan?'Pulihkan':'Arsipkan'}</button>`:''}</div></div>
      ${photos?`<div class="row" style="align-items:flex-start">${photos}</div>`:''}
      <pre style="white-space:pre-wrap">${esc(JSON.stringify(rec,null,2))}</pre>
      <h3>Ubah</h3>${(['pelanggan','inventaris_perangkat','inventaris_non_perangkat'].includes(key) && !isAdmin())?'<p class="muted">Perubahan data master akan dikirim sebagai usulan persetujuan admin (file foto tidak dikirim lewat usulan).</p>':''}<form id="editForm">${editorForm(key,rec)}</form>${extra}</div>${comments}`;
  }

  function cell(key,c,it){
    if(c==='stok' && key==='inventaris_non_perangkat'){ const low = it.stok_minimum!=null && Number(it.stok)<=Number(it.stok_minimum); return `${esc(it.stok)} ${low?'<span class="badge low">menipis</span>':''}`; }
    let v=it[c]; if(v==null||v==='') return '<span class="muted">-</span>';
    if(typeof v === 'boolean' || c==='aktif' || c==='diarsipkan') return (v===true||v==='true')?'Ya':'Tidak';
    if(['pelanggan'].includes(c)) return esc(nameOf(state.cache.pelanggan,v,v));
    if(['teknisi','ditugaskan_ke','pemohon','peninjau','aktor','dicatat_oleh','pengirim','penerima'].includes(c)) return esc(nameOf(state.cache.users,v,v));
    if(c==='barang') return esc(nameOf(state.cache.barang,v,v));
    if(c.includes('tanggal')||c==='waktu'||c==='jam_masuk'||c==='dibaca_pada') return esc(witaDisplay(v));
    return esc(String(v).slice(0,80));
  }
  function canCreate(key){ if(key==='riwayat') return false; if(key==='pengaturan'||key==='pengumuman') return isAdmin(); return true; }

  function select(name,label,items,valFn,labelFn,selected){ return `<label>${esc(label)}</label><select name="${esc(name)}"><option value="">-</option>${items.map(i=>`<option value="${esc(valFn(i))}" ${String(selected||'')===String(valFn(i))?'selected':''}>${esc(labelFn(i))}</option>`).join('')}</select>`; }
  function multiSelect(name,label,items,valFn,labelFn,selected){
    const sel = Array.isArray(selected)? selected.map(String) : (selected?[String(selected)]:[]);
    return `<label>${esc(label)} (bisa pilih lebih dari satu)</label><select name="${esc(name)}" multiple size="5">${items.map(i=>{ const v=String(valFn(i)); return `<option value="${esc(v)}" ${sel.includes(v)?'selected':''}>${esc(labelFn(i))}</option>`; }).join('')}</select>`;
  }
  function fileInput(name,label){ return `<label>${esc(label)} (JPG/PNG/WebP, maks 2MB)</label><input name="${esc(name)}" type="file" accept="image/jpeg,image/png,image/webp">`; }
  function editorForm(key,rec={}){
    const inp=(n,l,t='text',vals=null,ro=false,suggest=null)=>{
      const v=rec[n]==null?'':rec[n];
      if(vals) return `<label>${esc(l)}</label><select name="${esc(n)}" ${ro?'disabled':''}>${vals.map(o=>`<option value="${esc(o)}" ${String(v)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
      if(t==='textarea') return `<label>${esc(l)}</label><textarea name="${esc(n)}" ${ro?'readonly':''}>${esc(v)}</textarea>`;
      const listId = suggest && suggest.length ? `dl-${esc(n)}-${Math.random().toString(36).slice(2,7)}` : '';
      const listAttr = listId ? ` list="${listId}"` : '';
      const datalist = listId ? `<datalist id="${listId}">${suggest.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist>` : '';
      return `<label>${esc(l)}</label><input name="${esc(n)}" type="${esc(t)}" value="${esc(String(v))}"${listAttr} ${ro?'readonly':''}>${datalist}`;
    };
    const users=state.cache.users||[]; const pels=state.cache.pelanggan||[]; const barang=state.cache.barang||[]; const gang=(state.cache.gangguan||[]);
    const perangkat=state.cache.perangkat||[];
    const uniq = (arr, field)=>[...new Set(arr.map(x=>String(x[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const namaSuggestions = uniq(perangkat,'nama');
    const tipeSuggestions = uniq(perangkat,'tipe');
    const materialRow = (idx,it={},locked=false)=>{
      const opts = (state.cache.barang||[]).filter(b=>!b.diarsipkan).map(b=>`<option value="${esc(b.id)}" ${String(it.barang||'')===String(b.id)?'selected':''}>${esc((b.nama_barang||'-')+' ('+(b.satuan||'-')+') stok:'+ (b.stok??0))}</option>`).join('');
      return `<div class="row material-row" data-idx="${idx}" style="gap:6px;align-items:flex-end;margin:6px 0;${locked?'opacity:.8':''}">
        <div style="flex:2;min-width:180px"><label style="margin:0 0 4px">Barang</label><select class="mat-barang" ${locked?'disabled':''}><option value="">Pilih barang</option>${opts}</select></div>
        <div style="flex:1;min-width:100px"><label style="margin:0 0 4px">Jumlah</label><input class="mat-jumlah" type="number" min="0" step="any" value="${esc(String(it.jumlah||''))}" ${locked?'readonly':''}></div>
        <div style="flex:2;min-width:140px"><label style="margin:0 0 4px">Ket (opsional)</label><input class="mat-ket" type="text" value="${esc(String(it.keterangan||''))}" ${locked?'readonly':''}></div>
        ${locked?'':`<div><button type="button" class="btn mat-remove">Hapus</button></div>`}
      </div>`;
    };
    window.__materialRow = materialRow;
    const materialEditor = (recData)=>{
      const items = Array.isArray(recData.material_pemakaian) ? recData.material_pemakaian : (typeof recData.material_pemakaian==='string' ? (()=>{try{return JSON.parse(recData.material_pemakaian||'[]')}catch{return []}})() : []);
      const locked = !!recData.material_tercatat;
      const note = locked ? '<div class="muted" style="margin:4px 0">Material sudah tercatat otomatis saat status Selesai (tidak dapat diubah).</div>' : '<div class="muted" style="margin:4px 0">Pilih material dan jumlah. Saat status diubah ke Selesai, pemakaian stok akan dicatat otomatis sekali.</div>';
      const rows = items.map((it,i)=>materialRow(i,it,locked)).join('');
      return `<div class="card" style="margin-top:8px;padding:12px" id="materialBox"><label>Material Non-Perangkat (pemakaian)</label>${note}<div id="materialRows">${rows||(!locked?materialRow(0,{},false):'')}</div>${locked?'':`<div style="margin-top:6px"><button type="button" class="btn" id="addMaterialRow">+ Tambah Material</button></div>`}<input type="hidden" name="material_pemakaian" id="materialPemakaian" value="${esc(JSON.stringify(items||[]))}"></div>`;
    };
    const map={
      pelanggan:[inp('nama','Nama'),inp('nowa','No/WA'),inp('sn_perangkat','SN'),inp('koneksi','Koneksi'),inp('vlan','VLAN'),select('teknisi','Teknisi (opsional)',users,u=>u.id,u=>u.nama||u.email,rec.teknisi),inp('link_maps','Link Maps'),inp('keterangan_lokasi','Keterangan Lokasi','textarea'),fileInput('foto_rumah','Foto Rumah')],
      layanan_gangguan:[select('pelanggan','Pelanggan',pels,p=>p.id,p=>p.nama,rec.pelanggan),inp('keluhan','Keluhan','textarea'),inp('status','Status','select',['Baru','Diproses','Selesai']), isAdmin()?select('ditugaskan_ke','Ditugaskan ke (admin)',users,u=>u.id,u=>u.nama||u.email,rec.ditugaskan_ke):`<label>Ditugaskan ke</label><input type="text" value="${esc(nameOf(users, rec.ditugaskan_ke, rec.ditugaskan_ke||'-'))}" disabled><input type="hidden" name="ditugaskan_ke" value="${esc(rec.ditugaskan_ke||'')}">`],
      perbaikan:[select('gangguan','Gangguan (opsional)',gang,g=>g.id,g=>g.keluhan?.slice(0,40)||g.id,rec.gangguan),select('pelanggan','Pelanggan',pels,p=>p.id,p=>p.nama,rec.pelanggan),inp('tanggal','Tanggal','date'), isAdmin()?select('teknisi','Teknisi',users,u=>u.id,u=>u.nama||u.email,rec.teknisi):`<label>Teknisi</label><input type="text" value="${esc(nameOf(users, rec.teknisi, rec.teknisi||'-'))}" disabled><input type="hidden" name="teknisi" value="${esc(rec.teknisi||'')}">`, inp('tindakan','Tindakan','textarea'),inp('status','Status','select',['Belum ditindak','Diproses','Selesai']),multiSelect('perangkat','Perangkat terkait',perangkat.filter(p=>!p.diarsipkan),p=>p.id,p=>`${p.nama||'-'} ${p.tipe?('('+p.tipe+')'):''} ${p.sn_serial?('SN:'+p.sn_serial):''}`.trim(), rec.perangkat),materialEditor(rec),fileInput('foto_sebelum','Foto Sebelum'),fileInput('foto_sesudah','Foto Sesudah')],
      pemasangan:[select('pelanggan','Pelanggan',pels,p=>p.id,p=>p.nama,rec.pelanggan),inp('tanggal','Tanggal','date'),inp('status','Status','select',['Menunggu','Dikerjakan','Selesai']), isAdmin()?select('ditugaskan_ke','Ditugaskan ke (admin)',users,u=>u.id,u=>u.nama||u.email,rec.ditugaskan_ke):`<label>Ditugaskan ke</label><input type="text" value="${esc(nameOf(users, rec.ditugaskan_ke, rec.ditugaskan_ke||'-'))}" disabled><input type="hidden" name="ditugaskan_ke" value="${esc(rec.ditugaskan_ke||'')}">`, multiSelect('perangkat','Perangkat dipasang/terkait',perangkat.filter(p=>!p.diarsipkan),p=>p.id,p=>`${p.nama||'-'} ${p.tipe?('('+p.tipe+')'):''} ${p.sn_serial?('SN:'+p.sn_serial):''}`.trim(), rec.perangkat),materialEditor(rec)],
      absen_hadir:[select('teknisi','Teknisi',users,u=>u.id,u=>u.nama||u.email,rec.teknisi||me().id),inp('tanggal','Tanggal','date'),inp('jam_masuk','Jam Masuk'),inp('keterangan','Keterangan','select',['Hadir','Izin','Sakit']),inp('alasan','Alasan','textarea'),inp('metode','Metode','select',['Admin','Mandiri','QR','Tugas'])],
      inventaris_perangkat:[inp('nama','Nama','text',null,false,namaSuggestions),inp('tipe','Tipe','text',null,false,tipeSuggestions),inp('sn_serial','SN/Serial'),inp('kondisi','Kondisi','select',['Baik','Terpasang','Rusak','Nonaktif']),inp('lokasi_pemegang','Lokasi/Pemegang'),inp('keterangan','Keterangan','textarea'),fileInput('foto_perangkat','Foto Perangkat')],
      inventaris_non_perangkat:[inp('nama_barang','Nama Barang'),inp('satuan','Satuan'),inp('stok','Stok (otomatis)','number',null,true),inp('stok_minimum','Stok Minimum','number'),inp('keterangan','Keterangan','textarea')],
      mutasi_inventaris:[select('barang','Barang',barang,b=>b.id,b=>`${b.nama_barang} (${b.satuan})`,rec.barang),inp('jenis','Jenis','select',['Pengadaan','Pemakaian','Penyesuaian']),inp('jumlah','Jumlah','number'),inp('tanggal','Tanggal','date'),inp('arah_penyesuaian','Arah Penyesuaian (wajib jika Penyesuaian)','select',['','Tambah','Kurang']),inp('referensi_modul','Ref Modul','select',['-','Perbaikan','Pemasangan']),inp('referensi_id','Ref ID'),inp('keterangan','Keterangan','textarea')],
      usulan_perubahan:[inp('modul','Modul (koleksi)'),inp('record_id','Record ID'),inp('nilai_usulan','Nilai Usulan (JSON)','textarea'),inp('status','Status','select',['Menunggu','Disetujui','Ditolak','Ditarik']),inp('alasan_tolak','Alasan Tolak','textarea')],
      users:[inp('nama','Nama'),inp('email','Email','email'),inp('telepon','Telepon'),inp('role','Role','select',['admin','teknisi']),`<label>Aktif</label><select name="aktif"><option value="true" ${String(rec.aktif)!=='false'?'selected':''}>true</option><option value="false" ${String(rec.aktif)==='false'?'selected':''}>false</option></select>`, (rec && rec.id ? `<label>Password baru (kosongkan jika tidak diubah)</label><input name="password" type="password" minlength="5"><label>Konfirmasi Password</label><input name="passwordConfirm" type="password" minlength="5">` : `<label>Password (min 5)</label><input name="password" type="password" minlength="5" required><label>Konfirmasi Password</label><input name="passwordConfirm" type="password" minlength="5" required>`)],
            pengaturan:[inp('kunci','Kunci'),inp('nilai','Nilai (JSON/teks)','textarea')],
    };
    return (map[key]||[]).join('')+`<div style="margin-top:8px"><button class="btn" type="submit">Simpan</button></div>`;
  }

  function syncMaterialEditor(){
    const box = $('#materialBox'); if(!box) return;
    const rows = $$('.material-row', box);
    const items = [];
    rows.forEach(r=>{
      const barang = r.querySelector('.mat-barang') ? r.querySelector('.mat-barang').value : '';
      const jumlah = r.querySelector('.mat-jumlah') ? Number(r.querySelector('.mat-jumlah').value||0) : 0;
      const ket = r.querySelector('.mat-ket') ? r.querySelector('.mat-ket').value : '';
      if(barang && jumlah>0) items.push({barang, jumlah, keterangan: ket});
    });
    const hidden = $('#materialPemakaian');
    if(hidden) hidden.value = JSON.stringify(items);
  }
  function initMaterialEditor(){
    const box = $('#materialBox'); if(!box) return;
    const rowsWrap = $('#materialRows');
    const addBtn = $('#addMaterialRow');
    const bindMaterialRowEvents = ()=>{
      $$('.mat-remove', box).forEach(btn=>btn.onclick=()=>{ const row = btn.closest('.material-row'); if(row){ row.remove(); syncMaterialEditor(); } });
      $$('.mat-barang, .mat-jumlah, .mat-ket', box).forEach(el=>{
        el.onchange = syncMaterialEditor;
        el.oninput = syncMaterialEditor;
      });
      const form = $('#editForm') || $('#newForm');
      if(form && !form.__matSync){ form.__matSync=true; form.addEventListener('submit', syncMaterialEditor, true); }
    };
    if(addBtn && window.__materialRow){
      addBtn.onclick = ()=>{ if(!rowsWrap) return; const div=document.createElement('div'); div.innerHTML = window.__materialRow(Date.now(),{},false); rowsWrap.appendChild(div.firstElementChild); bindMaterialRowEvents(); syncMaterialEditor(); };
    }
    bindMaterialRowEvents();
    syncMaterialEditor();
  }

  async function bindActions(){
    $('#btnSearch')&&($('#btnSearch').onclick=()=>{state.search=$('#searchBox').value.trim();state.page=1;render();});
    $('#prevPage')&&($('#prevPage').onclick=()=>{state.page=Math.max(1,(state.page||1)-1);render();});
    $('#nextPage')&&($('#nextPage').onclick=()=>{state.page=(state.page||1)+1;render();});
    $('#aktifOnly')&&($('#aktifOnly').onchange=(e)=>{state.filterAktif=e.target.checked;state.page=1;render();});
    $('#rekapSort')&&($('#rekapSort').onchange=(e)=>{state.rekapSort=e.target.value;render();});
    $$('[data-open]').forEach(b=>b.onclick=()=>{const [k,id]=b.dataset.open.split(':'); state.detail=id; state.view=k; render();});
    $$('[data-new]').forEach(b=>b.onclick=()=>openNew(b.dataset.new));
    $('#backBtn')&&($('#backBtn').onclick=()=>{state.detail=null; render();});
    $('#arcBtn')&&($('#arcBtn').onclick=async()=>{ try{ const k=state.view,id=state.detail; const rec=await pb.collection(k).getOne(id); const to=!rec.diarsipkan; if(!confirm(to?'Arsipkan/nonaktifkan data ini?':'Pulihkan data ini?')) return; await pb.collection(k).update(id,{diarsipkan:to, diarsipkan_pada: to? new Date().toISOString():null, diarsipkan_oleh: to? me().id:null}); toast(to?'Data dinonaktifkan':'Data dipulihkan'); render(); }catch(e){toast(e.message);} });
    initMaterialEditor();
    $('#editForm')&&($('#editForm').onsubmit=async(ev)=>{
      ev.preventDefault();
      const key=state.view, id=state.detail;
      try{
        const fd = new FormData(ev.target);
        const body = formBody(key, fd);
        const master = ['pelanggan','inventaris_perangkat','inventaris_non_perangkat'];
        if(master.includes(key) && !isAdmin()){
          // submit proposal with changed fields only
          const rec = await pb.collection(key).getOne(id);
          const nilai={};
          for(const [k,v] of fd.entries()){
            if(['password','passwordConfirm'].includes(k)) continue;
            const cur = rec[k];
            let nv = v;
            if(v instanceof File){ continue; } // file changes not via usulan
            if(['jumlah','stok','stok_minimum','stok_sebelum','stok_sesudah'].includes(k)) nv = v===''?null:Number(v);
            const curNorm = (cur===null||cur===undefined)?'':(typeof cur==='object'?JSON.stringify(cur):String(cur));
            const nvNorm = (nv===null||nv===undefined)?'':(typeof nv==='object'?JSON.stringify(nv):String(nv));
            if(curNorm !== nvNorm && nvNorm !== '') nilai[k]=nv;
            else if(curNorm !== nvNorm && nvNorm === '' && curNorm !== '') nilai[k]=nv;
          }
          if(Object.keys(nilai).length===0){ toast('Tidak ada perubahan untuk diusulkan'); return; }
          await pb.collection('usulan_perubahan').create({modul:key, record_id:id, nilai_usulan:nilai, status:'Menunggu', pemohon:me().id});
          toast('Usulan perubahan dikirim untuk persetujuan admin');
          return;
        }
        await pb.collection(key).update(id, body);
        toast('Tersimpan'); state.cache={}; render();
      }catch(e){ toast(e.message||'Gagal menyimpan'); }
    });
    $('#commentForm')&&($('#commentForm').onsubmit=async(ev)=>{ ev.preventDefault(); const fd=new FormData(ev.target); fd.set('modul_referensi',state.view); fd.set('referensi_id',state.detail); fd.set('pengirim',me().id); try{ await pb.collection('komentar_tugas').create(fd); toast('Komentar terkirim'); render(); }catch(e){toast(e.message);} });
    $('#annForm')&&($('#annForm').onsubmit=async(ev)=>{ ev.preventDefault(); const fd=new FormData(ev.target); fd.set('pembuat',me().id); fd.set('diarsipkan','false'); try{ await pb.collection('pengumuman').create(fd); toast('Pengumuman dibuat'); render(); }catch(e){toast(e.message);} });
    $$('[data-ann-arc]').forEach(b=>b.onclick=async()=>{ const [id,ar]=b.dataset.annArc.split(':'); try{ await pb.collection('pengumuman').update(id,{diarsipkan: ar!=='1'}); toast('Diperbarui'); render(); }catch(e){toast(e.message);} });
    $('#msgForm')&&($('#msgForm').onsubmit=async(ev)=>{ ev.preventDefault(); const fd=new FormData(ev.target); fd.set('pengirim',me().id); const ids=[me().id,fd.get('penerima')].filter(Boolean).sort(); fd.set('percakapan',ids.join('__')); try{ await pb.collection('pesan_langsung').create(fd); toast('Terkirim'); render(); }catch(e){toast(e.message);} });
    $('#izinForm')&&($('#izinForm').onsubmit=async(ev)=>{ ev.preventDefault(); const fd=new FormData(ev.target); try{ await pb.collection('absen_hadir').create({teknisi:me().id, tanggal:new Date().toISOString().slice(0,10), keterangan:fd.get('keterangan'), alasan:fd.get('alasan'), metode:'Mandiri', dicatat_oleh:me().id, jam_masuk:new Date().toISOString()}); toast('Izin/Sakit dicatat'); }catch(e){toast(e.message);} });
    $('#genQr')&&($('#genQr').onclick=loadQr); $('#refreshToday')&&($('#refreshToday').onclick=loadTodayAbs); $('#scanQrBtn')&&($('#scanQrBtn').onclick=scanQr); if($('#todayAbs')) loadTodayAbs();
    $('#uApprove')&&($('#uApprove').onclick=async()=>{ try{ await pb.request(`/api/usulan/${state.detail}/decide`,{method:'POST',body:{action:'setujui'}}); toast('Usulan disetujui'); render(); }catch(e){toast(e.message);} });
    $('#uApproveEdit')&&($('#uApproveEdit').onclick=async()=>{ try{ let nilai={}; try{ nilai=JSON.parse($('#uNilai').value||'{}'); }catch(_){ toast('JSON nilai usulan tidak valid'); return; } await pb.request(`/api/usulan/${state.detail}/decide`,{method:'POST',body:{action:'ubah_setujui', nilai_usulan:nilai}}); toast('Usulan diubah & disetujui'); render(); }catch(e){toast(e.message);} });
    $('#uReject')&&($('#uReject').onclick=async()=>{ const alasan=prompt('Alasan tolak:')||''; try{ await pb.request(`/api/usulan/${state.detail}/decide`,{method:'POST',body:{action:'tolak', alasan_tolak:alasan}}); toast('Usulan ditolak'); render(); }catch(e){toast(e.message);} });
    $('#uWithdraw')&&($('#uWithdraw').onclick=async()=>{ try{ await pb.request(`/api/usulan/${state.detail}/withdraw`,{method:'POST'}); toast('Usulan ditarik'); render(); }catch(e){toast(e.message);} });
    $('#bulkClear')&&($('#bulkClear').onclick=async()=>{
      if(!confirm('Kosongkan semua penugasan aktif user ini?')) return;
      const uid = state.detail;
      try{
        const [g,p,rp] = await Promise.all([
          pb.collection('layanan_gangguan').getList(1,200,{filter:`ditugaskan_ke = "${uid}" && diarsipkan = false`}),
          pb.collection('pemasangan').getList(1,200,{filter:`ditugaskan_ke = "${uid}" && diarsipkan = false`}),
          pb.collection('perbaikan').getList(1,200,{filter:`teknisi = "${uid}" && diarsipkan = false`})
        ]);
        for(const x of g.items) await pb.collection('layanan_gangguan').update(x.id,{ditugaskan_ke:null});
        for(const x of p.items) await pb.collection('pemasangan').update(x.id,{ditugaskan_ke:null});
        for(const x of rp.items) await pb.collection('perbaikan').update(x.id,{teknisi:null});
        toast('Semua penugasan dikosongkan');
        render();
      }catch(e){ toast(e.message||'Gagal mengosongkan'); }
    });
    $('#bulkReassign')&&($('#bulkReassign').onclick=async()=>{
      const to = $('#reassignTo') ? $('#reassignTo').value : '';
      if(!to){ toast('Pilih teknisi tujuan'); return; }
      if(!confirm('Pindahkan semua penugasan aktif ke teknisi terpilih?')) return;
      const uid = state.detail;
      try{
        const [g,p,rp] = await Promise.all([
          pb.collection('layanan_gangguan').getList(1,200,{filter:`ditugaskan_ke = "${uid}" && diarsipkan = false`}),
          pb.collection('pemasangan').getList(1,200,{filter:`ditugaskan_ke = "${uid}" && diarsipkan = false`}),
          pb.collection('perbaikan').getList(1,200,{filter:`teknisi = "${uid}" && diarsipkan = false`})
        ]);
        for(const x of g.items) await pb.collection('layanan_gangguan').update(x.id,{ditugaskan_ke:to});
        for(const x of p.items) await pb.collection('pemasangan').update(x.id,{ditugaskan_ke:to});
        for(const x of rp.items) await pb.collection('perbaikan').update(x.id,{teknisi:to});
        toast('Semua penugasan dipindahkan');
        render();
      }catch(e){ toast(e.message||'Gagal memindahkan'); }
    });
  }

  async function openNew(key){
    state.detail=null; state.view=key; await render();
    const div=document.createElement('div'); div.className='card'; div.innerHTML=`<h3>Tambah ${esc(getMod(key)?.label||key)}</h3><form id="newForm">${editorForm(key,{})}</form><button class="btn" id="cancelNew" type="button">Batal</button>`;
    $('.container').prepend(div); $('#cancelNew').onclick=()=>div.remove();
    initMaterialEditor();
    $('#newForm').onsubmit=async(ev)=>{ ev.preventDefault(); try{ await pb.collection(key).create(formBody(key,new FormData(ev.target), true)); toast('Ditambahkan'); state.cache={}; render(); }catch(e){toast(e.message);} };
  }

  function formBody(key, fd, isNew=false){
    let hasFile=false; for(const [k,v] of fd.entries()){ if(v instanceof File && v.size>0){ hasFile=true; if(v.size>2*1024*1024) throw new Error('Ukuran foto maksimal 2MB'); } }
    const body = hasFile ? fd : {};
    const set=(k,v)=>{ if(hasFile) body.set(k,v); else body[k]=v; };
    const multiKeys = ['perangkat'];
    if(!hasFile){
      const seenMulti = new Set();
      for(const [k,v] of fd.entries()){
        if(multiKeys.includes(k)){
          seenMulti.add(k);
          body[k] = fd.getAll(k).filter(x=>x!=='');
          continue;
        }
        if(v instanceof File){ if(v.size>0){ /* should have triggered hasFile, but be safe */ } continue; }
        if(v==='') continue;
        if(['jumlah','stok','stok_minimum','stok_sebelum','stok_sesudah'].includes(k)) body[k]=Number(v);
        else if(k==='nilai_usulan'||k==='nilai'||k==='material_pemakaian'){ try{body[k]=JSON.parse(v|| (k==='material_pemakaian'?'[]':v));}catch{body[k]= (k==='material_pemakaian'?[]:v);} }
        else body[k]=v;
      }
      multiKeys.forEach(k=>{ if(seenMulti.has(k) || fd.has(k) || ['pemasangan','perbaikan'].includes(key)) { if(!(k in body)) body[k]=[]; } });
    } else {
      // normalize numbers/json and multi in FormData
      multiKeys.forEach(k=>{
        if(fd.has(k) || ['pemasangan','perbaikan'].includes(key)){
          const vals = fd.getAll(k).filter(x=>x!=='');
          body.delete(k);
          vals.forEach(v=>body.append(k, v));
        }
      });
      for(const [k,v] of Array.from(fd.entries())){
        if(multiKeys.includes(k)) continue;
        if(v instanceof File) continue;
        if(v===''){ body.delete(k); continue; }
        if(['jumlah','stok','stok_minimum','stok_sebelum','stok_sesudah'].includes(k)) body.set(k, String(Number(v)));
      }
    }
    if(key==='mutasi_inventaris' && isNew){ set('dicatat_oleh', me().id); }
    if(key==='absen_hadir' && isNew){ if(!fd.get('teknisi')) set('teknisi', me().id); set('dicatat_oleh', me().id); if(!fd.get('jam_masuk')) set('jam_masuk', new Date().toISOString()); if(!fd.get('tanggal')) set('tanggal', new Date().toISOString().slice(0,10)); }
    if(key==='pesan_langsung' && isNew){ set('pengirim', me().id); const ids=[me().id, fd.get('penerima')].filter(Boolean).sort(); set('percakapan', ids.join('__')); }
    if(key==='pengumuman' && isNew){ set('pembuat', me().id); if(!hasFile) body.diarsipkan=false; else body.set('diarsipkan','false'); }
    if(key==='usulan_perubahan' && isNew){ set('pemohon', me().id); set('status', 'Menunggu'); }
    if(key==='users'){
      const aktif = fd.get('aktif');
      if(!hasFile){ body.aktif = (aktif === 'true' || aktif === true); if(!body.password){ delete body.password; delete body.passwordConfirm; } }
      else { body.set('aktif', String(aktif === 'true')); if(!fd.get('password')){ body.delete('password'); body.delete('passwordConfirm'); } }
    }
    return body;
  }

  let qrTimer=null, todayTimer=null;
  async function loadQr(){
    try{
      const d=await pb.request('/api/absen/qr');
      $('#qrInfo').textContent=`Berlaku ~${d.expires_in}s`;
      $('#qrBox').innerHTML=`<div class="card" style="text-align:center"><div id="qrImg" style="display:inline-block;padding:8px;background:#fff"></div><div class="muted" style="margin-top:6px;word-break:break-all;font-size:.75rem">${esc(d.token)}</div></div>`;
      try{ $('#qrImg').innerHTML=''; new QRCode($('#qrImg'), {text:d.token, width:220, height:220}); }catch(_){ }
      clearTimeout(qrTimer); qrTimer=setTimeout(()=>{ if(state.view==='qr_absen' && isAdmin()) loadQr(); }, Math.max(5,(d.expires_in||30))*1000);
    }catch(e){ toast(e.message); }
  }
  async function loadTodayAbs(){ try{ const d=await pb.request('/api/absen/today'); $('#todayAbs').innerHTML = d.items.length? `<div class="table-wrap"><table><tr><th>Teknisi</th><th>Ket</th><th>Metode</th><th>Jam</th></tr>${d.items.map(i=>`<tr><td>${esc(nameOf(state.cache.users,i.teknisi,i.teknisi))}</td><td>${esc(i.keterangan)}</td><td>${esc(i.metode)}</td><td>${esc(witaDisplay(i.jam_masuk))}</td></tr>`).join('')}</table></div>`:'<div class="muted">Belum ada absen hari ini.</div>'; }catch(e){ $('#todayAbs') && ($('#todayAbs').innerHTML=`<div class="muted">${esc(e.message)}</div>`); } clearTimeout(todayTimer); if(state.view==='qr_absen' && isAdmin()) todayTimer=setTimeout(loadTodayAbs,10000); }
  async function scanQr(){ const video=$('#qrVideo'), msg=$('#scanMsg'); msg.textContent=''; if(!('BarcodeDetector' in window) || !navigator.mediaDevices){ msg.textContent='BarcodeDetector/kamera tidak tersedia. Gunakan kamera HP.'; return; } try{ const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); video.srcObject=stream; video.style.display='block'; await video.play(); const det=new BarcodeDetector({formats:['qr_code']}); const tick=async()=>{ if(video.readyState>=2){ const codes=await det.detect(video); if(codes&&codes[0]){ const token=codes[0].rawValue; stream.getTracks().forEach(t=>t.stop()); video.style.display='none'; try{ await pb.request('/api/absen/scan',{method:'POST',body:{token}}); toast('Absen QR berhasil'); msg.textContent='Absen tercatat.'; }catch(e){ toast(e.message); msg.textContent=e.message; } return; } } requestAnimationFrame(tick); }; requestAnimationFrame(tick); }catch(e){ msg.textContent='Gagal akses kamera: '+e.message; } }

  // Realtime notifications + polling fallback
  let lastPoll = Date.now();
  let rtRenderTimer = null;
  function scheduleRender(delay=400){
    if(rtRenderTimer) return;
    // avoid interrupting form typing: only auto-refresh list/detail views without active focus in inputs, or delay
    rtRenderTimer = setTimeout(()=>{ rtRenderTimer=null; try{ render(); }catch(e){} }, delay);
  }
  async function startRealtime(){
    try{
      const subs = ['layanan_gangguan/*','pemasangan/*','perbaikan/*','usulan_perubahan/*','komentar_tugas/*','pesan_langsung/*','pengumuman/*'];
      await pb.realtimeInit(subs, (ev)=>{
        try{
          if(!ev || !ev.action) return;
          const col = (ev.record && (ev.record.collectionName||ev.record.collectionId)) || (ev.topic||'').split('/')[0] || '';
          const uid = me() && me().id;
          const r = ev.record || {};
          if(r.pengirim===uid || r.pemohon===uid || r.pembuat===uid) return;

          if(col==='pesan_langsung'){
            // only recipient cares; sender filtered above
            if(r.penerima===uid || r.pengirim===uid || (r.percakapan||'').includes(uid)){
              toast('Pesan baru diperbarui', {browser:true, onclick:()=>{state.view='pesan'; state.detail=null; clearNotif('pesan'); render();}});
              if(state.view==='pesan') { scheduleRender(); } else { addNotif('pesan'); }
            }
          } else if(col==='pengumuman'){
            toast('Pengumuman baru/diperbarui', {browser:true, onclick:()=>{state.view='pengumuman'; state.detail=null; clearNotif('pengumuman'); render();}});
            if(state.view==='pengumuman') { scheduleRender(); } else { addNotif('pengumuman'); }
          } else if(col==='komentar_tugas'){
            toast('Komentar tugas diperbarui', {browser:true, onclick:()=>{ if(r.modul_referensi && r.referensi_id){ state.view=r.modul_referensi; state.detail=r.referensi_id; clearNotif(r.modul_referensi); } render(); }});
            const modKey = r.modul_referensi;
            if(state.view===modKey && state.detail===r.referensi_id) scheduleRender();
            else {
              const keys = [];
              if(modKey) keys.push(modKey);
              keys.push('tugas_saya');
              addNotif(keys);
            }
          } else if(['layanan_gangguan','pemasangan','perbaikan','usulan_perubahan'].includes(col)){
            toast('Pembaruan: '+col.replace(/_/g,' '), {browser:true, onclick:()=>{ state.view=col; state.detail=r.id||state.detail; clearNotif(col); render(); }});
            if(state.view===col || state.view==='dashboard' || state.view==='tugas_saya') scheduleRender();
            else addNotif([col, 'tugas_saya']);
          }
        }catch(e){}
      });
    }catch{}
    setInterval(async()=>{ try{ await pollNotifications(); }catch{} }, 15000);
  }
  async function pollNotifications(){
    if(!pb.isValid) return;
    const since = new Date(lastPoll - 8000).toISOString();
    lastPoll = Date.now();
    let needsRender = false;
    try{
      const uid=me().id;
      const ann = await pb.collection('pengumuman').getList(1,5,{filter:`diarsipkan = false && dibuat_pada >= "${since}"`, sort:'-dibuat_pada'});
      ann.items.forEach(a=>{ if(a.pembuat!==uid){ toast('Pengumuman baru', {browser:true, onclick:()=>{state.view='pengumuman'; state.detail=null; clearNotif('pengumuman'); render();}}); if(state.view==='pengumuman') needsRender=true; else addNotif('pengumuman'); } });
      const msgs = await pb.collection('pesan_langsung').getList(1,5,{filter:`penerima = "${uid}" && dibuat_pada >= "${since}"`, sort:'-dibuat_pada'});
      if(msgs.items && msgs.items.length){ toast('Pesan baru diterima', {browser:true, onclick:()=>{state.view='pesan'; state.detail=null; clearNotif('pesan'); render();}}); if(state.view==='pesan') needsRender=true; else addNotif('pesan'); }
      if(needsRender) scheduleRender(300);
    }catch{}
  }

  applyTheme();
  render(); startRealtime();
})();
