// TaskEase - client script (clean, robust)
// Uses API_BASE meta tag (optional) to target external backend. Defaults to same origin.

const API_BASE = (function(){
    try {
        const m = document.querySelector('meta[name="api-base"]');
        if (m && m.content) return m.content.replace(/\/+$/,'');
        if (window.__API_BASE__) return window.__API_BASE__.replace(/\/+$/,'');
    } catch(e) {}
    return '';
})();

console.log('Client API_BASE:', API_BASE || window.location.origin || '');

// Elements
const mainEl = document.querySelector('main');
const pendingList = document.getElementById('pending-list');
const doneList = document.getElementById('done-list');
const statsEl = document.querySelector('.small-stats');
const fab = document.getElementById('fab-add');
const loginModal = document.getElementById('login-modal');
const editModal = document.getElementById('edit-modal');
const addModal = document.getElementById('add-modal');
const loginForm = document.getElementById('login-form');
const editForm = document.getElementById('edit-form');
const addForm = document.getElementById('task-form');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userLabel = document.getElementById('user-label');
const socialGoogleBtn = document.getElementById('social-google');
const socialFacebookBtn = document.getElementById('social-facebook');

let tasks = [];
let notifiedTasks = {};
let authToken = localStorage.getItem('taskease_token') || null;
let currentUser = JSON.parse(localStorage.getItem('taskease_user') || 'null');

// non-modal banner
function showBanner(msg, type='info', timeout=6000){
    const existing = document.getElementById('app-banner');
    if (existing) existing.remove();
    const b = document.createElement('div');
    b.id='app-banner';
    b.setAttribute('role','status');
    b.className = 'app-banner ' + type;
    b.innerText = msg;
    Object.assign(b.style, {
        position: 'fixed', top: '1rem', left: '50%', transform: 'translateX(-50%)',
        background: type==='error' ? 'rgba(200,30,30,0.95)' : 'rgba(40,40,40,0.95)',
        color: 'white', padding: '0.75rem 1rem', borderRadius: '8px', zIndex: 9999
    });
    document.body.appendChild(b);
    setTimeout(()=>{ b.remove(); }, timeout);
}

function setToken(token, user){
    authToken = token;
    currentUser = user || null;
    if (token) localStorage.setItem('taskease_token', token); else localStorage.removeItem('taskease_token');
    if (user) localStorage.setItem('taskease_user', JSON.stringify(user)); else localStorage.removeItem('taskease_user');
    updateAuthUI();
}
function clearAuth(){ setToken(null, null); }
function getAuthHeaders(){ const h={}; if (authToken) h['Authorization'] = `Bearer ${authToken}`; return h; }

function updateAuthUI(){
    if (authToken && currentUser){
        if (loginBtn) loginBtn.style.display='none';
        if (logoutBtn) logoutBtn.style.display='inline-block';
        if (userLabel) userLabel.innerText = currentUser.username;
        if (fab) fab.style.display = 'flex';
        if (mainEl) mainEl.style.display = '';
    } else {
        if (loginBtn) loginBtn.style.display='inline-block';
        if (logoutBtn) logoutBtn.style.display='none';
        if (userLabel) userLabel.innerText = '';
        if (fab) fab.style.display = 'none';
        if (mainEl) mainEl.style.display = 'none';
    }
}

// Modal helpers
function openModal(el){ if (!el) return; el.style.display='flex'; el.setAttribute('aria-hidden','false'); el.querySelector('input,button')?.focus(); }
function closeModal(el){ if (!el) return; el.style.display='none'; el.setAttribute('aria-hidden','true'); }

function setupModal(el){ if(!el) return; el.addEventListener('click', e=>{ if (e.target===el) closeModal(el); }); document.addEventListener('keydown', e=>{ if (e.key==='Escape' && el.style.display==='flex') closeModal(el); }); }
setupModal(loginModal); setupModal(editModal); setupModal(addModal);

// Ensure modals are closed on load
if (loginModal) closeModal(loginModal); if (editModal) closeModal(editModal); if (addModal) closeModal(addModal);

