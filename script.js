import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1.2";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { getProfile } from "https://aipipe.org/aipipe.js";
import { Tools } from "./utils.js";

let llmConfig = null, messages = [], isProcessing = false, availableModels = [];
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const configureBtn = document.getElementById('configure-btn');
const modelSelect = document.getElementById('model-select');

async function initAIPipe() {
    const { token } = getProfile();
    if (!token) {
        window.location = `https://aipipe.org/login?redirect=${window.location.href}`;
        return null;
    }
    return token;
}

const filterModels = models => models.filter(model => (model.id || model).match(/gpt-4\.1|gpt-5/i));

function populateModelDropdown(models) {
    const filteredModels = filterModels(models);
    modelSelect.innerHTML = '<option value="">Select Model...</option>';
    filteredModels.forEach(model => {
        const modelId = model.id || model;
        const option = document.createElement('option');
        option.value = modelId;
        option.textContent = model.name || modelId;
        modelSelect.appendChild(option);
    });
    if (filteredModels.length > 0) {
        modelSelect.value = filteredModels[0].id || filteredModels[0];
        modelSelect.disabled = false;
    }
}

const getSelectedModel = () => modelSelect.value || (availableModels.length > 0 ? availableModels[0].id || availableModels[0] : 'gpt-4o');

async function configureLLM() {
    try {
        llmConfig = await openaiConfig({
            show: true,
            defaultBaseUrls: ["https://aipipe.org/openrouter/v1", "https://api.openai.com/v1"],
            help: '<div class="alert alert-info">Use AI Pipe for serverless LLM access, or configure your own provider. Only GPT-4.1* and GPT-5* models are supported.</div>'
        });
        availableModels = filterModels(llmConfig.models);
        populateModelDropdown(llmConfig.models);
        if (availableModels.length > 0) {
            userInput.disabled = sendBtn.disabled = false;
            bootstrapAlert({ body: "LLM configured successfully!", color: "success" });
        } else {
            bootstrapAlert({ body: "No compatible models found.", color: "danger" });
        }
    } catch (error) {
        bootstrapAlert({ body: `Configuration failed: ${error.message}`, color: "danger" });
    }
}

const tools = Tools;
async function handleToolCall(toolCall) {
    const { name, arguments: args } = toolCall.function;
    const parsedArgs = JSON.parse(args);
    addMessage(`🔧 Executing tool: ${name}`, 'tool-message thinking');
    try {
        let result;
        switch (name) {
            case 'google_search': result = await googleSearch(parsedArgs.query); break;
            case 'execute_javascript': result = await executeJavaScript(parsedArgs.code); break;
            case 'ai_pipe_request': result = await aiPipeRequest(parsedArgs.url, parsedArgs.method); break;
            default: throw new Error(`Unknown tool: ${name}`);
        }
        addMessage(`✅ Tool result: ${JSON.stringify(result, null, 2)}`, 'tool-message');
        return { tool_call_id: toolCall.id, role: "tool", content: JSON.stringify(result) };
    } catch (error) {
        const errorMsg = `❌ Tool error: ${error.message}`;
        addMessage(errorMsg, 'error-message');
        return { tool_call_id: toolCall.id, role: "tool", content: `Error: ${error.message}` };
    }
}

async function googleSearch(query) {
    const apiKey = prompt("Enter Google Search API key (or cancel to skip):");
    if (!apiKey) throw new Error("Google Search API key required");
    const searchEngineId = prompt("Enter Google Search Engine ID:");
    if (!searchEngineId) throw new Error("Google Search Engine ID required");
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);
    const data = await response.json();
    return {
        query,
        results: data.items?.slice(0, 5).map(item => ({
            title: item.title, snippet: item.snippet, link: item.link
        })) || []
    };
}

