// AI Agent 浏览器桥接 Background Service Worker v1.1.0
const WS_URL = "ws://127.0.0.1:18999";
let socket = null;
let isConnected = false;
let reconnectTimer = null;
let heartbeatTimer = null;

const attachedTabs = new Set();
let currentGroupId = null;

function log(...args) {
  console.log("[Agent Bridge]", ...args);
}

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket(WS_URL);

    socket.onopen = () => {
      isConnected = true;
      log("已连接到本地 AI Agent 服务端");
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#10B981" });
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 15000);
      sendToAgent({ type: "hello", data: { version: "1.1.0", agent: "ChromeBridge" } });
    };

    socket.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleAgentMessage(msg);
      } catch (err) {
        console.error("处理消息失败:", err);
      }
    };

    socket.onclose = () => {
      isConnected = false;
      log("连接断开，等待重连...");
      chrome.action.setBadgeText({ text: "OFF" });
      chrome.action.setBadgeBackgroundColor({ color: "#6B7280" });
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      cleanupAllDebugger();
      scheduleReconnect();
    };

    socket.onerror = () => {
      if (socket) socket.close();
    };
  } catch (e) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (!reconnectTimer) {
    reconnectTimer = setInterval(() => {
      connectWebSocket();
    }, 3000);
  }
}

function sendToAgent(data) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(data));
  }
}

function cleanupAllDebugger() {
  for (const tabId of attachedTabs) {
    try {
      chrome.debugger.detach({ tabId }, () => {});
    } catch (e) {}
  }
  attachedTabs.clear();
}

chrome.debugger.onDetach.addListener((source, reason) => {
  if (source.tabId) {
    attachedTabs.delete(source.tabId);
    sendToAgent({
      type: "debugger_detached",
      tabId: source.tabId,
      reason: reason
    });
  }
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  sendToAgent({
    type: "cdp_event",
    tabId: source.tabId,
    method: method,
    params: params
  });
});

// 在页面注入一个优雅的悬浮提示条
function injectAgentHUD(tabId, text = "🤖 AI 数据自动化进行中...") {
  chrome.scripting?.executeScript({
    target: { tabId },
    func: (msg) => {
      if (document.getElementById("__agent_hud__")) return;
      const bar = document.createElement("div");
      bar.id = "__agent_hud__";
      bar.style.cssText = `
        position: fixed;
        top: 14px;
        right: 20px;
        z-index: 2147483647;
        background: linear-gradient(135deg, #4f46e5, #7c3aed);
        color: white;
        padding: 8px 16px;
        border-radius: 9999px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        font-weight: 600;
        box-shadow: 0 10px 25px -5px rgba(79, 70, 229, 0.4), 0 8px 10px -6px rgba(79, 70, 229, 0.2);
        display: flex;
        align-items: center;
        gap: 8px;
        pointer-events: none;
        transition: all 0.3s ease;
      `;
      bar.innerHTML = `<span>${msg}</span><span style="display:inline-block;width:8px;height:8px;background:#34d399;border-radius:50%;animation:pulse 1.5s infinite;"></span>`;
      document.body?.appendChild(bar);
    },
    args: [text]
  }).catch(() => {});
}

async function handleAgentMessage(msg) {
  const { id, action } = msg;

  try {
    switch (action) {
      case "ping": {
        sendToAgent({ id, success: true, pong: true });
        break;
      }

      case "open_tab": {
        const { url = "about:blank", active = true, group_name = "🤖 AI 正在操作..." } = msg;
        const tab = await chrome.tabs.create({ url, active });
        const tabId = tab.id;

        // 1. 将标签页划入醒目的专属标签组（紫色）
        try {
          const groupId = await chrome.tabs.group({ tabIds: [tabId] });
          await chrome.tabGroups.update(groupId, {
            title: group_name,
            color: "purple"
          });
        } catch (e) {
          console.warn("设置标签组失败:", e);
        }

        // 2. 附加 debugger
        await new Promise((resolve, reject) => {
          chrome.debugger.attach({ tabId }, "1.3", () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              attachedTabs.add(tabId);
              chrome.debugger.sendCommand({ tabId }, "Page.enable", {}, () => {});
              chrome.debugger.sendCommand({ tabId }, "Runtime.enable", {}, () => {});
              chrome.debugger.sendCommand({ tabId }, "DOM.enable", {}, () => {});
              resolve();
            }
          });
        });

        sendToAgent({ id, success: true, tabId });
        break;
      }

      case "detach_tab": {
        const { tabId } = msg;
        if (attachedTabs.has(tabId)) {
          chrome.debugger.detach({ tabId }, () => {});
          attachedTabs.delete(tabId);
        }
        sendToAgent({ id, success: true });
        break;
      }

      case "close_tab": {
        const { tabId } = msg;
        if (attachedTabs.has(tabId)) {
          chrome.debugger.detach({ tabId }, () => {});
          attachedTabs.delete(tabId);
        }
        await chrome.tabs.remove(tabId);
        sendToAgent({ id, success: true });
        break;
      }

      case "cdp": {
        const { tabId, method, params = {} } = msg;
        chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
          if (chrome.runtime.lastError) {
            sendToAgent({ id, success: false, error: chrome.runtime.lastError.message });
          } else {
            sendToAgent({ id, success: true, result });
          }
        });
        break;
      }

      case "evaluate": {
        const { tabId, script } = msg;
        chrome.debugger.sendCommand(
          { tabId },
          "Runtime.evaluate",
          { expression: script, returnByValue: true, awaitPromise: true },
          (result) => {
            if (chrome.runtime.lastError) {
              sendToAgent({ id, success: false, error: chrome.runtime.lastError.message });
            } else {
              const val = result && result.result ? result.result.value : null;
              sendToAgent({ id, success: true, value: val, details: result });
            }
          }
        );
        break;
      }

      case "get_cookies": {
        const { url } = msg;
        const cookies = await chrome.cookies.getAll({ url });
        sendToAgent({ id, success: true, cookies });
        break;
      }

      default:
        sendToAgent({ id, success: false, error: `未知操作: ${action}` });
    }
  } catch (err) {
    sendToAgent({ id, success: false, error: err.message });
  }
}

// Chrome MV3 自动保活机制
chrome.alarms?.create("keepAlive", { periodInMinutes: 0.5 });
chrome.alarms?.onAlarm.addListener((alarm) => {
  if (alarm.name === "keepAlive") {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    } else {
      socket.send(JSON.stringify({ type: "ping" }));
    }
  }
});

connectWebSocket();

chrome.runtime.onInstalled.addListener(() => {
  connectWebSocket();
});
