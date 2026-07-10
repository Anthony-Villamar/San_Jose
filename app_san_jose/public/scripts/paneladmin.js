const sidebarToggleBtns = document.querySelectorAll(".sidebar-toggle");
const sidebar = document.querySelector(".sidebar");
const searchForm = document.querySelector(".search-form");
const themeToggleBtn = document.querySelector(".theme-toggle");
const themeIcon = themeToggleBtn.querySelector(".theme-icon");
const menuLinks = document.querySelectorAll(".menu-link");
// Updates the theme icon based on current theme and sidebar state
const updateThemeIcon = () => {
  const isDark = document.body.classList.contains("dark-theme");
  themeIcon.textContent = sidebar.classList.contains("collapsed") ? (isDark ? "light_mode" : "dark_mode") : "dark_mode";

  const headerLogo= document.querySelector('.header-logo');
  if (isDark) {
    headerLogo.src = "../images/logo2.svg"; // Logo for dark theme
  } else {
    headerLogo.src = "../images/logo2.png"; // Logo for light theme
  }
};
// Apply dark theme if saved or system prefers, then update icon
const savedTheme = localStorage.getItem("theme");
const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
const shouldUseDarkTheme = savedTheme === "dark" || (!savedTheme && systemPrefersDark);
document.body.classList.toggle("dark-theme", shouldUseDarkTheme);
updateThemeIcon();
// Toggle between themes on theme button click
themeToggleBtn.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-theme");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeIcon();
});
// Toggle sidebar collapsed state on buttons click
sidebarToggleBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    sidebar.classList.toggle("collapsed");
    updateThemeIcon();
  });
});
// Expand the sidebar when the search form is clicked
searchForm.addEventListener("click", () => {
  if (sidebar.classList.contains("collapsed")) {
    sidebar.classList.remove("collapsed");
    searchForm.querySelector("input").focus();
  }
});
// Expand sidebar by default on large screens
if (window.innerWidth > 768) sidebar.classList.remove("collapsed");

// Highlight the active menu link based on current URL
const currentPath = window.location.pathname.split("/").pop();
menuLinks.forEach((link) => {
  const linkPath = link.getAttribute("href");
  //optimize for localhost vs deployed paths
  if (linkPath === "./" + currentPath) {
    link.classList.add("active");
  } else {
    link.classList.remove("active");
  }
});

//  Dashboard
if (document.getElementById("kpiContainer")) {
  (async () => {
    try {
      const [resumen, porArea, porDia, top] = await Promise.all([
        fetch("/api/estadisticas/resumen",        { credentials: "include" }).then(r => r.json()),
        fetch("/api/estadisticas/por-area",       { credentials: "include" }).then(r => r.json()),
        fetch("/api/estadisticas/por-dia-semana", { credentials: "include" }).then(r => r.json()),
        fetch("/api/estadisticas/top3",           { credentials: "include" }).then(r => r.json()),
      ]);
      _renderKPIs(resumen);
      _renderAreaChart(porArea);
      _renderDiaSemana(porDia);
      const cont = document.getElementById("top3Container");
      if (cont) _renderTop3(cont, top);
    } catch (err) {
      console.error("Error dashboard:", err);
    }
  })();
}

