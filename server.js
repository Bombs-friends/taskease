const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const fs = require('fs');
const passport = require('passport');
let GoogleStrategy, FacebookStrategy;
try { GoogleStrategy = require('passport-google-oauth20').Strategy; } catch(e) {}
try { FacebookStrategy = require('passport-facebook').Strategy; } catch(e) {}
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Serve static files from public using absolute path
app.use(express.static(path.join(__dirname, 'public')));

// Simple CORS handling: allow frontend origin if provided, otherwise allow all in development
app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowed = process.env.FRONTEND_BASE || process.env.ALLOWED_ORIGIN || '';
    if (allowed) {
        // allow configured origin
        res.setHeader('Access-Control-Allow-Origin', allowed);
    } else if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';

// Optional MongoDB integration: if MONGODB_URI provided, use mongoose models instead of data.json
let useMongo = false;
let mongoose;
let UserModel, TaskModel;
if (process.env.MONGODB_URI) {
    try {
        mongoose = require('mongoose');
        useMongo = true;
        mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true }).then(()=>{
            console.log('Connected to MongoDB');
        }).catch(err=>{
            console.error('MongoDB connection error', err);
            useMongo = false;
        });

        const userSchema = new mongoose.Schema({ username: { type: String, unique: true }, passwordHash: String, provider: String, providerId: String, email: String }, { timestamps: true });
        const taskSchema = new mongoose.Schema({ userId: String, title: String, description: String, dueDate: String, dueTime: String, status: String }, { timestamps: true });
        UserModel = mongoose.model('User', userSchema);
        TaskModel = mongoose.model('Task', taskSchema);
    } catch (err) {
        console.error('Failed to initialize mongoose, falling back to file store', err);
        useMongo = false;
    }
}

// Initialize passport strategies if env vars provided
const BACKEND_BASE = process.env.BACKEND_BASE || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
const FRONTEND_BASE = process.env.FRONTEND_BASE || '';
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && GoogleStrategy) {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: (process.env.OAUTH_CALLBACK_BASE || BACKEND_BASE) + '/auth/google/callback'
    }, async (accessToken, refreshToken, profile, cb) => {
        try {
            const email = profile.emails && profile.emails[0] && profile.emails[0].value;
            const providerId = profile.id;
            if (useMongo) {
                let user = await UserModel.findOne({ provider: 'google', providerId });
                if (!user && email) user = await UserModel.findOne({ email });
                if (!user) user = await UserModel.create({ username: email || `google_${providerId}`, provider: 'google', providerId, email });
                return cb(null, { id: user._id.toString(), username: user.username });
            }
            let user = users.find(u => u.provider === 'google' && u.providerId === providerId) || users.find(u => u.username === email);
            if (!user) {
                user = { id: userIdCounter++, username: email || `google_${providerId}`, provider: 'google', providerId, email };
                users.push(user); saveData();
            }
            return cb(null, { id: user.id, username: user.username });
        } catch (err) { console.error('Google strategy error', err); return cb(err); }
    }));
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET && FacebookStrategy) {
    passport.use(new FacebookStrategy({
        clientID: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        callbackURL: (process.env.OAUTH_CALLBACK_BASE || BACKEND_BASE) + '/auth/facebook/callback',
        profileFields: ['id','emails','name']
    }, async (accessToken, refreshToken, profile, cb) => {
        try {
            const email = profile.emails && profile.emails[0] && profile.emails[0].value;
            const providerId = profile.id;
            if (useMongo) {
                let user = await UserModel.findOne({ provider: 'facebook', providerId });
                if (!user && email) user = await UserModel.findOne({ email });
                if (!user) user = await UserModel.create({ username: email || `fb_${providerId}`, provider: 'facebook', providerId, email });
                return cb(null, { id: user._id.toString(), username: user.username });
            }
            let user = users.find(u => u.provider === 'facebook' && u.providerId === providerId) || users.find(u => u.username === email);
            if (!user) {
                user = { id: userIdCounter++, username: email || `fb_${providerId}`, provider: 'facebook', providerId, email };
                users.push(user); saveData();
            }
            return cb(null, { id: user.id, username: user.username });
        } catch (err) { console.error('Facebook strategy error', err); return cb(err); }
    }));
}

