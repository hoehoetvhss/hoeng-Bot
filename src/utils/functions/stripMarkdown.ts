function stripMarkdown(text: string): string {
    if (!text) return '';
    return text
        .replace(/(\*\*|__|\*|_|~~|\|\|)/g, '')
        .replace(/(`{1,3})/g, '')
        .replace(/^\s*>\s+/gm, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^\s*#{1,6}\s+/gm, '');
}

export { stripMarkdown };
