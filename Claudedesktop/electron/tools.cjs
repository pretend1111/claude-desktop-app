/**
 * tools.cjs — Tool definitions and execution for direct Anthropic API integration
 * Replaces Claude Code SDK's built-in tools with local implementations
 */
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ════════════════════════════════════════════════════════
//  Tool Schemas (sent to Anthropic API as `tools` param)
// ════════════════════════════════════════════════════════

const TOOL_DEFINITIONS = [
    {
        name: 'Read',
        description: 'Read a file from the local filesystem. Returns content with line numbers. Can read text files, code, configs, etc.',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'The absolute or relative path to the file to read' },
                offset: { type: 'number', description: 'Line number to start reading from (1-based). Default: 1' },
                limit: { type: 'number', description: 'Max number of lines to read. Default: 2000' }
            },
            required: ['file_path']
        }
    },
    {
        name: 'Write',
        description: 'Write content to a file. Creates the file (and parent directories) if they don\'t exist. Overwrites if the file exists.',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'The absolute or relative path to the file' },
                content: { type: 'string', description: 'The full content to write' }
            },
            required: ['file_path', 'content']
        }
    },
    {
        name: 'Edit',
        description: 'Make an exact string replacement in a file. The old_string must match exactly (including whitespace and indentation). For renaming across the file use replace_all.',
        input_schema: {
            type: 'object',
            properties: {
                file_path: { type: 'string', description: 'The absolute or relative path to the file' },
                old_string: { type: 'string', description: 'The exact text to find' },
                new_string: { type: 'string', description: 'The replacement text' },
                replace_all: { type: 'boolean', description: 'If true, replace ALL occurrences. Default: false' }
            },
            required: ['file_path', 'old_string', 'new_string']
        }
    },
    {
        name: 'Bash',
        description: 'Execute a shell command and return stdout/stderr. Working directory is the conversation workspace.',
        input_schema: {
            type: 'object',
            properties: {
                command: { type: 'string', description: 'The shell command to execute' },
                timeout: { type: 'number', description: 'Timeout in milliseconds. Default: 120000 (2 min)' }
            },
            required: ['command']
        }
    },
    {
        name: 'Glob',
        description: 'Find files matching a glob pattern. Returns matching file paths sorted by modification time.',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Glob pattern (e.g. "**/*.js", "src/**/*.ts")' },
                path: { type: 'string', description: 'Base directory to search in. Default: workspace root' }
            },
            required: ['pattern']
        }
    },
    {
        name: 'Grep',
        description: 'Search file contents using regex. Returns matching lines with file paths and line numbers.',
        input_schema: {
            type: 'object',
            properties: {
                pattern: { type: 'string', description: 'Regex pattern to search for' },
                path: { type: 'string', description: 'File or directory to search in. Default: workspace root' },
                include: { type: 'string', description: 'Glob to filter files (e.g. "*.js", "*.{ts,tsx}")' },
                context: { type: 'number', description: 'Lines of context before and after each match. Default: 0' }
            },
            required: ['pattern']
        }
    },
    {
        name: 'ListDir',
        description: 'List the contents of a directory. Shows file names, types (file/dir), and sizes.',
        input_schema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Directory path to list' }
            },
            required: ['path']
        }
    }
];

// ════════════════════════════════════════════════════════
//  Tool Execution
// ════════════════════════════════════════════════════════

function resolvePath(filePath, cwd) {
    if (path.isAbsolute(filePath)) return filePath;
    return path.resolve(cwd, filePath);
}

async function executeTool(name, input, cwd) {
    try {
        switch (name) {
            case 'Read': return toolRead(input, cwd);
            case 'Write': return toolWrite(input, cwd);
            case 'Edit': return toolEdit(input, cwd);
            case 'Bash': return await toolBash(input, cwd);
            case 'Glob': return await toolGlob(input, cwd);
            case 'Grep': return await toolGrep(input, cwd);
            case 'ListDir': return toolListDir(input, cwd);
            default: return { content: `Unknown tool: ${name}`, is_error: true };
        }
    } catch (err) {
        return { content: `Error executing ${name}: ${err.message}`, is_error: true };
    }
}

