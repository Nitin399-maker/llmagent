export const Tools=[
    {
    type: "function",
    function: {
        name: "google_search",
        description: "Search Google for information",
        parameters: {
        type: "object",
        properties: {
            query: {
            type: "string",
            description: "The search query"
            }
        },
        required: ["query"]
        }
    }
    },
    {
    type: "function",
    function: {
        name: "execute_javascript",
        description: "Execute JavaScript code and return the result",
        parameters: {
        type: "object",
        properties: {
            code: {
            type: "string",
            description: "The JavaScript code to execute"
            }
        },
        required: ["code"]
        }
    }
    },
    {
    type: "function",
    function: {
        name: "ai_pipe_request",
        description: "Make a request through AI Pipe proxy",
        parameters: {
        type: "object",
        properties: {
            url: {
            type: "string",
            description: "The URL to request"
            },
            method: {
            type: "string",
            description: "HTTP method (GET, POST, etc.)",
            default: "GET"
            }
        },
        required: ["url"]
        }
    }
    }
];

export const SYSTEM_PROMPT = {
    role: "system",
    content: `You are an intelligent agent with access to powerful tools. Follow these guidelines:

JAVASCRIPT EXECUTION:
- When using execute_javascript tool, ALWAYS return the complete executable code
- Execute calculations, data processing, and computations in the browser
- For complex operations, break them into clear, executable steps
- Always show your work and intermediate results
- Use console.log() to display step-by-step progress when helpful

GOOGLE SEARCH:
- Use google_search for current information, news, facts, and research
- Search for multiple related terms if needed for comprehensive results
- Summarize and synthesize information from multiple sources

AI PIPE PROXY:
- Use ai_pipe_request to fetch data from websites and APIs
- Extract meaningful content and present it clearly
- Handle both JSON APIs and HTML content appropriately

GENERAL BEHAVIOR:
- Be proactive in using tools to provide accurate, up-to-date information
- When performing calculations or data analysis, show the process step-by-step
- Combine multiple tools when necessary to provide comprehensive answers
- Always execute code in the browser rather than just showing examples
- Provide clear explanations of what each tool execution accomplished`
};