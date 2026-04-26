// Catch-all tasks API to handle /api/tasks and /api/tasks/:id
// WARNING: in-memory storage is ephemeral in serverless environments.

let tasks = [];
let idCounter = 1;

function parseIdFromUrl(url) {
  if (!url) return null;
  const m = url.match(/\/api\/tasks\/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

module.exports = async (req, res) => {
  const { method } = req;
  const url = req.url || '';
  const id = parseIdFromUrl(url);

  if (method === 'GET' && url.startsWith('/api/tasks')) {
    return res.status(200).json(tasks);
  }

  if (method === 'POST' && url === '/api/tasks') {
    const body = req.body || {};
    if (!body.title || typeof body.title !== 'string' || body.title.trim() === '') {
      return res.status(400).json({ error: 'Title is required' });
    }
    const task = {
      id: idCounter++,
      title: body.title.trim(),
      description: body.description ? String(body.description).trim() : '',
      dueDate: body.dueDate || null,
      dueTime: body.dueTime || null,
      status: 'Pending'
    };
    tasks.push(task);
    return res.status(201).json(task);
  }

  if (method === 'PUT' && id) {
    const body = req.body || {};
    const task = tasks.find(t => t.id === id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    if (!body.status || !['Pending', 'Done'].includes(body.status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    task.status = body.status;
    return res.status(200).json(task);
  }

  if (method === 'DELETE' && id) {
    const initial = tasks.length;
    tasks = tasks.filter(t => t.id !== id);
    if (tasks.length < initial) return res.status(204).send('');
    return res.status(404).json({ error: 'Task not found' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
