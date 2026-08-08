import app from '../hono/hono';
import { dbInit } from '../init/init';

// Preferred: keep the initialization secret out of the URL and access logs.
app.post('/init', (c) => {
	return dbInit.init(c);
});

// Backward-compatible legacy route. Prefer POST /init with X-Init-Secret.
app.get('/init/:secret', (c) => {
	return dbInit.init(c);
});
