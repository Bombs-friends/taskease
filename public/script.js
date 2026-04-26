const list = document.querySelector('.task-list');
const stats = document.querySelector('.stats');
const form = document.querySelector('#task-form');
const searchBar = document.querySelector('.search-bar');
const pendingList = document.getElementById('pending-list');
const doneList = document.getElementById('done-list');
const modal = document.getElementById('add-modal');
const loginModal = document.getElementById('login-modal');
const signupModal = document.getElementById('signup-modal');
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const userLabel = document.getElementById('user-label');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');

let tasks = [];
let notifiedTasks = {}; // Track which tasks have been notified
let authToken = localStorage.getItem('taskease_token') || null;
let currentUser = JSON.parse(localStorage.getItem('taskease_user') || 'null');

// Small non-modal banner for user-facing messages (replaces alert)
function showBanner(message, type = 'info', timeout = 6000) {
    let existing = document.getElementById('app-banner');
    if (existing) existing.remove();
    const banner = document.createElement('div');
    banner.id = 'app-banner';
    banner.setAttribute('role', 'alert');
    banner.className = 'app-banner ' + type;
    banner.innerText = message;
    Object.assign(banner.style, {
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: type === 'error' ? 'rgba(200,30,30,0.95)' : 'rgba(40,40,40,0.95)',
        color: 'white',
        padding: '0.75rem 1rem',
        borderRadius: '6px',
        zIndex: 9999,
        boxShadow: '0 4px 14px rgba(0,0,0,0.4)'
    });
    document.body.appendChild(banner);
    setTimeout(() => {
        banner.remove();
    }, timeout);
}

function setToken(token, user) {
    authToken = token;
    currentUser = user || null;
    if (token) {
        localStorage.setItem('taskease_token', token);
    } else {
        localStorage.removeItem('taskease_token');
    }
    if (user) localStorage.setItem('taskease_user', JSON.stringify(user)); else localStorage.removeItem('taskease_user');
    updateAuthUI();
}

function clearAuth() {
    setToken(null, null);
}

function getAuthHeaders() {
    const headers = {};
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    return headers;
}

function updateAuthUI() {
    if (authToken && currentUser) {
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        userLabel.innerText = currentUser.username;
        const fab = document.getElementById('fab-add'); if (fab) fab.style.display = 'flex';
    } else {
        loginBtn.style.display = 'inline-block';
        signupBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        userLabel.innerText = '';
        const fab = document.getElementById('fab-add'); if (fab) fab.style.display = 'none';
    }
}

function openLoginModal() {
    if (!loginModal) return;
    loginModal.style.display = 'flex';
    loginModal.setAttribute('aria-hidden', 'false');
    loginModal.querySelector('input, button')?.focus();
}
function closeLoginModal() {
    if (!loginModal) return;
    loginModal.style.display = 'none';
    loginModal.setAttribute('aria-hidden', 'true');
}
function openSignupModal() {
    if (!signupModal) return;
    signupModal.style.display = 'flex';
    signupModal.setAttribute('aria-hidden', 'false');
    signupModal.querySelector('input, button')?.focus();
}
function closeSignupModal() {
    if (!signupModal) return;
    signupModal.style.display = 'none';
    signupModal.setAttribute('aria-hidden', 'true');
}
function openEditModal(task) { /* placeholder, defined later */ }

// Generic modal helpers for accessibility: close on Escape or backdrop click
function setupModal(modalElement) {
    if (!modalElement) return;
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            modalElement.style.display = 'none';
            modalElement.setAttribute('aria-hidden', 'true');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalElement.style.display === 'flex') {
            modalElement.style.display = 'none';
            modalElement.setAttribute('aria-hidden', 'true');
        }
    });
}

setupModal(loginModal);
setupModal(signupModal);
setupModal(editModal);
setupModal(modal);


loginBtn?.addEventListener('click', openLoginModal);
signupBtn?.addEventListener('click', openSignupModal);
logoutBtn?.addEventListener('click', () => { clearAuth(); loadTasks(); });

loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    try {
        const res = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        if (!res.ok) throw new Error('Login failed');
        const data = await res.json();
        setToken(data.token, data.user);
        closeLoginModal();
        loadTasks();
    } catch (err) { showBanner('Login failed: ' + err.message, 'error'); }
});

signupForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value;
    try {
        const res = await fetch('/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Signup failed');
        }
        const data = await res.json();
        setToken(data.token, data.user);
        closeSignupModal();
        loadTasks();
    } catch (err) { showBanner('Signup failed: ' + err.message, 'error'); }
});

updateAuthUI();

// ≡ƒöä Load tasks from server
async function loadTasks() {
    try {
        if (!authToken) {
            tasks = [];
            renderTasks();
            return;
        }
        const res = await fetch('/tasks', { headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()) });
        if (!res.ok) {
            if (res.status === 401) {
                // Session expired or invalid token: clear auth and prompt login
                clearAuth();
                renderTasks();
                showBanner('Session expired or not authenticated. Please log in.', 'error');
                return;
            }
            const text = await res.text().catch(()=>null);
            throw new Error('Failed to load tasks' + (text ? ': ' + text : ''));
        }
        tasks = await res.json();
        checkReminders();
        renderTasks();
    } catch (error) {
        console.error('Error loading tasks:', error);
        if (error.name === 'TypeError') {
            showBanner('Unable to reach server. Check your connection.', 'error');
        } else {
            showBanner('Failed to load tasks: ' + (error.message || 'Unknown error'), 'error');
        }
    }
}

// Check for due date reminders
function checkReminders() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueTasks = tasks.filter(task => {
        if (!task.dueDate) return false;
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today && task.status === 'Pending';
    });
    if (overdueTasks.length > 0) {
        showBanner(`You have ${overdueTasks.length} overdue task(s)! Please check your pending tasks.`, 'info');
    }
}

// Γ₧ò Add task (send to backend)
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = form.title.value.trim();
    if (!title) {
        alert('Title is required');
        return;
    }

    const description = form.description.value.trim();
    const dueDate = form.date.value;
    const dueTime = form.time.value;

    try {
        const res = await fetch('/tasks', {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({ title, description, dueDate, dueTime })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to add task');
        }

        form.reset();
        closeModal();
        loadTasks();
    } catch (error) {
        console.error('Error adding task:', error);
        showBanner('Failed to add task: ' + error.message, 'error');
    }
});

