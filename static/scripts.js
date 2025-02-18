import PCMAudioRecorder from './audio_recorder.js';

// ================== FastAPI参数配置 ==================
const API_BASE_URL = "http://localhost:2333"; // FastAPI 地址
let SYSTEM_PROMPT = ""; // 提示词初始化为空，后续从文件中读取

// ================== 全局常量 ==================
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const chat = document.getElementById('chat');
const outputDiv = document.getElementById('outputText');
const RECOGNITION_MESSAGE_CLASS = 'recognition-message';

// ================== 全局变量 ==================
let activeResponseMessage = addMessage('>', 'response-message');
let recorder = new PCMAudioRecorder();
let ws = null;
let completeTexts = []; // 存储所有完整识别结果
let aiConversationHistory = []; // 存储AI对话历史
let isUserScrolling = false; // 用户是否正在手动滚动


// ================== 快捷键配置 ==================
const SHORTCUT_KEYS = {
    'KeyC': 'clearButton',   // C键清除文本
    'KeyF': 'outputButton'   // F键输出文本
};
const activate_audio = 'KeyA'

// 全局快捷键监听
document.addEventListener('keydown', (e) => {
    // 排除输入框操作
    if (document.activeElement === textInput) return;

    // A键切换录音状态
    if (e.code === activate_audio) {
        e.preventDefault();

        // 根据按钮状态判断操作
        if (!startButton.disabled) {
            startButton.click(); // 触发开始录音
        } else if (!stopButton.disabled) {
            stopButton.click(); // 触发停止录音
        }
    }

    // 其他快捷键保持原样
    const targetId = SHORTCUT_KEYS[e.code];
    if (targetId) {
        const button = document.getElementById(targetId);
        if (button && !button.disabled) button.click();
    }
});

// ================== 从文件中读取提示词 ==================
async function loadPromptFromFile() {
    try {
        const response = await fetch('../cache/prompt.txt'); // 读取 prompt.txt 文件
        if (!response.ok) {
            throw new Error('提示词文件加载失败');
        }
        SYSTEM_PROMPT = await response.text(); // 将文件内容赋值给 SYSTEM_PROMPT
        console.log('提示词已从文件加载:', SYSTEM_PROMPT);
    } catch (error) {
        console.error('加载提示词文件时出错:', error);
        SYSTEM_PROMPT = "默认提示词：请回答我的问题。"; // 如果文件加载失败，使用默认提示词
    }
}

// ================== 初始化时设置提示词 ==================
(async function initPrompt() {
    await loadPromptFromFile(); // 从文件中加载提示词

    try {
        const response = await fetch(`${API_BASE_URL}/set_prompt/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                prompt: SYSTEM_PROMPT,
            }),
        });
        if (!response.ok) throw new Error("提示词设置失败");
        console.log("系统提示词设置成功");
    } catch (error) {
        console.error("提示词设置错误:", error);
    }
})();

// ================== 滚动行为优化 ==================
outputDiv.addEventListener('scroll', () => {
    const threshold = 100; // 距离底部 100px 视为"接近底部"
    const isNearBottom =
        outputDiv.scrollHeight - outputDiv.scrollTop - outputDiv.clientHeight <= threshold;
    isUserScrolling = !isNearBottom;
});

// ================== 文本输入处理 ==================
const textInput = document.getElementById('inputBox');
let isSending = false; // 防止重复提交

textInput.addEventListener('keydown', async (e) => {
    // Shift + Enter 换行
    if (e.shiftKey && e.key === 'Enter') {
        return; // 允许默认换行行为
    }

    // 单独按下Enter发送
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!isSending && textInput.value.trim()) {
            isSending = true;
            try {
                await processTextInput(textInput.value.trim());
                textInput.value = ''; // 清空输入框
                console.log('textInput.value:', textInput.value); // 应该输出<textarea>元素
            } catch (error) {
                console.error('发送失败:', error);
                addAIMessage('消息发送失败，请重试', 'error-message');
            } finally {
                isSending = false;
            }
        }
    }
});

async function processTextInput(text) {
    // 显示用户消息
    addAIMessage(text, 'user-message');

    try {
        // 调用API
        const response = await fetch(`${API_BASE_URL}/chat/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({content: text}),
        });

        if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);

        // 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let activeAIMessage = createAIMessageElement();

        while (true) {
            const {done, value} = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            try {
                const jsonResponse = JSON.parse(chunk);
                assistantMessage += jsonResponse.response;
                updateMessageWithMarkdown(activeAIMessage, assistantMessage);

                // 自动滚动
                if (!isUserScrolling) {
                    outputDiv.scrollTop = outputDiv.scrollHeight;
                }
            } catch (error) {
                console.error('解析错误:', error);
            }
        }

        // 保存对话历史
        aiConversationHistory.push({
            user: text,
            assistant: assistantMessage,
        });
    } catch (error) {
        console.error('API请求失败:', error);
        addAIMessage('服务连接失败，请检查网络', 'error-message');
        throw error;
    }
}


