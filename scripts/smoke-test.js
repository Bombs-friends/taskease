const http = require('http');

function req(path, method, data, headers){
  return new Promise((res,rej)=>{
    const d = data? JSON.stringify(data):null;
    const h = Object.assign({}, headers||{});
    if (d) { h['Content-Type'] = 'application/json'; h['Content-Length'] = Buffer.byteLength(d); }
    const opts = { hostname: 'localhost', port: 3000, path, method, headers: h };
    const r = http.request(opts, resp => { let b=''; resp.on('data', c=>b+=c); resp.on('end', ()=>res({ status: resp.statusCode, body: b })); });
    r.on('error', e=>rej(e));
    if (d) r.write(d);
    r.end();
  });
}

(async ()=>{
  try{
    const login = await req('/auth/login', 'POST', { username: 'test', password: 'password' });
    console.log('LOGIN', login.status, login.body);
    if (login.status !== 200) return process.exit(1);
    const token = JSON.parse(login.body).token;
    const authHeader = { 'Authorization': 'Bearer ' + token };

    const create = await req('/tasks', 'POST', { title: 'Smoke task', description: 'smoke test' }, authHeader);
    console.log('CREATE', create.status, create.body);

    const list = await req('/tasks', 'GET', null, authHeader);
    console.log('LIST', list.status, list.body);
    const tasks = list.status === 200 ? JSON.parse(list.body) : [];
    const id = tasks.length ? tasks[0].id : (create.status === 201 ? JSON.parse(create.body).id : null);
    if (id){
      const upd = await req('/tasks/' + id, 'PUT', { status: 'Done' }, authHeader);
      console.log('UPDATE', upd.status, upd.body);
      const del = await req('/tasks/' + id, 'DELETE', null, authHeader);
      console.log('DELETE', del.status, del.body);
    }
    console.log('SMOKE TEST COMPLETE');
  }catch(e){ console.error('SMOKE ERROR', e); process.exit(2); }
})();
