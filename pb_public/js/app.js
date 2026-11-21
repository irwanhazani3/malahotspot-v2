(function(){
  const pb = new PB('');
  const $ = (s,el=document)=>el.querySelector(s);
  const $$ = (s,el=document)=>Array.from(el.querySelectorAll(s));
  const esc = (s='')=>String(s==null?'':s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const state = { view:'dashboard', page:1, search:'', filterAktif:true, detail:null, cache:{}, notif:{total:0, by:{}} };

  function witaDisplay(v){ if(!v) return ''; const d=new Date(v); if(isNaN(d)) return String(v); const w=new Date(d.getTime()+8*3600*1000); const p=n=>String(n).padStart(2,'0'); return `${w.getUTCFullYear()}-${p(w.getUTCMonth()+1)}-${p(w.getUTCDate())} ${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`; }
  function toast(msg, opts={}){
    let t=$('#toasts'); if(!t){t=document.createElement('div');t.id='toasts';document.body.appendChild(t);}
    const d=document.createElement('div'); d.className='toast'+(opts.type==='error'?' toast-error':''); d.textContent=msg; t.appendChild(d);
    if(opts.onclick) d.onclick = ()=>{ try{opts.onclick();}catch(e){} d.remove(); };
    setTimeout(()=>d.remove(), opts.type==='error'?7000:4500);
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

  const FIELD_LABELS = {
    nama:'Nama', nowa:'Nomor HP/WA', sn_perangkat:'SN Perangkat', koneksi:'Koneksi', vlan:'VLAN',
    teknisi:'Teknisi', link_maps:'Link Maps', keterangan_lokasi:'Keterangan Lokasi', foto_rumah:'Foto Rumah',
    pelanggan:'Pelanggan', keluhan:'Keluhan', status:'Status', ditugaskan_ke:'Ditugaskan ke',
    gangguan:'Gangguan', tanggal:'Tanggal', tindakan:'Tindakan', perangkat:'Perangkat',
    jam_masuk:'Jam Masuk', keterangan:'Keterangan', alasan:'Alasan', metode:'Metode',
    tipe:'Tipe', sn_serial:'SN/Serial', kondisi:'Kondisi', lokasi_pemegang:'Lokasi/Pemegang',
    nama_barang:'Nama Barang', satuan:'Satuan', stok:'Stok', stok_minimum:'Stok Minimum',
    barang:'Barang', jenis:'Jenis Mutasi', jumlah:'Jumlah', arah_penyesuaian:'Arah Penyesuaian',
    referensi_modul:'Referensi Modul', referensi_id:'Referensi ID', modul:'Modul', record_id:'Record ID',
    nilai_usulan:'Nilai Usulan', alasan_tolak:'Alasan Tolak', email:'Email', telepon:'Telepon',
    role:'Role', aktif:'Aktif', password:'Password', passwordConfirm:'Konfirmasi Password',
    judul:'Judul', isi:'Isi', pembuat:'Pembuat', penerima:'Penerima', foto:'Foto',
    material_pemakaian:'Material Non-Perangkat',
    kunci:'Kunci', nilai:'Nilai', dibuat_pada:'Dibuat Pada', diubah_pada:'Diubah Pada'
  };
  const REQUIRED = {
    pelanggan:['nama','nowa'],
    inventaris_perangkat:['nama','kondisi'],
    inventaris_non_perangkat:['nama_barang','satuan'],
    layanan_gangguan:['pelanggan','keluhan','status'],
    pemasangan:['pelanggan','tanggal','status'],
    perbaikan:['tanggal','tindakan','status'],
    absen_hadir:['teknisi','tanggal','keterangan','metode'],
    absen_izin:['keterangan','alasan'],
    mutasi_inventaris:['barang','jenis','jumlah','tanggal'],
    usulan_perubahan:['modul','record_id','nilai_usulan','status'],
    users:['nama','email','role'],
    pengumuman:['judul','isi'],
    pesan_langsung:['penerima','isi'],
    komentar_tugas:['isi'],
    pengaturan:['kunci']
  };

  function fieldLabel(name){
    return FIELD_LABELS[name] || String(name||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  }
  function fieldEl(form,name){
    if(!form || !name) return null;
    try{ return form.querySelector('[name="'+String(name).replace(/"/g,'\\"')+'"]'); }catch(e){ return null; }
  }
  function clearFieldError(el){
    if(!el) return;
    el.classList.remove('invalid');
    el.removeAttribute('aria-invalid');
    const next=el.nextElementSibling;
    if(next && next.classList && next.classList.contains('field-error')) next.remove();
  }
  function showFieldError(el,msg){
    if(!el || !msg) return;
    clearFieldError(el);
    el.classList.add('invalid');
    el.setAttribute('aria-invalid','true');
    const d=document.createElement('div');
    d.className='field-error';
    d.textContent=msg;
    el.insertAdjacentElement('afterend',d);
  }
  function clearFormErrors(form){
    if(!form) return;
    form.querySelectorAll('.invalid').forEach(el=>el.classList.remove('invalid'));
    form.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
    form.querySelectorAll('.field-error').forEach(el=>el.remove());
    const alert=form.querySelector('.form-alert'); if(alert) alert.remove();
  }
  function showFormAlert(form,messages){
    if(!form) return;
    const old=form.querySelector('.form-alert'); if(old) old.remove();
    const box=document.createElement('div'); box.className='form-alert'; box.setAttribute('role','alert');
    const title=document.createElement('b'); title.textContent='Belum bisa disimpan';
    const ul=document.createElement('ul');
    [...new Set(messages.filter(Boolean))].forEach(m=>{ const li=document.createElement('li'); li.textContent=m; ul.appendChild(li); });
    box.appendChild(title); box.appendChild(ul);
    form.insertBefore(box,form.firstChild);
  }
  function focusField(el){
    if(!el) return;
    try{ el.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){}
    setTimeout(()=>{ try{ el.focus({preventScroll:true}); }catch(e){ try{ el.focus(); }catch(_){} } },60);
  }
  function validateField(form,key,isNew,el){
    if(!el || el.disabled || el.type==='hidden' || el.type==='button' || el.type==='submit') return '';
    const name=el.name; if(!name) return '';
    const label=fieldLabel(name);
    const raw=el.type==='file' ? '' : String(el.value==null?'':el.value);
    const val=raw.trim();
    const required=(REQUIRED[key]||[]).includes(name) || !!el.required;
    const jenisEl=fieldEl(form,'jenis');
    const jenis=jenisEl?String(jenisEl.value||''):'';

    if(el.type==='file'){
      const f=el.files && el.files[0];
      if(!f) return '';
      if(f.size>2*1024*1024) return 'Ukuran foto maksimal 2MB.';
      if(f.type && !['image/jpeg','image/png','image/webp'].includes(f.type)) return 'Format foto harus JPG, PNG, atau WebP.';
      return '';
    }
    if(key==='users' && name==='password'){
      if(isNew && !val) return 'Password belum diisi.';
      if(val && val.length<8) return 'Password minimal 8 karakter.';
      if(!val) return '';
    }
    if(key==='users' && name==='passwordConfirm'){
      const pwEl=fieldEl(form,'password');
      const pw=pwEl?String(pwEl.value||''):'';
      if((isNew || pw) && !val) return 'Konfirmasi password belum diisi.';
      if(val && pw && val!==pw) return 'Konfirmasi password tidak sama.';
      if(val && !pw && !isNew) return 'Isi password baru terlebih dahulu.';
      if(!val) return '';
    }
    if(required && !val){
      if(name==='nowa') return 'Nomor HP/WA belum diisi.';
      if(el.tagName==='SELECT') return `${label} belum dipilih.`;
      return `${label} belum diisi.`;
    }
    if(key==='mutasi_inventaris' && jenis==='Penyesuaian'){
      if(name==='arah_penyesuaian' && !val) return 'Arah penyesuaian belum dipilih (Tambah/Kurang).';
      if(name==='keterangan' && !val) return 'Keterangan wajib diisi untuk penyesuaian.';
    }
    if(!val) return '';
    if(name==='email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return 'Format email tidak valid.';
    if(key==='inventaris_non_perangkat' && name==='nama_barang' && val){
      const norm = val.trim().replace(/\s+/g,' ').toLowerCase();
      const match = (state.cache.barang||[]).find(b=>String(b.nama_barang||'').trim().replace(/\s+/g,' ').toLowerCase()===norm);
      if(match && (isNew || String(match.id)!==String(state.detail||''))){
        return 'Nama barang sudah ada. Gunakan nama lain atau kelola barang yang sudah ada (tambah stok lewat Mutasi Inventaris).';
      }
    }
    if(el.type==='number' || ['jumlah','stok','stok_minimum','stok_sebelum','stok_sesudah'].includes(name)){
      const n=Number(val);
      if(!isFinite(n)) return `${label} harus berupa angka.`;
      if(name==='jumlah' && n<=0) return 'Jumlah harus lebih dari 0.';
      if(name==='stok_minimum' && n<0) return 'Stok minimum tidak boleh negatif.';
    }
    if(name==='nilai_usulan'){
      try{ JSON.parse(val); }catch(e){ return 'Nilai Usulan harus berupa JSON yang valid.'; }
    }
    return '';
  }
  function validateForm(form,key,isNew){
    if(!form) return [];
    const errs=[]; const seen=new Set();
    const add=(el,msg)=>{ if(!el || !msg || seen.has(el)) return; seen.add(el); errs.push({el,msg}); };
    (REQUIRED[key]||[]).forEach(name=>{ const el=fieldEl(form,name); if(el) add(el,validateField(form,key,isNew,el)); });
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(el=>{ if(!seen.has(el)) add(el,validateField(form,key,isNew,el)); });
    if(key==='perbaikan' || key==='pemasangan'){
      form.querySelectorAll('#materialBox .material-row').forEach(row=>{
        const barang=row.querySelector('.mat-barang');
        const jumlah=row.querySelector('.mat-jumlah');
        if(!barang || barang.disabled) return;
        const bid=String(barang.value||'');
        const jv=jumlah?String(jumlah.value||'').trim():'';
        if(bid && (!jv || !(Number(jv)>0))) add(jumlah,'Jumlah material harus lebih dari 0.');
        if(!bid && jv && Number(jv)>0) add(barang,'Pilih barang untuk material ini.');
      });
    }
    return errs;
  }
  function validateAndShow(form,key,isNew){
    const errs=validateForm(form,key,isNew);
    clearFormErrors(form);
    if(!errs.length) return true;
    const uniq=[]; const seen=new Set();
    errs.forEach(er=>{ if(!seen.has(er.el)){ seen.add(er.el); uniq.push(er); showFieldError(er.el,er.msg); } });
    const msgs=[...new Set(uniq.map(er=>er.msg))];
    showFormAlert(form,msgs);
    focusField(uniq[0].el);
    toast('Belum bisa disimpan: '+msgs.slice(0,2).join(' ')+(msgs.length>2?` (+${msgs.length-2} lagi)`:''),{type:'error'});
    return false;
  }
  function attachValidation(form,key,isNew){
    if(!form || form.__validationBound) return;
    form.__validationBound=true;
    form.setAttribute('novalidate','');
    (REQUIRED[key]||[]).forEach(name=>{
      const el=fieldEl(form,name); if(!el) return;
      el.setAttribute('aria-required','true');
      const prev=el.previousElementSibling;
      if(prev && prev.tagName==='LABEL' && !prev.querySelector('.req')){
        prev.insertAdjacentHTML('beforeend',' <span class="req" aria-hidden="true">*</span>');
      }
    });
    if(key==='users'){
      ['password','passwordConfirm'].forEach(name=>{
        const el=fieldEl(form,name);
        if(!el || !el.required) return;
        const prev=el.previousElementSibling;
        if(prev && prev.tagName==='LABEL' && !prev.querySelector('.req')){
          prev.insertAdjacentHTML('beforeend',' <span class="req" aria-hidden="true">*</span>');
        }
      });
    }
    form.querySelectorAll('input[name], select[name], textarea[name]').forEach(el=>{
      if(el.disabled || el.type==='hidden') return;
      const revalidate=()=>{
        const msg=validateField(form,key,isNew,el);
        if(msg) showFieldError(el,msg);
        else {
          clearFieldError(el);
          const alert=form.querySelector('.form-alert');
          if(alert && !form.querySelector('.invalid')) alert.remove();
        }
      };
      el.addEventListener('blur',revalidate);
      el.addEventListener('change',revalidate);
      el.addEventListener('input',()=>{ if(el.classList.contains('invalid')) revalidate(); });
    });
  }

  async function withSubmitState(form, btn, fn){
    const b = btn || (form ? form.querySelector('button[type="submit"]') : null);
    if(!b) return await fn();
    const orig = b.textContent;
    b.disabled = true; b.textContent = 'Menyimpan...';
    try { return await fn(); }
    finally { b.disabled = false; b.textContent = orig; }
  }
  function serverFieldMessage(field,info){
    const label=fieldLabel(field);
    const msg=String((info&&info.message)||'').trim();
    const code=String((info&&info.code)||'').trim();
    const low=msg.toLowerCase();
    if(code==='validation_required' || low.includes('cannot be blank')){
      return field==='nowa' ? 'Nomor HP/WA belum diisi.' : `${label} belum diisi.`;
    }
    if(code==='validation_invalid_email' || low.includes('valid email')) return 'Format email tidak valid.';
    if(code==='validation_not_unique' || low.includes('unique')) return `${label} sudah digunakan.`;
    if(code==='validation_invalid_format' || low.includes('invalid format')) return `Format ${label} tidak valid.`;
    if(code==='validation_too_long' || low.includes('too long')) return `${label} terlalu panjang.`;
    if(code==='validation_too_short' || low.includes('too short')) return `${label} terlalu pendek.`;
    if(code==='validation_invalid_value' || low.includes('invalid value')) return `Nilai ${label} tidak valid.`;
    if(code==='validation_min_number' || code==='validation_max_number') return `Nilai ${label} di luar batas yang diizinkan.`;
    return msg ? `${label}: ${msg}` : `${label} tidak valid.`;
  }
  function serverFieldErrors(e){
    const root=e && e.data && e.data.data;
    if(!root || typeof root!=='object' || Array.isArray(root)) return [];
    return Object.entries(root)
      .filter(([,v])=>v && typeof v==='object')
      .map(([field,v])=>({field,msg:serverFieldMessage(field,v)}))
      .filter(x=>x.msg);
  }
  function handleSubmitError(e,form){
    if(form) clearFormErrors(form);
    const list=serverFieldErrors(e);
    if(list.length){
      let first=null;
      list.forEach(fe=>{
        const el=form?fieldEl(form,fe.field):null;
        if(el && !el.disabled){ showFieldError(el,fe.msg); if(!first) first=el; }
      });
      const msgs=[...new Set(list.map(x=>x.msg))];
      if(form) showFormAlert(form,msgs);
      if(first) focusField(first);
      toast('Belum bisa disimpan: '+msgs.slice(0,2).join(' ')+(msgs.length>2?` (+${msgs.length-2} lagi)`:'')+(first?'':' Periksa kembali isian form.'),{type:'error'});
      return;
    }
    const generic=(e && e.message) || 'Gagal menyimpan data.';
    if(form) showFormAlert(form,[generic]);
    toast(generic,{type:'error'});
  }

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
    {key:'pengaturan', label:'Pengaturan', admin:true, cols:['kunci','nilai','diubah_pada']},
    {key:'riwayat', label:'Riwayat', admin:true, cols:['waktu','aktor','aksi','modul','record_id']},
  ];

  function layout(content){
    const u=me();
    const navItems=[['dashboard','Dashboard'],['tugas_saya','Tugas Saya'],['tugas_lembur','Tugas Lembur'],['qr_absen','QR Absen'],['pengumuman','Pengumuman'],['pesan','Pesan'],...MODULES.filter(m=>!m.admin||isAdmin()).map(m=>[m.key,m.label]),['logout','Keluar']];
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
  function loginView(err=''){ return `<div class="login card"><h2 style="margin-top:0">Masuk</h2><p class="muted" style="margin-top:-4px">Malahotspot Admin</p>${err?`<div class="form-alert" role="alert"><b>Gagal masuk</b><ul><li>${esc(err)}</li></ul></div>`:''}<form id="loginForm" novalidate><label>Email / Identitas</label><input name="identity" placeholder="Masukkan email atau identitas" required autofocus><label>Kata sandi</label><input name="password" type="password" placeholder="Masukkan kata sandi" required><div style="margin-top:14px"><button class="btn btn-primary" type="submit" style="width:100%">Masuk</button></div></form></div>`; }

  async function render(){
    const app=$('#app'); if(!(await ensureAuth())){ app.innerHTML=loginView(); $('#loginForm').onsubmit=onLogin; return; }
    await loadCache();
    let html=''; try{
      if(state.view==='dashboard') html=await dashboardView();
      else if(state.view==='tugas_saya') html=await tugasSayaView();
      else if(state.view==='tugas_lembur') html=await tugasLemburView();
      else if(state.view==='qr_absen') html=await qrAbsenView();
      else if(state.view==='pengumuman') html=await pengumumanView();
      else if(state.view==='pesan') html=await pesanView();
      else if(state.view==='notifikasi') html=await notifikasiView();
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
      const sb=$('#sidebar'); if(sb) sb.classList.remove('open');
      render(); 
    });
    const nb=$('#btnNotif'); if(nb) nb.onclick=()=>{ clearNotif('all'); state.view='notifikasi'; state.page=1; state.detail=null; const sb=$('#sidebar'); if(sb) sb.classList.remove('open'); render(); };
    const mt=$('#menuToggle'), sb=$('#sidebar');
    if(mt && sb){ mt.onclick=()=>sb.classList.toggle('open'); }
    const tt=$('#themeToggle');
    if(tt) tt.onclick=toggleTheme;
  }

  async function notifikasiView(){
    clearNotif('all');
    const uid = me() && me().id;
    const groups = [];

    try{
      const r = await pb.collection('pesan_langsung').getList(1,10,{filter:`penerima = "${uid}"`, sort:'-dibuat_pada', expand:'pengirim'});
      const rows = (r.items||[]).map(m=>{
        const dari = expandName(m,'pengirim') || nameOf(state.cache.users,m.pengirim,m.pengirim) || 'Pengguna';
        const unread = !m.dibaca_pada;
        return `<div class="card" style="margin-top:8px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><b>${esc(dari)}</b> ${unread?'<span class="badge low">baru</span>':''}<div style="margin-top:4px">${esc(String(m.isi||'').slice(0,140))}</div><div class="muted" style="margin-top:6px">${esc(witaDisplay(m.dibuat_pada))}</div></div><div><button class="btn btn-ghost" data-open="pesan:">Buka Pesan</button></div></div></div>`;
      }).join('');
      groups.push(`<div class="card"><h3 style="margin-top:0">Pesan Masuk</h3>${rows || '<div class="muted">Belum ada pesan masuk.</div>'}</div>`);
    }catch(e){
      groups.push(`<div class="card"><h3 style="margin-top:0">Pesan Masuk</h3><div class="error">${esc(e.message||'Gagal memuat pesan')}</div></div>`);
    }

    try{
      const r = await pb.collection('pengumuman').getList(1,8,{filter:'diarsipkan = false', sort:'-dibuat_pada'});
      const rows = (r.items||[]).map(a=>`<div class="card" style="margin-top:8px"><b>${esc(a.judul||'Pengumuman')}</b><div style="margin-top:4px">${esc(String(a.isi||'').slice(0,160))}</div><div class="muted" style="margin-top:6px">${esc(witaDisplay(a.dibuat_pada))}</div><div style="margin-top:8px"><button class="btn btn-ghost" data-open="pengumuman:">Lihat Pengumuman</button></div></div>`).join('');
      groups.push(`<div class="card"><h3 style="margin-top:0">Pengumuman</h3>${rows || '<div class="muted">Belum ada pengumuman.</div>'}</div>`);
    }catch(e){
      groups.push(`<div class="card"><h3 style="margin-top:0">Pengumuman</h3><div class="error">${esc(e.message||'Gagal memuat pengumuman')}</div></div>`);
    }

    try{
      const filter = isAdmin() ? 'status = "Menunggu"' : `pemohon = "${uid}"`;
      const title = isAdmin() ? 'Usulan Menunggu Persetujuan' : 'Usulan Saya';
      const r = await pb.collection('usulan_perubahan').getList(1,10,{filter, sort:'-dibuat_pada', expand:'pemohon'});
      const rows = (r.items||[]).map(u=>{
        const pemohon = expandName(u,'pemohon') || nameOf(state.cache.users,u.pemohon,u.pemohon) || '-';
        return `<div class="card" style="margin-top:8px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><b>${esc(u.modul||'Usulan')}</b> <span class="badge">${esc(u.status||'-')}</span><div class="muted" style="margin-top:4px">Record: ${esc(u.record_id||'-')} · Pemohon: ${esc(pemohon)}</div><div class="muted" style="margin-top:4px">${esc(witaDisplay(u.dibuat_pada))}</div></div><div><button class="btn btn-ghost" data-open="usulan_perubahan:${esc(u.id)}">Buka</button></div></div></div>`;
      }).join('');
      groups.push(`<div class="card"><h3 style="margin-top:0">${esc(title)}</h3>${rows || '<div class="muted">Tidak ada usulan.</div>'}</div>`);
    }catch(e){
      groups.push(`<div class="card"><h3 style="margin-top:0">Usulan</h3><div class="error">${esc(e.message||'Gagal memuat usulan')}</div></div>`);
    }

    try{
      const [g,p,rp] = await Promise.all([
        pb.collection('layanan_gangguan').getList(1,5,{filter:`ditugaskan_ke = "${uid}" && diarsipkan = false`, sort:'-diubah_pada', expand:'pelanggan'}),
        pb.collection('pemasangan').getList(1,5,{filter:`ditugaskan_ke = "${uid}" && diarsipkan = false`, sort:'-diubah_pada', expand:'pelanggan'}),
        pb.collection('perbaikan').getList(1,5,{filter:`teknisi = "${uid}" && diarsipkan = false`, sort:'-diubah_pada', expand:'pelanggan'})
      ]);
      const rows = []
        .concat((g.items||[]).map(it=>({col:'layanan_gangguan', label:'Gangguan', it})))
        .concat((p.items||[]).map(it=>({col:'pemasangan', label:'Pemasangan', it})))
        .concat((rp.items||[]).map(it=>({col:'perbaikan', label:'Perbaikan', it})))
        .sort((a,b)=>new Date(b.it.diubah_pada||b.it.dibuat_pada||0)-new Date(a.it.diubah_pada||a.it.dibuat_pada||0))
        .slice(0,10)
        .map(({col,label,it})=>{
          const pelanggan = expandName(it,'pelanggan') || nameOf(state.cache.pelanggan,it.pelanggan,it.pelanggan||'-');
          const info = it.keluhan || it.tindakan || '-';
          return `<div class="card" style="margin-top:8px"><div class="row" style="justify-content:space-between;align-items:flex-start"><div><b>${esc(label)}</b> · <span class="badge">${esc(it.status||'-')}</span><div style="margin-top:4px">Pelanggan: ${esc(pelanggan||'-')}</div><div class="muted" style="margin-top:4px">${esc(String(info).slice(0,100))}</div><div class="muted" style="margin-top:4px">Diperbarui: ${esc(witaDisplay(it.diubah_pada||it.dibuat_pada))}</div></div><div><button class="btn btn-ghost" data-open="${col}:${esc(it.id)}">Buka</button></div></div></div>`;
        }).join('');
      groups.push(`<div class="card"><h3 style="margin-top:0">Tugas Saya Terbaru</h3>${rows || '<div class="muted">Belum ada tugas yang ditugaskan.</div>'}</div>`);
    }catch(e){
      groups.push(`<div class="card"><h3 style="margin-top:0">Tugas Saya Terbaru</h3><div class="error">${esc(e.message||'Gagal memuat tugas')}</div></div>`);
    }

    return `<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><h2 style="margin:0">Notifikasi</h2><p class="muted" style="margin:4px 0 0">Ringkasan pesan, pengumuman, usulan, dan tugas terbaru.</p></div><div><button class="btn btn-ghost" id="enableBrowserNotif">Aktifkan Notifikasi Browser</button></div></div></div>${groups.join('')}`;
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
      try{
        const r=await pb.collection(col).getList(1,50,{filter:`${field} = "${uid}" && diarsipkan = false`, sort:'-diubah_pada', expand:'pelanggan'});
        html+=`<div class="card"><h3>${label}</h3>`+(r.items.length?`<div class="table-wrap"><table><tr><th>Pelanggan</th><th>Status</th><th>Info</th><th></th></tr>${r.items.map(it=>{
          const pelanggan = expandName(it,'pelanggan') || nameOf(state.cache.pelanggan, it.pelanggan, it.pelanggan||'-');
          const info = it.keluhan || it.tindakan || '-';
          return `<tr><td>${esc(pelanggan||'-')}</td><td>${esc(it.status||'-')}</td><td>${esc(String(info).slice(0,60))}</td><td><button class="btn" data-open="${col}:${it.id}">Buka</button></td></tr>`;
        }).join('')}</table></div>`:'<div class="muted">Tidak ada tugas.</div>')+'</div>';
      }catch(e){ html+=`<div class="card"><h3>${label}</h3><div class="error">${esc(e.message)}</div></div>`; }
    } return html;
  }

  function witaHHMMFromStored(v){
    if(!v) return '';
    const s = String(v).trim();
    if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) && !/Z$/i.test(s) && s.indexOf('T')===-1){
      return s.slice(11,16);
    }
    try{
      const d = new Date(s);
      if(isNaN(d)) return '';
      const w = new Date(d.getTime() + 8*3600*1000);
      const p=n=>String(n).padStart(2,'0');
      return `${p(w.getUTCHours())}:${p(w.getUTCMinutes())}`;
    }catch(e){ return ''; }
  }

  async function tugasLemburView(){
    await loadCache();
    const map = await getPengaturanMap();
    let jamMulai = String(nilaiSetting(map['jam_mulai_lembur'],'17:00') || '17:00');
    if(!/^\d{2}:\d{2}$/.test(jamMulai)) jamMulai = '17:00';

    const defs = [
      {col:'layanan_gangguan', label:'Layanan Gangguan', infoField:'keluhan', personField:'ditugaskan_ke', expand:'pelanggan,ditugaskan_ke'},
      {col:'pemasangan', label:'Pemasangan', infoField:null, personField:'ditugaskan_ke', expand:'pelanggan,ditugaskan_ke'},
      {col:'perbaikan', label:'Perbaikan', infoField:'tindakan', personField:'teknisi', expand:'pelanggan,teknisi'},
    ];
    let rows = [];
    let errs = [];
    for(const d of defs){
      try{
        const r = await pb.collection(d.col).getList(1,200,{filter:'status = "Selesai" && diarsipkan = false', sort:'-selesai_pada,-diubah_pada', expand:d.expand});
        (r.items||[]).forEach(it=>{
          const selesai = it.selesai_pada || it.diubah_pada || '';
          const hhmm = witaHHMMFromStored(selesai);
          if(hhmm && hhmm >= jamMulai){
            const pelanggan = expandName(it,'pelanggan') || nameOf(state.cache.pelanggan, it.pelanggan, it.pelanggan||'-');
            const person = d.personField==='teknisi'
              ? (expandName(it,'teknisi') || nameOf(state.cache.users, it.teknisi, it.teknisi||'-'))
              : (expandName(it,'ditugaskan_ke') || nameOf(state.cache.users, it.ditugaskan_ke, it.ditugaskan_ke||'-'));
            const info = d.infoField ? (it[d.infoField]||'-') : '-';
            rows.push({col:d.col,label:d.label,id:it.id,pelanggan,person,info,selesai,hhmm});
          }
        });
      }catch(e){ errs.push(`${d.label}: ${esc(e.message||e)}`); }
    }
    rows.sort((a,b)=>String(b.selesai||'').localeCompare(String(a.selesai||'')));

    const body = rows.length
      ? `<div class="table-wrap"><table><thead><tr><th>Modul</th><th>Pelanggan</th><th>Petugas</th><th>Waktu Selesai (WITA)</th><th>Info</th><th>Aksi</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.label)}</td><td>${esc(x.pelanggan||'-')}</td><td>${esc(x.person||'-')}</td><td>${esc(x.selesai ? (String(x.selesai).indexOf('T')!==-1 || /Z$/i.test(String(x.selesai)) ? witaDisplay(x.selesai) : String(x.selesai).slice(0,16)) : '-')} <span class="badge">Lembur</span></td><td>${esc(String(x.info||'-').slice(0,60))}</td><td><button class="btn btn-ghost" data-open="${esc(x.col)}:${esc(x.id)}">Buka</button></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="muted">Belum ada tugas selesai pada jam lembur.</div>';

    const errHtml = errs.length ? `<div class="card"><div class="error">${errs.join('<br>')}</div></div>` : '';
    const infoAdmin = isAdmin() ? `<p class="muted" style="margin:4px 0 0">Jam mulai lembur dapat diubah di menu <b>Pengaturan</b>.</p>` : '';
    return `<div class="card"><h2 style="margin:0 0 4px">Tugas Lembur</h2><p class="muted" style="margin:0">Daftar tugas yang berstatus <b>Selesai</b> pada atau setelah pukul <b>${esc(jamMulai)} WITA</b>.</p>${infoAdmin}</div>${errHtml}<div class="card"><h3 style="margin-top:0">Daftar Tugas Selesai (Lembur)</h3>${body}</div>`;
  }

  async function qrAbsenView(){
    if(isAdmin()){
      return `<div class="card"><h2>QR Absen (Admin)</h2><div class="row"><button class="btn" id="genQr">Tampilkan/Refresh QR</button><button class="btn" id="refreshToday">Refresh Absen Hari Ini</button><span id="qrInfo" class="muted"></span></div>
        <div id="qrBox" style="margin:10px 0"></div><h3>Absen Hari Ini (WITA)</h3><div id="todayAbs" class="muted">Memuat...</div></div>`;
    }
    return `<div class="card"><h2>Absen Saya</h2><p class="muted">Pindai QR kantor atau input Izin/Sakit (mandiri).</p>
      <div class="row"><button class="btn" id="scanQrBtn">Pindai QR</button></div>
      <video id="qrVideo" style="max-width:320px;display:none;margin-top:8px;border-radius:8px"></video><div id="scanMsg" class="muted"></div>
      <hr><h3>Input Izin/Sakit</h3><form id="izinForm" class="grid" novalidate><div><label>Keterangan</label><select name="keterangan"><option>Izin</option><option>Sakit</option></select></div>
      <div style="grid-column:1/-1"><label>Alasan</label><textarea name="alasan" placeholder="Jelaskan alasan izin/sakit..." required></textarea></div><div><button class="btn btn-primary" type="submit">Kirim</button></div></form></div>`;
  }

  async function pengumumanView(){
    const canManage=isAdmin(); let list={items:[]}; try{ list=await pb.collection('pengumuman').getList(1,50,{sort:'-dibuat_pada'});}catch(e){return `<div class="card error">${esc(e.message)}</div>`;}
    const form = canManage?`<div class="card"><h3>Buat Pengumuman</h3><form id="annForm" novalidate><label>Judul</label><input name="judul" placeholder="Judul pengumuman" required><label>Isi</label><textarea name="isi" placeholder="Tulis isi pengumuman..." required></textarea><label>Foto (opsional)</label><input type="file" name="foto" accept="image/jpeg,image/png,image/webp"><div style="margin-top:10px"><button class="btn btn-primary" type="submit">Kirim Pengumuman</button></div></form></div>`:'';
    const items=list.items.map(x=>`<div class="card"><b>${esc(x.judul)}</b> ${x.diarsipkan?'<span class="badge">nonaktif</span>':''}<div>${esc(x.isi)}</div>${x.foto?`<div style="margin-top:6px"><a href="${esc(pb.fileUrl(x,x.foto))}" target="_blank" rel="noopener"><img src="${esc(pb.fileUrl(x,x.foto))}" alt="foto" style="max-width:220px;border:1px solid var(--border);border-radius:8px"></a></div>`:''}<div class="muted">${esc(witaDisplay(x.dibuat_pada))}</div>${canManage?`<div class="row" style="margin-top:6px"><button class="btn" data-ann-arc="${x.id}:${x.diarsipkan?'1':'0'}">${x.diarsipkan?'Pulihkan':'Arsipkan'}</button></div>`:''}</div>`).join('');
    return `<div class="card"><h2>Pengumuman</h2></div>${form}<div>${items||'<div class="card muted">Belum ada.</div>'}</div>`;
  }

  async function pesanView(){
    const users=(state.cache.users||[]).filter(u=>u.id!==me().id);
    let list={items:[]}; try{ list=await pb.collection('pesan_langsung').getList(1,50,{sort:'-dibuat_pada'});}catch(e){}
    const myId=me().id; const mine=list.items.filter(m=>m.pengirim===myId||m.penerima===myId||String(m.percakapan||'').includes(myId));
    return `<div class="card"><h2>Pesan Langsung (1-lawan-1)</h2><form id="msgForm" class="grid" novalidate><div><label>Penerima</label><select name="penerima" required><option value="">Pilih</option>${users.map(u=>`<option value="${esc(u.id)}">${esc(u.nama||u.email||u.id)}</option>`).join('')}</select></div>
      <div style="grid-column:1/-1"><label>Isi</label><textarea name="isi" placeholder="Tulis pesan..." required></textarea></div><div style="grid-column:1/-1"><label>Foto (opsional)</label><input type="file" name="foto" accept="image/jpeg,image/png,image/webp"></div><div><button class="btn btn-primary" type="submit">Kirim Pesan</button></div></form></div>
      <div class="card"><h3>Pesan Terbaru</h3>${mine.length?`<div class="table-wrap"><table><tr><th>Waktu</th><th>Dari</th><th>Ke</th><th>Isi</th><th>Foto</th></tr>${mine.map(m=>`<tr><td>${esc(witaDisplay(m.dibuat_pada))}</td><td>${esc(m.pengirim===myId?'Saya':nameOf(state.cache.users,m.pengirim,m.pengirim))}</td><td>${esc(m.penerima===myId?'Saya':nameOf(state.cache.users,m.penerima,m.penerima))}</td><td>${esc(m.isi)}</td><td>${m.foto?`<a href="${esc(pb.fileUrl(m,m.foto))}" target="_blank" rel="noopener">Lihat</a>`:''}</td></tr>`).join('')}</table></div>`:'<div class="muted">Belum ada pesan.</div>'}</div>`;
  }

  async function getPengaturanMap(){
    const map={};
    try{
      const list=await pb.collection('pengaturan').getList(1,200);
      (list.items||[]).forEach(r=>{ map[r.kunci]=r; });
    }catch(e){}
    return map;
  }
  function nilaiSetting(rec, def){
    if(!rec) return def;
    const v = Object.prototype.hasOwnProperty.call(rec,'nilai') ? rec.nilai : undefined;
    return (v===null||v===undefined||v==='') ? def : v;
  }
  async function pengaturanView(){
    if(!isAdmin()) return '<div class="card">Khusus admin.</div>';
    const map = await getPengaturanMap();
    const intervalQr = Math.max(5, Number(nilaiSetting(map['interval_qr'],30)) || 30);
    let jamTutup = String(nilaiSetting(map['jam_tutup_absen'],'23:59') || '23:59');
    if(!/^\d{2}:\d{2}$/.test(jamTutup)) jamTutup='23:59';
    const intervalSheets = Math.max(1, Number(nilaiSetting(map['interval_sinkron_sheets'],5)) || 5);
    const retensiRaw = nilaiSetting(map['retensi_riwayat_hari'],0);
    const retensi = (retensiRaw===0 || retensiRaw==='0' || retensiRaw==='') ? 0 : Math.max(0, Number(retensiRaw) || 0);
    let jamMulaiLembur = String(nilaiSetting(map['jam_mulai_lembur'],'17:00') || '17:00');
    if(!/^\d{2}:\d{2}$/.test(jamMulaiLembur)) jamMulaiLembur='17:00';
    const lastSyncVal = nilaiSetting(map['sheets_last_sync'],'');
    let lastSyncTxt = 'Belum pernah';
    if(lastSyncVal){
      const ms = Number(lastSyncVal);
      if(!isNaN(ms) && ms>0){ try{ lastSyncTxt = witaDisplay(new Date(ms).toISOString()); }catch(e){ lastSyncTxt = String(lastSyncVal); } }
      else lastSyncTxt = String(lastSyncVal);
    }
    return `<div class="card"><h2 style="margin:0 0 6px">Pengaturan Sistem</h2><p class="muted" style="margin:0">Atur pengaturan aplikasi dengan mudah. Ubah nilai yang diinginkan lalu klik <b>Simpan Pengaturan</b>.</p></div>
    <form id="pengaturanForm" novalidate>
      <div class="card">
        <h3 style="margin-top:0">Absensi (QR)</h3>
        <p class="muted" style="margin-top:-2px">Pengaturan untuk absen kehadiran menggunakan QR.</p>
        <label for="set_interval_qr">Masa berlaku kode QR (detik)</label>
        <input id="set_interval_qr" name="interval_qr" type="number" min="5" step="1" value="${esc(String(intervalQr))}">
        <div class="muted" style="font-size:.82rem;margin-top:4px">Kode QR akan diperbarui otomatis setiap beberapa detik. Contoh umum: <b>30</b> detik.</div>
        <label for="set_jam_tutup">Batas akhir absen (jam, WITA)</label>
        <input id="set_jam_tutup" name="jam_tutup_absen" type="time" value="${esc(jamTutup)}">
        <div class="muted" style="font-size:.82rem;margin-top:4px">Setelah jam ini, absen lewat QR tidak diterima. Contoh: <b>23:59</b>.</div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Sinkron Google Sheets</h3>
        <p class="muted" style="margin-top:-2px">Pengaturan pengiriman data ke Google Sheets (jika sudah dikonfigurasi di server).</p>
        <label for="set_interval_sheets">Seberapa sering sinkron otomatis (menit)</label>
        <input id="set_interval_sheets" name="interval_sinkron_sheets" type="number" min="1" step="1" value="${esc(String(intervalSheets))}">
        <div class="muted" style="font-size:.82rem;margin-top:4px">Contoh: <b>5</b> berarti sinkron otomatis sekitar setiap 5 menit.</div>
        <label>Status sinkron terakhir</label>
        <div class="card" style="padding:12px 14px;background:var(--bg-surface-alt);box-shadow:none"><b>${esc(lastSyncTxt)}</b><div class="muted" style="font-size:.82rem;margin-top:2px">Informasi ini diperbarui otomatis oleh sistem.</div></div>
        <div class="row" style="margin-top:12px;align-items:center"><button class="btn btn-primary" type="button" id="syncSheetsNow">Sinkronkan Sekarang</button><span id="syncSheetsMsg" class="muted" style="font-size:.85rem"></span></div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Lembur</h3>
        <p class="muted" style="margin-top:-2px">Tentukan batas mulai jam lembur (WITA). Tugas yang <b>selesai</b> pada atau setelah jam ini akan masuk ke daftar <b>Tugas Lembur</b>.</p>
        <label for="set_jam_mulai_lembur">Jam mulai lembur (WITA)</label>
        <input id="set_jam_mulai_lembur" name="jam_mulai_lembur" type="time" value="${esc(jamMulaiLembur)}">
        <div class="muted" style="font-size:.82rem;margin-top:4px">Contoh: <b>17:00</b> berarti tugas yang selesai pukul 17:00 atau lebih dihitung lembur.</div>
      </div>
      <div class="card">
        <h3 style="margin-top:0">Riwayat Aktivitas</h3>
        <p class="muted" style="margin-top:-2px">Atur agar riwayat lama dibersihkan otomatis supaya data tidak menumpuk.</p>
        <label for="set_retensi">Simpan riwayat selama (hari)</label>
        <input id="set_retensi" name="retensi_riwayat_hari" type="number" min="0" step="1" value="${esc(String(retensi))}">
        <div class="muted" style="font-size:.82rem;margin-top:4px">Isi <b>0</b> jika tidak ingin hapus otomatis. Contoh: <b>30</b> untuk menyimpan riwayat 30 hari terakhir (yang lebih lama dihapus otomatis setiap hari).</div>
      </div>
      <div class="card">
        <div class="row" style="justify-content:space-between;align-items:center;gap:10px">
          <div class="muted" style="font-size:.9rem">Perubahan disimpan dan langsung digunakan oleh sistem.</div>
          <button class="btn btn-primary" type="submit">Simpan Pengaturan</button>
        </div>
      </div>
    </form>`;
  }

  function getMod(k){ return MODULES.find(m=>m.key===k); }
  async function moduleView(key){
    if(key==='pengaturan') return pengaturanView();
    if(state.detail) return detailView(key, state.detail);
    const mod=getMod(key); if(!mod) return '<div class="card">Modul tidak ditemukan.</div>';
    if(mod.admin && !isAdmin()) return '<div class="card">Khusus admin.</div>';
    const noArchive = (key === 'riwayat' || key === 'pengaturan');
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
        pengaturan:['id','kunci'],
        pengumuman:['id','judul','isi']
      };
      const fields = smap[key] || ['id'];
      const q = fields.map(f=>`${f} ~ "${sv}"`).join(' || ');
      filter += filter ? ` && (${q})` : `(${q})`;
    }
    const sort = key==='users' ? '-created' : (key==='riwayat' ? '-waktu' : (key==='pengaturan' ? '-diubah_pada' : '-dibuat_pada'));
    const expand = (()=>{
      if(['layanan_gangguan','pemasangan','perbaikan'].includes(key)) return 'pelanggan,teknisi,ditugaskan_ke';
      if(key==='absen_hadir') return 'teknisi,dicatat_oleh';
      if(key==='mutasi_inventaris') return 'barang,dicatat_oleh';
      if(key==='usulan_perubahan') return 'pemohon,peninjau';
      if(key==='riwayat') return 'aktor';
      return '';
    })();
    let list={items:[],page:1,totalPages:1,totalItems:0}; try{ list=await pb.collection(key).getList(state.page||1,50,{filter, sort, ...(expand?{expand}:{})});}catch(e){ return `<div class="card"><h2>${esc(mod.label)}</h2><div class="error">${esc(e.message)}</div></div>`; }
    const cols=mod.cols; const rows=list.items.map(it=>`<tr>${cols.map(c=>`<td>${cell(key,c,it)}</td>`).join('')}<td><button class="btn" data-open="${key}:${it.id}">Buka</button></td></tr>`).join('');
    let extraTop = '';
    if(key==='pengaturan'){
      extraTop = `<div class="card"><h3 style="margin-top:0">Panduan Pengaturan Sistem</h3>
        <p class="muted" style="margin-top:0">Ubah nilai pada daftar di bawah, atau tambah kunci baru bila diperlukan. Kolom <b>Nilai</b> disimpan sebagai JSON (contoh angka: <code>30</code>, teks: <code>"23:59"</code>).</p>
        <div class="table-wrap"><table><thead><tr><th>Kunci</th><th>Fungsi</th><th>Contoh Nilai</th></tr></thead><tbody>
          <tr><td><code>interval_qr</code></td><td>Interval berlaku token QR absen (detik)</td><td><code>30</code></td></tr>
          <tr><td><code>jam_tutup_absen</code></td><td>Batas waktu absen (WITA)</td><td><code>"23:59"</code></td></tr>
          <tr><td><code>interval_sinkron_sheets</code></td><td>Interval sinkron otomatis ke Google Sheets (menit)</td><td><code>5</code></td></tr>
          <tr><td><code>retensi_riwayat_hari</code></td><td>Hapus otomatis riwayat yang lebih lama dari jumlah hari ini (0/nonaktif = tidak dihapus)</td><td><code>30</code></td></tr>
          <tr><td><code>sheets_last_sync</code></td><td>Waktu sinkron Sheets terakhir (otomatis oleh sistem)</td><td>—</td></tr>
        </tbody></table></div>
        <p class="muted" style="margin:10px 0 0">Pengaturan lain di sistem (akun, data, penugasan, inventaris, usulan, pengumuman, dll.) dapat dikelola melalui menu masing-masing.</p></div>`;
    }
    if(key==='riwayat' && isAdmin()){
      extraTop += `<div class="card"><div class="row" style="justify-content:space-between;align-items:flex-end;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:240px"><h3 style="margin:0">Bersihkan Riwayat</h3><p class="muted" style="margin:4px 0 0">Hapus riwayat aktivitas berdasarkan rentang waktu (seperti penghapusan riwayat di browser). Tindakan ini tidak dapat dibatalkan.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
          <div style="min-width:220px"><label style="margin:0 0 4px">Rentang waktu</label><select id="clearRiwayatRange">
            <option value="1h">1 jam terakhir</option>
            <option value="24h">24 jam terakhir</option>
            <option value="7d">7 hari terakhir</option>
            <option value="4w">4 minggu terakhir</option>
            <option value="30d">30 hari terakhir</option>
            <option value="all">Sepanjang waktu (semua)</option>
          </select></div>
          <div><button class="btn" id="clearRiwayat">Hapus Riwayat</button></div>
        </div>
      </div></div>`;
    }
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
    return `${extraTop}<div class="card"><div class="toolbar"><h2>${esc(mod.label)} <span class="badge">${esc(viewLabel)}</span></h2><div class="row"><input id="searchBox" placeholder="Cari data..." value="${esc(state.search||'')}">${aktifToggle}<button class="btn btn-ghost" id="btnSearch">Cari</button>${canCreate(key)?`<button class="btn btn-primary" id="btnNew" data-new="${key}">+ Tambah</button>`:''}</div></div>
      <div class="table-wrap" style="overflow:auto"><table><thead><tr>${cols.map(c=>`<th>${esc(c)}</th>`).join('')}<th>Aksi</th></tr></thead><tbody>${rows||'<tr><td colspan="99" class="muted">Tidak ada data.</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:8px"><span class="muted">Hal ${list.page}/${list.totalPages} (${list.totalItems})</span><button class="btn" id="prevPage" ${list.page<=1?'disabled':''}>Prev</button><button class="btn" id="nextPage" ${list.page>=list.totalPages?'disabled':''}>Next</button></div></div>`;
  }

  async function detailView(key,id){
    const expand = (()=>{
      if(['layanan_gangguan','pemasangan','perbaikan'].includes(key)) return 'pelanggan,teknisi,ditugaskan_ke';
      if(key==='absen_hadir') return 'teknisi,dicatat_oleh';
      if(key==='mutasi_inventaris') return 'barang,dicatat_oleh';
      if(key==='usulan_perubahan') return 'pemohon,peninjau';
      if(key==='riwayat') return 'aktor';
      return '';
    })();
    let rec; try{ rec=await pb.collection(key).getOne(id, expand?{expand}:{ }); }catch(e){ return `<div class="card error">${esc(e.message)}</div>`; }
    const mod=getMod(key); const canArc = isAdmin() && rec.diarsipkan!==undefined;
    let extra='';
    if(key==='usulan_perubahan'){
      const st=rec.status; const mine = rec.pemohon===me().id;
      extra = `<div class="card" style="margin-top:8px"><h3>Aksi Usulan</h3>${isAdmin() && st==='Menunggu'?`<label>Nilai usulan (JSON, untuk "Ubah lalu setujui")</label><textarea id="uNilai" rows="4">${esc(typeof rec.nilai_usulan==='string'?rec.nilai_usulan:JSON.stringify(rec.nilai_usulan||{},null,2))}</textarea><div class="row" style="margin-top:8px"><button class="btn" id="uApprove">Setujui</button><button class="btn" id="uApproveEdit">Ubah lalu Setujui</button><button class="btn" id="uReject">Tolak</button></div>`:''}${mine && st==='Menunggu'?`<div class="row" style="margin-top:8px"><button class="btn" id="uWithdraw">Tarik Usulan Saya</button></div>`:''}<div id="uMsg" class="muted"></div></div>`;
    }
    if(key==='pemasangan' && !isAdmin() && rec && rec.id){
      const pelOpts = (state.cache.pelanggan||[]).filter(p=>!p.diarsipkan).map(p=>`<option value="${esc(p.id)}" ${String(rec.pelanggan||'')===String(p.id)?'selected':''}>${esc(p.nama||p.id)}</option>`).join('');
      extra += `<div class="card" style="margin-top:8px"><h3>Usulkan Perubahan Pelanggan</h3><p class="muted" style="margin-top:-2px">Nama pelanggan ditentukan oleh admin. Jika perlu diubah, kirim usulan dan tunggu persetujuan admin.</p>
        <label for="usulPelanggan">Pelanggan yang diusulkan</label>
        <select id="usulPelanggan"><option value="">-- Pilih pelanggan --</option>${pelOpts}</select>
        <div class="row" style="margin-top:10px"><button class="btn btn-primary" type="button" id="kirimUsulPelanggan">Kirim Usulan</button></div>
        <div id="usulPelangganMsg" class="muted" style="margin-top:8px"></div>
      </div>`;
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
    if(key==='pelanggan'){
      try{
        await loadCache();
        let histItems = [];
        try{
          const hr = await pb.collection('riwayat_pemasangan_perangkat').getList(1, 300, {filter:`pelanggan = "${id}"`, sort:'tanggal_pasang,dibuat_pada', expand:'perangkat,pemasangan,perbaikan'});
          histItems = (hr.items||[]).slice().sort((a,b)=>new Date(a.tanggal_pasang||a.dibuat_pada||0)-new Date(b.tanggal_pasang||b.dibuat_pada||0));
        }catch(_){ histItems = []; }

        const devName = (it)=>{
          const d = (it && it.expand && it.expand.perangkat) ? it.expand.perangkat : (state.cache.perangkat||[]).find(x=>String(x.id)===String(it.perangkat));
          if(!d) return String(it.perangkat||'-');
          return `${d.nama||'-'}${d.tipe?(' ('+d.tipe+')'):''}${d.sn_serial?(' SN:'+d.sn_serial):''}`;
        };

        if(histItems.length){
          const first = histItems.find(x=>String(x.jenis)==='Pemasangan Pertama') || histItems[0];
          const aktif = histItems.filter(x=>String(x.status)==='Aktif');
          const firstDev = first ? devName(first) : '-';
          const firstDate = first ? witaDisplay(first.tanggal_pasang) : '-';
          const curTxt = aktif.length ? aktif.map(devName).map(esc).join(', ') : '<span class="muted">Belum ada perangkat aktif</span>';
          const summary = `<div class="card" style="margin-top:8px"><h3>Ringkasan Pemasangan Pelanggan</h3>
            <div class="row" style="gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:220px"><div class="muted" style="font-size:.85rem">Pemasangan Pertama</div><div><b>${esc(firstDate)}</b></div><div>${esc(firstDev)}</div></div>
              <div style="flex:1;min-width:220px"><div class="muted" style="font-size:.85rem">Perangkat Saat Ini (Aktif)</div><div>${curTxt}</div></div>
            </div></div>`;

          const rows = histItems.map((it,idx)=>{
            const srcCol = it.pemasangan ? 'pemasangan' : (it.perbaikan ? 'perbaikan' : '');
            const srcId = it.pemasangan || it.perbaikan || '';
            const srcBtn = srcCol && srcId ? `<button class="btn btn-ghost" data-open="${esc(srcCol)}:${esc(srcId)}">Buka</button>` : '<span class="muted">-</span>';
            const dilepas = it.tanggal_dilepas ? esc(witaDisplay(it.tanggal_dilepas)) : '<span class="muted">-</span>';
            const jenisBadge = String(it.jenis)==='Pemasangan Pertama' ? '<span class="badge">Pemasangan Pertama</span>' : `<span class="badge">${esc(it.jenis||'Penggantian')}</span>`;
            const statusBadge = String(it.status)==='Aktif' ? '<span class="badge ok">Aktif</span>' : `<span class="badge">${esc(it.status||'-')}</span>`;
            return `<tr><td>${idx+1}</td><td>${esc(witaDisplay(it.tanggal_pasang))}</td><td>${dilepas}</td><td>${jenisBadge}</td><td>${statusBadge}</td><td>${esc(devName(it))}</td><td>${srcBtn}</td></tr>`;
          }).join('');
          extra += `${summary}<div class="card" style="margin-top:8px"><h3>Riwayat Pemasangan & Pergantian Perangkat</h3><p class="muted" style="margin-top:-2px">Seluruh riwayat pemasangan perangkat pelanggan ini tercatat (pertama dan setiap pergantian).</p><div class="table-wrap"><table><thead><tr><th>#</th><th>Tanggal Pasang</th><th>Tanggal Dilepas</th><th>Jenis</th><th>Status</th><th>Perangkat</th><th>Sumber</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
        } else {
          // fallback dari data pemasangan (kompatibilitas)
          const r = await pb.collection('pemasangan').getList(1, 200, {filter:`pelanggan = "${id}"`, sort:'tanggal,dibuat_pada'});
          const items = (r.items||[]).slice().sort((a,b)=>new Date(a.tanggal||a.dibuat_pada||0)-new Date(b.tanggal||b.dibuat_pada||0));
          const devNameById = (did)=>{
            const d = (state.cache.perangkat||[]).find(x=>String(x.id)===String(did));
            if(!d) return String(did||'-');
            return `${d.nama||'-'}${d.tipe?(' ('+d.tipe+')'):''}${d.sn_serial?(' SN:'+d.sn_serial):''}`;
          };
          const rows = items.map((it,idx)=>{
            const devs = Array.isArray(it.perangkat)?it.perangkat:(it.perangkat?[it.perangkat]:[]);
            const devTxt = devs.length ? devs.map(devNameById).map(esc).join(', ') : '<span class="muted">-</span>';
            const mark = idx===0 ? ' <span class="badge">Pemasangan Pertama</span>' : ` <span class="muted">(ke-${idx+1})</span>`;
            return `<tr><td>${idx+1}${mark}</td><td>${esc(witaDisplay(it.tanggal||it.dibuat_pada))}</td><td>${esc(it.status||'-')}</td><td>${devTxt}</td><td><button class="btn btn-ghost" data-open="pemasangan:${esc(it.id)}">Buka</button></td></tr>`;
          }).join('');
          extra += `<div class="card" style="margin-top:8px"><h3>Riwayat Pemasangan Perangkat</h3><p class="muted" style="margin-top:-2px">Riwayat dari data pemasangan (riwayat eksplisit belum tersedia).</p>${items.length?`<div class="table-wrap"><table><thead><tr><th>#</th><th>Tanggal</th><th>Status</th><th>Perangkat</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="muted">Belum ada riwayat pemasangan untuk pelanggan ini.</div>'}</div>`;
        }
      }catch(e){ extra += `<div class="card" style="margin-top:8px"><h3>Riwayat Pemasangan Perangkat</h3><div class="error">${esc(e.message||'Gagal memuat riwayat pemasangan')}</div></div>`; }
    }
    if(key==='inventaris_perangkat'){
      try{
        await loadCache();
        let histItems = [];
        try{
          const hr = await pb.collection('riwayat_pemasangan_perangkat').getList(1, 300, {filter:`perangkat = "${id}"`, sort:'tanggal_pasang,dibuat_pada', expand:'pelanggan,pemasangan,perbaikan'});
          histItems = (hr.items||[]).slice().sort((a,b)=>new Date(a.tanggal_pasang||a.dibuat_pada||0)-new Date(b.tanggal_pasang||b.dibuat_pada||0));
        }catch(_){ histItems = []; }

        if(histItems.length){
          const rows = histItems.map((it,idx)=>{
            const pel = expandName(it,'pelanggan') || nameOf(state.cache.pelanggan, it.pelanggan, it.pelanggan||'-');
            const srcCol = it.pemasangan ? 'pemasangan' : (it.perbaikan ? 'perbaikan' : '');
            const srcId = it.pemasangan || it.perbaikan || '';
            const srcBtn = srcCol && srcId ? `<button class="btn btn-ghost" data-open="${esc(srcCol)}:${esc(srcId)}">Buka</button>` : '<span class="muted">-</span>';
            const dilepas = it.tanggal_dilepas ? esc(witaDisplay(it.tanggal_dilepas)) : '<span class="muted">-</span>';
            const jenisBadge = String(it.jenis)==='Pemasangan Pertama' ? '<span class="badge">Pemasangan Pertama</span>' : `<span class="badge">${esc(it.jenis||'Penggantian')}</span>`;
            const statusBadge = String(it.status)==='Aktif' ? '<span class="badge ok">Aktif</span>' : `<span class="badge">${esc(it.status||'-')}</span>`;
            return `<tr><td>${idx+1}</td><td>${esc(witaDisplay(it.tanggal_pasang))}</td><td>${dilepas}</td><td>${jenisBadge}</td><td>${statusBadge}</td><td>${esc(pel||'-')}</td><td>${srcBtn}</td></tr>`;
          }).join('');
          extra += `<div class="card" style="margin-top:8px"><h3>Riwayat Pemasangan/Pemakaian Perangkat</h3><p class="muted" style="margin-top:-2px">Riwayat pemasangan dan pergantian perangkat ini pada pelanggan (tercatat otomatis).</p><div class="table-wrap"><table><thead><tr><th>#</th><th>Tanggal Pasang</th><th>Tanggal Dilepas</th><th>Jenis</th><th>Status</th><th>Pelanggan</th><th>Sumber</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
        } else {
          // fallback dari data tugas
          const [rp, rr] = await Promise.all([
            pb.collection('pemasangan').getList(1,200,{sort:'-tanggal,-dibuat_pada', expand:'pelanggan'}),
            pb.collection('perbaikan').getList(1,200,{sort:'-tanggal,-dibuat_pada', expand:'pelanggan'})
          ]);
          const hasDev = (it)=>{ const d=Array.isArray(it.perangkat)?it.perangkat:(it.perangkat?[it.perangkat]:[]); return d.map(String).includes(String(id)); };
          const list = []
            .concat((rp.items||[]).filter(hasDev).map(it=>({modul:'Pemasangan', col:'pemasangan', tanggal:it.tanggal||it.dibuat_pada, status:it.status, pelanggan: expandName(it,'pelanggan')||nameOf(state.cache.pelanggan,it.pelanggan,it.pelanggan||'-'), rid:it.id})))
            .concat((rr.items||[]).filter(hasDev).map(it=>({modul:'Perbaikan', col:'perbaikan', tanggal:it.tanggal||it.dibuat_pada, status:it.status, pelanggan: expandName(it,'pelanggan')||nameOf(state.cache.pelanggan,it.pelanggan,it.pelanggan||'-'), rid:it.id})))
            .sort((a,b)=>new Date(a.tanggal||0)-new Date(b.tanggal||0));
          const rows = list.map((it,idx)=>`<tr><td>${idx+1}</td><td>${esc(witaDisplay(it.tanggal))}</td><td>${esc(it.modul)}</td><td>${esc(it.pelanggan||'-')}</td><td>${esc(it.status||'-')}</td><td><button class="btn btn-ghost" data-open="${esc(it.col)}:${esc(it.rid)}">Buka</button></td></tr>`).join('');
          extra += `<div class="card" style="margin-top:8px"><h3>Riwayat Pemasangan/Pemakaian Perangkat</h3><p class="muted" style="margin-top:-2px">Riwayat dari data tugas (riwayat eksplisit belum tersedia).</p>${list.length?`<div class="table-wrap"><table><thead><tr><th>#</th><th>Tanggal</th><th>Modul</th><th>Pelanggan</th><th>Status</th><th>Aksi</th></tr></thead><tbody>${rows}</tbody></table></div>`:'<div class="muted">Belum ada riwayat pemasangan/pemakaian untuk perangkat ini.</div>'}</div>`;
        }
      }catch(e){ extra += `<div class="card" style="margin-top:8px"><h3>Riwayat Pemasangan/Pemakaian Perangkat</h3><div class="error">${esc(e.message||'Gagal memuat riwayat perangkat')}</div></div>`; }
    }
    let comments='';
    if(mod && mod.task){
      let cm=[]; try{ cm=(await pb.collection('komentar_tugas').getList(1,50,{filter:`modul_referensi = "${key}" && referensi_id = "${id}"`, sort:'dibuat_pada'})).items; }catch{}
      comments = `<div class="card"><h3>Komentar Tugas</h3><div>${cm.map(c=>`<div class="card"><div>${esc(c.isi)}</div>${c.foto?`<div style="margin-top:6px"><a href="${esc(pb.fileUrl(c,c.foto))}" target="_blank" rel="noopener"><img src="${esc(pb.fileUrl(c,c.foto))}" alt="foto" style="max-width:180px;border:1px solid var(--border);border-radius:8px"></a></div>`:''}<div class="muted">${esc(nameOf(state.cache.users,c.pengirim,c.pengirim))} · ${esc(witaDisplay(c.dibuat_pada))}</div></div>`).join('')||'<div class="muted">Belum ada komentar.</div>'}</div>
        <form id="commentForm" novalidate><label>Tambah komentar</label><textarea name="isi" placeholder="Tulis komentar..." required></textarea><label>Foto (opsional)</label><input type="file" name="foto" accept="image/jpeg,image/png,image/webp"><div style="margin-top:8px"><button class="btn btn-primary" type="submit">Kirim Komentar</button></div></form></div>`;
    }
    const photoFields = ['foto_rumah','foto_perangkat','foto_sebelum','foto_sesudah','foto'];
    const photos = photoFields.filter(f=>rec[f]).map(f=>`<div style="margin:6px 0"><div class="muted">${esc(f)}</div><a href="${esc(pb.fileUrl(rec, rec[f]))}" target="_blank" rel="noopener"><img src="${esc(pb.fileUrl(rec, rec[f]))}" alt="${esc(f)}" style="max-width:220px;border:1px solid var(--border);border-radius:8px"></a></div>`).join('');
    return `<div class="card"><div class="row" style="justify-content:space-between"><h2>Detail ${esc(mod?mod.label:key)}</h2><div><button class="btn" id="backBtn">Kembali</button> ${canArc?`<button class="btn" id="arcBtn">${rec.diarsipkan?'Pulihkan':'Arsipkan'}</button>`:''}</div></div>
      ${photos?`<div class="row" style="align-items:flex-start">${photos}</div>`:''}
      <pre style="white-space:pre-wrap">${esc(JSON.stringify(rec,null,2))}</pre>
      <h3>Ubah</h3>${(['pelanggan','inventaris_perangkat','inventaris_non_perangkat'].includes(key) && !isAdmin())?'<p class="muted">Perubahan data master akan dikirim sebagai usulan persetujuan admin (file foto tidak dikirim lewat usulan).</p>':''}<form id="editForm" novalidate>${editorForm(key,rec)}</form>${extra}</div>${comments}`;
  }

  function expandName(it, field, fallback){
    try{
      const ex = it && it.expand && it.expand[field];
      if(!ex) return null;
      if(Array.isArray(ex)) return ex.map(x=>x&&(x.nama||x.nama_barang||x.email||x.keluhan||x.id)).filter(Boolean).join(', ');
      return ex.nama || ex.nama_barang || ex.email || ex.keluhan || ex.id || null;
    }catch(e){ return null; }
  }
  function cell(key,c,it){
    if(c==='stok' && key==='inventaris_non_perangkat'){ const low = it.stok_minimum!=null && Number(it.stok)<=Number(it.stok_minimum); return `${esc(it.stok)} ${low?'<span class="badge low">menipis</span>':''}`; }
    let v=it[c]; if(v==null||v==='') return '<span class="muted">-</span>';
    if(typeof v === 'boolean' || c==='aktif' || c==='diarsipkan') return (v===true||v==='true')?'Ya':'Tidak';
    if(['pelanggan'].includes(c)) return esc(expandName(it,c) || nameOf(state.cache.pelanggan,v,v));
    if(['teknisi','ditugaskan_ke','pemohon','peninjau','aktor','dicatat_oleh','pengirim','penerima'].includes(c)) return esc(expandName(it,c) || nameOf(state.cache.users,v,v));
    if(c==='barang') return esc(expandName(it,c) || nameOf(state.cache.barang,v,v));
    if(c.includes('tanggal')||c==='waktu'||c==='jam_masuk'||c==='dibaca_pada'||c==='dibuat_pada'||c==='diubah_pada'||c==='diarsipkan_pada'||c==='diputuskan') return esc(witaDisplay(v));
    if(typeof v === 'object') return esc(JSON.stringify(v));
    return esc(String(v).slice(0,80));
  }
  function canCreate(key){ if(key==='riwayat') return false; if(key==='pengaturan'||key==='pengumuman') return isAdmin(); return true; }

  function select(name,label,items,valFn,labelFn,selected){ return `<label>${esc(label)}</label><select name="${esc(name)}"><option value="">-</option>${items.map(i=>`<option value="${esc(valFn(i))}" ${String(selected||'')===String(valFn(i))?'selected':''}>${esc(labelFn(i))}</option>`).join('')}</select>`; }
  function multiSelect(name,label,items,valFn,labelFn,selected,searchable){
    const sel = Array.isArray(selected)? selected.map(String) : (selected?[String(selected)]:[]);
    const search = searchable ? `<input type="text" class="ms-search" placeholder="Cari nama, tipe, atau SN..." autocomplete="off" style="margin:4px 0 6px">` : '';
    const hint = searchable ? `<div class="muted" style="font-size:.8rem;margin-top:4px">Ketik untuk mencari perangkat (mis. SN). Pilihan yang sudah dipilih tetap tersimpan.</div>` : '';
    return `<div class="multi-select-wrap" ${searchable?'data-searchable="1"':''}><label>${esc(label)} (bisa pilih lebih dari satu)</label>${search}<select name="${esc(name)}" multiple size="6">${items.map(i=>{ const v=String(valFn(i)); return `<option value="${esc(v)}" ${sel.includes(v)?'selected':''}>${esc(labelFn(i))}</option>`; }).join('')}</select>${hint}</div>`;
  }
  function fileInput(name,label){ return `<label>${esc(label)} (JPG/PNG/WebP, maks 2MB)</label><input name="${esc(name)}" type="file" accept="image/jpeg,image/png,image/webp">`; }
  function editorForm(key,rec={}){
    const inp=(n,l,t='text',vals=null,ro=false,suggest=null)=>{
      const raw=rec[n];
      const v=raw==null?'':(typeof raw==='object'?JSON.stringify(raw,null,2):raw);
      if(vals) return `<label>${esc(l)}</label><select name="${esc(n)}" ${ro?'disabled':''}>${vals.map(o=>`<option value="${esc(o)}" ${String(v)===o?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
      if(t==='textarea') return `<label>${esc(l)}</label><textarea name="${esc(n)}" ${ro?'readonly':''}>${esc(v)}</textarea>`;
      const listId = suggest && suggest.length ? `dl-${esc(n)}-${Math.random().toString(36).slice(2,7)}` : '';
      const listAttr = listId ? ` list="${listId}"` : '';
      const datalist = listId ? `<datalist id="${listId}">${suggest.map(s=>`<option value="${esc(s)}"></option>`).join('')}</datalist>` : '';
      return `<label>${esc(l)}</label><input name="${esc(n)}" type="${esc(t)}" value="${esc(String(v))}"${listAttr} ${ro?'readonly':''}>${datalist}`;
    };
    const users=state.cache.users||[]; const pels=state.cache.pelanggan||[]; const barang=state.cache.barang||[]; const gang=(state.cache.gangguan||[]);
    const perangkat=state.cache.perangkat||[];
    const jenisMutasi = isAdmin() ? ['Pengadaan','Pemakaian','Penyesuaian'] : ['Pengadaan','Pemakaian'];
    const deviceLabel = p=>`${p.nama||'-'} ${p.tipe?('('+p.tipe+')'):''} [${p.kondisi||'-'}${p.lokasi_pemegang?' @ '+p.lokasi_pemegang:''}] ${p.sn_serial?('SN:'+p.sn_serial):''}`.trim();
    const uniq = (arr, field)=>[...new Set(arr.map(x=>String(x[field]||'').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
    const namaSuggestions = uniq(perangkat,'nama');
    const tipeSuggestions = uniq(perangkat,'tipe');
    const barangNamaSuggestions = uniq(barang,'nama_barang');
    const barangPilihOptions = (state.cache.barang||[]).filter(b=>!b.diarsipkan).slice().sort((a,b)=>String(a.nama_barang||'').localeCompare(String(b.nama_barang||''),'id'));
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
      const note = locked ? '<div class="muted" style="margin:4px 0">Material sudah tercatat otomatis saat status Selesai (tidak dapat diubah).</div>' : '<div class="muted" style="margin:4px 0">Pilih material dan jumlah. Pemakaian stok dicatat otomatis saat tugas disimpan dengan status Selesai, sekali saja. Tugas yang selesai tanpa material masih bisa ditambahi material kemudian.</div>';
      const rows = items.map((it,i)=>materialRow(i,it,locked)).join('');
      return `<div class="card" style="margin-top:8px;padding:12px" id="materialBox"><label>Material Non-Perangkat (pemakaian)</label>${note}<div id="materialRows">${rows||(!locked?materialRow(0,{},false):'')}</div>${locked?'':`<div style="margin-top:6px"><button type="button" class="btn" id="addMaterialRow">+ Tambah Material</button></div>`}<input type="hidden" name="material_pemakaian" id="materialPemakaian" value="${esc(JSON.stringify(items||[]))}"></div>`;
    };
    const pelangganField = (selected, withQuickAdd=false)=>{
      const sel = select('pelanggan','Pelanggan',pels,p=>p.id,p=>p.nama,selected);
      if(!withQuickAdd) return sel;
      return `<div class="pelanggan-picker" data-quick-pelanggan="1">${sel}
        <div style="margin-top:6px"><button type="button" class="btn btn-ghost" data-action="toggle-quick-pelanggan" style="height:32px;padding:0 10px;font-size:12px">+ Tambah Pelanggan Baru</button></div>
        <div class="quick-pelanggan card" style="display:none;margin-top:8px;padding:12px;box-shadow:none;background:var(--bg-surface-alt)">
          <div class="muted" style="margin-bottom:8px;font-size:.85rem">Belum ada di daftar? Tambah pelanggan baru di sini, lalu otomatis dipilih.</div>
          <label>Nama Pelanggan</label><input type="text" data-qpel="nama" placeholder="Nama pelanggan">
          <label>Nomor HP/WA</label><input type="text" data-qpel="nowa" placeholder="Contoh: 0812...">
          <div class="quick-pel-msg field-error" style="display:none;margin-top:8px"></div>
          <div class="row" style="margin-top:10px"><button type="button" class="btn btn-primary" data-action="save-quick-pelanggan">Simpan & Pilih</button><button type="button" class="btn btn-ghost" data-action="cancel-quick-pelanggan">Batal</button></div>
        </div>
      </div>`;
    };
    const map={
      pelanggan:[inp('nama','Nama'),inp('nowa','Nomor HP/WA','tel'),inp('sn_perangkat','SN'),inp('koneksi','Koneksi'),inp('vlan','VLAN'),select('teknisi','Teknisi (opsional)',users,u=>u.id,u=>u.nama||u.email,rec.teknisi),inp('link_maps','Link Maps'),inp('keterangan_lokasi','Keterangan Lokasi','textarea'),fileInput('foto_rumah','Foto Rumah')],
      layanan_gangguan:[pelangganField(rec.pelanggan,true),inp('keluhan','Keluhan','textarea'),inp('status','Status','select',['Baru','Diproses','Selesai']), isAdmin()?select('ditugaskan_ke','Ditugaskan ke (admin)',users,u=>u.id,u=>u.nama||u.email,rec.ditugaskan_ke):`<label>Ditugaskan ke</label><input type="text" value="${esc(nameOf(users, rec.ditugaskan_ke, rec.ditugaskan_ke||'-'))}" disabled><input type="hidden" name="ditugaskan_ke" value="${esc(rec.ditugaskan_ke||'')}">`],
      perbaikan:[select('gangguan','Gangguan (opsional)',gang,g=>g.id,g=>g.keluhan?.slice(0,40)||g.id,rec.gangguan),pelangganField(rec.pelanggan,true),inp('tanggal','Tanggal','date'), isAdmin()?select('teknisi','Teknisi',users,u=>u.id,u=>u.nama||u.email,rec.teknisi):`<label>Teknisi</label><input type="text" value="${esc(nameOf(users, rec.teknisi, rec.teknisi||'-'))}" disabled><input type="hidden" name="teknisi" value="${esc(rec.teknisi||'')}">`, inp('tindakan','Tindakan','textarea'),inp('status','Status','select',['Belum ditindak','Diproses','Selesai']),multiSelect('perangkat','Perangkat terkait',perangkat.filter(p=>!p.diarsipkan && p.kondisi!=='Nonaktif'),p=>p.id,deviceLabel, rec.perangkat,true),materialEditor(rec),fileInput('foto_sebelum','Foto Sebelum'),fileInput('foto_sesudah','Foto Sesudah')],
      pemasangan:[
        (isAdmin() || !(rec && rec.id))
          ? pelangganField(rec.pelanggan,true)
          : `<label>Pelanggan</label><input type="text" value="${esc(expandName(rec,'pelanggan') || nameOf(pels, rec.pelanggan, rec.pelanggan||'-'))}" disabled><input type="hidden" name="pelanggan" value="${esc(rec.pelanggan||'')}"><div class="muted" style="font-size:.82rem;margin-top:4px">Pelanggan ditentukan oleh admin. Jika perlu diubah, ajukan usulan perubahan di bawah.</div>`,
        inp('tanggal','Tanggal','date'),
        inp('status','Status','select',['Menunggu','Dikerjakan','Selesai']),
        isAdmin()?select('ditugaskan_ke','Ditugaskan ke (admin)',users,u=>u.id,u=>u.nama||u.email,rec.ditugaskan_ke):`<label>Ditugaskan ke</label><input type="text" value="${esc(nameOf(users, rec.ditugaskan_ke, rec.ditugaskan_ke||'-'))}" disabled><input type="hidden" name="ditugaskan_ke" value="${esc(rec.ditugaskan_ke||'')}">`,
        multiSelect('perangkat','Perangkat dipasang/terkait',perangkat.filter(p=>!p.diarsipkan && p.kondisi!=='Nonaktif' && p.kondisi!=='Rusak'),p=>p.id,deviceLabel, rec.perangkat,true),
        materialEditor(rec)
      ],
      absen_hadir:[select('teknisi','Teknisi',users,u=>u.id,u=>u.nama||u.email,rec.teknisi||me().id),inp('tanggal','Tanggal','date'),inp('jam_masuk','Jam Masuk'),inp('keterangan','Keterangan','select',['Hadir','Izin','Sakit']),inp('alasan','Alasan','textarea'),inp('metode','Metode','select',['Admin','Mandiri','QR','Tugas'])],
      inventaris_perangkat:[inp('nama','Nama','text',null,false,namaSuggestions),inp('tipe','Tipe','text',null,false,tipeSuggestions),inp('sn_serial','SN/Serial'),inp('kondisi','Kondisi','select',['Baik','Terpasang','Rusak','Nonaktif','Cabutan']),inp('lokasi_pemegang','Lokasi/Pemegang'),inp('keterangan','Keterangan','textarea'),fileInput('foto_perangkat','Foto Perangkat')],
      inventaris_non_perangkat:(()=>{
        const curNama = String(rec.nama_barang||'').trim();
        const matched = barangPilihOptions.find(b=>String(b.nama_barang||'').trim().toLowerCase()===curNama.toLowerCase());
        const pickVal = matched ? String(matched.nama_barang||'') : (curNama ? '__new__' : '');
        const showInput = pickVal==='__new__' || pickVal==='';
        const opts = [`<option value="">-- Pilih barang yang sudah ada --</option>`]
          .concat(barangPilihOptions.map(b=>`<option value="${esc(String(b.nama_barang||''))}" ${pickVal===String(b.nama_barang||'')?'selected':''}>${esc(String(b.nama_barang||'-') + (b.satuan?(' ('+b.satuan+')'):'') )}</option>`))
          .concat([`<option value="__new__" ${pickVal==='__new__'?'selected':''}>+ Barang baru (ketik nama)...</option>`])
          .join('');
        const dropdown = `<label for="namaBarangSelect">Pilih Barang</label><select id="namaBarangSelect" name="nama_barang_pilih">${opts}</select><div class="muted" style="font-size:.82rem;margin:4px 0 0">Pilih dari daftar untuk mengisi cepat, atau pilih "Barang baru" untuk mengetik nama baru.</div>`;
        const nameInput = `<div id="namaBarangInputWrap" style="${showInput?'':'display:none'}"><label>Nama Barang</label><input name="nama_barang" type="text" value="${esc(curNama)}" placeholder="Ketik nama barang"></div>`;
        const nameHiddenHint = (!showInput) ? `<input type="hidden" id="namaBarangReadonlyHelper" value="1">` : '';
        return [dropdown, nameInput + nameHiddenHint, inp('satuan','Satuan'), inp('stok','Stok (otomatis, lewat mutasi)','number',null,true), inp('stok_minimum','Stok Minimum','number'), inp('keterangan','Keterangan','textarea')];
      })(),
      mutasi_inventaris:[select('barang','Barang',barang,b=>b.id,b=>`${b.nama_barang} (${b.satuan})`,rec.barang),inp('jenis','Jenis','select',jenisMutasi),inp('jumlah','Jumlah / selisih (Penyesuaian = selisih, bukan stok akhir)','number'),inp('tanggal','Tanggal','date'),inp('arah_penyesuaian','Arah Penyesuaian (Tambah/Kurang selisih)','select',['','Tambah','Kurang']),inp('referensi_modul','Ref Modul','select',['-','Perbaikan','Pemasangan']),inp('referensi_id','Ref ID'),inp('keterangan','Keterangan','textarea')],
      usulan_perubahan:[inp('modul','Modul (koleksi)'),inp('record_id','Record ID'),inp('nilai_usulan','Nilai Usulan (JSON)','textarea'),inp('status','Status','select',['Menunggu','Disetujui','Ditolak','Ditarik']),inp('alasan_tolak','Alasan Tolak','textarea')],
      users:[inp('nama','Nama'),inp('email','Email','email'),inp('telepon','Telepon'),inp('role','Role','select',['admin','teknisi']),`<label>Aktif</label><select name="aktif"><option value="true" ${String(rec.aktif)!=='false'?'selected':''}>true</option><option value="false" ${String(rec.aktif)==='false'?'selected':''}>false</option></select>`, (rec && rec.id ? `<label>Password baru (kosongkan jika tidak diubah, min 8)</label><input name="password" type="password" minlength="8" autocomplete="new-password"><label>Konfirmasi Password</label><input name="passwordConfirm" type="password" minlength="8" autocomplete="new-password">` : `<label>Password (min 8)</label><input name="password" type="password" minlength="8" autocomplete="new-password" required><label>Konfirmasi Password</label><input name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required>`)],
            pengaturan:[inp('kunci','Kunci'),inp('nilai','Nilai (JSON/teks)','textarea')],
    };
    let note='';
    if(key==='mutasi_inventaris') note='<p class="muted">Stok sebelum/sesudah dihitung otomatis. Untuk Penyesuaian, isi <b>selisih</b>: sistem 10 dan hasil hitung 8 berarti Kurang 2, bukan 8.</p>';
    if(key==='inventaris_non_perangkat') note='<p class="muted">Stok awal 0. Stok hanya bertambah lewat Mutasi Inventaris jenis Pengadaan.</p>';
    if(key==='pemasangan' || key==='perbaikan') note='<p class="muted">Saat status Selesai, perangkat terpilih otomatis menjadi Terpasang di lokasi pelanggan. Perangkat yang sudah terpasang di pelanggan lain akan ditolak.</p>';
    if(key==='pengaturan') note='<p class="muted">Isi <b>Nilai</b> dalam format JSON. Contoh: angka <code>30</code>, teks <code>"23:59"</code>. Perubahan kunci sistem dapat memengaruhi perilaku aplikasi.</p>';
    return note+(map[key]||[]).join('')+`<div class="form-actions" style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-primary" type="submit">Simpan</button></div>`;
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
  function initBarangNameHelper(form, key){
    if(!form || key!=='inventaris_non_perangkat') return;
    const nama = fieldEl(form,'nama_barang');
    const satuan = fieldEl(form,'satuan');
    const pilih = form.querySelector('#namaBarangSelect');
    const wrap = form.querySelector('#namaBarangInputWrap');
    if(!nama || nama.__barangHelper) return;
    nama.__barangHelper = true;

    const findMatch = (val)=>{
      const v = String(val||'').trim().toLowerCase();
      if(!v) return null;
      return (state.cache.barang||[]).find(b=>String(b.nama_barang||'').trim().toLowerCase()===v);
    };
    const fillSatuan = (match, force=false)=>{
      if(!match || !satuan) return;
      if(force || !String(satuan.value||'').trim()) satuan.value = match.satuan || '';
    };
    const syncFromSelect = ()=>{
      if(!pilih) return;
      const v = String(pilih.value||'');
      if(v === '__new__'){
        if(wrap) wrap.style.display='';
        nama.readOnly = false;
        if(!String(nama.value||'').trim() || findMatch(nama.value)) nama.value = '';
        try{ nama.focus(); }catch(e){}
        return;
      }
      if(v){
        nama.value = v;
        if(wrap) wrap.style.display='none';
        nama.readOnly = true;
        clearFieldError(nama);
        fillSatuan(findMatch(v), false);
        return;
      }
      // empty selection
      if(wrap) wrap.style.display='';
      nama.readOnly = false;
      if(!String(nama.value||'').trim()) { /* keep */ }
    };

    if(pilih){
      pilih.addEventListener('change', syncFromSelect);
      // initialize state based on current selection/value
      syncFromSelect();
    }

    nama.addEventListener('change', ()=>{ const m=findMatch(nama.value); if(m) fillSatuan(m,false); });
    nama.addEventListener('blur', ()=>{ const m=findMatch(nama.value); if(m) fillSatuan(m,false); });
  }

  function initQuickPelanggan(form){
    if(!form) return;
    const pickers = form.querySelectorAll('[data-quick-pelanggan="1"]');
    pickers.forEach(picker=>{
      if(picker.__quickPelangganInit) return;
      picker.__quickPelangganInit = true;
      const box = picker.querySelector('.quick-pelanggan');
      const toggleBtn = picker.querySelector('[data-action="toggle-quick-pelanggan"]');
      const saveBtn = picker.querySelector('[data-action="save-quick-pelanggan"]');
      const cancelBtn = picker.querySelector('[data-action="cancel-quick-pelanggan"]');
      const namaEl = picker.querySelector('[data-qpel="nama"]');
      const nowaEl = picker.querySelector('[data-qpel="nowa"]');
      const msgEl = picker.querySelector('.quick-pel-msg');
      const selectEl = picker.querySelector('select[name="pelanggan"]');
      const showMsg = (msg)=>{ if(!msgEl) return; msgEl.textContent=msg||''; msgEl.style.display = msg ? 'block' : 'none'; };
      const toggle = (show)=>{
        if(!box) return;
        box.style.display = show ? 'block' : 'none';
        showMsg('');
        if(show && namaEl) try{ namaEl.focus(); }catch(e){}
      };
      toggleBtn && (toggleBtn.onclick=()=>toggle(box && box.style.display==='none'));
      cancelBtn && (cancelBtn.onclick=()=>{ if(namaEl) namaEl.value=''; if(nowaEl) nowaEl.value=''; toggle(false); });
      saveBtn && (saveBtn.onclick=async()=>{
        const nama = String(namaEl?namaEl.value:'').trim();
        const nowa = String(nowaEl?nowaEl.value:'').trim();
        if(!nama){ showMsg('Nama pelanggan belum diisi.'); if(namaEl) namaEl.focus(); return; }
        if(!nowa){ showMsg('Nomor HP/WA pelanggan belum diisi.'); if(nowaEl) nowaEl.focus(); return; }
        const orig = saveBtn.textContent;
        saveBtn.disabled = true; saveBtn.textContent = 'Menyimpan...';
        try{
          const created = await pb.collection('pelanggan').create({ nama, nowa });
          state.cache.pelanggan = state.cache.pelanggan || [];
          state.cache.pelanggan.push(created);
          if(selectEl){
            const opt = document.createElement('option');
            opt.value = created.id;
            opt.textContent = created.nama || created.id;
            selectEl.appendChild(opt);
            selectEl.value = created.id;
            clearFieldError(selectEl);
          }
          if(namaEl) namaEl.value=''; if(nowaEl) nowaEl.value='';
          toggle(false);
          toast('Pelanggan baru ditambahkan dan dipilih');
        }catch(e){
          const list = serverFieldErrors(e);
          if(list.length) showMsg(list.map(x=>x.msg).join('; '));
          else showMsg((e && e.message) || 'Gagal menambah pelanggan.');
        }finally{
          saveBtn.disabled = false; saveBtn.textContent = orig;
        }
      });
    });
  }

  function initTaskDateHelpers(form, key){
    if(!form) return;
    if(key === 'pemasangan' || key === 'perbaikan'){
      const statusEl = fieldEl(form,'status');
      const tanggalEl = fieldEl(form,'tanggal');
      if(!statusEl || !tanggalEl || statusEl.__autoTanggal) return;
      statusEl.__autoTanggal = true;
      const todayWita = ()=> new Date(Date.now() + 8*3600*1000).toISOString().slice(0,10);
      const apply = ()=>{ if(String(statusEl.value)==='Selesai') tanggalEl.value = todayWita(); };
      statusEl.addEventListener('change', apply);
      // if form already shows Selesai (e.g. user opened to finish), ensure date is today on next save intent
    }
  }

  function initSearchableMultiSelect(form){
    if(!form) return;
    form.querySelectorAll('.multi-select-wrap[data-searchable="1"]').forEach(wrap=>{
      if(wrap.__msInit) return;
      wrap.__msInit = true;
      const input = wrap.querySelector('.ms-search');
      const select = wrap.querySelector('select[multiple]');
      if(!input || !select) return;
      const filter = ()=>{
        const q = String(input.value||'').toLowerCase().trim();
        Array.from(select.options).forEach(opt=>{
          const text = String(opt.textContent||'').toLowerCase();
          const match = !q || text.includes(q);
          opt.hidden = !match && !opt.selected;
        });
      };
      input.addEventListener('input', filter);
      filter();
    });
  }

  async function bindActions(){
    const doSearch=()=>{ if(!$('#searchBox')) return; state.search=$('#searchBox').value.trim();state.page=1;render(); };
    $('#btnSearch')&&($('#btnSearch').onclick=doSearch);
    $('#searchBox')&&($('#searchBox').onkeydown=(e)=>{ if(e.key==='Enter'){ e.preventDefault(); doSearch(); } });
    $('#prevPage')&&($('#prevPage').onclick=()=>{state.page=Math.max(1,(state.page||1)-1);render();});
    $('#nextPage')&&($('#nextPage').onclick=()=>{state.page=(state.page||1)+1;render();});
    $('#aktifOnly')&&($('#aktifOnly').onchange=(e)=>{state.filterAktif=e.target.checked;state.page=1;render();});
    $('#rekapSort')&&($('#rekapSort').onchange=(e)=>{state.rekapSort=e.target.value;render();});
    $$('[data-open]').forEach(b=>b.onclick=()=>{const [k,id]=b.dataset.open.split(':'); state.detail=id; state.view=k; render();});
    $$('[data-new]').forEach(b=>b.onclick=()=>openNew(b.dataset.new));
    $('#backBtn')&&($('#backBtn').onclick=()=>{state.detail=null; render();});
    $('#arcBtn')&&($('#arcBtn').onclick=async()=>{ try{ const k=state.view,id=state.detail; const rec=await pb.collection(k).getOne(id); const to=!rec.diarsipkan; if(!confirm(to?'Arsipkan/nonaktifkan data ini?':'Pulihkan data ini?')) return; await pb.collection(k).update(id,{diarsipkan:to, diarsipkan_pada: to? new Date().toISOString():null, diarsipkan_oleh: to? me().id:null}); toast(to?'Data dinonaktifkan':'Data dipulihkan'); render(); }catch(e){toast(errorText(e),{type:'error'});} });
    initMaterialEditor();
    initBarangNameHelper($('#editForm')||$('#newForm'), state.view);
    initQuickPelanggan($('#editForm')||$('#newForm'));
    initTaskDateHelpers($('#editForm')||$('#newForm'), state.view);
    initSearchableMultiSelect($('#editForm')||$('#newForm'));
    const editForm=$('#editForm');
    if(editForm) attachValidation(editForm,state.view,false);
    editForm&&(editForm.onsubmit=async(ev)=>{
      ev.preventDefault();
      const form=ev.target;
      const key=state.view, id=state.detail;
      if(!validateAndShow(form,key,false)) return;
      const submitBtn=form.querySelector('button[type="submit"]');
      await withSubmitState(form,submitBtn,async()=>{
        try{
          const fd = new FormData(form);
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
            state.detail=null; state.cache={}; render();
            return;
          }
          await pb.collection(key).update(id, body);
          toast('Perubahan berhasil disimpan'); state.cache={}; state.detail=null; render();
        }catch(e){ handleSubmitError(e,form); }
      });
    });
    const commentForm=$('#commentForm');
    if(commentForm) attachValidation(commentForm,'komentar_tugas',true);
    commentForm&&(commentForm.onsubmit=async(ev)=>{ ev.preventDefault(); const form=ev.target; if(!validateAndShow(form,'komentar_tugas',true)) return; const submitBtn=form.querySelector('button[type="submit"]'); await withSubmitState(form,submitBtn,async()=>{ try{ const fd=new FormData(form); fd.set('modul_referensi',state.view); fd.set('referensi_id',state.detail); fd.set('pengirim',me().id); await pb.collection('komentar_tugas').create(fd); toast('Komentar terkirim'); render(); }catch(e){handleSubmitError(e,form);} }); });
    const annForm=$('#annForm');
    if(annForm) attachValidation(annForm,'pengumuman',true);
    annForm&&(annForm.onsubmit=async(ev)=>{ ev.preventDefault(); const form=ev.target; if(!validateAndShow(form,'pengumuman',true)) return; const submitBtn=form.querySelector('button[type="submit"]'); await withSubmitState(form,submitBtn,async()=>{ try{ const fd=new FormData(form); fd.set('pembuat',me().id); fd.set('diarsipkan','false'); await pb.collection('pengumuman').create(fd); toast('Pengumuman berhasil dibuat'); render(); }catch(e){handleSubmitError(e,form);} }); });
    $$('[data-ann-arc]').forEach(b=>b.onclick=async()=>{ const [id,ar]=b.dataset.annArc.split(':'); try{ await pb.collection('pengumuman').update(id,{diarsipkan: ar!=='1'}); toast('Diperbarui'); render(); }catch(e){toast(errorText(e),{type:'error'});} });
    const msgForm=$('#msgForm');
    if(msgForm) attachValidation(msgForm,'pesan_langsung',true);
    msgForm&&(msgForm.onsubmit=async(ev)=>{ ev.preventDefault(); const form=ev.target; if(!validateAndShow(form,'pesan_langsung',true)) return; const submitBtn=form.querySelector('button[type="submit"]'); await withSubmitState(form,submitBtn,async()=>{ try{ const fd=new FormData(form); fd.set('pengirim',me().id); const ids=[me().id,fd.get('penerima')].filter(Boolean).sort(); fd.set('percakapan',ids.join('__')); await pb.collection('pesan_langsung').create(fd); toast('Pesan terkirim'); render(); }catch(e){handleSubmitError(e,form);} }); });
    const izinForm=$('#izinForm');
    if(izinForm) attachValidation(izinForm,'absen_izin',true);
    izinForm&&(izinForm.onsubmit=async(ev)=>{ ev.preventDefault(); const form=ev.target; if(!validateAndShow(form,'absen_izin',true)) return; const submitBtn=form.querySelector('button[type="submit"]'); await withSubmitState(form,submitBtn,async()=>{ try{ const fd=new FormData(form); await pb.collection('absen_hadir').create({teknisi:me().id, tanggal:new Date().toISOString().slice(0,10), keterangan:fd.get('keterangan'), alasan:fd.get('alasan'), metode:'Mandiri', dicatat_oleh:me().id, jam_masuk:new Date().toISOString()}); toast('Izin/Sakit berhasil dicatat'); }catch(e){handleSubmitError(e,form);} }); });
    $('#genQr')&&($('#genQr').onclick=loadQr); $('#refreshToday')&&($('#refreshToday').onclick=loadTodayAbs); $('#scanQrBtn')&&($('#scanQrBtn').onclick=scanQr); if($('#todayAbs')) loadTodayAbs();
    $('#enableBrowserNotif')&&($('#enableBrowserNotif').onclick=async()=>{ const ok=await ensureNotifyPermission(); toast(ok?'Notifikasi browser aktif':'Izin notifikasi ditolak/tidak tersedia'); });
    $('#syncSheetsNow')&&($('#syncSheetsNow').onclick=async()=>{
      const btn=$('#syncSheetsNow'); const msg=$('#syncSheetsMsg');
      if(msg){ msg.textContent='Menyinkronkan...'; msg.className='muted'; }
      const orig=btn?btn.textContent:'Sinkronkan Sekarang';
      if(btn){ btn.disabled=true; btn.textContent='Menyinkronkan...'; }
      try{
        const r=await pb.request('/api/sheets/sync',{method:'POST'});
        const info = (r && r.message) ? r.message : (r && r.skipped ? 'Tidak ada data baru untuk dikirim.' : `Sinkron berhasil (${(r&&r.modules)||0} modul).`);
        toast(info);
        if(msg){ msg.textContent=info; msg.className='ok'; }
        setTimeout(()=>{ try{ render(); }catch(e){} }, 400);
      }catch(e){
        const errMsg = (e && e.data && (e.data.message||e.data.detail)) || errorText(e) || 'Gagal sinkron ke Google Sheets.';
        toast(errMsg,{type:'error'});
        if(msg){ msg.textContent=errMsg; msg.className='error'; }
      }finally{
        if(btn){ btn.disabled=false; btn.textContent=orig; }
      }
    });
    $('#uApprove')&&($('#uApprove').onclick=async()=>{ try{ await pb.request(`/api/usulan/${state.detail}/decide`,{method:'POST',body:{action:'setujui'}}); toast('Usulan disetujui'); render(); }catch(e){toast(errorText(e),{type:'error'});} });
    $('#uApproveEdit')&&($('#uApproveEdit').onclick=async()=>{ const field=$('#uNilai'); try{ let nilai={}; try{ nilai=JSON.parse(field.value||'{}'); }catch(_){ showFieldError(field,'Nilai usulan harus berupa JSON yang valid.'); focusField(field); toast('Nilai usulan bukan JSON yang valid',{type:'error'}); return; } clearFieldError(field); await pb.request(`/api/usulan/${state.detail}/decide`,{method:'POST',body:{action:'ubah_setujui', nilai_usulan:nilai}}); toast('Usulan diubah & disetujui'); render(); }catch(e){toast(errorText(e),{type:'error'});} });
    $('#uReject')&&($('#uReject').onclick=async()=>{ const alasan=prompt('Alasan tolak:')||''; try{ await pb.request(`/api/usulan/${state.detail}/decide`,{method:'POST',body:{action:'tolak', alasan_tolak:alasan}}); toast('Usulan ditolak'); render(); }catch(e){toast(errorText(e),{type:'error'});} });
    $('#uWithdraw')&&($('#uWithdraw').onclick=async()=>{ try{ await pb.request(`/api/usulan/${state.detail}/withdraw`,{method:'POST'}); toast('Usulan ditarik'); render(); }catch(e){toast(errorText(e),{type:'error'});} });
    $('#kirimUsulPelanggan')&&($('#kirimUsulPelanggan').onclick=async()=>{
      const sel=$('#usulPelanggan'); const msg=$('#usulPelangganMsg');
      const val=sel?String(sel.value||''):'';
      if(msg) msg.textContent='';
      if(!val){ if(msg) msg.innerHTML='<span class="error">Pilih pelanggan yang diusulkan terlebih dahulu.</span>'; toast('Pilih pelanggan yang diusulkan',{type:'error'}); return; }
      try{
        const recNow=await pb.collection('pemasangan').getOne(state.detail);
        if(String(val)===String(recNow.pelanggan||'')){ if(msg) msg.innerHTML='<span class="error">Pelanggan yang dipilih sama dengan pelanggan saat ini.</span>'; return; }
        await pb.collection('usulan_perubahan').create({modul:'pemasangan', record_id: state.detail, nilai_usulan:{pelanggan: val}, status:'Menunggu', pemohon: me().id});
        toast('Usulan perubahan pelanggan dikirim, menunggu persetujuan admin');
        if(msg) msg.innerHTML='<span class="ok">Usulan perubahan pelanggan berhasil dikirim dan menunggu persetujuan admin.</span>';
      }catch(e){ if(msg) msg.innerHTML=`<span class="error">${esc(errorText(e))}</span>`; toast(errorText(e)||'Gagal mengirim usulan',{type:'error'}); }
    });
    $('#clearRiwayat')&&($('#clearRiwayat').onclick=async()=>{
      const sel=$('#clearRiwayatRange');
      const range=sel?sel.value:'all';
      const labelMap={ '1h':'1 jam terakhir', '24h':'24 jam terakhir', '7d':'7 hari terakhir', '4w':'4 minggu terakhir', '30d':'30 hari terakhir', 'all':'sepanjang waktu (semua riwayat)' };
      const label=labelMap[range]||range;
      if(!confirm(`Hapus riwayat untuk rentang ${label}? Tindakan ini tidak dapat dibatalkan.`)) return;
      try{
        const r=await pb.request('/api/riwayat/clear',{method:'POST',body:{range}});
        toast(`Riwayat dibersihkan (${(r&&r.deleted)||0} data dihapus, ${label})`);
        render();
      }catch(e){ toast(errorText(e)||'Gagal menghapus riwayat',{type:'error'}); }
    });
    const pengaturanForm=$('#pengaturanForm');
    if(pengaturanForm){
      pengaturanForm.onsubmit=async(ev)=>{
        ev.preventDefault();
        const form=ev.target;
        const submitBtn=form.querySelector('button[type="submit"]');
        const intervalQr=Math.round(Number($('#set_interval_qr').value));
        const jamTutup=String($('#set_jam_tutup').value||'').trim();
        const intervalSheets=Math.round(Number($('#set_interval_sheets').value));
        const retensi=Math.round(Number($('#set_retensi').value));
        const jamMulaiLembur=String($('#set_jam_mulai_lembur')?$('#set_jam_mulai_lembur').value:'17:00'||'17:00').trim();

        clearFormErrors(form);
        const errs=[];
        if(!(intervalQr>=5)) errs.push({el:$('#set_interval_qr'), msg:'Masa berlaku kode QR minimal 5 detik.'});
        if(!/^\d{2}:\d{2}$/.test(jamTutup)) errs.push({el:$('#set_jam_tutup'), msg:'Batas akhir absen harus berupa jam yang valid (contoh 23:59).'});
        if(!(intervalSheets>=1)) errs.push({el:$('#set_interval_sheets'), msg:'Interval sinkron minimal 1 menit.'});
        if(!(retensi>=0) || isNaN(retensi)) errs.push({el:$('#set_retensi'), msg:'Lama simpan riwayat harus 0 (nonaktif) atau lebih.'});
        if(!/^\d{2}:\d{2}$/.test(jamMulaiLembur)) errs.push({el:$('#set_jam_mulai_lembur'), msg:'Jam mulai lembur harus berupa jam yang valid (contoh 17:00).'});
        if(errs.length){
          errs.forEach(er=>showFieldError(er.el,er.msg));
          showFormAlert(form, errs.map(er=>er.msg));
          focusField(errs[0].el);
          toast('Belum bisa disimpan: '+errs[0].msg,{type:'error'});
          return;
        }

        await withSubmitState(form,submitBtn,async()=>{
          try{
            const map=await getPengaturanMap();
            const upsert=async(kunci,nilai)=>{
              const rec=map[kunci];
              if(rec && rec.id) await pb.collection('pengaturan').update(rec.id,{kunci,nilai});
              else await pb.collection('pengaturan').create({kunci,nilai});
            };
            await upsert('interval_qr', intervalQr);
            await upsert('jam_tutup_absen', jamTutup);
            await upsert('interval_sinkron_sheets', intervalSheets);
            await upsert('retensi_riwayat_hari', retensi);
            await upsert('jam_mulai_lembur', jamMulaiLembur);
            toast('Pengaturan berhasil disimpan');
            render();
          }catch(e){ handleSubmitError(e,form); }
        });
      };
    }
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
      }catch(e){ toast(errorText(e)||'Gagal mengosongkan',{type:'error'}); }
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
      }catch(e){ toast(errorText(e)||'Gagal memindahkan',{type:'error'}); }
    });
  }

  function prefillNewForm(key,form){
    if(!form) return;
    const today=new Date().toISOString().slice(0,10);
    const setVal=(name,val)=>{ const el=fieldEl(form,name); if(el && !el.value) el.value=val; };
    if(['pemasangan','perbaikan','mutasi_inventaris','absen_hadir'].includes(key)) setVal('tanggal',today);
  }
  async function openNew(key){
    state.detail=null; state.view=key; await render();
    const div=document.createElement('div'); div.className='card'; div.id='newRecordCard';
    div.innerHTML=`<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:8px"><h3 style="margin:0">Tambah ${esc(getMod(key)?.label||key)}</h3><span class="muted" style="font-size:.85rem">Tanda * wajib diisi</span></div><form id="newForm" novalidate>${editorForm(key,{})}</form>`;
    $('.container').prepend(div);
    const form=$('#newForm');
    const actions=form ? form.querySelector('.form-actions') : null;
    if(actions){
      const cancel=document.createElement('button'); cancel.type='button'; cancel.className='btn btn-ghost'; cancel.id='cancelNew'; cancel.textContent='Batal';
      actions.appendChild(cancel);
      cancel.onclick=()=>div.remove();
    }
    try{ div.scrollIntoView({behavior:'smooth',block:'start'}); }catch(e){}
    prefillNewForm(key,form);
    initMaterialEditor();
    initBarangNameHelper(form,key);
    initQuickPelanggan(form);
    initTaskDateHelpers(form,key);
    initSearchableMultiSelect(form);
    attachValidation(form,key,true);
    const submitBtn=form ? form.querySelector('button[type="submit"]') : null;
    form.onsubmit=async(ev)=>{ ev.preventDefault(); const f=ev.target; if(!validateAndShow(f,key,true)) return; await withSubmitState(f,submitBtn,async()=>{ try{ const fd=new FormData(f); await pb.collection(key).create(formBody(key,fd,true)); toast('Data berhasil ditambahkan'); state.cache={}; render(); }catch(e){handleSubmitError(e,f);} }); };
  }

  function errorText(e){
    const list=serverFieldErrors(e);
    if(list.length) return [...new Set(list.map(x=>x.msg))].join('; ');
    return (e && e.message) || (e && String(e)) || 'Gagal';
  }
  function formBody(key, fd, isNew=false){
    let hasFile=false; for(const [k,v] of fd.entries()){ if(v instanceof File && v.size>0){ hasFile=true; if(v.size>2*1024*1024) throw new Error('Ukuran foto maksimal 2MB'); } }
    const body = hasFile ? fd : {};
    const set=(k,v)=>{ if(hasFile) body.set(k,v); else body[k]=v; };
    const multiKeys = ['perangkat'];
    if(!hasFile){
      const seenMulti = new Set();
      for(const [k,v] of fd.entries()){
        if(k==='nama_barang_pilih') continue;
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
      if(fd.has('nama_barang_pilih')) body.delete('nama_barang_pilih');
      multiKeys.forEach(k=>{
        if(fd.has(k) || ['pemasangan','perbaikan'].includes(key)){
          const vals = fd.getAll(k).filter(x=>x!=='');
          body.delete(k);
          vals.forEach(v=>body.append(k, v));
        }
      });
      for(const [k,v] of Array.from(fd.entries())){
        if(k==='nama_barang_pilih') { body.delete(k); continue; }
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
    }catch(e){ toast(errorText(e),{type:'error'}); }
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