// Event bindings
loginBtn?.addEventListener('click', ()=>{ openModal(loginModal); });
logoutBtn?.addEventListener('click', ()=>{ clearAuth(); updateAuthUI(); openModal(loginModal); showBanner('Logged out', 'info'); });
if (fab) fab.addEventListener('click', ()=>{ if (!authToken) { showBanner('Please log in to add tasks', 'error'); openModal(loginModal); return; } openModal(addModal); });

// Social placeholders: redirect to backend oauth endpoints if available
socialGoogleBtn?.addEventListener('click', ()=>{
    if (!API_BASE) { showBanner('OAuth not configured. Set backend API URL.', 'error'); return; }
    // Redirect user to backend OAuth route (server must implement)
    window.location.href = API_BASE + '/auth/google';
});
socialFacebookBtn?.addEventListener('click', ()=>{
    if (!API_BASE) { showBanner('OAuth not configured. Set backend API URL.', 'error'); return; }
    window.location.href = API_BASE + '/auth/facebook';
});

// Login form
loginForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const username = (document.getElementById('login-username')?.value || '').trim();
    const password = (document.getElementById('login-password')?.value || '');
    try {
        const url = (API_BASE || '') + '/auth/login';
        console.log('Logging in to', url, 'username=', username);
        const res = await fetch(url, { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ username, password }) });
        if (!res.ok) {
            const errBody = await res.json().catch(()=>null);
            const msg = errBody && errBody.error ? errBody.error : `Login failed (${res.status})`;
            throw new Error(msg);
        }
        const data = await res.json();
        setToken(data.token, data.user);
        closeModal(loginModal);
        await loadTasks();
        showBanner('Welcome back, ' + data.user.username, 'info');
    } catch(err){ console.error(err); showBanner('Login failed: ' + err.message, 'error'); }
});

// Add task
addForm?.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const title = (addForm.title?.value || '').trim();
    if (!title) { showBanner('Title required', 'error'); return; }
    const description = addForm.description?.value || '';
    const dueDate = addForm.date?.value || null;
    const dueTime = addForm.time?.value || null;
    try {
        const res = await fetch(API_BASE + '/tasks', { method: 'POST', headers: Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders()), body: JSON.stringify({ title, description, dueDate, dueTime }) });
        if (!res.ok) { const err = await res.json().catch(()=>({error:'failed'})); throw new Error(err.error||'Failed to add task'); }
        addForm.reset(); closeModal(addModal); await loadTasks(); showBanner('Task added', 'info');
    } catch(err){ console.error(err); showBanner('Failed to add task: '+err.message, 'error'); }
});

// Edit task
function openEditModal(task){ if (!editModal) return; document.getElementById('edit-id').value = task.id; document.getElementById('edit-title-input').value = task.title || ''; document.getElementById('edit-desc-input').value = task.description || ''; document.getElementById('edit-date-input').value = task.dueDate || ''; document.getElementById('edit-time-input').value = task.dueTime || ''; openModal(editModal); }
function closeEditModal(){ if (!editModal) return; document.getElementById('edit-id').value=''; document.getElementById('edit-title-input').value=''; document.getElementById('edit-desc-input').value=''; document.getElementById('edit-date-input').value=''; document.getElementById('edit-time-input').value=''; closeModal(editModal); }
editForm?.addEventListener('submit', async (e)=>{ e.preventDefault(); const id = document.getElementById('edit-id').value; const title = (document.getElementById('edit-title-input').value||'').trim(); const description = document.getElementById('edit-desc-input').value||''; const dueDate = document.getElementById('edit-date-input').value || null; const dueTime = document.getElementById('edit-time-input').value || null; try{ const res = await fetch(API_BASE + `/tasks/${id}`, { method:'PUT', headers: Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders()), body: JSON.stringify({ title, description, dueDate, dueTime }) }); if (!res.ok) { const err = await res.json().catch(()=>({error:'failed'})); throw new Error(err.error||'Failed to edit'); } closeEditModal(); await loadTasks(); showBanner('Task updated', 'info'); }catch(err){ console.error(err); showBanner('Edit failed: '+err.message,'error'); } });

