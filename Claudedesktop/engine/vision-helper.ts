/**
 * Vision API helper — called by bridge-server via Bun subprocess
 * Usage: bun vision-helper.ts <json-file-path>
 * Input JSON: { endpoint, apiKey, body, format? }
 * Output: SSE lines to stdout
 * Supports both Anthropic and OpenAI API formats
 */
const args = process.argv.slice(2);
const inputPath = args[0];
if (!inputPath) { console.error('Usage: bun vision-helper.ts <json-path>'); process.exit(1); }

const fs = await import('fs');
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const isOpenAI = input.format === 'openai';

try {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (isOpenAI) {
        headers['authorization'] = `Bearer ${input.apiKey}`;
    } else {
        headers['x-api-key'] = input.apiKey;
        headers['anthropic-version'] = '2023-06-01';
    }

    const response = await fetch(input.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(input.body),
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.log(JSON.stringify({ type: 'error', error: `API Error ${response.status}: ${errText.slice(0, 300)}` }));
        process.exit(1);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;

            if (isOpenAI) {
                // Convert OpenAI SSE format to Anthropic format for bridge-server
                try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;
                    if (delta?.content) {
                        console.log(JSON.stringify({
                            type: 'content_block_delta',
                            delta: { type: 'text_delta', text: delta.content }
                        }));
                    }
                    // Handle reasoning/thinking content if present
                    if (delta?.reasoning_content) {
                        console.log(JSON.stringify({
                            type: 'content_block_delta',
                            delta: { type: 'thinking_delta', thinking: delta.reasoning_content }
                        }));
                    }
                } catch { /* skip unparseable lines */ }
            } else {
                // Forward raw Anthropic SSE event as JSON line
                console.log(data);
            }
        }
    }
    console.log(JSON.stringify({ type: 'done' }));
} catch (err: any) {
    console.log(JSON.stringify({ type: 'error', error: err.message || 'fetch failed' }));
    process.exit(1);
}