// Γ¥î Delete task (from backend)
async function deleteTask(id) {
    try {
        const res = await fetch(`/tasks/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!res.ok) throw new Error('Failed to delete task');

        loadTasks();
    } catch (error) {
        console.error('Error deleting task:', error);
        showBanner('Failed to delete task: ' + error.message, 'error');
    }
}

// ≡ƒöä Update task status
async function toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === "Pending" ? "Done" : "Pending";

    try {
        const res = await fetch(`/tasks/${id}`, {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()),
            body: JSON.stringify({ status: newStatus })
        });

        if (!res.ok) throw new Error('Failed to update task');

        loadTasks();
    } catch (error) {
        console.error('Error updating task:', error);
        showBanner('Failed to update task: ' + error.message, 'error');
    }
}

// ≡ƒÄ¿ Render tasks
function renderTasks(query = '') {
    const q = query.trim().toLowerCase();
    const filtered = q ? tasks.filter(task =>
        task.title.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q))
    ) : tasks;

    pendingList.innerHTML = '';
    doneList.innerHTML = '';
    const pendingCount = tasks.filter(task => task.status === 'Pending').length;
    stats.innerText = `${pendingCount} pending`;
    document.querySelector('.small-stats') && (document.querySelector('.small-stats').innerText = `${pendingCount} pending`);

    function makeCard(task) {
        const dueClass = getDueClass(task.dueDate, task.dueTime, task.status);
        const formattedDeadline = formatDeadline(task.dueDate, task.dueTime);
        const container = document.createElement('div');
        container.className = 'task-item ' + (task.status === 'Done' ? 'done' : '');
        container.setAttribute('role', 'article');
        container.setAttribute('tabindex', '0');
        container.setAttribute('aria-label', `Task ${task.title}`);

        const main = document.createElement('div');
        main.className = 'task-main';

        const title = document.createElement('div');
        title.className = 'task-title';
        title.innerText = task.title || '(no title)';

        const desc = document.createElement('div');
        desc.className = 'task-desc';
        desc.innerText = task.description || '';

        const meta = document.createElement('div');
        meta.className = 'task-meta';
        const dot = document.createElement('span');
        dot.className = 'status-dot ' + (task.status === 'Done' ? 'status-done' : 'status-pending');
        meta.appendChild(dot);
        const dueSpan = document.createElement('span');
        dueSpan.innerText = formattedDeadline;
        meta.appendChild(dueSpan);

        main.appendChild(title);
        if (desc.innerText) main.appendChild(desc);
        main.appendChild(meta);

        const actions = document.createElement('div');
        actions.className = 'task-actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'card-btn';
        toggleBtn.setAttribute('aria-label', `Toggle status for ${task.title}`);
        toggleBtn.innerText = task.status === 'Pending' ? 'Mark complete' : 'Mark pending';
        toggleBtn.addEventListener('click', () => toggleStatus(task.id, task.status));

        const editBtn = document.createElement('button');
        editBtn.className = 'card-btn';
        editBtn.setAttribute('aria-label', `Edit ${task.title}`);
        editBtn.innerText = 'Edit';
        editBtn.addEventListener('click', () => openEditModal(task));

        const delBtn = document.createElement('button');
        delBtn.className = 'card-btn';
        delBtn.setAttribute('aria-label', `Delete ${task.title}`);
        delBtn.innerText = 'Delete';
        delBtn.addEventListener('click', () => deleteTask(task.id));

        actions.appendChild(toggleBtn);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        container.appendChild(main);
        container.appendChild(actions);
        return container;
    }

    if (filtered.length === 0) {
        // Empty state for pending column
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-state';
        if (!authToken) {
            emptyMsg.innerText = 'Please log in to view your tasks. Use the Log in or Sign up buttons above.';
        } else {
            emptyMsg.innerText = 'No tasks yet. Click + to add one.';
        }
        emptyMsg.style.color = 'var(--text-secondary)';
        emptyMsg.style.padding = '1rem';
        pendingList.appendChild(emptyMsg);

        // Add subtle placeholder cards to avoid empty feeling
        for (let i = 0; i < 2; i++) {
            const sample = { title: i === 0 ? 'Welcome to TaskEase' : 'Try adding your first task', description: i === 0 ? 'Organize tasks with a focused inbox.' : 'Use the + button to create a task', dueDate: null, dueTime: null, status: 'Pending' };
            pendingList.appendChild(makeCard(sample));
        }
    }

    filtered.forEach(task => {
        const el = makeCard(task);
        if (task.status === 'Pending') pendingList.appendChild(el); else doneList.appendChild(el);
    });
}

function openEditModal(task) {
    if (!editModal || !editForm) return;
    editModal.style.display = 'flex';
    editModal.setAttribute('aria-hidden', 'false');
    document.getElementById('edit-id').value = task.id;
    document.getElementById('edit-title-input').value = task.title || '';
    document.getElementById('edit-desc-input').value = task.description || '';
    document.getElementById('edit-date-input').value = task.dueDate || '';
    document.getElementById('edit-time-input').value = task.dueTime || '';
    // focus the first field for keyboard users
    document.getElementById('edit-title-input').focus();
}

function closeEditModal() { if (editModal) { editModal.style.display = 'none'; editModal.setAttribute('aria-hidden','true'); } }

editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const title = document.getElementById('edit-title-input').value.trim();
    const description = document.getElementById('edit-desc-input').value.trim();
    const dueDate = document.getElementById('edit-date-input').value || null;
    const dueTime = document.getElementById('edit-time-input').value || null;
    try {
        const res = await fetch(`/tasks/${id}`, { method: 'PUT', headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()), body: JSON.stringify({ title, description, dueDate, dueTime }) });
        if (!res.ok) {
            const err = await res.json().catch(()=>({error:'Edit failed'}));
            throw new Error(err.error || 'Failed to edit task');
        }
        closeEditModal();
        loadTasks();
    } catch (err) { showBanner('Edit failed: ' + err.message, 'error'); }
});

// Format deadline with date and time
function formatDeadline(dueDate, dueTime) {
    if (!dueDate) return 'No deadline';
    const date = new Date(dueDate).toLocaleDateString();
    if (dueTime) {
        const [hours, minutes] = dueTime.split(':');
        return `${date} at ${hours}:${minutes}`;
    }
    return `${date}`;
}

// Get CSS class based on due date and time
function getDueClass(dueDate, dueTime, status) {
    if (status === 'Done' || !dueDate) return '';
    const now = new Date();
    let deadline = new Date(dueDate);
    if (dueTime) {
        const [hours, minutes] = dueTime.split(':');
        deadline.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
        deadline.setHours(23, 59, 59, 0);
    }
    
    const diffMs = deadline - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    
    if (diffMs < 0) return 'overdue';
    if (diffHours <= 5) return 'due-today';
    if (diffDays <= 3) return 'due-soon';
    return '';
}

// Search functionality
searchBar.addEventListener('input', () => {
    const query = searchBar.value.toLowerCase();
    renderTasks(query);
});

// Modal functions
function openModal() {
    if (!modal) return;
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden','false');
    modal.querySelector('input, button')?.focus();
}

function closeModal() {
    if (!modal) return;
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
}

// Check for upcoming deadline notifications
function checkDeadlineNotifications() {
    const now = new Date();
    tasks.forEach(task => {
        if (task.status === 'Done' || !task.dueDate) return;
        
        let deadline = new Date(task.dueDate);
        if (task.dueTime) {
            const [hours, minutes] = task.dueTime.split(':');
            deadline.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
            deadline.setHours(23, 59, 59, 0);
        }
        
        const diffMs = deadline - now;
        const diffHours = diffMs / (1000 * 60 * 60);
        
        // Notify if deadline is within 5 hours and hasn't been notified yet
        if (diffHours > 0 && diffHours <= 5 && !notifiedTasks[task.id]) {
            const hoursLeft = Math.floor(diffHours);
            const minutesLeft = Math.floor((diffHours % 1) * 60);
            const timeStr = hoursLeft > 0 
                ? `${hoursLeft}h ${minutesLeft}m` 
                : `${minutesLeft}m`;
            alert(`ΓÅ░ Reminder: "${task.title}" is due in ${timeStr}!`);
            notifiedTasks[task.id] = true;
        }
        
        // Reset notification if task is overdue
        if (diffHours < 0 && notifiedTasks[task.id]) {
            delete notifiedTasks[task.id];
        }
    });
}

// ≡ƒÜÇ Load on start
// Verify token on load to avoid stale-token fetch loops
async function verifyTokenOnLoad() {
    if (!authToken) {
        updateAuthUI();
        loadTasks();
        return;
    }

    try {
        const res = await fetch('/auth/verify', { headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeaders()) });
        if (res.ok) {
            const data = await res.json().catch(()=>null);
            // Ensure client user is set (in case token was restored from storage)
            if (data && data.user && !currentUser) setToken(authToken, data.user);
            updateAuthUI();
            loadTasks();
            return;
        }
        if (res.status === 401) {
            clearAuth();
            updateAuthUI();
            renderTasks();
            showBanner('Session expired. Please log in.', 'error');
            return;
        }
        // Other non-OK responses: still attempt to load (may be transient)
        showBanner('Unable to verify session: ' + res.statusText, 'error');
        loadTasks();
    } catch (err) {
        // Network error: show non-blocking banner and attempt to load cached state
        console.error('Error verifying token:', err);
        showBanner('Unable to reach server. Working offline.', 'error');
        loadTasks();
    }
}

verifyTokenOnLoad();

// Check notifications every 5 hours (18000000 milliseconds)
setInterval(checkDeadlineNotifications, 5 * 60 * 60 * 1000);

// Also check on page focus (when user comes back to tab)
window.addEventListener('focus', checkDeadlineNotifications);
