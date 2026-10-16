import os, urllib.request, json, dotenv

dotenv.load_dotenv()
api_key = os.getenv("AMD_API_KEY", "").strip()

body = {
    "model": "Qwen3.8-27B",
    "temperature": 0.7,
    "messages": [
        {"role": "system", "content": "You are a theatrical playwright. Output strictly a JSON object: {\"status\": \"ok\", \"line\": \"The station is quiet.\"}."},
        {"role": "user", "content": "Generate the JSON response."}
    ],
    "max_tokens": 300,
    "response_format": {"type": "json_object"}
}

req = urllib.request.Request(
    "https://developer.amd.com.cn/radeon/api/v1/chat/completions",
    data=json.dumps(body).encode("utf-8"),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=12) as r:
        res = json.loads(r.read().decode())
        msg = res["choices"][0]["message"]
        print("CONTENT:", msg.get("content"))
        print("REASONING:", msg.get("reasoning", "")[:100])
except Exception as e:
    print("ERR:", e)
