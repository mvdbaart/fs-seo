let app;
let initError = null;

try {
  app = require('../server/index.js');
} catch (err) {
  console.error('[vercel-api] Init error:', err);
  initError = err;
}

module.exports = (req, res) => {
  if (initError) {
    res.status(500).json({
      error: 'Backend Fout op Vercel: ' + initError.message,
      stack: initError.stack
    });
    return;
  }
  return app(req, res);
};
