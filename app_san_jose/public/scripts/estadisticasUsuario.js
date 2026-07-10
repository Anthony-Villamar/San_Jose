// DPR global — todos los Chart.js heredan la resolución correcta
if (typeof Chart !== 'undefined') {
  Chart.defaults.devicePixelRatio = window.devicePixelRatio || 2;
}

document.addEventListener('DOMContentLoaded', async () => {

  const spanAnio = document.getElementById('anio');
  if (spanAnio) spanAnio.textContent = new Date().getFullYear();

  // Sesión 
  let usuario;
  try {
    const res = await fetch('/api/login/me', { credentials: 'include' });
    if (!res.ok) throw new Error('No logueado');
    usuario = await res.json();
  } catch {
    alert('No ha iniciado sesión correctamente.');
    window.location.href = '/';
    return;
  }
  document.getElementById('nombreUsuario').textContent = usuario.usuario;

  // Tipo de filtro 
  const tipoFiltro  = document.getElementById('tipoFiltro');
  const filtroUnico = document.getElementById('filtroFechaUnica');
  const filtroRango = document.getElementById('filtroRangoFechas');

  tipoFiltro.addEventListener('change', () => {
    const esRango = tipoFiltro.value === 'rango';
    filtroUnico.style.display = esRango ? 'none'  : 'block';
    filtroRango.style.display = esRango ? 'block' : 'none';
  });

  // Cargar todo en paralelo 
  try {
    const [detalle, tendencia, comentarios, motivos] = await Promise.all([
      fetch('/api/estadisticas/detalle',         { credentials: 'include' }).then(r => r.json()),
      fetch('/api/estadisticas/mi-tendencia',    { credentials: 'include' }).then(r => r.json()),
      fetch('/api/estadisticas/mis-comentarios', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/estadisticas/mis-motivos',     { credentials: 'include' }).then(r => r.json()),
    ]);

    renderStatCards(detalle);
    renderDonuts(detalle);
    renderMotivos(motivos);
    renderTendenciaPersonal(tendencia);
    renderComentarios(comentarios);

    if (detalle.promedio_puntualidad != null) mostrarMensajesMotivacionales(detalle);
  } catch (err) {
    console.error('Error cargando datos:', err);
  }

  // Filtro por día / rango 
  let graficoPastel = null;

  function mostrarDatosYGrafico(filtrado, titulo) {
    const container = document.getElementById('estadisticasDiarias');

    const kpiCard = (label, value, color) => {
      const val = Number(value) || 0;
      return `
        <div class="stat-card" style="border-left-color:${color}">
          <div class="stat-body">
            <span class="stat-label">${label}</span>
            <span class="stat-value" style="color:${color};font-size:1.3rem">${val}%</span>
            <div class="stat-bar-track">
              <div class="stat-bar-fill" style="width:${val}%;background:${color}"></div>
            </div>
            <span class="stat-sub">de 100%</span>
          </div>
        </div>`;
    };

    container.innerHTML = `
      <p style="font-size:0.82rem;color:var(--muted);margin-bottom:10px;font-weight:600">${titulo}</p>
      <div class="stats-grid">
        ${kpiCard('CSAT',       filtrado.pct_csat,     '#2563eb')}
        ${kpiCard('FCR',        filtrado.pct_fcr,      '#16a34a')}
        ${kpiCard('% A Tiempo', filtrado.pct_a_tiempo, '#f59e0b')}
      </div>`;

    const canvas = document.getElementById('graficoPastel');
    canvas.style.display = 'block';
    if (graficoPastel) graficoPastel.destroy();

    graficoPastel = new Chart(canvas.getContext('2d'), {
      type: 'polarArea',
      data: {
        labels: ['CSAT', 'FCR', '% A Tiempo'],
        datasets: [{
          data: [
            Number(filtrado.pct_csat)     || 0,
            Number(filtrado.pct_fcr)      || 0,
            Number(filtrado.pct_a_tiempo) || 0
          ],
          backgroundColor: ['rgba(37,99,235,.45)', 'rgba(22,163,74,.45)', 'rgba(245,158,11,.45)'],
          borderColor:     ['#2563eb', '#16a34a', '#f59e0b'],
          borderWidth: 2
        }]
      },
      options: {
        devicePixelRatio: window.devicePixelRatio || 2,
        scales:  { r: { suggestedMin: 0, suggestedMax: 100, ticks: { callback: v => `${v}%` } } },
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: ctx => ` ${ctx.raw}%` } }
        }
      }
    });
  }

  async function filtrarPorFecha(fecha) {
    try {
      const res  = await fetch('/api/estadisticas/detalle/diario', { credentials: 'include' });
      const dias = await res.json();
      const key  = new Date(fecha).toISOString().slice(0, 10);
      const dato = dias.find(d => new Date(d.fecha).toISOString().slice(0, 10) === key);
      if (dato) {
        mostrarDatosYGrafico(dato, key);
      } else {
        document.getElementById('estadisticasDiarias').innerHTML = '<p style="color:var(--muted);font-size:.85rem">No hay datos para esta fecha.</p>';
        document.getElementById('graficoPastel').style.display = 'none';
        if (graficoPastel) { graficoPastel.destroy(); graficoPastel = null; }
      }
    } catch (err) { console.error(err); }
  }

  document.getElementById('filtrarBtn').addEventListener('click', async () => {
    if (tipoFiltro.value === 'fecha') {
      const fecha = document.getElementById('fechaFiltro').value;
      if (!fecha) return alert('Selecciona una fecha');
      filtrarPorFecha(fecha);
    } else {
      const desde = document.getElementById('fechaInicoo').value;
      const hasta = document.getElementById('fechaFin').value;
      if (!desde || !hasta) return alert('Selecciona ambas fechas');
      try {
        const res  = await fetch(`/api/estadisticas/detalle/promedio?desde=${desde}&hasta=${hasta}`, { credentials: 'include' });
        const data = await res.json();
        if (!data?.promedio_puntualidad && !data?.promedio_trato && !data?.promedio_resolucion) {
          document.getElementById('estadisticasDiarias').innerHTML = '<p style="color:var(--muted);font-size:.85rem">No hay datos para este rango.</p>';
          document.getElementById('graficoPastel').style.display = 'none';
          if (graficoPastel) { graficoPastel.destroy(); graficoPastel = null; }
        } else {
          mostrarDatosYGrafico(data, `Promedio del ${desde} al ${hasta}`);
        }
      } catch (err) { console.error(err); }
    }
  });

  document.getElementById('fechaFiltro').value = new Date().toISOString().slice(0, 10);

  //  Reporte personal 
  document.getElementById('btnGenerarReporte')?.addEventListener('click', () => {
    const inicio = document.getElementById('reporteInicio').value;
    const fin    = document.getElementById('reporteFin').value;
    if (!inicio || !fin)
      return Swal.fire('Atención', 'Selecciona el período para el reporte.', 'info');
    const url = `/api/reportes/calificaciones/pdf?inicio=${inicio}&fin=${fin}&cedula=${usuario.cedula}`;
    document.getElementById('reporteIframe').src = url;
    document.getElementById('reportePreview').style.display = 'block';
    document.getElementById('btnDescargarReporte').onclick = () => window.open(url, '_blank');
  });

  // Modal editar perfil 
  const editBtn = document.getElementById('editPerfilBtn');
  const modal   = document.getElementById('editModal');
  const emClose = document.getElementById('emClose');
  const emSave  = document.getElementById('emSave');

  editBtn?.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById('emUsuario').value     = usuario.usuario;
    document.getElementById('emPass').value        = '';
    document.getElementById('emPassConfirm').value = '';
    modal.style.display = 'flex';
  });

  emClose?.addEventListener('click',  () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  emSave?.addEventListener('click', async () => {
    const nuevoUsuario = document.getElementById('emUsuario').value.trim();
    const nuevaPass    = document.getElementById('emPass').value;
    const confirmPass  = document.getElementById('emPassConfirm').value;

    if (!nuevoUsuario && !nuevaPass)
      return Swal.fire('Sin cambios', 'Ingresa un nuevo usuario o contraseña.', 'info');
    if (nuevoUsuario && !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ]+$/.test(nuevoUsuario))
      return Swal.fire('Error', 'El usuario solo puede contener letras, sin números ni caracteres especiales.', 'error');
    if (nuevaPass && !/^[a-zA-Z0-9]+$/.test(nuevaPass))
      return Swal.fire('Error', 'La contraseña solo puede contener letras y números.', 'error');
    if (nuevaPass && nuevaPass !== confirmPass)
      return Swal.fire('Error', 'Las contraseñas no coinciden.', 'error');
    if (nuevaPass && nuevaPass.length < 6)
      return Swal.fire('Error', 'La contraseña debe tener al menos 6 caracteres.', 'error');

    const body = {};
    if (nuevoUsuario && nuevoUsuario !== usuario.usuario) body.usuario    = nuevoUsuario;
    if (nuevaPass)                                        body.contrasena = nuevaPass;

    if (!Object.keys(body).length)
      return Swal.fire('Sin cambios', 'No hay cambios nuevos que guardar.', 'info');

    try {
      const res  = await fetch(`/api/usuarios/${usuario.cedula}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        modal.style.display = 'none';
        await Swal.fire('Actualizado', 'Datos guardados. Vuelve a iniciar sesión.', 'success');
        await fetch('/api/login/logout', { method: 'POST', credentials: 'include' });
        window.location.href = '/';
      } else {
        Swal.fire('Error', data.error || 'No se pudo actualizar.', 'error');
      }
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Error al conectar con el servidor.', 'error');
    }
  });

});

// Logout 
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  try {
    const res  = await fetch('/api/login/logout', { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (data.ok) window.location.href = '/';
  } catch (err) { console.error(err); }
});

// Stats cards agrupadas (dimensión + KPI) 
function renderStatCards(detalle) {
  const container = document.getElementById('statsGrid');
  if (!container) return;

  const groups = [
    { color: '#2563eb', title: 'Tiempo de atención', avgVal: detalle.promedio_puntualidad },
    { color: '#f59e0b', title: 'Resolución',          avgVal: detalle.promedio_resolucion  },
    { color: '#16a34a', title: 'Trato',               avgVal: detalle.promedio_trato       },
  ];

  const groupCard = g => {
    const av = Number(g.avgVal) || 0;
    return `
      <div class="stat-card" style="border-left-color:${g.color}">
        <div class="stat-body">
          <span class="stat-label">${g.title}</span>
          <span class="stat-value" style="color:${g.color}">${av.toFixed(2)}</span>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width:${Math.round((av/3)*100)}%;background:${g.color}"></div>
          </div>
          <span class="stat-sub">de 3.00</span>
        </div>
      </div>`;
  };

  const totalCard = `
    <div class="stat-card" style="border-left-color:#1e3a8a">
      <div class="stat-body">
        <span class="stat-label">Total atenciones</span>
        <span class="stat-value" style="color:#1e3a8a">${detalle.total_atenciones ?? 0}</span>
        <span class="stat-sub">registros históricos</span>
      </div>
    </div>`;

  container.innerHTML = groups.map(groupCard).join('') + totalCard;
}

//  Donuts de KPI con zonas de color acumuladas 
function renderDonuts(detalle) {
  const container = document.getElementById('donutsContainer');
  if (!container) return;

  // Umbrales por KPI: [inicio_amarillo, inicio_verde]
  const kpis = [
    { label: '% A Tiempo', sub: 'Tiempo de atención',   value: Number(detalle.pct_a_tiempo) || 0, t1: 75, t2: 85 },
    { label: '% FCR',      sub: 'Resolución 1ª vez',    value: Number(detalle.pct_fcr)      || 0, t1: 75, t2: 79 },
    { label: '% CSAT',     sub: 'Satisfacción general', value: Number(detalle.pct_csat)     || 0, t1: 70, t2: 85 },
  ];

  const color = (v, t1, t2) => v >= t2 ? '#16a34a' : v >= t1 ? '#f59e0b' : '#ef4444';
  const texto = (v, t1, t2) => v >= t2 ? 'Excelente' : v >= t1 ? 'Aceptable' : 'Por mejorar';

  container.innerHTML = kpis.map((k, i) => {
    const c = color(k.value, k.t1, k.t2);
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:8px">
        <div style="position:relative;width:130px;height:130px;flex-shrink:0">
          <canvas id="donut_${i}"></canvas>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;pointer-events:none">
            <div style="font-size:1.2rem;font-weight:800;color:${c};line-height:1">${k.value}%</div>
            <div style="font-size:0.58rem;color:#9ca3af;margin-top:2px">${k.label}</div>
          </div>
        </div>
        <span style="font-size:0.85rem;font-weight:700;color:#374151;letter-spacing:.3px">${k.sub}</span>
        <span style="font-size:0.72rem;font-weight:600;color:${c}">${texto(k.value, k.t1, k.t2)}</span>
      </div>`;
  }).join('');

  kpis.forEach((k, i) => {
    // Segmentos acumulados según umbrales propios de cada KPI
    const v     = Math.min(k.value, 100);
    const red   = Math.min(v, k.t1);
    const amber = Math.max(0, Math.min(v, k.t2) - k.t1);
    const green = Math.max(0, v - k.t2);
    const empty = Math.max(0, 100 - v);

    new Chart(document.getElementById(`donut_${i}`), {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [red, amber, green, empty],
          backgroundColor: ['#ef4444', '#f59e0b', '#16a34a', '#e5e7eb'],
          borderWidth: 2,
          borderColor: '#fff',
          hoverOffset: 0
        }]
      },
      options: {
        cutout: '76%',
        responsive: true,
        maintainAspectRatio: false,
        devicePixelRatio: window.devicePixelRatio || 2,
        animation: { animateRotate: true, duration: 900, easing: 'easeOutQuart' },
        plugins: { legend: { display: false }, tooltip: { enabled: false } }
      }
    });
  });
}

