const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = 'taskease_secret';
let users = [{id:1, username:'test', passwordHash:bcrypt.hashSync('password',10)}];
let userIdCounter = 2;
let tasks = [];
let idCounter = 1;

// Dev user: username='test', password='password' 
users = [{id:1, username:'test', passwordHash:bcrypt.hashSync('password',10)}];
userIdCounter = 2;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Register
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({error:'Missing credentials'});
  
  const existing = users.find(u => u.username === username);
  if (existing) return res.status(400).json({error:'User exists'});
  
  const passwordHash = bcrypt.hashSync(password, 10);
  const newUser = { id: userIdCounter++, username, passwordHash };
  users.push(newUser);
  
  const token = jwt.sign({ userId: newUser.id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: newUser.id, username } });
});

// Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({error:'Missing credentials'});
  
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({error:'Login failed'});
  }
  
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

// Tasks CRUD
app.get('/tasks', authenticateToken, (req, res) => {
  res.json(tasks);
});

app.post('/tasks', authenticateToken, (req, res) => {
  const { title, description, dueDate } = req.body;
  const task = { id: idCounter++, title, description, dueDate, completed: false, userId: req.user.userId };
  tasks.push(task);
  res.status(201).json(task);
});

app.put('/tasks/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const task = tasks.find(t => t.id === id && t.userId === req.user.userId);
  if (!task) return res.status(404).json({error:'Task not found'});
  
  Object.assign(task, req.body);
  res.json(task);
});

app.delete('/tasks/:id', authenticateToken, (req, res) => {
  const id = parseInt(req.params.id);
  const index = tasks.findIndex(t => t.id === id && t.userId === req.user.userId);
  if (index === -1) return res.status(404).json({error:'Task not found'});
  
  tasks.splice(index, 1);
  res.status(204).send();
});

function authenticateToken(req, res, next) {
  const auth = req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({error:'Unauthorized'});
  try {
    const token = auth.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({error:'Invalid token'});
  }
}

const handler = (req, res) => {
  app(req, res);
};

module.exports = handler;
