import asyncio
import json
import sys
import uuid
from aiohttp import web
import websockets

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

WS_PORT = 18999
HTTP_PORT = 18998

extension_ws = None
pending_requests = {}
extension_info = {}

# ----------------- WebSocket Handler (Chrome 插件桥接) -----------------
async def ws_handler(websocket):
    global extension_ws, extension_info
    extension_ws = websocket
    print("\n[Browser-Delegation] >>> Chrome 插件已成功连接！[ON] <<<", flush=True)

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                req_id = data.get("id")
                if req_id and req_id in pending_requests:
                    fut = pending_requests[req_id]
                    if not fut.done():
                        fut.set_result(data)
                elif data.get("type") == "hello":
                    extension_info = data.get("data", {})
                    print("[Browser-Delegation] 插件握手就绪:", extension_info, flush=True)
            except Exception as e:
                print("[Browser-Delegation] 解析插件消息异常:", e, flush=True)
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        print("\n[Browser-Delegation] >>> Chrome 插件已断开连接 [OFF] <<<", flush=True)
        if extension_ws == websocket:
            extension_ws = None
            extension_info = {}

async def call_extension(action, params=None, timeout=30):
    if not extension_ws:
        raise web.HTTPBadRequest(
            text=json.dumps({"error": "Chrome 插件未连接，请确保 Chrome 已打开且插件处于开启状态！"}),
            content_type="application/json"
        )

    req_id = str(uuid.uuid4())
    msg = {"id": req_id, "action": action}
    if params:
        msg.update(params)

    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    pending_requests[req_id] = fut

    await extension_ws.send(json.dumps(msg))
    try:
        res = await asyncio.wait_for(fut, timeout=timeout)
        return res
    except asyncio.TimeoutError:
        raise web.HTTPGatewayTimeout(
            text=json.dumps({"error": "等待 Chrome 响应超时"}),
            content_type="application/json"
        )
    finally:
        pending_requests.pop(req_id, None)

# ----------------- HTTP API Handler (供 AI 和客户端无缝调用) -----------------
async def handle_status(request):
    is_online = extension_ws is not None
    return web.json_response({
        "connected": is_online,
        "extension": extension_info,
        "message": "Chrome 插件已连接 [ON]" if is_online else "Chrome 插件未连接 [OFF]"
    })

async def handle_open_tab(request):
    data = await request.json()
    url = data.get("url", "about:blank")
    active = data.get("active", True)
    group_name = data.get("group_name", "🤖 AI 代操作进行中...")
    res = await call_extension("open_tab", {"url": url, "active": active, "group_name": group_name})
    return web.json_response(res)

async def handle_evaluate(request):
    data = await request.json()
    tab_id = data.get("tabId")
    script = data.get("script")
    res = await call_extension("evaluate", {"tabId": tab_id, "script": script})
    return web.json_response(res)

async def handle_cdp(request):
    data = await request.json()
    tab_id = data.get("tabId")
    method = data.get("method")
    params = data.get("params", {})
    res = await call_extension("cdp", {"tabId": tab_id, "method": method, "params": params})
    return web.json_response(res)

async def handle_detach_tab(request):
    data = await request.json()
    tab_id = data.get("tabId")
    res = await call_extension("detach_tab", {"tabId": tab_id})
    return web.json_response(res)

async def handle_close_tab(request):
    data = await request.json()
    tab_id = data.get("tabId")
    res = await call_extension("close_tab", {"tabId": tab_id})
    return web.json_response(res)

async def handle_get_cookies(request):
    data = await request.json()
    url = data.get("url")
    res = await call_extension("get_cookies", {"url": url})
    return web.json_response(res)

# ----------------- 主入口 -----------------
async def main():
    print(f"[Browser-Delegation] 启动 WebSocket 监听: ws://127.0.0.1:{WS_PORT}", flush=True)
    ws_server = websockets.serve(ws_handler, "127.0.0.1", WS_PORT)

    app = web.Application()
    app.router.add_get("/status", handle_status)
    app.router.add_post("/open_tab", handle_open_tab)
    app.router.add_post("/evaluate", handle_evaluate)
    app.router.add_post("/cdp", handle_cdp)
    app.router.add_post("/detach_tab", handle_detach_tab)
    app.router.add_post("/close_tab", handle_close_tab)
    app.router.add_post("/get_cookies", handle_get_cookies)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", HTTP_PORT)
    await site.start()
    print(f"[Browser-Delegation] 启动 HTTP 控制接口: http://127.0.0.1:{HTTP_PORT}", flush=True)

    await ws_server
    await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