//  Motivos más atendidos 
function renderMotivos(data) {
  const canvas = document.getElementById('motivosChart');
  if (!canvas) return;
  if (!data.length) {
    canvas.style.display = 'none';
    canvas.closest('.graficos').insertAdjacentHTML('beforeend', '<p style="text-align:center;color:var(--muted);padding:14px 0;font-size:.85rem">Sin datos de motivos.</p>');
    return;
  }
  canvas.style.height = `${Math.max(180, data.length * 42)}px`;
  new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.nombre_motivo),
      datasets: [{
        label: 'Atenciones',
        data: data.map(d => d.total),
        backgroundColor: 'rgba(30,58,138,.7)',
        borderRadius: 4,
        maxBarThickness: 32
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,.05)' } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

//  Tendencia personal 
let _tendenciaChart = null;
function renderTendenciaPersonal(data) {
  const canvas = document.getElementById('tendenciaPersonalChart');
  if (!canvas) return;
  if (!data.length) {
    canvas.style.display = 'none';
    canvas.closest('.graficos').insertAdjacentHTML('beforeend', '<p style="text-align:center;color:var(--muted);padding:14px 0;font-size:.85rem">Sin datos en los últimos 30 días.</p>');
    return;
  }
  canvas.style.height = '240px';
  if (_tendenciaChart) _tendenciaChart.destroy();
  _tendenciaChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: data.map(d => String(d.dia).slice(5, 10)),
      datasets: [
        { label: 'Puntualidad', data: data.map(d => d.puntualidad), borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.06)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#2563eb' },
        { label: 'Trato',       data: data.map(d => d.trato),       borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.06)',  tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#16a34a' },
        { label: 'Resolución',  data: data.map(d => d.resolucion),  borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,.06)', tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: '#f59e0b' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 } } } },
      scales: {
        y: { min: 0, max: 3, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,.05)' } },
        x: { grid: { display: false }, ticks: { font: { size: 11 } } }
      }
    }
  });
}

