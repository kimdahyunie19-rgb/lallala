// ── FIREBASE CONFIG ────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyC3ZeDtcgPTOfvHsSUq752mVBoKUNKTAmU",
  authDomain: "tlgp-wms-15338.firebaseapp.com",
  databaseURL: "https://tlgp-wms-15338-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tlgp-wms-15338",
  storageBucket: "tlgp-wms-15338.firebasestorage.app",
  messagingSenderId: "288366896814",
  appId: "1:288366896814:web:55aface3c600634f136f3f",
  measurementId: "G-F754X9HKWF"
};

firebase.initializeApp(firebaseConfig);
const rdb = firebase.database();

let db = [];
let logs = { pull: [], upd: [], del: [], inc: [] };
let undos = [];
let masterLocs = [];
const am = { "RESIN":"1","FILM":"2","MOLDED PARTS":"3","UN-STERILE":"4","PACKAGING":"5" };
const CHUNK = 100;
let renderToken = 0;
let reTimer;

const parseNum = v => v ? parseFloat(v.toString().replace(/,/g,''))||0 : 0;
const nowStr   = () => new Date().toLocaleString('en-GB');
const $        = id => document.getElementById(id);
const isPage   = id => !!$(id);

function ensureLogs(raw) {
    const r = raw || {};
    return {
        pull: Array.isArray(r.pull) ? r.pull : [],
        upd:  Array.isArray(r.upd)  ? r.upd  : [],
        del:  Array.isArray(r.del)  ? r.del  : [],
        inc:  Array.isArray(r.inc)  ? r.inc  : []
    };
}

// ── LOAD DATA ──────────────────────────────────
window.onload = () => {
    if (isPage('loc-list')) initPermLocs();

    rdb.ref('j_db').on('value', snap => {
        const raw = snap.val();
        db = Array.isArray(raw) ? raw
           : (raw && typeof raw==='object') ? Object.values(raw) : [];
        if (isPage('b-inv')) re();
    });

    rdb.ref('j_lg').on('value', snap => {
        logs = ensureLogs(snap.val());
        if (isPage('date-list')) renderTimeline();
    });
};

// ── LOGIN ──────────────────────────────────────
function checkLogin() {
    const email = $('log-email').value.trim();
    const pass  = $('log-pass').value;
    if (email==="admin" && pass==="admin") {
        $('login-overlay').style.display='none';
        sessionStorage.setItem('j_auth','true');
    } else {
        $('log-err').style.display='block';
        $('login-overlay').querySelector('.login-card').classList.add('shake');
        setTimeout(()=>$('login-overlay').querySelector('.login-card').classList.remove('shake'),500);
    }
}
if (sessionStorage.getItem('j_auth')==='true') {
    const ov=$('login-overlay'); if(ov) ov.style.display='none';
}

// ── INIT LOCATIONS ─────────────────────────────
function initPermLocs() {
    masterLocs=[];
    const pad = n => n.toString().padStart(2,'0');
    ['TRA','TRB','TRC','TRD','TRE','TRF','TRG','TRH','TRI','TRJ','TRK','TRL','TRM','TRN','TRO','TRP','TRQ'].forEach(z=>{
        for(let i=1;i<=70;i++) for(let l=1;l<=5;l++) masterLocs.push(`${z}${pad(i)}${pad(l)}`);
    });
    $('loc-list').innerHTML = masterLocs.map(l=>`<option value="${l}">`).join('');
}

// ── INVENTORY RENDER ────────────────────────────
function re() { clearTimeout(reTimer); reTimer=setTimeout(_re,50); }

function _re() {
    if(!isPage('b-inv')) return;
    const token = ++renderToken;
    const filters  = Array.from(document.querySelectorAll('.c-src')).map(i=>i.value.toLowerCase());
    const viewMode = $('f-view').value;
    const fifoOn   = $('fifo-check').checked;
    const active   = db.filter(x=>parseNum(x.qty)>0);
    const locSrc   = filters[0];
    const isEmpty  = viewMode==='empty';
    let rows=[];

    if(fifoOn || filters.some((f,i)=>f!==""&&i!==0) || viewMode==='occupied') {
        let data=[...active];
        if(fifoOn) data.sort((a,b)=>new Date(a.dat)-new Date(b.dat));
        data.forEach(x=>{
            if(isEmpty) return;
            const idx=db.indexOf(x);
            const rd=[x.loc,x.cod,x.lot,x.qty,x.sts,x.pal,x.dr,x.dat,x.typ,x.acc].map(val=>(val||"").toString().toLowerCase());
            if(filters.every((f,i)=>rd[i].includes(f))) rows.push(rowHTML(x,idx));
        });
    } else {
        let allLocs=[...new Set([...masterLocs,...db.map(x=>x.loc)])];
        allLocs.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
        allLocs.forEach(loc=>{
            if(!loc.toLowerCase().includes(locSrc)) return;
            const items=active.filter(x=>x.loc===loc);
            if(items.length>0){
                if(isEmpty) return;
                items.forEach(x=>rows.push(rowHTML(x,db.indexOf(x))));
            } else if(viewMode!=='occupied'){
                rows.push(emptyRowHTML(loc));
            }
        });
    }

    const tbody=$('b-inv');
    tbody.innerHTML='';
    upd_stats();

    let off=0;
    function chunk(){
        if(token!==renderToken) return;
        const slice=rows.slice(off,off+CHUNK);
        if(!slice.length) return;
        const tmp=document.createElement('tbody');
        tmp.innerHTML=slice.join('');
        while(tmp.firstChild) tbody.appendChild(tmp.firstChild);
        off+=CHUNK;
        if(off<rows.length) requestAnimationFrame(chunk);
    }
    requestAnimationFrame(chunk);
}

