/* =========================================================================
   SMART ROUTE OPTIMIZATION
   - Titik awal = lokasi GPS perangkat kalau "Ikuti Lokasi Saya" (Field
     Radar) aktif; fallback ke titik kantor.
   - Titik tujuan akhir sekarang bisa DISEARCH (bukan dropdown berisi ribuan
     lokasi) — ketik nama/alamat, pilih dari hasil pencarian.
   - Peta rute HANYA menampilkan tag lokasi yang direkomendasikan (titik
     awal, singgahan, tujuan akhir) — bukan seluruh database — supaya jalur
     rute terlihat jelas, tidak tertutup ribuan marker.
   ========================================================================= */
const routeMap = L.map('routeMap').setView(OFFICE, 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(routeMap);
let routeStartMarker = L.marker(OFFICE).addTo(routeMap).bindPopup('Titik Awal: '+OFFICE_NAME);
let routeStopMarkers=[], routeLine=null;
let selectedDest=null;

function routeStartPoint(){
  return (typeof currentOrigin==='function') ? currentOrigin() : OFFICE;
}
GeoService.subscribe((pos, err)=>{
  const label=document.getElementById('routeStartLabel');
  const hint=document.getElementById('routeGpsHint');
  if(err || !pos) return;
  label.value = `Lokasi Anda (GPS): ${pos[0].toFixed(5)}, ${pos[1].toFixed(5)}`;
  hint.textContent = 'Titik awal rute mengikuti posisi GPS perangkat secara live.';
  routeStartMarker.setLatLng(pos).bindPopup('Titik Awal: Lokasi Anda (GPS)');
});

/* Dipanggil dari fos-field-radar.js setiap kali `targets` selesai dimuat/
   berubah — sengaja TIDAK menaruh marker apa pun ke peta di sini (supaya
   peta rute tidak penuh ribuan tag lokasi); hanya memastikan data siap
   dipakai untuk pencarian tujuan. */
function populateDestSelect(){
  if(selectedDest){
    const stillExists = targets.find(t=>String(t.id)===String(selectedDest.id));
    if(!stillExists) clearSelectedDest();
  }
}
function clearSelectedDest(){
  selectedDest=null;
  document.getElementById('destSelectedId').value='';
  document.getElementById('destSelectedLabel').textContent='Belum ada tujuan dipilih.';
}

/* ---------- pencarian tujuan (combobox sederhana) ---------- */
const destSearchInput = document.getElementById('destSearchInput');
const destSearchResults = document.getElementById('destSearchResults');
destSearchInput.addEventListener('input', ()=>{
  const q = destSearchInput.value.trim().toLowerCase();
  if(q.length<2){ destSearchResults.classList.add('hidden'); destSearchResults.innerHTML=''; return; }
  const matches = (targets||[]).filter(t=> t.name.toLowerCase().includes(q) || (t.alamat||'').toLowerCase().includes(q)).slice(0,20);
  if(matches.length===0){
    destSearchResults.innerHTML='<div class="p-2 text-xs text-[#98A2B3]">Tidak ditemukan.</div>';
  }else{
    destSearchResults.innerHTML = matches.map(t=>`
      <div class="destResultItem p-2 hover:bg-[#F8F9FC] cursor-pointer border-b border-[#F0F2F6] last:border-0" data-id="${t.id}">
        <div class="font-semibold text-[#101828] text-sm">${t.name}</div>
        <div class="text-[11px] text-[#8A93A6]">${typeMeta[t.type]?typeMeta[t.type].label:t.type} · ${t.alamat||''}</div>
      </div>`).join('');
  }
  destSearchResults.classList.remove('hidden');
});
destSearchResults.addEventListener('click', (e)=>{
  const item = e.target.closest('.destResultItem');
  if(!item) return;
  const t = targets.find(x=>String(x.id)===String(item.dataset.id));
  if(!t) return;
  selectedDest = t;
  document.getElementById('destSelectedId').value = t.id;
  destSearchInput.value = t.name;
  document.getElementById('destSelectedLabel').textContent = `Tujuan dipilih: ${t.name}`;
  destSearchResults.classList.add('hidden');
});
document.addEventListener('click', (e)=>{
  if(!e.target.closest('#destSearchResults') && e.target !== destSearchInput){
    destSearchResults.classList.add('hidden');
  }
});

async function osrmTable(coords){
  const coordStr = coords.map(c=>`${c[1]},${c[0]}`).join(';');
  const res = await fetch(`${OSRM}/table/v1/driving/${coordStr}?annotations=distance`);
  const data = await res.json();
  if(data.code!=='Ok') throw new Error('table failed');
  return data.distances;
}
async function osrmRouteMulti(coords){
  const coordStr = coords.map(c=>`${c[1]},${c[0]}`).join(';');
  const res = await fetch(`${OSRM}/route/v1/driving/${coordStr}?overview=full&geometries=geojson`);
  const data = await res.json();
  if(data.code!=='Ok') throw new Error('route failed');
  return { latlngs: data.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]), distance:data.routes[0].distance, duration:data.routes[0].duration };
}