//  Comentarios recibidos 
function renderComentarios(data) {
  const section   = document.getElementById('comentariosSection');
  const container = document.getElementById('comentariosRecientes');
  if (!section || !container || !data.length) return;
  section.style.display = 'block';
  container.innerHTML = data.map(c => {
    const fecha = new Date(c.fecha).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' });
    return `
      <div class="comentario-card">
        <div class="comentario-meta">
          <span class="comentario-fecha">${fecha}</span>
          <div class="comentario-scores">
            <span style="color:#2563eb">P: ${c.puntualidad}</span>
            <span style="color:#16a34a">T: ${c.trato}</span>
            <span style="color:#f59e0b">R: ${c.resolucion}</span>
          </div>
        </div>
        <p class="comentario-texto">"${c.comentario}"</p>
      </div>`;
  }).join('');
}

// Mensajes motivacionales 
async function mostrarMensajesMotivacionales(detalle) {
  const footer = document.getElementById('mensajeMotivacional');
  if (!footer) return;
  const categorias = [
    { nombre: 'tiempo',     puntaje: detalle.pct_a_tiempo, t1: 75, t2: 85 },
    { nombre: 'resolución', puntaje: detalle.pct_fcr,      t1: 75, t2: 79 },
    { nombre: 'trato',      puntaje: detalle.pct_csat,     t1: 70, t2: 85 },
  ];
  const mensajes = await Promise.all(
    categorias.map(async c => {
      const res  = await fetch('/api/generar-mensaje', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoria: c.nombre, puntaje: Number(c.puntaje), t1: c.t1, t2: c.t2 })
      });
      const data = await res.json();
      return `<span>${c.nombre}: ${data.mensaje}</span>`;
    })
  );
  footer.innerHTML = mensajes.join('<br>');
}