function rowHTML(x,idx){
    const qCls=x.isMod?'qty-modified':'qty-normal';
    return `<tr>
        <td class="loc-cell">${x.loc}</td>
        <td><b>${x.cod}</b></td><td>${x.lot}</td>
        <td class="${qCls}">${parseNum(x.qty).toLocaleString()}</td>
        <td><span class="bdg status-${(x.sts||'').replace(/\s/g,'')}">${x.sts}</span></td>
        <td>${x.pal||'-'}</td><td>${x.dr||'-'}</td><td>${x.dat||'-'}</td>
        <td>${x.typ||'-'}</td><td>${x.acc||'-'}</td>
        <td>
            <button class="btn btn-orange" onclick="goPullout(${idx})">📤 OUT</button>
            <button class="btn btn-grey" onclick="ed(${idx})">EDIT</button>
            <button class="btn btn-red"  onclick="dl(${idx})">DEL</button>
            <button class="btn btn-print" onclick="goStoringTag(${idx})">🏷 TAG</button>
        </td>
    </tr>`;
}

function emptyRowHTML(loc){
    return `<tr class="row-empty" data-loc="${loc}">
        <td class="loc-cell">${loc}</td>
        <td colspan="9">[ VACANT ]</td>
        <td><button class="btn btn-blue" onclick="fillLoc('${loc}')">+ STOCK</button></td>
    </tr>`;
}

// ── PULL-OUT MODAL ─────────────────────────────
let pulloutTarget = null; // { idx, item }
let pulloutSlipRows = []; // { loc, cod, lot, sts, qty, pal, dr, dat, typ, acc, pullQty }

function showPulloutModal(idx) {
    const item = db[idx]; if(!item) return;
    pulloutTarget = { idx, item };
    pulloutSlipRows = [];
    renderPulloutSlip();
    $('pullout-modal').style.display = 'flex';
    const po_qty = $('po-qty');
    if(po_qty) { po_qty.value = parseNum(item.qty); po_qty.focus(); po_qty.select(); }
}

function closePulloutModal() {
    $('pullout-modal').style.display = 'none';
    pulloutTarget = null;
    pulloutSlipRows = [];
}

function addToPulloutSlip() {
    if(!pulloutTarget) return;
    const item = pulloutTarget.item;
    const idx = pulloutTarget.idx;
    const qty = parseNum($('po-qty').value);
    const maxQ = parseNum(item.qty);
    const pos = $('po-pos').value.trim();
    const remarks = $('po-remarks').value.trim();

    if(qty <= 0 || qty > maxQ) { alert(`❌ Invalid quantity. Must be 1–${maxQ.toLocaleString()}`); return; }

    pulloutSlipRows.push({
        loc: item.loc, cod: item.cod, lot: item.lot, sts: item.sts,
        pullQty: qty, maxQty: maxQ, pal: pos || item.pal, remarks: remarks,
        dr: item.dr, dat: item.dat, typ: item.typ, acc: item.acc, idx
    });

    renderPulloutSlip();
}

function removeFromPulloutSlip(i) {
    pulloutSlipRows.splice(i, 1);
    renderPulloutSlip();
}

function renderPulloutSlip() {
    const body = $('po-slip-body'); if(!body) return;
    if(!pulloutSlipRows.length) {
        body.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#2a3a50;font-style:italic;padding:18px;">No items added yet.</td></tr>`;
        return;
    }
    body.innerHTML = pulloutSlipRows.map((r,i) => `
        <tr>
            <td>${i+1}</td>
            <td class="loc-cell">${r.loc}</td>
            <td><b>${r.cod}</b></td>
            <td>${r.lot}</td>
            <td><span class="bdg status-${(r.sts||'').replace(/\s/g,'')}">${r.sts}</span></td>
            <td class="qty-normal">${r.pullQty.toLocaleString()}</td>
            <td><button class="btn btn-red" onclick="removeFromPulloutSlip(${i})">✕</button></td>
        </tr>
    `).join('');
}

