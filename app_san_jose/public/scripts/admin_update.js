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

//verificar pattners de los inputs
const telefonoInput = document.getElementById("telefonoActualizar");
const telefonoMensaje = document.getElementById("telefonoMensaje");

telefonoInput.addEventListener("input", () => {
  telefonoInput.value = telefonoInput.value.replace(/\D/g, "");
});

const nombreInput = document.getElementById('nombreActualizar');
const apellidoInput = document.getElementById('apellidoActualizar');
const cedulaInput = document.getElementById('cedulaActualizar');


nombreInput.addEventListener("input", () => {
  nombreInput.value = nombreInput.value.replace(/[^a-zA-Z\s]/g, "");
});

apellidoInput.addEventListener("input", () => {
  apellidoInput.value = apellidoInput.value.replace(/[^a-zA-Z\s]/g, "");
});

cedulaInput.addEventListener("input", () => {
  cedulaInput.value = cedulaInput.value.replace(/\D/g, "");
});


//verificar numero de whatsapp
async function validarWhatsApp(telefono) {
  telefonoMensaje.textContent = "";
  telefonoMensaje.className = "telefono-mensaje";

  // Validar que tenga 10 dígitos y empiece con 0
  if (!/^0\d{9}$/.test(telefono)) {
    telefonoMensaje.textContent = "Número inválido. Debe comenzar con 0 y tener 10 dígitos.";
    telefonoMensaje.classList.add("error");
    return;
  }

  try {
    const res = await fetch(`/api/usuarios/verificacion-whatsapp/${telefono}`);

    if (!res.ok) throw new Error("Error en verificación");

    const data = await res.json();

    const existe = data?.existe === true;

    if (existe) {
      telefonoMensaje.textContent = "Este número SÍ tiene WhatsApp";
      telefonoMensaje.classList.add("ok");
    } else {
      telefonoMensaje.textContent = "Este número NO tiene WhatsApp";
      telefonoMensaje.classList.add("error");
    }
  } catch (e) {
    console.error(e);
    telefonoMensaje.textContent = "Error al verificar el número.";
    telefonoMensaje.classList.add("error");
  }
}

telefonoInput.addEventListener("change", () => {
  const tel = telefonoInput.value.trim();
  if (tel) validarWhatsApp(tel);
});

// Función para cargar roles dinámicamente en un select
async function cargarRoles(selectElement, selectedRol = '') {
  try {
    const res = await fetch('/api/usuarios/roles');
    if (!res.ok) throw new Error('Error al cargar roles');
    const roles = await res.json();

    // Limpiar opciones previas (excepto el primer option)
    const primerOption = selectElement.querySelector('option');
    selectElement.innerHTML = '';
    if (primerOption) selectElement.appendChild(primerOption);

    roles.forEach(rol => {
      const option = document.createElement('option');
      option.value = rol;
      option.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);
      if (rol === selectedRol) option.selected = true;
      selectElement.appendChild(option);
    });
  } catch (err) {
    console.error(err);
  }
}

//verificar correo
async function apiFetch(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...options
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message || "Error");

    return data;
  } catch (err) {
    console.error("API ERROR:", err);
    throw err;
  }
}
const correoInput = document.getElementById("correoActualizar");
const correoMensaje = document.getElementById("correoMensaje");

let correoValido = false;
let timeoutCorreo;
correoInput.addEventListener("input", () => {
  clearTimeout(timeoutCorreo);

  timeoutCorreo = setTimeout(async () => {
    const correo = correoInput.value.trim();
    if (!correo) return;

    correoMensaje.textContent = "Verificando...";

    try {
      const data = await apiFetch(`/api/usuarios/verificacion-email/${correo}`);

      correoValido = data.isValid;

      correoMensaje.textContent = data.isValid
        ? "Correo válido"
        : "Correo inválido";

      correoMensaje.classList.add(data.isValid ? "ok" : "error");

    } catch {
      correoMensaje.textContent = "Error";
      correoMensaje.classList.add("error");
      correoValido = false;
    }

  }, 500);
});