//  KPIs 
function _renderKPIs(r) {
  const container = document.getElementById("kpiContainer");
  if (!container) return;
  const nc   = v => v >= 2.4 ? "#16a34a" : v >= 1.8 ? "#f59e0b" : "#dc2626";
  const npct = v => v >= 90  ? "#16a34a" : v >= 75  ? "#f59e0b" : "#dc2626";
  const cards = [
    { icon: "today",              label: "ATENCIONES HOY",  value: r.total_hoy,                sub: "registradas hoy",             accent: "#2563eb"              },
    { icon: "calendar_month",     label: "ESTE MES",         value: r.total_mes,                sub: "atenciones en el mes",        accent: "#7c3aed"              },
    { icon: "star",               label: "PROMEDIO MES",     value: `${r.promedio_mes ?? 0}%`,  sub: "índice general",              accent: npct(r.promedio_mes),  small: false },
    { icon: "schedule",           label: "ATEND. A TIEMPO",  value: `${r.pct_a_tiempo ?? 0}%`, sub: "puntualidad ≥ Adecuado",      accent: npct(r.pct_a_tiempo),  small: false },
    { icon: "task_alt",           label: "FCR",              value: `${r.pct_fcr  ?? 0}%`,     sub: "resolución en 1ª atención",   accent: npct(r.pct_fcr),       small: false },
    { icon: "sentiment_satisfied",label: "CSAT",             value: `${r.pct_csat ?? 0}%`,     sub: "satisfacción general",        accent: npct(r.pct_csat),      small: false },
    { icon: "emoji_events",       label: "ÁREA DESTACADA",   value: r.mejor_area ?? "—",        sub: `${r.mejor_area_promedio ?? 0}%`, accent: "#f59e0b",        small: true  }
  ];
  container.innerHTML = cards.map(c => `
    <div class="kpi-card" style="border-left-color:${c.accent}">
      <div class="kpi-top">
        <span class="kpi-label">${c.label}</span>
        <span class="material-symbols-rounded kpi-icon" style="color:${c.accent}">${c.icon}</span>
      </div>
      <div class="kpi-value${c.small ? ' kpi-value-sm' : ''}" style="color:${c.accent}">${c.value}</div>
      <div class="kpi-sub">${c.sub}</div>
    </div>
  `).join("");
}

// Comparativa por área 
function _renderAreaChart(data) {
  const ctx = document.getElementById("areaChart")?.getContext("2d");
  if (!ctx || !data.length) return;
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d.nombre_area),
      datasets: [
        { label: "% A Tiempo", data: data.map(d => d.pct_a_tiempo), backgroundColor: "#2563eb", borderRadius: 4 },
        { label: "FCR",        data: data.map(d => d.pct_fcr),      backgroundColor: "#16a34a", borderRadius: 4 },
        { label: "CSAT",       data: data.map(d => d.pct_csat),     backgroundColor: "#f59e0b", borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { font: { size: 11 } } } },
      scales: {
        y: { beginAtZero: true, max: 100, ticks: { stepSize: 20, callback: v => v + "%" }, grid: { color: "rgba(0,0,0,0.05)" } },
        x: { grid: { display: false } }
      }
    }
  });
}