function commitPullout() {
    if(!pulloutSlipRows.length) { alert('❌ No items in pull-out slip.'); return; }
    const posCtrl = $('po-pos-ctrl').value.trim();
    if(!posCtrl) { alert('❌ Please enter a POS Control No.'); return; }

    // Validate quantities against current DB
    for(const r of pulloutSlipRows) {
        const current = db[r.idx];
        if(!current) { alert(`❌ Item at ${r.loc} no longer exists.`); return; }
        const maxQ = parseNum(current.qty);
        if(r.pullQty > maxQ) { alert(`❌ ${r.loc}: Quantity exceeds available (${maxQ.toLocaleString()})`); return; }
    }

    undos.push(JSON.stringify(db));
    logs = ensureLogs(logs);

    pulloutSlipRows.forEach(r => {
        const current = db[r.idx];
        if(!current) return;
        const maxQ = parseNum(current.qty);
        const rem = maxQ - r.pullQty;
        logs.pull.unshift({
            ...current, outQty: r.pullQty, pos: posCtrl, dr: posCtrl,
            ts: nowStr(), logType: 'PULL-OUT'
        });
        if(rem <= 0) { db[r.idx] = null; }
        else { db[r.idx].qty = rem; db[r.idx].isMod = true; }
    });

    // Remove nulls
    db = db.filter(x => x !== null);

    save();
    closePulloutModal();
    // Show success
    const toast = $('copy-toast');
    if(toast) {
        toast.textContent = `✅ Pull-out committed: ${pulloutSlipRows.length} item(s)`;
        toast.classList.add('show');
        setTimeout(()=>toast.classList.remove('show'), 2500);
    }
    pulloutSlipRows = [];
}

// ── HISTORY TIMELINE ────────────────────────────
let activeDate = null;
let activeDR = null;

function renderTimeline(){
    if(!isPage('date-list')) return;
    logs = ensureLogs(logs);

    const all=[
        ...logs.inc.map(l=>({...l,_type:'inc'})),
        ...logs.pull.map(l=>({...l,_type:'pull'})),
        ...logs.upd.map(l=>({...l,_type:'upd'}))
    ];

    // Group by date
    const grouped={};
    all.forEach(l=>{
        const dp=(l.ts||'').split(',')[0].trim()||'Unknown';
        if(!grouped[dp]) grouped[dp]=[];
        grouped[dp].push(l);
    });

    const sortedDates=Object.keys(grouped).sort((a,b)=>{
        const p=s=>{const[d,m,y]=s.split('/');return new Date(`${y}-${m}-${d}`);};
        return p(b)-p(a);
    });

    const countEl=$('log-count');
    if(countEl) countEl.textContent=`${all.length} records · ${sortedDates.length} days`;

    const dateList=$('date-list');
    const detail=$('log-detail');

    if(!sortedDates.length){
        dateList.innerHTML=`<div class="no-dates">No logs yet.</div>`;
        detail.innerHTML=`<div class="no-logs">No records found.</div>`;
        return;
    }

    if(!activeDate||!grouped[activeDate]) activeDate=sortedDates[0];

    dateList.innerHTML=sortedDates.map(date=>{
        const ent=grouped[date];
        const ic=ent.filter(x=>x._type==='inc').length;
        const oc=ent.filter(x=>x._type==='pull').length;
        const uc=ent.filter(x=>x._type==='upd').length;
        return `<div class="date-card${date===activeDate?' active':''}" onclick="selectDate('${date}')">
            <div class="date-label">${fmtDate(date)}</div>
            <div class="date-pills">
                ${ic?`<span class="dpill dpill-in">${ic} IN</span>`:''}
                ${oc?`<span class="dpill dpill-out">${oc} OUT</span>`:''}
                ${uc?`<span class="dpill dpill-upd">${uc} UPD</span>`:''}
            </div>
        </div>`;
    }).join('');

    renderDateDR(grouped[activeDate]||[]);
}

function fmtDate(s){
    try{
        const[d,m,y]=s.split('/');
        const dt=new Date(`${y}-${m}-${d}`);
        const today=new Date(),yest=new Date();yest.setDate(today.getDate()-1);
        const short=dt.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
        if(dt.toDateString()===today.toDateString()) return `<span class="tag-today">TODAY</span> ${short}`;
        if(dt.toDateString()===yest.toDateString()) return `<span class="tag-yest">YESTERDAY</span> ${short}`;
        return dt.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});
    }catch{return s;}
}