// ── Read ──
function toolRead(input, cwd) {
    const filePath = resolvePath(input.file_path, cwd);
    if (!fs.existsSync(filePath)) {
        return { content: `File not found: ${filePath}`, is_error: true };
    }
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
        return { content: `${filePath} is a directory, not a file. Use ListDir to list directory contents.`, is_error: true };
    }
    // Binary file check (simple heuristic)
    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.mp3', '.mp4', '.avi', '.mov', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dll', '.so', '.dylib', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.woff', '.woff2', '.ttf', '.eot'];
    if (binaryExts.includes(ext)) {
        return { content: `Binary file: ${filePath} (${stat.size} bytes, type: ${ext})` };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const offset = Math.max(0, (input.offset || 1) - 1);
    const limit = input.limit || 2000;
    const selected = lines.slice(offset, offset + limit);
    const numbered = selected.map((line, i) => `${offset + i + 1}\t${line}`).join('\n');
    let result = numbered;
    if (offset + limit < lines.length) {
        result += `\n... (${lines.length - offset - limit} more lines, ${lines.length} total)`;
    }
    return { content: result || '(empty file)' };
}

// ── Write ──
function toolWrite(input, cwd) {
    const filePath = resolvePath(input.file_path, cwd);
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, input.content, 'utf8');
    const lines = input.content.split('\n').length;
    return { content: `Successfully wrote ${input.content.length} characters (${lines} lines) to ${filePath}` };
}

// ── Edit ──
function toolEdit(input, cwd) {
    const filePath = resolvePath(input.file_path, cwd);
    if (!fs.existsSync(filePath)) {
        return { content: `File not found: ${filePath}`, is_error: true };
    }
    let content = fs.readFileSync(filePath, 'utf8');
    const count = content.split(input.old_string).length - 1;
    if (count === 0) {
        // Provide helpful context
        const preview = input.old_string.slice(0, 100);
        return { content: `old_string not found in ${filePath}. No match for: "${preview}${input.old_string.length > 100 ? '...' : ''}"\nMake sure the string matches exactly, including whitespace, indentation and line endings.`, is_error: true };
    }
    if (count > 1 && !input.replace_all) {
        return { content: `old_string found ${count} times in ${filePath}. Use replace_all: true to replace all, or provide more context to make it unique.`, is_error: true };
    }
    if (input.old_string === input.new_string) {
        return { content: `old_string and new_string are identical. No changes made.`, is_error: true };
    }
    if (input.replace_all) {
        content = content.split(input.old_string).join(input.new_string);
    } else {
        const idx = content.indexOf(input.old_string);
        content = content.slice(0, idx) + input.new_string + content.slice(idx + input.old_string.length);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    const replaced = input.replace_all ? count : 1;
    return { content: `Successfully edited ${filePath} (${replaced} replacement${replaced > 1 ? 's' : ''})` };
}

// ── Bash ──
function toolBash(input, cwd) {
    const timeout = input.timeout || 120000;
    const isWin = process.platform === 'win32';
    return new Promise((resolve) => {
        const proc = exec(input.command, {
            cwd,
            timeout,
            maxBuffer: 10 * 1024 * 1024, // 10MB
            shell: isWin ? 'cmd.exe' : '/bin/bash',
            encoding: 'utf8',
            env: { ...process.env, LANG: 'en_US.UTF-8' }
        }, (err, stdout, stderr) => {
            let result = '';
            if (stdout) result += stdout;
            if (stderr) result += (result ? '\n' : '') + `STDERR: ${stderr}`;
            if (err && !stdout && !stderr) result = err.message;
            if (!result) result = '(no output)';
            // Truncate very long output
            if (result.length > 100000) {
                result = result.slice(0, 50000) + `\n\n... [truncated ${result.length - 100000} chars] ...\n\n` + result.slice(-50000);
            }
            resolve({ content: result, is_error: !!(err && err.code) });
        });
    });
}

// ── Glob ──
function toolGlob(input, cwd) {
    const baseDir = input.path ? resolvePath(input.path, cwd) : cwd;
    if (!fs.existsSync(baseDir)) {
        return Promise.resolve({ content: `Directory not found: ${baseDir}`, is_error: true });
    }

    // Convert glob pattern to regex
    const pattern = input.pattern;
    const results = [];
    const MAX_RESULTS = 500;
    const MAX_DEPTH = 15;

    // Skip common large directories
    const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.next', 'dist', '.cache', 'coverage', '.svn', 'vendor', 'bower_components']);

    function matchGlob(name, globPat) {
        // Simple glob matching: * matches anything except /, ** matches everything, ? matches single char
        let regex = globPat
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '{{DOUBLESTAR}}')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]')
            .replace(/\{\{DOUBLESTAR\}\}/g, '.*');
        return new RegExp(`^${regex}$`).test(name);
    }

    function walk(dir, relPath, depth) {
        if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (results.length >= MAX_RESULTS) break;
            const entryRel = relPath ? `${relPath}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                walk(path.join(dir, entry.name), entryRel, depth + 1);
            } else {
                if (matchGlob(entryRel, pattern)) {
                    try {
                        const stat = fs.statSync(path.join(dir, entry.name));
                        results.push({ path: entryRel, mtime: stat.mtimeMs });
                    } catch {
                        results.push({ path: entryRel, mtime: 0 });
                    }
                }
            }
        }
    }

    walk(baseDir, '', 0);
    // Sort by modification time descending
    results.sort((a, b) => b.mtime - a.mtime);
    const paths = results.map(r => r.path);

    if (paths.length === 0) {
        return Promise.resolve({ content: `No files matching "${pattern}" found in ${baseDir}` });
    }
    let output = paths.join('\n');
    if (results.length >= MAX_RESULTS) {
        output += `\n... (truncated at ${MAX_RESULTS} results)`;
    }
    return Promise.resolve({ content: output });
}

// ── Grep ──
function toolGrep(input, cwd) {
    const baseDir = input.path ? resolvePath(input.path, cwd) : cwd;
    const contextLines = input.context || 0;
    const MAX_MATCHES = 200;
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', '.next', 'dist', '.cache', 'coverage', '.svn']);

    let regex;
    try {
        regex = new RegExp(input.pattern, 'gm');
    } catch (e) {
        return Promise.resolve({ content: `Invalid regex: ${e.message}`, is_error: true });
    }

    // Include filter
    let includeRegex = null;
    if (input.include) {
        const incPat = input.include
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        includeRegex = new RegExp(`^${incPat}$`, 'i');
    }

    const matches = [];

    function searchFile(filePath, relPath) {
        if (matches.length >= MAX_MATCHES) return;
        try {
            const stat = fs.statSync(filePath);
            if (stat.size > MAX_FILE_SIZE) return;
        } catch { return; }

        let content;
        try { content = fs.readFileSync(filePath, 'utf8'); } catch { return; }
        // Skip binary-looking content
        if (content.includes('\0')) return;

        const lines = content.split('\n');
        for (let i = 0; i < lines.length && matches.length < MAX_MATCHES; i++) {
            regex.lastIndex = 0;
            if (regex.test(lines[i])) {
                const start = Math.max(0, i - contextLines);
                const end = Math.min(lines.length - 1, i + contextLines);
                const snippet = [];
                for (let j = start; j <= end; j++) {
                    snippet.push(`${j + 1}${j === i ? ':' : '-'}\t${lines[j]}`);
                }
                matches.push({ file: relPath, line: i + 1, snippet: snippet.join('\n') });
            }
        }
    }

    function walk(dir, relPath) {
        if (matches.length >= MAX_MATCHES) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (matches.length >= MAX_MATCHES) break;
            const entryRel = relPath ? `${relPath}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                walk(path.join(dir, entry.name), entryRel);
            } else {
                if (includeRegex && !includeRegex.test(entry.name)) continue;
                searchFile(path.join(dir, entry.name), entryRel);
            }
        }
    }

    // If path points to a file, search just that file
    if (fs.existsSync(baseDir) && fs.statSync(baseDir).isFile()) {
        searchFile(baseDir, path.relative(cwd, baseDir));
    } else {
        walk(baseDir, '');
    }

    if (matches.length === 0) {
        return Promise.resolve({ content: `No matches for pattern "${input.pattern}"` });
    }

    let output = matches.map(m => `${m.file}:${m.line}\n${m.snippet}`).join('\n\n');
    if (matches.length >= MAX_MATCHES) {
        output += `\n\n... (truncated at ${MAX_MATCHES} matches)`;
    }
    return Promise.resolve({ content: output });
}

