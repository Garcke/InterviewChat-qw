# InterviewChat-qw
一个基于qwen-max-latest(LLM) + paraformer-realtime-v2(实时语音模型)的一个实时语音面试助手<br>
An interview assistant based on qwen-max-latest(LLM)+ Paraex-Realtime-V2 (real-time voice model)

# 参考项目（Reference item）
[在网页中录音并进行语音识别](https://github.com/aliyun/alibabacloud-bailian-speech-demo/tree/master/samples/gallery/input-text-out-audio-html-ai-assistant)


# 运行教程（Run the tutorial）
- 在config.py中配置API-KEY,API-KEY获取网址：https://bailian.console.aliyun.com/?apiKey=1#/api-key
- 安装requirements.txt的相关库
 ``` 
pip install -r requirements.txt
```
  
- 要同时运行三个服务
```
uvicorn test-api-qw:app --reload --port 2333
```
```
python .\server.py 
```
```
 python -m http.server 9000 
```
- 访问下面地址
```
http://localhost:9000/static/
```
- 快捷键 A-开始/暂停录音 C-清除文本 D-AI问答
- 输入框 `Enter`键 输出文本 `Alt+Enter` 文本换行

# 可配置热词
- 参考网址：https://help.aliyun.com/zh/model-studio/developer-reference/custom-hot-words
- 本项目的test目录，也有写相关代码,可直接运行，但是要配置API-KEY
- 在cache目录,可以编辑prompt.txt写提示词
- 可编辑快捷键 在scripts.js文件可修改