function selectDate(date){
    activeDate=date;
    activeDR=null;
    document.querySelectorAll('.date-card').forEach(c=>{
        c.classList.toggle('active', c.getAttribute('onclick')===`selectDate('${date}')`);
    });
    const all=[
        ...logs.inc.map(l=>({...l,_type:'inc'})),
        ...logs.pull.map(l=>({...l,_type:'pull'})),
        ...logs.upd.map(l=>({...l,_type:'upd'}))
    ];
    renderDateDR(all.filter(l=>(l.ts||'').split(',')[0].trim()===date));
    // _currentDateEntries is set inside renderDateDR
}

// ── key function — MUST match everywhere ──
function drKey(l) {
    return l.dr || l.pos || (l._type==='pull' ? '— No POS Control —' : '— No DR/Invoice —');
}

// Cache current date entries so selectDR can access without inline JSON
let _currentDateEntries = [];

// Show DR/Invoice groups for the selected date
function renderDateDR(entries) {
    const panel = $('log-detail'); if(!panel) return;
    _currentDateEntries = entries;

    const fType = ($('log-type-filter')?.value||'all');
    const filtered = entries.filter(l => fType==='all' || l._type===fType);

    // Group by DR/invoice using shared key
    const drGroups = {};
    filtered.forEach(l => {
        const key = drKey(l);
        if(!drGroups[key]) drGroups[key] = [];
        drGroups[key].push(l);
    });

    const sortedDRs = Object.keys(drGroups).sort();

    if(!sortedDRs.length) {
        panel.innerHTML = `<div class="no-logs">No records for this date.</div>`;
        return;
    }

    // If activeDR already set and valid, go straight to detail
    if(activeDR && drGroups[activeDR]) {
        renderDRDetail(drGroups[activeDR]);
        return;
    }

    // Render card list — store data on panel element to avoid onclick serialization issues
    panel._sortedDRs = sortedDRs;
    panel._drGroups  = drGroups;

    panel.innerHTML = `
        <div class="detail-header">
            <span class="detail-date">${activeDate||''}</span>
            <span class="detail-count">${filtered.length} record${filtered.length!==1?'s':''} · ${sortedDRs.length} group${sortedDRs.length!==1?'s':''}</span>
        </div>
        <div class="dr-list">
            ${sortedDRs.map((dr, idx) => {
                const items = drGroups[dr];
                const ic = items.filter(x=>x._type==='inc').length;
                const oc = items.filter(x=>x._type==='pull').length;
                const uc = items.filter(x=>x._type==='upd').length;
                const totalQty = items.reduce((s,l)=>s+parseNum(l.outQty||l.qty),0);
                const cardIcon = oc>0&&ic===0 ? '📤' : ic>0 ? '🚚' : '📄';
                const cardLbl  = oc>0&&ic===0 ? 'POS Control No.' : 'DR / Invoice';
                return `<div class="dr-card" onclick="selectDR(${idx})">
                    <div class="dr-card-left">
                        <div class="dr-icon">${cardIcon}</div>
                        <div>
                            <div class="dr-meta" style="font-size:9px;color:#4a6a8a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px;">${cardLbl}</div>
                            <div class="dr-number">${dr}</div>
                            <div class="dr-meta">${items.length} record${items.length!==1?'s':''} · Qty: ${totalQty.toLocaleString()}</div>
                        </div>
                    </div>
                    <div class="dr-pills">
                        ${ic?`<span class="dpill dpill-in">${ic} IN</span>`:''}
                        ${oc?`<span class="dpill dpill-out">${oc} OUT</span>`:''}
                        ${uc?`<span class="dpill dpill-upd">${uc} UPD</span>`:''}
                        <span class="dr-arrow">›</span>
                    </div>
                </div>`;
            }).join('')}
        </div>`;
}

function selectDR(idx) {
    const panel = $('log-detail');
    if(!panel._sortedDRs) return;
    const dr = panel._sortedDRs[idx];
    if(dr === undefined) return;
    activeDR = dr;
    renderDRDetail(panel._drGroups[dr]);
}

