// // public/scripts/activarDesactivar.js
// (() => {
//   const API_BASE = '/api/usuarios';

//   const $tbody = document.querySelector('#tablaUsuarios tbody');
//   const $fEstado = document.querySelector('#filtroEstado');
//   const $fRol = document.querySelector('#filtroRol');
//   const $buscar = document.querySelector('#buscar');

//   let cache = [];

//   function badge(estado) {
//     const cls = estado === 'activo' ? 'badge badge-activo' : 'badge badge-inactivo';
//     return `<span class="${cls}">${estado}</span>`;
//     }

//   function btn(row) {
//     if (row.estado === 'activo') {
//       return `<button class="btn btn-desactivar" data-accion="desactivar" data-cedula="${row.cedula}">Desactivar</button>`;
//     }
//     return `<button class="btn btn-activar" data-accion="activar" data-cedula="${row.cedula}">Activar</button>`;
//   }

//   function norm(s) { return (s ?? '').toString().trim().toLowerCase(); }

//   function filtrarBusqueda(rows, q) {
//     if (!q) return rows;
//     return rows.filter(r => {
//       const hay = [r.cedula, `${r.nombre} ${r.apellido}`, r.usuario, r.rol]
//         .map(norm).join(' ');
//       return hay.includes(q) || hay.indexOf(q) !== -1;
//     });
//   }

//   function render(rows) {
//     $tbody.innerHTML = rows.map(r => `
//       <tr>
//         <td>${r.cedula}</td>
//         <td>${r.nombre} ${r.apellido}</td>
//         <td>${r.usuario}</td>
//         <td>${r.rol}</td>
//         <td>${badge(r.estado)}</td>
//         <td>${btn(r)}</td>
//       </tr>
//     `).join('') || `<tr><td colspan="6">Sin resultados</td></tr>`;
//   }

//   async function cargarRoles() {
//     try {
//       const resp = await fetch(`${API_BASE}/roles`, { credentials: 'include' });
//       const roles = await resp.json();
//       roles.forEach(r => {
//         const opt = document.createElement('option');
//         opt.value = r;
//         opt.textContent = r;
//         $fRol.appendChild(opt);
//       });
//     } catch (e) {
//       console.warn('No se pudieron cargar roles', e);
//     }
//   }

//   async function cargarUsuarios() {
//     const estado = $fEstado.value; // activo | inactivo | todos
//     const rol = $fRol.value;       // rol | todos
//     const qs = new URLSearchParams();
//     if (estado !== 'todos') qs.set('estado', estado);
//     if (rol !== 'todos') qs.set('rol', rol);

//     try {
//       const resp = await fetch(`${API_BASE}/admin-list?${qs.toString()}`, {
//         credentials: 'include'
//       });
//       if (!resp.ok) throw new Error('HTTP ' + resp.status);
//       cache = await resp.json();
//       aplicarBusqueda();
//     } catch (e) {
//       console.error(e);
//       Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error');
//       cache = [];
//       render([]);
//     }
//   }

//   function aplicarBusqueda() {
//     const q = norm($buscar.value);
//     render(filtrarBusqueda(cache, q));
//   }

//   async function cambiarEstado(cedula, accion) {
//     const url = `${API_BASE}/${encodeURIComponent(cedula)}/${accion}`;
//     const resp = await fetch(url, { method: 'PATCH', credentials: 'include' });
//     const data = await resp.json().catch(() => ({}));
//     if (!resp.ok) throw new Error(data?.error || `Error al ${accion}`);
//   }

//   $tbody.addEventListener('click', async (ev) => {
//     const btn = ev.target.closest('button[data-accion]');
//     if (!btn) return;
//     const accion = btn.dataset.accion; // activar | desactivar
//     const cedula = btn.dataset.cedula;

//     const { isConfirmed } = await Swal.fire({
//       title: `${accion === 'activar' ? 'Activar' : 'Desactivar'} usuario`,
//       text: `¿Confirmas que deseas ${accion} al usuario ${cedula}?`,
//       icon: 'warning',
//       showCancelButton: true,
//       confirmButtonText: accion === 'activar' ? 'Sí, activar' : 'Sí, desactivar'
//     });
//     if (!isConfirmed) return;

//     try {
//       await cambiarEstado(cedula, accion);
//       await cargarUsuarios();
//       Swal.fire('Listo', `Usuario ${accion}do`, 'success');
//     } catch (e) {
//       Swal.fire('Error', e.message, 'error');
//     }
//   });

//   $fEstado.addEventListener('change', cargarUsuarios);
//   $fRol.addEventListener('change', cargarUsuarios);
//   $buscar.addEventListener('input', aplicarBusqueda);

//   (async function init() {
//     await cargarRoles();
//     await cargarUsuarios();
//   })();
// })();



