console.log("SCRIPT LOADED");

// ✅ Create client ONLY ONCE globally
if (!window.sbClient) {
  window.sbClient = window.supabase.createClient(
    "https://xllmemutlawrkgcnywom.supabase.co",
    "sb_publishable_IbYajOwTDSjiVjKYzX2e9Q_JyUO-cP0"
  );
}

// ✅ Rename to avoid duplicate declaration error
const supabaseClient = window.sbClient;

let tasks = [];

window.onload = () => {
  checkUser();
};

// =======================
// 🔐 REGISTER
// =======================
document.getElementById("registerForm").onsubmit = async (e) => {
  e.preventDefault();

  const form = new FormData(e.target);

  const { error } = await supabaseClient.auth.signUp({
    email: form.get("username"),
    password: form.get("password"),
  });

  if (error) return alert("Register error: " + error.message);

  alert("Registered! Now login.");
};

// =======================
// 🔐 LOGIN
// =======================
document.getElementById("loginForm").onsubmit = async (e) => {
  e.preventDefault();

  const form = new FormData(e.target);

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: form.get("username"),
    password: form.get("password"),
  });

  if (error) return alert("Login error: " + error.message);

  document.getElementById("auth").style.display = "none";
  document.getElementById("app").style.display = "block";

  document.getElementById("username").textContent = data.user.email;

  loadTasks();
};

// =======================
// 📦 LOAD TASKS
// =======================
async function loadTasks() {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  if (userError || !user) return;

  const { data, error } = await supabaseClient
    .from("tasks")
    .select("*")
    .eq("user_id", user.id);

  if (error) return console.error(error.message);

  tasks = data || [];
  renderTasks();
}

// =======================
// ➕ ADD TASK
// =======================
async function addTask() {
  const input = document.getElementById("taskInput");
  const text = input.value.trim();
  if (!text) return;

  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { error } = await supabaseClient.from("tasks").insert([
    { title: text, user_id: user.id, done: false }
  ]);

  if (error) return alert(error.message);

  input.value = "";
  loadTasks();
}

// =======================
// ✅ TOGGLE TASK
// =======================
async function toggleTask(id, current) {
  await supabaseClient
    .from("tasks")
    .update({ done: !current })
    .eq("id", id);

  loadTasks();
}

// =======================
// ❌ DELETE TASK
// =======================
async function deleteTask(id) {
  await supabaseClient
    .from("tasks")
    .delete()
    .eq("id", id);

  loadTasks();
}

// =======================
// 🎨 RENDER TASKS
// =======================
function renderTasks() {
  const search = document.getElementById("searchInput")?.value.toLowerCase() || "";

  const pending = document.getElementById("pending");
  const completed = document.getElementById("completed");

  if (!pending || !completed) return;

  pending.innerHTML = "";
  completed.innerHTML = "";

  tasks
    .filter(t => t.title.toLowerCase().includes(search))
    .forEach(task => {
      const div = document.createElement("div");
      div.className = "task" + (task.done ? " completed" : "");

      div.innerHTML = `
        <span>${task.title}</span>
        <div>
          <button onclick="toggleTask('${task.id}', ${task.done})">✔</button>
          <button onclick="deleteTask('${task.id}')">✖</button>
        </div>
      `;

      if (task.done) completed.appendChild(div);
      else pending.appendChild(div);
    });
}

// =======================
// 👤 CHECK USER SESSION
// =======================
async function checkUser() {
  const { data: { user } } = await supabaseClient.auth.getUser();

  if (user) {
    document.getElementById("auth").style.display = "none";
    document.getElementById("app").style.display = "block";
    document.getElementById("username").textContent = user.email;
    loadTasks();
  }
}