const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { app } = require('electron');
const { TOOL_DEFINITIONS, executeTool } = require('./tools.cjs');
const { runResearchPipeline } = require('./research-orchestrator.cjs');
const { resolveRequestedModelForMode } = require('./chat-config.cjs');
const { buildSelfHostedSystemPrompt } = require('./system-prompt-utils.cjs');
const {
    getInstallProfile,
    getGlobalConfigFilePath,
    getManagedConnectorStatuses,
    mergeMcpServerConfig,
    removeMcpServerConfig,
} = require('./connector-mcp-config.cjs');
const {
    buildComposioServerConfig,
    createComposioLink,
    createComposioSession,
    getComposioConnectorStatuses,
    getComposioProfile,
    getComposioSession,
    getComposioToolkits,
    getStoredComposioSession,
    hasInstalledComposioServer,
    listComposioToolkitSlugs,
    readComposioSessionStore,
    upsertStoredComposioSession,
    writeComposioSessionStore,
    COMPOSIO_SERVER_NAME,
} = require('./connector-composio.cjs');
const {
    readComposioConfig,
    writeComposioConfig,
    getResolvedComposioApiKey,
} = require('./connector-composio-config.cjs');

// Heuristic: when research_mode is enabled, decide whether THIS message
// should actually trigger the research pipeline. Greetings, very short
// questions, and slash commands do not. Real research questions do.
function shouldRunResearch(message) {
    const trimmed = (message || '').trim();
    if (!trimmed) return false;
    if (trimmed.length < 20) return false;
    if (trimmed.startsWith('/')) return false;
    // Common short conversational openers
    const greetings = /^(hi|hello|hey|yo|sup|你好|嗨|哈喽|在吗|thanks?|thank you|谢谢|ok|okay|好的)\b/i;
    if (greetings.test(trimmed) && trimmed.length < 40) return false;
    return true;
}

// No longer needed 鈥?SDK removed, using direct API calls
function enableNodeModeForChildProcesses() {
    console.log('[Engine] Direct API mode 鈥?no SDK subprocess needed');
}

// Load custom system prompt (only affects this Electron app, not external CLI usage)
const CUSTOM_SYSTEM_PROMPT_PATH = path.join(__dirname, 'system-prompt.txt');
let customSystemPromptFull = '';  // Full prompt including anti-Kiro sections (for Clawparrot)
let customSystemPromptClean = ''; // Without anti-Kiro sections (for self-hosted)
try {
    if (fs.existsSync(CUSTOM_SYSTEM_PROMPT_PATH)) {
        customSystemPromptFull = fs.readFileSync(CUSTOM_SYSTEM_PROMPT_PATH, 'utf8');
        // Keep the Claude Desktop chat style for self-hosted users, but replace
        // Claude-specific identity claims with a provider-neutral identity block.
        customSystemPromptClean = buildSelfHostedSystemPrompt(customSystemPromptFull);
        console.log(`[System Prompt] Loaded (full=${customSystemPromptFull.length}, clean=${customSystemPromptClean.length} chars)`);
    } else {
        console.warn('[System Prompt] Custom prompt file not found at:', CUSTOM_SYSTEM_PROMPT_PATH);
    }
} catch (e) {
    console.error('[System Prompt] Failed to load:', e.message);
}

