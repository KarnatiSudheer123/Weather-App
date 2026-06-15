/* ================= STATE ================= */
const $ = (id)=>document.getElementById(id);
const STORE = {
  theme:'skycast_theme', history:'skycast_history', favs:'skycast_favs'
};
let currentCity = null;

/* ================= THEME ================= */
const themeToggle = $('themeToggle');
function applyTheme(t){
  if(t==='dark'){ document.documentElement.classList.add('dark'); document.body.classList.add('dark'); }
  else { document.documentElement.classList.remove('dark'); document.body.classList.remove('dark'); }
}
applyTheme(localStorage.getItem(STORE.theme) || 'light');
themeToggle.addEventListener('click',()=>{
  const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
  localStorage.setItem(STORE.theme,next); applyTheme(next);
});

/* ================= HAMBURGER ================= */
$('hamburger').addEventListener('click',()=>$('navLinks').classList.toggle('open'));
document.querySelectorAll('#navLinks a').forEach(a=>a.addEventListener('click',()=>$('navLinks').classList.remove('open')));

/* ================= CLOCK ================= */
function tick(){
  const d = new Date();
  $('liveClock').textContent = d.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'})+' • '+d.toLocaleTimeString();
}
setInterval(tick,1000); tick();
$('year').textContent = new Date().getFullYear();

/* ================= BACK TO TOP ================= */
const backTop = $('backTop');
window.addEventListener('scroll',()=>{ backTop.classList.toggle('show', window.scrollY>400); });
backTop.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

/* ================= TOAST ================= */
function toast(msg, ok=false){
  const t = $('toast'); t.textContent = msg; t.classList.toggle('success',ok); t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}

/* ================= WEATHER CODE MAP ================= */
const WCODE = {
  0:['Clear sky','☀️'],1:['Mainly clear','🌤️'],2:['Partly cloudy','⛅'],3:['Overcast','☁️'],
  45:['Fog','🌫️'],48:['Rime fog','🌫️'],
  51:['Light drizzle','🌦️'],53:['Drizzle','🌦️'],55:['Heavy drizzle','🌧️'],
  56:['Freezing drizzle','🌧️'],57:['Heavy freezing drizzle','🌧️'],
  61:['Light rain','🌦️'],63:['Rain','🌧️'],65:['Heavy rain','🌧️'],
  66:['Freezing rain','🌧️'],67:['Heavy freezing rain','🌧️'],
  71:['Light snow','🌨️'],73:['Snow','❄️'],75:['Heavy snow','❄️'],77:['Snow grains','❄️'],
  80:['Rain showers','🌦️'],81:['Heavy showers','🌧️'],82:['Violent showers','⛈️'],
  85:['Snow showers','🌨️'],86:['Heavy snow showers','🌨️'],
  95:['Thunderstorm','⛈️'],96:['Thunder w/ hail','⛈️'],99:['Severe thunder','⛈️']
};
const wc = c => WCODE[c] || ['Unknown','❓'];

