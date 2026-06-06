export interface LogEntry {
    cursor: number;
    lineNumber: number;
    message: string;
}

export interface LogsPage {
    items: LogEntry[];
    sourceId: string;
    pagination: {
        limit: number;
        oldestCursor: number | null;
        newestCursor: number | null;
        hasOlder: boolean;
        hasNewer: boolean;
        totalItems: number;
    };
}

export interface LogsQuery {
    limit: number;
    before?: number;
    after?: number;
}

export function paginateLogLines(
    lines: string[],
    query: LogsQuery,
    sourceId: string = 'default',
    /**
     * The number of log lines that precede the first element of `lines` in the
     * full file. Pass `query.after` when the array is a pre-filtered slice from
     * `getLogsAfterLine()`; pass 0 (default) for full-file or before-filtered slices.
     */
    lineOffset: number = 0,
    /**
     * The real total line count of the full log file.
     * Defaults to `lines.length + lineOffset` (correct for full-array calls).
     * Must be provided when passing a pre-filtered slice so that `hasNewer`,
     * `hasOlder`, and `totalItems` reflect the complete file.
     */
    totalLines?: number,
): LogsPage {
    const totalItems = totalLines ?? lines.length + lineOffset;
    const items: LogEntry[] = [];

    if (query.after !== undefined) {
        // lines[] contains only entries AFTER query.after; element at index i has
        // real cursor lineOffset+i+1.  Iterate newest-first (descending cursor).
        const startCursor = totalItems;
        const stopCursor = Math.max(query.after + 1, 1);

        for (let cursor = startCursor; cursor >= stopCursor && items.length < query.limit; cursor -= 1) {
            items.push({
                cursor,
                lineNumber: cursor,
                message: lines[cursor - lineOffset - 1] ?? '',
            });
        }
    }
    else {
        // lines[] starts at real cursor lineOffset+1; iterate newest-first.
        const startCursor = query.before !== undefined
            ? Math.min(query.before - 1, totalItems)
            : totalItems;

        for (let cursor = startCursor; cursor > lineOffset && items.length < query.limit; cursor -= 1) {
            items.push({
                cursor,
                lineNumber: cursor,
                message: lines[cursor - lineOffset - 1] ?? '',
            });
        }
    }

    const newestCursor = items[0]?.cursor ?? null;
    const oldestCursor = items.at(-1)?.cursor ?? null;

    // For `after=N` queries, hasOlder means "there are more NEW entries between N
    // and the oldest item we returned" — i.e. the page was not able to reach N+1.
    // For before/initial queries, hasOlder means "there are entries before cursor 1".
    const hasOlderBound = query.after !== undefined ? Math.max(query.after + 1, 1) : 1;

    return {
        items,
        sourceId,
        pagination: {
            limit: query.limit,
            oldestCursor,
            newestCursor,
            hasOlder: oldestCursor !== null ? oldestCursor > hasOlderBound : false,
            hasNewer: newestCursor !== null ? newestCursor < totalItems : false,
            totalItems,
        },
    };
}