function renderDRDetail(entries) {
    const panel = $('log-detail'); if(!panel) return;
    const fLoc  = ($('log-loc-filter')?.value||"").toUpperCase();
    const fCod  = ($('log-cod-filter')?.value||"").toUpperCase();
    const fLot  = ($('log-lot-filter')?.value||"").toUpperCase();
    const fQty  = ($('log-qty-filter')?.value||"").toString();
    const fType = ($('log-type-filter')?.value||"all");

    let filtered = (entries||[]).filter(l =>
        (fType==='all'||l._type===fType)
        && (l.loc||"").toUpperCase().includes(fLoc)
        && (l.cod||"").toUpperCase().includes(fCod)
        && (l.lot||"").toUpperCase().includes(fLot)
        && (String(l.outQty||l.qty||"")).includes(fQty)
    );

    filtered.sort((a,b)=>{
        try{
            const p=s=>{const[dt,tm]=(s||'').split(', ');const[d,m,y]=dt.split('/');return new Date(`${y}-${m}-${d}T${tm}`);};
            return p(b.ts)-p(a.ts);
        }catch{return 0;}
    });

    const tm = {inc:{l:'TRANSFER IN',c:'log-in'}, pull:{l:'PULL-OUT',c:'log-out'}, upd:{l:'UPDATE/DELETE',c:'log-upd'}};
    const drLabel = activeDR || '—';
    const hasIn  = (entries||[]).some(l=>l._type==='inc');
    const hasOut = (entries||[]).some(l=>l._type==='pull');
    const drIcon = hasOut && !hasIn ? '📤' : hasIn ? '🚚' : '📄';

    // Store entries for print functions
    panel._printEntries = entries;

    panel.innerHTML = `
        <div class="detail-header">
            <div style="display:flex;align-items:center;gap:10px;">
                <button class="btn-back" onclick="activeDR=null;renderDateDR(_currentDateEntries)">‹ BACK</button>
                <span class="detail-date">${drIcon} ${drLabel}</span>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <button class="btn-xls-action" style="background:#d1fae5;border:1px solid #6ee7b7;color:#059669;padding:5px 10px;font-size:10px;font-weight:700;border-radius:5px;cursor:pointer;" onclick="histPrintTags()">🏷 PRINT ALL TAGS</button>
                <button class="btn-xls-action" style="background:#dbeafe;border:1px solid #93c5fd;color:#1d4ed8;padding:5px 10px;font-size:10px;font-weight:700;border-radius:5px;cursor:pointer;" onclick="histPrintTransferSlip()">🖨 TRANSFER SLIP</button>
                <button class="btn-xls-action" style="background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;padding:5px 10px;font-size:10px;font-weight:700;border-radius:5px;cursor:pointer;" onclick="histPrintPullOutSlip()">📤 PULL-OUT SLIP</button>
                <span class="detail-count">${filtered.length} record${filtered.length!==1?'s':''}</span>
            </div>
        </div>
        <div class="detail-table-wrap t-wrap">
        <table>
            <thead><tr class="thead-main">
                <th width="75">TIME</th><th width="120">ACTION</th><th width="82">LOC</th>
                <th width="145">ITEM CODE</th><th width="115">LOT NO.</th><th width="80">QTY</th>
                <th width="90">STATUS</th><th width="120">DR / POS</th><th width="110">TYPE</th>
            </tr></thead>
            <tbody>${filtered.length ? filtered.map(l=>{
                const t = tm[l._type]||{l:l.logType||'LOG',c:''};
                const tp = (l.ts||'').includes(', ') ? (l.ts||'').split(', ')[1] : ((l.ts||'').split(',')[1]?.trim()||'');
                const qtyVal = l._type==='pull'
                    ? `<span style="color:#f87171;font-weight:700;">-${parseNum(l.outQty||l.qty).toLocaleString()}</span>`
                    : parseNum(l.outQty||l.qty).toLocaleString();
                return `<tr class="log-row ${t.c}">
                    <td class="time-cell">${tp}</td>
                    <td><span class="log-badge ${t.c}">${l.logType||t.l}</span></td>
                    <td class="loc-cell">${l.loc||'-'}</td>
                    <td><b>${l.cod||'-'}</b></td>
                    <td>${l.lot||'-'}</td>
                    <td class="qty-normal">${qtyVal}</td>
                    <td><span class="bdg status-${(l.sts||'').replace(/\s/g,'')}">${l.sts||'-'}</span></td>
                    <td>${l.dr||l.pos||'-'}</td>
                    <td>${l.typ||'-'}</td>
                </tr>`;
            }).join('') : '<tr><td colspan="9" style="text-align:center;color:#2a3a50;padding:20px;font-style:italic;">No matching records.</td></tr>'}</tbody>
        </table></div>`;
}


// ── SAVE ENTRY ─────────────────────────────────
function sv(){
    const id=parseInt($('e-idx').value);
    const loc=v('i-loc').toUpperCase().trim();
    const cod=v('i-cod').toUpperCase().trim();
    const lot=v('i-lot').trim();
    const qty=parseNum($('i-qty').value);
    if(!/^[A-Z]{3}\d{4}$/.test(loc)||!cod||!lot||qty<=0){alert("❌ Location, Item Code, Lot, and Quantity required.");return;}
    const isOcc=db.some((x,i)=>x.loc===loc&&i!==id&&parseNum(x.qty)>0);
    if(isOcc&&!confirm(`⚠️ LOCATION ${loc} OCCUPIED! Continue?`)) return;
    const d={loc,cod,lot,sts:v('i-sts'),qty,pal:v('i-pal'),dr:v('i-dr'),dat:v('i-dat'),typ:v('i-typ'),acc:v('i-acc'),isMod:id!==-1?db[id].isMod:false};
    undos.push(JSON.stringify(db)); logs=ensureLogs(logs);
    if(id===-1){db.push(d);logs.inc.unshift({...d,logType:'TRANSFER',ts:nowStr()});}
    else{db[id]=d;logs.upd.unshift({...d,logType:'EDITED',ts:nowStr()});}
    resetForm(); save();
}

