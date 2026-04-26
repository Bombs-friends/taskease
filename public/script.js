// TaskEase - Complete Client Script (robust, error-proof)
const API_BASE = ((base = 'http://localhost:3000') => {
  const headers = { 'Content-Type': 'application/json' };
  
  const apiFetch = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    if (token) headers.Authorization = `Bearer ${token}`;
    
    const config = {
      headers: { ...headers, ...options.headers },
      ...options
    };
    
    const url = `${base}${endpoint}`;
    const res = await fetch(url, config);
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({error: 'Network error'}));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    
    return res.ok ? res.json() : null;
  };
  
  return {
    register: (username, password) => apiFetch('/register', { method: 'POST', body: JSON.stringify({username, password}) }),
    login: (username, password) => apiFetch('/login', { method: 'POST', body: JSON.stringify({username, password}) }),
    logout: () => localStorage.removeItem('token'),
    getTasks: () => apiFetch('/tasks'),
    createTask: (task) => apiFetch('/tasks', { method: 'POST', body: JSON.stringify(task) }),
    updateTask: (id, updates) => apiFetch(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
    deleteTask: (id) => apiFetch(`/tasks/${id}`, { method: 'DELETE' })
  };
})();

// DOM Elements
const els = {
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginModal: document.getElementById('loginModal'),
  registerModal: document.getElementById('registerModal'),
  tasksContainer: document.getElementById('tasksContainer'),
  addTaskBtn: document.getElementById('addTaskBtn'),
  userInfo: document.getElementById('userInfo')
};

// Modal handlers
function showModal(modalId) {
  [els.loginModal, els.registerModal].forEach(m => m.classList.remove('show'));
  document.getElementById(modalId).classList.add('show');
}

function hideModal() {
  [els.loginModal, els.registerModal].forEach(m => m.classList.remove('show'));
}

// Auth handlers
async function handleLogin(e) {
  e.preventDefault();
  try {
    const formData = new FormData(els.loginForm);
    const { username, password } = Object.fromEntries(formData);
    
    const { token, user } = await API_BASE.login(username, password);
    localStorage.setItem('token', token);
    document.getElementById('username').textContent = user.username;
    hideModal();
    loadTasks();
  } catch (err) {
    alert(`Login failed: ${err.message}`);
  }
}

async function handleRegister(e) {
  e.preventDefault();
  try {
    const formData = new FormData(els.registerForm);
    const { username, password } = Object.fromEntries(formData);
    
    const { token, user } = await API_BASE.register(username, password);
    localStorage.setItem('token', token);
    document.getElementById('username').textContent = user.username;
    hideModal();
    loadTasks();
  } catch (err) {
    alert(`Register failed: ${err.message}`);
  }
}

function handleLogout() {
  API_BASE.logout();
  document.getElementById('username').textContent = '';
  els.tasksContainer.innerHTML = '';
}

// Tasks CRUD
async function loadTasks() {
  try {
    const tasks = await API_BASE.getTasks();
    renderTasks(tasks);
  } catch (err) {
    console.error('Load tasks failed:', err);
  }
}

function renderTasks(tasks) {
  els.tasksContainer.innerHTML = tasks.map(task => `
    <div class="task-card" data-id="${task.id}">
      <h3>${task.title}</h3>
      ${task.description ? `<p>${task.description}</p>` : ''}
      ${task.dueDate ? `<small>Due: ${new Date(task.dueDate).toLocaleDateString()}</small>` : ''}
      <label>
        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTask(${task.id}, this.checked)">
        Done
      </label>
      <div class="task-actions">
        <button onclick="editTask(${task.id})">Edit</button>
        <button onclick="deleteTask(${task.id})" class="delete">Delete</button>
      </div>
    </div>
  `).join('');
}

async function createTask(title, description = '', dueDate = '') {
  try {
    const task = await API_BASE.createTask({ title, description, dueDate });
    loadTasks(); // Refresh
  } catch (err) {
    alert(`Create failed: ${err.message}`);
  }
}

async function toggleTask(id, completed) {
  try {
    await API_BASE.updateTask(id, { completed });
    loadTasks();
  } catch (err) {
    console.error('Toggle failed:', err);
  }
}

async function deleteTask(id) {
  if (!confirm('Delete task?')) return;
  try {
    await API_BASE.deleteTask(id);
    loadTasks();
  } catch (err) {
    alert(`Delete failed: ${err.message}`);
  }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  els.loginForm.onsubmit = handleLogin;
  els.registerForm.onsubmit = handleRegister;
  document.getElementById('logoutBtn')?.onclick = handleLogout;
  document.getElementById('showRegister')?.onclick = () => showModal('registerModal');
  document.getElementById('showLogin')?.onclick = () => showModal('loginModal');
  document.querySelectorAll('.close').forEach(btn => btn.onclick = hideModal);
  
  // Check auth on load
  const token = localStorage.getItem('token');
  if (token) loadTasks();
});
