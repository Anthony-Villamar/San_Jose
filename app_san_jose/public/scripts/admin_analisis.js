document.addEventListener('DOMContentLoaded', async () => {
  // Obtener datos del usuario logueado
  let usuario;
  try {
    const res = await fetch('/api/login/me', { credentials: 'include' });
    if (!res.ok) throw new Error('No logueado');
    usuario = await res.json();
  } catch {
    alert('No ha iniciado sesión correctamente.');
    window.location.href = "/";
    return;
  }
});

document.getElementById("btn-filtrar").addEventListener("click", async () => {
  const inicio = document.getElementById("fecha-inicio").value;
  const fin = document.getElementById("fecha-fin").value;
  const area = document.getElementById("area").value;

  if (!inicio || !fin) {
    alert("Selecciona fechas de inicio y fin");
    return;
  }

  try {
    const res = await fetch(`/api/estadisticas/calendario?inicio=${inicio}&fin=${fin}&area=${area}`);
    if (!res.ok) throw new Error("Error al obtener datos");
    const data = await res.json();

    renderRadarCalendar(data, inicio, fin);
  } catch (err) {
    console.error(err);
    alert("No se pudieron cargar los datos");
  }
});


function renderRadarCalendar(data, inicio, fin) {
  const container = document.getElementById("radar-calendar");
  container.innerHTML = "";

  // Obtener lista de meses en el rango
  const startDate = new Date(inicio);
  const endDate = new Date(fin);

  // Asegurarse de que startDate sea el primer día del mes
  startDate.setDate(1);
  let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1); // Primer día del mes de inicio

  // Iterar por cada mes en el rango
  while (current <= endDate) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    // Filtrar datos para este mes
    const monthData = data.filter(d => {
      const day = new Date(d.dia);
      return day >= monthStart && day <= monthEnd;
    });

    // Crear un div para este mes
    const monthDiv = document.createElement("div");
    monthDiv.style.width = "100%";
    // monthDiv.style.height = "1000px";
    // monthDiv.style.maxWidth = "1200px"; // opcional, límite para que no se estire demasiado
    monthDiv.style.margin = "0 auto";
    monthDiv.style.marginBottom = "20px";
    container.appendChild(monthDiv);

    // Renderizar el calendario de este mes
    renderSingleMonth(monthDiv, monthData, monthStart, monthEnd);

    // Avanzar al siguiente mes
    current.setMonth(current.getMonth() + 1);
  }
}