async function executeJavaScript(code) {
    try {
        const result = new Function('return ' + code)();
        return { result, type: typeof result };
    } catch (error) {
        try {
            const result = new Function(code)();
            return { result: result || 'Code executed successfully', type: typeof result };
        } catch (error2) {
            throw new Error(`JavaScript execution failed: ${error2.message}`);
        }
    }
}

async function aiPipeRequest(url, method = 'GET') {
    const response = await fetch(`https://aipipe.org/proxy/${url}`, { method });
    if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);
    const data = await response.text();
    try { return JSON.parse(data); } catch { return { content: data }; }
}

function addMessage(content, className = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message p-2 rounded ${className}`;
    messageDiv.innerHTML = content.replace(/\n/g, '<br>');
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

async function callLLM(messages, tools) {
    const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.apiKey}` },
        body: JSON.stringify({ model: getSelectedModel(), messages, tools, tool_choice: 'auto' })
    });
    if (!response.ok) throw new Error(`LLM request failed: ${response.statusText}`);
    const data = await response.json();
    const message = data.choices[0].message;
    return { output: message.content || '', tool_calls: message.tool_calls || [] };
}

async function loop() {
    if (!llmConfig) { bootstrapAlert({ body: "Please configure LLM first", color: "warning" }); return; }
    if (!getSelectedModel()) { bootstrapAlert({ body: "Please select a model", color: "warning" }); return; }
    while (true) {
        if (isProcessing) return;
        try {
            isProcessing = true;
            const { output, tool_calls } = await callLLM(messages, tools);
            const assistantMessage = { role: "assistant" };
            if (output) assistantMessage.content = output;
            if (tool_calls?.length > 0) assistantMessage.tool_calls = tool_calls;
            messages.push(assistantMessage);
            if (output) {   addMessage(`🤖 Agent: ${output}`, 'agent-message'); }
            if (tool_calls?.length > 0) {
                const toolResults = await Promise.all(tool_calls.map(toolCall => handleToolCall(toolCall)));
                messages.push(...toolResults);
                continue; 
            } else {   break;   }
        } catch (error) {
            bootstrapAlert({ body: `Error: ${error.message}`, color: "danger" });
            addMessage(`❌ Error: ${error.message}`, 'error-message');
            break;
        } finally {
            isProcessing = false;
        }
    }
}

async function handleUserInput() {
    const input = userInput.value.trim();
    if (!input || isProcessing) return;
    if (!getSelectedModel()) { bootstrapAlert({ body: "Please select a model first", color: "warning" }); return; }
    addMessage(`👤 You: ${input}`, 'user-message');
    messages.push({ role: "user", content: input });
    userInput.value = '';
    [userInput.disabled, sendBtn.disabled, modelSelect.disabled] = [true, true, true];
    await loop();
    [userInput.disabled, sendBtn.disabled, modelSelect.disabled] = [false, false, false];
    userInput.focus();
}

configureBtn.addEventListener('click', configureLLM);
sendBtn.addEventListener('click', handleUserInput);
userInput.addEventListener('keypress', e => e.key === 'Enter' && handleUserInput());
document.querySelectorAll('.example-question').forEach(btn => btn.addEventListener('click', () => {
    userInput.value = btn.textContent;
    handleUserInput();
}));

async function init() {
    const token = await initAIPipe();
    if (token) {
        try {
            llmConfig = await openaiConfig({ defaultBaseUrls: ["https://aipipe.org/openai/v1","https://openrouter.com/api/v1", "https://api.openai.com/v1"], show: false });
            if (llmConfig.apiKey || token) {
                llmConfig.apiKey = llmConfig.apiKey || token;
                availableModels = filterModels(llmConfig.models);
                populateModelDropdown(llmConfig.models);
                if (availableModels.length > 0) {
                    userInput.disabled = sendBtn.disabled = false;
                    addMessage("🚀 LLM Agent ready! Ask me anything.", 'agent-message');
                } else { addMessage("⚠️ No compatible models found.");  }
            }
        } catch (error) {}
    }
}

init();