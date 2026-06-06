import type { Response } from 'express';


export interface ApiProblem {
    type?: string;
    title: string;
    status: number;
    detail?: string;
    code?: string;
    errors?: unknown;
}

export interface CursorPagination {
    limit: number;
    nextCursor: string | null;
    hasMore: boolean;
}

export interface PagePagination {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

export interface CursorPageResponse<T> {
    items: T[];
    pagination: CursorPagination;
}

export interface PageResponse<T> {
    items: T[];
    pagination: PagePagination;
}

export function ok<T>(res: Response, body: T): Response<T> {
    return res.status(200).json(body);
}

export function created<T>(res: Response, body: T): Response<T> {
    return res.status(201).json(body);
}

export function noContent(res: Response): Response {
    return res.status(204).send();
}

export function problem(
    res: Response,
    {
        status,
        title,
        detail,
        code,
        errors,
        type = 'about:blank',
    }: ApiProblem,
): Response<ApiProblem> {
    return res.status(status).json({
        type,
        title,
        status,
        detail,
        code,
        errors,
    });
}