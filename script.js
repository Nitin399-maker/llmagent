import { openaiConfig } from "https://cdn.jsdelivr.net/npm/bootstrap-llm-provider@1.2";
import { bootstrapAlert } from "https://cdn.jsdelivr.net/npm/bootstrap-alert@1";
import { getProfile } from "https://aipipe.org/aipipe.js";
import { Tools, SYSTEM_PROMPT } from "./utils.js";

let llmConfig = null, messages = [], isProcessing = false, availableModels = [];
const [chatContainer, userInput, sendBtn, configureBtn, modelSelect, googleApiKeyInput, googleCseIdInput, saveGoogleBtn, googleStatus] = 
    ['chat-container', 'user-input', 'send-btn', 'configure-btn', 'model-select', 'google-api-key', 'google-cse-id', 'save-google', 'google-status']
    .map(id => document.getElementById(id));

const loadGoogleCredentials = () => {
    const credentials = JSON.parse(localStorage.getItem('googleSearchCredentials') || '{}');
    googleApiKeyInput.value = credentials.apiKey || '';
    googleCseIdInput.value = credentials.cseId || '';
    updateGoogleStatus();
};

const saveGoogleCredentials = () => {
    const [apiKey, cseId] = [googleApiKeyInput.value.trim(), googleCseIdInput.value.trim()];
    if (apiKey && cseId) {
        localStorage.setItem('googleSearchCredentials', JSON.stringify({ apiKey, cseId }));
        bootstrapAlert({ body: "Google Search credentials saved!", color: "success" });
        updateGoogleStatus();
        bootstrap.Collapse.getInstance(document.getElementById('google-config'))?.hide();
    } else bootstrapAlert({ body: "Please enter both API Key and Search Engine ID", color: "warning" });
};

const updateGoogleStatus = () => {
    const credentials = JSON.parse(localStorage.getItem('googleSearchCredentials') || '{}');
    const isConfigured = credentials.apiKey && credentials.cseId;
    googleStatus.textContent = isConfigured ? ' ✓ Configured' : 'Not configured';
    googleStatus.className = `config-status text-${isConfigured ? 'success' : 'muted'}`;
};

const getGoogleCredentials = () => {
    const credentials = JSON.parse(localStorage.getItem('googleSearchCredentials') || '{}');
    return credentials.apiKey && credentials.cseId ? credentials : null;
};

const initAIPipe = async () => {
    const { token } = getProfile();
    if (!token) window.location = `https://aipipe.org/login?redirect=${window.location.href}`;
    return token;
};

const filterModels = models => models.filter(model => (model.id || model).match(/gpt-4\.1|gpt-5/i));

const populateModelDropdown = models => {
    const filteredModels = filterModels(models);
    modelSelect.innerHTML = '<option value="">Select Model...</option>' + 
        filteredModels.map(model => {
            const modelId = model.id || model;
            return `<option value="${modelId}">${model.name || modelId}</option>`;
        }).join('');
    if (filteredModels.length > 0) {
        modelSelect.value = filteredModels[0].id || filteredModels[0];
        modelSelect.disabled = false;
    }
};

const getSelectedModel = () => modelSelect.value || (availableModels[0]?.id || availableModels[0]) || 'gpt-4o';

const configureLLM = async () => {
    try {
        llmConfig = await openaiConfig({
            show: true,
            defaultBaseUrls: ["https://aipipe.org/openrouter/v1", "https://api.openai.com/v1"],
            help: '<div class="alert alert-info">Use AI Pipe for serverless LLM access, or configure your own provider. Only GPT-4.1* and GPT-5* models are supported.</div>'
        });
        availableModels = filterModels(llmConfig.models);
        populateModelDropdown(llmConfig.models);
        [userInput.disabled, sendBtn.disabled] = availableModels.length > 0 ? [false, false] : [true, true];
        bootstrapAlert({ body: availableModels.length > 0 ? "LLM configured successfully!" : "No compatible models found.", 
                        color: availableModels.length > 0 ? "success" : "danger" });
    } catch (error) {
        bootstrapAlert({ body: `Configuration failed: ${error.message}`, color: "danger" });
    }
};

