// Research Orchestrator — Phase 1 (plan → gather → write)
//
// Architecture:
//   1. Lead Planner   — Claude call that decomposes the query into N sub-questions
//   2. Sub-Researchers — N parallel Claude calls, each with server-side web_search
//                        beta tool, producing markdown findings + sources
//   3. Synthesis      — Final Claude call (streaming) that writes the long-form
//                        report from all collected findings, with inline citations
//
// Inspired by gpt-researcher (single-agent flow) but native to Anthropic's
// messages API with server-side web_search_20250305 beta tool. No Python,
// no LangChain, no external search API — everything runs through Anthropic.
//
// SSE events emitted to frontend:
//   research_phase         { phase: 'planning'|'gathering'|'writing', label }
//   research_plan          { sub_questions: string[], title?: string }
//   research_subagent_started  { sub_agent_id, sub_question }
//   research_source        { sub_agent_id, source: { url, title, snippet?, favicon? } }
//   research_finding       { sub_agent_id, markdown }
//   research_subagent_done { sub_agent_id, sources_count }
//   research_report_delta  { text }               // streaming chunks of final report
//   research_report        { markdown }           // full final report
//   research_done          { sources_count, duration_ms }

const MAX_SUB_QUESTIONS = 5;
const MAX_WEB_SEARCHES_PER_SUBAGENT = 8;
const SUB_RESEARCHER_MAX_TOKENS = 8192;
const SYNTHESIS_MAX_TOKENS = 32768;

// ---------- Prompts (adapted from gpt-researcher reference) ----------

const PLANNING_SYSTEM_PROMPT = `You are a research planner. Your job is to decompose a user's research question into a structured research plan.

Given a research question, you must:
1. Identify the core subject and scope
2. Break it into 3-${MAX_SUB_QUESTIONS} focused, non-overlapping sub-questions that together cover the full scope
3. Each sub-question should be specific enough to be answerable by 3-5 high-quality web sources
4. Order sub-questions logically (foundational context first, specifics later)
5. Generate a concise title for the final research report

IMPORTANT:
- Keep each sub-question to ONE concise sentence (max 30 words)
- The title must be under 15 words
- Use English for JSON keys and structure; sub-question text should match the language of the user's query

Respond in strict JSON with this shape:
{
  "title": "string",
  "sub_questions": ["string", "string", ...]
}

Do NOT include markdown code fences. Output only the raw JSON object.`;

function buildPlanningUserPrompt(query) {
    return `Research question: "${query}"

Today's date: ${new Date().toISOString().slice(0, 10)}

Produce the research plan now.`;
}

const SUB_RESEARCHER_SYSTEM_PROMPT = `You are a research specialist. You will be given ONE specific sub-question as part of a larger research project. Your job:

1. Use the web_search tool aggressively to find 3-8 high-quality, recent, authoritative sources
2. Prefer primary sources, academic papers, official documentation, and reputable publications
3. After gathering sources, write a detailed markdown-formatted findings report on this sub-question ONLY
4. Include inline markdown hyperlinks to each source you cite: ([source name](url))
5. Use markdown tables for structured data or comparisons
6. Be precise with facts, numbers, dates, and technical details
7. Do NOT write an introduction or conclusion — just the findings body
8. Aim for 500-1500 words of dense, well-cited content

IMPORTANT:
- Stay strictly focused on your assigned sub-question
- If sources disagree, note the disagreement and cite both
- Prefer quantitative data when available
- Do not speculate beyond what the sources say`;

function buildSubResearcherUserPrompt(mainQuery, subQuestion) {
    return `Main research topic: "${mainQuery}"

YOUR ASSIGNED SUB-QUESTION: "${subQuestion}"

Today's date: ${new Date().toISOString().slice(0, 10)}

Research this sub-question now. Use web_search to find high-quality sources, then write your markdown findings report. Cite every factual claim with an inline markdown link.`;
}