// ── ListDir ──
function toolListDir(input, cwd) {
    const dirPath = resolvePath(input.path, cwd);
    if (!fs.existsSync(dirPath)) {
        return { content: `Directory not found: ${dirPath}`, is_error: true };
    }
    if (!fs.statSync(dirPath).isDirectory()) {
        return { content: `Not a directory: ${dirPath}`, is_error: true };
    }
    let entries;
    try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch (e) {
        return { content: `Cannot read directory: ${e.message}`, is_error: true };
    }
    const lines = [];
    // Directories first, then files
    const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    const files = entries.filter(e => !e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
    for (const d of dirs) {
        lines.push(`📁 ${d.name}/`);
    }
    for (const f of files) {
        try {
            const stat = fs.statSync(path.join(dirPath, f.name));
            const sizeStr = stat.size < 1024 ? `${stat.size}B` : stat.size < 1048576 ? `${(stat.size / 1024).toFixed(1)}KB` : `${(stat.size / 1048576).toFixed(1)}MB`;
            lines.push(`   ${f.name}  (${sizeStr})`);
        } catch {
            lines.push(`   ${f.name}`);
        }
    }
    return { content: lines.join('\n') || '(empty directory)' };
}

module.exports = { TOOL_DEFINITIONS, executeTool };
