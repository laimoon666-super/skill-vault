const badge = document.getElementById("status-badge");
const dot = document.getElementById("status-dot");
const text = document.getElementById("status-text");
const btn = document.getElementById("reconnect-btn");

function updateStatus() {
  chrome.action.getBadgeText({}, (badgeText) => {
    if (badgeText === "ON") {
      badge.className = "badge badge-on";
      dot.className = "dot dot-on";
      text.innerText = "已连接服务";
    } else {
      badge.className = "badge badge-off";
      dot.className = "dot dot-off";
      text.innerText = "未连接 (待命)";
    }
  });
}

btn.addEventListener("click", () => {
  text.innerText = "正在检查...";
  chrome.runtime.sendMessage({ action: "reconnect" }, () => {
    setTimeout(updateStatus, 500);
  });
});

updateStatus();