// Actualización parcial de usuarios
document.getElementById('actualizarForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const cedula = document.getElementById('cedulaActualizar').value.trim();
  if (!cedula) {
    Swal.fire({
      icon: 'warning',
      title: 'Cédula faltante',
      text: 'Ingresa la cédula del usuario que deseas actualizar.'
    });
    return;
  }

  const datosActualizar = {};
  const nombre = document.getElementById('nombreActualizar').value.trim();
  const apellido = document.getElementById('apellidoActualizar').value.trim();
  const correo = document.getElementById('correoActualizar').value.trim();
  const telefono = document.getElementById('telefonoActualizar').value.trim();
  const rol = document.getElementById('rolActualizar').value;
  const usuario = document.getElementById('usuarioActualizar').value.trim();
  const contrasena = document.getElementById('contrasenaActualizar').value.trim();




  const regexUsuario = /^[a-zA-Z]+$/;
  if (usuario && !regexUsuario.test(usuario)) {
    alert('El usuario solo puede contener letras.');
    return;
  }

  const regexContrasena = /^[a-zA-Z0-9]+$/;
  if (contrasena && !regexContrasena.test(contrasena)) {
    alert('La contraseña solo puede contener letras y números.');
    return;
  }

  if (nombre) datosActualizar.nombre = nombre;
  if (apellido) datosActualizar.apellido = apellido;
  if (correo) datosActualizar.correo = correo;
  if (telefono) datosActualizar.telefono = telefono;
  if (rol) datosActualizar.rol = rol; // nombre del rol, backend lo convierte a id_rol
  if (usuario) datosActualizar.usuario = usuario;
  if (contrasena) datosActualizar.contrasena = contrasena;

  if (Object.keys(datosActualizar).length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Sin cambios',
      text: 'No se ingresó ningún campo para actualizar.'
    });
    return;
  }

  // Confirmación con botones Bootstrap
  const swalWithBootstrapButtons = Swal.mixin({
    customClass: {
      confirmButton: "btn btn-success",
      cancelButton: "btn btn-danger"
    },
    buttonsStyling: true
  });

  const result = await swalWithBootstrapButtons.fire({
    title: "¿Actualizar usuario?",
    text: "Esta acción modificará los datos del usuario.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Sí, actualizar",
    cancelButtonText: "Cancelar",
    confirmButtonColor: "#28a745",
    cancelButtonColor: "#dc3545",
    reverseButtons: true
  });

  if (result.isConfirmed) {
    try {
      const res = await fetch(`/api/usuarios/${cedula}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(datosActualizar)
      });

      const data = await res.json();

      if (res.ok && data.success) {
        swalWithBootstrapButtons.fire({
          title: "¡Actualizado!",
          text: data.message,
          icon: "success"
        });
        document.getElementById('actualizarForm').reset();
        limpiarCamposActualizar();
      } else {
        swalWithBootstrapButtons.fire({
          title: "Error",
          text: data.message || 'Error al actualizar usuario.',
          icon: "error"
        });
      }
    } catch (error) {
      console.error(error);
      swalWithBootstrapButtons.fire({
        title: "Error",
        text: "Error en la comunicación con el servidor.",
        icon: "error"
      });
    }
  } else if (result.dismiss === Swal.DismissReason.cancel) {
    // Al cancelar
    swalWithBootstrapButtons.fire({
      title: "Cancelado",
      text: "No se realizaron cambios en el usuario.",
      icon: "info"
    });
  }
});

// Autocompletar campos al escribir la cédula y cargar roles dinámicamente
document.getElementById('cedulaActualizar').addEventListener('input', async (e) => {
  const cedula = e.target.value.trim();

  if (cedula.length >= 10) {
    try {
      const res = await fetch(`/api/usuarios/buscar-con-roles/${cedula}`);
      const data = await res.json();

      if (res.ok && data.success) {
        const usuario = data.usuario;

        document.getElementById('nombreActualizar').value = usuario.nombre || '';
        document.getElementById('apellidoActualizar').value = usuario.apellido || '';
        document.getElementById('correoActualizar').value = usuario.correo || '';
        document.getElementById('telefonoActualizar').value = usuario.telefono || '';
        document.getElementById('usuarioActualizar').value = usuario.usuario || '';
        document.getElementById('contrasenaActualizar').value = usuario.contrasena || '';

        // Cargar roles dinámicos en select con rol seleccionado
        cargarRoles(document.getElementById('rolActualizar'), usuario.rol);

      } else {
        limpiarCamposActualizar();
      }
    } catch (err) {
      console.error('Error al buscar usuario', err);
      limpiarCamposActualizar();
    }
  } else {
    limpiarCamposActualizar();
  }
});

function limpiarCamposActualizar() {
  document.getElementById('nombreActualizar').value = '';
  document.getElementById('apellidoActualizar').value = '';
  document.getElementById('correoActualizar').value = '';
  document.getElementById('telefonoActualizar').value = '';
  // Reseteamos el select de roles con solo opción "Sin cambiar"
  const selectRolActualizar = document.getElementById('rolActualizar');
  selectRolActualizar.innerHTML = '<option value="">-- Sin cambiar --</option>';
  document.getElementById('usuarioActualizar').value = '';
  document.getElementById('contrasenaActualizar').value = '';
}