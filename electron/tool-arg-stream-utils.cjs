function tryParseToolArgsObject(value) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
        const parsed = JSON.parse(trimmed);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        return parsed;
    } catch (_) {
        return null;
    }
}

function mergeToolArgs(currentArgs, incomingArgs) {
    const current = currentArgs || '';
    const incoming = incomingArgs || '';
    if (!incoming) return current;

    const incomingObject = tryParseToolArgsObject(incoming);
    if (incomingObject) return JSON.stringify(incomingObject);

    if (!current) return incoming;
    if (incoming.length >= current.length && incoming.startsWith(current)) return incoming;
    if (current.length > incoming.length && current.startsWith(incoming)) return current;
    return current + incoming;
}

function computeToolArgDelta(previousArgs, nextArgs) {
    const prev = previousArgs || '';
    const next = nextArgs || '';
    if (!next) return '';
    if (!prev) return next;
    if (next === prev) return '';
    if (next.startsWith(prev)) return next.slice(prev.length);
    return null;
}

module.exports = {
    tryParseToolArgsObject,
    mergeToolArgs,
    computeToolArgDelta,
};
