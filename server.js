const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from public using absolute path
app.use(express.static(path.join(__dirname, 'public')));

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// In-memory stores (for demo only). Recommend persistent DB for production.
// Persistent simple JSON storage (for demo). Structure: { users:[], userIdCounter, tasks:[], idCounter }
let users = [];
let userIdCounter = 1;
let tasks = [];
let idCounter = 1;

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const obj = JSON.parse(raw);
            users = obj.users || [];
            userIdCounter = obj.userIdCounter || (users.length ? Math.max(...users.map(u=>u.id))+1 : 1);
            tasks = obj.tasks || [];
            idCounter = obj.idCounter || (tasks.length ? Math.max(...tasks.map(t=>t.id))+1 : 1);
        } else {
            saveData();
        }
    } catch (err) {
        console.error('Failed to load data.json', err);
    }
}

function saveData() {
    try {
        const obj = { users, userIdCounter, tasks, idCounter };
        fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to save data.json', err);
    }
}

loadData();

function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' });
    const token = parts[1];
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = { id: payload.id, username: payload.username };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Auth endpoints
app.post('/auth/signup', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'username already exists' });
    const passwordHash = bcrypt.hashSync(password, 10);
    const user = { id: userIdCounter++, username, passwordHash };
    users.push(user);
    saveData();
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username } });
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = bcrypt.compareSync(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = generateToken(user);
    res.json({ token, user: { id: user.id, username: user.username } });
});

// Verify token endpoint: simple check for client-side validation
app.get('/auth/verify', authenticateToken, (req, res) => {
    res.json({ ok: true, user: { id: req.user.id, username: req.user.username } });
});

// Protected task routes
app.get('/tasks', authenticateToken, (req, res) => {
    const userTasks = tasks.filter(t => t.userId === req.user.id);
    res.json(userTasks);
});

app.post('/tasks', authenticateToken, (req, res) => {
    if (!req.body.title || typeof req.body.title !== 'string' || req.body.title.trim() === '') {
        return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    }
    const task = {
        id: idCounter++,
        userId: req.user.id,
        title: req.body.title.trim(),
        description: req.body.description ? req.body.description.trim() : '',
        dueDate: req.body.dueDate || null,
        dueTime: req.body.dueTime || null,
        status: 'Pending'
    };
    tasks.push(task);
    saveData();
    res.status(201).json(task);
});

app.delete('/tasks/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send('Invalid ID');
    const task = tasks.find(t => t.id === id && t.userId === req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found or access denied' });
    tasks = tasks.filter(t => !(t.id === id && t.userId === req.user.id));
    saveData();
    res.status(204).send();
});

app.put('/tasks/:id', authenticateToken, (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).send('Invalid ID');
    const task = tasks.find(t => t.id === id && t.userId === req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found or access denied' });
    if (req.body.status && ['Pending', 'Done'].includes(req.body.status)) {
        task.status = req.body.status;
    }
    if (req.body.title) task.title = String(req.body.title).trim();
    if (req.body.description !== undefined) task.description = String(req.body.description).trim();
    if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate;
    if (req.body.dueTime !== undefined) task.dueTime = req.body.dueTime;
    saveData();
    res.json(task);
});

// Export for Vercel serverless

// Fallback: serve index.html for any other route (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;

// Start server only when running directly (not when imported by Vercel)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

// Generic error handler (JSON)
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error' });
});
