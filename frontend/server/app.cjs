const { randomBytes } = require('node:crypto');
const { hashPassword, verifyPassword, tokenHash, passwordProblem } = require('./security.cjs');
const { initialize, transaction } = require('./database.cjs');
const COOKIE = 'qm_session';
const userView = row => ({ id: Number(row.id), username: row.username, role: row.role });
const priceFor = type => /valet/i.test(type) ? 350 : /engine/i.test(type) ? 150 : 100;
const text = (value, fallback = '') => typeof value === 'string' ? value.trim() : fallback;
const json = (res, status, value) => res.status(status).json(value);
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const vehicleView = (row, staff) => ({
  id: Number(row.id), plateNumber: row.plate_number, carModel: row.car_model,
  washType: row.wash_type, status: row.status, paid: row.is_paid, amountPaid: row.amount_paid,
  ...(staff ? { phoneNumber: row.phone_number } : {}),
  createdAt: row.created_at instanceof Date ? row.created_at.toISOString().replace('Z', '') : row.created_at,
});
const saleView = row => ({ id: Number(row.id), plateNumber: row.plate_number,
  washType: row.wash_type, amount: row.amount, date: row.date instanceof Date
    ? `${row.date.getFullYear()}-${String(row.date.getMonth()+1).padStart(2,'0')}-${String(row.date.getDate()).padStart(2,'0')}` : row.date });