const SYNTHESIS_SYSTEM_PROMPT = `You are a senior research writer. You will receive:
1. The original research question
2. A collection of findings from multiple sub-researchers, each covering a different sub-question
3. The list of all sources gathered

Your job is to synthesize these findings into a single, comprehensive, long-form research report. Requirements:

1. Write a clear H1 title
2. Open with an executive summary (2-3 paragraphs) stating the main conclusions
3. Organize the body into logical ## sections (not necessarily mirroring the sub-questions — reorganize as needed for coherence)
4. Use ### sub-sections where helpful
5. Use markdown tables for any structured comparisons or data
6. Include inline citations as markdown hyperlinks: ([source name](url))
7. Every non-trivial factual claim MUST have an inline citation
8. End with a ## Conclusion section summarizing key takeaways and open questions
9. End with a ## References section listing all cited sources as a numbered markdown list with hyperlinks

Style:
- Objective, analytical tone
- Precise with numbers, dates, and technical terminology
- Acknowledge uncertainty and disagreements between sources
- Do not speculate beyond what the findings support
- Target 2000-4000 words for a substantive report
- Prefer prose over bullet lists for the main body

Do NOT wrap the output in markdown code fences. Output the report directly as markdown.`;

function buildSynthesisUserPrompt(query, findingsBlocks, allSources) {
    const sourcesList = allSources
        .map((s, i) => `[${i + 1}] ${s.title || 'Untitled'} — ${s.url}`)
        .join('\n');
    const findingsText = findingsBlocks
        .map((f, i) => `### Sub-research ${i + 1}: ${f.sub_question}\n\n${f.markdown}`)
        .join('\n\n---\n\n');
    return `Original research question: "${query}"

Today's date: ${new Date().toISOString().slice(0, 10)}

## All Sources Gathered (${allSources.length} total)
${sourcesList}

## Findings from Sub-Researchers

${findingsText}

---

Now synthesize all of the above into a comprehensive research report following the structure and style described in the system prompt.`;
}

// ---------- Helpers ----------

function normalizeBaseUrl(u) {
    if (!u) return 'https://api.anthropic.com';
    return u.replace(/\/+$/, '');
}

function normalizeApiFormatEndpoint(baseUrl) {
    const base = normalizeBaseUrl(baseUrl);
    if (base.endsWith('/v1')) return base + '/messages';
    return base + '/v1/messages';
}

