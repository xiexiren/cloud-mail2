import s3Service from './s3-service';
import settingService from './setting-service';
import kvObjService from './kv-obj-service';

const r2Service = {

	async storageType(c) {

		const setting = await settingService.query(c);
		const { bucket, endpoint, s3AccessKey, s3SecretKey } = setting;

		if (!!(bucket && endpoint && s3AccessKey && s3SecretKey)) {
			return 'S3';
		}

		if (c.env.r2) {
			return 'R2';
		}

		return 'KV';
	},

	async putObj(c, key, content, metadata) {

		const storageType = await this.storageType(c);

		if (storageType === 'KV') {
			await kvObjService.putObj(c, key, content, metadata);
		}

		if (storageType === 'R2') {
			await c.env.r2.put(key, content, {
				httpMetadata: { ...metadata }
			});
		}

		if (storageType === 'S3') {
			await s3Service.putObj(c, key, content, metadata);
		}

	},

	async getObj(c, key) {
		const storageType = await this.storageType(c);

		if (storageType === 'KV') {
			return await kvObjService.getObj(c, key);
		}

		if (storageType === 'R2') {
			return await c.env.r2.get(key);
		}

		if (storageType === 'S3') {
			return await s3Service.getObj(c, key);
		}
	},


	async getResponse(c, key) {
		const obj = await this.getObj(c, key);

		if (!obj) {
			return new Response('Not Found', { status: 404 });
		}

		// KV and S3 adapters already return a Response.
		if (obj instanceof Response) {
			return obj;
		}

		// Native R2 get() returns R2ObjectBody. Preserve its HTTP metadata.
		const headers = new Headers();
		if (typeof obj.writeHttpMetadata === 'function') {
			obj.writeHttpMetadata(headers);
		} else {
			const metadata = obj.httpMetadata || {};
			if (metadata.contentType) headers.set('Content-Type', metadata.contentType);
			if (metadata.contentDisposition) headers.set('Content-Disposition', metadata.contentDisposition);
			if (metadata.cacheControl) headers.set('Cache-Control', metadata.cacheControl);
		}

		if (obj.httpEtag) {
			headers.set('ETag', obj.httpEtag);
		}

		return new Response(obj.body, { headers });
	},

	async delete(c, key) {

		const storageType = await this.storageType(c);

		if (storageType === 'KV') {
			await kvObjService.deleteObj(c, key);
		}

		if (storageType === 'R2') {
			await c.env.r2.delete(key);
		}

		if (storageType === 'S3'){
			await s3Service.deleteObj(c, key);
		}

	}

};
export default r2Service;