function initServer(mainWindow) {
    const server = express();
    const userDataPath = app.getPath('userData');

    // ── Origin 白名单 (安全关键) ──────────────────────────────
    // bridge-server 监听 127.0.0.1:30080 — 默认情况下任何用户访问的恶意网页都能
    // fetch 到这里, 触发 readFile/copyFile/spawn 等端点造成任意文件读写甚至 RCE.
    // 这里限制只接受 Electron 自身 (file:// origin = 'null' 或无 Origin header)
    // 和 dev server (localhost:3000) 的请求; 其他 Origin 直接 403.
    // Top-level navigation (OAuth redirect 等) 不带 Origin header, 也会放行.
    const isAllowedOrigin = (origin) => {
        if (!origin) return true; // no Origin header — top-level nav / non-browser
        if (origin === 'null') return true; // file:// in Chromium
        if (origin.startsWith('file://')) return true;
        if (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') return true; // vite dev
        return false;
    };
    server.use((req, res, next) => {
        const origin = req.headers.origin;
        if (!isAllowedOrigin(origin)) {
            console.warn('[Security] Blocked cross-origin request from', origin, 'to', req.method, req.url);
            return res.status(403).json({ error: 'cross-origin request denied' });
        }
        next();
    });
    server.use(cors({
        origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
        credentials: false,
    }));
    server.use(express.json({ limit: '5mb' }));

    function readJsonConfig(configPath) {
        try {
            if (!fs.existsSync(configPath)) {
                return {};
            }
            const raw = fs.readFileSync(configPath, 'utf8');
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            throw new Error(`Failed to read config at ${configPath}: ${error.message}`);
        }
    }

    function readConnectorGlobalConfig() {
        const configPath = getGlobalConfigFilePath();
        return {
            configPath,
            config: readJsonConfig(configPath),
        };
    }

    function writeConnectorGlobalConfig(config) {
        const configPath = getGlobalConfigFilePath();
        const parentDir = path.dirname(configPath);
        fs.mkdirSync(parentDir, { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
        return configPath;
    }

    const composioConfigPath = path.join(userDataPath, 'connector-composio.json');
    const composioSessionsPath = path.join(userDataPath, 'connector-composio-sessions.json');

    function readStoredComposioConfig() {
        return readComposioConfig(composioConfigPath);
    }

    function getComposioApiKey() {
        return getResolvedComposioApiKey({
            config: readStoredComposioConfig(),
            env: process.env,
        });
    }

    function readComposioSessions() {
        return readComposioSessionStore(composioSessionsPath);
    }

    function writeComposioSessions(store) {
        writeComposioSessionStore(composioSessionsPath, store);
    }

    async function ensureComposioSession(userId) {
        const apiKey = getComposioApiKey();
        if (!apiKey) {
            throw new Error('Composio API key is not configured');
        }

        const normalizedUserId = String(userId || '').trim();
        if (!normalizedUserId) {
            throw new Error('A stable userId is required for Composio connectors');
        }

        const store = readComposioSessions();
        const stored = getStoredComposioSession(store, normalizedUserId);

        if (stored?.sessionId) {
            try {
                const existing = await getComposioSession({
                    apiKey,
                    sessionId: stored.sessionId,
                });
                const nextStore = upsertStoredComposioSession(store, normalizedUserId, existing);
                writeComposioSessions(nextStore);
                return existing;
            } catch (error) {
                if (error?.status && error.status !== 404) {
                    throw error;
                }
            }
        }

        const created = await createComposioSession({
            apiKey,
            toolkitSlugs: listComposioToolkitSlugs(),
            userId: normalizedUserId,
        });

        const nextStore = upsertStoredComposioSession(store, normalizedUserId, created);
        writeComposioSessions(nextStore);
        return created;
    }

    async function buildComposioStatusPayload(userId) {
        const { configPath, config } = readConnectorGlobalConfig();
        const apiKey = getComposioApiKey();
        const normalizedUserId = String(userId || '').trim();
        const session = apiKey && normalizedUserId ? await ensureComposioSession(normalizedUserId) : null;
        const toolkitItems =
            apiKey && session?.sessionId
                ? await getComposioToolkits({
                    apiKey,
                    sessionId: session.sessionId,
                    toolkitSlugs: listComposioToolkitSlugs(),
                })
                : [];
        const connectors = getComposioConnectorStatuses({
            config,
            toolkitItems,
        });

        return {
            configPath,
            configured: Boolean(apiKey),
            connectors,
            mcpUrl: session?.mcpUrl || null,
            serverInstalled: hasInstalledComposioServer(config),
            sessionId: session?.sessionId || null,
        };
    }

    // Track active engine child processes per conversation (for stdin writes like AskUserQuestion)
    const activeChildren = new Map();

    // Stash original AskUserQuestion input per conversation so /answer can merge user answers into updatedInput
    const askUserPendingInputs = new Map();

    // Per-conversation stream state: buffer events so frontend can reconnect mid-stream
    // Key: conversationId, Value: { events: [], listeners: Set<res>, done: boolean }
    const activeStreams = new Map();

    function broadcastSSE(conversationId, event) {
        const stream = activeStreams.get(conversationId);
        if (!stream) return;
        stream.events.push(event);
        const line = 'data: ' + JSON.stringify(event) + '\n\n';
        var arr = Array.from(stream.listeners);
        for (var i = 0; i < arr.length; i++) {
            try { arr[i].write(line); } catch (_) { stream.listeners.delete(arr[i]); }
        }
    }

    function endStream(conversationId) {
        const stream = activeStreams.get(conversationId);
        if (!stream) return;
        stream.done = true;
        // End the primary POST response
        if (stream.primaryRes) {
            try { stream.primaryRes.write('data: [DONE]\n\n'); stream.primaryRes.end(); } catch (_) {}
            stream.primaryRes = null;
        }
        // End all reconnect listeners
        for (const r of stream.listeners) {
            try { r.write('data: [DONE]\n\n'); r.end(); } catch (_) {}
        }
        stream.listeners.clear();
        // Keep buffer for 30s so frontend can still reconnect after slight delay
        setTimeout(() => { if (activeStreams.get(conversationId) === stream) activeStreams.delete(conversationId); }, 30000);
    }
    function consumeSSEPayloads(buffer) {
        const normalized = String(buffer || '').replace(/\r\n/g, '\n');
        const parts = normalized.split('\n\n');
        const remainder = parts.pop() || '';
        const payloads = [];
        for (const part of parts) {
            const dataLines = [];
            for (const rawLine of part.split('\n')) {
                if (!rawLine.startsWith('data:')) continue;
                dataLines.push(rawLine.slice(5).replace(/^ /, ''));
            }
            if (dataLines.length > 0) payloads.push(dataLines.join('\n').trim());
        }
        return { payloads, remainder };
    }
    function decodeLooseJsonString(value) {
        if (typeof value !== 'string') return '';
        try { return JSON.parse('"' + value.replace(/\r/g, '\\r').replace(/\n/g, '\\n') + '"'); } catch (_) { return value; }
    }
    function extractLooseJsonStringField(raw, fieldName, allowTruncated) {
        if (!raw) return null;
        const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp('"' + escapedField + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 's');
        const match = raw.match(pattern);
        if (match) return decodeLooseJsonString(match[1]);
        if (allowTruncated) {
            const openPattern = new RegExp('"' + escapedField + '"\\s*:\\s*"');
            const openMatch = raw.match(openPattern);
            if (openMatch) {
                const startIdx = openMatch.index + openMatch[0].length;
                let truncated = raw.slice(startIdx);
                // Strip trailing incomplete escape sequence (odd number of backslashes)
                truncated = truncated.replace(/\\+$/, (m) => m.length % 2 === 0 ? m : m.slice(0, -1));
                if (truncated.length > 0) return decodeLooseJsonString(truncated);
            }
        }
        return null;
    }
    function extractLooseJsonBooleanField(raw, fieldName) {
        if (!raw) return null;
        const pattern = new RegExp('"' + fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*:\\s*(true|false)', 'i');
        const match = raw.match(pattern);
        if (!match) return null;
        return String(match[1]).toLowerCase() === 'true';
    }
    function extractLooseJsonNumberField(raw, fieldName) {
        if (!raw) return null;
        const pattern = new RegExp('"' + fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)', 'i');
        const match = raw.match(pattern);
        if (!match) return null;
        const num = Number(match[1]);
        return Number.isFinite(num) ? num : null;
    }
    function recoverMalformedToolInput(toolName, rawArgs) {
        if (!rawArgs || typeof rawArgs !== 'string') return null;
        try { return JSON.parse(rawArgs); } catch (_) {}
        if (toolName === 'Write') {
            const filePath = extractLooseJsonStringField(rawArgs, 'file_path');
            const content = extractLooseJsonStringField(rawArgs, 'content', true);
            if (filePath != null && content != null) return { file_path: filePath, content };
            return null;
        }
        if (toolName === 'Edit') {
            const filePath = extractLooseJsonStringField(rawArgs, 'file_path');
            const oldString = extractLooseJsonStringField(rawArgs, 'old_string');
            const newString = extractLooseJsonStringField(rawArgs, 'new_string');
            const replaceAll = extractLooseJsonBooleanField(rawArgs, 'replace_all');
            if (filePath != null && oldString != null && newString != null) {
                return { file_path: filePath, old_string: oldString, new_string: newString, replace_all: replaceAll === true };
            }
            return null;
        }
        if (toolName === 'Read') {
            const filePath = extractLooseJsonStringField(rawArgs, 'file_path');
            const offset = extractLooseJsonNumberField(rawArgs, 'offset');
            const limit = extractLooseJsonNumberField(rawArgs, 'limit');
            if (filePath != null) return { file_path: filePath, offset: offset == null ? undefined : offset, limit: limit == null ? undefined : limit };
            return null;
        }
        if (toolName === 'Bash') {
            const command = extractLooseJsonStringField(rawArgs, 'command', true);
            const timeout = extractLooseJsonNumberField(rawArgs, 'timeout');
            if (command != null) return { command, timeout: timeout == null ? undefined : timeout };
            return null;
        }
        return null;
    }

    // Setup paths
    const dbPath = path.join(userDataPath, 'claude-desktop.json');

    // Workspace: use user-chosen path, or default to ~/Documents/Claude Desktop
    const defaultWorkspacesDir = path.join(app.getPath('documents'), 'Claude Desktop');
    // Read saved preference (set by onboarding or settings)
    let workspacesDir;
    try {
        const settingsPath = path.join(userDataPath, 'workspace-config.json');
        if (fs.existsSync(settingsPath)) {
            const cfg = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            workspacesDir = cfg.workspacesDir || defaultWorkspacesDir;
        } else {
            workspacesDir = defaultWorkspacesDir;
        }
    } catch (_) {
        workspacesDir = defaultWorkspacesDir;
    }

    if (!fs.existsSync(workspacesDir)) {
        fs.mkdirSync(workspacesDir, { recursive: true });
    }
    console.log('[Workspace]', workspacesDir);

    // Initialize DB
    let db = { conversations: [], messages: [], projects: [], project_files: [] };
    if (fs.existsSync(dbPath)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            db = { ...db, ...loaded };
            // Ensure new arrays exist for older DB files
            if (!db.projects) db.projects = [];
            if (!db.project_files) db.project_files = [];
        } catch (e) { }
    }
    const saveDb = () => fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    // ===== Provider Management =====
    const providersPath = path.join(userDataPath, 'providers.json');
    let providers = [];
    try {
        if (fs.existsSync(providersPath)) {
            providers = JSON.parse(fs.readFileSync(providersPath, 'utf8'));
        }
    } catch (_) {}
    const saveProviders = () => fs.writeFileSync(providersPath, JSON.stringify(providers, null, 2));

    // Resolve provider + key + url for a given model ID
    function resolveProvider(modelId) {
        // Search all enabled providers for this model
        let match = null;
        for (const p of providers) {
            if (!p.enabled) continue;
            if (p.models && p.models.some(m => m.id === modelId && m.enabled !== false)) {
                if (!match) {
                    match = p;
                } else {
                    console.warn('[Provider] WARNING: model "' + modelId + '" exists in multiple providers: "' + match.name + '" AND "' + p.name + '". Using first match: "' + match.name + '" (' + match.baseUrl + ')');
                }
            }
        }
        if (match) console.log('[Provider] Resolved "' + modelId + '" 鈫?"' + match.name + '" (' + match.baseUrl + ')');
        else console.log('[Provider] No provider found for "' + modelId + '"');
        return match;
    }

    // ===== URL normalization helper =====
    // Strips known endpoint suffixes so base URLs like
    // "https://api.siliconflow.cn/v1/chat/completions" become "https://api.siliconflow.cn/v1"
    function normalizeBaseUrl(url) {
        if (!url) return url;
        let clean = url.replace(/\/+$/, '');
        clean = clean.replace(/\/(chat\/completions|messages)$/, '');
        return clean.replace(/\/+$/, '');
    }

    // ===== Proxy-level Web Search for OpenAI providers =====
    // Anthropic's web_search_20250305 is a server-side tool handled by the Anthropic API itself.
    // For OpenAI-format providers, we only support web search when the provider has a native
    // capability (DashScope enable_search / BigModel web_search tool). Providers without native
    // support have the web_search_20250305 tool stripped from the request — the model simply
    // doesn't have that tool and cannot claim to search.
    //
    // Strategy per provider:
    //   DashScope (阿里 Qwen): enable_search parameter
    //   BigModel  (智谱 GLM): web_search tool type
    //   Others: not supported (stripped at proxy)

    // Helper: extract URLs from model response text (markdown links + bare URLs)
    function extractUrlsFromText(text) {
        const results = [];
        const seen = new Set();
        // 1. Markdown links: [title](url)
        const mdPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
        let m;
        while ((m = mdPattern.exec(text)) && results.length < 15) {
            if (!seen.has(m[2])) { seen.add(m[2]); results.push({ title: m[1], url: m[2] }); }
        }
        // 2. Bare URLs not already captured
        const barePattern = /https?:\/\/[^\s\)\]<'"]+/g;
        while ((m = barePattern.exec(text)) && results.length < 15) {
            if (!seen.has(m[0])) { seen.add(m[0]); try { results.push({ title: new URL(m[0]).hostname, url: m[0] }); } catch (_) {} }
        }
        return results;
    }

    // Provider search: DashScope (闃块噷浜?鈥?Qwen models)
    async function searchViaDashScope(query, target) {
        let endpoint = normalizeBaseUrl(target.baseUrl);
        if (!endpoint.endsWith('/v1')) endpoint += '/v1';
        endpoint += '/chat/completions';
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + target.apiKey },
            body: JSON.stringify({
                model: target.model || 'qwen-turbo-latest',
                messages: [
                    { role: 'system', content: 'You are a web search assistant. Search the web and return comprehensive, up-to-date results with source links.' },
                    { role: 'user', content: query }
                ],
                enable_search: true,
                search_options: { forced_search: true, search_strategy: 'pro' },
                stream: false, max_tokens: 4096,
            }),
            signal: AbortSignal.timeout(60000),
        });
        if (!resp.ok) { const t = await resp.text().catch(() => ''); throw new Error('DashScope ' + resp.status + ': ' + t.slice(0, 200)); }
        const data = await resp.json();
        const summary = data.choices?.[0]?.message?.content || '';
        // DashScope returns structured results in search_info
        const raw = data.search_info?.search_results || data.web_search_info?.results || data.search_results || [];
        let results = raw.map(r => ({ title: r.title || r.name || '', url: r.url || r.link || '' })).filter(r => r.url);
        if (results.length === 0) results = extractUrlsFromText(summary);
        console.log('[Proxy] DashScope search:', results.length, 'results,', summary.length, 'chars');
        return { searchResults: results, summaryText: summary };
    }

    // Provider search: BigModel (鏅鸿氨AI 鈥?GLM models)
    async function searchViaBigModel(query, target) {
        let endpoint = normalizeBaseUrl(target.baseUrl);
        if (!endpoint.endsWith('/v1')) endpoint += '/v1';
        endpoint += '/chat/completions';
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + target.apiKey },
            body: JSON.stringify({
                model: target.model || 'glm-4-plus',
                messages: [
                    { role: 'system', content: 'You are a web search assistant. Search the web and return comprehensive, up-to-date results with source links.' },
                    { role: 'user', content: query }
                ],
                tools: [{ type: 'web_search', web_search: { enable: true, search_query: query } }],
                stream: false, max_tokens: 4096,
            }),
            signal: AbortSignal.timeout(60000),
        });
        if (!resp.ok) { const t = await resp.text().catch(() => ''); throw new Error('BigModel ' + resp.status + ': ' + t.slice(0, 200)); }
        const data = await resp.json();
        const summary = data.choices?.[0]?.message?.content || '';
        // GLM returns web_search results in the message's tool_calls or inline
        let results = [];
        const webSearchResult = data.web_search || data.choices?.[0]?.message?.web_search;
        if (Array.isArray(webSearchResult)) {
            results = webSearchResult.map(r => ({ title: r.title || '', url: r.link || r.url || '' })).filter(r => r.url);
        }
        if (results.length === 0) results = extractUrlsFromText(summary);
        console.log('[Proxy] BigModel search:', results.length, 'results,', summary.length, 'chars');
        return { searchResults: results, summaryText: summary };
    }

    // Resolve a native search strategy for a provider.
    // Prefers the stored `webSearchStrategy` (set by the probe endpoint). Falls back to URL regex
    // only when no strategy is recorded (e.g. legacy providers imported before the probe existed).
    // Returns null if no native handler applies — caller must not synthesize a result.
    function resolveNativeSearchStrategy(target) {
        const strategy = target.webSearchStrategy;
        if (strategy === 'dashscope') return (q) => searchViaDashScope(q, target);
        if (strategy === 'bigmodel') return (q) => searchViaBigModel(q, target);
        if (strategy) return null; // unknown strategy stored — refuse
        const baseUrl = (target.baseUrl || '').toLowerCase();
        if (/dashscope/i.test(baseUrl)) return (q) => searchViaDashScope(q, target);
        if (/bigmodel|zhipuai/i.test(baseUrl)) return (q) => searchViaBigModel(q, target);
        return null;
    }

    // Main handler: dispatch web_search_20250305 to a native provider strategy.
    // Only called when the provider is known to support web search — there is no generic fallback.
    async function handleWebSearchProxy(anthropicReq, target, res) {
        // Extract search query from messages
        let searchQuery = '';
        const msgs = anthropicReq.messages || [];
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role !== 'user') continue;
            const c = msgs[i].content;
            if (typeof c === 'string') { searchQuery = c; break; }
            if (Array.isArray(c)) { searchQuery = c.filter(b => b.type === 'text').map(b => b.text).join(' '); break; }
        }
        searchQuery = searchQuery.replace(/^Perform a web search for the query:\s*/i, '').trim();
        const baseUrl = (target.baseUrl || '').toLowerCase();
        console.log('[Proxy] WebSearch intercepted, query:', searchQuery, '| provider:', baseUrl.slice(0, 50));

        let searchResults = [];
        let summaryText = '';

        const strategy = resolveNativeSearchStrategy(target);
        if (strategy) {
            try {
                const result = await strategy(searchQuery);
                searchResults = result.searchResults || [];
                summaryText = result.summaryText || '';
            } catch (err) {
                console.warn('[Proxy] Native search failed:', err.message);
                summaryText = 'Web search failed: ' + err.message;
            }
        } else {
            // Should not happen — the tool is stripped before reaching here for unsupported providers.
            summaryText = 'This provider does not support web search.';
        }
        if (!summaryText) summaryText = 'Web search returned no results for: ' + searchQuery;

        // Generate Anthropic-format SSE response with search results
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const toolId = 'toolu_ws_' + Date.now();
        const ev = (name, data) => res.write('event: ' + name + '\ndata: ' + JSON.stringify(data) + '\n\n');

        ev('message_start', { type: 'message_start', message: { id: 'msg_ws_' + Date.now(), type: 'message', role: 'assistant', content: [], model: target.model, usage: { input_tokens: 0, output_tokens: 0 } } });

        // Block 0: server_tool_use (search invocation)
        ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: toolId, name: 'web_search', input: {} } });
        ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify({ query: searchQuery }) } });
        ev('content_block_stop', { type: 'content_block_stop', index: 0 });

        // Block 1: web_search_tool_result (structured results)
        const resultContent = searchResults.length > 0
            ? searchResults.map(r => ({ type: 'web_search_result', title: r.title, url: r.url }))
            : [];
        ev('content_block_start', { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: toolId, content: resultContent } });
        ev('content_block_stop', { type: 'content_block_stop', index: 1 });

        // Block 2: text summary
        ev('content_block_start', { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } });
        if (summaryText) {
            const chunkSize = 200;
            for (let i = 0; i < summaryText.length; i += chunkSize) {
                ev('content_block_delta', { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: summaryText.slice(i, i + chunkSize) } });
            }
        }
        ev('content_block_stop', { type: 'content_block_stop', index: 2 });

        ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: Math.ceil(summaryText.length / 4) } });
        ev('message_stop', { type: 'message_stop' });
        res.end();
    }

    // ===== OpenAI鈫扐nthropic Conversion Proxy =====
    // Runs on a dynamic port; engine points ANTHROPIC_BASE_URL to it
    // The proxy receives Anthropic-format requests, converts to OpenAI format, calls the real endpoint
    const http = require('http');
    let proxyPort = 0;

    // Stored per-request: the proxy reads these to know where to forward
    let proxyTarget = { apiKey: '', baseUrl: '', model: '', format: 'anthropic' };

    // Pending image blocks to inject into the next API request (per-conversation)
    // The chat handler stores base64 images here; the proxy injects them into the user message
    const pendingImageBlocks = new Map();
    const emptyToolCallLoops = new Map(); // conversationId -> { count, toolName, updatedAt } // conversationId 鈫?[{ type: 'image', source: { type: 'base64', media_type, data } }]

    const proxyServer = http.createServer(async (req, res) => {
        if (req.method === 'POST' && req.url.includes('/messages')) {
            let body = '';
            req.on('data', c => body += c);
            req.on('end', async () => {
                try {
                    const anthropicReq = JSON.parse(body);
                    const target = proxyTarget;
                    const proxyReqId = 'proxy_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
                    console.log('[Proxy] Request start',
                        '| id=', proxyReqId,
                        '| conv=', target.conversationId || '',
                        '| model=', target.model || anthropicReq.model || '',
                        '| msgCount=', Array.isArray(anthropicReq.messages) ? anthropicReq.messages.length : 0,
                        '| toolCount=', Array.isArray(anthropicReq.tools) ? anthropicReq.tools.length : 0,
                        '| hasThinking=', !!anthropicReq.thinking);

                    // Inject any pending image blocks into the last user message
                    // (images uploaded by the user that need to be embedded in the API request)
                    // Only inject into the initial user message (not tool_result follow-ups).
                    // Don't delete 鈥?keep for retries. The chat handler clears after engine exits.
                    if (target.conversationId && pendingImageBlocks.has(target.conversationId)) {
                        const imgBlocks = pendingImageBlocks.get(target.conversationId);
                        if (imgBlocks && imgBlocks.length > 0 && anthropicReq.messages) {
                            // Find the last user message that has text (not just tool_result)
                            for (let i = anthropicReq.messages.length - 1; i >= 0; i--) {
                                const msg = anthropicReq.messages[i];
                                if (msg.role !== 'user') continue;
                                const parts = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
                                const hasToolResult = parts.some(b => b.type === 'tool_result');
                                if (hasToolResult) continue; // Skip tool_result messages
                                const existingContent = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
                                // Don't inject if images already present (re-injection on retry)
                                if (existingContent.some(b => b.type === 'image')) break;
                                msg.content = [...imgBlocks, ...existingContent];
                                console.log('[Proxy] Injected', imgBlocks.length, 'image block(s) into user message');
                                break;
                            }
                        }
                    }

                    // Intercept web_search_20250305 server tool for OpenAI providers.
                    // If the provider declares native web search support AND we have a known
                    // native handler for its baseUrl, dispatch. Otherwise, strip the tool so
                    // the model cannot claim to search (no generic fallback).
                    const hasServerWebSearch = (anthropicReq.tools || []).some(t => t.type === 'web_search_20250305');
                    if (hasServerWebSearch && target.format === 'openai') {
                        const nativeAvailable = target.supportsWebSearch === true && resolveNativeSearchStrategy(target) !== null;
                        if (nativeAvailable) {
                            return await handleWebSearchProxy(anthropicReq, target, res);
                        }
                        anthropicReq.tools = (anthropicReq.tools || []).filter(t => t.type !== 'web_search_20250305');
                        console.log('[Proxy] Stripped web_search_20250305 (provider does not support web search)');
                    }

                    if (target.format === 'openai') {
                        // Convert Anthropic 鈫?OpenAI format
                        const openaiMessages = [];
                        if (anthropicReq.system) {
                            const sysText = Array.isArray(anthropicReq.system)
                                ? anthropicReq.system.map(b => typeof b === 'string' ? b : b.text || '').join('\n')
                                : anthropicReq.system;
                            openaiMessages.push({ role: 'system', content: sysText });
                        }
                        for (const msg of (anthropicReq.messages || [])) {
                            if (msg.role === 'user') {
                                // User messages may contain text, image, and tool_result blocks
                                const parts = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
                                const textParts = parts.filter(b => b.type === 'text').map(b => b.text || '');
                                const imageParts = parts.filter(b => b.type === 'image');
                                const toolResults = parts.filter(b => b.type === 'tool_result');
                                if (toolResults.length > 0) {
                                    for (const tr of toolResults) {
                                        const trContent = Array.isArray(tr.content) ? tr.content.map(b => b.text || '').join('') : (tr.content || '');
                                        openaiMessages.push({ role: 'tool', tool_call_id: tr.tool_use_id, content: trContent });
                                    }
                                }
                                if (imageParts.length > 0) {
                                    // Build multimodal user message with text + images (OpenAI format)
                                    const contentArray = [];
                                    const joinedText = textParts.join('').trim();
                                    if (joinedText) contentArray.push({ type: 'text', text: joinedText });
                                    for (const img of imageParts) {
                                        if (img.source && img.source.type === 'base64') {
                                            contentArray.push({ type: 'image_url', image_url: { url: `data:${img.source.media_type};base64,${img.source.data}` } });
                                        }
                                    }
                                    if (contentArray.length > 0) openaiMessages.push({ role: 'user', content: contentArray });
                                } else if (textParts.join('').trim()) {
                                    openaiMessages.push({ role: 'user', content: textParts.join('') });
                                }
                            } else if (msg.role === 'assistant') {
                                const parts = Array.isArray(msg.content) ? msg.content : [{ type: 'text', text: msg.content }];
                                const textContent = parts.filter(b => b.type === 'text').map(b => b.text || '').join('');
                                const toolUses = parts.filter(b => b.type === 'tool_use');
                                if (toolUses.length > 0) {
                                    openaiMessages.push({
                                        role: 'assistant',
                                        content: textContent || null,
                                        tool_calls: toolUses.map(tu => ({
                                            id: tu.id, type: 'function',
                                            function: { name: tu.name, arguments: JSON.stringify(tu.input || {}) }
                                        }))
                                    });
                                } else {
                                    openaiMessages.push({ role: 'assistant', content: textContent });
                                }
                            }
                        }

                        // Convert Anthropic tools 鈫?OpenAI tools
                        const openaiTools = (anthropicReq.tools || []).map(t => ({
                            type: 'function',
                            function: {
                                name: t.name,
                                description: t.description || '',
                                parameters: t.input_schema || { type: 'object', properties: {} },
                            }
                        }));

                        const openaiBody = {
                            model: target.model || anthropicReq.model,
                            messages: openaiMessages,
                            max_tokens: Math.min(anthropicReq.max_tokens || 8192, 32768),
                            stream: true,
                        };
                        if (openaiTools.length > 0) openaiBody.tools = openaiTools;
                        // Prevent providers from batching many tool calls in a single assistant turn.
                        // Batched Edit calls are often computed against stale file content and cause
                        // "String to replace not found" loops.
                        if (openaiTools.length > 0 && /qwen|glm|deepseek|minimax/i.test(String(target.model || anthropicReq.model || ''))) {
                            openaiBody.parallel_tool_calls = false;
                        }
                        if (anthropicReq.temperature != null) openaiBody.temperature = anthropicReq.temperature;
                        // Convert Anthropic thinking config 鈫?OpenAI-compatible thinking params
                        // Qwen uses enable_thinking, DeepSeek uses similar pattern
                        if (anthropicReq.thinking && anthropicReq.thinking.type === 'enabled') {
                            const incompatibleThinkingToolModel = /qwen|glm|deepseek|minimax/i.test(String(target.model || anthropicReq.model || ''));
                            // Only disable thinking+tools for model families we've actually seen
                            // misroute tool arguments into reasoning_content. Claude-compatible
                            // OpenAI relays should still receive enable_thinking when the user
                            // explicitly selected Extended thinking.
                            if (openaiTools.length > 0 && incompatibleThinkingToolModel) {
                                console.log('[Proxy] Tools present on known-incompatible reasoning model 鈥?disabling thinking to avoid empty tool args');
                            } else {
                                openaiBody.enable_thinking = true;
                            }
                        }

                        if (openaiTools.length > 0 && /qwen|deepseek/i.test(String(target.model || anthropicReq.model || ''))) {
                            // Some OpenAI-compatible reasoning models emit reasoning_content by default even when
                            // thinking wasn't explicitly requested. Force-disable it on tool turns.
                            openaiBody.enable_thinking = false;
                        }

                        let endpoint = normalizeBaseUrl(target.baseUrl);
                        if (!endpoint.endsWith('/v1')) endpoint += '/v1';
                        endpoint += '/chat/completions';

                        // Retry fetch up to 2 times on network errors (DNS cold-start, connection reset, etc.)
                        // This avoids the much slower engine-level api_retry which adds seconds of backoff delay
                        let upstreamRes;
                        const maxRetries = 2;
                        const bodyStr = JSON.stringify(openaiBody);
                        for (let attempt = 0; attempt <= maxRetries; attempt++) {
                            const fetchController = new AbortController();
                            const fetchTimeout = setTimeout(() => fetchController.abort(), 300000); // 5 min
                            try {
                                console.log('[Proxy] Upstream fetch',
                                    '| id=', proxyReqId,
                                    '| attempt=', attempt + 1,
                                    '| endpoint=', endpoint,
                                    '| model=', openaiBody.model,
                                    '| tools=', Array.isArray(openaiBody.tools) ? openaiBody.tools.length : 0,
                                    '| enable_thinking=', openaiBody.enable_thinking === true,
                                    '| parallel_tool_calls=', openaiBody.parallel_tool_calls);
                                upstreamRes = await fetch(endpoint, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + target.apiKey },
                                    body: bodyStr,
                                    signal: fetchController.signal,
                                });
                                clearTimeout(fetchTimeout);
                                break; // success
                            } catch (fetchErr) {
                                clearTimeout(fetchTimeout);
                                if (attempt < maxRetries) {
                                    console.warn('[Proxy] Fetch attempt ' + (attempt + 1) + ' failed: ' + (fetchErr.message || fetchErr) + ', retrying in 300ms...');
                                    await new Promise(r => setTimeout(r, 300));
                                    continue;
                                }
                                console.error('[Proxy] Fetch error after ' + (maxRetries + 1) + ' attempts:', fetchErr.message || fetchErr);
                                res.writeHead(502, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: 'Failed to connect to upstream: ' + (fetchErr.message || 'timeout') } }));
                                return;
                            }
                        }

                        if (!upstreamRes.ok) {
                            const errText = await upstreamRes.text();
                            // Include the upstream URL in error so users can see where the request went
                            const errMsg = 'Failed to authenticate. API Error: ' + upstreamRes.status + ' ' + errText.slice(0, 400) + ' [endpoint: ' + endpoint + ']';
                            console.error('[Proxy] Upstream error:', upstreamRes.status, 'from', endpoint, errText.slice(0, 200));
                            res.writeHead(upstreamRes.status, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: errMsg } }));
                            return;
                        }

                        // Stream OpenAI SSE 鈫?convert to Anthropic SSE format
                        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });

                        // Send message_start
                        res.write('event: message_start\ndata: ' + JSON.stringify({
                            type: 'message_start',
                            message: { id: 'msg_proxy', type: 'message', role: 'assistant', content: [], model: target.model, usage: { input_tokens: 0, output_tokens: 0 } }
                        }) + '\n\n');

                        const reader = upstreamRes.body.getReader();
                        const decoder = new TextDecoder();
                        let sseBuffer = '';
                        let totalTokens = 0;
                        let nextContentBlockIndex = 0;
                        let textBlockIndex = null;
                        let thinkingBlockIndex = null;
                        let emittedToolCalls = false;
                        // Track tool_calls being streamed (OpenAI streams them incrementally).
                        // Buffer them until the end of the tool-call turn so we can emit valid
                        // Anthropic tool_use blocks even if the upstream provider interleaves
                        // reasoning_content and tool_calls.
                        const pendingToolCalls = new Map(); // key -> { id, name, args }
                        const writeProxyEvent = (eventName, payload) => {
                            res.write('event: ' + eventName + '\ndata: ' + JSON.stringify(payload) + '\n\n');
                        };
                        const closeThinkingBlock = () => {
                            if (thinkingBlockIndex == null) return;
                            writeProxyEvent('content_block_stop', { type: 'content_block_stop', index: thinkingBlockIndex });
                            thinkingBlockIndex = null;
                        };
                        const closeTextBlock = () => {
                            if (textBlockIndex == null) return;
                            writeProxyEvent('content_block_stop', { type: 'content_block_stop', index: textBlockIndex });
                            textBlockIndex = null;
                        };
                        const closeToolBlock = (ptc) => {
                            if (!ptc || ptc.blockIndex == null || ptc.blockClosed) return;
                            writeProxyEvent('content_block_stop', { type: 'content_block_stop', index: ptc.blockIndex });
                            ptc.blockClosed = true;
                        };
                        const closeOpenToolBlocks = () => {
                            for (const ptc of pendingToolCalls.values()) closeToolBlock(ptc);
                        };
                        const ensureThinkingBlock = () => {
                            if (thinkingBlockIndex != null) return;
                            closeOpenToolBlocks();
                            closeTextBlock();
                            thinkingBlockIndex = nextContentBlockIndex++;
                            writeProxyEvent('content_block_start', {
                                type: 'content_block_start',
                                index: thinkingBlockIndex,
                                content_block: { type: 'thinking', thinking: '' }
                            });
                        };
                        const ensureTextBlock = () => {
                            if (textBlockIndex != null) return;
                            closeOpenToolBlocks();
                            closeThinkingBlock();
                            textBlockIndex = nextContentBlockIndex++;
                            writeProxyEvent('content_block_start', {
                                type: 'content_block_start',
                                index: textBlockIndex,
                                content_block: { type: 'text', text: '' }
                            });
                        };
                        const normalizeToolArgsToString = (argsValue) => {
                            if (argsValue == null) return '';
                            if (typeof argsValue === 'string') return argsValue;
                            if (typeof argsValue === 'object') {
                                try { return JSON.stringify(argsValue); } catch (_) { return ''; }
                            }
                            return String(argsValue);
                        };
                        const mergeToolArgs = (currentArgs, incomingArgs) => {
                            if (!incomingArgs) return currentArgs || '';
                            if (!currentArgs) return incomingArgs;
                            // Some OpenAI-compatible providers stream cumulative argument snapshots
                            // instead of append-only deltas. Detect and replace in that case.
                            if (incomingArgs.length >= currentArgs.length && incomingArgs.startsWith(currentArgs)) {
                                return incomingArgs;
                            }
                            if (currentArgs.length > incomingArgs.length && currentArgs.startsWith(incomingArgs)) {
                                return currentArgs;
                            }
                            return currentArgs + incomingArgs;
                        };
                        const computeToolArgDelta = (previousArgs, nextArgs) => {
                            const prev = previousArgs || '';
                            const next = nextArgs || '';
                            if (!next) return '';
                            if (!prev) return next;
                            if (next.startsWith(prev)) return next.slice(prev.length);
                            if (prev.startsWith(next)) return '';

                            let sharedPrefixLength = 0;
                            const maxPrefix = Math.min(prev.length, next.length);
                            while (sharedPrefixLength < maxPrefix && prev[sharedPrefixLength] === next[sharedPrefixLength]) {
                                sharedPrefixLength += 1;
                            }
                            return next.slice(sharedPrefixLength);
                        };
                        const ensureLiveToolBlock = (ptc) => {
                            if (!ptc || ptc.blockClosed || ptc.blockIndex != null || !ptc.name) return;
                            closeThinkingBlock();
                            closeTextBlock();
                            ptc.blockIndex = nextContentBlockIndex++;
                            if (!ptc.id) ptc.id = 'call_' + ptc.blockIndex;
                            writeProxyEvent('content_block_start', {
                                type: 'content_block_start',
                                index: ptc.blockIndex,
                                content_block: { type: 'tool_use', id: ptc.id, name: ptc.name, input: {} }
                            });
                        };
                        const emitLiveToolArgDelta = (ptc) => {
                            if (!ptc) return;
                            ensureLiveToolBlock(ptc);
                            if (ptc.blockIndex == null || ptc.blockClosed) return;
                            const nextArgs = ptc.args || '';
                            const deltaText = computeToolArgDelta(ptc.sentArgs || '', nextArgs);
                            if (!deltaText) return;
                            writeProxyEvent('content_block_delta', {
                                type: 'content_block_delta',
                                index: ptc.blockIndex,
                                delta: { type: 'input_json_delta', partial_json: deltaText }
                            });
                            ptc.sentArgs = nextArgs;
                        };
                        const upsertPendingToolCall = (rawToolCall, fallbackKey) => {
                            if (!rawToolCall) return;
                            const rawIndex = rawToolCall.index;
                            const rawId = rawToolCall.id;
                            const key = rawIndex != null ? ('idx:' + rawIndex) : (rawId ? ('id:' + rawId) : fallbackKey);
                            if (!pendingToolCalls.has(key)) {
                                pendingToolCalls.set(key, {
                                    id: '',
                                    name: '',
                                    args: '',
                                    sentArgs: '',
                                    blockIndex: null,
                                    blockClosed: false,
                                });
                            }
                            const ptc = pendingToolCalls.get(key);
                            if (rawId && !ptc.id) ptc.id = rawId;
                            const fn = rawToolCall.function || rawToolCall.function_call || {};
                            if (rawToolCall.name && !ptc.name) ptc.name = rawToolCall.name;
                            if (fn.name && !ptc.name) ptc.name = fn.name;
                            const argsChunk = normalizeToolArgsToString(
                                fn.arguments != null ? fn.arguments :
                                rawToolCall.arguments != null ? rawToolCall.arguments :
                                rawToolCall.input != null ? rawToolCall.input :
                                ''
                            );
                            if (argsChunk) ptc.args = mergeToolArgs(ptc.args, argsChunk);
                            emitLiveToolArgDelta(ptc);
                        };
                        const analyzePendingToolCalls = () => {
                            const sortedToolCalls = Array.from(pendingToolCalls.entries());
                            const toolNames = [];
                            let allEmpty = sortedToolCalls.length > 0;
                            let hasMalformed = false;
                            for (const [, ptc] of sortedToolCalls) {
                                const toolName = ptc.name || '';
                                if (toolName) toolNames.push(toolName);
                                let parsedInput = {};
                                let parsedOk = true;
                                let parseErr = null;
                                try { parsedInput = JSON.parse(ptc.args || '{}'); } catch (err) { parsedOk = false; parseErr = err; hasMalformed = !!ptc.args; }
                                const recoveredInput = !parsedOk ? recoverMalformedToolInput(toolName, ptc.args) : null;
                                ptc.recoveredInput = recoveredInput || null;
                                if (ptc.args && Object.keys(parsedInput).length > 0) allEmpty = false;
                                if (recoveredInput && Object.keys(recoveredInput).length > 0) allEmpty = false;
                                if (!ptc.args && toolName) {
                                    console.warn('[Proxy] Tool call "' + toolName + '" has empty args; model may have failed to generate arguments');
                                }
                                if (ptc.args && !parsedOk) {
                                    const firstBrace = ptc.args.indexOf('{');
                                    const lastBrace = ptc.args.lastIndexOf('}');
                                    const openBraces = (ptc.args.match(/\{/g) || []).length;
                                    const closeBraces = (ptc.args.match(/\}/g) || []).length;
                                    console.warn(
                                        '[Proxy] Tool call "' + toolName + '" has malformed args',
                                        '| len=', ptc.args.length,
                                        '| err=', (parseErr && parseErr.message) || 'unknown',
                                        '| firstBrace=', firstBrace,
                                        '| lastBrace=', lastBrace,
                                        '| braces=', openBraces + '/' + closeBraces,
                                        '| recovered=', !!recoveredInput,
                                        '| preview=', ptc.args.slice(0, 300),
                                        '| tail=', ptc.args.slice(-300)
                                    );
                                }
                            }
                            return { sortedToolCalls, toolNames, allEmpty, hasMalformed };
                        };
                        const emitPendingToolCalls = () => {
                            if (emittedToolCalls || pendingToolCalls.size === 0) return;
                            closeThinkingBlock();
                            closeTextBlock();
                            const { sortedToolCalls } = analyzePendingToolCalls();

                            // Suppress completely-empty tool calls (args == '{}' or '').
                            // Models occasionally hallucinate a trailing empty tool call after
                            // a valid one in the same turn; emitting it would trigger
                            // InputValidationError downstream and surface as "Failed" in the UI.
                            const emptyKeys = [];
                            for (const [key, ptc] of sortedToolCalls) {
                                const trimmed = (ptc.args || '').trim();
                                const isEmpty = !trimmed || trimmed === '{}';
                                const recoveredHasFields = ptc.recoveredInput
                                    && typeof ptc.recoveredInput === 'object'
                                    && Object.keys(ptc.recoveredInput).length > 0;
                                if (isEmpty && !recoveredHasFields) {
                                    emptyKeys.push(key);
                                    console.warn('[Proxy] Suppressing empty tool call',
                                        '| tool=', ptc.name || '(unknown)',
                                        '| id=', ptc.id || '(none)');
                                }
                            }
                            for (const key of emptyKeys) pendingToolCalls.delete(key);

                            for (const [key, ptc] of sortedToolCalls) {
                                if (emptyKeys.includes(key)) continue;
                                const recoveredInput = ptc.recoveredInput && typeof ptc.recoveredInput === 'object' ? ptc.recoveredInput : {};
                                ensureLiveToolBlock(ptc);

                                if (ptc.blockIndex == null) {
                                    const blockIndex = nextContentBlockIndex++;
                                    const toolId = ptc.id || ('call_' + blockIndex);
                                    const toolName = ptc.name || '';
                                    writeProxyEvent('content_block_start', {
                                        type: 'content_block_start',
                                        index: blockIndex,
                                        content_block: { type: 'tool_use', id: toolId, name: toolName, input: recoveredInput }
                                    });
                                    if (ptc.args && Object.keys(recoveredInput).length === 0) {
                                        writeProxyEvent('content_block_delta', {
                                            type: 'content_block_delta',
                                            index: blockIndex,
                                            delta: { type: 'input_json_delta', partial_json: ptc.args }
                                        });
                                    }
                                    writeProxyEvent('content_block_stop', { type: 'content_block_stop', index: blockIndex });
                                    ptc.blockIndex = blockIndex;
                                    ptc.blockClosed = true;
                                    ptc.sentArgs = ptc.args || '';
                                    continue;
                                }

                                if (ptc.args && Object.keys(recoveredInput).length === 0) {
                                    emitLiveToolArgDelta(ptc);
                                }
                                closeToolBlock(ptc);
                            }
                            emittedToolCalls = true;
                        };

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            sseBuffer += decoder.decode(value, { stream: true });
                            const consumed = consumeSSEPayloads(sseBuffer);
                            sseBuffer = consumed.remainder;
                            for (const data of consumed.payloads) {
                                if (data === '[DONE]') continue;
                                try {
                                    const chunk = JSON.parse(data);
                                    const choice = chunk.choices?.[0] || {};
                                    const delta = choice.delta;
                                    const finishReason = choice.finish_reason;

                                    if (delta?.reasoning_content) {
                                        ensureThinkingBlock();
                                        writeProxyEvent('content_block_delta', {
                                            type: 'content_block_delta',
                                            index: thinkingBlockIndex,
                                            delta: { type: 'thinking_delta', thinking: delta.reasoning_content }
                                        });
                                    }

                                    if (delta?.content) {
                                        ensureTextBlock();
                                        writeProxyEvent('content_block_delta', {
                                            type: 'content_block_delta',
                                            index: textBlockIndex,
                                            delta: { type: 'text_delta', text: delta.content }
                                        });
                                    }

                                    if (Array.isArray(delta?.tool_calls)) {
                                        for (let i = 0; i < delta.tool_calls.length; i++) upsertPendingToolCall(delta.tool_calls[i], 'delta:' + i);
                                    }
                                    if (delta?.function_call) upsertPendingToolCall({ index: 0, function_call: delta.function_call }, 'legacy-delta:0');
                                    if (Array.isArray(choice.message?.tool_calls)) {
                                        console.log('[Proxy] Using choice.message.tool_calls fallback', '| id=', proxyReqId, '| count=', choice.message.tool_calls.length);
                                        for (let i = 0; i < choice.message.tool_calls.length; i++) upsertPendingToolCall(choice.message.tool_calls[i], 'message:' + i);
                                    }
                                    if (Array.isArray(choice.tool_calls)) {
                                        console.log('[Proxy] Using choice.tool_calls fallback', '| id=', proxyReqId, '| count=', choice.tool_calls.length);
                                        for (let i = 0; i < choice.tool_calls.length; i++) upsertPendingToolCall(choice.tool_calls[i], 'choice:' + i);
                                    }
                                    if (choice.message?.function_call) {
                                        console.log('[Proxy] Using choice.message.function_call fallback', '| id=', proxyReqId);
                                        upsertPendingToolCall({ index: 0, function_call: choice.message.function_call }, 'legacy-message:0');
                                    }

                                    if (finishReason === 'tool_calls' || finishReason === 'stop' || finishReason === 'length' || finishReason === 'content_filter') {
                                        // Final emission is handled after the upstream stream fully ends,
                                        // so we can detect and suppress empty-tool-call loops first.
                                    }

                                    if (chunk.usage) totalTokens = chunk.usage.total_tokens || 0;
                                } catch (parseErr) {
                                    console.warn('[Proxy] Failed to parse upstream SSE chunk:', (parseErr && parseErr.message) || parseErr, '| data=', data.slice(0, 300));
                                }
                            }
                        }

                        let forcedStopReason = '';
                        let forcedText = '';
                        if (pendingToolCalls.size > 0 && target.conversationId) {
                            const analysis = analyzePendingToolCalls();
                            if (analysis.allEmpty) {
                                const toolName = analysis.toolNames.join(',') || '(unknown)';
                                const prevState = emptyToolCallLoops.get(target.conversationId);
                                const loopCount = prevState && prevState.toolName === toolName ? prevState.count + 1 : 1;
                                emptyToolCallLoops.set(target.conversationId, { count: loopCount, toolName, updatedAt: Date.now() });
                                console.warn('[Proxy] Empty tool-call loop detected', '| conv=', target.conversationId, '| tool=', toolName, '| count=', loopCount, '| malformed=', analysis.hasMalformed);
                                if (loopCount >= 3) {
                                    forcedStopReason = 'end_turn';
                                    forcedText = '[Model repeatedly emitted empty tool calls for ' + toolName + '. This provider/model appears incompatible with required tool arguments. Please try another model/provider.]';
                                    pendingToolCalls.clear();
                                    emptyToolCallLoops.delete(target.conversationId);
                                }
                            } else {
                                emptyToolCallLoops.delete(target.conversationId);
                            }
                        } else if (target.conversationId) {
                            emptyToolCallLoops.delete(target.conversationId);
                        }

                        if (!forcedStopReason) emitPendingToolCalls();
                        closeThinkingBlock();
                        closeTextBlock();
                        if (forcedText) {
                            const forcedTextIndex = nextContentBlockIndex++;
                            writeProxyEvent('content_block_start', {
                                type: 'content_block_start',
                                index: forcedTextIndex,
                                content_block: { type: 'text', text: '' }
                            });
                            writeProxyEvent('content_block_delta', {
                                type: 'content_block_delta',
                                index: forcedTextIndex,
                                delta: { type: 'text_delta', text: forcedText }
                            });
                            writeProxyEvent('content_block_stop', { type: 'content_block_stop', index: forcedTextIndex });
                        }

                        const stopReason = forcedStopReason || (pendingToolCalls.size > 0 ? 'tool_use' : 'end_turn');
                        console.log('[Proxy] Request done',
                            '| id=', proxyReqId,
                            '| conv=', target.conversationId || '',
                            '| stopReason=', stopReason,
                            '| toolCalls=', pendingToolCalls.size,
                            '| outputTokens=', totalTokens,
                            forcedText ? '| forcedText=1' : '');
                        writeProxyEvent('message_delta', {
                            type: 'message_delta', delta: { stop_reason: stopReason }, usage: { output_tokens: totalTokens }
                        });
                        writeProxyEvent('message_stop', { type: 'message_stop' });
                        res.end();
                    } else {
                        // Anthropic format 鈥?passthrough to real endpoint
                        let endpoint = normalizeBaseUrl(target.baseUrl);
                        if (!endpoint.endsWith('/v1')) endpoint += '/v1';
                        endpoint += '/messages';

                        const upstreamRes = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-api-key': target.apiKey,
                                'anthropic-version': '2023-06-01',
                            },
                            body: body,
                        });
                        res.writeHead(upstreamRes.status, Object.fromEntries(upstreamRes.headers.entries()));
                        const reader = upstreamRes.body.getReader();
                        const pump = async () => {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) { res.end(); break; }
                                res.write(value);
                            }
                        };
                        await pump();
                    }
                } catch (err) {
                    console.error('[Proxy] Error:', err.message);
                    if (res.headersSent) {
                        try {
                            res.write('event: error\ndata: ' + JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: err.message } }) + '\n\n');
                            res.write('event: message_stop\ndata: ' + JSON.stringify({ type: 'message_stop' }) + '\n\n');
                        } catch (_) {}
                        try { res.end(); } catch (_) {}
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ type: 'error', error: { type: 'proxy_error', message: err.message } }));
                    }
                }
            });
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    proxyServer.listen(0, '127.0.0.1', () => {
        proxyPort = proxyServer.address().port;
        console.log('[Proxy] OpenAI conversion proxy on port', proxyPort);
    });

    async function generateTitleAsync(conversationId, userMsg, assistantMsg, token, baseUrl, activeModel, apiFormat) {
        if (!token) { console.log('[Title] Skipped: no API token'); return; }
        try {
            const bConv = db.conversations.find(c => c.id === conversationId);
            if (!bConv || (bConv.title !== 'New Conversation' && bConv.title !== 'New Chat')) return;

            // Strip -thinking suffix 鈥?raw API doesn't accept it
            let modelId = (activeModel || 'claude-sonnet-4-6').replace(/-thinking$/, '');

            const titlePrompt = `Please generate a short conversation title (max 5-7 words, no quotes) based on this dialogue:\n\nUser: ${userMsg}\nAssistant: ${assistantMsg}\n\nTitle:`;

            if (apiFormat === 'openai') {
                // OpenAI format title generation
                let endpoint = normalizeBaseUrl(baseUrl);
                if (!endpoint.endsWith('/v1')) endpoint += '/v1';
                endpoint += '/chat/completions';

                console.log(`[Title] Generating (OpenAI) for ${conversationId} via ${endpoint} model=${modelId}`);
                const titleController = new AbortController();
                const titleTimeout = setTimeout(() => titleController.abort(), 30000);
                const titleBody = {
                    model: modelId,
                    max_tokens: 200,
                    enable_thinking: false,
                    messages: [
                        { role: 'system', content: 'You are a title generator. Respond only with the title, without any quotes or explanations. Maximum 5-7 words.' },
                        { role: 'user', content: titlePrompt }
                    ]
                };
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify(titleBody),
                    signal: titleController.signal,
                });
                clearTimeout(titleTimeout);
                if (response.ok) {
                    const buf = await response.arrayBuffer();
                    const data = JSON.parse(new TextDecoder('utf-8').decode(buf));
                    const title = data.choices?.[0]?.message?.content?.replace(/^["']|["']$/g, '').trim();
                    if (title) {
                        bConv.title = title;
                        saveDb();
                        console.log(`[Title] Success: "${title}"`);
                    } else {
                        console.error('[Title] No text in OpenAI response:', JSON.stringify(data));
                    }
                } else {
                    console.error('[Title] HTTP Error:', response.status, endpoint, await response.text());
                }
            } else {
                // Anthropic format title generation
                let endpoint;
                if (baseUrl) {
                    const clean = normalizeBaseUrl(baseUrl);
                    endpoint = clean.endsWith('/v1') ? `${clean}/messages` : `${clean}/v1/messages`;
                } else {
                    endpoint = 'https://api.anthropic.com/v1/messages';
                }

                console.log(`[Title] Generating for ${conversationId} via ${endpoint} model=${modelId}`);
                const anthTitleCtrl = new AbortController();
                const anthTitleTimeout = setTimeout(() => anthTitleCtrl.abort(), 30000);
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json; charset=utf-8',
                        'x-api-key': token,
                        'anthropic-version': '2023-06-01'
                    },
                    signal: anthTitleCtrl.signal,
                    body: JSON.stringify({
                        model: modelId,
                        max_tokens: 50,
                        system: 'You are a title generator. Respond only with the title, without any quotes or explanations. Maximum 5-7 words.',
                        messages: [
                            { role: 'user', content: titlePrompt }
                        ]
                    })
                });
                clearTimeout(anthTitleTimeout);
                if (response.ok) {
                    const data = await response.json();
                    let title = null;
                    if (data.content && Array.isArray(data.content)) {
                        const textBlock = data.content.find(b => b.type === 'text' && b.text);
                        if (textBlock && textBlock.text) {
                            title = textBlock.text.replace(/^["']|["']$/g, '').trim();
                        }
                    }
                    if (title) {
                        bConv.title = title;
                        saveDb();
                        console.log(`[Title] Success: "${title}"`);
                    } else {
                        console.error('[Title] No text in response:', JSON.stringify(data));
                    }
                } else {
                    console.error('[Title] HTTP Error:', response.status, endpoint, await response.text());
                }
            }
        } catch (e) {
            console.error('[Title] Exception:', e.message || e);
        }
    }

    // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Projects 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

    server.get('/api/projects', (req, res) => {
        const list = [...db.projects]
            .filter(p => !p.is_archived)
            .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));
        // Attach counts
        const result = list.map(p => ({
            ...p,
            file_count: db.project_files.filter(f => f.project_id === p.id).length,
            chat_count: db.conversations.filter(c => c.project_id === p.id).length,
        }));
        res.json(result);
    });

    server.post('/api/projects', (req, res) => {
        const id = uuidv4();
        const { name, description = '' } = req.body;
        if (!name || !name.trim()) return res.status(400).json({ error: 'Name required' });

        const projectDir = path.join(workspacesDir, `project-${id}`);
        if (!fs.existsSync(projectDir)) fs.mkdirSync(projectDir, { recursive: true });

        const project = {
            id, name: name.trim(), description: description.trim(),
            instructions: '', workspace_path: projectDir,
            is_archived: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        db.projects.push(project);
        saveDb();
        res.json(project);
    });

    server.get('/api/projects/:id', (req, res) => {
        const project = db.projects.find(p => p.id === req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const files = db.project_files.filter(f => f.project_id === project.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const conversations = db.conversations.filter(c => c.project_id === project.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({ ...project, files, conversations });
    });

    server.patch('/api/projects/:id', (req, res) => {
        const project = db.projects.find(p => p.id === req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        if (req.body.name !== undefined) project.name = req.body.name.trim();
        if (req.body.description !== undefined) project.description = req.body.description;
        if (req.body.instructions !== undefined) project.instructions = req.body.instructions;
        if (req.body.is_archived !== undefined) project.is_archived = req.body.is_archived;
        project.updated_at = new Date().toISOString();

        saveDb();
        res.json(project);
    });

    server.delete('/api/projects/:id', (req, res) => {
        const pid = req.params.id;
        // Delete project files from disk
        const files = db.project_files.filter(f => f.project_id === pid);
        for (const f of files) {
            if (f.file_path && fs.existsSync(f.file_path)) {
                try { fs.unlinkSync(f.file_path); } catch (_) {}
            }
        }
        db.project_files = db.project_files.filter(f => f.project_id !== pid);

        // Delete project conversations + messages + workspaces
        const convIds = db.conversations.filter(c => c.project_id === pid).map(c => c.id);
        db.messages = db.messages.filter(m => !convIds.includes(m.conversation_id));
        db.conversations = db.conversations.filter(c => c.project_id !== pid);
        for (const cid of convIds) {
            const wsPath = path.join(workspacesDir, cid);
            if (fs.existsSync(wsPath)) try { fs.rmSync(wsPath, { recursive: true, force: true }); } catch (_) {}
        }

        // Delete project dir
        const projectDir = path.join(workspacesDir, `project-${pid}`);
        if (fs.existsSync(projectDir)) try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch (_) {}

        db.projects = db.projects.filter(p => p.id !== pid);
        saveDb();
        res.json({ success: true });
    });

    // 鈺愨晲鈺?Project file upload 鈺愨晲鈺?
    const projectUploadStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            const project = db.projects.find(p => p.id === req.params.id);
            const dir = project ? path.join(project.workspace_path, 'files') : path.join(workspacesDir, 'temp');
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            cb(null, dir);
        },
        filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
    });
    const projectUpload = multer({ storage: projectUploadStorage });

    server.post('/api/projects/:id/files', projectUpload.single('file'), (req, res) => {
        const project = db.projects.find(p => p.id === req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (!req.file) return res.status(400).json({ error: 'No file' });

        // Extract text for known text formats
        let extractedText = '';
        const textExts = ['.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.csv', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.rb', '.php', '.sql', '.sh', '.lua', '.r'];
        const ext = path.extname(req.file.originalname).toLowerCase();
        if (textExts.includes(ext)) {
            try { extractedText = fs.readFileSync(req.file.path, 'utf8'); } catch (_) {}
        }

        const fileEntry = {
            id: uuidv4(),
            project_id: project.id,
            file_name: req.file.originalname,
            file_path: req.file.path,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            extracted_text: extractedText,
            created_at: new Date().toISOString(),
        };
        db.project_files.push(fileEntry);
        project.updated_at = new Date().toISOString();
        saveDb();

        res.json({ ...fileEntry, extracted_text: undefined }); // Don't send full text back
    });

    server.delete('/api/projects/:projectId/files/:fileId', (req, res) => {
        const file = db.project_files.find(f => f.id === req.params.fileId && f.project_id === req.params.projectId);
        if (!file) return res.status(404).json({ error: 'File not found' });

        if (file.file_path && fs.existsSync(file.file_path)) {
            try { fs.unlinkSync(file.file_path); } catch (_) {}
        }
        db.project_files = db.project_files.filter(f => f.id !== file.id);
        const project = db.projects.find(p => p.id === req.params.projectId);
        if (project) project.updated_at = new Date().toISOString();
        saveDb();
        res.json({ success: true });
    });

    // 鈺愨晲鈺?Project conversations 鈺愨晲鈺?
    server.get('/api/projects/:id/conversations', (req, res) => {
        const convs = db.conversations.filter(c => c.project_id === req.params.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json(convs);
    });

    server.post('/api/projects/:id/conversations', (req, res) => {
        const project = db.projects.find(p => p.id === req.params.id);
        if (!project) return res.status(404).json({ error: 'Project not found' });

        const id = uuidv4();
        const { title = 'New Conversation', model = 'claude-sonnet-4-6' } = req.body;
        const workspacePath = path.join(workspacesDir, id);
        if (!fs.existsSync(workspacePath)) fs.mkdirSync(workspacePath, { recursive: true });

        // Copy project files into workspace so SDK can read them
        const projectFiles = db.project_files.filter(f => f.project_id === project.id);
        for (const pf of projectFiles) {
            if (pf.file_path && fs.existsSync(pf.file_path)) {
                try { fs.copyFileSync(pf.file_path, path.join(workspacePath, pf.file_name)); } catch (_) {}
            }
        }

        const newConv = {
            id, title, model, project_id: project.id,
            workspace_path: workspacePath, created_at: new Date().toISOString(),
        };
        db.conversations.push(newConv);
        project.updated_at = new Date().toISOString();
        saveDb();
        res.json(newConv);
    });

    // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?Conversations 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

    // ===== Artifacts API =====
    // Scans all messages for Write tool calls that created renderable HTML files
    server.get('/api/artifacts', (req, res) => {
        const artifacts = [];
        const htmlExts = ['.html', '.htm'];
        for (const msg of db.messages) {
            if (!msg.toolCalls) continue;
            for (const tc of msg.toolCalls) {
                if (tc.name !== 'Write' || tc.status === 'error') continue;
                const fp = tc.input?.file_path;
                if (!fp) continue;
                const ext = path.extname(fp).toLowerCase();
                if (!htmlExts.includes(ext)) continue;
                // Read file content to verify it's renderable HTML
                let content = '';
                try { content = fs.readFileSync(fp, 'utf-8'); } catch { continue; }
                const trimmed = content.trimStart().slice(0, 100).toLowerCase();
                if (!trimmed.includes('<!doctype') && !trimmed.includes('<html') && !trimmed.includes('<head') && !trimmed.includes('<body')) continue;
                const conv = db.conversations.find(c => c.id === msg.conversation_id);
                artifacts.push({
                    id: tc.id,
                    title: path.basename(fp),
                    file_path: fp,
                    conversation_id: msg.conversation_id,
                    conversation_title: conv?.title || 'Untitled',
                    message_id: msg.id,
                    created_at: msg.created_at,
                    content_length: content.length,
                });
            }
        }
        // Sort newest first, deduplicate by file_path (keep latest)
        artifacts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const seen = new Set();
        const unique = artifacts.filter(a => {
            if (seen.has(a.file_path)) return false;
            seen.add(a.file_path);
            return true;
        });
        res.json(unique);
    });

    // Get artifact content by file path
    // 安全: 只允许读 workspaces 目录内的文件 (防止通过绝对路径读 ~/.ssh/id_rsa 等敏感文件).
    server.get('/api/artifacts/content', (req, res) => {
        const fp = req.query.path;
        if (!fp) return res.status(400).json({ error: 'Missing path' });
        const resolved = path.resolve(fp);
        const wsRoot = path.resolve(workspacesDir);
        if (!resolved.startsWith(wsRoot + path.sep) && resolved !== wsRoot) {
            console.warn('[Security] Blocked artifact read outside workspaces:', fp);
            return res.status(403).json({ error: 'Access denied' });
        }
        try {
            const content = fs.readFileSync(resolved, 'utf-8');
            res.json({ content, format: 'html', title: path.basename(resolved) });
        } catch {
            res.status(404).json({ error: 'File not found' });
        }
    });

    server.get('/api/conversations', (req, res) => {
        const projectId = req.query.project_id;
        let list;
        if (projectId) {
            list = db.conversations.filter(c => c.project_id === projectId);
        } else {
            // Return all conversations including project ones
            list = db.conversations;
        }
        // Enrich with project name for sidebar display
        list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(c => {
                if (c.project_id) {
                    const project = db.projects.find(p => p.id === c.project_id);
                    return { ...c, project_name: project ? project.name : null };
                }
                return c;
            });
        res.json(list);
    });

    server.post('/api/conversations', (req, res) => {
        const id = uuidv4();
        const { title = 'New Conversation', model = 'claude-sonnet-4-6', project_id, research_mode = false } = req.body;
        const workspacePath = path.join(workspacesDir, id);

        if (!fs.existsSync(workspacePath)) {
            fs.mkdirSync(workspacePath, { recursive: true });
        }

        // If creating under a project, copy project files into workspace
        if (project_id) {
            const project = db.projects.find(p => p.id === project_id);
            if (project) {
                const projectFiles = db.project_files.filter(f => f.project_id === project_id);
                for (const pf of projectFiles) {
                    if (pf.file_path && fs.existsSync(pf.file_path)) {
                        try { fs.copyFileSync(pf.file_path, path.join(workspacePath, pf.file_name)); } catch (_) {}
                    }
                }
            }
        }

        const newConv = {
            id, title, model, workspace_path: workspacePath, created_at: new Date().toISOString(),
            research_mode: !!research_mode,
            ...(project_id ? { project_id } : {}),
        };
        db.conversations.push(newConv);
        saveDb();

        res.json({ id, title, model, workspace_path: workspacePath, research_mode: !!research_mode });
    });

    server.get('/api/conversations/:id', (req, res) => {
        const conv = db.conversations.find(c => c.id === req.params.id);
        if (!conv) return res.status(404).json({ error: 'Not found' });

        const messages = db.messages.filter(m => m.conversation_id === req.params.id)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const parsedMessages = messages.map(m => {
            let contentStr = '';
            try {
                const parsed = JSON.parse(m.content);
                if (Array.isArray(parsed)) {
                    contentStr = parsed.map(c => c.text || '').join('');
                } else if (typeof parsed === 'string') {
                    contentStr = parsed;
                } else {
                    contentStr = m.content;
                }
            } catch (e) {
                contentStr = m.content;
            }
            // Normalize attachment keys: DB stores camelCase, frontend expects snake_case
            let attachments = m.attachments;
            if (Array.isArray(attachments)) {
                attachments = attachments.map(a => {
                    const name = a.file_name || a.fileName || '';
                    const ext = name.split('.').pop()?.toLowerCase() || '';
                    const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
                    const isImg = (a.file_type === 'image' || a.fileType === 'image')
                        || (a.mime_type && a.mime_type.startsWith('image/'))
                        || (a.mimeType && a.mimeType.startsWith('image/'))
                        || imageExts.includes(ext);
                    const src = a.source;
                    const isGithub = src === 'github' || a.file_type === 'github' || a.fileType === 'github';
                    return {
                        id: a.id || a.fileId || (isGithub ? ('github:' + (a.gh_repo || a.ghRepo || name)) : ''),
                        file_name: name || 'file',
                        file_type: isGithub ? 'github' : (isImg ? 'image' : (a.file_type || a.fileType || 'document')),
                        mime_type: a.mime_type || a.mimeType || (isImg ? 'image/' + (ext === 'jpg' ? 'jpeg' : ext) : (isGithub ? 'application/x-github' : '')),
                        file_size: a.file_size || a.size || 0,
                        ...(isGithub ? { source: 'github', gh_repo: a.gh_repo || a.ghRepo, gh_ref: a.gh_ref || a.ghRef } : {}),
                    };
                });
            }
            return {
                ...m,
                content: contentStr,
                attachments,
            };
        });

        res.json({
            ...conv,
            messages: parsedMessages
        });
    });

    server.patch('/api/conversations/:id', (req, res) => {
        const conv = db.conversations.find(c => c.id === req.params.id);
        if (!conv) return res.status(404).json({ error: 'Not found' });

        if (req.body.title) conv.title = req.body.title;
        if (req.body.model && req.body.model !== conv.model) {
            console.log('[Session] Model changed for conv', conv.id, ':', conv.model, '->', req.body.model, '(session preserved)');
            conv.model = req.body.model;
            // Don't reset claude_session_id 鈥?engine sessions store message history
            // which is model-agnostic. The engine can resume with a different model.
        }
        // Move conversation to/from a project
        if ('project_id' in req.body) {
            const pid = req.body.project_id;
            if (pid) {
                const project = db.projects.find(p => p.id === pid);
                if (!project) return res.status(404).json({ error: 'Project not found' });
                conv.project_id = pid;
                project.updated_at = new Date().toISOString();
            } else {
                delete conv.project_id;
            }
        }
        if ('research_mode' in req.body) {
            conv.research_mode = !!req.body.research_mode;
        }

        saveDb();
        res.json(conv);
    });

    server.delete('/api/conversations/:id', (req, res) => {
        const id = req.params.id;
        db.messages = db.messages.filter(m => m.conversation_id !== id);
        db.conversations = db.conversations.filter(c => c.id !== id);
        saveDb();
        // Also delete the workspace folder from disk
        const wsPath = path.join(workspacesDir, id);
        if (fs.existsSync(wsPath)) {
            try {
                fs.rmSync(wsPath, { recursive: true, force: true });
                console.log(`[Delete] Removed workspace: ${wsPath}`);
            } catch (e) {
                console.error(`[Delete] Failed to remove workspace: ${e.message}`);
            }
        }
        res.json({ success: true });
    });

    server.delete('/api/conversations/:id/messages/:messageId', (req, res) => {
        const { id, messageId } = req.params;
        const msgIndex = db.messages.findIndex(m => m.id === messageId && m.conversation_id === id);
        if (msgIndex === -1) return res.status(404).json({ error: 'Message not found' });

        // Find the message immediately BEFORE the one being deleted (chronologically).
        // Its id is the engine session uuid we'll resume to — engine memory after spawn
        // will be the session JSONL sliced to [0..previousMsg] inclusive.
        const orderedConvMsgs = db.messages
            .filter(m => m.conversation_id === id)
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        const orderedIndex = orderedConvMsgs.findIndex(m => m.id === messageId);
        const previousMsg = orderedIndex > 0 ? orderedConvMsgs[orderedIndex - 1] : null;

        // Remove this message and all subsequent messages in the conversation
        const targetCreatedAt = new Date(db.messages[msgIndex].created_at).getTime();
        db.messages = db.messages.filter(m => {
            if (m.conversation_id !== id) return true;
            return new Date(m.created_at).getTime() < targetCreatedAt;
        });

        // Engine context rewind: don't null claude_session_id (we still need --resume).
        // Store the rewind point on the conv so spawnPersistentEngine adds
        // --resume-session-at on the next spawn. Mark the existing engine for
        // restart so the chat handler kills + respawns it before the next turn.
        const conv = db.conversations.find(c => c.id === id);
        if (conv) {
            if (previousMsg && previousMsg.engineUuidSynced) {
                // previousMsg's id is a real engine session uuid — engine can find it.
                conv.pendingResumeAt = previousMsg.id;
                console.log('[Session] Rewind queued for conv', id, '→ resume-session-at', previousMsg.id);
            } else if (previousMsg) {
                // Pre-fix message: id is bridge-generated, won't match anything in the
                // engine session JSONL. Fall back to clean-session reset (loses prior
                // context but doesn't crash the engine on respawn).
                conv.pendingResumeAt = null;
                conv.claude_session_id = null;
                console.log('[Session] Reset for conv', id, '(previous msg pre-uuid-sync, falling back to fresh session)');
            } else {
                // Deleting the very first message: nothing to resume to. Start fresh.
                conv.pendingResumeAt = null;
                conv.claude_session_id = null;
                console.log('[Session] Reset for conv', id, '(deleted first message)');
            }
        }
        const existingEngine = enginePool.get(id);
        if (existingEngine) existingEngine.needsRestart = true;

        saveDb();
        res.json({ success: true });
    });

    server.delete('/api/conversations/:id/messages-tail/:count', (req, res) => {
        const { id, count } = req.params;
        const numToRemove = parseInt(count, 10);
        if (isNaN(numToRemove) || numToRemove <= 0) return res.status(400).json({ error: 'Invalid count' });

        const convMsgs = db.messages.filter(m => m.conversation_id === id).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        // The message just BEFORE the tail-cut becomes the new last message — its id
        // is the engine session uuid we resume to.
        const previousMsg = convMsgs.length > numToRemove ? convMsgs[convMsgs.length - numToRemove - 1] : null;

        if (convMsgs.length <= numToRemove) {
            db.messages = db.messages.filter(m => m.conversation_id !== id);
        } else {
            const cutoffTime = new Date(convMsgs[convMsgs.length - numToRemove].created_at).getTime();
            db.messages = db.messages.filter(m => {
                if (m.conversation_id !== id) return true;
                return new Date(m.created_at).getTime() < cutoffTime;
            });
        }

        // Engine context rewind via --resume-session-at on next spawn (see single-msg
        // delete handler above for full rationale).
        const conv = db.conversations.find(c => c.id === id);
        if (conv) {
            if (previousMsg && previousMsg.engineUuidSynced) {
                conv.pendingResumeAt = previousMsg.id;
                console.log('[Session] Rewind queued for conv', id, '(tail) → resume-session-at', previousMsg.id);
            } else if (previousMsg) {
                // Pre-fix message — fall back to clean-session reset.
                conv.pendingResumeAt = null;
                conv.claude_session_id = null;
                console.log('[Session] Reset for conv', id, '(tail, previous msg pre-uuid-sync, falling back to fresh session)');
            } else {
                conv.pendingResumeAt = null;
                conv.claude_session_id = null;
                console.log('[Session] Reset for conv', id, '(tail deleted whole conversation)');
            }
        }
        const existingEngine = enginePool.get(id);
        if (existingEngine) existingEngine.needsRestart = true;

        saveDb();
        res.json({ success: true });
    });

    // Multer upload config
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            const convId = req.headers['x-conversation-id'] || 'temp';
            const dir = path.join(workspacesDir, convId, '.uploads');
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            cb(null, dir);
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + '-' + file.originalname);
        }
    });
    const upload = multer({ storage });

    server.post('/api/upload', upload.single('file'), (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file' });
        // Verify file on disk has actual content
        let diskSize = 0;
        try { diskSize = fs.statSync(req.file.path).size; } catch (_) {}
        console.log(`[Upload] ${req.file.originalname} 鈫?${req.file.path} (multer=${req.file.size}, disk=${diskSize})`);
        if (diskSize === 0) {
            // File is empty on disk 鈥?tell client to retry
            try { fs.unlinkSync(req.file.path); } catch (_) {}
            return res.status(422).json({ error: 'File upload incomplete (0 bytes on disk). Please retry.' });
        }
        res.json({
            fileId: path.basename(req.file.path),
            fileName: req.file.originalname,
            fileType: req.file.mimetype.startsWith('image') ? 'image' : 'document',
            mimeType: req.file.mimetype,
            localPath: req.file.path,
            size: diskSize
        });
    });

    // Resolve a fileId to its local path and serve the raw file
    server.get('/api/uploads/:fileId/raw', (req, res) => {
        const fileId = req.params.fileId;
        const convId = req.query.conversation_id || '';
        // Search in conversation uploads first, then all workspaces
        const searchDirs = [];
        if (convId) searchDirs.push(path.join(workspacesDir, convId, '.uploads'));
        // Also search all conversation upload dirs
        try {
            const allConvDirs = fs.readdirSync(workspacesDir);
            for (const dir of allConvDirs) {
                const uploadsDir = path.join(workspacesDir, dir, '.uploads');
                if (fs.existsSync(uploadsDir)) searchDirs.push(uploadsDir);
            }
        } catch (_) {}

        // Helper: serve file with correct mime type (avoids Express 5 sendFile Windows issues)
        const serveFile = (fp) => {
            const ext = path.extname(fp).toLowerCase();
            const mimeTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json' };
            res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
            res.send(fs.readFileSync(fp));
        };

        for (const dir of searchDirs) {
            const filePath = path.join(dir, fileId);
            if (fs.existsSync(filePath)) {
                return serveFile(filePath);
            }
            // Try partial match
            try {
                const files = fs.readdirSync(dir);
                const match = files.find(f => f === fileId || f.includes(fileId));
                if (match) return serveFile(path.join(dir, match));
            } catch (_) {}
        }
        res.status(404).json({ error: 'File not found' });
    });

    // Get local file path for a fileId
    server.get('/api/uploads/:fileId/path', (req, res) => {
        const fileId = req.params.fileId;
        const convId = req.query.conversation_id || '';
        const searchDirs = [];
        if (convId) searchDirs.push(path.join(workspacesDir, convId, '.uploads'));
        try {
            const allConvDirs = fs.readdirSync(workspacesDir);
            for (const dir of allConvDirs) {
                const uploadsDir = path.join(workspacesDir, dir, '.uploads');
                if (fs.existsSync(uploadsDir)) searchDirs.push(uploadsDir);
            }
        } catch (_) {}

        for (const dir of searchDirs) {
            const filePath = path.join(dir, fileId);
            if (fs.existsSync(filePath)) {
                return res.json({ localPath: filePath, folder: dir });
            }
            try {
                const files = fs.readdirSync(dir);
                const match = files.find(f => f === fileId || f.includes(fileId));
                if (match) return res.json({ localPath: path.join(dir, match), folder: dir });
            } catch (_) {}
        }
        res.status(404).json({ error: 'File not found' });
    });

    // Compact conversation 鈥?delegates to Claude Code engine's /compact command
    server.post('/api/conversations/:id/compact', async (req, res) => {
        const conv = db.conversations.find(c => c.id === req.params.id);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });

        if (!conv.claude_session_id) {
            return res.status(400).json({ error: 'No engine session to compact (conversation has no history in engine)' });
        }

        const env_token = req.body.env_token;
        const env_base_url = req.body.env_base_url;
        const instruction = req.body.instruction || '';
        const apiKey = env_token || engineEnvVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
        const baseUrl = engineEnvVars.ANTHROPIC_BASE_URL || env_base_url || process.env.ANTHROPIC_BASE_URL;
        const modelId = (conv.model || 'claude-sonnet-4-6').replace(/-thinking$/, '');

        // Count messages before compaction for reporting
        const messagesBeforeCompact = db.messages.filter(m => m.conversation_id === req.params.id).length;

        try {
            // Spawn engine CLI with /compact as the prompt 鈥?engine handles the full compaction internally
            const compactPrompt = instruction ? `/compact ${instruction}` : '/compact';
            const cliArgs = [
                '--preload', enginePreload,
                '--env-file=' + engineEnv, engineCli,
                '-p', compactPrompt,
                '--output-format', 'stream-json',
                '--verbose',
                '--bare',
                '--permission-mode', 'bypassPermissions',
                '--model', modelId,
                '--resume', conv.claude_session_id,
            ];

            const envVars = Object.assign({}, process.env);
            if (apiKey) envVars.ANTHROPIC_API_KEY = apiKey;
            envVars.ANTHROPIC_BASE_URL = baseUrl || engineEnvVars.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';

            console.log('[Compact] Spawning engine /compact, session=' + conv.claude_session_id + ' model=' + modelId);

            const child = spawn(bunExePath, cliArgs, {
                cwd: conv.workspace_path, env: envVars,
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            child.stdin.end();

            let compactSummary = '';
            let compactMetadata = null;
            let buf = '';

            child.stdout.on('data', (chunk) => {
                buf += chunk.toString('utf8');
                const lines = buf.split('\n');
                buf = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    let evt;
                    try { evt = JSON.parse(line); } catch { continue; }

                    // Capture the compact_boundary event from engine
                    if (evt.type === 'system' && evt.subtype === 'compact_boundary') {
                        compactMetadata = evt.compact_metadata || {};
                        console.log('[Compact] Engine compact_boundary:', JSON.stringify(compactMetadata));
                    }
                    // Capture any text output (the compact summary display)
                    if (evt.type === 'assistant' && evt.message && evt.message.content) {
                        for (const block of evt.message.content) {
                            if (block.type === 'text' && block.text) {
                                compactSummary += block.text;
                            }
                        }
                    }
                    // Also capture from stream events
                    if (evt.type === 'stream_event' && evt.event) {
                        const se = evt.event;
                        if (se.type === 'content_block_delta' && se.delta && se.delta.type === 'text_delta') {
                            compactSummary += se.delta.text;
                        }
                    }
                    // Result fallback
                    if (evt.type === 'result' && evt.result && !compactSummary) {
                        compactSummary = typeof evt.result === 'string' ? evt.result : '';
                    }
                }
            });

            let stderrBuf = '';
            child.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });

            await new Promise((resolve, reject) => {
                child.on('close', (code) => {
                    // Process remaining buffer
                    if (buf.trim()) {
                        try {
                            const e = JSON.parse(buf);
                            if (e.type === 'system' && e.subtype === 'compact_boundary') {
                                compactMetadata = e.compact_metadata || {};
                            }
                            if (!compactSummary && e.result) compactSummary = typeof e.result === 'string' ? e.result : '';
                        } catch (_) {}
                    }
                    if (code !== 0 && !compactMetadata) {
                        reject(new Error(stderrBuf || 'Engine compact failed with exit code ' + code));
                    } else {
                        resolve();
                    }
                });
                child.on('error', reject);
            });

            // Engine has compacted its internal session 鈥?keep all old messages
            // in local db for UI display, just append a compact boundary marker
            const tokensSaved = compactMetadata && compactMetadata.pre_tokens
                ? Math.round(compactMetadata.pre_tokens * 0.7)
                : Math.round(messagesBeforeCompact * 500); // rough estimate

            db.messages.push({
                id: uuidv4(),
                conversation_id: req.params.id,
                role: 'system',
                content: JSON.stringify([{ type: 'text', text: compactSummary || 'Conversation compacted.' }]),
                created_at: new Date().toISOString(),
                is_compact_boundary: true,
            });
            saveDb();

            // Session JSONL was rewritten by the compact process — the pooled
            // engine still has the old (pre-compact) messages in memory, so it
            // must be killed so the next chat spawns a fresh engine that loads
            // the compacted session.
            const existingEngine = enginePool.get(req.params.id);
            if (existingEngine) {
                killEngine(req.params.id, 'manual_compact_session_changed');
            }

            console.log(`[Compact] Done: ${messagesBeforeCompact} messages compacted, ~${tokensSaved} tokens saved`);
            res.json({ summary: compactSummary || 'Conversation compacted.', tokensSaved, messagesCompacted: messagesBeforeCompact });
        } catch (err) {
            console.error('[Compact] Error:', err);
            res.status(500).json({ error: err.message || 'Compaction failed' });
        }
    });

    // AskUserQuestion 鈥?receive user's answer and write back to engine stdin
    server.post('/api/conversations/:id/answer', (req, res) => {
        const { request_id, tool_use_id, answers } = req.body;
        const child = activeChildren.get(req.params.id);
        if (!child) return res.status(404).json({ error: 'No active engine process' });
        if (!request_id) return res.status(400).json({ error: 'Missing request_id' });

        // Merge user answers into the original tool input so engine sees them
        const originalInput = askUserPendingInputs.get(req.params.id) || {};
        askUserPendingInputs.delete(req.params.id);

        const controlResponse = JSON.stringify({
            type: 'control_response',
            response: {
                subtype: 'success',
                request_id: request_id,
                response: {
                    toolUseID: tool_use_id || '',
                    behavior: 'allow',
                    updatedInput: { ...originalInput, answers: answers || {} },
                }
            }
        }) + '\n';

        try {
            child.stdin.write(controlResponse);
            console.log('[AskUser] Answered request_id=' + request_id, JSON.stringify(answers || {}).slice(0, 200));
            res.json({ ok: true });
        } catch (err) {
            console.error('[AskUser] Write error:', err.message);
            res.status(500).json({ error: 'Failed to write to engine stdin' });
        }
    });

    // Stream status 鈥?check if a conversation has an active engine stream
    server.get('/api/conversations/:id/stream-status', (req, res) => {
        const stream = activeStreams.get(req.params.id);
        res.json({ active: !!(stream && !stream.done), eventCount: stream ? stream.events.length : 0 });
    });

    // Reconnect to an active stream 鈥?sends all buffered events then continues live
    server.get('/api/conversations/:id/reconnect', (req, res) => {
        const stream = activeStreams.get(req.params.id);
        if (!stream) return res.status(404).json({ error: 'No active stream' });

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
        });

        // Send all buffered events
        for (const event of stream.events) {
            res.write('data: ' + JSON.stringify(event) + '\n\n');
        }

        if (stream.done) {
            res.write('data: [DONE]\n\n');
            res.end();
            return;
        }

        // Add to listeners for future events
        stream.listeners.add(res);
        req.on('close', () => stream.listeners.delete(res));
    });

    // ===== Provider CRUD =====
    server.get('/api/system-status', (req, res) => {
        res.json({
            platform: process.platform,
            gitBash: {
                required: process.platform === 'win32',
                found: !!gitBashPath,
                path: gitBashPath || null,
            },
        });
    });
    server.get('/api/providers', (req, res) => {
        res.json(providers);
    });
    server.post('/api/providers', (req, res) => {
        const p = req.body;
        p.id = uuidv4();
        if (!p.name) return res.status(400).json({ error: 'Missing name' });
        if (!p.models) p.models = [];
        if (p.enabled === undefined) p.enabled = true;
        if (p.baseUrl) p.baseUrl = normalizeBaseUrl(p.baseUrl);
        providers.push(p);
        saveProviders();
        res.json(p);
    });
    server.patch('/api/providers/:id', (req, res) => {
        const p = providers.find(x => x.id === req.params.id);
        if (!p) return res.status(404).json({ error: 'Not found' });
        console.log('[Providers] PATCH', req.params.id,
            '| keys=', Object.keys(req.body || {}),
            '| bodySummary=', JSON.stringify({
                name: req.body && req.body.name,
                enabled: req.body && req.body.enabled,
                format: req.body && req.body.format,
                baseUrl: req.body && req.body.baseUrl,
                apiKeyChanged: !!(req.body && typeof req.body.apiKey === 'string'),
                modelsCount: Array.isArray(req.body && req.body.models) ? req.body.models.length : undefined,
            }).slice(0, 500),
            '| poolBefore=', summarizeEnginePool());
        if (req.body.baseUrl) req.body.baseUrl = normalizeBaseUrl(req.body.baseUrl);
        Object.assign(p, req.body);
        delete p._id; // prevent duplication
        saveProviders();
        // Refresh idle engines immediately, but don't kill active turns mid-response.
        // Active engines are marked stale and will be restarted on the next turn/warm.
        for (const [id, eng] of enginePool) {
            if (eng.state === 'processing') {
                eng.needsRestart = true;
                console.log('[EnginePool] Deferring engine restart for active conversation', id, '(provider updated)');
            } else {
                killEngine(id, 'provider_updated_idle_engine', { providerId: req.params.id, changedKeys: Object.keys(req.body || {}) });
            }
        }
        res.json(p);
    });
    server.delete('/api/providers/:id', (req, res) => {
        console.log('[Providers] DELETE', req.params.id, '| poolBefore=', summarizeEnginePool());
        providers = providers.filter(x => x.id !== req.params.id);
        saveProviders();
        for (const [id, eng] of enginePool) {
            if (eng.state === 'processing') {
                eng.needsRestart = true;
                console.log('[EnginePool] Deferring engine restart for active conversation', id, '(provider deleted)');
            } else {
                killEngine(id, 'provider_deleted_idle_engine', { providerId: req.params.id });
            }
        }
        res.json({ ok: true });
    });
    // Get all available models across all enabled providers
    server.get('/api/providers/models', (req, res) => {
        const models = [];
        for (const p of providers) {
            if (!p.enabled) continue;
            for (const m of (p.models || [])) {
                if (m.enabled === false) continue;
                if (!m.id || !String(m.id).trim()) continue;
                models.push({ id: m.id, name: m.name || m.id, providerId: p.id, providerName: p.name });
            }
        }
        res.json(models);
    });

    // ===== Web search capability probe =====
    // Sends a real test query to the provider and inspects the response for structured
    // web search output. Only tests that produce real hits count as success.
    async function probeOpenAIWebSearch(p) {
        const endpointBase = (() => {
            let e = normalizeBaseUrl(p.baseUrl || '');
            if (!e.endsWith('/v1')) e += '/v1';
            return e + '/chat/completions';
        })();
        const modelId = (p.models || []).find(m => m.enabled !== false)?.id || (p.models || [])[0]?.id;
        if (!modelId) return { ok: false, strategy: null, reason: '无可用模型' };
        const probeQuery = 'What is today\'s top news headline? Please search the web.';
        const headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (p.apiKey || '') };

        // Strategy A: DashScope-style enable_search
        try {
            const resp = await fetch(endpointBase, {
                method: 'POST', headers,
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: probeQuery }],
                    enable_search: true,
                    search_options: { forced_search: true, search_strategy: 'standard' },
                    stream: false,
                    max_tokens: 512,
                }),
                signal: AbortSignal.timeout(30000),
            });
            if (resp.ok) {
                const data = await resp.json();
                const searchInfo = data.search_info || data.web_search_info || null;
                const hits = (searchInfo?.search_results || searchInfo?.results || data.search_results || []);
                if (Array.isArray(hits) && hits.some(h => h && (h.url || h.link))) {
                    return { ok: true, strategy: 'dashscope', hitCount: hits.length };
                }
            }
        } catch (e) { console.log('[WebSearchProbe] DashScope strategy failed:', e.message); }

        // Strategy B: BigModel/GLM-style web_search tool
        try {
            const resp = await fetch(endpointBase, {
                method: 'POST', headers,
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: probeQuery }],
                    tools: [{ type: 'web_search', web_search: { enable: true, search_query: probeQuery } }],
                    stream: false,
                    max_tokens: 512,
                }),
                signal: AbortSignal.timeout(30000),
            });
            if (resp.ok) {
                const data = await resp.json();
                const webSearch = data.web_search || data.choices?.[0]?.message?.web_search || null;
                if (Array.isArray(webSearch) && webSearch.some(h => h && (h.link || h.url))) {
                    return { ok: true, strategy: 'bigmodel', hitCount: webSearch.length };
                }
            }
        } catch (e) { console.log('[WebSearchProbe] BigModel strategy failed:', e.message); }

        return { ok: false, strategy: null, reason: 'No structured search results in response' };
    }

    // Direct HTTPS probe using node's https module for detailed error diagnostics.
    // Tries both auth styles (Authorization: Bearer — used by most aggregators — and x-api-key —
    // used by the canonical Anthropic API). The probe issues a single /v1/messages call containing
    // web_search_20250305 as a server tool. A response containing server_tool_use + at least one
    // URL in web_search_tool_result counts as success.
    function doAnthropicHttpProbe(p, authStyle, overrideModel) {
        return new Promise((resolve) => {
            const https = require('https');
            const { URL } = require('url');
            const baseUrl = normalizeBaseUrl(p.baseUrl || '');
            let parsed;
            try { parsed = new URL(baseUrl); } catch (e) { return resolve({ ok: false, reason: 'Invalid baseUrl: ' + e.message }); }
            const rawModel = overrideModel
                || (p.models || []).find(m => m.enabled !== false)?.id
                || (p.models || [])[0]?.id;
            if (!rawModel) return resolve({ ok: false, reason: '无可用模型' });
            const modelId = rawModel.replace(/-thinking$/, '');

            const body = JSON.stringify({
                model: modelId,
                max_tokens: 1024,
                messages: [{ role: 'user', content: 'Use web search to find the top news headline from today. Respond with just the headline and source URL.' }],
                tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
            });

            const headers = {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'anthropic-version': '2023-06-01',
                'User-Agent': 'claude-app-probe/1.0',
            };
            if (authStyle === 'bearer') headers['Authorization'] = 'Bearer ' + (p.apiKey || '');
            else headers['x-api-key'] = p.apiKey || '';

            const pathSuffix = (parsed.pathname.replace(/\/+$/, '') || '') + '/v1/messages';
            const opts = {
                host: parsed.hostname,
                port: parsed.port || 443,
                path: pathSuffix,
                method: 'POST',
                headers,
                timeout: 45000,
            };

            console.log('[WebSearchProbe] HTTPS', authStyle, '→', parsed.hostname + pathSuffix, '| model=', modelId);
            const req = https.request(opts, (res) => {
                let chunks = [];
                res.on('data', (c) => chunks.push(c));
                res.on('end', () => {
                    const text = Buffer.concat(chunks).toString('utf8');
                    if (res.statusCode !== 200) {
                        return resolve({ ok: false, reason: 'HTTP ' + res.statusCode + ': ' + text.slice(0, 300) });
                    }
                    let data;
                    try { data = JSON.parse(text); } catch (e) { return resolve({ ok: false, reason: 'Non-JSON response: ' + text.slice(0, 200) }); }
                    const content = Array.isArray(data.content) ? data.content : [];
                    const hasServerTool = content.some(b => b.type === 'server_tool_use' && (b.name === 'web_search' || b.name === 'WebSearch'));
                    const resultBlock = content.find(b => b.type === 'web_search_tool_result');
                    let hitCount = 0;
                    if (resultBlock && Array.isArray(resultBlock.content)) {
                        hitCount = resultBlock.content.filter(x => x && x.url).length;
                    }
                    if (hitCount > 0) {
                        return resolve({ ok: true, hitCount, serverToolPresent: hasServerTool });
                    }
                    if (hasServerTool) {
                        return resolve({ ok: false, reason: 'server_tool_use present but 0 URLs in result' });
                    }
                    // Response has no server_tool_use at all — provider ignored the tool or doesn't support it
                    return resolve({ ok: false, reason: 'Response has no server_tool_use block (provider likely strips web_search_20250305)' });
                });
            });
            req.on('error', (err) => {
                const detail = err.code ? ' [' + err.code + (err.errno ? '/' + err.errno : '') + (err.hostname ? ' ' + err.hostname : '') + ']' : '';
                resolve({ ok: false, reason: 'Network error: ' + err.message + detail });
            });
            req.on('timeout', () => {
                req.destroy(new Error('Request timed out after 45s'));
            });
            req.write(body);
            req.end();
        });
    }

    async function probeAnthropicWebSearch(p) {
        if (!p.baseUrl || !p.apiKey) return { ok: false, strategy: null, reason: 'Missing baseUrl or apiKey' };

        // Sort models: prefer opus > sonnet > haiku (more capable models are
        // more likely to exist on aggregator providers, and cost is negligible
        // for a single probe request).
        const modelRank = (id) => {
            if (/opus/i.test(id)) return 0;
            if (/sonnet/i.test(id)) return 1;
            if (/haiku/i.test(id)) return 2;
            return 3;
        };
        const enabledModels = (p.models || [])
            .filter(m => m.enabled !== false && m.id)
            .sort((a, b) => modelRank(a.id) - modelRank(b.id));
        const modelIds = enabledModels.length > 0
            ? enabledModels.map(m => m.id)
            : [(p.models || [])[0]?.id].filter(Boolean);
        if (modelIds.length === 0) return { ok: false, strategy: null, reason: '无可用模型' };

        // Try Bearer auth first (used by most aggregators like aiapikey.net, clawparrot, etc.),
        // then fall back to x-api-key (canonical Anthropic API).
        const styles = ['bearer', 'x-api-key'];
        const attempts = [];
        for (const modelId of modelIds) {
            for (const style of styles) {
                const result = await doAnthropicHttpProbe(p, style, modelId);
                attempts.push({ style, modelId, result });
                console.log('[WebSearchProbe] Anthropic attempt', style, 'model=' + modelId, '→', JSON.stringify(result));
                if (result.ok) {
                    return { ok: true, strategy: 'anthropic_native', hitCount: result.hitCount };
                }
                // If the error is model_not_found, skip to the next model
                // (no point trying the other auth style for a missing model).
                if (result.reason && /model.not.found|model.*not.*exist|no.*channel/i.test(result.reason)) {
                    console.log('[WebSearchProbe] Model', modelId, 'not found on provider, trying next model');
                    break;
                }
            }
        }
        // None of the model+style combos succeeded — surface the most informative error
        const bestFail = attempts.find(a => a.result.reason
                && !a.result.reason.includes('Network error')
                && !/model.not.found|no.*channel/i.test(a.result.reason))
            || attempts[attempts.length - 1];
        return {
            ok: false,
            strategy: null,
            reason: bestFail?.result?.reason || 'All model/auth combinations failed',
        };
    }

    server.post('/api/providers/:id/test-websearch', async (req, res) => {
        const p = providers.find(x => x.id === req.params.id);
        if (!p) return res.status(404).json({ error: 'Provider not found' });
        if (!p.baseUrl || !p.apiKey) return res.json({ ok: false, reason: 'Missing baseUrl or apiKey' });
        console.log('[WebSearchProbe] Testing provider:', p.name, '| format:', p.format);
        try {
            const result = p.format === 'anthropic'
                ? await probeAnthropicWebSearch(p)
                : await probeOpenAIWebSearch(p);
            console.log('[WebSearchProbe] Result:', p.name, '→', JSON.stringify(result));
            p.supportsWebSearch = !!result.ok;
            p.webSearchStrategy = result.strategy || null;
            p.webSearchTestedAt = Date.now();
            p.webSearchTestReason = result.reason || null;
            saveProviders();
            res.json(result);
        } catch (err) {
            console.error('[WebSearchProbe] Unexpected error:', err);
            res.status(500).json({ ok: false, reason: err.message });
        }
    });

    // Workspace config
    server.get('/api/workspace-config', (req, res) => {
        res.json({ workspacesDir, defaultDir: defaultWorkspacesDir });
    });
    server.post('/api/workspace-config', (req, res) => {
        const { dir } = req.body;
        if (!dir) return res.status(400).json({ error: 'Missing dir' });
        // 安全: dir 决定 engine spawn 的 cwd, 攻击者能改就能让 engine 在系统目录执行命令.
        // 只允许指向 user 家目录下的子目录, 且必须已存在 (避免 mkdir 到随机位置).
        try {
            const resolved = path.resolve(dir);
            const homeRoot = path.resolve(os.homedir());
            if (!resolved.startsWith(homeRoot + path.sep)) {
                console.warn('[Security] Blocked workspace-config outside home:', dir);
                return res.status(403).json({ error: 'workspace dir must be inside user home' });
            }
            if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
                return res.status(400).json({ error: 'dir does not exist or is not a directory' });
            }
            const settingsPath = path.join(userDataPath, 'workspace-config.json');
            fs.writeFileSync(settingsPath, JSON.stringify({ workspacesDir: resolved }));
            res.json({ ok: true, dir: resolved });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    server.get('/api/connectors/mcp-status', (req, res) => {
        try {
            const { configPath, config } = readConnectorGlobalConfig();
            res.json({
                configPath,
                connectors: getManagedConnectorStatuses(config),
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    server.get('/api/connectors/composio-config', (req, res) => {
        try {
            const storedConfig = readStoredComposioConfig();
            const apiKey = getComposioApiKey();
            const source = storedConfig.apiKey
                ? 'local'
                : process.env.COMPOSIO_API_KEY || process.env.COMPOSIO_PROJECT_API_KEY
                    ? 'env'
                    : null;

            res.json({
                configPath: composioConfigPath,
                configured: Boolean(apiKey),
                hasStoredApiKey: Boolean(storedConfig.apiKey),
                source,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    server.post('/api/connectors/composio-config', (req, res) => {
        try {
            const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
            if (!apiKey) {
                return res.status(400).json({ error: 'Missing Composio API key' });
            }

            writeComposioConfig(composioConfigPath, { apiKey });
            res.json({
                ok: true,
                configPath: composioConfigPath,
                configured: true,
                hasStoredApiKey: true,
                source: 'local',
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    server.post('/api/connectors/mcp-install', (req, res) => {
        const { connectorId } = req.body || {};
        const profile = getInstallProfile(connectorId);
        if (!profile) {
            return res.status(400).json({ error: 'Connector does not support in-app MCP installation' });
        }

        try {
            const { config } = readConnectorGlobalConfig();
            const nextConfig = mergeMcpServerConfig(config, profile.serverName, profile.serverConfig);
            const configPath = writeConnectorGlobalConfig(nextConfig);
            res.json({
                ok: true,
                configPath,
                connectors: getManagedConnectorStatuses(nextConfig),
                serverName: profile.serverName,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    server.post('/api/connectors/mcp-uninstall', (req, res) => {
        const { connectorId } = req.body || {};
        const profile = getInstallProfile(connectorId);
        if (!profile) {
            return res.status(400).json({ error: 'Connector does not support in-app MCP removal' });
        }

        try {
            const { config } = readConnectorGlobalConfig();
            const nextConfig = removeMcpServerConfig(config, profile.serverName);
            const configPath = writeConnectorGlobalConfig(nextConfig);
            res.json({
                ok: true,
                configPath,
                connectors: getManagedConnectorStatuses(nextConfig),
                serverName: profile.serverName,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    server.get('/api/connectors/composio-status', async (req, res) => {
        try {
            const payload = await buildComposioStatusPayload(req.query.userId);
            res.json(payload);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    server.post('/api/connectors/composio-connect', async (req, res) => {
        const { connectorId, userId } = req.body || {};
        const profile = getComposioProfile(connectorId);
        if (!profile) {
            return res.status(400).json({ error: 'Connector is not mapped to a Composio toolkit yet' });
        }

        try {
            const apiKey = getComposioApiKey();
            if (!apiKey) {
                return res.status(400).json({ error: 'Composio API key is not configured in this app' });
            }

            const session = await ensureComposioSession(userId);
            const { config } = readConnectorGlobalConfig();
            const nextConfig = mergeMcpServerConfig(
                config,
                COMPOSIO_SERVER_NAME,
                buildComposioServerConfig({
                    apiKey,
                    sessionUrl: session.mcpUrl,
                }),
            );
            const configPath = writeConnectorGlobalConfig(nextConfig);
            const callbackUrl = `http://127.0.0.1:30080/api/connectors/composio/callback?connectorId=${encodeURIComponent(connectorId)}`;
            const link = await createComposioLink({
                alias: connectorId,
                apiKey,
                callbackUrl,
                sessionId: session.sessionId,
                toolkitSlug: profile.toolkitSlug,
            });
            const payload = await buildComposioStatusPayload(userId);

            res.json({
                ok: true,
                configPath,
                connectors: payload.connectors,
                mcpUrl: payload.mcpUrl,
                redirectUrl: link.redirect_url,
                serverName: COMPOSIO_SERVER_NAME,
                sessionId: payload.sessionId,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    server.post('/api/connectors/composio-uninstall', async (req, res) => {
        try {
            const { userId } = req.body || {};
            const { config } = readConnectorGlobalConfig();
            const nextConfig = removeMcpServerConfig(config, COMPOSIO_SERVER_NAME);
            const configPath = writeConnectorGlobalConfig(nextConfig);
            const payload = await buildComposioStatusPayload(userId);

            res.json({
                ok: true,
                configPath,
                connectors: payload.connectors,
                serverName: COMPOSIO_SERVER_NAME,
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    server.get('/api/connectors/composio/callback', (req, res) => {
        const connectorId = String(req.query.connectorId || 'connector');
        const status = String(req.query.status || 'success');
        const isSuccess = status === 'success';
        const title = isSuccess ? 'Connector ready' : 'Connection incomplete';
        const body = isSuccess
            ? `You can return to Claude Desktop now. ${connectorId} was handed off to Composio for authentication.`
            : `Composio reported that the ${connectorId} connection did not finish cleanly. Return to Claude Desktop to retry.`;

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f5f4ef;
        color: #121212;
        font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        max-width: 460px;
        padding: 32px 28px;
        border-radius: 20px;
        border: 1px solid rgba(18, 18, 18, 0.08);
        background: white;
        box-shadow: 0 16px 40px rgba(0, 0, 0, 0.08);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 22px;
        line-height: 1.2;
      }
      p {
        margin: 0;
        color: #5f5b52;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${body}</p>
    </main>
  </body>
</html>`);
    });

    // ===== Skills =====
    // Paths 鈥?userSkillsDir matches engine's skill loading path (~/.claude/skills/)
    const bundledSkillsDir = path.join(__dirname, 'skills');
    const homeDir = os.homedir();
    const localSkillsDir = path.join(homeDir, '.agents', 'skills');
    const userSkillsDir = path.join(homeDir, '.claude', 'skills');
    const skillPrefsPath = path.join(userDataPath, 'skill-preferences.json');

    if (!fs.existsSync(userSkillsDir)) {
        fs.mkdirSync(userSkillsDir, { recursive: true });
    }

    // Sync bundled skills to ~/.claude/skills/ so the engine can find them
    // Only copies skills that don't already exist (won't overwrite user modifications)
    if (fs.existsSync(bundledSkillsDir)) {
        try {
            const bundledEntries = fs.readdirSync(bundledSkillsDir, { withFileTypes: true });
            for (const entry of bundledEntries) {
                if (!entry.isDirectory()) continue;
                const target = path.join(userSkillsDir, entry.name);
                if (!fs.existsSync(target)) {
                    // Copy entire skill directory
                    const copyDirSync = (src, dest) => {
                        fs.mkdirSync(dest, { recursive: true });
                        for (const item of fs.readdirSync(src, { withFileTypes: true })) {
                            const s = path.join(src, item.name);
                            const d = path.join(dest, item.name);
                            if (item.isDirectory()) copyDirSync(s, d);
                            else fs.copyFileSync(s, d);
                        }
                    };
                    copyDirSync(path.join(bundledSkillsDir, entry.name), target);
                    console.log('[Skills] Synced bundled skill to ~/.claude/skills/:', entry.name);
                }
            }
        } catch (e) { console.error('[Skills] Sync error:', e.message); }
    }

    // Load / save skill preferences (enabled/disabled per skill id)
    function loadSkillPrefs() {
        if (fs.existsSync(skillPrefsPath)) {
            try { return JSON.parse(fs.readFileSync(skillPrefsPath, 'utf8')); } catch (e) { }
        }
        return {};
    }
    function saveSkillPrefs(prefs) {
        fs.writeFileSync(skillPrefsPath, JSON.stringify(prefs, null, 2));
    }

    // Parse SKILL.md frontmatter
    function parseSkillMd(content) {
        const match = content.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        if (!match) return null;
        const fm = match[1];
        const body = match[2].trim();
        const nameMatch = fm.match(/^name:\s*(.+)$/m);
        const descMatch = fm.match(/^description:\s*(.+)$/m);
        return {
            name: nameMatch ? nameMatch[1].trim() : null,
            description: descMatch ? descMatch[1].trim() : '',
            content: body
        };
    }

    // Recursively list files in a skill directory as a tree
    function scanSkillFiles(dirPath) {
        const result = [];
        if (!fs.existsSync(dirPath)) return result;
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true })
                .filter(e => !e.name.startsWith('.'))
                .sort((a, b) => {
                    if (a.isDirectory() && !b.isDirectory()) return -1;
                    if (!a.isDirectory() && b.isDirectory()) return 1;
                    // SKILL.md always first among files
                    if (a.name === 'SKILL.md') return -1;
                    if (b.name === 'SKILL.md') return 1;
                    return a.name.localeCompare(b.name);
                });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    const children = scanSkillFiles(path.join(dirPath, entry.name));
                    result.push({ name: entry.name, type: 'folder', children });
                } else {
                    result.push({ name: entry.name, type: 'file' });
                }
            }
        } catch (_) {}
        return result;
    }

    // Scan a directory for skill folders (each containing SKILL.md)
    function scanSkillsDir(dir, source) {
        const skills = [];
        if (!fs.existsSync(dir)) return skills;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const mdPath = path.join(dir, entry.name, 'SKILL.md');
                if (!fs.existsSync(mdPath)) continue;
                try {
                    const raw = fs.readFileSync(mdPath, 'utf8');
                    const parsed = parseSkillMd(raw);
                    if (!parsed) continue;
                    skills.push({
                        id: `${source}:${entry.name}`,
                        name: parsed.name || entry.name,
                        description: parsed.description,
                        content: parsed.content,
                        is_example: true,
                        source_dir: entry.name,
                        source: source,
                        user_id: null,
                        created_at: null
                    });
                } catch (e) { /* skip unreadable */ }
            }
        } catch (e) { /* dir not readable */ }
        return skills;
    }

    // Load user-created skills from ~/.claude/skills/ (standard SKILL.md format)
    function loadUserSkills() {
        return scanSkillsDir(userSkillsDir, 'user').map(s => ({ ...s, is_example: false }));
    }

    // GET /api/skills 鈥?list all skills
    server.get('/api/skills', (req, res) => {
        const prefs = loadSkillPrefs();

        // 1) Bundled example skills
        const bundled = scanSkillsDir(bundledSkillsDir, 'bundled');
        // 2) Local ~/.agents/skills/
        const local = scanSkillsDir(localSkillsDir, 'local');
        // Combine examples, deduplicate by name (bundled takes priority)
        const seenNames = new Set();
        const allExamples = [];
        for (const s of bundled) {
            seenNames.add(s.name);
            allExamples.push({ ...s, enabled: prefs[s.id] !== undefined ? prefs[s.id] : true });
        }
        for (const s of local) {
            if (seenNames.has(s.name)) continue;
            seenNames.add(s.name);
            allExamples.push({ ...s, enabled: prefs[s.id] !== undefined ? prefs[s.id] : true });
        }

        // 3) User-created skills
        const userSkills = loadUserSkills().map(s => ({
            ...s,
            enabled: prefs[s.id] !== undefined ? prefs[s.id] : true
        }));

        // Strip content from list response (only return on detail)
        const stripContent = (s) => {
            const { content, ...rest } = s;
            return rest;
        };

        res.json({
            examples: allExamples.map(stripContent),
            my_skills: userSkills.map(stripContent)
        });
    });

    // GET /api/skills/:id 鈥?skill detail with content
    server.get('/api/skills/:id', (req, res) => {
        const { id } = req.params;
        const prefs = loadSkillPrefs();

        // Check bundled
        const bundled = scanSkillsDir(bundledSkillsDir, 'bundled');
        const local = scanSkillsDir(localSkillsDir, 'local');
        const allExamples = [...bundled, ...local];
        const example = allExamples.find(s => s.id === id);
        if (example) {
            // Resolve the skill's directory and scan its files
            const baseDir = example.source === 'bundled' ? bundledSkillsDir : localSkillsDir;
            const skillDir = path.join(baseDir, example.source_dir);
            const files = scanSkillFiles(skillDir);
            return res.json({ ...example, enabled: prefs[id] !== undefined ? prefs[id] : true, files, dir_path: skillDir });
        }

        // Check user skills (~/.claude/skills/)
        const userSkills = loadUserSkills();
        const userSkill = userSkills.find(s => s.id === id);
        if (userSkill) {
            const skillDir = path.join(userSkillsDir, userSkill.source_dir);
            const files = scanSkillFiles(skillDir);
            return res.json({ ...userSkill, enabled: prefs[id] !== undefined ? prefs[id] : true, files, dir_path: skillDir });
        }

        res.status(404).json({ error: 'Skill not found' });
    });

    // GET /api/skills/:id/file 鈥?get content of a specific file within a skill
    server.get('/api/skills/:id/file', (req, res) => {
        const { id } = req.params;
        const filePath = req.query.path;
        if (!filePath) return res.status(400).json({ error: 'path query param required' });

        // Find skill directory (bundled, local, or user)
        const bundled = scanSkillsDir(bundledSkillsDir, 'bundled');
        const local = scanSkillsDir(localSkillsDir, 'local');
        const user = loadUserSkills();
        const skill = [...bundled, ...local, ...user].find(s => s.id === id);
        if (!skill) return res.status(404).json({ error: 'Skill not found' });

        const baseDirMap = { 'bundled': bundledSkillsDir, 'local': localSkillsDir, 'user': userSkillsDir };
        const baseDir = baseDirMap[skill.source] || userSkillsDir;
        const fullPath = path.join(baseDir, skill.source_dir, filePath);

        // Security: ensure path is within skill directory
        const resolved = path.resolve(fullPath);
        const skillRoot = path.resolve(path.join(baseDir, skill.source_dir));
        if (!resolved.startsWith(skillRoot)) return res.status(403).json({ error: 'Access denied' });

        if (!fs.existsSync(resolved)) return res.status(404).json({ error: 'File not found' });
        try {
            const content = fs.readFileSync(resolved, 'utf8');
            res.json({ content, path: filePath });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST /api/skills/import — upload a .zip or .md file to create a user skill
    const skillImportUpload = multer({ dest: os.tmpdir(), limits: { fileSize: 10 * 1024 * 1024 } });
    server.post('/api/skills/import', skillImportUpload.single('file'), async (req, res) => {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const ext = path.extname(req.file.originalname).toLowerCase();
        try {
            if (ext === '.zip') {
                // Extract zip to a temp dir, then move to ~/.claude/skills/
                const extractZip = require('extract-zip');
                const tmpDir = path.join(os.tmpdir(), 'skill-import-' + Date.now());
                fs.mkdirSync(tmpDir, { recursive: true });
                await extractZip(req.file.path, { dir: tmpDir });
                // Find SKILL.md — might be at root or inside a single subfolder
                let skillRoot = tmpDir;
                if (!fs.existsSync(path.join(skillRoot, 'SKILL.md'))) {
                    const entries = fs.readdirSync(tmpDir).filter(e => fs.statSync(path.join(tmpDir, e)).isDirectory());
                    if (entries.length === 1 && fs.existsSync(path.join(tmpDir, entries[0], 'SKILL.md'))) {
                        skillRoot = path.join(tmpDir, entries[0]);
                    } else {
                        try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
                        try { fs.unlinkSync(req.file.path); } catch (_) {}
                        return res.status(400).json({ error: 'zip 中没有找到 SKILL.md 文件' });
                    }
                }
                // Parse name from SKILL.md frontmatter
                const mdContent = fs.readFileSync(path.join(skillRoot, 'SKILL.md'), 'utf8');
                const nameMatch = mdContent.match(/^name:\s*(.+)$/m);
                const name = nameMatch ? nameMatch[1].trim() : path.basename(req.file.originalname, '.zip');
                const slug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'skill-' + Date.now();
                const destDir = path.join(userSkillsDir, slug);
                if (fs.existsSync(destDir)) {
                    try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
                    try { fs.unlinkSync(req.file.path); } catch (_) {}
                    return res.status(409).json({ error: '同名 Skill 已存在: ' + slug });
                }
                // Copy all files from skillRoot to dest
                const copyDir = (src, dst) => {
                    fs.mkdirSync(dst, { recursive: true });
                    for (const entry of fs.readdirSync(src)) {
                        const s = path.join(src, entry), d = path.join(dst, entry);
                        if (fs.statSync(s).isDirectory()) copyDir(s, d);
                        else fs.copyFileSync(s, d);
                    }
                };
                copyDir(skillRoot, destDir);
                try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                const id = `user:${slug}`;
                const prefs = loadSkillPrefs();
                prefs[id] = true;
                saveSkillPrefs(prefs);
                res.json({ id, name, source_dir: slug, source: 'user', enabled: true });
            } else if (ext === '.md') {
                const content = fs.readFileSync(req.file.path, 'utf8');
                const nameMatch = content.match(/^name:\s*(.+)$/m);
                const name = nameMatch ? nameMatch[1].trim() : path.basename(req.file.originalname, '.md');
                const slug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'skill-' + Date.now();
                const destDir = path.join(userSkillsDir, slug);
                if (fs.existsSync(destDir)) {
                    try { fs.unlinkSync(req.file.path); } catch (_) {}
                    return res.status(409).json({ error: '同名 Skill 已存在: ' + slug });
                }
                fs.mkdirSync(destDir, { recursive: true });
                fs.copyFileSync(req.file.path, path.join(destDir, 'SKILL.md'));
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                const id = `user:${slug}`;
                const prefs = loadSkillPrefs();
                prefs[id] = true;
                saveSkillPrefs(prefs);
                res.json({ id, name, source_dir: slug, source: 'user', enabled: true });
            } else {
                try { fs.unlinkSync(req.file.path); } catch (_) {}
                res.status(400).json({ error: '不支持的文件类型，请上传 .zip 或 .md 文件' });
            }
        } catch (e) {
            try { fs.unlinkSync(req.file.path); } catch (_) {}
            res.status(500).json({ error: e.message });
        }
    });

    // POST /api/skills 鈥?create user skill as ~/.claude/skills/skill-name/SKILL.md
    server.post('/api/skills', (req, res) => {
        const { name, description, content } = req.body;
        if (!name) return res.status(400).json({ error: 'Name is required' });

        // Convert name to directory-safe slug
        const slug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'skill-' + Date.now();
        const skillDir = path.join(userSkillsDir, slug);
        if (fs.existsSync(skillDir)) {
            return res.status(409).json({ error: 'Skill with this name already exists' });
        }

        fs.mkdirSync(skillDir, { recursive: true });
        const frontmatter = `---\nname: ${name}\ndescription: ${description || ''}\n---\n\n${content || ''}`;
        fs.writeFileSync(path.join(skillDir, 'SKILL.md'), frontmatter);

        const id = `user:${slug}`;
        const prefs = loadSkillPrefs();
        prefs[id] = true;
        saveSkillPrefs(prefs);

        res.json({ id, name, description: description || '', content: content || '', is_example: false, source_dir: slug, source: 'user', enabled: true });
    });

    // PATCH /api/skills/:id 鈥?update user skill (writes SKILL.md)
    server.patch('/api/skills/:id', (req, res) => {
        const { id } = req.params;
        // Only user skills (source=user) are editable
        const userSkills = loadUserSkills();
        const skill = userSkills.find(s => s.id === id);
        if (!skill || !skill.source_dir) {
            return res.status(404).json({ error: 'Skill not found or not editable' });
        }
        try {
            const name = req.body.name !== undefined ? req.body.name : skill.name;
            const description = req.body.description !== undefined ? req.body.description : skill.description;
            const content = req.body.content !== undefined ? req.body.content : skill.content;
            const frontmatter = `---\nname: ${name}\ndescription: ${description || ''}\n---\n\n${content || ''}`;
            fs.writeFileSync(path.join(userSkillsDir, skill.source_dir, 'SKILL.md'), frontmatter);

            const prefs = loadSkillPrefs();
            res.json({ ...skill, name, description, content, enabled: prefs[id] !== undefined ? prefs[id] : true });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    // DELETE /api/skills/:id 鈥?delete user skill (removes directory)
    server.delete('/api/skills/:id', (req, res) => {
        const { id } = req.params;
        const userSkills = loadUserSkills();
        const skill = userSkills.find(s => s.id === id);
        if (!skill || !skill.source_dir) {
            return res.status(404).json({ error: 'Skill not found' });
        }
        const skillDir = path.join(userSkillsDir, skill.source_dir);
        if (fs.existsSync(skillDir)) {
            fs.rmSync(skillDir, { recursive: true, force: true });
        }
        const prefs = loadSkillPrefs();
        delete prefs[id];
        saveSkillPrefs(prefs);
        res.json({ ok: true });
    });

    // PATCH /api/skills/:id/toggle 鈥?toggle enabled state
    server.patch('/api/skills/:id/toggle', (req, res) => {
        const { id } = req.params;
        const { enabled } = req.body;
        const prefs = loadSkillPrefs();
        prefs[id] = !!enabled;
        saveSkillPrefs(prefs);
        res.json({ ok: true, enabled: !!enabled });
    });

    // Get all enabled skills with full content (for UseSkill tool)
    function getAllEnabledSkills() {
        const prefs = loadSkillPrefs();
        const enabledIds = Object.keys(prefs).filter(id => prefs[id]);
        if (enabledIds.length === 0) return [];
        const allSkills = [
            ...scanSkillsDir(bundledSkillsDir, 'bundled'),
            ...scanSkillsDir(localSkillsDir, 'local'),
            ...loadUserSkills()
        ];
        return allSkills.filter(s => enabledIds.includes(s.id));
    }

    // Build lightweight skills index for system prompt (names + descriptions only)
    function getEnabledSkillsBlock() {
        const prefs = loadSkillPrefs();
        const enabledIds = Object.keys(prefs).filter(id => prefs[id]);
        console.log(`[Skills] Prefs:`, JSON.stringify(prefs), `Enabled IDs:`, enabledIds);
        if (enabledIds.length === 0) return '';

        const allSkills = [
            ...scanSkillsDir(bundledSkillsDir, 'bundled'),
            ...scanSkillsDir(localSkillsDir, 'local'),
            ...loadUserSkills()
        ];

        console.log(`[Skills] All scanned:`, allSkills.map(s => s.id));
        const enabled = allSkills.filter(s => enabledIds.includes(s.id));
        console.log(`[Skills] Matched enabled:`, enabled.map(s => s.id));
        if (enabled.length === 0) return '';

        // Only inject skill INDEX (name + description) into system prompt.
        // Full content is loaded on demand via the UseSkill tool.
        let block = `<available_skills>
You have the following skills available. When a user's request matches a skill's description, you MUST use it by calling the UseSkill tool with the skill name to load its full instructions, then follow those instructions precisely.

`;
        for (const s of enabled) {
            block += `- **${s.name}**: ${s.description}\n`;
        }
        block += `\nTo use a skill, call the UseSkill tool with the skill name. The tool will return the full skill instructions for you to follow.\n</available_skills>`;
        console.log(`[Skills] ${enabled.length} skill(s) indexed in system prompt`);
        return block;
    }

    // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
    //  GITHUB CONNECTOR 鈥?OAuth + API
    // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

    // GitHub OAuth App credentials. CLIENT_ID is public (embedded in authorize URL),
    // CLIENT_SECRET must NOT be hardcoded — read from env at launch. In production
    // the CI build injects it (see build.yml); in dev set GITHUB_CLIENT_SECRET in shell.
    // Callback URL registered at https://github.com/settings/developers must be:
    //   http://127.0.0.1:30080/api/github/callback
    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Ov23liWiTL6v74GsI2U7';
    const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
    const GITHUB_REDIRECT_URI = 'http://127.0.0.1:30080/api/github/callback';

    // Persistent storage for GitHub token
    const githubTokenPath = path.join(userDataPath, 'github-token.json');
    function loadGithubToken() {
        try {
            if (fs.existsSync(githubTokenPath)) return JSON.parse(fs.readFileSync(githubTokenPath, 'utf8'));
        } catch (_) {}
        return null;
    }
    function saveGithubToken(data) {
        fs.writeFileSync(githubTokenPath, JSON.stringify(data, null, 2));
    }
    function clearGithubToken() {
        try { fs.unlinkSync(githubTokenPath); } catch (_) {}
    }

    // GET /api/github/status 鈥?check connection status
    server.get('/api/github/status', async (req, res) => {
        const token = loadGithubToken();
        if (!token || !token.access_token) return res.json({ connected: false });
        // Return cached user info without verifying every time (saves API calls)
        if (token.login) {
            return res.json({ connected: true, user: { login: token.login, avatar_url: token.avatar_url, name: token.name } });
        }
        res.json({ connected: false });
    });

    // GET /api/github/auth-url 鈥?return OAuth authorize URL
    server.get('/api/github/auth-url', (req, res) => {
        const state = require('crypto').randomBytes(16).toString('hex');
        const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=repo,read:user&state=${state}`;
        res.json({ url, state });
    });

    // GET /api/github/callback 鈥?OAuth callback, exchange code for token
    server.get('/api/github/callback', async (req, res) => {
        const { code } = req.query;
        if (!code) return res.status(400).send('Missing code');
        if (!GITHUB_CLIENT_SECRET) {
            return res.status(503).send('GitHub OAuth not configured: GITHUB_CLIENT_SECRET env var missing. This build cannot complete GitHub login.');
        }
        try {
            // Use https module for better compatibility (avoids fetch issues in some Electron/Node environments)
            const tokenData = await new Promise((resolve, reject) => {
                const postData = JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: GITHUB_REDIRECT_URI });
                const https = require('https');
                const tokenReq = https.request({
                    hostname: 'github.com', path: '/login/oauth/access_token', method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(postData), 'User-Agent': 'ClaudeDesktop' }
                }, (tokenRes) => {
                    let body = '';
                    tokenRes.on('data', c => body += c);
                    tokenRes.on('end', () => { try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Invalid JSON: ' + body.slice(0, 200))); } });
                });
                tokenReq.on('error', reject);
                tokenReq.write(postData);
                tokenReq.end();
            });

            if (tokenData.access_token) {
                // Fetch user info
                const user = await new Promise((resolve) => {
                    const https = require('https');
                    const userReq = https.request({
                        hostname: 'api.github.com', path: '/user', method: 'GET',
                        headers: { 'Authorization': `Bearer ${tokenData.access_token}`, 'User-Agent': 'ClaudeDesktop' }
                    }, (userRes) => {
                        let body = '';
                        userRes.on('data', c => body += c);
                        userRes.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
                    });
                    userReq.on('error', () => resolve({}));
                    userReq.end();
                });
                saveGithubToken({ access_token: tokenData.access_token, login: user.login, avatar_url: user.avatar_url, name: user.name });
                console.log('[GitHub] Connected as', user.login);
                res.send(`<!DOCTYPE html><html><head><title>Connected</title><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#1a1a1a;color:#fff}div{text-align:center}h2{margin-bottom:8px}</style></head><body><div><h2>GitHub Connected!</h2><p>You can close this window.</p><script>setTimeout(()=>window.close(),1500)</script></div></body></html>`);
            } else {
                console.error('[GitHub] Token error:', tokenData);
                res.status(400).send(`OAuth error: ${tokenData.error_description || tokenData.error || 'Unknown error'}`);
            }
        } catch (e) {
            console.error('[GitHub] Callback error:', e);
            res.status(500).send(`Error: ${e.message}`);
        }
    });

    // POST /api/github/disconnect 鈥?remove saved token
    server.post('/api/github/disconnect', (req, res) => {
        clearGithubToken();
        res.json({ ok: true });
    });

    // Helper: make GitHub API request using https module
    function githubApiRequest(path, token) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const req = https.request({
                hostname: 'api.github.com', path, method: 'GET',
                headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'ClaudeDesktop' }
            }, (resp) => {
                let body = '';
                resp.on('data', c => body += c);
                resp.on('end', () => {
                    try { resolve({ status: resp.statusCode, data: JSON.parse(body) }); }
                    catch { reject(new Error('Invalid JSON')); }
                });
            });
            req.on('error', reject);
            req.end();
        });
    }

    // GET /api/github/repos 鈥?list user repos
    server.get('/api/github/repos', async (req, res) => {
        const token = loadGithubToken();
        if (!token?.access_token) return res.status(401).json({ error: 'Not connected' });
        try {
            const page = req.query.page || 1;
            const { status, data } = await githubApiRequest(`/user/repos?sort=updated&per_page=30&page=${page}`, token.access_token);
            if (status !== 200) return res.status(status).json({ error: 'GitHub API error' });
            res.json(data.map(r => ({ id: r.id, name: r.name, full_name: r.full_name, description: r.description, private: r.private, html_url: r.html_url, language: r.language, updated_at: r.updated_at })));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/github/repos/:owner/:repo/contents 鈥?browse repo contents
    server.get('/api/github/repos/:owner/:repo/contents', async (req, res) => {
        const token = loadGithubToken();
        if (!token?.access_token) return res.status(401).json({ error: 'Not connected' });
        try {
            const filePath = req.query.path || '';
            const ref = req.query.ref || '';
            let apiPath = `/repos/${req.params.owner}/${req.params.repo}/contents/${filePath}`;
            if (ref) apiPath += `?ref=${encodeURIComponent(ref)}`;
            const { status, data } = await githubApiRequest(apiPath, token.access_token);
            if (status !== 200) return res.status(status).json({ error: 'GitHub API error' });
            res.json(data);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // GET /api/github/search 鈥?search code across repos
    server.get('/api/github/search', async (req, res) => {
        const token = loadGithubToken();
        if (!token?.access_token) return res.status(401).json({ error: 'Not connected' });
        try {
            const q = encodeURIComponent(req.query.q || '');
            const { status, data } = await githubApiRequest(`/search/code?q=${q}&per_page=20`, token.access_token);
            if (status !== 200) return res.status(status).json({ error: 'GitHub API error' });
            res.json(data);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Helper: fetch a GitHub blob as Buffer (handles both git blobs API and contents API fallback)
    function githubFetchBlob(owner, repoName, sha, accessToken) {
        return new Promise((resolve, reject) => {
            const https = require('https');
            const req = https.request({
                hostname: 'api.github.com',
                path: `/repos/${owner}/${repoName}/git/blobs/${sha}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'User-Agent': 'ClaudeDesktop',
                    'Accept': 'application/vnd.github.v3+json',
                }
            }, (resp) => {
                let body = '';
                resp.on('data', c => body += c);
                resp.on('end', () => {
                    try {
                        if (resp.statusCode !== 200) return reject(new Error('blob status ' + resp.statusCode));
                        const data = JSON.parse(body);
                        if (!data || !data.content) return reject(new Error('blob missing content'));
                        resolve(Buffer.from(String(data.content).replace(/\n/g, ''), 'base64'));
                    } catch (e) { reject(e); }
                });
            });
            req.on('error', reject);
            req.end();
        });
    }

    // POST /api/github/materialize — write selected files to conv workspace
    server.post('/api/github/materialize', async (req, res) => {
        const token = loadGithubToken();
        if (!token?.access_token) return res.status(401).json({ error: 'Not connected' });
        const { conversationId, repoFullName, ref, selections } = req.body || {};
        if (!conversationId || !repoFullName || !Array.isArray(selections) || selections.length === 0) {
            return res.status(400).json({ error: 'Missing conversationId, repoFullName, or selections' });
        }
        const conv = db.conversations.find(c => c.id === conversationId);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        const workspacePath = conv.workspace_path;
        if (!workspacePath) return res.status(500).json({ error: 'Conversation has no workspace_path' });
        try { fs.mkdirSync(workspacePath, { recursive: true }); } catch (_) {}

        const [owner, repoName] = String(repoFullName).split('/');
        if (!owner || !repoName) return res.status(400).json({ error: 'Invalid repoFullName' });

        try {
            // Resolve default branch if ref not provided
            let refToUse = ref;
            if (!refToUse) {
                const r = await githubApiRequest(`/repos/${owner}/${repoName}`, token.access_token);
                if (r.status !== 200) return res.status(r.status).json({ error: 'Repo fetch failed' });
                refToUse = r.data.default_branch || 'main';
            }
            // Resolve tree sha via branch
            const bRes = await githubApiRequest(`/repos/${owner}/${repoName}/branches/${encodeURIComponent(refToUse)}`, token.access_token);
            if (bRes.status !== 200) return res.status(bRes.status).json({ error: 'Branch fetch failed' });
            const treeSha = bRes.data?.commit?.commit?.tree?.sha;
            if (!treeSha) return res.status(404).json({ error: 'Tree sha not found' });
            // Fetch recursive tree (includes sha per blob)
            const treeRes = await githubApiRequest(`/repos/${owner}/${repoName}/git/trees/${treeSha}?recursive=1`, token.access_token);
            if (treeRes.status !== 200) return res.status(treeRes.status).json({ error: 'Tree fetch failed' });
            const tree = (treeRes.data && Array.isArray(treeRes.data.tree)) ? treeRes.data.tree : [];

            // Expand selections to concrete blobs
            const seen = Object.create(null);
            const toFetch = [];
            for (const sel of selections) {
                if (!sel || typeof sel.path !== 'string') continue;
                if (sel.isFolder) {
                    const prefix = sel.path === '' ? '' : sel.path + '/';
                    for (const t of tree) {
                        if (!t || t.type !== 'blob') continue;
                        if (prefix !== '' && String(t.path).indexOf(prefix) !== 0) continue;
                        if (seen[t.path]) continue;
                        seen[t.path] = true;
                        toFetch.push({ path: t.path, sha: t.sha, size: t.size || 0 });
                    }
                } else {
                    for (const t of tree) {
                        if (t && t.type === 'blob' && t.path === sel.path) {
                            if (!seen[t.path]) {
                                seen[t.path] = true;
                                toFetch.push({ path: t.path, sha: t.sha, size: t.size || 0 });
                            }
                            break;
                        }
                    }
                }
            }

            if (toFetch.length === 0) {
                return res.status(400).json({ error: 'No files matched selection' });
            }

            // Write target root: <workspace>/github/<owner>/<repo>
            const targetRoot = path.join(workspacePath, 'github', owner, repoName);
            fs.mkdirSync(targetRoot, { recursive: true });

            // Parallel fetch with concurrency limit
            const CONCURRENCY = 8;
            let cursor = 0;
            const materialized = [];
            const errors = [];
            const runWorker = async () => {
                while (true) {
                    const idx = cursor++;
                    if (idx >= toFetch.length) return;
                    const f = toFetch[idx];
                    try {
                        const buf = await githubFetchBlob(owner, repoName, f.sha, token.access_token);
                        const outPath = path.join(targetRoot, f.path);
                        fs.mkdirSync(path.dirname(outPath), { recursive: true });
                        fs.writeFileSync(outPath, buf);
                        materialized.push({ path: f.path, size: f.size });
                    } catch (e) {
                        errors.push({ path: f.path, error: (e && e.message) || String(e) });
                    }
                }
            };
            const workers = [];
            const workerCount = Math.min(CONCURRENCY, toFetch.length);
            for (let w = 0; w < workerCount; w++) workers.push(runWorker());
            await Promise.all(workers);

            // Persist metadata (replace any existing entry for this repo)
            const relRoot = `./github/${owner}/${repoName}`;
            const metaPath = path.join(workspacePath, '.github-context.json');
            let meta = { repos: [] };
            if (fs.existsSync(metaPath)) {
                try { meta = JSON.parse(fs.readFileSync(metaPath, 'utf8')) || { repos: [] }; } catch (_) { meta = { repos: [] }; }
            }
            if (!Array.isArray(meta.repos)) meta.repos = [];
            meta.repos = meta.repos.filter(r => r && r.repo !== repoFullName);
            meta.repos.push({
                repo: repoFullName,
                ref: refToUse,
                rootDir: relRoot,
                files: materialized,
                addedAt: new Date().toISOString(),
            });
            try { fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2)); } catch (_) {}

            console.log(`[GitHub Materialize] ${repoFullName} — wrote ${materialized.length}/${toFetch.length} files to ${targetRoot}`);

            res.json({
                ok: true,
                repoFullName,
                ref: refToUse,
                rootDir: relRoot,
                fileCount: materialized.length,
                skipped: errors.length,
            });
        } catch (e) {
            console.error('[GitHub Materialize] error:', e);
            res.status(500).json({ error: (e && e.message) || String(e) });
        }
    });

    // GET /api/github/repos/:owner/:repo/tree — recursive git tree (for folder size calc)
    server.get('/api/github/repos/:owner/:repo/tree', async (req, res) => {
        const token = loadGithubToken();
        if (!token?.access_token) return res.status(401).json({ error: 'Not connected' });
        try {
            const { owner, repo } = req.params;
            // Resolve default branch
            const repoRes = await githubApiRequest(`/repos/${owner}/${repo}`, token.access_token);
            if (repoRes.status !== 200) return res.status(repoRes.status).json({ error: 'Repo fetch failed' });
            const ref = req.query.ref || repoRes.data.default_branch || 'main';
            const bRes = await githubApiRequest(`/repos/${owner}/${repo}/branches/${encodeURIComponent(ref)}`, token.access_token);
            if (bRes.status !== 200) return res.status(bRes.status).json({ error: 'Branch fetch failed' });
            const treeSha = bRes.data?.commit?.commit?.tree?.sha;
            if (!treeSha) return res.status(404).json({ error: 'Tree sha not found' });
            const { status, data } = await githubApiRequest(`/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, token.access_token);
            if (status !== 200) return res.status(status).json({ error: 'GitHub API error' });
            res.json({
                sha: data.sha,
                truncated: !!data.truncated,
                tree: (data.tree || []).map(t => ({ path: t.path, type: t.type, size: t.size || 0 })),
            });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
    //  CHAT ENDPOINT 鈥?Claude Code Engine via Bun CLI subprocess
    // 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

    const { spawn } = require('child_process');

    // Resolve engine path 鈥?in packaged app, engine is in resources/engine
    const isPacked = app.isPackaged;
    const engineDir = isPacked
        ? path.join(process.resourcesPath, 'engine')
        : path.join(__dirname, '..', 'engine');
    const engineCli = path.join(engineDir, 'src', 'entrypoints', 'cli.tsx');
    const engineEnv = path.join(engineDir, '.env');

    // Resolve Bun executable: bundled 鈫?user-installed 鈫?PATH
    function findBunExe() {
        const bundled = path.join(engineDir, 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun');
        if (fs.existsSync(bundled)) return bundled;
        const userInstalled = process.platform === 'win32'
            ? path.join(os.homedir(), '.bun', 'bin', 'bun.exe')
            : path.join(os.homedir(), '.bun', 'bin', 'bun');
        if (fs.existsSync(userInstalled)) return userInstalled;
        return 'bun'; // fallback to PATH
    }
    const bunExePath = findBunExe();
    console.log('[Engine] Bun:', bunExePath, 'exists:', fs.existsSync(bunExePath));

    // Detect git-bash on Windows (Claude Code SDK requires it).
    // Returns a path to bash.exe, or null if not found.
    function findGitBashPath() {
        if (process.platform !== 'win32') return null;
        if (process.env.CLAUDE_CODE_GIT_BASH_PATH && fs.existsSync(process.env.CLAUDE_CODE_GIT_BASH_PATH)) {
            return process.env.CLAUDE_CODE_GIT_BASH_PATH;
        }
        const candidates = [
            'C:\\Program Files\\Git\\bin\\bash.exe',
            'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
            path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'bin', 'bash.exe'),
            process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'),
            process.env.ProgramW6432 && path.join(process.env.ProgramW6432, 'Git', 'bin', 'bash.exe'),
        ].filter(Boolean);
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) return candidate;
        }
        // Fallback: try `where git` and derive bash path from it
        try {
            const out = require('child_process').execSync('where git', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
            const gitExe = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)[0];
            if (gitExe) {
                const bashFromGit = path.join(path.dirname(path.dirname(gitExe)), 'bin', 'bash.exe');
                if (fs.existsSync(bashFromGit)) return bashFromGit;
            }
        } catch (_) {}
        return null;
    }
    const gitBashPath = findGitBashPath();
    if (process.platform === 'win32') {
        console.log('[Engine] git-bash:', gitBashPath || 'NOT FOUND (Claude Code SDK will fail)');
    }

    // Load engine .env so bridge-server can use the same API config (for vision direct API calls)
    const engineEnvVars = {};
    try {
        const envContent = fs.readFileSync(engineEnv, 'utf8');
        for (const line of envContent.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) engineEnvVars[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
        }
        console.log('[Engine] Loaded .env:', Object.keys(engineEnvVars).join(', '));
    } catch (_) {}
    const enginePreload = path.join(engineDir, 'preload.ts');

    // Helper: stream one API round, returns parsed response
    async function streamApiRound(endpoint, apiKey, model, systemPrompt, messages, tools, thinkingEnabled, sendSSE) {
        console.log(`[API] model=${model} thinking=${thinkingEnabled} systemPrompt=${systemPrompt ? systemPrompt.length + ' chars' : 'NONE'} messages=${messages.length} tools=${tools.length}`);
        const body = {
            model,
            system: systemPrompt || undefined,
            messages,
            tools: tools.length > 0 ? tools : undefined,
            max_tokens: thinkingEnabled ? 16000 : 8192,
            stream: true,
        };
        if (thinkingEnabled) {
            body.thinking = { type: 'enabled', budget_tokens: 10000 };
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            let errMsg = `API Error ${response.status}`;
            try { const j = JSON.parse(errText); errMsg = j.error?.message || j.error || errMsg; } catch { if (errText) errMsg += `: ${errText.slice(0, 300)}`; }
            throw new Error(errMsg);
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let sseBuffer = '';
        let assistantText = '';
        let thinkingText = '';
        const contentBlocks = []; // accumulate full content blocks
        const blockAccumulators = {}; // index 鈫?{ type, data }
        let stopReason = null;
        let usage = {};

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            sseBuffer += decoder.decode(value, { stream: true });
            const consumed = consumeSSEPayloads(sseBuffer);
            sseBuffer = consumed.remainder;

            for (const data of consumed.payloads) {
                if (data === '[DONE]') continue;

                let parsed;
                try { parsed = JSON.parse(data); } catch { continue; }

                switch (parsed.type) {
                    case 'content_block_start': {
                        const idx = parsed.index;
                        const block = parsed.content_block;
                        if (block.type === 'text') {
                            blockAccumulators[idx] = { type: 'text', text: '' };
                        } else if (block.type === 'thinking') {
                            blockAccumulators[idx] = { type: 'thinking', thinking: '' };
                        } else if (block.type === 'tool_use') {
                            blockAccumulators[idx] = { type: 'tool_use', id: block.id, name: block.name, inputJson: (block.input && Object.keys(block.input).length > 0) ? JSON.stringify(block.input) : '' };
                        }
                        break;
                    }
                    case 'content_block_delta': {
                        const idx = parsed.index;
                        const delta = parsed.delta;
                        const acc = blockAccumulators[idx];
                        if (!acc) break;

                        if (delta.type === 'text_delta' && delta.text) {
                            acc.text += delta.text;
                            assistantText += delta.text;
                            // Forward to frontend 鈥?REAL streaming!
                            sendSSE({ type: 'content_block_delta', delta: { type: 'text_delta', text: delta.text } });
                        } else if (delta.type === 'thinking_delta' && delta.thinking) {
                            acc.thinking += delta.thinking;
                            thinkingText += delta.thinking;
                            sendSSE({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: delta.thinking } });
                        } else if (delta.type === 'input_json_delta' && delta.partial_json) {
                            acc.inputJson += delta.partial_json;
                        }
                        break;
                    }
                    case 'content_block_stop': {
                        const idx = parsed.index;
                        const acc = blockAccumulators[idx];
                        if (!acc) break;

                        if (acc.type === 'text') {
                            contentBlocks.push({ type: 'text', text: acc.text });
                        } else if (acc.type === 'thinking') {
                            contentBlocks.push({ type: 'thinking', thinking: acc.thinking });
                        } else if (acc.type === 'tool_use') {
                            let input = {};
                            try { input = JSON.parse(acc.inputJson); } catch { }
                            contentBlocks.push({ type: 'tool_use', id: acc.id, name: acc.name, input });
                            // Notify frontend
                            sendSSE({ type: 'tool_use_start', tool_use_id: acc.id, tool_name: acc.name, tool_input: input });
                            console.log(`[Tool] ${acc.name}`, JSON.stringify(input).slice(0, 150));
                        }
                        delete blockAccumulators[idx];
                        break;
                    }
                    case 'message_delta': {
                        if (parsed.delta?.stop_reason) stopReason = parsed.delta.stop_reason;
                        if (parsed.usage) usage = { ...usage, ...parsed.usage };
                        break;
                    }
                }
            }
        }

        return { contentBlocks, assistantText, thinkingText, stopReason, usage };
    }


    // ============ PERSISTENT ENGINE POOL ============
    const MAX_ENGINE_POOL_SIZE = 3;
    const enginePool = new Map();
    const HIDDEN_TOOLS = new Set(['EnterWorktree', 'ExitWorktree', 'TodoWrite']);

    function summarizeEngine(eng) {
        if (!eng) return 'null';
        return JSON.stringify({
            convId: eng.convId,
            state: eng.state,
            modelId: eng.modelId,
            needsRestart: !!eng.needsRestart,
            ready: !!eng.ready,
            pid: eng.child && eng.child.pid,
            killed: !!(eng.child && eng.child.killed),
            exitCode: eng.child ? eng.child.exitCode : undefined,
            hasTurn: !!eng.turn,
            sessionId: eng.sessionId || null,
        });
    }
    function summarizeEnginePool() {
        return Array.from(enginePool.values()).map(summarizeEngine).join(' | ') || '(empty)';
    }
    function killEngine(convId, reason, extra) {
        const eng = enginePool.get(convId);
        if (!eng) return;
        const stack = new Error().stack || '';
        const stackLines = stack.split('\n').slice(2, 5).map(s => s.trim()).join(' <= ');
        console.log('[EnginePool] Killing engine for', convId,
            '| reason=', reason || 'unspecified',
            extra ? '| extra=' + JSON.stringify(extra).slice(0, 500) : '',
            '| engine=', summarizeEngine(eng),
            '| pool=', summarizeEnginePool(),
            '| caller=', stackLines);
        try { eng.child.stdin.end(); } catch (_) {}
        try { eng.child.kill(); } catch (_) {}
        enginePool.delete(convId);
        activeChildren.delete(convId);
    }
    function evictOldestEngine() {
        if (enginePool.size < MAX_ENGINE_POOL_SIZE) return;
        let oldestId = null, oldestTime = Infinity;
        for (const [id, eng] of enginePool) {
            if (eng.state === 'processing') continue;
            if (eng.lastUsed < oldestTime) { oldestTime = eng.lastUsed; oldestId = id; }
        }
        if (oldestId) killEngine(oldestId, 'evict_oldest_idle_engine', { oldestTime, poolSize: enginePool.size });
    }
    function isEngineAlive(eng) { return eng && eng.child && !eng.child.killed && eng.child.exitCode === null; }

    function buildChatSystemPrompt(conv, user_mode, user_profile) {
        let sysPrompt = (user_mode === 'selfhosted' ? customSystemPromptClean : customSystemPromptFull) || '';
        if (user_profile) {
            const parts = [];
            if (user_profile.work_function) parts.push('Occupation: ' + user_profile.work_function);
            if (user_profile.personal_preferences) parts.push('User preferences: ' + user_profile.personal_preferences);
            if (parts.length > 0) sysPrompt += '\n\n<user_profile>\n' + parts.join('\n') + '\n</user_profile>';
        }
        if (conv.project_id) {
            const project = db.projects.find(p => p.id === conv.project_id);
            if (project) {
                if (project.instructions && project.instructions.trim()) sysPrompt += '\n\n<project_instructions>\n' + project.instructions.trim() + '\n</project_instructions>';
                const pFiles = db.project_files.filter(f => f.project_id === project.id);
                if (pFiles.length > 0) {
                    // Copy project files to workspace so the engine can read them with tools
                    for (const pf of pFiles) {
                        const destPath = path.join(conv.workspace_path, pf.file_name);
                        if (!fs.existsSync(destPath)) {
                            // Prefer original file on disk; fall back to extracted_text
                            if (pf.file_path && fs.existsSync(pf.file_path)) {
                                try { fs.copyFileSync(pf.file_path, destPath); } catch (_) {}
                            } else if (pf.extracted_text) {
                                try { fs.writeFileSync(destPath, pf.extracted_text, 'utf8'); } catch (_) {}
                            }
                        }
                    }
                    // Only list filenames in the prompt 鈥?model reads files on-demand via Read tool
                    const textExts = ['.txt', '.md', '.json', '.xml', '.yaml', '.yml', '.csv', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h', '.go', '.rs', '.rb', '.php', '.sql', '.sh', '.lua', '.r'];
                    let c = '\n\n<project_knowledge_base>\nThe following project files are available in the workspace. Read them when needed:\n';
                    for (const pf of pFiles) {
                        const ext = path.extname(pf.file_name).toLowerCase();
                        const isText = textExts.includes(ext);
                        c += '- ./' + pf.file_name + ' (' + Math.round((pf.file_size || 0) / 1024) + ' KB' + (isText ? '' : ', binary') + ')\n';
                    }
                    sysPrompt += c + '</project_knowledge_base>';
                }
            }
        }
        return sysPrompt;
    }
    function resolveChatConfig(conv, user_mode, env_token, env_base_url) {
        const rawModel = conv.model || 'claude-sonnet-4-6';
        const thinkingEnabled = /-thinking$/.test(rawModel);
        const requestedModelId = rawModel.replace(/-thinking$/, '');
        const effectiveUserMode = user_mode === 'selfhosted' ? 'selfhosted' : 'clawparrot';
        const initialProvider = effectiveUserMode === 'selfhosted' ? resolveProvider(requestedModelId) : null;
        const routed = resolveRequestedModelForMode({
            modelId: requestedModelId,
            userMode: effectiveUserMode,
            hasProvider: !!initialProvider,
        });
        let modelId = routed.modelId;
        if (routed.fallbackApplied) {
            console.warn('[Chat] Non-Claude model', requestedModelId, 'detected under clawparrot mode — falling back to', modelId);
        }
        if (routed.error) {
            throw new Error(routed.error);
        }
        const provider = effectiveUserMode === 'selfhosted' ? resolveProvider(modelId) : null;
        let apiKey, baseUrl, apiFormat = 'anthropic';
        let supportsWebSearch = false;
        let webSearchStrategy = null;
        if (provider) {
            apiKey = provider.apiKey; baseUrl = provider.baseUrl; apiFormat = provider.format || 'anthropic';
            // Web search is gated by the stored probe result — no implicit support based on format.
            supportsWebSearch = provider.supportsWebSearch === true;
            webSearchStrategy = provider.webSearchStrategy || null;
            console.log('[Chat] Provider:', provider.name, '| format:', apiFormat, '| model:', modelId, '| webSearch:', supportsWebSearch, '| strategy:', webSearchStrategy);
        }
        else { const validToken = (env_token && env_token !== 'self-hosted') ? env_token : ''; apiKey = validToken || engineEnvVars.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY; baseUrl = validToken ? (env_base_url || engineEnvVars.ANTHROPIC_BASE_URL || process.env.ANTHROPIC_BASE_URL) : (engineEnvVars.ANTHROPIC_BASE_URL || env_base_url || process.env.ANTHROPIC_BASE_URL); supportsWebSearch = true; }
        return { modelId, thinkingEnabled, provider, apiKey, baseUrl, apiFormat, supportsWebSearch, webSearchStrategy };
    }

    function handleTurnEvent(engine, convId, conv, evt) {
        const turn = engine.turn;
        if (!turn || !turn.sendSSE) return;
        refreshTurnActivityTimeout(engine, convId, conv, evt.type + (evt.subtype ? ':' + evt.subtype : ''));
        const sendSSE = turn.sendSSE;
        const summarizeToolInputForLog = (toolName, input) => {
            if (!input || typeof input !== 'object') return '{}';
            if (toolName === 'Write') return JSON.stringify({ file_path: input.file_path || '', contentLen: typeof input.content === 'string' ? input.content.length : null });
            if (toolName === 'Edit') return JSON.stringify({
                file_path: input.file_path || '',
                replace_all: !!input.replace_all,
                oldLen: typeof input.old_string === 'string' ? input.old_string.length : null,
                newLen: typeof input.new_string === 'string' ? input.new_string.length : null,
            });
            if (toolName === 'Read') return JSON.stringify({ file_path: input.file_path || '', offset: input.offset || null, limit: input.limit || null });
            if (toolName === 'Bash') return JSON.stringify({ commandLen: typeof input.command === 'string' ? input.command.length : null, timeout: input.timeout || null });
            return JSON.stringify(input).slice(0, 200);
        };
        const ensureStart = (id) => { if (!turn.sentToolStarts.has(id)) { var t = turn.toolCalls.get(id); if (t && !HIDDEN_TOOLS.has(t.name)) { turn.sentToolStarts.add(id); sendSSE({ type: 'tool_use_start', tool_use_id: t.id, tool_name: t.name, tool_input: t.input || {}, textBefore: t.textBefore || '' }); } } };

        if (evt.type === 'stream_event' && evt.event) {
            var se = evt.event;
            if (se.type === 'content_block_delta') {
                if (se.delta && se.delta.type === 'text_delta') { turn.assistantText += se.delta.text; turn.pendingWorkText += se.delta.text; sendSSE({ type: 'content_block_delta', delta: { type: 'text_delta', text: se.delta.text } }); }
                else if (se.delta && se.delta.type === 'thinking_delta') { turn.thinkingText += se.delta.thinking; sendSSE({ type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: se.delta.thinking } }); }
            } else if (se.type === 'content_block_start' && se.content_block && se.content_block.type === 'tool_use') {
                var tu = se.content_block;
                var capturedTextBefore = turn.pendingWorkText.trim();
                turn.toolCalls.set(tu.id, { id: tu.id, name: tu.name, input: tu.input || {}, status: 'running', textBefore: capturedTextBefore });
                turn.toolCallOrder.push(tu.id);
                turn.pendingWorkText = '';
                // Emit tool placeholder NOW so the UI can render it in the right position
                // relative to the streaming text. Input may be empty here; it will be
                // updated via 'tool_use_input' once the input JSON has finished streaming.
                if (!HIDDEN_TOOLS.has(tu.name) && !turn.sentToolStarts.has(tu.id)) {
                    turn.sentToolStarts.add(tu.id);
                    sendSSE({ type: 'tool_use_start', tool_use_id: tu.id, tool_name: tu.name, tool_input: tu.input || {}, textBefore: capturedTextBefore });
                }
            }
        }
        else if (evt.type === 'assistant' && evt.message && evt.message.content) {
            // Capture the engine session uuid the first time we see it this turn.
            // Used by finishTurn to set db.messages.id, so the row's id matches the
            // uuid in Claude Code's session JSONL — required for `--resume-session-at`
            // to find this message when rewinding context after delete/edit/regenerate.
            if (evt.uuid && !turn.assistantUuid) turn.assistantUuid = evt.uuid;
            for (var block of evt.message.content) {
                if (block.type !== 'tool_use') continue;
                var tc = turn.toolCalls.get(block.id);
                if (tc) { tc.input = block.input; } else { tc = { id: block.id, name: block.name, input: block.input, status: 'running', textBefore: turn.pendingWorkText.trim() }; turn.toolCalls.set(block.id, tc); turn.toolCallOrder.push(block.id); turn.pendingWorkText = ''; }
                if (block.name === 'WebSearch') {
                    if (!turn.sentToolStarts.has(block.id)) {
                        turn.sentToolStarts.add(block.id);
                        sendSSE({ type: 'tool_use_start', tool_use_id: block.id, tool_name: block.name, tool_input: block.input, textBefore: (tc && tc.textBefore) || '' });
                    } else {
                        sendSSE({ type: 'tool_use_input', tool_use_id: block.id, tool_input: block.input });
                    }
                    sendSSE({ type: 'status', message: 'Searching: ' + ((block.input && block.input.query) || 'the web') });
                } else if (block.name === 'WebFetch') {
                    if (!turn.sentToolStarts.has(block.id)) {
                        turn.sentToolStarts.add(block.id);
                        sendSSE({ type: 'tool_use_start', tool_use_id: block.id, tool_name: block.name, tool_input: block.input, textBefore: (tc && tc.textBefore) || '' });
                    } else {
                        sendSSE({ type: 'tool_use_input', tool_use_id: block.id, tool_input: block.input });
                    }
                    sendSSE({ type: 'status', message: 'Fetching: ' + ((block.input && block.input.url) || '') });
                } else if (!HIDDEN_TOOLS.has(block.name)) {
                    if (!turn.sentToolStarts.has(block.id)) {
                        // stream_event content_block_start did not fire (some providers); send placeholder + full input together
                        turn.sentToolStarts.add(block.id);
                        sendSSE({ type: 'tool_use_start', tool_use_id: block.id, tool_name: block.name, tool_input: block.input, textBefore: (tc && tc.textBefore) || '' });
                    } else {
                        // Placeholder already sent at content_block_start; now push the full input
                        sendSSE({ type: 'tool_use_input', tool_use_id: block.id, tool_input: block.input });
                    }
                    console.log('[Tool]', block.name, JSON.stringify(block.input || {}).slice(0, 120));
                }
            }
        }
        else if (evt.type === 'user' && evt.message && evt.message.content) {
            var contentArr = Array.isArray(evt.message.content) ? evt.message.content : [];
            for (var ci = 0; ci < contentArr.length; ci++) {
                var cb = contentArr[ci]; if (cb.type !== 'tool_result' || !cb.tool_use_id) continue;
                var tc3 = turn.toolCalls.get(cb.tool_use_id), tn = tc3 ? tc3.name : '';
                var trText = ''; if (typeof cb.content === 'string') trText = cb.content; else if (Array.isArray(cb.content)) trText = cb.content.map(function(x) { return x.text || ''; }).join('');
                if (tc3) { tc3.status = cb.is_error ? 'error' : 'done'; tc3.result = trText; }
                if (cb.is_error) console.warn('[ToolError]', tn || '(unknown)', '| conv=', convId, '| input=', summarizeToolInputForLog(tn, tc3 && tc3.input), '| result=', trText.slice(0, 500));
                turn.lastToolDoneTextLen = turn.assistantText.length;
                // Emit offset immediately so frontend can split "work text" vs "final answer"
                // in real-time — otherwise assistant text generated after a tool completes
                // accumulates inside the tool card area until finishTurn.
                sendSSE({ type: 'tool_text_offset', offset: turn.lastToolDoneTextLen });
                if (tn === 'WebSearch' && trText) { try { var wsQ = ''; var qM = trText.match(/query:\s*"([^"]+)"/); if (qM) wsQ = qM[1]; var wsS = []; var lM = trText.match(/Links:\s*(\[[\s\S]*?\])\s*\n/); if (lM) { try { var lnk = JSON.parse(lM[1]); if (Array.isArray(lnk)) wsS = lnk.filter(function(l){return l.url;}).map(function(l){return {url:l.url,title:l.title||''};}); } catch(_){} } if (wsS.length>0&&wsQ) { sendSSE({type:'search_sources',sources:wsS,query:wsQ}); turn.searchLogs.push({query:wsQ,results:wsS}); } } catch(_){} }
                if (!HIDDEN_TOOLS.has(tn)) { ensureStart(cb.tool_use_id); sendSSE({ type: 'tool_use_done', tool_use_id: cb.tool_use_id, content: trText.slice(0, 50000), is_error: cb.is_error || false }); }
            }
        }
        else if (evt.type === 'tool') {
            var resultText = typeof evt.content === 'string' ? evt.content : Array.isArray(evt.content) ? evt.content.map(function(b){return b.text||'';}).join('') : '';
            var tc2 = turn.toolCalls.get(evt.tool_use_id), toolName = tc2 ? tc2.name : '';
            if (tc2) { tc2.status = evt.is_error ? 'error' : 'done'; tc2.result = resultText; }
            if (evt.is_error) console.warn('[ToolError]', toolName || '(unknown)', '| conv=', convId, '| input=', summarizeToolInputForLog(toolName, tc2 && tc2.input), '| result=', resultText.slice(0, 500));
            turn.lastToolDoneTextLen = turn.assistantText.length;
            sendSSE({ type: 'tool_text_offset', offset: turn.lastToolDoneTextLen });
            if (toolName === 'WebSearch' && resultText) { try { var qm2=resultText.match(/query:\s*"([^"]+)"/); var lm2=resultText.match(/Links:\s*(\[[\s\S]*?\])\s*\n/); if(qm2&&lm2){var lk2=JSON.parse(lm2[1]); var sr=lk2.filter(function(l){return l.url;}).map(function(l){return{url:l.url,title:l.title||''};});if(sr.length>0)sendSSE({type:'search_sources',sources:sr,query:qm2[1]});} } catch(_){} }
            if (toolName === 'Write' && tc2 && tc2.input && tc2.input.file_path) { var prevId = turn.writtenFiles.get(tc2.input.file_path); if (prevId) turn.toolCalls.delete(prevId); turn.writtenFiles.set(tc2.input.file_path, evt.tool_use_id); }
            if (!HIDDEN_TOOLS.has(toolName)) { ensureStart(evt.tool_use_id); sendSSE({ type: 'tool_use_done', tool_use_id: evt.tool_use_id, content: resultText.slice(0, 50000), is_error: evt.is_error || false }); }
        }
        else if (evt.type === 'control_request' && evt.request) {
            var req2 = evt.request;
            if (req2.subtype === 'can_use_tool' && req2.tool_name === 'AskUserQuestion') {
                askUserPendingInputs.set(convId, req2.input || {});
                sendSSE({ type: 'ask_user', request_id: evt.request_id, tool_use_id: req2.tool_use_id, questions: (req2.input && req2.input.questions) || [] });
            } else {
                var ar = JSON.stringify({ type: 'control_response', response: { subtype: 'success', request_id: evt.request_id, response: { toolUseID: req2.tool_use_id, behavior: 'allow', updatedInput: req2.input || {} } } }) + '\n';
                try { engine.child.stdin.write(ar); } catch (_) {}
            }
        }
        else if (evt.type === 'system' && (evt.subtype === 'task_started' || evt.subtype === 'task_progress' || evt.subtype === 'task_notification')) {
            sendSSE({ type: 'task_event', subtype: evt.subtype, task_id: evt.task_id, description: evt.description, status: evt.status, summary: evt.summary, usage: evt.usage, last_tool_name: evt.last_tool_name });
        }
        else if (evt.type === 'system' && evt.subtype === 'compact_boundary') {
            var meta = evt.compact_metadata || {}; sendSSE({ type: 'compact_boundary', compact_metadata: meta });
            db.messages.push({ id: uuidv4(), conversation_id: convId, role: 'system', content: JSON.stringify([{ type: 'text', text: 'Context auto-compacted by engine.' }]), created_at: new Date().toISOString(), is_compact_boundary: true }); saveDb();
        }
    }

    function finishTurn(engine, convId, conv) {
        const turn = engine.turn; if (!turn) return;
        console.log('[Chat] finishTurn', '| conv=', convId, '| engine=', summarizeEngine(engine), '| assistantLen=', (turn.assistantText || '').length, '| thinkingLen=', (turn.thinkingText || '').length, '| toolCalls=', turn.toolCalls.size);
        if (turn.timeoutId) clearTimeout(turn.timeoutId);
        if (turn.maxTimeoutId) clearTimeout(turn.maxTimeoutId);
        engine.turn = null; engine.state = 'idle';
        if (turn.assistantText || turn.thinkingText || turn.toolCalls.size > 0) {
            db.messages.push({ id: turn.assistantUuid || uuidv4(), conversation_id: convId, role: 'assistant', content: JSON.stringify([{ type: 'text', text: turn.assistantText }]), created_at: new Date().toISOString(), model: conv.model, engineUuidSynced: !!turn.assistantUuid, thinking: turn.thinkingText || undefined, toolCalls: turn.toolCalls.size > 0 ? turn.toolCallOrder.map(id => turn.toolCalls.get(id)).filter(Boolean) : undefined, toolTextEndOffset: (turn.toolCalls.size > 0 && turn.lastToolDoneTextLen > 0) ? turn.lastToolDoneTextLen : undefined, searchLogs: turn.searchLogs.length > 0 ? turn.searchLogs : undefined });
            saveDb();
            generateTitleAsync(convId, turn.message.slice(0, 300), turn.assistantText.slice(0, 300), turn.apiKey, turn.baseUrl, conv.model, turn.apiFormat);
        }
        if (turn.toolCalls.size > 0 && turn.lastToolDoneTextLen > 0) turn.sendSSE({ type: 'tool_text_offset', offset: turn.lastToolDoneTextLen });
        pendingImageBlocks.delete(convId);
        turn.sendSSE({ type: 'message_stop' });
        endStream(convId);
        if (turn.resolve) turn.resolve();
    }
    function failTurnAndRecycleEngine(engine, convId, conv, reason, userError, extra) {
        const turn = engine && engine.turn;
        if (!turn) return;
        const meta = Object.assign({
            lastActivitySource: turn.lastActivitySource || 'unknown',
            startedAt: turn.startedAt || null,
            lastActivityAt: turn.lastActivityAt || null,
        }, extra || {});
        console.error('[Chat] Aborting turn and recycling engine',
            '| conv=', convId,
            '| reason=', reason || 'unspecified',
            '| meta=', JSON.stringify(meta).slice(0, 500));
        if (userError) {
            try { turn.sendSSE({ type: 'error', error: userError }); } catch (_) {}
        }
        finishTurn(engine, convId, conv);
        killEngine(convId, reason || 'turn_aborted', meta);
    }
    function refreshTurnActivityTimeout(engine, convId, conv, source) {
        const turn = engine && engine.turn;
        if (!turn) return;
        turn.lastActivityAt = Date.now();
        turn.lastActivitySource = source || 'unknown';
        const TURN_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
        if (turn.timeoutId) clearTimeout(turn.timeoutId);
        turn.timeoutId = setTimeout(() => {
            if (engine.state === 'processing' && engine.turn === turn) {
                const idleMs = Date.now() - (turn.lastActivityAt || turn.startedAt || Date.now());
                console.error('[Chat] Turn inactivity timeout after ' + Math.round(idleMs / 1000) + 's for', convId, '| lastActivitySource=', turn.lastActivitySource || 'unknown');
                failTurnAndRecycleEngine(
                    engine,
                    convId,
                    conv,
                    'turn_inactivity_timeout',
                    'Request timed out due to inactivity. The model or tool execution stopped producing events. Please try again.',
                    { idleMs }
                );
            }
        }, TURN_INACTIVITY_TIMEOUT_MS);
    }
    async function awaitEngineReady(engine, convId) {
        if (!engine || engine.ready) return;
        console.log('[EnginePool] Waiting for engine init', '| conv=', convId, '| pid=', engine.child && engine.child.pid);
        await Promise.race([
            engine.readyPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Engine init timeout')), 15000))
        ]);
        console.log('[EnginePool] Engine ready', '| conv=', convId, '| pid=', engine.child && engine.child.pid);
    }

    function spawnPersistentEngine(convId, conv, config) {
        const { modelId, thinkingEnabled = false, apiKey, baseUrl, apiFormat, sysPrompt } = config;
        evictOldestEngine();
        const claudeDir = path.join(os.homedir(), '.claude');
        const cliArgs = ['--preload', enginePreload, '--env-file=' + engineEnv, engineCli, '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', 'bypassPermissions', '--permission-prompt-tool', 'stdio', '--add-dir', claudeDir, '--model', modelId];
        cliArgs.push('--thinking', config.thinkingEnabled ? 'enabled' : 'disabled');
        if (conv.claude_session_id) {
            cliArgs.push('--resume', conv.claude_session_id);
            // If a delete/edit/regenerate queued a rewind point, slice the resumed
            // session to that message uuid (engine loads JSONL, then truncates in
            // memory to [0..uuid] inclusive — see cli/print.ts:5106).
            if (conv.pendingResumeAt) {
                cliArgs.push('--resume-session-at', conv.pendingResumeAt);
                console.log('[EnginePool] Rewinding session ' + conv.claude_session_id + ' to message ' + conv.pendingResumeAt);
            }
        }
        // Consume the rewind marker — only applies once per spawn. Subsequent normal
        // turns must NOT pass --resume-session-at, or the engine would keep slicing
        // off everything new.
        if (conv.pendingResumeAt) {
            conv.pendingResumeAt = null;
            saveDb();
        }
        if (sysPrompt) cliArgs.push('--append-system-prompt', sysPrompt);
        const envVars = Object.assign({}, process.env);
        if (gitBashPath && !envVars.CLAUDE_CODE_GIT_BASH_PATH) {
            envVars.CLAUDE_CODE_GIT_BASH_PATH = gitBashPath;
        }
        // Raise Read tool's per-file token cap so users can ingest larger files from github/workspace
        // without repeated failed reads. Default in engine is 25000.
        if (!envVars.CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS) {
            envVars.CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS = '80000';
        }
        if (apiFormat === 'openai' && proxyPort > 0) {
            proxyTarget = { apiKey, baseUrl, model: modelId, format: 'openai', conversationId: convId, supportsWebSearch: config.supportsWebSearch === true, webSearchStrategy: config.webSearchStrategy || null };
            envVars.ANTHROPIC_API_KEY = 'proxy-key'; envVars.ANTHROPIC_BASE_URL = 'http://127.0.0.1:' + proxyPort + '/v1';
            try { const warmUrl = new URL(normalizeBaseUrl(baseUrl)); require('dns').resolve4(warmUrl.hostname, () => {}); fetch(warmUrl.origin, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => {}); } catch (_) {}
            console.log('[EnginePool] OpenAI proxy, model=' + modelId, '| thinking=' + thinkingEnabled);
        } else { if (apiKey) envVars.ANTHROPIC_API_KEY = apiKey; envVars.ANTHROPIC_BASE_URL = normalizeBaseUrl(baseUrl || engineEnvVars.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'); }
        console.log('[EnginePool] Spawning persistent engine, conv=' + convId + ' model=' + modelId + ' thinking=' + thinkingEnabled + ' session=' + (conv.claude_session_id || 'new'));
        const { spawn } = require('child_process');
        const child = spawn(bunExePath, cliArgs, { cwd: conv.workspace_path, env: envVars, stdio: ['pipe', 'pipe', 'pipe'] });
        let resolveReady;
        const readyPromise = new Promise((resolve) => { resolveReady = resolve; });
        const engine = { child, convId, modelId, thinkingEnabled, apiKey, baseUrl, apiFormat, lastUsed: Date.now(), sessionId: conv.claude_session_id, state: 'idle', buf: '', turn: null, needsRestart: false, ready: false, readyPromise, resolveReady };
        activeChildren.set(convId, child);

        const handleEngineStdoutLine = (line) => {
            if (!line || !line.trim()) return;
            let evt;
            try {
                evt = JSON.parse(line);
            } catch {
                if (engine.state === 'processing') console.warn('[EnginePool] Non-JSON stdout while processing conv=' + convId + ':', line.slice(0, 300));
                return;
            }
            if (evt.session_id && !engine.sessionId) { engine.sessionId = evt.session_id; conv.claude_session_id = engine.sessionId; saveDb(); }
            if (engine.turn) refreshTurnActivityTimeout(engine, convId, conv, 'stdout:' + evt.type + (evt.subtype ? ':' + evt.subtype : ''));
            if (evt.type !== 'stream_event') console.log('[Engine-evt]', evt.type, evt.subtype || '', evt.tool_use_id ? 'tool_id=' + evt.tool_use_id : '');
            if (evt.type === 'system' && evt.subtype === 'init') {
                engine.ready = true;
                if (engine.resolveReady) { try { engine.resolveReady(); } catch (_) {} engine.resolveReady = null; }
                console.log('[EnginePool] Engine init event for', convId);
                return;
            }
            if (evt.type === 'result') {
                if (engine.turn) {
                    if (!engine.turn.assistantText && evt.result) {
                        engine.turn.assistantText = typeof evt.result === 'string' ? evt.result : '';
                    }
                    if (!engine.turn.assistantText && !engine.turn.thinkingText && engine.turn.toolCalls.size === 0) {
                        try {
                            engine.turn.sendSSE({
                                type: 'error',
                                error: 'Model returned no content. Please check the selected model and provider configuration.',
                            });
                        } catch (_) {}
                    }
                    finishTurn(engine, convId, conv);
                }
                return;
            }
            if (!engine.turn) return;
            handleTurnEvent(engine, convId, conv, evt);
        };
        child.stdout.on('data', (chunk) => {
            engine.buf += chunk.toString('utf8');
            const lines = engine.buf.split('\n'); engine.buf = lines.pop() || '';
            for (const line of lines) handleEngineStdoutLine(line);
        });
        let stderrBuf = '';
        child.stderr.on('data', (c) => { stderrBuf += c.toString('utf8'); });
        child.on('close', (code) => {
            if (engine.buf && engine.buf.trim()) {
                handleEngineStdoutLine(engine.buf);
                engine.buf = '';
            }
            if (!engine.ready && engine.resolveReady) { try { engine.resolveReady(); } catch (_) {} engine.resolveReady = null; }
            console.log('[EnginePool] Engine closed, code=' + code + ', conv=' + convId, stderrBuf ? '| stderr: ' + stderrBuf.slice(0, 300) : '');
            if (engine.state === 'processing' && engine.turn) {
                const turn = engine.turn;
                if (turn.sendSSE) {
                    if (!turn.assistantText) turn.sendSSE({ type: 'error', error: stderrBuf.slice(0, 300) || 'Engine exit ' + code });
                    else {
                        const warningText = '\n\n[Engine exited unexpectedly.]';
                        turn.assistantText += warningText;
                        turn.sendSSE({ type: 'content_block_delta', delta: { type: 'text_delta', text: warningText } });
                    }
                }
                finishTurn(engine, convId, conv);
            }
            enginePool.delete(convId); activeChildren.delete(convId);
        });
        child.on('error', (err) => {
            console.error('[EnginePool] Error:', err.message);
            if (!engine.ready && engine.resolveReady) { try { engine.resolveReady(); } catch (_) {} engine.resolveReady = null; }
            if (engine.state === 'processing' && engine.turn) {
                if (engine.turn.sendSSE) engine.turn.sendSSE({ type: 'error', error: err.message || 'Engine error' });
                finishTurn(engine, convId, conv);
            }
            enginePool.delete(convId); activeChildren.delete(convId);
        });
        child.on('spawn', () => {
            console.log('[EnginePool] Child spawned', '| conv=', convId, '| pid=', child.pid, '| model=', modelId);
        });
        enginePool.set(convId, engine);
        return engine;
    }

    // Pre-warm endpoint
    server.post('/api/conversations/:id/warm', (req, res) => {
        const convId = req.params.id;
        const existing = enginePool.get(convId);
        console.log('[Warm] Request for', convId, '| existing=', summarizeEngine(existing), '| pool=', summarizeEnginePool());
        if (existing && isEngineAlive(existing) && !existing.needsRestart) { existing.lastUsed = Date.now(); return res.json({ ok: true, cached: true, state: existing.state }); }
        if (existing && existing.needsRestart) killEngine(convId, 'warm_existing_engine_marked_needs_restart');
        const conv = db.conversations.find(c => c.id === convId);
        if (!conv) return res.status(404).json({ error: 'Not found' });
        const { env_token, env_base_url, user_mode, user_profile } = req.body || {};
        let config;
        try {
            config = resolveChatConfig(conv, user_mode, env_token, env_base_url);
        } catch (err) {
            return res.status(400).json({ error: err.message || 'Invalid chat config' });
        }
        const sysPrompt = buildChatSystemPrompt(conv, user_mode, user_profile);
        console.log('[EnginePool] Pre-warming engine for', convId, 'model=' + config.modelId, 'thinking=' + config.thinkingEnabled);
        spawnPersistentEngine(convId, conv, { ...config, sysPrompt });
        res.json({ ok: true });
    });

    // Chat endpoint (persistent engine)
    server.post('/api/chat', async (req, res) => {
        const { conversation_id, message, attachments, env_token, env_base_url, user_mode, user_profile } = req.body;
        const conv = db.conversations.find(c => c.id === conversation_id);
        if (!conv) return res.status(404).json({ error: 'Conversation not found' });
        console.log('[Chat] Incoming request',
            '| conv=', conversation_id,
            '| msgLen=', (message || '').length,
            '| attachments=', Array.isArray(attachments) ? attachments.length : 0,
            '| user_mode=', user_mode,
            '| model=', conv.model,
            '| pool=', summarizeEnginePool());
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        activeStreams.set(conversation_id, { events: [], listeners: new Set(), done: false, primaryRes: res });
        const sendSSE = (data) => { var stream = activeStreams.get(conversation_id); if (stream) { stream.events.push(data); var line = 'data: ' + JSON.stringify(data) + '\n\n'; var arr = Array.from(stream.listeners); for (var i = 0; i < arr.length; i++) { try { arr[i].write(line); } catch (_) { stream.listeners.delete(arr[i]); } } } try { res.write('data: ' + JSON.stringify(data) + '\n\n'); } catch (_) {} };

        try {
            // /skill-name is passed as-is to the engine 鈥?the engine handles
            // slash commands internally (injects SKILL.md content into context).
            // Send a synthetic tool event so the frontend shows "Reading SKILL.md"
            const skillInvokeMatch = message.match(/^\/([a-zA-Z0-9_-]+)(\s|$)/);
            if (skillInvokeMatch) {
                const skillSlug = skillInvokeMatch[1];
                const fakeId = 'skill-invoke-' + Date.now();
                sendSSE({ type: 'tool_use_start', tool_use_id: fakeId, tool_name: 'Skill', tool_input: { skill: skillSlug } });
                sendSSE({ type: 'tool_use_done', tool_use_id: fakeId, content: `Reading ${skillSlug} SKILL.md`, is_error: false });
            }

            // 鈹€鈹€ 1. Handle attachments: copy to workspace, append references to prompt 鈹€鈹€
            let finalPrompt = message;
            const imageFileNames = []; // image files copied to workspace

            // 鈹€鈹€ 1a. GitHub content index: inject if .github-context.json exists 鈹€鈹€
            try {
                const ghMetaPath = path.join(conv.workspace_path, '.github-context.json');
                if (fs.existsSync(ghMetaPath)) {
                    const ghMeta = JSON.parse(fs.readFileSync(ghMetaPath, 'utf8'));
                    if (ghMeta && Array.isArray(ghMeta.repos) && ghMeta.repos.length > 0) {
                        let ghBlock = '\n\n[GitHub content available in this workspace:]\n';
                        for (const r of ghMeta.repos) {
                            if (!r || !r.repo) continue;
                            ghBlock += `\nRepository: ${r.repo} (branch: ${r.ref || 'main'}) — located at ${r.rootDir}/\n`;
                            const files = Array.isArray(r.files) ? r.files : [];
                            if (files.length > 0) {
                                const MAX_LIST = 80;
                                ghBlock += `Files (${files.length} total):\n`;
                                const shown = files.slice(0, MAX_LIST);
                                for (const f of shown) {
                                    if (f && f.path) ghBlock += `- ${r.rootDir}/${f.path}\n`;
                                }
                                if (files.length > MAX_LIST) {
                                    ghBlock += `- ... and ${files.length - MAX_LIST} more (use Glob to list all)\n`;
                                }
                            }
                        }
                        ghBlock += '\nUse Glob / Grep / FileRead / Bash to explore these files as needed. Binary files (images, PDFs, archives) are preserved as-is on disk.\n';
                        finalPrompt += ghBlock;
                    }
                }
            } catch (e) {
                console.warn('[Chat] GitHub context inject failed:', e.message);
            }

            if (attachments && attachments.length > 0) {
                const copiedFiles = [];
                for (const att of attachments) {
                    // Skip virtual github attachments — they're not real uploaded files,
                    // the content is already materialized in workspace/github/ and injected via .github-context.json
                    if (att && (att.source === 'github' || att.fileType === 'github')) continue;
                    let srcPath = att.localPath;
                    if (!srcPath && att.fileId) {
                        for (const dir of [path.join(workspacesDir, conversation_id, '.uploads'), path.join(workspacesDir, 'temp', '.uploads')]) {
                            if (srcPath) break;
                            if (fs.existsSync(dir)) {
                                const match = fs.readdirSync(dir).find(f => f === att.fileId || f.includes(att.fileId));
                                if (match) srcPath = path.join(dir, match);
                            }
                        }
                    }
                    if (srcPath && fs.existsSync(srcPath)) {
                        const fn = att.fileName || path.basename(srcPath);
                        try { fs.copyFileSync(srcPath, path.join(conv.workspace_path, fn)); copiedFiles.push(fn); } catch (_) {}

                        // Detect images 鈫?read base64 for proxy injection
                        const ext = path.extname(fn).toLowerCase();
                        if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
                            console.log('[Chat] Image copied to workspace:', fn);
                            imageFileNames.push(fn);
                            try {
                                const imgData = fs.readFileSync(srcPath);
                                if (imgData.length > 100) {
                                    const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };
                                    if (!pendingImageBlocks.has(conversation_id)) pendingImageBlocks.set(conversation_id, []);
                                    pendingImageBlocks.get(conversation_id).push({
                                        type: 'image',
                                        source: { type: 'base64', media_type: mimeMap[ext] || 'image/png', data: imgData.toString('base64') }
                                    });
                                    console.log('[Chat] Image queued for proxy injection:', fn, imgData.length, 'bytes');
                                }
                            } catch (_) {}
                        }
                    }
                }
                if (copiedFiles.length > 0) {
                    // Images are injected directly into the API request via the proxy,
                    // but we also mention them here so the model knows they exist as files.
                    if (imageFileNames.length > 0) {
                        finalPrompt += '\n\n[The user attached image(s): ' + imageFileNames.join(', ') + '. The image(s) are included in this message 鈥?you can see them directly.]';
                        const nonImages = copiedFiles.filter(f => !imageFileNames.includes(f));
                        if (nonImages.length > 0) {
                            finalPrompt += '\n[Other attached files 鈥?read only when needed:]\n';
                            for (const fn of nonImages) finalPrompt += `- ./${fn}\n`;
                        }
                    } else {
                        finalPrompt += '\n\n[Attached files in workspace 鈥?read only when needed:]\n';
                        for (const fn of copiedFiles) finalPrompt += `- ./${fn}\n`;
                    }
                }
            }

            // 鈹€鈹€ 2. Save user message 鈹€鈹€
            // Generate the uuid here so we can pass the SAME uuid to engine stdin
            // below — that way db.messages.id matches the engine session JSONL uuid,
            // which is required for `--resume-session-at` to find this message later.
            // The `engineUuidSynced: true` flag marks this row as safe to rewind to;
            // pre-fix rows lack the flag and the delete handler falls back to a
            // clean-session reset for them.
            const userMsgUuid = uuidv4();
            db.messages.push({
                id: userMsgUuid, conversation_id, role: 'user',
                content: JSON.stringify([{ type: 'text', text: message }]),
                created_at: new Date().toISOString(),
                model: conv.model,
                engineUuidSynced: true,
                attachments: attachments && attachments.length > 0 ? attachments.map(a => ({ fileId: a.fileId, fileName: a.fileName, fileType: a.fileType, mimeType: a.mimeType, size: a.size, source: a.source, gh_repo: a.ghRepo, gh_ref: a.ghRef })) : undefined
            });
            saveDb();

            // 鈹€鈹€ 2.5. Research mode routing 鈹€鈹€
            // If conversation has research_mode enabled and the message looks like
            // a research-worthy question, divert to the research orchestrator and
            // bypass the engine entirely. Short messages, slash commands, and
            // greetings still go through the normal chat path.
            if (conv.research_mode && shouldRunResearch(message)) {
                const config = resolveChatConfig(conv, user_mode, env_token, env_base_url);
                console.log('[Research] Routing to orchestrator',
                    '| conv=', conversation_id,
                    '| model=', config.modelId,
                    '| msgLen=', (message || '').length);
                try {
                    const result = await runResearchPipeline({
                        query: message,
                        apiKey: config.apiKey,
                        baseUrl: config.baseUrl,
                        model: config.modelId,
                        sendSSE,
                    });
                    // Save assistant message with the final report and research metadata
                    db.messages.push({
                        id: uuidv4(),
                        conversation_id,
                        role: 'assistant',
                        content: JSON.stringify([{ type: 'text', text: result.report }]),
                        created_at: new Date().toISOString(),
                        model: conv.model,
                        research: {
                            plan: result.plan,
                            sub_results: result.sub_results.map(r => ({
                                sub_question: r.sub_question,
                                findings: r.findings,
                                sources: r.sources,
                            })),
                            sources: result.sources,
                        },
                    });
                    saveDb();
                    sendSSE({ type: 'message_stop' });
                } catch (err) {
                    console.error('[Research] Pipeline error:', err);
                    const userMsg = err.message && err.message.includes('invalid JSON')
                        ? 'Research planning failed — the planner output was malformed. Please try again.'
                        : (err.message || 'Research pipeline failed');
                    sendSSE({ type: 'error', error: userMsg });
                    sendSSE({ type: 'message_stop' });
                }
                try { res.end(); } catch (_) {}
                const stream = activeStreams.get(conversation_id);
                if (stream) { stream.done = true; }
                return;
            }

            // 鈹€鈹€ 3. Get or create persistent engine 鈹€鈹€
            const config = resolveChatConfig(conv, user_mode, env_token, env_base_url);
            let engine = enginePool.get(conversation_id);
            console.log('[Chat] Engine lookup for', conversation_id, '| existing=', summarizeEngine(engine), '| requestedModel=', config.modelId);
            // Engine reuse: must match on every dimension that's baked into the spawn
            // env at startup. modelId / apiKey / baseUrl / apiFormat are all hardcoded
            // into the child process's environment vars and CANNOT be changed without
            // a respawn. If the user switches user_mode (clawparrot ↔ selfhosted) or
            // changes provider config, the resolved config differs from the running
            // engine — kill it so the next spawn uses the new endpoint/credentials.
            const apiKeyChanged = !!engine && engine.apiKey !== config.apiKey;
            const baseUrlChanged = !!engine && engine.baseUrl !== config.baseUrl;
            const apiFormatChanged = !!engine && engine.apiFormat !== config.apiFormat;
            const thinkingChanged = !!engine && !!engine.thinkingEnabled !== !!config.thinkingEnabled;
            if (engine && (!isEngineAlive(engine) || engine.modelId !== config.modelId || thinkingChanged || engine.needsRestart || apiKeyChanged || baseUrlChanged || apiFormatChanged)) {
                killEngine(conversation_id, 'chat_existing_engine_invalid_or_stale', {
                    isAlive: !!isEngineAlive(engine),
                    currentModel: engine && engine.modelId,
                    requestedModel: config.modelId,
                    currentThinkingEnabled: !!(engine && engine.thinkingEnabled),
                    requestedThinkingEnabled: !!config.thinkingEnabled,
                    thinkingChanged,
                    needsRestart: !!(engine && engine.needsRestart),
                    apiKeyChanged,
                    baseUrlChanged,
                    apiFormatChanged,
                });
                engine = null;
            }
            if (!engine) {
                const sysPrompt = buildChatSystemPrompt(conv, user_mode, user_profile);
                engine = spawnPersistentEngine(conversation_id, conv, { ...config, sysPrompt });
            }
            if (!isEngineAlive(engine)) throw new Error('Engine failed to start');
            if (engine.state === 'processing') {
                // Wait briefly in case the previous turn is about to finish
                await new Promise(r => setTimeout(r, 1000));
                if (engine.state === 'processing') {
                    // Previous turn is stuck 鈥?kill the engine and spawn a fresh one
                    console.warn('[Chat] Engine stuck in processing state for', conversation_id, '鈥?killing and respawning');
                    killEngine(conversation_id, 'chat_previous_turn_stuck_processing', { existing: summarizeEngine(engine) });
                    engine = null;
                    const sysPrompt = buildChatSystemPrompt(conv, user_mode, user_profile);
                    engine = spawnPersistentEngine(conversation_id, conv, { ...config, sysPrompt });
                    if (!isEngineAlive(engine)) throw new Error('Engine failed to restart');
                }
            }

            // 鈹€鈹€ 4. Start new turn 鈹€鈹€
            engine.state = 'processing';
            engine.lastUsed = Date.now();
            console.log('[Chat] Turn starting', '| conv=', conversation_id, '| engine=', summarizeEngine(engine), '| promptLen=', finalPrompt.length);
            if (config.apiFormat === 'openai' && proxyPort > 0) {
                proxyTarget = { apiKey: config.apiKey, baseUrl: config.baseUrl, model: config.modelId, format: 'openai', conversationId: conversation_id, supportsWebSearch: config.supportsWebSearch === true, webSearchStrategy: config.webSearchStrategy || null };
            }
            engine.turn = {
                sendSSE, assistantText: '', thinkingText: '',
                toolCalls: new Map(), toolCallOrder: [], sentToolStarts: new Set(),
                writtenFiles: new Map(), searchLogs: [],
                lastToolDoneTextLen: 0, pendingWorkText: '',
                message: message,
                apiKey: config.apiKey, baseUrl: config.baseUrl, apiFormat: config.apiFormat,
                resolve: null,
                startedAt: Date.now(),
                lastActivityAt: Date.now(),
                lastActivitySource: 'turn_start',
            };

            // Write user message to stdin (stream-json format).
            // Reuse the same uuid as db.messages.id so the engine session uuid lines
            // up with our row — required for context rewind via --resume-session-at.
            engine.child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: finalPrompt }, uuid: userMsgUuid }) + '\n');

            // Wait for turn to complete. Use an inactivity timeout so long-running
            // tasks can continue while they are still producing progress events.
            // Keep a separate hard cap as a final safety valve.
            const TURN_MAX_TIMEOUT_MS = 30 * 60 * 1000;
            // Send periodic heartbeat to keep SSE connection alive during long waits
            const heartbeatId = setInterval(() => {
                if (engine.state === 'processing') {
                    try { sendSSE({ type: 'heartbeat' }); } catch (_) {}
                }
            }, 15000);
            await new Promise(resolve => {
                engine.turn.resolve = resolve;
                refreshTurnActivityTimeout(engine, conversation_id, conv, 'turn_start');
                engine.turn.maxTimeoutId = setTimeout(() => {
                    if (engine.state === 'processing' && engine.turn) {
                        console.error('[Chat] Turn hard timeout after ' + (TURN_MAX_TIMEOUT_MS / 1000) + 's for', conversation_id);
                        failTurnAndRecycleEngine(
                            engine,
                            conversation_id,
                            conv,
                            'turn_hard_timeout',
                            'Request exceeded the maximum runtime. Please try again.',
                            { maxRuntimeMs: TURN_MAX_TIMEOUT_MS }
                        );
                    }
                }, TURN_MAX_TIMEOUT_MS);
            });
            clearInterval(heartbeatId);
            if (engine.turn && engine.turn.timeoutId) clearTimeout(engine.turn.timeoutId);
            if (engine.turn && engine.turn.maxTimeoutId) clearTimeout(engine.turn.maxTimeoutId);
                    } catch (err) {
            pendingImageBlocks.delete(conversation_id);
            console.error('[Chat] Error:', (err.message || '').slice(0, 300));
            sendSSE({ type: 'error', error: err.message || 'Engine error' });
            endStream(conversation_id);
        }
    });


    return server;
}

module.exports = { initServer, enableNodeModeForChildProcesses };