/* ================= API ================= */
async function geocode(name){
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
  if(!r.ok) throw new Error('Geocoding failed');
  const d = await r.json();
  if(!d.results || !d.results.length) throw new Error('City not found');
  return d.results[0];
}
async function fetchWeather(lat,lon){
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    +`&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,visibility`
    +`&hourly=temperature_2m,weather_code,precipitation_probability`
    +`&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max`
    +`&timezone=auto&forecast_days=7`;
  const r = await fetch(url); if(!r.ok) throw new Error('Weather fetch failed'); return r.json();
}
async function fetchAir(lat,lon){
  try{
    const r = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5,european_aqi`);
    if(!r.ok) return null; return r.json();
  }catch{return null;}
}

/* ================= RENDER ================= */
function fmtTime(iso, tz){
  try{ return new Date(iso).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',timeZone:tz}); }catch{return iso;}
}
function fmtDay(iso){ return new Date(iso).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'}); }
function compass(deg){const dirs=['N','NE','E','SE','S','SW','W','NW'];return dirs[Math.round(deg/45)%8];}
function renderAll(city, data, air){
  const cur = data.current, daily = data.daily, hourly = data.hourly, tz = data.timezone;
  const [cond, ic] = wc(cur.weather_code);
  $('cCity').textContent = city.name;
  $('cCountry').textContent = [city.admin1, city.country].filter(Boolean).join(', ');
  $('cTemp').textContent = Math.round(cur.temperature_2m)+'°C';
  $('cCond').textContent = cond;
  $('cIcon').textContent = ic;
  $('cUpdated').textContent = 'Updated '+fmtTime(cur.time, tz);
  $('dFeels').textContent = Math.round(cur.apparent_temperature)+'°';
  $('dHum').textContent = cur.relative_humidity_2m+'%';
  $('dWind').textContent = Math.round(cur.wind_speed_10m)+' km/h';
  $('dPres').textContent = Math.round(cur.pressure_msl)+' hPa';
  $('dVis').textContent = ((cur.visibility||0)/1000).toFixed(1)+' km';
  $('dRise').textContent = fmtTime(daily.sunrise[0], tz);
  $('dSet').textContent = fmtTime(daily.sunset[0], tz);
  $('dCloud').textContent = cur.cloud_cover+'%';
  $('dPrec').textContent = (cur.precipitation||0)+' mm';
  
  // Hourly next 24
  const nowIdx = hourly.time.findIndex(t=> new Date(t) >= new Date(cur.time));
  const start = Math.max(0,nowIdx);
  const hr = $('hourlyScroll'); hr.innerHTML='';
  for(let i=start;i<start+24 && i<hourly.time.length;i++){
    const [,hi] = wc(hourly.weather_code[i]);
    const card = document.createElement('div'); card.className='hour-card';
    card.innerHTML = `<div class="h">${fmtTime(hourly.time[i],tz)}</div><div class="i">${hi}</div><div class="t">${Math.round(hourly.temperature_2m[i])}°</div><div class="h">💧${hourly.precipitation_probability?.[i]??0}%</div>`;
    hr.appendChild(card);
  }
  
  // Daily
  const dg = $('dailyGrid'); dg.innerHTML='';
  for(let i=0;i<daily.time.length;i++){
    const [dc, di] = wc(daily.weather_code[i]);
    const c = document.createElement('div'); c.className='day-card';
    c.innerHTML = `<div class="d">${fmtDay(daily.time[i])}</div><div class="i">${di}</div><div style="font-size:.85rem;color:var(--muted);margin-bottom:6px;">${dc}</div>
      <div class="mm"><span>${Math.round(daily.temperature_2m_max[i])}°</span><span class="min">${Math.round(daily.temperature_2m_min[i])}°</span></div>
      <div class="rain">🌧️ ${daily.precipitation_probability_max?.[i]??0}%</div>`;
    dg.appendChild(c);
  }
  
  // Highlights
  $('hHum').textContent = cur.relative_humidity_2m+'%'; $('hHumBar').style.width = cur.relative_humidity_2m+'%';
  const uv = daily.uv_index_max?.[0] ?? 0;
  $('hUv').textContent = uv.toFixed(1);
  $('hUvSub').textContent = uv<3?'Low':uv<6?'Moderate':uv<8?'High':uv<11?'Very High':'Extreme';
  $('hWind').textContent = Math.round(cur.wind_speed_10m)+' km/h';
  $('hWindDir').textContent = compass(cur.wind_direction_10m)+' ('+cur.wind_direction_10m+'°)';
  $('hPres').textContent = Math.round(cur.pressure_msl)+' hPa';
  const visKm = (cur.visibility||0)/1000;
  $('hVis').textContent = visKm.toFixed(1)+' km';
  $('hVisSub').textContent = visKm>10?'Excellent':visKm>5?'Good':visKm>2?'Moderate':'Poor';
  $('hCloud').textContent = cur.cloud_cover+'%'; $('hCloudBar').style.width = cur.cloud_cover+'%';
  if(air && air.current){
    const pm = air.current.pm2_5, aqi = air.current.european_aqi;
    $('hAqi').textContent = (pm??'--')+' µg/m³';
    $('hAqiSub').textContent = aqi!=null ? ('EU AQI '+aqi+' — '+(aqi<20?'Good':aqi<40?'Fair':aqi<60?'Moderate':aqi<80?'Poor':'Very Poor')) : '—';
  } else { $('hAqi').textContent='N/A'; $('hAqiSub').textContent='Unavailable'; }
  
  // Location
  $('locLat').textContent = city.latitude.toFixed(3);
  $('locLon').textContent = city.longitude.toFixed(3);
  $('locTz').textContent = tz;
  $('locTime').textContent = new Date().toLocaleTimeString(undefined,{timeZone:tz});
  currentCity = city;
  updateFavBtn();
}

/* ================= MAIN FLOW ================= */
async function loadCity(name, opts={}){
  try{
    showLoading();
    const city = opts.coords ? {name:opts.name||'My Location', country:'', latitude:opts.coords.lat, longitude:opts.coords.lon} : await geocode(name);
    const [data, air] = await Promise.all([fetchWeather(city.latitude,city.longitude), fetchAir(city.latitude,city.longitude)]);
    renderAll(city, data, air);
    if(!opts.coords) addHistory(city.name);
    toast('Weather updated for '+city.name, true);
  }catch(err){
    console.error(err);
    toast(err.message==='City not found' ? '⚠️ City not found' : '⚠️ '+(navigator.onLine?'Unable to fetch weather':'No internet connection'));
  }
}
function showLoading(){
  $('cTemp').innerHTML = '<div class="spinner"></div>';
  $('cCity').textContent='Loading…';
}

/* ================= SEARCH ================= */
$('searchForm').addEventListener('submit',(e)=>{
  e.preventDefault();
  const v = $('cityInput').value.trim();
  if(!v){ toast('Please enter a city name'); return; }
  loadCity(v);
});
$('geoBtn').addEventListener('click',()=>{
  if(!navigator.geolocation){ toast('Geolocation unsupported'); return; }
  navigator.geolocation.getCurrentPosition(
    pos => loadCity(null,{coords:{lat:pos.coords.latitude, lon:pos.coords.longitude}, name:'My Location'}),
    ()  => toast('Location permission denied')
  );
});

/* ================= HISTORY ================= */
function getHistory(){ try{return JSON.parse(localStorage.getItem(STORE.history))||[];}catch{return[];} }
function saveHistory(a){ localStorage.setItem(STORE.history,JSON.stringify(a.slice(0,10))); renderHistory(); }
function addHistory(name){
  const arr = getHistory().filter(x=>x.toLowerCase()!==name.toLowerCase());
  arr.unshift(name); saveHistory(arr);
}
function renderHistory(){
  const row = $('historyRow'); const arr = getHistory();
  row.innerHTML = arr.length ? '' : '<span class="empty">No searches yet.</span>';
  arr.forEach(c=>{
    const chip = document.createElement('span'); chip.className='chip';
    chip.innerHTML = `🕘 ${c}`;
    chip.onclick = ()=>loadCity(c);
    row.appendChild(chip);
  });
}
$('clearHistory').addEventListener('click',()=>{ localStorage.removeItem(STORE.history); renderHistory(); toast('History cleared',true); });

/* ================= FAVORITES ================= */
function getFavs(){ try{return JSON.parse(localStorage.getItem(STORE.favs))||[];}catch{return[];} }
function saveFavs(a){ localStorage.setItem(STORE.favs,JSON.stringify(a)); renderFavs(); updateFavBtn(); }
function renderFavs(){
  const row = $('favRow'); const arr = getFavs();
  row.innerHTML = arr.length ? '' : '<span class="empty">No favorites yet. Add cities you love.</span>';
  arr.forEach(c=>{
    const chip = document.createElement('span'); chip.className='chip';
    chip.innerHTML = `⭐ ${c} <span class="x" title="remove">✕</span>`;
    chip.onclick = (e)=>{
      if(e.target.classList.contains('x')){ saveFavs(getFavs().filter(x=>x!==c)); toast('Removed from favorites'); }
      else loadCity(c);
    };
    row.appendChild(chip);
  });
}
function updateFavBtn(){
  if(!currentCity){ $('favBtn').textContent='⭐ Add to Favorites'; return; }
  const exists = getFavs().some(c=>c.toLowerCase()===currentCity.name.toLowerCase());
  $('favBtn').textContent = exists ? '★ Remove Favorite' : '⭐ Add to Favorites';
}
$('favBtn').addEventListener('click',()=>{
  if(!currentCity) return;
  const arr = getFavs();
  const i = arr.findIndex(c=>c.toLowerCase()===currentCity.name.toLowerCase());
  if(i>=0){ arr.splice(i,1); toast('Removed from favorites'); }
  else{ arr.unshift(currentCity.name); toast('Added to favorites',true); }
  saveFavs(arr);
});

/* ================= INIT ================= */
renderHistory(); renderFavs();
window.addEventListener('online',()=>toast('Back online',true));
window.addEventListener('offline',()=>toast('You are offline'));
loadCity('London');