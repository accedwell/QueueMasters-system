const { getPool } = require('../server/database.cjs');
const { createHandler } = require('../server/app.cjs');
let handler;
module.exports = async (req, res) => {
  if (!handler) handler = createHandler(getPool());
  return handler(req, res);
};