// ── DELETE ─────────────────────────────────────
function dl(i){
    if(confirm("Delete this entry?")){
        undos.push(JSON.stringify(db)); logs=ensureLogs(logs);
        logs.upd.unshift({...db[i],logType:'DELETED',ts:nowStr()});
        db.splice(i,1); save();
    }
}

// ── GRID IMPORT (transfer.html) ────────────────
function processGridImport(rows){
    if(!rows.length) return 0;
    undos.push(JSON.stringify(db)); logs=ensureLogs(logs);
    let added=0;
    rows.forEach(c=>{
        const loc=(c[0]||"").toUpperCase().trim();
        if(!loc||!c[1]) return;
        if(db.some(x=>x.loc===loc&&parseNum(x.qty)>0)){
            if(!confirm(`⚠️ LOCATION ${loc} OCCUPIED! Overwrite?`)) return;
        }
        const typ=(c[8]||"").trim();
        const d={loc,cod:(c[1]||"").toUpperCase(),lot:c[2]||"",sts:(c[3]||"PASSED").toUpperCase(),
                 qty:parseNum(c[4]),pal:c[5]||"",dr:c[6]||"",dat:c[7]||"",typ,acc:am[typ]||"",isMod:false};
        db.push(d); logs.inc.unshift({...d,logType:'TRANSFER (BULK)',ts:nowStr()}); added++;
    });
    save(); return added;
}

// ── EDIT ───────────────────────────────────────
function ed(i){
    const x=db[i]; $('e-idx').value=i;
    ['loc','cod','lot','sts','qty','pal','dr','dat','typ','acc'].forEach(f=>$('i-'+f).value=x[f]||"");
    document.querySelector('.entry-card').scrollIntoView({behavior:'smooth',block:'start'});
}

// ── UNDO ───────────────────────────────────────
function un(){
    if(undos.length){db=JSON.parse(undos.pop());save();}
    else alert("Nothing to undo!");
}

// ── MASTER RESET ───────────────────────────────
function mr(){
    if(prompt("Master Password:")==="admin"){
        rdb.ref().remove();localStorage.clear();sessionStorage.clear();location.reload();
    }
}

// ── STATS ──────────────────────────────────────
function upd_stats(){
    if(!isPage('s-q')) return;
    let q=0,l=new Set(),p=0,h=0,f=0;
    db.forEach(i=>{
        const n=parseNum(i.qty);
        if(n>0){q+=n;l.add(i.loc);
            if(i.sts==='PASSED') p++;
            else if(i.sts==='HOLD') h++;
            else if(i.sts==='FAILED') f++;
        }
    });
    $('s-q').innerText=q.toLocaleString();$('s-l').innerText=l.size;
    $('s-p').innerText=p;$('s-h').innerText=h;$('s-f').innerText=f;
}

// ── HELPERS ────────────────────────────────────
function resetForm(){
    $('e-idx').value="-1";
    document.querySelectorAll('.igrid input,.igrid select').forEach(i=>i.value="");
}
function fillLoc(l){if(isPage('i-loc')){$('i-loc').value=l;$('i-cod').focus();}}
function map(){$('i-acc').value=am[v('i-typ')]||"";}
const v=id=>$(id).value;
const save=()=>{
    rdb.ref('j_db').set(db.length>0?db:[]);
    rdb.ref('j_lg').set(ensureLogs(logs));
};

// ── GO TO STORING TAG PAGE ──────────────────
function goStoringTag(idx) {
    const item = db[idx];
    if (!item) return;
    sessionStorage.setItem('st_prefill_loc', item.loc || '');
    sessionStorage.setItem('st_prefill_cod', item.cod || '');
    window.location.href = 'storingtag.html';
}

// ── GO TO PULL-OUT PAGE ─────────────────────
function goPullout(idx) {
    const item = db[idx];
    if (!item) return;
    // Store the item hint in sessionStorage so pullout.html can pre-search it
    sessionStorage.setItem('po_prefill_loc', item.loc || '');
    sessionStorage.setItem('po_prefill_cod', item.cod || '');
    window.location.href = 'pullout.html';
}

