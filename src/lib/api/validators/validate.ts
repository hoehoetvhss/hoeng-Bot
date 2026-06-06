import { z } from 'zod';

import { problem } from '../http.js';

import type { Request, Response } from 'express';


/**
 * Validates `req.body` against the given Zod schema.
 *
 * On success returns the parsed (and type-narrowed) data.
 * On failure writes a 400 JSON response and returns `null`.
 *
 * Usage:
 * ```ts
 * const body = validate(loginSchema, req, res);
 * if (!body) return;
 * ```
 */
function parseSchema<T>(
    schema: z.ZodType<T>,
    input: unknown,
    res: Response,
): T | null {
    const result = schema.safeParse(input);

    if (!result.success) {
        problem(res, {
            status: 400,
            title: 'Validation failed',
            detail: 'The request payload did not match the expected schema.',
            code: 'VALIDATION_ERROR',
            errors: result.error.flatten(),
        });
        return null;
    }

    return result.data;
}

export function validateBody<T>(
    schema: z.ZodType<T>,
    req: Request,
    res: Response,
): T | null {
    return parseSchema(schema, req.body, res);
}

export function validateQuery<T>(
    schema: z.ZodType<T>,
    req: Request,
    res: Response,
): T | null {
    return parseSchema(schema, req.query, res);
}

export function validateParams<T>(
    schema: z.ZodType<T>,
    req: Request,
    res: Response,
): T | null {
    return parseSchema(schema, req.params, res);
}

export function validate<T>(
    schema: z.ZodType<T>,
    req: Request,
    res: Response,
): T | null {
    return validateBody(schema, req, res);
}
