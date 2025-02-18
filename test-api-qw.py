import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware  # 新增导入
from fastapi.responses import StreamingResponse
from openai import OpenAI
from pydantic import BaseModel

import config

# 若没有配置环境变量，请用百炼API Key将下行替换为：api_key="sk-xxx",
API_KEY = config.DASHSCOPE_API_KEY

app = FastAPI()

# ================== 新增CORS配置 ==================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境应改为具体的域名
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有HTTP方法
    allow_headers=["*"],  # 允许所有HTTP头
)

# 初始化千问大模型
client = OpenAI(
    # 若没有配置环境变量，请用百炼API Key将下行替换为：api_key="sk-xxx",
    api_key=API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
)

# 用于存储对话历史的全局变量
conversation_history = []


class UserMessage(BaseModel):
    content: str


class PromptMessage(BaseModel):
    prompt: str


@app.post("/set_prompt/")
async def set_prompt(prompt_message: PromptMessage):
    global conversation_history

    # 将提示词作为系统消息添加到对话历史中
    conversation_history.append({"role": "system", "content": prompt_message.prompt})
    return {"message": "Prompt has been set."}


@app.post("/chat/")
async def chat(user_message: UserMessage):
    global conversation_history

    # 将用户的消息添加到对话历史中
    conversation_history.append({"role": "user", "content": user_message.content})

    # 调用 DeepSeek 进行流式文本生成
    try:
        response = client.chat.completions.create(
            model="qwen-max-latest",
            messages=conversation_history,
            stream=True,
            extra_body={"enable_search": True},
            temperature=0.3,
            top_p=0.5,
            presence_penalty=0.8,
            max_tokens=4096,
            n=1,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 定义一个生成器函数，用于逐步返回 DeepSeek 的响应
    async def stream_response():
        assistant_message = ""
        for chunk in response:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                assistant_message += content
                yield json.dumps({"response": content}) + "\n"  # 返回 JSON 格式的流式数据

        # 将完整的助手消息添加到对话历史中
        conversation_history.append({"role": "assistant", "content": assistant_message})

    # 返回流式响应
    return StreamingResponse(stream_response(), media_type="application/x-ndjson")


@app.get("/history/")
async def get_history():
    global conversation_history
    return {"history": conversation_history}


@app.post("/reset/")
async def reset_history():
    global conversation_history
    conversation_history = []
    return {"message": "Conversation history has been reset."}
