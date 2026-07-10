const area = window.location.pathname.includes("secretaria")
    ? "secretaria"
    : "colecturia"; 
// const areaId = area === "secretaria" ? 1 : 2;


//cargar el personal de la area
const atendidoSelect = document.getElementById("atendido_por");

async function cargarPersonal() {
    const res = await fetch(`/api/usuarios/area/${area}`);
    const usuarios = await res.json();

    atendidoSelect.innerHTML = `
    <option value="" disabled selected>Seleccione una opción</option>
  `;

    usuarios.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u.cedula;
        opt.textContent = `${u.nombre} ${u.apellido}`;
        atendidoSelect.appendChild(opt);
    });
}

cargarPersonal();

//cargar los motivos
const motivoSelect = document.getElementById("motivo");

async function cargarMotivos() {
    const res = await fetch(`/api/encuestas/motivos/${area}`);
    const motivos = await res.json();

    motivoSelect.innerHTML = `
    <option value="" disabled selected>Seleccione un motivo</option>
  `;

    motivos.forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.id_motivo;
        opt.textContent = m.nombre_motivo;
        motivoSelect.appendChild(opt);
    });
}

cargarMotivos();

// 4. Enviar encuesta
const form = document.getElementById("encuestaForm");
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
        // area_atencion: areaId,
        area_atencion: area,
        atendido_por: atendidoSelect.value,
        fecha: new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 19)
            .replace('T', ' '),
        puntualidad: parseInt(document.querySelector('input[name="puntualidad"]:checked')?.value),
        trato: parseInt(document.querySelector('input[name="trato"]:checked')?.value),
        resolucion: parseInt(document.querySelector('input[name="resolucion"]:checked')?.value),
        id_motivo: parseInt(motivoSelect.value),
        comentario: document.getElementById('comentario').value.trim() || "Sin comentarios"
    };

    if (
        !data.area_atencion ||
        !data.atendido_por ||
        !data.puntualidad ||
        !data.trato ||
        !data.resolucion ||
        !data.id_motivo
    ) {
        alert("Por favor, complete todas las preguntas.");
        return;
    }

    try {
        const res = await fetch('/api/encuestas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(data)
        });

        const result = await res.json();

        if (result.success) {
            Swal.fire({
                title: "Encuesta enviada correctamente",
                icon: "success",
                timer: 1500,
                timerProgressBar: true
            }).then(() => {
                location.reload();
            });

            if (activarModoPreguntaPorPantalla.modoActual) {
        } else {
            Swal.fire("Error", "No se pudo guardar la encuesta", "error");
        }
    } catch (err) {
        Swal.fire("Error", "Error al conectar con el servidor", "error");
    }
});

// Modo pregunta por pantalla
function activarModoPreguntaPorPantalla() {
    const preguntas = document.querySelectorAll(
      '.preguntas-container, .preguntas-container-motivo, .comentario-container'
    );

    const esHorizontal = window.matchMedia("(orientation: landscape)").matches;
    const esTouch = navigator.maxTouchPoints > 0;
    const activarModo = esHorizontal && esTouch;

    if (activarModoPreguntaPorPantalla.modoActual === activarModo) return;
    activarModoPreguntaPorPantalla.modoActual = activarModo;

    preguntas.forEach(p => {
        p.style.display = "flex";
        p.classList.remove("oculto");
    });

    if (activarModo) {
        let actual = 0;

        const mostrarPregunta = (i) => {
            preguntas.forEach((p, idx) => {
                if (idx === i) {
                    p.classList.remove("oculto");
                    p.style.display = "flex";
                } else {
                    p.classList.add("oculto");
                    setTimeout(() => p.style.display = "none", 300);
                }
            });
        };

        mostrarPregunta(0);

        preguntas.forEach((pregunta, idx) => {
            const inputs = pregunta.querySelectorAll("input, select, textarea");
            inputs.forEach((input) => {
                if (!input.dataset.listenerAdded) {
                    input.dataset.listenerAdded = true;
                    input.addEventListener("change", () => {
                        if (idx < preguntas.length - 1) {
                            setTimeout(() => {
                                actual++;
                                mostrarPregunta(actual);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }, 700);
                        }
                    });
                }
            });
        });
    }
}


// Ejecutar en carga y al cambiar tamaño
window.addEventListener("DOMContentLoaded", activarModoPreguntaPorPantalla);
window.addEventListener("load", activarModoPreguntaPorPantalla);
window.addEventListener("resize", activarModoPreguntaPorPantalla);

