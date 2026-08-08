import app from '../hono/hono';
import BizError from '../error/biz-error';
import result from '../model/result';
import settingService from '../service/setting-service';

const DEFAULT_AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

async function runCheck(checks, name, fn) {
	try {
		const detail = await fn();
		checks[name] = { ok: true, ...detail };
	} catch (error) {
		checks[name] = {
			ok: false,
			error: error?.message || String(error),
			code: error?.code || null
		};
	}
}

// Authenticated, administrator-only, non-destructive Cloudflare binding smoke test.
// Add ?probeAi=1 to perform one tiny Workers AI inference.
app.get('/cloudflare/health', async (c) => {
	const currentUser = c.get('user');
	if (!currentUser || currentUser.email !== c.env.admin) {
		throw new BizError('Administrator permission required', 403);
	}

	const checks = {};

	await runCheck(checks, 'd1', async () => {
		if (!c.env.db) throw new Error('D1 binding "db" is not configured');
		const row = await c.env.db.prepare('SELECT 1 AS ok').first();
		return { bound: true, query: row?.ok === 1 };
	});

	await runCheck(checks, 'kv', async () => {
		if (!c.env.kv) throw new Error('KV binding "kv" is not configured');
		await c.env.kv.getWithMetadata('__cloud_mail_healthcheck__');
		return { bound: true, read: true };
	});

	await runCheck(checks, 'r2', async () => {
		if (!c.env.r2) return { bound: false, optional: true };
		await c.env.r2.head('__cloud_mail_healthcheck__');
		return { bound: true, read: true };
	});

	await runCheck(checks, 'assets', async () => {
		if (!c.env.assets) throw new Error('Static Assets binding "assets" is not configured');
		const url = new URL('/index.html', c.req.url);
		const response = await c.env.assets.fetch(new Request(url));
		return { bound: true, status: response.status, served: response.ok };
	});

	checks.emailService = {
		ok: !!c.env.email,
		bound: !!c.env.email,
		optional: true,
		note: c.env.email
			? 'send_email binding exists; sender-domain onboarding and delivery require a real send test'
			: 'send_email binding is not configured; Resend/internal delivery can still be used'
	};

	const probeAi = c.req.query('probeAi') === '1';
	if (!probeAi) {
		checks.workersAi = {
			ok: !!c.env.ai,
			bound: !!c.env.ai,
			model: c.env.ai_model || DEFAULT_AI_MODEL,
			probed: false,
			note: 'append ?probeAi=1 to execute a small inference'
		};
	} else {
		await runCheck(checks, 'workersAi', async () => {
			if (!c.env.ai) throw new Error('Workers AI binding "ai" is not configured');
			const model = c.env.ai_model || DEFAULT_AI_MODEL;
			await c.env.ai.run(model, {
				messages: [{ role: 'user', content: 'Reply with OK.' }],
				max_tokens: 2,
				temperature: 0
			});
			return { bound: true, model, probed: true };
		});
	}

	await runCheck(checks, 'turnstile', async () => {
		const settings = await settingService.query(c);
		return {
			configured: !!(settings.siteKey && settings.secretKey),
			note: 'Siteverify requires a fresh client token, so this endpoint does not consume one'
		};
	});

	checks.emailRouting = {
		ok: true,
		codeHandler: true,
		note: 'email() handler is exported; routing-rule delivery must be verified from Cloudflare Email Routing'
	};

	const allRequiredOk = ['d1', 'kv', 'assets'].every(name => checks[name]?.ok);
	return c.json(result.ok({ allRequiredOk, checks }));
});
