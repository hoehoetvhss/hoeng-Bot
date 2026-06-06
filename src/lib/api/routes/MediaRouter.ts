import { ok, problem } from '../http.js';
import { BaseRouter } from './BaseRouter.js';

import type { Request, Response } from 'express';


/**
 * Handles media utility routes:
 *   GET /api/media/thumbnails/:source/:id - Returns the thumbnail URL for a given source
 */
export class MediaRouter extends BaseRouter {
    constructor(...args: ConstructorParameters<typeof BaseRouter>) {
        super(...args);
        this.registerRoutes();
    }

    protected registerRoutes(): void {
        this.router.get('/thumbnails/:source/:id', this.#thumbnail.bind(this));
    }

    /**
     * GET /api/media/thumbnails/:source/:id
     * Currently only supports YouTube thumbnails.
     * Response: { url: string } or 400/404
     */
    #thumbnail(req: Request, res: Response): Response {
        // Express 5 params are Record<string, string>; explicit cast avoids compiler widening
        const source = req.params['source'] as string;
        const id = req.params['id'] as string;

        if (source === 'youtube') {
            // Validate YouTube video ID: must be exactly 11 alphanumeric/dash/underscore chars
            if (!/^[\w-]{11}$/.test(id)) {
                return problem(res, {
                    status: 400,
                    title: 'Invalid media id',
                    detail: 'The requested thumbnail identifier is not a valid YouTube video id.',
                    code: 'INVALID_MEDIA_ID',
                });
            }

            return ok(res, { url: `https://img.youtube.com/vi/${id}/sddefault.jpg` });
        }

        return problem(res, {
            status: 404,
            title: 'Thumbnail source not found',
            detail: 'The requested thumbnail source is not supported.',
            code: 'THUMBNAIL_SOURCE_NOT_FOUND',
        });
    }
}
