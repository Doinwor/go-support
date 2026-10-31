/* ============================================================
   GO Support — лента, форма и страница обращения
   ============================================================ */
(() => {
  "use strict";

  /* ------------------------------------------------------------------
     НАСТРОЙКА ФОРМЫ
     Когда Google Form будет готова, вставьте её embed-ссылку сюда.
     Пример:
     const FORM_EMBED_URL =
       "https://docs.google.com/forms/d/e/1FAIpQLS.../viewform?embedded=true";
     Пока строка пустая — на странице create.html показывается заглушка.
     ------------------------------------------------------------------ */
  const FORM_EMBED_URL = "";

  const STATUS = {
    open: { label: "Открыто", cls: "badge-open" },
    answered: { label: "Отвечено", cls: "badge-answered" },
    closed: { label: "Закрыто", cls: "badge-closed" },
  };

  const FILTERS = [
    { value: "all", label: "Все" },
    { value: "open", label: "Открытые" },
    { value: "answered", label: "Отвеченные" },
    { value: "closed", label: "Закрытые" },
  ];

  const state = {
    query: "",
    status: "all",
    project: "all",
  };

  let tickets = [];
  let fuse = null;

  const $ = (selector, root = document) => root.querySelector(selector);

  /* ---------------- Утилиты ---------------- */

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function fmtDate(value, long = false) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleString("ru-RU", long
      ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
      : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function initial(name) {
    const chars = Array.from(String(name || "").trim());
    return chars.length ? chars[0].toUpperCase() : "?";
  }

  function shortProject(ticket) {
    const label = String(ticket.project_label || "").trim();
    if (!label) return "Без проекта";
    return label.split(" / ")[0].trim() || "Без проекта";
  }

  function statusOf(value) {
    return STATUS[value] || STATUS.open;
  }

  function safeUrl(value) {
    if (!value) return "";
    try {
      const url = new URL(String(value), window.location.href);
      if (url.protocol !== "http:" && url.protocol !== "https:") return "";
      return url.href;
    } catch {
      return "";
    }
  }

  async function loadJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  }

  function avatarHtml(url, name, className) {
    const safe = safeUrl(url);
    const letter = esc(initial(name));
    const image = safe
      ? `<img src="${esc(safe)}" alt="" loading="lazy" onerror="this.remove()">`
      : "";
    return `<span class="${className}"><span class="avatar-letter" aria-hidden="true">${letter}</span>${image}</span>`;
  }

  function setYear() {
    const year = $("#year");
    if (year) year.textContent = String(new Date().getFullYear());
  }

  /* ---------------- Главная страница ---------------- */

  function renderStatusFilters() {
    const host = $("#status-filters");
    if (!host) return;

    host.innerHTML = FILTERS.map((filter) => {
      const active = state.status === filter.value;
      return `<button type="button" class="filter-pill${active ? " is-active" : ""}"
        data-status="${filter.value}" aria-pressed="${active}">${filter.label}</button>`;
    }).join("");

    host.onclick = (event) => {
      const button = event.target.closest("[data-status]");
      if (!button) return;
      state.status = button.dataset.status;
      renderStatusFilters();
      renderFeed();
    };
  }

  function ticketCard(ticket) {
    const status = statusOf(ticket.status);
    const project = shortProject(ticket);

    return `
      <a class="ticket-card" href="ticket.html?id=${encodeURIComponent(ticket.id)}">
        <div class="card-top">
          <span class="badge ${status.cls}"><span class="badge-dot"></span>${status.label}</span>
          <span class="badge badge-project">${esc(project)}</span>
          <time class="card-date" datetime="${esc(ticket.date)}">${esc(fmtDate(ticket.date))}</time>
        </div>
        <h2 class="card-title">${esc(ticket.title || "Без темы")}</h2>
        <p class="card-excerpt clamp-2">${esc(ticket.excerpt || "")}</p>
        <div class="card-footer">
          ${avatarHtml(null, ticket.author, "avatar")}
          <span class="card-author">${esc(ticket.author || "Аноним")}</span>
          <span class="card-dot" aria-hidden="true">•</span>
          <span class="card-id">#${esc(ticket.id)}</span>
          <span class="card-cta">
            Читать
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </span>
        </div>
      </a>`;
  }

  function visibleTickets() {
    let list = tickets;

    if (state.query) {
      if (fuse) {
        list = fuse.search(state.query).map((result) => result.item);
      } else {
        const q = state.query.toLowerCase();
        list = tickets.filter((ticket) =>
          `${ticket.title || ""} ${ticket.excerpt || ""} ${ticket.author || ""}`
            .toLowerCase()
            .includes(q));
      }
    }

    return list.filter((ticket) => {
      if (state.status !== "all" && ticket.status !== state.status) return false;
      if (state.project !== "all" && shortProject(ticket) !== state.project) return false;
      return true;
    });
  }

  function renderFeed() {
    const feed = $("#feed");
    const empty = $("#empty");
    const count = $("#count");
    if (!feed) return;

    const list = visibleTickets();
    if (count) count.textContent = `${list.length} из ${tickets.length}`;

    if (!list.length) {
      feed.innerHTML = "";
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    feed.innerHTML = list.map(ticketCard).join("");
  }

  function fillProjectFilter() {
    const select = $("#project-filter");
    if (!select) return;

    const projects = [...new Set(tickets.map(shortProject))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ru"));

    select.innerHTML = `<option value="all">Все проекты</option>` +
      projects.map((project) =>
        `<option value="${esc(project)}">${esc(project)}</option>`).join("");

    select.onchange = () => {
      state.project = select.value;
      renderFeed();
    };
  }

  async function initIndex() {
    const search = $("#search");
    const feed = $("#feed");
    const empty = $("#empty");

    renderStatusFilters();

    try {
      const data = await loadJson("data/index.json");
      const items = Array.isArray(data) ? data : (data.tickets || []);

      tickets = items
        .map((ticket) => ({
          id: ticket.id || "",
          author: ticket.author || "Аноним",
          title: ticket.title || "Без темы",
          project_label: ticket.project_label || "",
          scope: ticket.scope || "",
          date: ticket.date || "",
          status: ticket.status || "open",
          excerpt: ticket.excerpt || "",
        }))
        .filter((ticket) => ticket.id)
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    } catch (error) {
      if (feed) {
        feed.innerHTML = `
          <div class="state-box is-error">
            <h2>Не удалось загрузить обращения</h2>
            <p>Проверьте соединение и попробуйте ещё раз.</p>
            <button type="button" class="btn-ghost" id="retry">Повторить</button>
          </div>`;
      }
      if (empty) empty.hidden = true;
      const retry = $("#retry");
      if (retry) retry.addEventListener("click", () => window.location.reload());
      return;
    }

    if (typeof window.Fuse !== "undefined") {
      fuse = new window.Fuse(tickets, {
        keys: [
          { name: "title", weight: 0.55 },
          { name: "excerpt", weight: 0.3 },
          { name: "author", weight: 0.15 },
        ],
        threshold: 0.34,
        ignoreLocation: true,
        minMatchCharLength: 2,
      });
    }

    fillProjectFilter();

    if (search) {
      search.addEventListener("input", () => {
        state.query = search.value.trim();
        renderFeed();
      });

      const kbd = $(".search-kbd");
      if (kbd && /Mac|iPhone|iPad/.test(navigator.platform)) {
        kbd.textContent = "⌘ K";
      }

      document.addEventListener("keydown", (event) => {
        const tag = (event.target.tagName || "").toLowerCase();
        const typing = tag === "input" || tag === "textarea" || tag === "select" ||
          event.target.isContentEditable;

        if ((event.ctrlKey || event.metaKey) && (event.key === "k" || event.key === "K")) {
          event.preventDefault();
          search.focus();
          search.select();
        } else if (event.key === "/" && !typing) {
          event.preventDefault();
          search.focus();
        }
      });
    }

    renderFeed();
  }

  /* ---------------- Страница формы ---------------- */

  function initCreate() {
    const frame = $("#form-frame");
    const placeholder = $("#form-placeholder");
    const actions = $("#form-actions");
    const openLink = $("#form-open");

    if (!frame) return;

    const url = safeUrl(FORM_EMBED_URL);
    if (!url) return;

    if (placeholder) placeholder.hidden = true;
    if (actions) actions.hidden = false;
    frame.hidden = false;
    frame.src = url;

    if (openLink) {
      try {
        const external = new URL(url);
        external.searchParams.delete("embedded");
        openLink.href = external.toString();
      } catch {
        openLink.href = url;
      }
    }
  }

  /* ---------------- Страница обращения ---------------- */

  function errorState(message) {
    return `
      <div class="state-box is-error">
        <div class="state-icon" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v5M12 16.5v.5"/>
          </svg>
        </div>
        <h2>Обращение не найдено</h2>
        <p>${esc(message || "Возможно, ссылка устарела или заявка ещё не опубликована.")}</p>
        <a class="btn-ghost" href="index.html">Вернуться к списку</a>
      </div>`;
  }

  function screenshotBlock(ticket) {
    const url = safeUrl(ticket.screenshot);
    if (!url) return "";

    return `
      <a class="shot-link" href="${esc(url)}" target="_blank" rel="noopener nofollow">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="m21 15-5-5L5 21"/>
        </svg>
        Открыть скриншот
      </a>`;
  }

  function adminReplyBlock(ticket) {
    const reply = ticket.admin_reply;
    const hasReply = reply && String(reply.text || "").trim();

    if (!hasReply) {
      const text = ticket.status === "closed"
        ? "Обращение закрыто без ответа."
        : "Ответ появится здесь после обработки обращения.";
      return `<div class="reply-empty">${text}</div>`;
    }

    const name = reply.admin_name || "Администрация";
    return `
      <div class="reply-card">
        <div class="reply-head">
          ${avatarHtml(reply.admin_avatar, name, "reply-avatar")}
          <div>
            <div class="reply-name">${esc(name)}</div>
            <time class="reply-date" datetime="${esc(reply.date)}">${esc(fmtDate(reply.date, true))}</time>
          </div>
        </div>
        <div class="reply-text">${esc(reply.text)}</div>
      </div>`;
  }

  async function initTicket() {
    const root = $("#ticket");
    if (!root) return;

    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
      root.innerHTML = errorState("В ссылке не указан идентификатор обращения.");
      return;
    }

    let ticket;
    try {
      ticket = await loadJson(`data/tickets/${encodeURIComponent(id)}.json`);
    } catch (error) {
      root.innerHTML = errorState(error.message);
      return;
    }

    document.title = `${ticket.title || "Обращение"} — GO Support`;

    const status = statusOf(ticket.status);
    const projectLabel = ticket.project_label || shortProject(ticket);
    const project = shortProject(ticket);

    root.innerHTML = `
      <article class="detail-card">
        <div class="detail-head">
          <span class="badge ${status.cls}"><span class="badge-dot"></span>${status.label}</span>
          <span class="badge badge-project">${esc(project)}</span>
          <time class="card-date" datetime="${esc(ticket.date)}">${esc(fmtDate(ticket.date))}</time>
        </div>

        <h1 class="detail-title">${esc(ticket.title || "Без темы")}</h1>

        <div class="detail-meta">
          <span class="meta-author">
            ${avatarHtml(null, ticket.author, "avatar")}
            <span>${esc(ticket.author || "Аноним")}</span>
          </span>
          <span class="meta-item">${esc(projectLabel)}</span>
          <span class="meta-item">#${esc(ticket.id || id)}</span>
        </div>

        <div class="ticket-text">${esc(ticket.text || "")}</div>
        ${screenshotBlock(ticket)}
      </article>

      <section class="reply-section">
        <h2 class="section-title">Ответ администрации</h2>
        ${adminReplyBlock(ticket)}
      </section>`;
  }

  /* ---------------- Запуск ---------------- */

  document.addEventListener("DOMContentLoaded", () => {
    setYear();

    const page = document.body.dataset.page;
    if (page === "index") initIndex();
    else if (page === "create") initCreate();
    else if (page === "ticket") initTicket();
  });
})();