//  Día de semana 
function _renderDiaSemana(data) {
  const ctx = document.getElementById("diaSemanaChart")?.getContext("2d");
  if (!ctx) return;
  const maxV   = Math.max(...data.map(d => d.total));
  const colors = data.map(d => d.total === maxV && d.total > 0 ? "#2563eb" : "rgba(37,99,235,0.3)");
  new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => d.dia),
      datasets: [{ label: "Atenciones", data: data.map(d => d.total),
        backgroundColor: colors, borderRadius: 6, maxBarThickness: 60 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${c.raw} atenciones` } }
      },
      scales: {
        y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: "rgba(0,0,0,0.05)" } },
        x: { grid: { display: false }, ticks: { font: { size: 12, weight: "600" } } }
      }
    }
  });
}

// Top 3 
const _top3Container = document.getElementById("top3Container");
if (_top3Container) { /* cargado arriba junto al resto del dashboard */ }

const _medals      = ["1", "2", "3"];
const _rankColors  = ["#f59e0b", "#9ca3af", "#b45309"];
const _metricCols  = ["#2563eb", "#16a34a", "#f59e0b"];

function _initials(nombre, apellido) {
  return ((nombre?.[0] ?? "") + (apellido?.[0] ?? "")).toUpperCase();
}

function _avatarHTML(nombre, apellido, color, size = 76) {
  return `<div class="top3-avatar" style="background:${color};width:${size}px;height:${size}px;">
    <span>${_initials(nombre, apellido)}</span>
  </div>`;
}

function _metricBar(label, value, color) {
  return `
    <div class="modal-metric-row">
      <span class="modal-metric-name">${label}</span>
      <div class="modal-metric-track">
        <div class="modal-metric-fill" style="width:${value}%;background:${color};"></div>
      </div>
      <span class="modal-metric-val" style="color:${color}">${value}%</span>
    </div>`;
}

function _renderTop3(container, top) {
  container.innerHTML = "";
  top.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = `top3-card rank-${i + 1}`;
    card.innerHTML = `
      <div class="top3-avatar-wrap">
        ${_avatarHTML(p.nombre, p.apellido, _rankColors[i])}
        <span class="top3-medal">${_medals[i]}</span>
      </div>
      <p class="top3-name">${p.nombre} ${p.apellido}</p>
      ${p.rol ? `<span class="top3-rol">${p.rol}</span>` : ""}
      <div class="top3-avg">
        <span class="avg-big">${p.promedio_pct}</span>
        <span class="avg-sub">%</span>
      </div>
      <span class="top3-hint">Toca para ver detalles</span>
    `;
    card.addEventListener("click", () => _openModal(p, i));
    container.appendChild(card);
  });
}

let _modalChart = null;

function _openModal(p, i) {
  const modal = document.getElementById("top3Modal");
  const body  = document.getElementById("modalBody");

  body.innerHTML = `
    <div class="modal-header">
      ${_avatarHTML(p.nombre, p.apellido, _rankColors[i], 72).replace("top3-avatar", "modal-avatar")}
      <div class="modal-title-info">
        <h3>${p.nombre} ${p.apellido}</h3>
        ${p.rol ? `<span class="modal-rol-badge">${p.rol}</span>` : ""}
        <span class="modal-medal" style="background:${_rankColors[i]};color:#fff;font-size:0.7rem;font-weight:800;border-radius:50%;width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;">${_medals[i]}</span>
      </div>
    </div>
    <div class="modal-avg-banner">
      <span>Promedio general</span>
      <strong>${p.promedio_pct} <small>%</small></strong>
    </div>
    <div class="modal-chart-wrap">
      <canvas id="radarModalChart"></canvas>
    </div>
    <div class="modal-metrics">
      ${_metricBar("% A Tiempo", p.pct_a_tiempo, _metricCols[0])}
      ${_metricBar("FCR",        p.pct_fcr,      _metricCols[1])}
      ${_metricBar("CSAT",       p.pct_csat,     _metricCols[2])}
    </div>
  `;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  if (_modalChart) { _modalChart.destroy(); _modalChart = null; }
  _modalChart = new Chart(
    document.getElementById("radarModalChart").getContext("2d"),
    {
      type: "radar",
      data: {
        labels: ["% A Tiempo", "FCR", "CSAT"],
        datasets: [{
          data: [p.pct_a_tiempo, p.pct_fcr, p.pct_csat],
          backgroundColor: _rankColors[i] + "33",
          borderColor: _rankColors[i],
          pointBackgroundColor: _rankColors[i],
          borderWidth: 2,
          pointRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          r: {
            min: 0, max: 100,
            ticks: { stepSize: 20, callback: v => v + "%", font: { size: 10 } },
            pointLabels: { font: { size: 12, weight: "600" } }
          }
        }
      }
    }
  );
}

function _closeModal() {
  document.getElementById("top3Modal").style.display = "none";
  document.body.style.overflow = "";
  if (_modalChart) { _modalChart.destroy(); _modalChart = null; }
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("modalCloseBtn");
  const overlay  = document.getElementById("top3Modal");
  if (closeBtn) closeBtn.addEventListener("click", _closeModal);
  if (overlay)  overlay.addEventListener("click", e => { if (e.target === overlay) _closeModal(); });
});

// Logout
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/api/login/logout", {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (data.ok) {
        alert("Sesión cerrada correctamente.");
        window.location.href = "/";;
      } else {
        alert("No se pudo cerrar sesión: " + data.error);
      }
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
      alert("Error al conectar con el servidor.");
    }
  });
}