function renderSingleMonth(dom, data, inicio, fin) {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function weeksInMonth(d) {
    const first = new Date(d.getFullYear(), d.getMonth(), 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const firstDow = (first.getDay() + 6) % 7;
    return Math.ceil((firstDow + last.getDate()) / 7);
  }

  function metrics() {
    const w = dom.clientWidth || window.innerWidth;
    const padX = 24;
    let cellW = Math.floor((w - padX * 2) / 7);
    cellW = clamp(cellW, 40, 140);
    const rows = weeksInMonth(inicio);
    const font = Math.max(10, Math.floor(cellW * 0.18));
    const header = 64;                         // espacio de título
    const legendSpace = clamp(Math.round(font * 2), 20, 36); // debajo del calendario
    const h = header + rows * cellW + legendSpace + 10;      // alto total contenedor
    const pieR = Math.floor(cellW * 0.36);
    return { cellW, rows, font, header, legendSpace, pieR, h };
  }

  const monthTitle = inicio.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase());

  let M = metrics();
  dom.style.height = M.h + 'px';

  const chart = echarts.init(dom);
  const scatterData = data.map(d => [d.dia.split('T')[0], 1]);

  const pies = data.map((d, i) => ({
    type: 'pie',
    id: 'pie-' + i,
    center: [d.dia.split('T')[0], 1],
    radius: M.pieR,
    coordinateSystem: 'calendar',
    label: { formatter: '{c}', position: 'inside', fontSize: Math.max(9, M.font - 2) },
    data: [
      { name: 'Puntualidad', value: +d.puntualidad },
      { name: 'Trato', value: +d.trato },
      { name: 'Resolución', value: +d.resolucion }
    ]
  }));

  chart.setOption({
    title: { text: monthTitle, left: 'center', top: 10, textStyle: { fontSize: Math.max(12, M.font + 2) } },
    tooltip: { confine: true, formatter: p => p.seriesType === 'pie' ? `${p.name}: ${p.value}` : p.value[0] },
    legend: {
      data: ['Puntualidad', 'Trato', 'Resolución'],
      bottom: 8,
      itemGap: 14,
      itemWidth: 16,
      itemHeight: 10,
      padding: 0,
      textStyle: { fontSize: Math.max(9, M.font - 2) }
    },
    calendar: {
      top: 50,
      left: 'center',
      orient: 'vertical',
      cellSize: [M.cellW, M.cellW],
      splitLine: { show: true, lineStyle: { color: '#e5ecf6' } },
      yearLabel: { show: false }, monthLabel: { show: false, nameMap: 'es' }, dayLabel: { show: true, nameMap: ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'], firstDay: 1, fontSize: Math.max(9, M.font - 2), color: '#64748b' },
      bottom: M.legendSpace,      // <-- clave: acercar calendario a la leyenda
      range: [inicio, fin]
    },
    series: [
      {
        id: 'label',
        type: 'scatter',
        coordinateSystem: 'calendar',
        symbolSize: 0,
        label: {
          show: true,
          align: 'left',
          verticalAlign: 'top',
          formatter: p => p.value[0].split('-')[2],
          offset: [-(M.cellW / 2) + 6, -(M.cellW / 2) + 6],
          fontSize: Math.max(11, M.font)
        },
        data: scatterData
      },
      ...pies
    ]
  });

  const ro = new ResizeObserver(() => {
    M = metrics();
    dom.style.height = M.h + 'px';
    chart.setOption({
      legend: { textStyle: { fontSize: Math.max(9, M.font - 2) } },
      calendar: { cellSize: [M.cellW, M.cellW], bottom: M.legendSpace },
      series: [
        { id: 'label', label: { offset: [-(M.cellW / 2) + 6, -(M.cellW / 2) + 6], fontSize: Math.max(11, M.font) } },
        ...data.map((_, i) => ({ id: 'pie-' + i, radius: M.pieR, label: { fontSize: Math.max(9, M.font - 2) } }))
      ]
    });
    chart.resize();
  });
  ro.observe(dom);
  window.addEventListener('resize', () => chart.resize(), { passive: true });
}

document.getElementById("btn-reporte").addEventListener("click", () => {
  const inicio = document.getElementById("fecha-inicio").value;
  const fin = document.getElementById("fecha-fin").value;
  const area = document.getElementById("area").value;

  if (!inicio || !fin) return alert("Selecciona fechas");

  const url = `/api/reportes/calificaciones/pdf?inicio=${inicio}&fin=${fin}&area=${area}`;

  const iframe = document.getElementById("pdf-preview");
  iframe.src = url;

  document.getElementById("preview-container").style.display = "block";

  document.getElementById("btn-descargar").onclick = () => {
    window.open(url, "_blank");
  };
});

document.getElementById("btn-regenerar").addEventListener("click", () => {
  // document.getElementById("preview-container").style.display = "none";
  const inicio = document.getElementById("fecha-inicio").value;
  const fin = document.getElementById("fecha-fin").value;
  const area = document.getElementById("area").value;

  if (!inicio || !fin) return alert("Selecciona fechas");

  const url = `/api/reportes/calificaciones/pdf?inicio=${inicio}&fin=${fin}&area=${area}`;

  const iframe = document.getElementById("pdf-preview");
  iframe.src = url;

  document.getElementById("preview-container").style.display = "block";

  document.getElementById("btn-descargar").onclick = () => {
    window.open(url, "_blank");
  };
});


// function renderSingleMonth(dom, data, inicio, fin) {
//   // --- helpers responsivos ---
//   const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

//   // cuántas filas (semanas) ocupa ese mes (5 o 6 normalmente)
//   function weeksInMonth(d1, d2) {
//     const first = new Date(d1.getFullYear(), d1.getMonth(), 1);
//     const last  = new Date(d1.getFullYear(), d1.getMonth() + 1, 0);
//     const firstDow = (first.getDay() + 6) % 7; // L=0..D=6 (formato ISO)
//     const days = last.getDate();
//     return Math.ceil((firstDow + days) / 7);
//   }

//   function metrics() {
//     const w = dom.clientWidth || window.innerWidth;
//     // ancho útil para 7 días con márgenes internos
//     const padX = 24; // padding/márgen visual
//     let cellW = Math.floor((w - padX * 2) / 7);
//     cellW = clamp(cellW, 40, 140);         // nunca más chico de 40px ni más grande de 140px
//     const pieR = Math.floor(cellW * 0.36); // radio pie proporcional a celda
//     const font  = Math.max(10, Math.floor(cellW * 0.18));
//     const rows  = weeksInMonth(inicio, fin);
//     const header = 64;                     // espacio para año/mes
//     const h = header + rows * cellW + 24;  // alto total del chart
//     return { cellW, pieR, font, h };
//   }
//    // ---- NUEVO: título "Mes Año" ----
//   const monthTitle =
//     inicio.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
//           .replace(/^\w/, c => c.toUpperCase());

//   let M = metrics();
//   dom.style.height = M.h + "px";

//   const myChart = echarts.init(dom);
//   myChart.clear();

//   const scatterData = data.map(d => [d.dia.split("T")[0], 1]);

//   // series pie por día, con radio proporcional
//   const pieSeries = data.map((d, idx) => ({
//     type: "pie",
//     id: "pie-" + idx,
//     center: [d.dia.split("T")[0], 1],
//     radius: M.pieR,
//     coordinateSystem: "calendar",
//     label: { formatter: "{c}", position: "inside", fontSize: Math.max(9, M.font - 2) },
//     data: [
//       { name: "Puntualidad", value: +d.puntualidad },
//       { name: "Trato",       value: +d.trato },
//       { name: "Resolución",  value: +d.resolucion }
//     ]
//   }));

//   myChart.setOption({
//         title: { text: monthTitle, left: "center", top: 10, textStyle: { fontSize: Math.max(12, M.font + 2) } },

//     tooltip: { confine: true, formatter: p => p.seriesType === "pie" ? `${p.name}: ${p.value}` : p.value[0] },
//     legend: {
//       data: ["Puntualidad", "Trato", "Resolución"],
//       bottom: 6,
//       textStyle: { fontSize: Math.max(9, M.font - 2) }
//     },
//     calendar: {
//       top: 50,
//       left: "center",
//       orient: "vertical",
//       cellSize: [M.cellW, M.cellW],      // ← tamaño real por día
//       splitLine: { show: true, lineStyle: { color: "#e5ecf6" } },
//       yearLabel:  { show: false, fontSize: Math.max(12, M.font), color: "#000", margin: 6 },
//       monthLabel: { show: false, nameMap: "es", fontSize: Math.max(12, M.font), color: "#000", margin: 6 },
//       dayLabel:   { show: false },
//       range: [inicio, fin]
//     },
//     series: [
//       {
//         id: "label",
//         type: "scatter",
//         coordinateSystem: "calendar",
//         symbolSize: 0,
//         label: {
//           show: true,
//           align: "left",
//           verticalAlign: "top",
//           // número del día en esquina superior izquierda de la celda
//           formatter: p => p.value[0].split("-")[2],
//           offset: [-(M.cellW / 2) + 6, -(M.cellW / 2) + 6],
//           fontSize: Math.max(11, M.font)
//         },
//         data: scatterData
//       },
//       ...pieSeries
//     ]
//   });

//   // re-cálculo real al cambiar tamaño del contenedor
//   const ro = new ResizeObserver(() => {
//     M = metrics();
//     dom.style.height = M.h + "px";
//     // actualizar cellSize, fuentes y radios sin reconstruir todo
//     myChart.setOption({
//       legend: { textStyle: { fontSize: Math.max(9, M.font - 2) } },
//       calendar: { cellSize: [M.cellW, M.cellW] },
//       series: [
//         {
//           id: "label",
//           label: {
//             offset: [-(M.cellW / 2) + 6, -(M.cellW / 2) + 6],
//             fontSize: Math.max(11, M.font)
//           }
//         },
//         ...data.map((d, idx) => ({
//           id: "pie-" + idx,
//           radius: M.pieR,
//           label: { fontSize: Math.max(9, M.font - 2) }
//         }))
//       ]
//     });
//     myChart.resize();
//   });
//   ro.observe(dom);

//   window.addEventListener("resize", () => myChart.resize(), { passive: true });
// }

