import { describe, it, expect } from 'vitest';
import aiService from '../src/service/ai-service';
import domainUtils from '../src/utils/domain-uitls';

describe('cloud-mail core utilities', () => {
	it('matches AI verification-code filters by sender or domain', () => {
		const email = { from: { address: 'noreply@example.com' } };
		expect(aiService.shouldExtractCode(0, '', email)).toBe(true);
		expect(aiService.shouldExtractCode(0, 'example.com', email)).toBe(true);
		expect(aiService.shouldExtractCode(0, 'noreply@example.com', email)).toBe(true);
		expect(aiService.shouldExtractCode(0, 'other.example', email)).toBe(false);
	});

	it('normalizes object storage domains', () => {
		expect(domainUtils.toOssDomain('files.example.com')).toBe('https://files.example.com');
		expect(domainUtils.toOssDomain('https://files.example.com/')).toBe('https://files.example.com');
		expect(domainUtils.toOssDomain('')).toBe(null);
	});
});
