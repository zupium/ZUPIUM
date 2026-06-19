const STORAGE_KEY = "zupium_conversations_v1";

let state = {
  conversations: [],
  activeId: null,
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.conversations)) {
        state = parsed;
      }
    }
  } catch (e) {
    console.warn("Gagal load history:", e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn("Gagal simpan history:", e);
  }
}

function getActiveConv() {
  return state.conversations.find((c) => c.id === state.activeId) || null;
}

function createConversation() {
  const conv = {
    id: crypto.randomUUID(),
    title: "Obrolan baru",
    messages: [],
    createdAt: Date.now(),
  };
  state.conversations.unshift(conv);
  state.activeId = conv.id;
  saveState();
  renderSidebar();
  renderConversation();
}

function deleteConversation(id) {
  state.conversations = state.conversations.filter((c) => c.id !== id);
  if (state.activeId === id) {
    state.activeId = state.conversations[0]?.id || null;
  }
  saveState();
  renderSidebar();
  renderConversation();
}

function setActiveConversation(id) {
  state.activeId = id;
  saveState();
  renderSidebar();
  renderConversation();
  closeMobileSidebar();
}

function deriveTitle(text) {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 38 ? clean.slice(0, 38) + "…" : clean || "Obrolan baru";
}

function renderSidebar() {
  const list = document.getElementById("convList");
  list.innerHTML = "";

  if (state.conversations.length === 0) {
    const empty = document.createElement("div");
    empty.style.color = "var(--text-2)";
    empty.style.fontSize = "13px";
    empty.style.padding = "10px 12px";
    empty.textContent = "Belum ada obrolan.";
    list.appendChild(empty);
    return;
  }

  for (const conv of state.conversations) {
    const item = document.createElement("div");
    item.className = "conv-item" + (conv.id === state.activeId ? " active" : "");
    item.innerHTML = `
      <span class="conv-label">${escapeHtml(conv.title)}</span>
      <button class="conv-del" title="Hapus" aria-label="Hapus obrolan">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
    `;
    item.addEventListener("click", (e) => {
      if (e.target.closest(".conv-del")) return;
      setActiveConversation(conv.id);
    });
    item.querySelector(".conv-del").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(conv.id);
    });
    list.appendChild(item);
  }
}

function renderConversation() {
  const conv = getActiveConv();
  const emptyState = document.getElementById("emptyState");
  const messagesEl = document.getElementById("messages");
  const titleEl = document.getElementById("convTitle");

  messagesEl.innerHTML = "";

  if (!conv || conv.messages.length === 0) {
    emptyState.style.display = "block";
    titleEl.textContent = "Obrolan baru";
    return;
  }

  emptyState.style.display = "none";
  titleEl.textContent = conv.title;

  for (const msg of conv.messages) {
    messagesEl.appendChild(buildMessageEl(msg.role, msg.content));
  }
  decorateCodeBlocks(messagesEl);
  scrollToBottom();
}

function buildMessageEl(role, content) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "user" ? "K" : "Z";

  const body = document.createElement("div");
  body.className = "msg-body";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.textContent = content;
  }

  body.appendChild(bubble);
  wrap.appendChild(avatar);
  wrap.appendChild(body);
  return wrap;
}

function renderMarkdown(text) {
  try {
    return marked.parse(text, { breaks: true });
  } catch (e) {
    return escapeHtml(text);
  }
}