async function deleteTask(id){ try{ const res = await fetch(API_BASE + `/tasks/${id}`, { method:'DELETE', headers: getAuthHeaders() }); if (!res.ok) { const txt = await res.text().catch(()=>null); throw new Error(txt||'Failed to delete'); } await loadTasks(); showBanner('Task deleted', 'info'); } catch(err){ console.error(err); showBanner('Failed to delete: '+err.message,'error'); } }

async function toggleStatus(id, currentStatus){ try{ const newStatus = currentStatus==='Pending'?'Done':'Pending'; const res = await fetch(API_BASE + `/tasks/${id}`, { method:'PUT', headers: Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders()), body: JSON.stringify({ status: newStatus }) }); if (!res.ok) throw new Error('Failed to update'); await loadTasks(); }catch(err){ console.error(err); showBanner('Failed to update: '+err.message,'error'); } }

function formatDeadline(dueDate, dueTime){ if (!dueDate) return 'No deadline'; const date = new Date(dueDate).toLocaleDateString(); if (dueTime){ const [h,m]=dueTime.split(':'); return `${date} at ${h}:${m}`; } return date; }
function getDueClass(dueDate, dueTime, status){ if (status==='Done' || !dueDate) return ''; const now=new Date(); let deadline = new Date(dueDate); if (dueTime){ const [h,m]=dueTime.split(':'); deadline.setHours(parseInt(h), parseInt(m),0,0); } else deadline.setHours(23,59,59,0); const diffMs = deadline - now; const diffHours = diffMs / (1000*60*60); const diffDays = diffMs / (1000*60*60*24); if (diffMs < 0) return 'overdue'; if (diffHours <= 5) return 'due-today'; if (diffDays <= 3) return 'due-soon'; return ''; }

function renderTasks(query=''){
    const q = (query||'').trim().toLowerCase(); const filtered = q? tasks.filter(t=> (t.title||'').toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q)) : tasks;
    pendingList.innerHTML=''; doneList.innerHTML=''; const pendingCount = tasks.filter(t=>t.status==='Pending').length; if (statsEl) statsEl.innerText = `${pendingCount} pending`; const smallStats = document.querySelector('.small-stats'); if (smallStats) smallStats.innerText = `${pendingCount} pending`;
    if (filtered.length===0){ const emptyMsg = document.createElement('div'); emptyMsg.className='empty-state'; if (!authToken) emptyMsg.innerText='Please log in to view your tasks.'; else emptyMsg.innerText='No tasks yet. Click + to add.'; emptyMsg.style.padding='1rem'; emptyMsg.style.color='var(--text-secondary)'; pendingList.appendChild(emptyMsg); for (let i=0;i<2;i++){ const sample = { title: i===0? 'Welcome to TaskEase':'Try adding your first task', description: i===0? 'Organize tasks with a focused inbox.':'Use the + button to create a task', dueDate:null, dueTime:null, status:'Pending' }; pendingList.appendChild(makeCard(sample)); } }
    filtered.forEach(task=>{ const el = makeCard(task); if (task.status==='Pending') pendingList.appendChild(el); else doneList.appendChild(el); });
}
function makeCard(task){ const dueClass = getDueClass(task.dueDate, task.dueTime, task.status); const formattedDeadline = formatDeadline(task.dueDate, task.dueTime); const container = document.createElement('div'); container.className = 'task-item ' + (task.status==='Done'?'done ':'') + dueClass; container.setAttribute('role','article'); container.setAttribute('tabindex','0'); container.setAttribute('aria-label', `Task ${task.title}`);
    const main = document.createElement('div'); main.className='task-main'; const title = document.createElement('div'); title.className='task-title'; title.innerText = task.title || '(no title)'; const desc = document.createElement('div'); desc.className='task-desc'; desc.innerText = task.description || ''; const meta = document.createElement('div'); meta.className='task-meta'; const dot = document.createElement('span'); dot.className = 'status-dot ' + (task.status==='Done'?'status-done':'status-pending'); meta.appendChild(dot); const dueSpan = document.createElement('span'); dueSpan.innerText = formattedDeadline; meta.appendChild(dueSpan); main.appendChild(title); if (desc.innerText) main.appendChild(desc); main.appendChild(meta);
    const actions = document.createElement('div'); actions.className='task-actions'; const toggleBtn = document.createElement('button'); toggleBtn.className='card-btn'; toggleBtn.setAttribute('aria-label', `Toggle status for ${task.title}`); toggleBtn.innerText = task.status==='Pending'?'Mark complete':'Mark pending'; toggleBtn.addEventListener('click', ()=>toggleStatus(task.id, task.status)); const editBtn = document.createElement('button'); editBtn.className='card-btn'; editBtn.setAttribute('aria-label', `Edit ${task.title}`); editBtn.innerText='Edit'; editBtn.addEventListener('click', ()=> openEditModal(task)); const delBtn = document.createElement('button'); delBtn.className='card-btn'; delBtn.setAttribute('aria-label', `Delete ${task.title}`); delBtn.innerText='Delete'; delBtn.addEventListener('click', ()=> deleteTask(task.id)); actions.appendChild(toggleBtn); actions.appendChild(editBtn); actions.appendChild(delBtn);
    container.appendChild(main); container.appendChild(actions); return container; }

