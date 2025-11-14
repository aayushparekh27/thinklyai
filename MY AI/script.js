document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  const app = document.querySelector(".app-container");

  // Loader animation
  setTimeout(() => {
    loader.style.display = "none";
    app.classList.remove("hidden");
  }, 2500);

  // Elements
  const sendBtn = document.getElementById("send-btn");
  const micBtn = document.getElementById("mic-btn");
  const summarizeBtn = document.getElementById("summarize-btn");
  const userInput = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");
  const newChatBtn = document.getElementById("new-chat");
  const chatList = document.getElementById("chat-list");
  const chatTitle = document.getElementById("chat-title");
  const exportBtn = document.getElementById("export-chat");
  const deleteBtn = document.getElementById("delete-chat");
  const themeBtn = document.getElementById("toggle-theme");
  const modal = document.getElementById("summarize-modal");
  const summaryInput = document.getElementById("summary-input");
  const runSummary = document.getElementById("run-summary");
  const closeSummary = document.getElementById("close-summary");

  const GEMINI_API_KEY = "Your Gemini API";
  const WEATHER_API_KEY = "Your Weather API";
  const NEWS_API_KEY = "your News API";

  // Memory reset on close
  let allChats = [];
  let currentChat = { id: Date.now(), title: "New Chat", messages: [] };

  renderChatList();

  // Events
  sendBtn.addEventListener("click", sendMessage);
  micBtn.addEventListener("click", recordVoice);
  summarizeBtn.addEventListener("click", () => modal.classList.remove("hidden"));
  runSummary.addEventListener("click", summarizeText);
  closeSummary.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(); });
  userInput.addEventListener("keydown", (e) => e.key === "Enter" && sendMessage());
  newChatBtn.addEventListener("click", createNewChat);
  exportBtn.addEventListener("click", exportChat);
  deleteBtn.addEventListener("click", deleteChat);
  themeBtn.addEventListener("click", toggleTheme);
  window.addEventListener("beforeunload", () => { allChats = []; });

  function renderChatList() {
    chatList.innerHTML = "";
    allChats.forEach(chat => {
      const div = document.createElement("div");
      div.classList.add("chat-item");
      div.textContent = chat.title;
      div.addEventListener("click", () => loadChat(chat.id));
      chatList.appendChild(div);
    });
  }

  function createNewChat() {
    currentChat = { id: Date.now(), title: "New Chat", messages: [] };
    chatBox.innerHTML = "";
    chatTitle.textContent = "Private Assistant";
    renderChatList();
  }

  function loadChat(id) {
    const chat = allChats.find(c => c.id === id);
    if (!chat) return;
    currentChat = chat;
    chatBox.innerHTML = "";
    chatTitle.textContent = chat.title;
    chat.messages.forEach(m => appendMessage(m.role, m.text));
  }

  function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `message ${role}`;
    div.innerHTML = text;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
    
    // Save to current chat
    currentChat.messages.push({ role, text });
  }

  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;
    appendMessage("user", text);
    userInput.value = "";

    if (currentChat.title === "New Chat") {
      currentChat.title = text.length > 25 ? text.slice(0, 25) + "..." : text;
      chatTitle.textContent = currentChat.title;
      allChats.push(currentChat);
      renderChatList();
    } else {
      currentChat.title = text.length > 25 ? text.slice(0, 25) + "..." : text;
      chatTitle.textContent = currentChat.title;
      renderChatList();
    }

    // Weather check
    if (text.toLowerCase().includes("weather in")) {
      const city = text.split("in")[1]?.trim() || "Delhi";
      await getWeather(city);
      return;
    }

    // News check
    if (text.toLowerCase().includes("news") || 
        text.toLowerCase().includes("latest") || 
        text.toLowerCase().includes("headlines") ||
        text.toLowerCase().includes("current affairs") ||
        text.toLowerCase().includes("what's happening")) {
      await getNews(text);
      return;
    }

    await callGemini(text);
  }

  async function callGemini(promptText) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          }),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join(" ") || "😅 No response";
      appendMessage("bot", reply);
    } catch (err) {
      appendMessage("bot", `<span style='color:red;'>Error: ${err.message}</span>`);
    }
  }

  async function getWeather(city) {
    try {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`
      );
      if (!res.ok) throw new Error("City not found");
      const data = await res.json();
      const msg = `🌦️ <b>${city}</b><br>Condition: ${data.weather[0].description}<br>Temp: ${data.main.temp}°C<br>Humidity: ${data.main.humidity}%<br>Wind: ${data.wind.speed} m/s`;
      appendMessage("bot", msg);
    } catch (err) {
      appendMessage("bot", `<span style='color:red;'>${err.message}</span>`);
    }
  }

  // Real-time News Function
  async function getNews(query) {
    try {
      let url = `https://gnews.io/api/v4/top-headlines?token=${NEWS_API_KEY}&lang=en&max=5`;
      
      // Agar specific topic pucha hai to
      if (query.toLowerCase().includes("sports")) {
        url += "&topic=sports";
      } else if (query.toLowerCase().includes("technology") || query.toLowerCase().includes("tech")) {
        url += "&topic=technology";
      } else if (query.toLowerCase().includes("business")) {
        url += "&topic=business";
      } else if (query.toLowerCase().includes("entertainment")) {
        url += "&topic=entertainment";
      } else if (query.toLowerCase().includes("health")) {
        url += "&topic=health";
      } else if (query.toLowerCase().includes("science")) {
        url += "&topic=science";
      }
      
      const res = await fetch(url);
      if (!res.ok) throw new Error("News fetch failed");
      
      const data = await res.json();
      
      if (!data.articles || data.articles.length === 0) {
        appendMessage("bot", "📰 Sorry, no news found right now. Try again later.");
        return;
      }
      
      let newsHTML = "📰 <b>Latest News</b><br><br>";
      
      data.articles.slice(0, 5).forEach((article, index) => {
        newsHTML += `
          <div class="news-item">
            <strong>${index + 1}. ${article.title}</strong><br>
            ${article.description ? `📝 ${article.description}<br>` : ''}
            <a href="${article.url}" target="_blank">Read full story</a><br>
            <small>📅 ${new Date(article.publishedAt).toLocaleDateString('en-IN')} | ${article.source.name}</small>
          </div>
        `;
      });
      
      newsHTML += `<br><small>Updated: ${new Date().toLocaleTimeString('en-IN')}</small>`;
      
      appendMessage("bot", newsHTML);
      
    } catch (err) {
      appendMessage("bot", `❌ News error: ${err.message}. Please try again later.`);
    }
  }

  function recordVoice() {
    if (!("webkitSpeechRecognition" in window)) return alert("Speech recognition not supported 😢");
    const recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.start();
    recognition.onresult = (e) => { userInput.value = e.results[0][0].transcript; sendMessage(); };
  }

  async function summarizeText() {
    const text = summaryInput.value.trim();
    if (!text) return alert("Please paste text!");
    appendMessage("user", "Summarize this text:");
    closeModal();
    await callGemini(`Summarize this clearly in 3–5 short points:\n${text}`);
  }

  function closeModal() {
    modal.classList.add("hidden");
    summaryInput.value = "";
  }

  function exportChat() {
    const text = currentChat.messages.map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n\n");
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${currentChat.title}.txt`;
    link.click();
  }

  function deleteChat() {
    if (!confirm("Delete this chat?")) return;
    allChats = allChats.filter(c => c.id !== currentChat.id);
    currentChat = { id: Date.now(), title: "New Chat", messages: [] };
    chatBox.innerHTML = "";
    chatTitle.textContent = "Private Assistant";
    renderChatList();
  }

  function toggleTheme() {
    document.body.classList.toggle("dark");
    themeBtn.textContent = document.body.classList.contains("dark") ? "☀️ Light" : "🌙 Dark";
  }

});
