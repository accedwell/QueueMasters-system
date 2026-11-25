const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { createHandler } = require('./app.cjs');

// Use a separate schema so integration tests never touch application tables.
test('API permissions, staff, booking lifecycle, and transaction rollback', async () => {
  const connectionString = process.env.TEST_DATABASE_URL || 'postgresql://queuemasters:queuemasters123@localhost:5432/queuemasters';
  const root = new Pool({ connectionString });
  const schema = `qm_test_${Date.now()}`;
  let db;
  try {
    await root.query(`CREATE SCHEMA ${schema}`);
    db = new Pool({ connectionString, options: `-c search_path=${schema} -c timezone=Africa/Johannesburg` });
    const handler = createHandler(db);
    async function request(method, path, body = {}, cookie = '') {
      const result = { headers: {} };
      const res = {
        setHeader: (name, value) => { result.headers[name] = value; },
        status: code => { result.status = code; return res; },
        json: value => { result.body = value; return res; },
        end: () => res,
      };
      await handler({ method, url: `/api${path}`, body, headers: { host: 'localhost', cookie } }, res);
      return result;
    }
    assert.equal((await request('GET','/health')).body.database, 'connected');
    assert.equal((await request('GET','/users')).status, 401);
    assert.equal((await request('POST','/auth/register',{username:'intruder',password:'bad'})).status, 401);
    assert.equal((await request('POST','/auth/login',{username:'admin',password:'wrong'})).status, 401);
    const login = await request('POST','/auth/login',{username:'admin',password:'admin@123'});
    assert.equal(login.status, 200);
    assert.equal(login.body.role, 'ADMIN');
    assert.equal(login.body.password, undefined);
    assert.match(login.headers['Set-Cookie'], /HttpOnly; SameSite=Strict/);
    const cookie = login.headers['Set-Cookie'].split(';')[0];
    assert.equal((await request('GET','/auth/me',{},cookie)).body.username, 'admin');
    assert.match((await db.query('SELECT password FROM app_user WHERE username=$1',['admin'])).rows[0].password,/^scrypt:/);
    const member = await request('POST','/auth/register',{username:'washer',password:'Washer-Pass-2026',role:'WASHER'},cookie);
    assert.equal((await request('POST','/auth/register',{username:'weak',password:'staff@123'},cookie)).status,400);
    assert.equal((await request('PUT',`/users/${login.body.id}`,{password:'short'},cookie)).status,400);
    assert.equal(member.status, 200);
    assert.equal((await request('POST','/auth/register',{username:'washer',password:'Another-Pass-2026'},cookie)).status,400);
    const washerLogin = await request('POST','/auth/login',{username:'washer',password:'Washer-Pass-2026'});
    const washerCookie = washerLogin.headers['Set-Cookie'].split(';')[0];
    assert.equal((await request('GET','/users',{},washerCookie)).status,403);
    assert.equal((await request('DELETE','/bookings/clear-archive',{},washerCookie)).status,403);
    assert.equal((await request('PUT',`/users/${login.body.id}`,{role:'WASHER'},cookie)).status,400);
    assert.equal((await request('DELETE',`/users/${login.body.id}`,{},cookie)).status,400);
    assert.equal((await request('POST','/bookings',{})).status,400);
    const booking = await request('POST','/bookings',{plateNumber:' test 123 ',washType:'Full Valet',phoneNumber:'0712345678',amountPaid:1,status:'Ready'});
    assert.equal(booking.body.plateNumber,'TEST 123');
    assert.equal(booking.body.amountPaid,350);
    assert.equal(booking.body.status,'In Queue');
    const id=booking.body.id;
    assert.equal((await request('GET','/bookings')).body[0].phoneNumber,undefined);
    assert.equal((await request('GET','/bookings',{},washerCookie)).body[0].phoneNumber,'0712345678');
    assert.equal((await request('PUT',`/bookings/${id}/next`)).status,401);
    assert.equal((await request('PUT',`/bookings/${id}`,{carModel:'Toyota'},washerCookie)).body.carModel,'Toyota');
    assert.equal((await request('PUT',`/bookings/${id}/next`,{},washerCookie)).body.status,'Washing');
    assert.equal((await request('PUT',`/bookings/${id}/next`,{},washerCookie)).body.status,'Ready');
    // Force an archive failure and verify that the vehicle deletion rolls back.
    await db.query('ALTER TABLE sale_record ADD CONSTRAINT test_failure CHECK (amount < 0)');
    assert.equal((await request('DELETE',`/bookings/${id}/complete`,{},washerCookie)).status,503);
    assert.equal((await request('GET','/bookings')).body.length,1);
    await db.query('ALTER TABLE sale_record DROP CONSTRAINT test_failure');
    const results = await Promise.all([
      request('DELETE',`/bookings/${id}/complete`,{},washerCookie),
      request('DELETE',`/bookings/${id}/complete`,{},washerCookie),
    ]);
    assert.deepEqual(results.map(r=>r.status).sort(),[204,404]);
    assert.equal((await request('GET','/bookings/all-sales',{},cookie)).body.length,1);
    assert.equal((await request('GET','/bookings/daily-total',{},cookie)).body,350);
    assert.equal((await request('DELETE','/bookings/clear-archive',{},cookie)).status,204);
    assert.equal((await request('GET','/bookings/all-sales',{},cookie)).body.length,0);
    await request('PUT',`/users/${member.body.id}`,{password:'Changed-Pass-2026'},cookie);
    assert.equal((await request('GET','/auth/me',{},washerCookie)).status,401);
    assert.equal((await request('DELETE',`/users/${member.body.id}`,{},cookie)).status,204);
    assert.equal((await request('POST','/auth/logout',{},cookie)).status,204);
    assert.equal((await request('GET','/auth/me',{},cookie)).status,401);
    // A second cold start must preserve existing accounts rather than reseeding.
    await createHandler(db)({method:'GET',url:'/api/health',headers:{}}, {setHeader(){},status(){return this;},json(){}});
    assert.equal(Number((await db.query('SELECT count(*) FROM app_user')).rows[0].count),1);
  } finally {
    if (db) await db.end();
    await root.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await root.end();
  }
});
