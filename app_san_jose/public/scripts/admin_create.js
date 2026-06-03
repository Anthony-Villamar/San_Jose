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

// Función para cargar roles dinámicamente en un select
async function cargarRoles(selectElement, selectedRol = '') {
  try {
    const res = await fetch('/api/usuarios/roles');
    if (!res.ok) throw new Error('Error al cargar roles');
    const roles = await res.json(); // debe ser array de strings ["secretaria", "docente", ...]

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

// Cargar roles en el select de registro al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  cargarRoles(document.getElementById('rol'));
  // El select de actualización se llenará dinámicamente al buscar usuario
});

//verificar cedula y autocompletar nombre y apellido con api de web services
const cedulaInput = document.getElementById('cedula');
const nombreInput = document.getElementById('nombre');
const apellidoInput = document.getElementById('apellido');
const cedulaMensaje = document.getElementById('cedulaMensaje');


const correoInput = document.getElementById("correo");
const correoMensaje = document.getElementById("correoMensaje");

let correoValido = false;

let timeoutCedula;

nombreInput.addEventListener("input", () => {
  nombreInput.value = nombreInput.value.replace(/[^a-zA-Z\s]/g, "");
});

apellidoInput.addEventListener("input", () => {
  apellidoInput.value = apellidoInput.value.replace(/[^a-zA-Z\s]/g, "");
});

cedulaInput.addEventListener("input", () => {
  cedulaInput.value = cedulaInput.value.replace(/\D/g, "");
});

cedulaInput.addEventListener("input", () => {
  clearTimeout(timeoutCedula);

  timeoutCedula = setTimeout(async () => {
    const ced = cedulaInput.value.trim();

    if (ced.length !== 10) return;

    cedulaMensaje.textContent = "Consultando...";

    try {
      const data = await apiFetch(`/api/usuarios/verificacion/${ced}`);

      if (data.ok) {
        nombreInput.value = data.nombres;
        apellidoInput.value = data.apellidos;

        cedulaMensaje.textContent = "Datos cargados";
        cedulaMensaje.classList.add("ok");
      } else {
        cedulaMensaje.textContent = "No encontrada";
        cedulaMensaje.classList.add("error");
      }

    } catch {
      cedulaMensaje.textContent = "Error al consultar";
      cedulaMensaje.classList.add("error");
    }
  }, 500);
});

// Cargar roles en el select de registro al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  cargarRoles(document.getElementById('rol'));
  // El select de actualización se llenará dinámicamente al buscar usuario
});



//VALIDAR TELEFONO
const telefonoInput = document.getElementById("telefono");
const telefonoMensaje = document.getElementById("telefonoMensaje");
let timeoutTelefono;

telefonoInput.addEventListener("input", () => {
  telefonoInput.value = telefonoInput.value.replace(/\D/g, "");
});


telefonoInput.addEventListener("input", () => {
  clearTimeout(timeoutTelefono);

  timeoutTelefono = setTimeout(async () => {
    const tel = telefonoInput.value.trim();
    if (tel.length !== 10) return;


    telefonoMensaje.textContent = "Verificando...";

    try {
      const data = await apiFetch(`/api/usuarios/verificacion-whatsapp/${tel}`);
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
  }, 500);
});

// async function validarWhatsApp(telefono) {
//   telefonoMensaje.textContent = "";
//   telefonoMensaje.className = "telefono-mensaje";

//   // Validar que tenga 10 dígitos y empiece con 0
//   if (!/^0\d{9}$/.test(telefono)) {
//     telefonoMensaje.textContent = "Número inválido. Debe comenzar con 0 y tener 10 dígitos.";
//     telefonoMensaje.classList.add("error");
//     return;
//   }

//   try {
//     const res = await fetch(`/api/usuarios/verificacion-whatsapp/${telefono}`);

//     if (!res.ok) throw new Error("Error en verificación");

//     const data = await res.json();

//     const existe = data?.existe === true;

//     if (existe) {
//       telefonoMensaje.textContent = "Este número SÍ tiene WhatsApp";
//       telefonoMensaje.classList.add("ok");
//     } else {
//       telefonoMensaje.textContent = "Este número NO tiene WhatsApp";
//       telefonoMensaje.classList.add("error");
//     }
//   } catch (e) {
//     console.error(e);
//     telefonoMensaje.textContent = "Error al verificar el número.";
//     telefonoMensaje.classList.add("error");
//   }
// }


//verificar correo

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

// Registro de usuarios
document.getElementById('registroForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const cedula = cedulaInput.value.trim();
  const nombre = nombreInput.value.trim();
  const apellido = apellidoInput.value.trim();
  const correo = correoInput.value.trim();
  const telefono = telefonoInput.value.trim();
  const usuario = document.getElementById('usuarioNuevo').value.trim();
  const contrasena = document.getElementById('contrasenaNuevo').value.trim();
  const rol = document.getElementById('rol').value;

  if (!correoValido) {
    return Swal.fire({
      icon: 'warning',
      title: 'Correo inválido'
    });
  }

  if (!cedula || !nombre || !apellido || !correo || !telefono || !usuario || !contrasena || !rol) {
    return Swal.fire({
      icon: 'warning',
      title: 'Campos incompletos'
    });
  }

  try {
    const data = await apiFetch('/api/usuarios/registrar', {
      method: 'POST',
      body: JSON.stringify({
        cedula_usuario: cedula,
        nombre,
        apellido,
        correo,
        telefono,
        usuario,
        contrasena,
        rol
      })
    });

    Swal.fire({
      icon: 'success',
      title: 'Usuario registrado'
    });

    e.target.reset();

  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: err.message
    });
  }
});