function decorateCodeBlocks(container) {
  container.querySelectorAll("pre code").forEach((block) => {
    if (block.dataset.decorated) return;
    block.dataset.decorated = "1";

    hljs.highlightElement(block);

    const lang = (block.className.match(/language-(\w+)/) || [])[1] || "text";
    const pre = block.parentElement;
    const toolbar = document.createElement("div");
    toolbar.className = "code-toolbar";
    toolbar.innerHTML = `<span>${lang}</span><button class="copy-btn">Salin</button>`;
    toolbar.querySelector(".copy-btn").addEventListener("click", () => {
      navigator.clipboard.writeText(block.textContent).then(() => {
        const btn = toolbar.querySelector(".copy-btn");
        btn.textContent = "Tersalin!";
        setTimeout(() => (btn.textContent = "Salin"), 1500);
      });
    });
    pre.parentElement.insertBefore(toolbar, pre);
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function scrollToBottom() {
  const scroll = document.getElementById("chatScroll");
  scroll.scrollTop = scroll.scrollHeight;
}

async function sendMessage(text) {
  let conv = getActiveConv();
  if (!conv) {
    createConversation();
    conv = getActiveConv();
  }

  const isFirstMessage = conv.messages.length === 0;
  conv.messages.push({ role: "user", content: text });
  if (isFirstMessage) {
    conv.title = deriveTitle(text);
  }
  saveState();
  renderSidebar();
  renderConversation();

  const messagesEl = document.getElementById("messages");
  const assistantWrap = buildMessageEl("assistant", "");
  const bubble = assistantWrap.querySelector(".bubble");
  bubble.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(assistantWrap);
  scrollToBottom();

  setSending(true);

  let fullText = "";
  try {
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        history: conv.messages.slice(0, -1),
      }),
    });

    if (!resp.ok || !resp.body) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.error || `Server error: ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith("data:")) continue;
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let payload;
        try {
          payload = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (payload.error) {
          throw new Error(payload.error);
        }
        if (payload.token) {
          fullText += payload.token;
          bubble.innerHTML = renderMarkdown(fullText);
          decorateCodeBlocks(messagesEl);
          scrollToBottom();
        }
        if (payload.done) {
        }
      }
    }

    if (!fullText.trim()) {
      fullText = "_Tidak ada respons dari model._";
      bubble.innerHTML = renderMarkdown(fullText);
    }
  } catch (err) {
    fullText = `⚠️ Terjadi kesalahan: ${err.message || "tidak bisa menghubungi server."}`;
    bubble.innerHTML = renderMarkdown(fullText);
  } finally {
    conv.messages.push({ role: "assistant", content: fullText });
    saveState();
    setSending(false);
  }
}

function setSending(isSending) {
  const sendBtn = document.getElementById("sendBtn");
  const input = document.getElementById("messageInput");
  sendBtn.disabled = isSending;
  input.disabled = isSending;
}

function openMobileSidebar() {
  document.getElementById("sidebar").classList.add("open");
}
function closeMobileSidebar() {
  document.getElementById("sidebar").classList.remove("open");
}

function autoGrowTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

function init() {
  loadState();

  if (state.conversations.length === 0) {
    createConversation();
  } else if (!state.activeId) {
    state.activeId = state.conversations[0].id;
  }

  renderSidebar();
  renderConversation();

  document.getElementById("newChatBtn").addEventListener("click", () => {
    createConversation();
    closeMobileSidebar();
  });

  document.getElementById("clearChatBtn").addEventListener("click", () => {
    const conv = getActiveConv();
    if (!conv) return;
    if (confirm("Hapus semua pesan di obrolan ini?")) {
      conv.messages = [];
      conv.title = "Obrolan baru";
      saveState();
      renderSidebar();
      renderConversation();
    }
  });

  document.getElementById("openSidebarBtn").addEventListener("click", openMobileSidebar);
  document.getElementById("closeSidebarBtn").addEventListener("click", closeMobileSidebar);
  document.getElementById("sidebarOverlay").addEventListener("click", closeMobileSidebar);

  const form = document.getElementById("composerForm");
  const input = document.getElementById("messageInput");

  input.addEventListener("input", () => autoGrowTextarea(input));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    autoGrowTextarea(input);
    sendMessage(text);
  });

  document.querySelectorAll(".sugg-card").forEach((card) => {
    card.addEventListener("click", () => {
      const prompt = card.dataset.prompt;
      input.value = prompt;
      form.requestSubmit();
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