function createHandler(db) {
  let ready;
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      const path = new URL(req.url, 'http://localhost').pathname.replace(/\/$/, '');
      const method = req.method;
      if (!ready) ready = initialize(db).catch(error => { ready = null; throw error; });
      await ready;
      if (path === '/api/health' && method === 'GET') {
        await db.query('SELECT 1');
        return json(res, 200, { status: 'ok', database: 'connected' });
      }
      // Browser mutations must come from this origin; SameSite cookies also block cross-site requests.
      if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && req.headers.origin) {
        const origin = new URL(req.headers.origin);
        if (origin.host !== req.headers.host) fail(403, 'Request origin is not allowed.');
      }
      let body = req.body || {};
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { fail(400, 'Invalid JSON.'); }
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Invalid request body.');
      for (const value of Object.values(body)) {
        if (typeof value === 'string' && value.length > 255) fail(400, 'Fields must be 255 characters or fewer.');
      }
      const token = (req.headers.cookie || '').split(';').map(c => c.trim())
        .find(c => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
      let user;
      if (token && /^[a-f0-9]{64}$/.test(token)) {
        user = (await db.query(`SELECT u.id,u.username,u.role FROM qm_session s
          JOIN app_user u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [tokenHash(token)])).rows[0];
      }
      const staff = () => { if (!user) fail(401, 'Please sign in.'); };
      const admin = () => { staff(); if (user.role !== 'ADMIN') fail(403, 'Manager access required.'); };
      const setCookie = (value, age) => res.setHeader('Set-Cookie',
        `${COOKIE}=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${age}${process.env.VERCEL || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);

      if (path === '/api/auth/login' && method === 'POST') {
        const username = text(body.username);
        if (!username || typeof body.password !== 'string') fail(401, 'Wrong username or password.');
        const ip = req.headers['x-vercel-forwarded-for'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'local';
        const key = tokenHash(`${ip}:${username.toLowerCase()}`);
        const attempts = await db.query(`INSERT INTO qm_login_attempt (key) VALUES ($1)
          ON CONFLICT (key) DO UPDATE SET
            attempts=CASE WHEN qm_login_attempt.started_at < now()-interval '15 minutes' THEN 1 ELSE qm_login_attempt.attempts+1 END,
            started_at=CASE WHEN qm_login_attempt.started_at < now()-interval '15 minutes' THEN now() ELSE qm_login_attempt.started_at END
          RETURNING attempts`, [key]);
        if (attempts.rows[0].attempts > 15) fail(429, 'Too many sign-in attempts. Try again in 15 minutes.');
        const account = (await db.query('SELECT * FROM app_user WHERE username=$1', [username])).rows[0];
        if (!await verifyPassword(body.password, account?.password)) fail(401, 'Wrong username or password.');
        if (!account.password.startsWith('scrypt:')) {
          await db.query('UPDATE app_user SET password=$1 WHERE id=$2', [await hashPassword(body.password), account.id]);
        }
        await db.query('DELETE FROM qm_login_attempt WHERE key=$1 OR started_at < now()-interval \'1 day\'', [key]);
        await db.query('DELETE FROM qm_session WHERE expires_at < now()');
        if (token) await db.query('DELETE FROM qm_session WHERE token_hash=$1', [tokenHash(token)]);
        const session = randomBytes(32).toString('hex');
        await db.query(`INSERT INTO qm_session (token_hash,user_id,expires_at) VALUES ($1,$2,now()+interval '7 days')`, [tokenHash(session), account.id]);
        setCookie(session, 604800);
        return json(res, 200, userView(account));
      }
      if (path === '/api/auth/me' && method === 'GET') {
        staff(); return json(res, 200, userView(user));
      }
      if (path === '/api/auth/logout' && method === 'POST') {
        if (token) await db.query('DELETE FROM qm_session WHERE token_hash=$1', [tokenHash(token)]);
        setCookie('', 0); return res.status(204).end();
      }
      if (path === '/api/auth/register' && method === 'POST') {
        admin();
        if (!text(body.username) || !text(body.password)) fail(400, 'Username and password are required.');
        const problem = passwordProblem(body.password);
        if (problem) fail(400, problem);
        const result = await db.query('INSERT INTO app_user (username,password,role) VALUES ($1,$2,$3) RETURNING id,username,role',
          [text(body.username), await hashPassword(body.password), text(body.role).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'WASHER']);
        return json(res, 200, userView(result.rows[0]));
      }
      if (path === '/api/users' && method === 'GET') {
        admin(); return json(res, 200, (await db.query('SELECT id,username,role FROM app_user ORDER BY id')).rows.map(userView));
      }
      const userMatch = path.match(/^\/api\/users\/(\d+)$/);
      if (userMatch && ['PUT','DELETE'].includes(method)) {
        admin();
        if (method === 'PUT' && body.password) {
          const problem = passwordProblem(body.password);
          if (problem) fail(400, problem);
        }
        const result = await transaction(db, async client => {
          // Serialize staff changes so founder protection cannot race with a role update.
          await client.query('LOCK TABLE app_user IN SHARE ROW EXCLUSIVE MODE');
          const account = (await client.query('SELECT * FROM app_user WHERE id=$1', [userMatch[1]])).rows[0];
          if (!account) fail(404, 'Staff member not found.');
          const founder = (await client.query("SELECT id FROM app_user WHERE role='ADMIN' ORDER BY id LIMIT 1")).rows[0];
          if (method === 'DELETE') {
            if (account.id === founder?.id) fail(400, 'The founder account cannot be deleted.');
            await client.query('DELETE FROM app_user WHERE id=$1', [account.id]);
            return null;
          }
          const role = body.role == null ? account.role : text(body.role).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'WASHER';
          if (account.id === founder?.id && role !== 'ADMIN') fail(400, 'The founder account cannot be demoted.');
          const updated = await client.query('UPDATE app_user SET username=$1,password=$2,role=$3 WHERE id=$4 RETURNING id,username,role',
            [text(body.username) || account.username, body.password ? await hashPassword(body.password) : account.password, role, account.id]);
          if (body.password || role !== account.role) await client.query('DELETE FROM qm_session WHERE user_id=$1', [account.id]);
          return userView(updated.rows[0]);
        });
        return result ? json(res, 200, result) : res.status(204).end();
      }
      if (path === '/api/bookings' && method === 'GET') {
        return json(res, 200, (await db.query('SELECT * FROM vehicle ORDER BY id')).rows.map(row => vehicleView(row, !!user)));
      }
      if (path === '/api/bookings' && method === 'POST') {
        if (!text(body.plateNumber)) fail(400, 'Number plate is required.');
        const washType = text(body.washType, 'Standard Wash') || 'Standard Wash';
        const result = await db.query(`INSERT INTO vehicle (plate_number,car_model,phone_number,wash_type,status,is_paid,amount_paid)
          VALUES ($1,$2,$3,$4,'In Queue',true,$5) RETURNING *`,
          [text(body.plateNumber).toUpperCase(), text(body.carModel), text(body.phoneNumber), washType, priceFor(washType)]);
        return json(res, 200, vehicleView(result.rows[0], true));
      }
      if (path === '/api/bookings/all-sales' && method === 'GET') {
        staff(); return json(res, 200, (await db.query('SELECT * FROM sale_record ORDER BY id DESC')).rows.map(saleView));
      }
      if (path === '/api/bookings/daily-total' && method === 'GET') {
        staff(); return json(res, 200, Number((await db.query("SELECT coalesce(sum(amount),0) AS total FROM sale_record WHERE date=(now() AT TIME ZONE 'Africa/Johannesburg')::date")).rows[0].total));
      }
      if (path === '/api/bookings/clear-archive' && method === 'DELETE') {
        admin(); await db.query('DELETE FROM sale_record'); return res.status(204).end();
      }
      const bookingMatch = path.match(/^\/api\/bookings\/(\d+)(?:\/(next|complete))?$/);
      if (bookingMatch) {
        staff();
        const [, id, action] = bookingMatch;
        if (method === 'PUT' && !action) {
          const result = await db.query(`UPDATE vehicle SET plate_number=coalesce($1,plate_number),
            car_model=coalesce($2,car_model),phone_number=coalesce($3,phone_number) WHERE id=$4 RETURNING *`,
            [body.plateNumber == null ? null : text(body.plateNumber).toUpperCase(), body.carModel ?? null, body.phoneNumber ?? null, id]);
          if (!result.rows[0]) fail(404, 'Vehicle not found.');
          return json(res, 200, vehicleView(result.rows[0], true));
        }
        if (method === 'PUT' && action === 'next') {
          const result = await db.query(`UPDATE vehicle SET status=CASE coalesce(status,'In Queue')
            WHEN 'In Queue' THEN 'Washing' WHEN 'Washing' THEN 'Ready' ELSE status END WHERE id=$1 RETURNING *`, [id]);
          if (!result.rows[0]) fail(404, 'Vehicle not found.');
          return json(res, 200, vehicleView(result.rows[0], true));
        }
        if (method === 'DELETE' && action === 'complete') {
          await transaction(db, async client => {
            const row = (await client.query('DELETE FROM vehicle WHERE id=$1 RETURNING *', [id])).rows[0];
            if (!row) fail(404, 'Vehicle not found.');
            await client.query(`INSERT INTO sale_record (plate_number,wash_type,amount,date)
              VALUES ($1,$2,$3,(now() AT TIME ZONE 'Africa/Johannesburg')::date)`,
              [row.plate_number, row.wash_type, row.amount_paid > 0 ? row.amount_paid : priceFor(row.wash_type)]);
          });
          return res.status(204).end();
        }
      }
      return json(res, 404, 'API route not found.');
    } catch (error) {
      if (error.code === '23505') return json(res, 400, 'Username already taken.');
      if (error.status) return json(res, error.status, error.message);
      // Do not include connection strings, credentials or database rows in responses/logs.
      console.error('API failure', error.code || error.name);
      return json(res, 503, 'The server is temporarily unavailable. Please try again.');
    }
  };
}

module.exports = { createHandler, priceFor };
