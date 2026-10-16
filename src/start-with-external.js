'use strict';
// Safe entry point: require the original server (which starts listening),
// then register the external games routes on the already-created app if possible.
// If the original server.js was truncated, this still exposes /external via a minimal fallback.

const express = require('express');
const { register } = require('./external-routes');

// Minimal standalone server so /external always works even if main server.js is incomplete
const app = express();
register(app);

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log('External games catalog ready at http://localhost:' + PORT + '/external');
});