// public/scripts/activarDesactivar.js
(() => {
  const API_BASE = '/api/usuarios';

  const $tbody = document.querySelector('#tablaUsuarios tbody');
  const $fEstado = document.querySelector('#filtroEstado');
  const $fRol = document.querySelector('#filtroRol');
  const $buscar = document.querySelector('#buscar');

  // PAGINACIÓN
  const $prev = document.getElementById('prevPage');
  const $next = document.getElementById('nextPage');
  const $pageInfo = document.getElementById('pageInfo');
  let cache = [];
  let current = [];          // dataset filtrado listo para mostrar
  let page = 1;
  const pageSize = 6;

  function badge(estado) {
    const cls = estado === 'activo' ? 'badge badge-activo' : 'badge badge-inactivo';
    return `<span class="${cls}">${estado}</span>`;
  }

  function btn(row) {
    if (row.estado === 'activo') {
      return `<button class="btn-desactivar" data-accion="desactivar" data-cedula="${row.cedula}">Desactivar</button>`;
    }
    return `<button class="btn-activar" data-accion="activar" data-cedula="${row.cedula}">Activar</button>`;
  }

  const norm = s => (s ?? '').toString().trim().toLowerCase();

  function filtrarBusqueda(rows, q) {
    if (!q) return rows;
    return rows.filter(r => {
      const hay = [r.cedula, `${r.nombre} ${r.apellido}`, r.usuario, r.rol]
        .map(norm).join(' ');
      return hay.includes(q) || hay.indexOf(q) !== -1;
    });
  }

  // === RENDER con paginación ===
  function renderPaged(rows){
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    if (page > pages) page = pages;
    const start = (page - 1) * pageSize;
    const slice = rows.slice(start, start + pageSize);

    $tbody.innerHTML = slice.map(r => `
      <tr>
        <td>${r.cedula}</td>
        <td>${r.nombre} ${r.apellido}</td>
        <td>${r.usuario}</td>
        <td>${r.rol}</td>
        <td>${badge(r.estado)}</td>
        <td>${btn(r)}</td>
      </tr>
    `).join('') || `<tr><td colspan="6">Sin resultados</td></tr>`;

    // estado de la paginación
    $pageInfo.textContent = `Página ${page} de ${pages}`;
    $prev.disabled = page <= 1;
    $next.disabled = page >= pages;
  }

  function aplicarBusqueda() {
    const q = norm($buscar.value);
    current = filtrarBusqueda(cache, q);
    page = 1;                     // reset al buscar
    renderPaged(current);
  }

  async function cargarRoles() {
    try {
      const resp = await fetch(`${API_BASE}/roles`, { credentials: 'include' });
      const roles = await resp.json();
      roles.forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        $fRol.appendChild(opt);
      });
    } catch (e) {
      console.warn('No se pudieron cargar roles', e);
    }
  }

  async function cargarUsuarios() {
    const estado = $fEstado.value;
    const rol = $fRol.value;
    const qs = new URLSearchParams();
    if (estado !== 'todos') qs.set('estado', estado);
    if (rol !== 'todos') qs.set('rol', rol);

    try {
      const resp = await fetch(`${API_BASE}/admin-list?${qs.toString()}`, {
        credentials: 'include'
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      cache = await resp.json();
      aplicarBusqueda();
    } catch (e) {
      console.error(e);
      Swal.fire('Error', 'No se pudieron cargar los usuarios', 'error');
      cache = [];
      current = [];
      renderPaged(current);
    }
  }

  async function cambiarEstado(cedula, accion) {
    const url = `${API_BASE}/${encodeURIComponent(cedula)}/${accion}`;
    const resp = await fetch(url, { method: 'PATCH', credentials: 'include' });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(data?.error || `Error al ${accion}`);
  }

  $tbody.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('button[data-accion]');
    if (!btn) return;
    const accion = btn.dataset.accion;
    const cedula = btn.dataset.cedula;

    const { isConfirmed } = await Swal.fire({
      title: `${accion === 'activar' ? 'Activar' : 'Desactivar'} usuario`,
      text: `¿Confirmas que deseas ${accion} al usuario ${cedula}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: accion === 'activar' ? 'Sí, activar' : 'Sí, desactivar'
    });
    if (!isConfirmed) return;

    try {
      await cambiarEstado(cedula, accion);
      await cargarUsuarios();
      Swal.fire('Listo', `Usuario ${accion}do`, 'success');
    } catch (e) {
      Swal.fire('Error', e.message, 'error');
    }
  });

  $fEstado.addEventListener('change', cargarUsuarios);
  $fRol.addEventListener('change', cargarUsuarios);
  $buscar.addEventListener('input', aplicarBusqueda);

  // Controles de página
  if ($prev && $next) {
    $prev.addEventListener('click', () => { if (page > 1) { page--; renderPaged(current); } });
    $next.addEventListener('click', () => { page++; renderPaged(current); });
  }

  // Detectar clic en cualquier fila de la tabla
document.addEventListener("click", (e) => {
  const fila = e.target.closest("#tablaUsuarios tbody tr");
  if (!fila) return;

  // Eliminar selección anterior
  document.querySelectorAll("#tablaUsuarios tbody tr").forEach(tr => {
    tr.classList.remove("selected");
  });

  // Aplicar selección a la fila clickeada
  fila.classList.add("selected");
});

  (async function init() {
    await cargarRoles();
    await cargarUsuarios();
  })();
})();