async function callAnthropic({ apiKey, baseUrl, body }) {
    const endpoint = normalizeApiFormatEndpoint(baseUrl);
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'web-search-2025-03-05',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 500)}`);
    }
    return res.json();
}

async function callAnthropicStreaming({ apiKey, baseUrl, body, onDelta, onEvent }) {
    const endpoint = normalizeApiFormatEndpoint(baseUrl);
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-beta': 'web-search-2025-03-05',
            'accept': 'text/event-stream',
        },
        body: JSON.stringify({ ...body, stream: true }),
    });
    if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Anthropic API error ${res.status}: ${errText.slice(0, 500)}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let fullText = '';
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            let evt;
            try { evt = JSON.parse(payload); } catch (_) { continue; }
            if (onEvent) onEvent(evt);
            if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta' && evt.delta.text) {
                fullText += evt.delta.text;
                if (onDelta) onDelta(evt.delta.text);
            }
        }
    }
    return fullText;
}

// Extract sources (web_search results) and assistant text from a non-streaming
// Anthropic response that used the web_search beta tool.
function extractSubAgentResult(response) {
    const sources = [];
    const seenUrls = new Set();
    let text = '';
    if (!response || !Array.isArray(response.content)) return { text, sources };
    for (const block of response.content) {
        if (block.type === 'text' && typeof block.text === 'string') {
            text += block.text;
        } else if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
            for (const item of block.content) {
                if (item.type === 'web_search_result' && item.url && !seenUrls.has(item.url)) {
                    seenUrls.add(item.url);
                    sources.push({
                        url: item.url,
                        title: item.title || item.url,
                        snippet: item.page_age ? `Last updated: ${item.page_age}` : '',
                    });
                }
            }
        }
    }
    return { text, sources };
}

// ---------- Phase 1: Planning ----------

async function runPlanner({ query, apiKey, baseUrl, model }) {
    const body = {
        model,
        max_tokens: 4096,
        system: PLANNING_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildPlanningUserPrompt(query) }],
    };
    const response = await callAnthropic({ apiKey, baseUrl, body });
    if (response.stop_reason === 'max_tokens') {
        console.warn('[Research] Planner hit max_tokens — output was truncated');
    }
    const textBlock = (response.content || []).find(b => b.type === 'text');
    if (!textBlock) throw new Error('Planner returned no text content');
    let parsed;
    try {
        let cleaned = textBlock.text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
        // If JSON was truncated, attempt to repair by closing open arrays/objects
        if (response.stop_reason === 'max_tokens') {
            cleaned = repairTruncatedPlanJSON(cleaned);
        }
        parsed = JSON.parse(cleaned);
    } catch (err) {
        throw new Error(`Planner returned invalid JSON: ${err.message}\nRaw: ${textBlock.text.slice(0, 300)}`);
    }
    if (!Array.isArray(parsed.sub_questions) || parsed.sub_questions.length === 0) {
        throw new Error('Planner returned no sub_questions');
    }
    return {
        title: parsed.title || query,
        sub_questions: parsed.sub_questions.slice(0, MAX_SUB_QUESTIONS),
    };
}

// Attempt to recover a truncated planner JSON like {"title":"...","sub_questions":["q1","q2","q3 trunc
function repairTruncatedPlanJSON(raw) {
    // Already valid?
    try { JSON.parse(raw); return raw; } catch (_) {}

    // Find the last complete string in the sub_questions array
    const sqIdx = raw.indexOf('"sub_questions"');
    if (sqIdx === -1) throw new Error('No sub_questions key found');
    const bracketIdx = raw.indexOf('[', sqIdx);
    if (bracketIdx === -1) throw new Error('No array start found');

    // Walk through and collect complete quoted strings
    let pos = bracketIdx + 1;
    const questions = [];
    while (pos < raw.length) {
        // Skip whitespace and commas
        while (pos < raw.length && /[\s,]/.test(raw[pos])) pos++;
        if (pos >= raw.length || raw[pos] === ']') break;
        if (raw[pos] !== '"') break;
        // Find end of this string (handle escaped quotes)
        let end = pos + 1;
        while (end < raw.length) {
            if (raw[end] === '\\') { end += 2; continue; }
            if (raw[end] === '"') break;
            end++;
        }
        if (end >= raw.length) break; // string was truncated — skip it
        questions.push(raw.slice(pos + 1, end));
        pos = end + 1;
    }

    if (questions.length === 0) throw new Error('No complete sub_questions found in truncated output');

    // Extract title
    const titleMatch = raw.match(/"title"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const title = titleMatch ? titleMatch[1] : '';

    return JSON.stringify({ title, sub_questions: questions });
}

// ---------- Phase 2: Sub-researchers ----------

async function runSubResearcher({ mainQuery, subQuestion, apiKey, baseUrl, model }) {
    const body = {
        model,
        max_tokens: SUB_RESEARCHER_MAX_TOKENS,
        system: SUB_RESEARCHER_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildSubResearcherUserPrompt(mainQuery, subQuestion) }],
        tools: [
            {
                type: 'web_search_20250305',
                name: 'web_search',
                max_uses: MAX_WEB_SEARCHES_PER_SUBAGENT,
            },
        ],
    };
    const response = await callAnthropic({ apiKey, baseUrl, body });
    const { text, sources } = extractSubAgentResult(response);
    return { findings: text, sources };
}

// ---------- Phase 3: Synthesis (streaming) ----------

async function runSynthesis({
    query,
    findingsBlocks,
    allSources,
    apiKey,
    baseUrl,
    model,
    onDelta,
}) {
    const body = {
        model,
        max_tokens: SYNTHESIS_MAX_TOKENS,
        system: SYNTHESIS_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildSynthesisUserPrompt(query, findingsBlocks, allSources) }],
    };
    const text = await callAnthropicStreaming({
        apiKey,
        baseUrl,
        body,
        onDelta,
    });
    return text;
}

// ---------- Orchestrator entry point ----------

async function runResearchPipeline({
    query,
    apiKey,
    baseUrl,
    model = 'claude-opus-4-6',
    sendSSE,
}) {
    const startedAt = Date.now();
    const emit = (event) => {
        try { if (sendSSE) sendSSE(event); } catch (_) {}
    };

    try {
        // Phase 1: Planning
        emit({ type: 'research_phase', phase: 'planning', label: 'Planning research...' });
        const plan = await runPlanner({ query, apiKey, baseUrl, model });
        emit({
            type: 'research_plan',
            title: plan.title,
            sub_questions: plan.sub_questions,
        });

        // Phase 2: Parallel sub-researchers
        emit({
            type: 'research_phase',
            phase: 'gathering',
            label: `Researching ${plan.sub_questions.length} sub-topics in parallel...`,
        });

        const subResults = await Promise.all(
            plan.sub_questions.map(async (subQuestion, idx) => {
                const subAgentId = `sub-${idx}`;
                emit({
                    type: 'research_subagent_started',
                    sub_agent_id: subAgentId,
                    index: idx,
                    sub_question: subQuestion,
                });
                try {
                    const result = await runSubResearcher({
                        mainQuery: query,
                        subQuestion,
                        apiKey,
                        baseUrl,
                        model,
                    });
                    // Emit sources as they arrive (we batch here since non-streaming)
                    for (const source of result.sources) {
                        emit({
                            type: 'research_source',
                            sub_agent_id: subAgentId,
                            source,
                        });
                    }
                    emit({
                        type: 'research_finding',
                        sub_agent_id: subAgentId,
                        sub_question: subQuestion,
                        markdown: result.findings,
                    });
                    emit({
                        type: 'research_subagent_done',
                        sub_agent_id: subAgentId,
                        sources_count: result.sources.length,
                    });
                    return { sub_question: subQuestion, ...result };
                } catch (err) {
                    console.error(`[Research] Sub-agent ${subAgentId} failed:`, err.message);
                    emit({
                        type: 'research_subagent_done',
                        sub_agent_id: subAgentId,
                        sources_count: 0,
                        error: err.message,
                    });
                    return { sub_question: subQuestion, findings: '', sources: [] };
                }
            })
        );

        // Aggregate + dedupe sources globally
        const allSourcesMap = new Map();
        for (const r of subResults) {
            for (const s of r.sources) {
                if (!allSourcesMap.has(s.url)) allSourcesMap.set(s.url, s);
            }
        }
        const allSources = Array.from(allSourcesMap.values());

        // Phase 3: Synthesis (streaming the final report)
        emit({
            type: 'research_phase',
            phase: 'writing',
            label: 'Writing final report...',
        });
        const findingsBlocks = subResults
            .filter(r => r.findings && r.findings.trim())
            .map(r => ({ sub_question: r.sub_question, markdown: r.findings }));

        const finalReport = await runSynthesis({
            query,
            findingsBlocks,
            allSources,
            apiKey,
            baseUrl,
            model,
            onDelta: (text) => emit({ type: 'research_report_delta', text }),
        });

        emit({ type: 'research_report', markdown: finalReport });
        emit({
            type: 'research_done',
            sources_count: allSources.length,
            sub_agents_count: plan.sub_questions.length,
            duration_ms: Date.now() - startedAt,
        });

        return {
            plan,
            sub_results: subResults,
            sources: allSources,
            report: finalReport,
        };
    } catch (err) {
        console.error('[Research] Pipeline error:', err);
        emit({
            type: 'research_error',
            error: err.message || 'Research pipeline failed',
        });
        throw err;
    }
}

module.exports = {
    runResearchPipeline,
    // Exported for potential reuse / testing
    runPlanner,
    runSubResearcher,
    runSynthesis,
};
