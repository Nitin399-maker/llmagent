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