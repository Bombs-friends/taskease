console.log("SCRIPT LOADED");

if (!window.sbClient) {
  window.sbClient = window.supabase.createClient(
    "https://xllmemutlawrkgcnywom.supabase.co",
    "sb_publishable_IbYajOwTDSjiVjKYzX2e9Q_JyUO-cP0"
  );
}

const supabase = window.sbClient;

let tasks = [];

window.onload = () => {
  checkUser();
};

document.getElementById("registerForm").onsubmit = async (e) => {
  e.preventDefault();

  const form = new FormData(e.target);

  const { error } = await supabase.auth.signUp({
    email: form.get("username"),
    password: form.get("password"),
  });

  if (error) return alert(error.message);

  alert("Registered! Now login.");
};

document.getElementById("loginForm").onsubmit = async (e) => {
  e.preventDefault();

  const form = new FormData(e.target);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: form.get("username"),
    password: form.get("password"),
  });

  if (error) return alert(error.message);

  document.getElementById("auth").style.display = "none";
  document.getElementById("app").style.display = "block";

  document.getElementById("username").textContent = data.user.email;

  loadTasks();
};

async function loadTasks() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("user_id", user.id);

  if (error) return;

  tasks = data || [];
  renderTasks();
}

async function addTask() {
  const input = document.getElementById("taskInput");
  const text = input.value.trim();
  if (!text) return;

  const { data: { user } } = await supabase.auth.getUser();

  await supabase.from("tasks").insert([
    { title: text, user_id: user.id, done: false }
  ]);

  input.value = "";
  loadTasks();
}

async function toggleTask(id, current) {
  await supabase
    .from("tasks")
    .update({ done: !current })
    .eq("id", id);

  loadTasks();
}

async function deleteTask(id) {
  await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  loadTasks();
}

function renderTasks() {
  const search = document.getElementById("searchInput").value.toLowerCase();

  const pending = document.getElementById("pending");
  const completed = document.getElementById("completed");

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

async function checkUser() {
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    document.getElementById("auth").style.display = "none";
    document.getElementById("app").style.display = "block";
    document.getElementById("username").textContent = user.email;
    loadTasks();
  }
}