// ================== 修改后的输出按钮功能 ==================
document.getElementById('outputButton').addEventListener('click', async () => {
    try {
        // 1. 显示用户消息
        const userMessage = completeTexts.join('\n');
        addAIMessage(userMessage, 'user-message');

        // 2. 调用AI接口
        const response = await fetch(`${API_BASE_URL}/chat/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                content: userMessage,
            }),
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        // 3. 处理流式响应
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let activeAIMessage = createAIMessageElement();

        while (true) {
            const {done, value} = await reader.read();
            if (done) break;

            try {
                const chunk = decoder.decode(value);
                const jsonResponse = JSON.parse(chunk);
                assistantMessage += jsonResponse.response;

                // 实时更新消息（支持 Markdown）
                updateMessageWithMarkdown(activeAIMessage, assistantMessage);

                // 条件滚动
                if (!isUserScrolling) {
                    outputDiv.scrollTop = outputDiv.scrollHeight;
                }
            } catch (error) {
                console.error('Error parsing chunk:', error);
            }
        }

        // 4. 保存完整消息
        aiConversationHistory.push({
            user: userMessage,
            assistant: assistantMessage,
        });
    } catch (error) {
        console.error('API请求失败:', error);
        addAIMessage('AI服务连接失败，请检查网络', 'error-message');
    }
});

// ================== 新增清除功能 ==================
document.getElementById('clearButton').addEventListener('click', () => {
    // 1. 清空存储的识别结果
    completeTexts = [];

    // 2. 移除所有识别消息DOM元素
    const recognitionMessages = document.querySelectorAll(`.${RECOGNITION_MESSAGE_CLASS}`);
    recognitionMessages.forEach((msg) => msg.remove());

    // 3. 重置当前活动消息
    activeResponseMessage = addMessage('>', 'response-message');

    console.log('所有识别文本已清除');
});

// ================== 新增聊天消息处理函数 ==================
function createAIMessageElement() {
    const message = document.createElement('div');
    message.className = 'message ai-response-message';
    outputDiv.appendChild(message);
    return message;
}

function addAIMessage(text, className) {
    const message = document.createElement('div');
    message.className = `message ${className}`;
    message.textContent = text;
    outputDiv.appendChild(message);
    outputDiv.scrollTop = outputDiv.scrollHeight;
}

function addResponseMessage(msg) {
    const jsonObject = JSON.parse(msg);
    let text = jsonObject.text;
    let is_end = jsonObject.is_end;

    // 更新当前活动消息
    activeResponseMessage.textContent = text;

    if (is_end) {
        completeTexts.push(text); // 将完成的文本添加到数组
        activeResponseMessage = addMessage('>', 'response-message');
    }

    chat.scrollTop = chat.scrollHeight;
}

// 添加消息到聊天框
function addMessage(text, className) {
    const message = document.createElement('div');
    message.classList.add('message', className);

    // 安全添加识别类名
    if (className === 'response-message') {
        message.classList.add('recognition-message');
    }

    message.textContent = text;

    // 使用 requestAnimationFrame 避免阻塞
    requestAnimationFrame(() => {
        chat.appendChild(message);
        chat.scrollTop = chat.scrollHeight;
    });

    return message;
}

// 更新消息内容（支持 Markdown）
function updateMessageWithMarkdown(element, text) {
    requestAnimationFrame(() => {
        // 使用文档片段
        const fragment = document.createDocumentFragment();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = marked.parse(text);

        // 高亮代码块
        tempDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        fragment.appendChild(tempDiv);
        element.innerHTML = '';
        element.appendChild(fragment);
    });
}

// ================== 录音功能 ==================
startButton.onclick = async () => {
    try {
        // 连接WebSocket
        ws = new WebSocket('ws://localhost:6220');
        console.log('[Debug] WebSocket 已创建');

        ws.onmessage = (event) => {
            const data = event.data;
            if (typeof data === 'string') {
                if (data === 'asr stopped') {
                    // ws.close();
                } else {
                    console.log('recv msg: ', data);
                    addResponseMessage(data);
                }
            }
        };

        console.log('[Debug] 正在初始化录音...');

        await recorder.connect(async (pcmData) => {
            console.log('[Debug] 收到音频数据，长度:', pcmData.length);
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log('send audio');
                ws.send(pcmData);
            }
        });

        startButton.disabled = true;
        stopButton.disabled = false;
        console.log('[Debug] 录音已启动');
    } catch (error) {
        console.error('Error:', error);
    }
};

stopButton.onclick = () => {
    recorder.stop();
    if (ws) {
        ws.send('stop');
    }
    startButton.disabled = false;
    stopButton.disabled = true;
};