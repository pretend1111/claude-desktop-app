import { registerBundledSkill } from '../bundledSkills.js'

const CREATE_PROJECT_PROMPT = `# Create Project: Scaffold a Complete Project

You are scaffolding a new project from scratch. Follow these steps to create a well-structured, immediately runnable project.

## Step 1: Understand Requirements

Clarify what the user wants to build. Consider:
- What type of project? (web app, game, tool, script, API, etc.)
- What technologies? (HTML/CSS/JS, Python, Node.js, etc.)
- Any specific features or requirements mentioned?

## Step 2: Plan the Structure

Before writing any code, briefly outline:
- File structure (keep it simple — avoid over-engineering)
- Core components/modules
- Key dependencies (prefer zero-dependency or minimal dependencies)

## Step 3: Build It

Write all files using the Write tool. Follow these principles:

### For Web Projects (HTML/CSS/JS)
- Prefer single-file HTML for simple projects (inline CSS + JS)
- Use modern ES6+ JavaScript, CSS Grid/Flexbox
- Make it visually polished — use the frontend-design skill principles
- Must be immediately openable in a browser

### For Python Projects
- Include a main entry point (main.py or app.py)
- Add requirements.txt if external packages needed
- Include clear usage instructions in comments at top

### For Node.js Projects
- Include package.json with scripts
- Use ES modules where possible
- Include a README with setup instructions

### General Principles
- Write complete, working code — no placeholders or TODOs
- Include error handling for common failure cases
- Add brief comments only where logic is non-obvious
- Make the project immediately runnable with minimal setup

## Step 4: Verify & Report

After creating all files:
- Briefly list all created files
- Provide the exact command to run the project
- Note any prerequisites (e.g., "open index.html in browser" or "run python main.py")
`

export function registerCreateProjectSkill(): void {
  registerBundledSkill({
    name: 'create-project',
    description:
      'Scaffold a complete, runnable project from scratch with proper structure and best practices.',
    whenToUse:
      'When the user asks to create a new project, build an app, make a game, or scaffold something from scratch.',
    userInvocable: true,
    argumentHint: '[project description]',
    async getPromptForCommand(args) {
      let prompt = CREATE_PROJECT_PROMPT
      if (args) {
        prompt += `\n## Project Description\n\n${args}\n`
      }
      return [{ type: 'text', text: prompt }]
    },
  })
}