/* Menggambar ulang marker HANYA untuk lokasi yang direkomendasikan pada
   rute terakhir (bukan seluruh database) supaya jalur tetap terlihat jelas. */
function renderRouteStopMarkers(stops){
  routeStopMarkers.forEach(m=>routeMap.removeLayer(m));
  routeStopMarkers = stops.map(t=>L.marker([t.lat,t.lng],{icon:iconFor(t.type,t.status,t.source)}).addTo(routeMap).bindPopup(esc(t.name)));
}

document.getElementById('smartRouteBtn').addEventListener('click', async ()=>{
  const resultEl=document.getElementById('routeResult');
  const destId=document.getElementById('destSelectedId').value;
  const dest=targets.find(t=>String(t.id)===String(destId));
  if(!dest){ resultEl.innerHTML='<p class="text-xs text-[#DC2626]">Cari dan pilih tujuan akhir terlebih dahulu.</p>'; return; }

  resultEl.innerHTML='<p class="text-xs text-[#98A2B3]">Menghitung rute optimal mengikuti jalan...</p>';
  const START = routeStartPoint();
  const startLabel = GeoService.isActive() && GeoService.getLast() ? 'Lokasi Anda (GPS)' : OFFICE_NAME+' (mulai)';

  // shortlist 10 nearest (straight-line) candidates to START, excluding destination, as routing pool
  const pool = targets.filter(t=>String(t.id)!==String(destId))
    .sort((a,b)=>haversine(START,[a.lat,a.lng]) - haversine(START,[b.lat,b.lng]))
    .slice(0,10);

  let orderedStops=[]; // target objects, excluding start/dest
  let usedTable=true;
  try{
    const coords=[START, ...pool.map(t=>[t.lat,t.lng]), [dest.lat,dest.lng]];
    const matrix = await osrmTable(coords);
    let currentIdx=0;
    const remaining=new Set(pool.map((_,i)=>i+1)); // indices 1..pool.length
    while(orderedStops.length<3 && remaining.size>0){
      let best=null, bestDist=Infinity;
      remaining.forEach(idx=>{
        const d=matrix[currentIdx][idx];
        if(d!=null && d<bestDist){ bestDist=d; best=idx; }
      });
      if(best===null) break;
      remaining.delete(best);
      orderedStops.push(pool[best-1]);
      currentIdx=best;
    }
  }catch(e){
    usedTable=false;
    orderedStops = pool.sort((a,b)=>haversine(START,[a.lat,a.lng])-haversine(START,[b.lat,b.lng])).slice(0,3);
  }

  renderRouteStopMarkers([...orderedStops, dest]);
  const waypointCoords=[START, ...orderedStops.map(t=>[t.lat,t.lng]), [dest.lat,dest.lng]];
  try{
    const routeData = await osrmRouteMulti(waypointCoords);
    if(routeLine) routeMap.removeLayer(routeLine);
    routeLine=L.polyline(routeData.latlngs,{color:'#F5941E',weight:5}).addTo(routeMap);
    routeMap.fitBounds(L.latLngBounds(waypointCoords),{padding:[30,30]});
    const km=(routeData.distance/1000).toFixed(1);
    const min=Math.round(routeData.duration/60);
    resultEl.innerHTML = `
      <div class="font-semibold text-[#101828] mb-1">Rute direkomendasikan (±${km} km, ±${min} menit)${usedTable?'':' — estimasi jarak lurus'}:</div>
      <ol class="list-decimal list-inside">
        <li>${startLabel}</li>
        ${orderedStops.map(t=>`<li>${t.name} — ${typeMeta[t.type]?typeMeta[t.type].label:t.type}</li>`).join('')}
        <li><b>${dest.name}</b> — tujuan akhir</li>
      </ol>`;
  }catch(e){
    if(routeLine) routeMap.removeLayer(routeLine);
    routeLine=L.polyline(waypointCoords,{color:'#F5941E',weight:4,dashArray:'6,6'}).addTo(routeMap);
    routeMap.fitBounds(L.latLngBounds(waypointCoords),{padding:[30,30]});
    resultEl.innerHTML = `
      <div class="font-semibold text-[#101828] mb-1">Rute direkomendasikan (layanan routing jalan tidak tersedia, garis lurus):</div>
      <ol class="list-decimal list-inside">
        <li>${startLabel}</li>
        ${orderedStops.map(t=>`<li>${t.name} — ${typeMeta[t.type]?typeMeta[t.type].label:t.type}</li>`).join('')}
        <li><b>${dest.name}</b> — tujuan akhir</li>
      </ol>`;
  }
});
