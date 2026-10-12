import base64
import json
import os
import subprocess
import sys
import time
import urllib.request

BASE_URL = "http://127.0.0.1:18998"
SERVER_SCRIPT = os.path.join(os.path.dirname(__file__), "server.py")

class BrowserTab:
    def __init__(self, browser, tab_id):
        self.browser = browser
        self.tab_id = tab_id
        self._closed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()

    def evaluate(self, script, timeout=30):
        res = self.browser.post("evaluate", {"tabId": self.tab_id, "script": script}, timeout=timeout)
        if not res.get("success", False):
            raise RuntimeError(f"Evaluate failed: {res.get('error')}")
        return res.get("value")

    def cdp(self, method, params=None, timeout=30):
        if params is None:
            params = {}
        res = self.browser.post("cdp", {"tabId": self.tab_id, "method": method, "params": params}, timeout=timeout)
        if not res.get("success", False):
            raise RuntimeError(f"CDP {method} failed: {res.get('error')}")
        return res.get("result")

    def goto(self, url, wait_seconds=3):
        res = self.cdp("Page.navigate", {"url": url})
        time.sleep(wait_seconds)
        return res

    def get_title(self):
        return self.evaluate("document.title")

    def get_url(self):
        return self.evaluate("window.location.href")

    def click(self, selector):
        script = f"""
        (() => {{
            const el = document.querySelector({json.dumps(selector)});
            if (el) {{
                el.scrollIntoView({{ behavior: 'instant', block: 'center' }});
                el.dispatchEvent(new MouseEvent('mousedown', {{ bubbles: true }}));
                el.dispatchEvent(new MouseEvent('mouseup', {{ bubbles: true }}));
                el.click();
                return true;
            }}
            return false;
        }})()
        """
        return self.evaluate(script)

    def fill(self, selector, value):
        # 兼容穿透 React/Vue 受控输入框
        script = f"""
        (() => {{
            const el = document.querySelector({json.dumps(selector)});
            if (el) {{
                el.focus();
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                nativeSetter.call(el, {json.dumps(value)});
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                return true;
            }}
            return false;
        }})()
        """
        return self.evaluate(script)

    def screenshot(self, output_path="screenshot.png"):
        res = self.cdp("Page.captureScreenshot", {"format": "png"})
        b64 = res.get("data")
        if b64:
            with open(output_path, "wb") as f:
                f.write(base64.b64decode(b64))
            return os.path.abspath(output_path)
        return None

    def close(self):
        if self._closed:
            return
        self._closed = True
        try:
            self.browser.post("detach_tab", {"tabId": self.tab_id}, timeout=5)
        except Exception:
            pass
        try:
            self.browser.post("close_tab", {"tabId": self.tab_id}, timeout=5)
        except Exception:
            pass


class BrowserDelegation:
    def __init__(self, base_url=BASE_URL):
        self.base_url = base_url

    def post(self, endpoint, data=None, timeout=30):
        if data is None:
            data = {}
        self.ensure_server_running()

        req = urllib.request.Request(
            f"{self.base_url}/{endpoint}",
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        try:
            res = urllib.request.urlopen(req, timeout=timeout)
            return json.loads(res.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8")
            try:
                err_json = json.loads(err_body)
                raise RuntimeError(err_json.get("error", err_body))
            except json.JSONDecodeError:
                raise RuntimeError(f"HTTP {e.code}: {err_body}")

    def ensure_server_running(self):
        # 探活检测
        try:
            req = urllib.request.urlopen(f"{self.base_url}/status", timeout=2)
            res = json.loads(req.read().decode("utf-8"))
            return res
        except Exception:
            pass

        print("[BrowserDelegation] 检测到本地桥接服务未启动，正在自动唤起后台守护进程...")
        # 后台自启动 server.py
        subprocess.Popen(
            [sys.executable, SERVER_SCRIPT],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        # 等待服务就绪
        for _ in range(15):
            time.sleep(0.5)
            try:
                req = urllib.request.urlopen(f"{self.base_url}/status", timeout=2)
                return json.loads(req.read().decode("utf-8"))
            except Exception:
                pass
        raise RuntimeError("启动本地服务失败，请检查端口 18998/18999 是否被占用！")

    def status(self):
        st = self.ensure_server_running()
        return st

    def open_tab(self, url="about:blank", active=True, group_name="🤖 AI 代操作进行中..."):
        st = self.status()
        if not st.get("connected"):
            raise RuntimeError("Chrome 插件未连接！请确保 Chrome 正在运行且已安装并开启「AI Agent 浏览器自动化桥接」扩展。")

        res = self.post("open_tab", {"url": url, "active": active, "group_name": group_name})
        tab_id = res.get("tabId")
        if not tab_id:
            raise RuntimeError(f"打开标签页失败: {res}")
        return BrowserTab(self, tab_id)

    def get_cookies(self, url):
        res = self.post("get_cookies", {"url": url})
        return res.get("cookies", [])