app.use(passport.initialize());

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

// Dev: if no users exist and we're in development, seed a test user to help debugging/login
if (!useMongo && process.env.NODE_ENV !== 'production') {
    try {
        if (users.length === 0) {
            const pw = 'password';
            const passwordHash = bcrypt.hashSync(pw, 10);
            const user = { id: userIdCounter++, username: 'test', passwordHash };
            users.push(user);
            saveData();
            console.log('Seeded dev user: username="test" password="password"');
        }
    } catch (err) { console.error('Failed to seed dev user', err); }
}

if (useMongo && process.env.NODE_ENV !== 'production') {
    // ensure at least one user exists in Mongo for testing
    (async () => {
        try {
            const count = await UserModel.countDocuments();
            if (count === 0) {
                const pw = 'password';
                const passwordHash = bcrypt.hashSync(pw, 10);
                await UserModel.create({ username: 'test', passwordHash });
                console.log('Seeded Mongo dev user: username="test" password="password"');
            }
        } catch (err) { console.error('Mongo seed failed', err); }
    })();
}

function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticateToken(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth) return res.status(401).json({ error: 'Missing Authorization header' });
    const parts = auth.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return res.status(401).json({ error: 'Invalid Authorization format' });
    const token = parts[1];
    // Attempt verification against candidate secrets to tolerate env differences in serverless
    const candidates = [];
    if (process.env.JWT_SECRET) candidates.push(process.env.JWT_SECRET);
    if (JWT_SECRET && !candidates.includes(JWT_SECRET)) candidates.push(JWT_SECRET);
    // Always include the dev fallback as last resort
    if (!candidates.includes('dev_secret_change_me')) candidates.push('dev_secret_change_me');

    let lastErr = null;
    for (const secret of candidates) {
        try {
            const payload = jwt.verify(token, secret);
            req.user = { id: payload.id, username: payload.username };
            return next();
        } catch (err) {
            lastErr = err;
            // try next candidate
        }
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
}

// Auth endpoints
// Programmatic signup removed to enforce OAuth/admin-only account creation.
app.post('/auth/signup', (req, res) => {
    console.warn('Signup attempt blocked: programmatic signup removed');
    return res.status(404).json({ error: 'Not found' });
});

app.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    // Log attempt (do NOT log password)
    console.log(`Login attempt for username=${username} from ${req.ip}`);
    if (useMongo) {
        return UserModel.findOne({ username }).then(user => {
            if (!user) {
                console.warn(`Login failed - user not found: ${username}`);
                const msg = process.env.NODE_ENV === 'production' ? 'invalid credentials' : 'user not found';
                return res.status(401).json({ error: msg });
            }
            const ok = bcrypt.compareSync(password, user.passwordHash);
            if (!ok) {
                console.warn(`Login failed - wrong password for user: ${username}`);
                const msg = process.env.NODE_ENV === 'production' ? 'invalid credentials' : 'wrong password';
                return res.status(401).json({ error: msg });
            }
            const token = generateToken({ id: user._id.toString(), username: user.username });
            return res.json({ token, user: { id: user._id.toString(), username: user.username } });
        }).catch(err => { console.error('Login error (mongo):', err); return res.status(500).json({ error: 'Server error' }); });
    }
    const user = users.find(u => u.username === username);
    if (!user) {
        console.warn(`Login failed - user not found: ${username}`);
        const msg = process.env.NODE_ENV === 'production' ? 'invalid credentials' : 'user not found';
        return res.status(401).json({ error: msg });
    }
    try {
        const ok = bcrypt.compareSync(password, user.passwordHash);
        if (!ok) {
            console.warn(`Login failed - wrong password for user: ${username}`);
            const msg = process.env.NODE_ENV === 'production' ? 'invalid credentials' : 'wrong password';
            return res.status(401).json({ error: msg });
        }
        const token = generateToken(user);
        res.json({ token, user: { id: user.id, username: user.username } });
    } catch (err) {
        console.error('Login error (file-store):', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// Verify token endpoint: simple check for client-side validation
app.get('/auth/verify', authenticateToken, (req, res) => {
    res.json({ ok: true, user: { id: req.user.id, username: req.user.username } });
});

// OAuth routes (redirects back to frontend with token in fragment)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && GoogleStrategy) {
    app.get('/auth/google', passport.authenticate('google', { scope: ['profile','email'], session: false }));
    app.get('/auth/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/' }), (req, res) => {
        try {
            const token = generateToken(req.user);
            const dest = (process.env.FRONTEND_BASE || FRONTEND_BASE || '/') + `#token=${token}&user=${encodeURIComponent(req.user.username)}`;
            res.redirect(dest);
        } catch (err) {
            console.error('OAuth redirect error', err);
            res.redirect('/');
        }
    });
}

