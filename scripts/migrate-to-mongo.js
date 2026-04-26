/**
 * Migration script: data.json -> MongoDB
 *
 * Usage:
 *   MONGODB_URI="your-uri" node scripts/migrate-to-mongo.js
 *
 * What it does:
 * - Reads data.json (users/tasks)
 * - Creates User documents in MongoDB, preserving username/passwordHash/provider info
 * - Creates Task documents mapping old numeric user ids to new user _id strings
 * - Outputs a mapping file at ./migration-map.json
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const OUT_MAP = path.join(__dirname, '..', 'migration-map.json');

async function main(){
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('MONGODB_URI not set'); process.exit(1); }
  if (!fs.existsSync(DATA_FILE)) { console.error('data.json not found'); process.exit(1); }

  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const obj = JSON.parse(raw);
  const users = obj.users || [];
  const tasks = obj.tasks || [];

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to Mongo');

  const userSchema = new mongoose.Schema({ username: { type: String, unique: true }, passwordHash: String, provider: String, providerId: String, email: String }, { timestamps: true });
  const taskSchema = new mongoose.Schema({ userId: String, title: String, description: String, dueDate: String, dueTime: String, status: String }, { timestamps: true });
  const User = mongoose.model('User', userSchema);
  const Task = mongoose.model('Task', taskSchema);

  const mapping = { users: {}, tasks: {} };

  for (const u of users) {
    try {
      const doc = await User.create({ username: u.username, passwordHash: u.passwordHash, provider: u.provider, providerId: u.providerId, email: u.email });
      mapping.users[u.id] = doc._id.toString();
      console.log(`Imported user ${u.username} -> ${doc._id}`);
    } catch (err) {
      console.error('Failed to import user', u.username, err.message);
    }
  }

  for (const t of tasks) {
    try {
      const newUserId = mapping.users[t.userId] || String(t.userId);
      const doc = await Task.create({ userId: newUserId, title: t.title, description: t.description, dueDate: t.dueDate, dueTime: t.dueTime, status: t.status });
      mapping.tasks[t.id] = doc._id.toString();
      console.log(`Imported task ${t.id} -> ${doc._id}`);
    } catch (err) {
      console.error('Failed to import task', t.id, err.message);
    }
  }

  fs.writeFileSync(OUT_MAP, JSON.stringify(mapping, null, 2), 'utf8');
  console.log('Migration complete. Mapping saved to migration-map.json');
  await mongoose.disconnect();
}

main().catch(err=>{ console.error('Migration failed', err); process.exit(1); });