// Reminders
function checkReminders(){ const today = new Date(); today.setHours(0,0,0,0); const overdueTasks = tasks.filter(t=> t.dueDate && new Date(t.dueDate).setHours(0,0,0,0) < today && t.status==='Pending'); if (overdueTasks.length>0) showBanner(`You have ${overdueTasks.length} overdue task(s)!`, 'info'); }
setInterval(checkReminders, 5*60*60*1000); window.addEventListener('focus', checkReminders);

// Load tasks
async function loadTasks(){ try{ if (!authToken){ tasks=[]; renderTasks(); return; } const res = await fetch(API_BASE + '/tasks', { headers: Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders()) }); if (!res.ok){ if (res.status===401){ clearAuth(); updateAuthUI(); openModal(loginModal); showBanner('Session expired. Please log in.', 'error'); return; } const t = await res.text().catch(()=>null); throw new Error('Failed to load tasks' + (t?': '+t:'')); } tasks = await res.json(); checkReminders(); renderTasks(); }catch(err){ console.error('Error loading tasks', err); showBanner('Unable to reach server. Check your connection.', 'error'); } }

// Verify token on load (also accepts token in URL fragment `#token=...&user=...`)
async function verifyTokenOnLoad(){
    // If token supplied in URL fragment (OAuth redirect), capture it and clean the URL
    try {
        const hash = window.location.hash.replace(/^#/, '');
        if (hash) {
            const params = new URLSearchParams(hash);
            const t = params.get('token');
            const u = params.get('user');
            if (t) {
                setToken(t, u ? { username: decodeURIComponent(u) } : null);
                // remove token from URL for cleanliness
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        }
    } catch (e) { /* ignore */ }

    if (!authToken) {
        updateAuthUI();
        // show only login UI when not authenticated
        openModal(loginModal);
        return;
    }

    try {
        const res = await fetch(API_BASE + '/auth/verify', { headers: Object.assign({ 'Content-Type':'application/json' }, getAuthHeaders()) });
        if (res.ok) {
            const data = await res.json().catch(()=>null);
            if (data && data.user && !currentUser) setToken(authToken, data.user);
            updateAuthUI();
            await loadTasks();
            return;
        }
        if (res.status === 401) {
            clearAuth();
            updateAuthUI();
            openModal(loginModal);
            showBanner('Session expired. Please log in.', 'error');
            return;
        }
        showBanner('Unable to verify session: ' + res.statusText, 'error');
        openModal(loginModal);
    } catch (err) {
        console.error('verify error', err);
        showBanner('Unable to reach server. Working offline.', 'error');
        openModal(loginModal);
    }
}

// Init
updateAuthUI(); verifyTokenOnLoad();

// Expose for debugging
window.__taskease = { loadTasks, setToken, clearAuth };
