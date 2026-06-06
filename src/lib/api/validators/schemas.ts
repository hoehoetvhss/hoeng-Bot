import { z } from 'zod';


// -------------------------------------------------------------------------
// Auth schemas
// -------------------------------------------------------------------------

/** Body schema for POST /api/auth/login */
export const loginSchema = z.object({
    username: z.string().min(1).max(64),
    password: z.string().min(1).max(256),
});

export type LoginBody = z.infer<typeof loginSchema>;


// -------------------------------------------------------------------------
// Shared schemas
// -------------------------------------------------------------------------

export const snowflakeSchema = z.string().regex(/^\d{17,19}$/);

const booleanQuerySchema = z
    .union([z.literal('true'), z.literal('false')])
    .transform((value) => value === 'true');

export const paginatedLogsQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(100),
    before: z.coerce.number().int().min(0).optional(),
    after: z.coerce.number().int().min(0).optional(),
}).refine(
    ({ before, after }) => !(before !== undefined && after !== undefined),
    { message: 'Only one cursor direction can be requested at a time.' }
);

export type PaginatedLogsQuery = z.infer<typeof paginatedLogsQuerySchema>;

export const guildIdParamsSchema = z.object({
    guildID: snowflakeSchema,
});

export type GuildIdParams = z.infer<typeof guildIdParamsSchema>;

export const serverListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(24),
    playing: booleanQuerySchema.optional(),
    guildId: snowflakeSchema.optional(),
});

export type ServerListQuery = z.infer<typeof serverListQuerySchema>;


// -------------------------------------------------------------------------
// Local node schemas
// -------------------------------------------------------------------------

/** Body schema for PATCH /api/localnode/logs */
export const refreshLogsSchema = z.object({
    currentLogsLength: z.number().int().nonnegative(),
});

export type RefreshLogsBody = z.infer<typeof refreshLogsSchema>;

/** Body schema for POST /api/localnode/control */
export const localNodeControlSchema = z.object({
    type: z.enum(['RESTART', 'STOP']),
});

export type LocalNodeControlBody = z.infer<typeof localNodeControlSchema>;

export const localNodeProcessSchema = z.object({
    forceRestart: z.boolean().optional().default(false),
});

export type LocalNodeProcessBody = z.infer<typeof localNodeProcessSchema>;
