const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'taskease_secret';

let users = [
  { id: 1, username: 'test', passwordHash: bcrypt.hashSync('password', 10) }
];

let userIdCounter = 2;
let tasks = [];
let idCounter = 1;

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// REGISTER
app.post('/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'Missing credentials' });

  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'User exists' });

  const newUser = {
    id: userIdCounter++,
    username,
    passwordHash: bcrypt.hashSync(password, 10)
  };

  users.push(newUser);

  const token = jwt.sign({ userId: newUser.id }, JWT_SECRET);

  res.json({ token, user: { id: newUser.id, username } });
});

// LOGIN
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const user = users.find(u => u.username === username);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET);

  res.json({ token, user: { id: user.id, username: user.username } });
});

// AUTH
function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// TASKS
app.get('/tasks', auth, (req, res) => {
  res.json(tasks.filter(t => t.userId === req.user.userId));
});

app.post('/tasks', auth, (req, res) => {
  const task = {
    id: idCounter++,
    title: req.body.title,
    completed: false,
    userId: req.user.userId
  };

  tasks.push(task);
  res.json(task);
});

app.delete('/tasks/:id', auth, (req, res) => {
  tasks = tasks.filter(t => t.id != req.params.id);
  res.sendStatus(204);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