const googleSearch = async query => {
    const credentials = getGoogleCredentials();
    if (!credentials) throw new Error("Google Search not configured. Please configure API Key and Search Engine ID in the Tools section.");
    const response = await fetch(`https://www.googleapis.com/customsearch/v1?key=${credentials.apiKey}&cx=${credentials.cseId}&q=${encodeURIComponent(query)}`);
    if (!response.ok) throw new Error(`Search failed: ${response.statusText}`);
    const data = await response.json();
    return { query, results: data.items?.slice(0, 5).map(item => ({ title: item.title, snippet: item.snippet, link: item.link })) || [] };
};

const executeJavaScript = code => {
    try {
        const cleanCode = code.trim();
        const result = (function() {
            const globalEval = eval;
            try {  return globalEval(`(${cleanCode})`);  }
             catch (e1) {
                try {  return globalEval(cleanCode);  }
                 catch (e2) {
                    try {
                        const wrappedCode = `
                            (function() {
                                ${cleanCode}
                            })()
                        `;
                        return globalEval(wrappedCode);
                    } catch (e3) {
                        const lines = cleanCode.split('\n').filter(line => 
                          line.trim()&& !line.trim().startsWith('//')&& !line.trim().startsWith('/*')
                        );
                        let lastResult;
                        for (const line of lines) {
                          try {  lastResult = globalEval(line.trim());  } catch
                           (lineError) {console.log(`Line execution warning:${lineError.message}`);}
                        }
                        return lastResult;
                    }
                }
            }
        })();
        return {  result: result,  type: typeof result,   executed: true 
        };
    } catch (error) { throw new Error(`JavaScript execution failed: ${error.message}`); }
};

const aiPipeRequest = async (url, method = 'GET') => {
    const response = await fetch(`https://aipipe.org/proxy/${url}`, { method });
    if (!response.ok) throw new Error(`Request failed: ${response.statusText}`);
    const data = await response.text();
    try { return extractMeaningfulContent(JSON.parse(data), url); } 
    catch { return extractMeaningfulContent(data, url); }
};

const extractMeaningfulContent = (data, url) => {
    if (typeof data === 'string') {
        const parser = new DOMParser(), doc = parser.parseFromString(data, 'text/html');
        doc.querySelectorAll('script, style, noscript, meta, link').forEach(el => el.remove());
        const title = doc.querySelector('title')?.textContent?.trim() || '', 
              metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        let mainContent = '';
        for (const selector of ['main', 'article', '[role="main"]', '.content', '#content', '.post-content', '.entry-content', '.article-content']) {
            const element = doc.querySelector(selector);
            if (element) { mainContent = element.textContent?.trim() || ''; break; }
        }
        if (!mainContent) mainContent = doc.querySelector('body')?.textContent?.trim() || '';
        return { url, title: title.slice(0, 200), description: metaDesc.slice(0, 300), 
                content: mainContent.replace(/\s+/g, ' ').replace(/\n+/g, '\n').slice(0, 2000), 
                contentType: 'html', extractedAt: new Date().toISOString() };
    } else if (typeof data === 'object') {
        const result = { url, contentType: 'json', extractedAt: new Date().toISOString() };
        ['title', 'name', 'description', 'content', 'text', 'body', 'message', 'data'].forEach(field => {
            if (data[field]) {
                let value = data[field];
                if (typeof value === 'string') value = value.slice(0, 1000);
                else if (Array.isArray(value)) value = value.slice(0, 10);
                result[field] = value;
            }
        });
        if (Object.keys(result).length === 3) {
            const keys = Object.keys(data).slice(0, 20);
            result.summary = `JSON object with ${Object.keys(data).length} keys: ${keys.join(', ')}${Object.keys(data).length > 20 ? '...' : ''}`;
        }
        return result;
    }
    return { url, content: String(data).slice(0, 1000), contentType: 'text', extractedAt: new Date().toISOString() };
};

const handleToolCall = async toolCall => {
    const { name, arguments: args } = toolCall.function, parsedArgs = JSON.parse(args);
    addMessage(`🔧 Executing tool: ${name}`, 'tool-message thinking');
    try {
        const result = await { google_search: () => googleSearch(parsedArgs.query), 
                              execute_javascript: () => executeJavaScript(parsedArgs.code), 
                              ai_pipe_request: () => aiPipeRequest(parsedArgs.url, parsedArgs.method) }[name]?.() || 
                        (() => { throw new Error(`Unknown tool: ${name}`); })();
        addMessage(`✅ Tool result: ${JSON.stringify(result, null, 2)}`, 'tool-message');
        return { tool_call_id: toolCall.id, role: "tool", content: JSON.stringify(result) };
    } catch (error) {
        const errorMsg = `❌ Tool error: ${error.message}`;
        addMessage(errorMsg, 'error-message');
        return { tool_call_id: toolCall.id, role: "tool", content: `Error: ${error.message}` };
    }
};

