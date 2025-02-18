import requests
import json

# API 的基础 URL
BASE_URL = "http://127.0.0.1:2333"

def set_prompt(prompt):
    """
    设置提示词
    """
    url = f"{BASE_URL}/set_prompt/"
    data = {"prompt": prompt}
    headers = {"Content-Type": "application/json"}

    response = requests.post(url, json=data, headers=headers)
    if response.status_code == 200:
        print(f"Prompt set: {prompt}")
    else:
        print(f"Error: {response.status_code} - {response.text}")

def send_message(content):
    """
    发送消息到 /chat/ 端点，并接收流式响应
    """
    url = f"{BASE_URL}/chat/"
    data = {"content": content}
    headers = {"Content-Type": "application/json"}

    # 发送 POST 请求
    with requests.post(url, json=data, headers=headers, stream=True) as response:
        if response.status_code != 200:
            print(f"Error: {response.status_code} - {response.text}")
            return

        # 逐步读取流式响应
        print(f"Response for '{content}':")
        for line in response.iter_lines():
            if line:
                # 解析 JSON 数据
                chunk = json.loads(line.decode("utf-8"))
                print(chunk["response"], end="", flush=True)
        print("\n")

def get_history():
    """
    获取当前的对话历史
    """
    url = f"{BASE_URL}/history/"
    response = requests.get(url)
    if response.status_code == 200:
        print("Conversation History:")
        for message in response.json()["history"]:
            print(f"{message['role']}: {message['content']}")
    else:
        print(f"Error: {response.status_code} - {response.text}")

def reset_history():
    """
    重置对话历史
    """
    url = f"{BASE_URL}/reset/"
    response = requests.post(url)
    if response.status_code == 200:
        print("Conversation history has been reset.")
    else:
        print(f"Error: {response.status_code} - {response.text}")

if __name__ == "__main__":
    # 设置提示词
    set_prompt("现在你是一位数据分析师岗位的应聘者，我作为HR，请回答我所接下来提出的问题")

    # 测试 1: 发送第一条消息
    send_message("你好，请介绍一下k-means算法")

    # # 测试 2: 发送第二条消息
    # send_message("What is the second highest?")

    # # 测试 3: 获取对话历史
    # get_history()
    #
    # # 测试 4: 重置对话历史
    # reset_history()
    #
    # # 测试 5: 再次获取对话历史（应为空）
    # get_history()