// ── HISTORY PAGE PRINT HELPERS ──────────────
function _getHistPrintEntries() {
    const panel = $('log-detail');
    return panel && panel._printEntries ? panel._printEntries : [];
}
function closeHistPrint() {
    const a = $('hist-print-area'); if(a) { a.style.display='none'; a.innerHTML=''; }
    const b = $('hist-print-close'); if(b) b.style.display='none';
}
function _openHistPrint(html, pageSize) {
    const area = $('hist-print-area'); if(!area) return;
    // inject page-size style dynamically
    let ps = document.getElementById('hist-print-page-style');
    if(!ps){ ps=document.createElement('style'); ps.id='hist-print-page-style'; document.head.appendChild(ps); }
    ps.textContent = `@media print { @page { size: ${pageSize}; margin: 8mm 10mm; } }`;
    area.innerHTML = html;
    area.style.display = 'block';
    const btn = $('hist-print-close'); if(btn) btn.style.display='block';
    window.print();
}

// 🏷 PRINT ALL TAGS — landscape A4, same format as storingtag.html
function histPrintTags() {
    const entries = _getHistPrintEntries().filter(l=>l._type==='inc'&&l.loc&&l.cod);
    if(!entries.length){ alert('❌ No TRANSFER IN records to print tags for.'); return; }
    const pages = entries.map(x => {
        const qty = parseNum(x.outQty||x.qty).toLocaleString();
        let dt = x.dat || '—';
        try { if(dt&&dt.includes('-')){ const[y,m,d]=dt.split('-'); dt=`${m}/${d}/${y}`; } } catch(e){}
        const cod = x.cod||'—', lot = x.lot||'—', loc = x.loc||'—';
        const csz = cod.length>12?Math.max(28,Math.floor(960/cod.length)):80;
        const lsz = lot.length>12?Math.max(28,Math.floor(960/lot.length)):80;
        const locsz = loc.length>9?60:80;
        return `<div class="hist-tag-page">
            <div class="hist-tag-company">TOSHIBA LOGISTICS PHILIPPINES CORP.</div>
            <div class="hist-tag-title-row">PALLET IDENTIFICATION TAG</div>
            <div class="hist-tag-field"><div class="hist-tag-field-label">PRODUCT/<br>ITEM CODE:</div><div class="hist-tag-field-value" style="font-size:${csz}pt;">${cod}</div></div>
            <div class="hist-tag-field"><div class="hist-tag-field-label">LOT<br>NUMBER:</div><div class="hist-tag-field-value bold" style="font-size:${lsz}pt;">${lot}</div></div>
            <div class="hist-tag-field"><div class="hist-tag-field-label">QUANTITY :</div><div class="hist-tag-field-value">${qty}</div></div>
            <div class="hist-tag-field"><div class="hist-tag-field-label">LOCATION:</div><div class="hist-tag-field-value" style="font-size:${locsz}pt;">${loc}</div></div>
            <div class="hist-tag-field" style="border-bottom:2.5px solid #000;"><div class="hist-tag-field-label">STORING<br>DATE:</div><div class="hist-tag-field-value">${dt}</div></div>
            <div class="hist-tag-footer"><div style="font-size:11pt;font-weight:bold;">PLC-TPC-019.R00</div></div>
        </div>`;
    }).join('');
    _openHistPrint(pages, 'A4 landscape');
}