if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET && FacebookStrategy) {
    app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));
    app.get('/auth/facebook/callback', passport.authenticate('facebook', { session: false, failureRedirect: '/' }), (req, res) => {
        try {
            const token = generateToken(req.user);
            const dest = (process.env.FRONTEND_BASE || FRONTEND_BASE || '/') + `#token=${token}&user=${encodeURIComponent(req.user.username)}`;
            res.redirect(dest);
        } catch (err) {
            console.error('OAuth redirect error', err);
            res.redirect('/');
        }
    });
}

// Protected task routes
app.get('/tasks', authenticateToken, (req, res) => {
    if (useMongo) {
        return TaskModel.find({ userId: req.user.id }).then(arr => res.json(arr)).catch(err => { console.error(err); res.status(500).json({ error: 'Server error' }); });
    }
    const userTasks = tasks.filter(t => t.userId === req.user.id);
    res.json(userTasks);
});

app.post('/tasks', authenticateToken, (req, res) => {
    if (!req.body.title || typeof req.body.title !== 'string' || req.body.title.trim() === '') {
        return res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    }
    const taskPayload = {
        userId: req.user.id,
        title: req.body.title.trim(),
        description: req.body.description ? req.body.description.trim() : '',
        dueDate: req.body.dueDate || null,
        dueTime: req.body.dueTime || null,
        status: 'Pending'
    };
    if (useMongo) {
        return TaskModel.create(taskPayload).then(t => res.status(201).json(t)).catch(err => { console.error(err); res.status(500).json({ error: 'Server error' }); });
    }
    const task = Object.assign({ id: idCounter++ }, taskPayload);
    tasks.push(task);
    saveData();
    res.status(201).json(task);
});

app.delete('/tasks/:id', authenticateToken, (req, res) => {
    const param = req.params.id;
    if (useMongo) {
        return TaskModel.findById(param).then(doc => {
            if (!doc) return res.status(404).json({ error: 'Task not found or access denied' });
            if (String(doc.userId) !== String(req.user.id)) return res.status(404).json({ error: 'Task not found or access denied' });
            return TaskModel.findByIdAndDelete(param).then(() => res.status(204).send());
        }).catch(err => { console.error('Task delete error (mongo):', err); res.status(500).json({ error: 'Server error' }); });
    }
    const id = parseInt(param, 10);
    if (isNaN(id)) return res.status(400).send('Invalid ID');
    const task = tasks.find(t => t.id === id && t.userId === req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found or access denied' });
    tasks = tasks.filter(t => !(t.id === id && t.userId === req.user.id));
    saveData();
    res.status(204).send();
});

app.put('/tasks/:id', authenticateToken, (req, res) => {
    const param = req.params.id;
    if (useMongo) {
        return TaskModel.findById(param).then(task => {
            if (!task) return res.status(404).json({ error: 'Task not found or access denied' });
            if (String(task.userId) !== String(req.user.id)) return res.status(404).json({ error: 'Task not found or access denied' });
            if (req.body.status && ['Pending', 'Done'].includes(req.body.status)) task.status = req.body.status;
            if (req.body.title) task.title = String(req.body.title).trim();
            if (req.body.description !== undefined) task.description = String(req.body.description).trim();
            if (req.body.dueDate !== undefined) task.dueDate = req.body.dueDate;
            if (req.body.dueTime !== undefined) task.dueTime = req.body.dueTime;
            return task.save().then(t => res.json(t));
        }).catch(err => { console.error('Task update error (mongo):', err); res.status(500).json({ error: 'Server error' }); });
    }
    const id = parseInt(param, 10);
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