const addMessage = (content, className = '') => {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message p-2 rounded ${className}`;
    messageDiv.innerHTML = content.replace(/\n/g, '<br>');
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

const callLLM = async (messages, tools) => {
    const response = await fetch(`${llmConfig.baseUrl}/chat/completions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${llmConfig.apiKey}` },
        body: JSON.stringify({ model: getSelectedModel(), messages, tools, tool_choice: 'auto' })
    });
    if (!response.ok) throw new Error(`LLM request failed: ${response.statusText}`);
    const data = await response.json(), message = data.choices[0].message;
    return { output: message.content || '', tool_calls: message.tool_calls || [] };
};

const loop = async () => {
    if (!llmConfig) return bootstrapAlert({ body: "Please configure LLM first", color: "warning" });
    if (!getSelectedModel()) return bootstrapAlert({ body: "Please select a model", color: "warning" });
    if (messages.length === 0 || messages[0].role !== "system") {
        messages.unshift(SYSTEM_PROMPT);
    }
    let loaderDiv; 
    while (!isProcessing) {
        try {
            isProcessing = true;
            loaderDiv = document.createElement('div'); 
            loaderDiv.className = 'message p-2'; 
            loaderDiv.innerHTML = '<div class="loader"></div> <span style="color:#0d6efd;">Processing...</span>';
            chatContainer.appendChild(loaderDiv);
            const { output, tool_calls } = await callLLM(messages, Tools);
            const assistantMessage = { role: "assistant", ...(output && { content: output }), ...(tool_calls?.length && { tool_calls }) };
            messages.push(assistantMessage);
            if (output) addMessage(`🤖 Agent: ${output}`, 'agent-message');
            if (tool_calls?.length) {
                messages.push(...await Promise.all(tool_calls.map(handleToolCall)));
                continue;
            }
            break;
        } catch (error) {
            bootstrapAlert({ body: `Error: ${error.message}`, color: "danger" });
            addMessage(`❌ Error: ${error.message}`, 'error-message');
            break;
        } finally { 
            loaderDiv?.remove();
            isProcessing = false; 
        }
    }
};

const handleUserInput = async () => {
    const input = userInput.value.trim();
    if (!input || isProcessing) return;
    if (!getSelectedModel()) return bootstrapAlert({ body: "Please select a model first", color: "warning" });
    addMessage(`👤 You: ${input}`, 'user-message');
    messages.push({ role: "user", content: input });
    userInput.value = '';
    [userInput.disabled, sendBtn.disabled, modelSelect.disabled] = [true, true, true];
    await loop();
    [userInput.disabled, sendBtn.disabled, modelSelect.disabled] = [false, false, false];
    userInput.focus();
};

[configureBtn, sendBtn, saveGoogleBtn].forEach((btn, i) => 
    btn.addEventListener('click', [configureLLM, handleUserInput, saveGoogleCredentials][i]));
userInput.addEventListener('keypress', e => e.key === 'Enter' && handleUserInput());
document.querySelectorAll('.example-question').forEach(btn => 
    btn.addEventListener('click', () => { userInput.value = btn.textContent; handleUserInput(); }));

(async () => {
    loadGoogleCredentials();
    const token = await initAIPipe();
    if (token) {
        try {
            llmConfig = await openaiConfig({ 
                defaultBaseUrls: ["https://aipipe.org/openai/v1", "https://openrouter.com/api/v1", "https://api.openai.com/v1"], 
                show: false 
            });
            if (llmConfig.apiKey || token) {
                llmConfig.apiKey = llmConfig.apiKey || token;
                availableModels = filterModels(llmConfig.models);
                populateModelDropdown(llmConfig.models);
                if (availableModels.length > 0) {
                    [userInput.disabled, sendBtn.disabled] = [false, false];
                    messages.push(SYSTEM_PROMPT);
                    addMessage("🚀 LLM Agent ready! Ask me anything.", 'agent-message');
                } else addMessage("⚠️ No compatible models found.");
            }
        } catch (error) {}
    }
})();