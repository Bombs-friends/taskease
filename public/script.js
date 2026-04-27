const API = 'http://localhost:3000';

async function request(path, method = 'GET', body) {
  const token = localStorage.getItem('token');

  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || 'Error');

  return data;
}

// LOGIN
document.getElementById('loginForm').onsubmit = async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const res = await request('/login', 'POST', Object.fromEntries(form));
  localStorage.setItem('token', res.token);
  document.getElementById('username').textContent = res.user.username;
  loadTasks();
};

// REGISTER
document.getElementById('registerForm').onsubmit = async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const res = await request('/register', 'POST', Object.fromEntries(form));
  localStorage.setItem('token', res.token);
  document.getElementById('username').textContent = res.user.username;
  loadTasks();
};

// TASKS
async function loadTasks() {
  const tasks = await request('/tasks');
  document.getElementById('tasksContainer').innerHTML = tasks.map(t => `
    <div>
      ${t.title}
      <button onclick="deleteTask(${t.id})">X</button>
    </div>
  `).join('');
}

async function addTask() {
  const title = document.getElementById('taskInput').value;
  await request('/tasks', 'POST', { title });
  loadTasks();
}

async function deleteTask(id) {
  await request('/tasks/' + id, 'DELETE');
  loadTasks();
}