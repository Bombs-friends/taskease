// Simple in-memory DB module for local/demo use.
// Note: Serverless functions are stateless across cold starts; this in-memory
// storage may reset between invocations. For persistent data use a real DB.

let tasks = [];
let idCounter = 1;

function getTasks() {
  return tasks;
}

function addTask(task) {
  const newTask = Object.assign({ id: idCounter++, status: 'Pending' }, task);
  tasks.push(newTask);
  return newTask;
}

function deleteTask(id) {
  const initial = tasks.length;
  tasks = tasks.filter(t => t.id !== id);
  return tasks.length < initial;
}

function updateTaskStatus(id, status) {
  const task = tasks.find(t => t.id === id);
  if (!task) return null;
  task.status = status;
  return task;
}

module.exports = { getTasks, addTask, deleteTask, updateTaskStatus };
