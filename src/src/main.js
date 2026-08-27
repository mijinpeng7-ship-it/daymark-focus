const $ = s => document.querySelector(s);
const storageKey = 'daymark-todos-v1';
const storageUpdatedKey = 'daymark-updated-v1';
const makeId = () => globalThis.crypto?.randomUUID?.() || `todo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayKey = () => dateKey(new Date());
const mins = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const samples = [
  { id: makeId(), date: todayKey(), title: '晨间计划与邮件整理', start: '08:30', end: '09:15', tag: '工作', done: true },
  { id: makeId(), date: todayKey(), title: '深度专注：核心任务', start: '09:30', end: '11:30', tag: '专注', done: false },
  { id: makeId(), date: todayKey(), title: '阅读与学习', start: '14:00', end: '15:00', tag: '学习', done: false },
];
let todos;
try { const value = JSON.parse(localStorage.getItem(storageKey) || 'null'); todos = Array.isArray(value) ? value : samples; } catch { todos = samples; }
todos = todos.map(todo => ({ ...todo, date: todo.date || todayKey() }));
let selectedDate = todayKey();
let displayYear = new Date().getFullYear();
let displayMonth = new Date().getMonth();
let heatmapMode = 'month';
let timelineDate = todayKey();
let timerTodoId = null, timerEndAt = 0, timerRemaining = 0, timerPaused = false, timerFocusedSeconds = 0, timerLastResumeAt = 0;
let weekAnchor = todayKey();
let isLoggingFocus = false;
let syncTimer;
const save = () => { localStorage.setItem(storageKey, JSON.stringify(todos)); localStorage.setItem(storageUpdatedKey, new Date().toISOString()); clearTimeout(syncTimer); syncTimer = setTimeout(() => syncCloud(false), 800); };

function showSyncStatus(message, error = false) { const el = $('#syncStatus'); el.textContent = message; el.classList.toggle('error', error); }
function refreshAccountUI() {
  const user = window.DaymarkCloud?.user(); $('#authFields').hidden = Boolean(user); $('#signedInPanel').hidden = !user;
  $('#signedInEmail').textContent = user ? `已登录：${user.email || '昼刻用户'}` : ''; $('#accountBtn').textContent = user ? '已同步' : '登录同步';
}
async function syncCloud(showMessage = true) {
  if (!window.DaymarkCloud?.user()) return;
  try {
    if (showMessage) showSyncStatus('正在同步…');
    const result = await window.DaymarkCloud.sync(todos, localStorage.getItem(storageUpdatedKey));
    todos = result.todos; localStorage.setItem(storageKey, JSON.stringify(todos)); localStorage.setItem(storageUpdatedKey, result.updatedAt); renderAll();
    showSyncStatus('同步完成'); $('#accountBtn').textContent = '已同步';
  } catch (error) { showSyncStatus(error.message, true); $('#accountBtn').textContent = '同步失败'; }
}

function countdown(end) {
  const now = new Date(), target = new Date(), [h, m] = end.split(':').map(Number); target.setHours(h, m, 0, 0);
  const diff = target - now; if (diff <= 0) return '已到期';
  const hours = Math.floor(diff / 3600000), minutes = Math.ceil((diff % 3600000) / 60000);
  return hours ? `还剩 ${hours}小时${minutes}分` : `还剩 ${minutes}分钟`;
}

function updateClock() {
  const now = new Date();
  if (timerTodoId && !timerPaused) timerRemaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
  if (timerTodoId && timerRemaining <= 0) finishTimer();
  const timerMode = Boolean(timerTodoId);
  const values = timerMode
    ? [String(Math.floor(timerRemaining / 60)).padStart(2, '0'), String(timerRemaining % 60).padStart(2, '0')]
    : [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')];
  [['#hour', values[0]], ['#minute', values[1]]].forEach(([selector, value]) => {
    const el = $(selector); if (el.textContent !== value) { el.classList.remove('tick'); void el.offsetWidth; el.textContent = value; el.classList.add('tick'); }
  });
  $('#second').textContent = timerMode ? (timerPaused ? 'Ⅱ' : '↓') : String(now.getSeconds()).padStart(2, '0'); $('#period').textContent = timerMode ? 'TIMER' : (now.getHours() < 12 ? 'AM' : 'PM');
  $('#dateText').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now);
}

function renderTodos() {
  const list = $('#todoList'), entries = todos.filter(t => t.date === todayKey()).sort((a, b) => mins(a.start) - mins(b.start)); list.innerHTML = '';
  entries.forEach(todo => {
    const row = document.createElement('div'); row.className = `todo-item ${todo.done ? 'done' : ''}`;
    row.innerHTML = `<button class="check">${todo.done ? '✓' : ''}</button><div class="todo-main"><strong></strong><span>${todo.start} — ${todo.end} · ${todo.tag}</span></div><div class="countdown">${todo.done ? '已完成' : countdown(todo.end)}</div>${todo.done ? '' : '<button class="start-timer">开始</button>'}<button class="delete">×</button>`;
    row.querySelector('strong').textContent = todo.title;
    row.querySelector('.check').onclick = () => { todo.done = !todo.done; save(); renderAll(); };
    row.querySelector('.start-timer')?.addEventListener('click', () => startTimer(todo));
    row.querySelector('.delete').onclick = () => { todos = todos.filter(t => t.id !== todo.id); save(); renderAll(); }; list.appendChild(row);
  });
  const completed = entries.filter(t => t.done).length; $('#progressText').textContent = `${completed} / ${entries.length} 已完成`;
  $('#progressBar').style.width = `${entries.length ? completed / entries.length * 100 : 0}%`; $('#emptyTodos').hidden = entries.length > 0;
}

function startTimer(todo) {
  const duration = (todo.duration || Math.max(1, mins(todo.end) - mins(todo.start))) * 60;
  timerTodoId = todo.id; timerRemaining = duration; timerEndAt = Date.now() + duration * 1000; timerPaused = false; timerFocusedSeconds = 0; timerLastResumeAt = Date.now();
  $('#timerModeBtn').disabled = false; $('#timerModeBtn').classList.add('active'); $('#clockModeBtn').classList.remove('active');
  $('#timerControls').hidden = false; $('#pauseTimer').textContent = '暂停'; $('#focusLine').textContent = `正在专注 · ${todo.title}`; updateClock();
  document.querySelector('.clock-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function stopTimer() {
  timerTodoId = null; timerRemaining = 0; timerPaused = false; timerFocusedSeconds = 0; timerLastResumeAt = 0; $('#timerModeBtn').disabled = true; $('#timerModeBtn').classList.remove('active');
  $('#clockModeBtn').classList.add('active'); $('#timerControls').hidden = true; $('#focusLine').textContent = '把今天过成喜欢的样子。'; updateClock();
}
function finishTimer(early = false) {
  const todo = todos.find(t => t.id === timerTodoId);
  if (todo) {
    if (early) {
      const focusedSeconds = timerFocusedSeconds + (!timerPaused && timerLastResumeAt ? Math.max(0, Math.floor((Date.now() - timerLastResumeAt) / 1000)) : 0);
      todo.duration = Math.max(1, Math.ceil(focusedSeconds / 60));
      const now = new Date(); todo.end = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    todo.done = true;
  }
  stopTimer(); save(); renderAll();
}

function timelineItem(todo, active = false) {
  const item = document.createElement('div'); item.className = `timeline-item ${active ? 'active' : ''} ${todo.done ? 'past' : ''}`;
  item.innerHTML = `<time>${todo.start}</time><div class="timeline-dot"></div><div class="timeline-content"><strong></strong><span>${todo.tag} · ${todo.start}—${todo.end}</span></div>`;
  item.querySelector('strong').textContent = todo.title; return item;
}
function renderTimeline() {
  const now = new Date(), current = now.getHours() * 60 + now.getMinutes(), timeline = $('#timeline'); timeline.innerHTML = '';
  const entries = todos.filter(t => t.date === timelineDate).sort((a, b) => mins(a.start) - mins(b.start));
  $('#timelineDateTitle').textContent = timelineDate === todayKey() ? '今日时间轴' : formatDate(timelineDate);
  renderDateStrip();
  if (!entries.length) {
    timeline.innerHTML = '<div class="timeline-empty"><span>○</span><strong>这一天没有记录</strong><small>可以从全年日历为这一天添加事项</small></div>';
    return;
  }
  entries.forEach(todo => timeline.appendChild(timelineItem(todo, timelineDate === todayKey() && current >= mins(todo.start) && current <= mins(todo.end) && !todo.done)));
}
function shiftKey(key, amount) { const [y, m, d] = key.split('-').map(Number), date = new Date(y, m - 1, d); date.setDate(date.getDate() + amount); return dateKey(date); }
function renderDateStrip() {
  const strip = $('#dateStrip'); strip.innerHTML = '';
  for (let offset = -3; offset <= 3; offset++) {
    const key = shiftKey(timelineDate, offset), [y, m, d] = key.split('-').map(Number), date = new Date(y, m - 1, d), button = document.createElement('button');
    button.className = `${key === timelineDate ? 'selected' : ''} ${key === todayKey() ? 'is-today' : ''}`;
    button.innerHTML = `<span>${['日','一','二','三','四','五','六'][date.getDay()]}</span><b>${d}</b>`;
    button.onclick = () => { timelineDate = key; renderTimeline(); }; strip.appendChild(button);
  }
}
function formatDate(key) {
  const [y, m, d] = key.split('-').map(Number); return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(y, m - 1, d));
}
function renderDayDetail() {
  const entries = todos.filter(t => t.date === selectedDate).sort((a, b) => mins(a.start) - mins(b.start)); $('#selectedDateTitle').textContent = formatDate(selectedDate);
  const completed = entries.filter(t => t.done).length, duration = entries.reduce((sum, t) => sum + (t.duration || Math.max(0, mins(t.end) - mins(t.start))), 0);
  $('#daySummary').innerHTML = `<span><b>${entries.length}</b> 项记录</span><span><b>${completed}</b> 项完成</span><span><b>${Math.floor(duration / 60)}h ${duration % 60}m</b> 已安排</span>`;
  const timeline = $('#dayTimeline'); timeline.innerHTML = ''; entries.forEach(todo => timeline.appendChild(timelineItem(todo))); $('#emptyDay').hidden = entries.length > 0;
}
function renderYear() {
  $('#monthPanel').hidden = heatmapMode !== 'month'; $('#yearPanel').hidden = heatmapMode !== 'year';
  $('#toggleHeatmapMode').textContent = heatmapMode === 'month' ? '查看年度' : '查看月度';
  if (heatmapMode === 'month') { renderMonthHeatmap(); return; }
  $('#yearTitle').textContent = `${displayYear} 年`; const calendar = $('#yearCalendar'); calendar.innerHTML = '';
  let yearlyTotal = 0;
  for (let month = 0; month < 12; month++) {
    const section = document.createElement('section'); section.className = 'year-month';
    section.innerHTML = `<button class="year-month-title">${month + 1}月</button><div class="mini-week"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div class="mini-days"></div>`;
    section.querySelector('.year-month-title').onclick = () => { displayMonth = month; heatmapMode = 'month'; renderYear(); };
    const daysGrid = section.querySelector('.mini-days'), offset = (new Date(displayYear, month, 1).getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) daysGrid.appendChild(document.createElement('i'));
    const days = new Date(displayYear, month + 1, 0).getDate();
    for (let day = 1; day <= days; day++) {
      const key = dateKey(new Date(displayYear, month, day)), total = focusMinutes(key); yearlyTotal += total;
      const button = document.createElement('button'); button.dataset.date = key; button.dataset.level = heatLevel(total);
      button.className = `${key === todayKey() ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`; button.title = `${month + 1}月${day}日 · ${total} 分钟`;
      button.onclick = () => { selectedDate = key; renderYear(); }; daysGrid.appendChild(button);
    }
    calendar.appendChild(section);
  }
  $('#heatmapSummary').textContent = `全年累计专注 ${Math.floor(yearlyTotal / 60)} 小时 ${yearlyTotal % 60} 分钟`;
  renderDayDetail();
}

function focusMinutes(key) {
  return todos.filter(t => t.date === key && t.done).reduce((sum, t) => sum + (t.duration || Math.max(0, mins(t.end) - mins(t.start))), 0);
}
function heatLevel(total) { return total === 0 ? 0 : total <= 45 ? 1 : total <= 120 ? 2 : 3; }
function renderMonthHeatmap() {
  $('#yearTitle').textContent = `${displayYear} 年 ${displayMonth + 1} 月`;
  const grid = $('#monthHeatmap'); grid.innerHTML = ''; const offset = (new Date(displayYear, displayMonth, 1).getDay() + 6) % 7;
  for (let i = 0; i < offset; i++) grid.appendChild(document.createElement('i'));
  let monthlyTotal = 0;
  const days = new Date(displayYear, displayMonth + 1, 0).getDate();
  for (let day = 1; day <= days; day++) {
    const key = dateKey(new Date(displayYear, displayMonth, day)), total = focusMinutes(key); monthlyTotal += total;
    const button = document.createElement('button'); button.dataset.level = heatLevel(total); button.dataset.date = key;
    button.className = `${key === todayKey() ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`;
    button.innerHTML = `<strong>${total ? (total >= 60 ? `${(total / 60).toFixed(total % 60 ? 1 : 0)}h` : `${total}m`) : '—'}</strong><span>${day}</span>`;
    button.onclick = () => { selectedDate = key; renderMonthHeatmap(); renderDayDetail(); }; grid.appendChild(button);
  }
  $('#heatmapSummary').textContent = `本月累计专注 ${Math.floor(monthlyTotal / 60)} 小时 ${monthlyTotal % 60} 分钟`;
  renderDayDetail();
}

function mondayOf(key) { const [y,m,d] = key.split('-').map(Number), date = new Date(y,m-1,d), offset = (date.getDay()+6)%7; date.setDate(date.getDate()-offset); return dateKey(date); }
function renderWeek() {
  const monday = mondayOf(weekAnchor), sunday = shiftKey(monday, 6);
  $('#weekTitle').textContent = `${formatDate(monday).replace(/周./,'')} — ${formatDate(sunday).replace(/周./,'')}`;
  const schedule = $('#weekSchedule'); schedule.innerHTML = '<div class="week-corner">时间</div>';
  for (let day = 0; day < 7; day++) { const key = shiftKey(monday, day), d = Number(key.slice(-2)); schedule.insertAdjacentHTML('beforeend', `<div class="week-day ${key===todayKey()?'today':''}"><span>周${['一','二','三','四','五','六','日'][day]}</span><b>${d}</b></div>`); }
  const startHour = 6, endHour = 24;
  for (let hour = startHour; hour < endHour; hour++) {
    schedule.insertAdjacentHTML('beforeend', `<div class="week-time">${String(hour).padStart(2,'0')}:00</div>`);
    for (let day = 0; day < 7; day++) schedule.insertAdjacentHTML('beforeend', '<div class="week-cell"></div>');
  }
  todos.filter(t => t.date >= monday && t.date <= sunday).forEach(todo => {
    const day = Math.round((new Date(`${todo.date}T00:00:00`) - new Date(`${monday}T00:00:00`))/86400000);
    const start = Math.max(startHour*60, mins(todo.start)), duration = todo.duration || Math.max(1, mins(todo.end)-mins(todo.start));
    const event = document.createElement('button'); event.className = `week-event ${todo.done?'done':''}`; event.style.gridColumn = day + 2;
    event.style.gridRow = `${2 + Math.floor((start-startHour*60)/60)} / span ${Math.max(1, Math.ceil(duration/60))}`; event.innerHTML = `<strong></strong><span>${todo.start} · ${duration}min</span>`; event.querySelector('strong').textContent = todo.title;
    event.onclick = () => { timelineDate = todo.date; document.querySelector('.timeline-card').scrollIntoView({ behavior:'smooth', block:'center' }); renderTimeline(); }; schedule.appendChild(event);
  });
}
function openTodo(date = todayKey(), logMode = false) {
  isLoggingFocus = logMode; document.querySelector('#todoDialog .dialog-head h2').textContent = logMode ? '补记专注' : '新建待办';
  document.querySelector('#todoForm .primary-btn').textContent = logMode ? '保存专注记录' : '加入今天';
  const now = new Date(); $('#todoDate').value = date; $('#todoStart').value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  $('#todoDuration').value = '25'; $('#todoDialog').showModal(); setTimeout(() => $('#todoTitle').focus(), 50);
}
function renderAll() { renderTodos(); renderTimeline(); renderYear(); renderWeek(); }

$('#addTodoBtn').onclick = () => openTodo(); $('#addSelectedTodo').onclick = () => openTodo(selectedDate); $('#closeDialog').onclick = () => $('#todoDialog').close();
$('#todoForm').onsubmit = event => {
  event.preventDefault(); const duration = Number($('#todoDuration').value), endMinutes = mins($('#todoStart').value) + duration;
  const end = `${String(Math.floor(endMinutes / 60) % 24).padStart(2,'0')}:${String(endMinutes % 60).padStart(2,'0')}`;
  todos.push({ id: makeId(), date: $('#todoDate').value, title: $('#todoTitle').value.trim(), start: $('#todoStart').value, end, duration, tag: $('#todoTag').value, done: isLoggingFocus });
  selectedDate = $('#todoDate').value; displayYear = Number(selectedDate.slice(0, 4)); save(); renderAll(); $('#todoForm').reset(); $('#todoDialog').close();
};
$('#prevYear').onclick = () => { if (heatmapMode === 'year') displayYear--; else { displayMonth--; if (displayMonth < 0) { displayMonth = 11; displayYear--; } } renderYear(); };
$('#nextYear').onclick = () => { if (heatmapMode === 'year') displayYear++; else { displayMonth++; if (displayMonth > 11) { displayMonth = 0; displayYear++; } } renderYear(); };
$('#prevWeek').onclick = () => { weekAnchor = shiftKey(weekAnchor, -7); renderWeek(); }; $('#nextWeek').onclick = () => { weekAnchor = shiftKey(weekAnchor, 7); renderWeek(); };
$('#thisWeek').onclick = () => { weekAnchor = todayKey(); renderWeek(); }; $('#logFocus').onclick = () => openTodo(todayKey(), true);
$('#openHeatmap').onclick = () => { const now = new Date(); displayYear = now.getFullYear(); displayMonth = now.getMonth(); heatmapMode = 'month'; selectedDate = todayKey(); renderYear(); $('#heatmapDialog').showModal(); };
$('#toggleHeatmapMode').onclick = () => { heatmapMode = heatmapMode === 'month' ? 'year' : 'month'; renderYear(); };
$('#closeHeatmap').onclick = () => $('#heatmapDialog').close();
$('#prevTimelineDay').onclick = () => { timelineDate = shiftKey(timelineDate, -1); renderTimeline(); };
$('#nextTimelineDay').onclick = () => { timelineDate = shiftKey(timelineDate, 1); renderTimeline(); };
$('#timelineToday').onclick = () => { timelineDate = todayKey(); renderTimeline(); };
$('#clockModeBtn').onclick = () => { if (timerTodoId) stopTimer(); };
$('#timerModeBtn').onclick = () => {};
$('#pauseTimer').onclick = () => {
  if (!timerTodoId) return;
  timerPaused = !timerPaused;
  if (timerPaused) {
    timerRemaining = Math.max(0, Math.ceil((timerEndAt - Date.now()) / 1000));
    if (timerLastResumeAt) timerFocusedSeconds += Math.max(0, Math.floor((Date.now() - timerLastResumeAt) / 1000));
    timerLastResumeAt = 0;
  } else {
    timerEndAt = Date.now() + timerRemaining * 1000; timerLastResumeAt = Date.now();
  }
  $('#pauseTimer').textContent = timerPaused ? '继续' : '暂停'; updateClock();
};
$('#finishTimerEarly').onclick = () => { if (timerTodoId) finishTimer(true); };
$('#abandonTimer').onclick = () => { if (timerTodoId) stopTimer(); };
$('#fullscreenBtn').onclick = () => { if (!document.documentElement.requestFullscreen) return; document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen().catch(() => {}); };
$('#accountBtn').onclick = () => { refreshAccountUI(); showSyncStatus(window.DaymarkCloud?.configured() ? '' : '云同步尚未配置，请先填写 cloud-config.js'); $('#accountDialog').showModal(); };
$('#closeAccount').onclick = () => $('#accountDialog').close();
$('#accountForm').onsubmit = async event => {
  event.preventDefault(); try { showSyncStatus('正在登录…'); await window.DaymarkCloud.signIn($('#accountEmail').value, $('#accountPassword').value); refreshAccountUI(); await syncCloud(); } catch (error) { showSyncStatus(error.message, true); }
};
$('#signupBtn').onclick = async () => {
  try { showSyncStatus('正在注册…'); await window.DaymarkCloud.signUp($('#accountEmail').value, $('#accountPassword').value); refreshAccountUI(); showSyncStatus(window.DaymarkCloud.user() ? '注册成功，正在同步…' : '注册成功，请直接登录'); if (window.DaymarkCloud.user()) await syncCloud(); } catch (error) { showSyncStatus(error.message, true); }
};
$('#syncNowBtn').onclick = () => syncCloud();
$('#logoutBtn').onclick = () => { window.DaymarkCloud.signOut(); refreshAccountUI(); showSyncStatus('已退出，本机数据仍然保留'); };
updateClock(); renderAll(); refreshAccountUI(); if (window.DaymarkCloud?.user()) syncCloud(false); setInterval(updateClock, 1000); setInterval(() => { renderTodos(); renderTimeline(); }, 30000);
setInterval(() => syncCloud(false), 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncCloud(false); });
window.addEventListener('focus', () => syncCloud(false));