// 🖨 PRINT TRANSFER SLIP — compressed A4 portrait
function histPrintTransferSlip() {
    const entries = _getHistPrintEntries().filter(l=>l._type==='inc'&&l.loc&&l.cod);
    if(!entries.length){ alert('❌ No TRANSFER IN records found for this entry.'); return; }
    const dr = activeDR || '—';
    const slipDate = entries[0]?.dat || '—';
    let totalQty=0;
    entries.forEach(r=>{ totalQty+=parseNum(r.outQty||r.qty); });
    const tbody = entries.map((r,i)=>`<tr class="data-row">
        <td>${i+1}</td><td class="l"><b>${r.cod}</b></td><td>${r.srcloc||'—'}</td><td>${r.lot||'—'}</td>
        <td>${r.sts||'—'}</td><td class="r" style="font-weight:600;">${parseNum(r.outQty||r.qty).toLocaleString()}</td>
        <td>${r.noc||''}</td><td>${r.exp||''}</td><td>${r.pal||''}</td><td>${r.rem||''}</td><td><b>${r.loc}</b></td>
    </tr>`).join('');
    const html = `<div class="hist-slip-page">
        <div class="hist-slip-company">Toshiba Logistics Phils. Corp.</div>
        <div class="hist-slip-title">TRANSFER SLIP</div>
        <div class="hist-slip-meta">
            <div class="hist-slip-meta-left">
                <p>From : &nbsp;<b>TPC</b></p><p>To : &nbsp;&nbsp;&nbsp;<b>TLGP</b></p>
                <p>Date : &nbsp;<b>${slipDate}</b></p><p>DR / Invoice : &nbsp;<b>${dr}</b></p>
            </div>
            <div><div class="hist-ctrl-label">TS Control No:</div><div class="hist-ctrl-no">${dr}</div></div>
        </div>
        <table class="hist-slip-table"><thead><tr>
            <th style="width:22px">NO.</th><th style="width:130px">PRODUCT / ITEM CODE</th>
            <th style="width:62px">SRC LOC</th><th style="width:78px">LOT #</th>
            <th style="width:68px">STATUS</th><th style="width:62px">QTY</th>
            <th style="width:45px">CASES</th><th style="width:65px">EXPIRY</th>
            <th style="width:62px">PALLET</th><th style="width:72px">REMARKS</th>
            <th style="width:75px">TLGP LOC</th>
        </tr></thead>
        <tbody>${tbody}
            <tr class="total-row"><td colspan="5" class="r" style="padding-right:6px;">TOTAL</td>
            <td class="r">${totalQty.toLocaleString()}</td><td colspan="5"></td></tr>
        </tbody></table>
        <p class="hist-slip-note">NOTE: No. of Cases and Expiry date is applicable only for Finished Product.</p>
        <div class="hist-slip-sigs">
            <div class="hist-slip-sig">PREPARED BY:</div>
            <div class="hist-slip-sig">CHECKED BY:</div>
            <div class="hist-slip-sig">STORED BY:</div>
        </div>
        <div class="hist-slip-footer">PLC-TPC-031-R00 &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-GB')}</div>
    </div>`;
    _openHistPrint(html, 'A4 portrait');
}

// 📤 PRINT PULL-OUT SLIP — compressed A4 portrait
function histPrintPullOutSlip() {
    const entries = _getHistPrintEntries().filter(l=>l._type==='pull'&&l.loc&&l.cod);
    if(!entries.length){ alert('❌ No PULL-OUT records found for this entry.'); return; }
    const pos = activeDR || entries[0]?.pos || entries[0]?.dr || '—';
    const slipDate = entries[0]?.dat || '—';
    let totalQty=0;
    entries.forEach(r=>{ totalQty+=parseNum(r.outQty||r.qty); });
    const tbody = entries.map((r,i)=>`<tr class="data-row">
        <td>${i+1}</td><td class="l"><b>${r.cod}</b></td><td>${r.lot||'—'}</td>
        <td>${r.sts||'—'}</td><td class="r" style="font-weight:600;">${parseNum(r.outQty||r.qty).toLocaleString()}</td>
        <td>${r.pal||'N/A'}</td><td>${r.noc||'N/A'}</td><td class="l">${r.rem||r.remarks||'—'}</td><td><b>${r.loc}</b></td>
    </tr>`).join('');
    const html = `<div class="hist-slip-page">
        <div class="hist-slip-company">Toshiba Logistics Phils. Corp.</div>
        <div class="hist-slip-title">PULL OUT SLIP</div>
        <div class="hist-slip-meta">
            <div class="hist-slip-meta-left">
                <p>From : &nbsp;<b>TLGP</b></p><p>To : &nbsp;&nbsp;&nbsp;<b>TPC</b></p>
                <p>Date : &nbsp;<b>${slipDate}</b></p>
            </div>
            <div><div class="hist-ctrl-label">POS Control No:</div><div class="hist-ctrl-no">${pos}</div></div>
        </div>
        <table class="hist-slip-table"><thead><tr>
            <th style="width:22px">NO.</th><th style="width:140px">PRODUCT / ITEM CODE</th>
            <th style="width:80px">LOT #</th><th style="width:78px">STATUS</th>
            <th style="width:65px">QTY</th><th style="width:78px">PALLET REF</th>
            <th style="width:52px">CASES</th><th style="width:95px">REMARKS</th>
            <th style="width:80px">TLGP LOC</th>
        </tr></thead>
        <tbody>${tbody}
            <tr class="total-row"><td colspan="4" class="r" style="padding-right:6px;">TOTAL</td>
            <td class="r">${totalQty.toLocaleString()}</td><td colspan="4"></td></tr>
        </tbody></table>
        <p class="hist-slip-note">NOTE: No. of Cases is applicable for Finished Product only.</p>
        <div class="hist-slip-sigs">
            <div class="hist-slip-sig">PREPARED BY:</div>
            <div class="hist-slip-sig">PICKED BY:</div>
            <div class="hist-slip-sig">CHECKED BY:</div>
        </div>
        <div class="hist-slip-footer">PLC-TPC-032-R00 &nbsp;|&nbsp; Printed: ${new Date().toLocaleString('en-GB')}</div>
    </div>`;
    _openHistPrint(html, 'A4 portrait');
}
