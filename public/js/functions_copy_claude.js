// ============================================================
// SESIÓN
// ============================================================
// Se comprueba nada más cargar la página: si no hay sesión válida,
// redirige al login antes de que el resto de la app intente pedir datos.
let rolActual = null;
let usuarioActualId = null;
let perfilActual = null;

const ETIQUETAS_ROL = {
    desarrollador: 'Desarrollador (superadmin)',
    propietario: 'Propietario',
    gestor: 'Gestor autorizado',
};

(async function comprobarSesion() {
    try {
        const res = await fetch('/me');
        if (!res.ok) { window.location.href = '/login'; return; }
        const usuario = await res.json();
        rolActual = usuario.rol;
        usuarioActualId = usuario.id;
        perfilActual = usuario;

        const span = document.getElementById('usuarioActual');
        if (span) span.textContent = `${usuario.nombre} (${usuario.nombre_usuario})`;

        const rolLabel = document.getElementById('usuarioRolLabel');
        if (rolLabel) rolLabel.textContent = ETIQUETAS_ROL[usuario.rol] || usuario.rol;

        const iniciales = document.getElementById('usuarioIniciales');
        if (iniciales) {
            const partes = (usuario.nombre || usuario.nombre_usuario || '?').trim().split(/\s+/);
            iniciales.textContent = (partes[0]?.[0] || '').toUpperCase() + (partes[1]?.[0] || '').toUpperCase();
        }
    } catch (err) {
        window.location.href = '/login';
    }
})();

async function cerrarSesion() {
    try { await fetch('/logout', { method: 'POST' }); } catch (err) { /* ignorar */ }
    window.location.href = '/login';
}

function toggleMenuUsuario() {
    document.getElementById('menuUsuario')?.classList.toggle('hidden');
}
document.addEventListener('click', (e) => {
    const menu = document.getElementById('menuUsuario');
    const boton = document.getElementById('btnMenuUsuario');
    if (menu && !menu.classList.contains('hidden') && !menu.contains(e.target) && e.target !== boton && !boton?.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

function abrirModalCambiarPassword() {
    document.getElementById('menuUsuario')?.classList.add('hidden');
    document.getElementById('formCambiarPassword')?.reset();
    document.getElementById('mensajeCambiarPassword')?.classList.add('hidden');
    document.getElementById('modalCambiarPassword')?.classList.remove('hidden');
}
function cerrarModalCambiarPassword() {
    document.getElementById('modalCambiarPassword')?.classList.add('hidden');
}

function abrirModalEditarPerfil() {
    document.getElementById('menuUsuario')?.classList.add('hidden');
    document.getElementById('mensajeEditarPerfil')?.classList.add('hidden');
    document.getElementById('perfilNombre').value = perfilActual?.nombre || '';
    document.getElementById('perfilEmail').value = perfilActual?.email || '';
    document.getElementById('modalEditarPerfil')?.classList.remove('hidden');
}
function cerrarModalEditarPerfil() {
    document.getElementById('modalEditarPerfil')?.classList.add('hidden');
}
document.getElementById('formEditarPerfil')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('perfilNombre').value.trim();
    const email = document.getElementById('perfilEmail').value.trim();
    const mensaje = document.getElementById('mensajeEditarPerfil');

    const mostrarMensaje = (texto, ok) => {
        mensaje.textContent = texto;
        mensaje.className = `text-sm mb-3 ${ok ? 'text-green-600' : 'text-red-500'}`;
        mensaje.classList.remove('hidden');
    };

    if (!nombre) { mostrarMensaje('El nombre no puede estar vacío.', false); return; }

    try {
        const res = await fetch('/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email: email || null })
        });
        const data = await res.json();
        if (!res.ok) { mostrarMensaje(data.error || 'No se pudo actualizar el perfil.', false); return; }

        perfilActual = data;
        const span = document.getElementById('usuarioActual');
        if (span) span.textContent = `${data.nombre} (${data.nombre_usuario})`;
        const iniciales = document.getElementById('usuarioIniciales');
        if (iniciales) {
            const partes = (data.nombre || data.nombre_usuario || '?').trim().split(/\s+/);
            iniciales.textContent = (partes[0]?.[0] || '').toUpperCase() + (partes[1]?.[0] || '').toUpperCase();
        }

        mostrarMensaje('Perfil actualizado.', true);
        setTimeout(cerrarModalEditarPerfil, 1200);
    } catch (err) {
        mostrarMensaje('Error de conexión. Inténtalo de nuevo.', false);
    }
});

// Modal de confirmación de la propia app (sustituye a los confirm() nativos del
// navegador, que no se pueden personalizar y no encajan con el diseño). Devuelve
// una Promise<boolean>: true si se pulsa el botón de aceptar, false si se cancela.
function confirmarAccion(mensaje, textoBoton = 'Eliminar') {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalConfirmacion');
        const msg = document.getElementById('mensajeConfirmacion');
        const btnAceptar = document.getElementById('btnAceptarConfirmacion');
        const btnCancelar = document.getElementById('btnCancelarConfirmacion');

        // Si por lo que sea el modal no existe en el HTML, no bloqueamos la acción:
        // usamos el confirm() nativo como red de seguridad.
        if (!modal || !msg || !btnAceptar || !btnCancelar) { resolve(window.confirm(mensaje)); return; }

        msg.textContent = mensaje;
        btnAceptar.textContent = textoBoton;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const limpiar = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            btnAceptar.removeEventListener('click', onAceptar);
            btnCancelar.removeEventListener('click', onCancelar);
            modal.removeEventListener('click', onFondo);
        };
        const onAceptar = () => { limpiar(); resolve(true); };
        const onCancelar = () => { limpiar(); resolve(false); };
        const onFondo = (e) => { if (e.target === modal) onCancelar(); };

        btnAceptar.addEventListener('click', onAceptar);
        btnCancelar.addEventListener('click', onCancelar);
        modal.addEventListener('click', onFondo);
    });
}
// Aviso simple (éxito/error/info) con el mismo estilo que el modal de
// confirmar borrado, para no depender del alert() nativo del navegador.
function mostrarAviso(mensaje, tipo = 'exito') {
    return new Promise((resolve) => {
        const modal = document.getElementById('modalAviso');
        const msg = document.getElementById('mensajeAviso');
        const icono = document.getElementById('iconoAviso');
        const btnAceptar = document.getElementById('btnAceptarAviso');

        // Red de seguridad si el modal no existiera en el HTML.
        if (!modal || !msg || !icono || !btnAceptar) { window.alert(mensaje); resolve(); return; }

        const estilos = {
            exito: { clase: 'bg-green-100 text-green-600', icono: 'fa-circle-check' },
            error: { clase: 'bg-red-100 text-red-600', icono: 'fa-circle-exclamation' },
            info:  { clase: 'bg-blue-100 text-blue-600', icono: 'fa-circle-info' },
        };
        const estilo = estilos[tipo] || estilos.info;

        msg.textContent = mensaje;
        icono.className = `w-14 h-14 rounded-full ${estilo.clase} flex items-center justify-center shrink-0 text-2xl`;
        icono.innerHTML = `<i class="fas ${estilo.icono}"></i>`;

        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const limpiar = () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            btnAceptar.removeEventListener('click', onAceptar);
            modal.removeEventListener('click', onFondo);
        };
        const onAceptar = () => { limpiar(); resolve(); };
        const onFondo = (e) => { if (e.target === modal) onAceptar(); };

        btnAceptar.addEventListener('click', onAceptar);
        modal.addEventListener('click', onFondo);
    });
}

document.getElementById('formCambiarPassword')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contrasena_actual = document.getElementById('passwordActual').value;
    const nueva = document.getElementById('passwordNueva').value;
    const confirmar = document.getElementById('passwordNuevaConfirmar').value;
    const mensaje = document.getElementById('mensajeCambiarPassword');

    const mostrarMensaje = (texto, ok) => {
        mensaje.textContent = texto;
        mensaje.className = `text-sm mb-3 ${ok ? 'text-green-600' : 'text-red-500'}`;
        mensaje.classList.remove('hidden');
    };

    if (nueva !== confirmar) { mostrarMensaje('Las dos contraseñas nuevas no coinciden.', false); return; }
    if (nueva.length < 8) { mostrarMensaje('La contraseña nueva debe tener al menos 8 caracteres.', false); return; }

    try {
        const res = await fetch('/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contrasena_actual, contrasena_nueva: nueva })
        });
        const data = await res.json();
        if (!res.ok) { mostrarMensaje(data.error || 'No se pudo cambiar la contraseña.', false); return; }
        mostrarMensaje('Contraseña actualizada.', true);
        setTimeout(cerrarModalCambiarPassword, 1200);
    } catch (err) {
        mostrarMensaje('Error de conexión. Inténtalo de nuevo.', false);
    }
});

/** Texto ya escapado de todos los productos de un pedido, p.ej. "2 de Pienso Gato, 1 de Pienso Perro". */
function resumenItemsTexto(items) {
    if (!items || items.length === 0) return '';
    return items.map(it => `${escapeHTML(it.cantidad)} de ${escapeHTML(it.producto)}`).join(', ');
}

/** Escapa HTML para no pintar sin filtrar texto que el usuario ha escrito en un formulario. */
function escapeHTML(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}


// ============================================================
// VARIABLES GLOBALES
// ============================================================
let editandoId = null;
let semanaActualOffset = 0;
let mesActualOffset = 0;
let vistaCalendarioActual = 'semanal';
let diaSeleccionadoDiario = 'lunes';
let clienteSeleccionado = null;
let pedidoParaEditarId = null;
let pedidoParaProgramarId = null;

let pedidosPendientes = [];
let pedidosCalendario = {};
let clientes = [];
let zonas = [];
let pedidosHojaReparto = [];

const DIAS_SEMANA = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];


// ============================================================
// VALIDACIÓN DE FORMULARIOS (helper genérico)
// ============================================================

/**
 * Valida todos los campos de un formulario usando las reglas HTML5
 * (required, pattern, min, type, etc.), marcando visualmente los
 * campos inválidos y mostrando su mensaje de error asociado
 * (elemento .campo-error dentro del mismo contenedor).
 * Devuelve true si todo el formulario es válido.
 */
function validarFormulario(form) {
    let esValido = true;
    form.querySelectorAll('input, select, textarea').forEach(campo => {
        const contenedor = campo.closest('div');
        const error = contenedor?.querySelector('.campo-error');
        if (!campo.checkValidity()) {
            esValido = false;
            campo.classList.add('input-invalido');
            if (error) error.classList.remove('hidden');
        } else {
            campo.classList.remove('input-invalido');
            if (error) error.classList.add('hidden');
        }
    });
    if (!esValido) {
        form.querySelector('.input-invalido')?.focus();
    }
    return esValido;
}

/** Limpia el resaltado y los mensajes de error de un formulario. */
function limpiarValidacionVisual(form) {
    form.querySelectorAll('.input-invalido').forEach(el => el.classList.remove('input-invalido'));
    form.querySelectorAll('.campo-error').forEach(el => el.classList.add('hidden'));
}

/** Marca un único campo (fuera de un <form>, ej. mini-formularios de Gestión BD) como inválido. */
function marcarCampoInvalido(input, mensaje) {
    if (!input) return;
    input.classList.add('input-invalido');
    input.placeholder = mensaje;
    input.focus();
    setTimeout(() => input.classList.remove('input-invalido'), 2000);
}


// ============================================================
// NAVEGACIÓN POR PESTAÑAS
// ============================================================

async function cambiarPestana(nombrePestana) {
    const contenedor = document.getElementById('contenidoPestanas');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    // Mapa correcto entre nombre de pestaña y el id del botón en index.html
    const mapaBotones = {
        'BaseDatos':   'tabBaseDatos',
        'NuevoPedido': 'tabNuevoPedido',
        'Pendientes':  'tabPendientes',
        'Calendario':  'tabCalendario',
        'GestionBBDD': 'tabGestionBBDD',
        'HojaReparto': 'tabHojaReparto'
    };

    const baseClass     = 'flex-1 px-3 py-3 text-center font-medium text-xs sm:text-sm border-b-2 transition-colors duration-200';
    const inactiveClass = `${baseClass} border-transparent text-gray-500 hover:text-gray-700`;
    const activeClass   = `${baseClass} border-[#158765] text-[#158765] font-semibold`;

    Object.entries(mapaBotones).forEach(([pestana, tabId]) => {
        const tab = document.getElementById(tabId);
        if (tab) tab.className = (pestana === nombrePestana) ? activeClass : inactiveClass;
    });

    try {
        const res = await fetch(`${nombrePestana}.html`);
        if (!res.ok) throw new Error(`No se pudo cargar ${nombrePestana}.html`);
        contenedor.innerHTML = await res.text();

        switch (nombrePestana) {
            case 'BaseDatos':   inicializarBaseDatos();   break;
            case 'NuevoPedido': inicializarNuevoPedido(); break;
            case 'Pendientes':  inicializarPendientes();  break;
            case 'Calendario':  inicializarCalendario();  break;
            case 'GestionBBDD': inicializarGestionBBDD(); break;
            case 'HojaReparto': inicializarHojaReparto(); break;
        }
    } catch (err) {
        console.error(`Error al cargar la pestaña ${nombrePestana}:`, err);
        contenedor.innerHTML = `<p class="text-red-500 p-4">Error al cargar la sección.</p>`;
    }
}

// ============================================================
// INICIALIZADORES DE CADA PESTAÑA
// ============================================================

function inicializarBaseDatos() {
    cargarClientes();
    cargarZonasClienteForm();
    inicializarLocalidadAutocomplete();
    const form = document.getElementById('clienteForm');
    if (form) form.addEventListener('submit', guardarCliente);
}

/** Rellena el <select> de "Zona Reparto" del formulario de Clientes con las zonas dadas de alta en Gestión BD. */
async function cargarZonasClienteForm() {
    const select = document.getElementById('zona_reparto');
    if (!select) return;
    try {
        const res = await fetch('/zonas');
        if (!res.ok) throw new Error('No se pudieron cargar las zonas');
        const zonas = await res.json();
        select.innerHTML = '<option value="">Selecciona una zona...</option>'
            + zonas.map(z => `<option value="${escapeHTML(z.nombre)}">${escapeHTML(z.nombre)}</option>`).join('');
    } catch (err) {
        console.error('Error al cargar zonas para el formulario de clientes:', err);
    }
}

/**
 * Autocompletado de "Localidad" (solo España) en el formulario de Clientes,
 * usando el buscador público de OpenStreetMap (Nominatim) — no hace falta
 * ninguna clave de API. Se espera 350ms tras dejar de escribir (para no
 * disparar una petición por cada tecla) y se piden mínimo 3 letras.
 */
function inicializarLocalidadAutocomplete() {
    const input = document.getElementById('localidad');
    const lista = document.getElementById('localidadSuggestions');
    if (!input || !lista) return;

    let temporizador = null;

    input.addEventListener('input', () => {
        const query = input.value.trim();
        clearTimeout(temporizador);

        if (query.length < 3) {
            lista.classList.add('hidden');
            lista.innerHTML = '';
            return;
        }

        temporizador = setTimeout(async () => {
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=es&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
                const res = await fetch(url);
                if (!res.ok) throw new Error('No se pudo buscar la localidad');
                const resultados = await res.json();

                // Se prefiere el nombre "limpio" de la población (ciudad/pueblo/aldea)
                // en vez de la dirección completa que devuelve Nominatim, y se quitan duplicados.
                const nombres = [];
                resultados.forEach(r => {
                    const nombre = r.address?.city || r.address?.town || r.address?.village
                        || r.address?.municipality || r.address?.hamlet
                        || (r.display_name ? r.display_name.split(',')[0] : null);
                    if (nombre && !nombres.includes(nombre)) nombres.push(nombre);
                });

                lista.innerHTML = '';
                if (nombres.length === 0) { lista.classList.add('hidden'); return; }

                nombres.forEach(nombre => {
                    const li = document.createElement('li');
                    li.textContent = nombre;
                    li.classList.add('cursor-pointer', 'px-4', 'py-2', 'hover:bg-gray-200');
                    li.addEventListener('click', () => {
                        input.value = nombre;
                        lista.classList.add('hidden');
                        lista.innerHTML = '';
                    });
                    lista.appendChild(li);
                });
                lista.classList.remove('hidden');
            } catch (err) {
                console.error('Error al buscar localidades:', err);
            }
        }, 350);
    });

    input.addEventListener('blur', () => {
        // Pequeño retraso para que el clic sobre una sugerencia se registre
        // antes de ocultar la lista.
        setTimeout(() => lista.classList.add('hidden'), 150);
    });
}

function inicializarNuevoPedido() {
    cargarZonasNuevoPedido();
    cargarClientesParaAutocomplete();
    inicializarFormularioPedidos();
}

async function inicializarPendientes() {
    await cargarPedidosPendientes();
    const select = document.getElementById('ordenarPendientes');
    if (select) select.addEventListener('change', ordenarPedidosPendientes);
}

function inicializarCalendario() {
    vistaCalendarioActual = 'semanal';
    cargarPedidosCalendario();
}

function inicializarGestionBBDD() {
    cargarConductores();
    cargarCamiones();
    cargarZonas();

    // El gestor autorizado usa toda la app igual que el propietario, pero no
    // gestiona usuarios ni roles: se le oculta directamente esa tarjeta.
    const tarjetaUsuarios = document.getElementById('tarjetaUsuarios');
    if (rolActual === 'gestor') {
        if (tarjetaUsuarios) tarjetaUsuarios.classList.add('hidden');
        return;
    }
    if (tarjetaUsuarios) tarjetaUsuarios.classList.remove('hidden');

    // Solo un desarrollador puede crear otro desarrollador; un propietario no.
    const selectRol = document.getElementById('nuevoUsuarioRol');
    if (selectRol && rolActual === 'desarrollador' && !selectRol.querySelector('option[value="desarrollador"]')) {
        const opcion = document.createElement('option');
        opcion.value = 'desarrollador';
        opcion.textContent = 'Desarrollador (superadmin)';
        selectRol.appendChild(opcion);
    }

    cargarUsuarios();
}

async function inicializarHojaReparto() {
    const fechaEl = document.getElementById('fechaImpresionHoja');
    if (fechaEl) fechaEl.textContent = `Impreso el ${new Date().toLocaleDateString('es-ES')}`;
    await cargarListasHojaReparto();
    cargarPedidosHoja();
}


// ============================================================
// BASE DE DATOS DE CLIENTES
// ============================================================

async function cargarClientes() {
    try {
        document.getElementById('loading')?.classList.remove('hidden');
        document.getElementById('mensajeVacio')?.classList.add('hidden');

        const res = await fetch('/clientes');
        if (!res.ok) throw new Error('Error en la respuesta del servidor');

        clientes = await res.json();
        const tabla = document.getElementById('listaClientes');
        if (!tabla) return;
        tabla.innerHTML = '';

        if (clientes.length === 0) {
            document.getElementById('mensajeVacio')?.classList.remove('hidden');
            return;
        }

        clientes.forEach(cliente => {
            const fila = document.createElement('tr');
            fila.innerHTML = `
                <td class="px-4 py-2 border">${escapeHTML(cliente.apodo)}</td>
                <td class="px-4 py-2 border">${escapeHTML(cliente.nombre_completo)}</td>
                <td class="px-4 py-2 border">${escapeHTML(cliente.telefono)}</td>
                <td class="px-4 py-2 border">${escapeHTML(cliente.localidad)}</td>
                <td class="px-4 py-2 border">${escapeHTML(cliente.zona_reparto)}</td>
                <td class="px-4 py-2 border">${escapeHTML(cliente.observaciones)}</td>
                <td class="px-4 py-2 border flex gap-2">
                    <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                        onclick='abrirModal(${JSON.stringify(cliente).replace(/'/g, '&#39;')})'>
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="bg-[#158765] hover:bg-[#0f6b50] text-white px-3 py-1 rounded"
                        onclick="exportarHistorialClientePDF(${cliente.id})" title="Exportar historial a PDF">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                        onclick="eliminarCliente(${cliente.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tabla.appendChild(fila);
        });

    } catch (err) {
        console.error('Error cargando clientes:', err);
    } finally {
        document.getElementById('loading')?.classList.add('hidden');
    }
}

async function guardarCliente(event) {
    event.preventDefault();
    const form = event.target;
    if (!validarFormulario(form)) return;

    const id = document.getElementById('clienteId')?.value;
    const cliente = {
        apodo:           document.getElementById('apodo').value,
        nombre_completo: document.getElementById('nombre_completo').value,
        telefono:        document.getElementById('telefono').value,
        localidad:       document.getElementById('localidad').value,
        zona_reparto:    document.getElementById('zona_reparto').value,
        observaciones:   document.getElementById('observaciones').value
    };

    try {
        const res = await fetch(id ? `/clientes/${id}` : '/clientes', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cliente)
        });
        if (!res.ok) throw new Error((await res.json())?.error || 'Error al guardar el cliente');
        cerrarModal();
        cargarClientes();
    } catch (err) {
        console.error('Error guardando cliente:', err);
        alert('Error: ' + err.message);
    }
}

function abrirModal(cliente = null) {
    const form = document.getElementById('clienteForm');
    form?.reset();
    if (form) limpiarValidacionVisual(form);
    document.getElementById('clienteId').value = '';

    if (cliente) {
        document.getElementById('clienteId').value      = cliente.id || '';
        document.getElementById('apodo').value           = cliente.apodo || '';
        document.getElementById('nombre_completo').value = cliente.nombre_completo || '';
        document.getElementById('telefono').value        = cliente.telefono || '';
        document.getElementById('localidad').value       = cliente.localidad || '';
        document.getElementById('zona_reparto').value    = cliente.zona_reparto || '';
        document.getElementById('observaciones').value   = cliente.observaciones || '';
        document.getElementById('modalTitle').innerText  = 'Editar Cliente';
    } else {
        document.getElementById('modalTitle').innerText  = 'Agregar Cliente';
    }

    const modal = document.getElementById('clienteModal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        const content = modal.querySelector('.modal-content');
        content.classList.remove('scale-95', 'opacity-0');
        content.classList.add('scale-100', 'opacity-100');
    }, 10);
}

function cerrarModal() {
    const modal = document.getElementById('clienteModal');
    const content = modal.querySelector('.modal-content');
    content.classList.remove('scale-100', 'opacity-100');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
}

async function eliminarCliente(id) {
    if (!id || !(await confirmarAccion('¿Seguro que deseas eliminar este cliente?'))) return;
    try {
        const res = await fetch(`/clientes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al eliminar cliente');
        cargarClientes();
    } catch (err) {
        console.error('Error eliminando cliente:', err);
    }
}


// ============================================================
// NUEVO PEDIDO
// ============================================================

async function cargarClientesParaAutocomplete() {
    const apodoInput  = document.getElementById('apodoAutoComplete');
    const suggestions = document.getElementById('autocompleteSuggestions');
    if (!apodoInput) return;

    const res = await fetch('/clientes');
    const clientesData = await res.json();

    apodoInput.addEventListener('input', () => {
        const query = apodoInput.value.toLowerCase();
        suggestions.innerHTML = '';
        if (!query) { suggestions.classList.add('hidden'); return; }

        const matches = clientesData.filter(c => c.apodo.toLowerCase().includes(query));
        if (matches.length === 0) { suggestions.classList.add('hidden'); return; }

        matches.forEach(cliente => {
            const li = document.createElement('li');
            li.textContent = cliente.apodo;
            li.classList.add('cursor-pointer', 'px-4', 'py-2', 'hover:bg-gray-200');
            li.addEventListener('click', () => {
                apodoInput.value = cliente.apodo;
                clienteSeleccionado = cliente;
                rellenarCamposCliente(cliente);
                cargarUltimosPedidosCliente(cliente.id);
                suggestions.classList.add('hidden');
            });
            suggestions.appendChild(li);
        });
        suggestions.classList.remove('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!apodoInput.contains(e.target)) suggestions.classList.add('hidden');
    });
}

function rellenarCamposCliente(cliente) {
    document.getElementById('nombreCompleto').value = cliente.nombre_completo;
    document.getElementById('zonaReparto').value    = cliente.zona_reparto;
    document.getElementById('localidad').value      = cliente.localidad;
}

/** Busca y muestra los últimos 3 pedidos del cliente para poder repetirlos con un clic. */
async function cargarUltimosPedidosCliente(clienteId) {
    const contenedor = document.getElementById('ultimosPedidosCliente');
    const lista = document.getElementById('listaUltimosPedidos');
    if (!contenedor || !lista) return;

    try {
        const res = await fetch(`/pedidos_historial/${clienteId}`);
        if (!res.ok) throw new Error('No se pudo cargar el historial');
        const pedidos = await res.json();

        if (!pedidos || pedidos.length === 0) {
            contenedor.classList.add('hidden');
            lista.innerHTML = '';
            return;
        }

        lista.innerHTML = '';
        pedidos.forEach(p => {
            const li = document.createElement('li');
            li.className = 'cursor-pointer text-sm bg-white hover:bg-emerald-100 border border-emerald-200 rounded px-2 py-1 transition-colors';
            const fecha = p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleDateString('es-ES') : '';
            const items = p.items && p.items.length > 0 ? p.items : [];
            const resumen = items.map(it => `<strong>${escapeHTML(it.cantidad)}</strong> de <strong>${escapeHTML(it.producto)}</strong>`).join(', ');
            li.innerHTML = `${resumen} <span class="text-gray-400">— ${fecha}</span>`;
            li.addEventListener('click', () => repetirPedidoAnterior(p));
            lista.appendChild(li);
        });
        contenedor.classList.remove('hidden');
    } catch (err) {
        console.error('Error al cargar últimos pedidos del cliente:', err);
        contenedor.classList.add('hidden');
    }
}

/** Vacía la lista de productos del formulario y añade una fila en blanco. */
function reiniciarItemsPedido() {
    const lista = document.getElementById('itemsPedidoLista');
    if (!lista) return;
    lista.innerHTML = '';
    agregarFilaItemPedido();
}

/** Añade una fila de "cantidad + producto" al formulario de Nuevo Pedido. */
function agregarFilaItemPedido(cantidad = '', producto = '') {
    const lista = document.getElementById('itemsPedidoLista');
    if (!lista) return;

    const fila = document.createElement('div');
    fila.className = 'flex gap-2 items-start item-pedido-fila';
    fila.innerHTML = `
        <input type="number" min="1" step="1" placeholder="Cantidad" value="${escapeHTML(cantidad)}"
            class="w-28 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#20c997] focus:border-transparent item-cantidad">
        <input type="text" placeholder="Producto (ej. Pienso de gato)" value="${escapeHTML(producto)}"
            class="flex-1 min-w-0 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#20c997] focus:border-transparent item-producto">
        <button type="button" onclick="eliminarFilaItemPedido(this)" class="text-gray-400 hover:text-red-600 px-2 py-2" title="Quitar producto">
            <i class="fas fa-trash"></i>
        </button>
    `;
    lista.appendChild(fila);
}

function eliminarFilaItemPedido(boton) {
    const lista = document.getElementById('itemsPedidoLista');
    if (!lista) return;
    // Siempre debe quedar al menos una fila.
    if (lista.querySelectorAll('.item-pedido-fila').length <= 1) return;
    boton.closest('.item-pedido-fila')?.remove();
}

/** Lee todas las filas de producto/cantidad y devuelve solo las que están completas. */
function recolectarItemsPedido() {
    const filas = document.querySelectorAll('#itemsPedidoLista .item-pedido-fila');
    const items = [];
    filas.forEach(fila => {
        const cantidad = fila.querySelector('.item-cantidad')?.value.trim();
        const producto = fila.querySelector('.item-producto')?.value.trim();
        if (cantidad && producto) items.push({ cantidad, producto });
    });
    return items;
}

/** Sustituye los productos del formulario por los de un pedido anterior seleccionado. */
function repetirPedidoAnterior(pedido) {
    const lista = document.getElementById('itemsPedidoLista');
    if (!lista || !pedido.items || pedido.items.length === 0) return;
    lista.innerHTML = '';
    pedido.items.forEach(it => {
        const cantidadNum = parseInt(it.cantidad, 10);
        agregarFilaItemPedido(Number.isFinite(cantidadNum) ? cantidadNum : (it.cantidad || ''), it.producto || '');
    });
}

function inicializarFormularioPedidos() {
    const tipoPedido = document.getElementById('tipoPedido');
    if (tipoPedido) {
        tipoPedido.addEventListener('change', () => {
            const container = document.getElementById('diasSemanaContainer');
            if (container) container.classList.toggle('hidden', !['semanal', 'quincena', 'mensual'].includes(tipoPedido.value));
        });
    }

    reiniciarItemsPedido();

    const form = document.getElementById('nuevoPedidoForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const apodoInput = document.getElementById('apodoAutoComplete');
        const apodoError = apodoInput?.closest('div')?.querySelector('.campo-error');
        const clienteValido = !!clienteSeleccionado && apodoInput?.value === clienteSeleccionado.apodo;

        if (apodoInput) {
            apodoInput.classList.toggle('input-invalido', !clienteValido);
            apodoError?.classList.toggle('hidden', clienteValido);
        }

        const items = recolectarItemsPedido();
        const errorItems = document.getElementById('errorItemsPedido');
        errorItems?.classList.toggle('hidden', items.length > 0);

        const formValido = validarFormulario(form);
        if (!clienteValido || !formValido || items.length === 0) {
            if (!clienteValido) apodoInput?.focus();
            return;
        }

        const pedidoData = {
            cliente_id:    clienteSeleccionado.id,
            apodo_cliente: clienteSeleccionado.apodo,
            tipo:          document.getElementById('tipoPedido').value,
            dia_semana:    document.getElementById('diaSemana')?.value || null,
            items:         items,
            fecha_entrega: document.getElementById('fechaEntregaNuevo').value,
            observaciones: document.getElementById('observacionesPedido').value || null
        };

        try {
            const res = await fetch('/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pedidoData)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.details || data.error || 'Error desconocido');
            mostrarMensajeExito('¡Pedido registrado con éxito!');
        } catch (err) {
            console.error('Error al registrar pedido:', err.message);
            alert('Error: ' + err.message);
        }
    });
}

function limpiarFormularioPedido() {
    const form = document.getElementById('nuevoPedidoForm');
    form?.reset();
    if (form) limpiarValidacionVisual(form);
    clienteSeleccionado = null;
    document.getElementById('autocompleteSuggestions')?.classList.add('hidden');
    document.getElementById('ultimosPedidosCliente')?.classList.add('hidden');
    document.getElementById('errorItemsPedido')?.classList.add('hidden');
    if (document.getElementById('nombreCompleto')) document.getElementById('nombreCompleto').value = '';
    if (document.getElementById('zonaReparto'))    document.getElementById('zonaReparto').value    = '';
    if (document.getElementById('localidad'))      document.getElementById('localidad').value      = '';
    reiniciarItemsPedido();
}

async function cargarZonasNuevoPedido() {
    try {
        const res = await fetch('/zonas');
        const data = await res.json();
        const select = document.getElementById('zonaRepartoNuevo');
        if (!select) return;
        select.innerHTML = '';
        data.forEach(zona => {
            const opt = document.createElement('option');
            opt.value = zona.nombre; opt.textContent = zona.nombre;
            select.appendChild(opt);
        });
    } catch (err) { console.error('Error al cargar zonas:', err); }
}

function mostrarMensajeExito(texto) {
    let popup = document.getElementById('mensajeExito');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'mensajeExito';
        popup.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 opacity-0 transition-opacity duration-300 flex items-center gap-2';
        document.body.appendChild(popup);
    }
    popup.innerHTML = `<i class="fas fa-circle-check"></i> <span>${texto}</span>`;
    popup.classList.add('opacity-100');
    setTimeout(() => {
        popup.classList.remove('opacity-100');
        limpiarFormularioPedido();
    }, 2500);
}


// ============================================================
// PEDIDOS PENDIENTES
// ============================================================

async function cargarPedidosPendientes() {
    document.getElementById('loadingPendientes')?.classList.remove('hidden');
    try {
        const res = await fetch('/pedidos/pendientes');
        pedidosPendientes = await res.json();
        renderizarPedidosPendientes(pedidosPendientes);
    } catch (err) {
        console.error('Error al cargar pedidos pendientes:', err);
    } finally {
        document.getElementById('loadingPendientes')?.classList.add('hidden');
    }
}

function renderizarPedidosPendientes(pedidos) {
    const lista     = document.getElementById('listaPedidosPendientes');
    const vacio     = document.getElementById('mensajeVacioPendientes');
    const totalSpan = document.getElementById('totalPendientes');
    if (!lista || !vacio) return;

    lista.innerHTML = '';

    if (pedidos.length === 0) {
        vacio.classList.remove('hidden');
    } else {
        vacio.classList.add('hidden');
        pedidos.forEach(pedido => {
            const item = document.createElement('div');
            item.className = 'bg-white rounded-lg shadow-sm p-4 border border-gray-200';
            item.innerHTML = `
                <div class="flex flex-col gap-1 mb-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span class="text-sm font-semibold text-gray-700">
                        ${escapeHTML(pedido.apodo)} — ${escapeHTML(pedido.localidad)}
                    </span>
                    <span class="text-xs text-gray-500">
                        Zona: <strong>${escapeHTML(pedido.zona) || 'N/A'}</strong>
                        &nbsp;|&nbsp; Día: <strong>${escapeHTML(pedido.dia_reparto) || 'N/A'}</strong>
                    </span>
                </div>
                <p class="text-gray-800 text-lg font-bold">${escapeHTML(pedido.pedido)}</p>
                <p class="text-sm text-gray-500 mt-1">
                    Fecha programada: ${pedido.fecha_programacion
                        ? new Date(pedido.fecha_programacion).toLocaleDateString('es-ES')
                        : 'Sin fecha'}
                </p>
                <p class="text-sm text-gray-500">Obs: ${escapeHTML(pedido.observaciones) || 'Ninguna'}</p>
                <div class="flex justify-end gap-2 mt-4">
                    <button onclick="cancelarPedidoPendiente(${pedido.id})"
                        class="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-lg text-sm border border-red-200">
                        <i class="fas fa-ban mr-1"></i> Cancelar
                    </button>
                    <button onclick="mostrarCalendarioModal(${pedido.historial_id})"
                        class="bg-[#158765] hover:bg-[#0f6b50] text-white px-4 py-2 rounded-lg text-sm">
                        <i class="fas fa-calendar-days mr-1"></i> Programar en Calendario
                    </button>
                </div>
            `;
            lista.appendChild(item);
        });
    }

    if (totalSpan) totalSpan.textContent = pedidos.length;
}

/** Cancela (elimina) un pedido que aún está pendiente de programar, sin tocar el histórico del cliente. */
async function cancelarPedidoPendiente(id) {
    if (!(await confirmarAccion('¿Cancelar este pedido pendiente? No se podrá deshacer.', 'Cancelar pedido'))) return;
    try {
        const res = await fetch(`/pedidos_pendientes/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo cancelar el pedido');
        await cargarPedidosPendientes();
        mostrarMensajeExito('Pedido cancelado');
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function ordenarPedidosPendientes() {
    const criterio = document.getElementById('ordenarPendientes').value;
    pedidosPendientes.sort((a, b) => {
        if (criterio === 'zona')         return (a.zona || '').localeCompare(b.zona || '');
        if (criterio === 'apodo')        return (a.apodo || '').localeCompare(b.apodo || '');
        if (criterio === 'fechaEntrega') return new Date(a.fecha_programacion) - new Date(b.fecha_programacion);
        return 0;
    });
    renderizarPedidosPendientes(pedidosPendientes);
}

function mostrarCalendarioModal(historialId) {
    pedidoParaProgramarId = historialId;
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function cerrarCalendarioModal() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    pedidoParaProgramarId = null;
}

async function programarPedidoConFecha() {
    const fecha = document.getElementById('fechaProgramacion').value;
    if (!fecha) { alert('Selecciona una fecha.'); return; }
    if (!pedidoParaProgramarId) { alert('Error: no hay pedido seleccionado.'); return; }

    try {
        const res = await fetch(`/pedidos/programar-con-fecha/${pedidoParaProgramarId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Error al programar el pedido');
        }
        const data = await res.json();
        cerrarCalendarioModal();
        mostrarMensajeExito(`Pedido de ${data.apodo} programado para el ${data.dia_reparto}`);
        await cargarPedidosPendientes();
    } catch (err) {
        console.error('Error al programar:', err.message);
        alert('Error: ' + err.message);
    }
}


// ============================================================
// CALENDARIO
// ============================================================

/**
 * Devuelve un array de 7 objetos Date (lunes→domingo) para la semana
 * desplazada 'offset' semanas respecto a hoy.
 */
function getWeekDays(offset = 0) {
    const today = new Date();
    today.setDate(today.getDate() + offset * 7);
    const day   = today.getDay();
    const lunes = new Date(today);
    lunes.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(lunes);
        d.setDate(lunes.getDate() + i);
        return d;
    });
}

async function cargarPedidosCalendario() {
    if (vistaCalendarioActual === 'mensual') {
        await cargarPedidosMensual();
        return;
    }

    const diasSem = getWeekDays(semanaActualOffset);

    const titulo = document.getElementById('tituloCalendario');
    if (titulo) {
        titulo.textContent = `Semana: ${diasSem[0].toLocaleDateString('es-ES')} — ${diasSem[6].toLocaleDateString('es-ES')}`;
    }

    const btnPeriodo = document.getElementById('btnPeriodoActual');
    if (btnPeriodo) btnPeriodo.textContent = 'Semana Actual';

    document.getElementById('loadingCalendarioSemanal')?.classList.remove('hidden');
    try {
        const res = await fetch(`/pedidos_calendario?offset=${semanaActualOffset}`);
        if (!res.ok) throw new Error('Error al cargar pedidos del calendario');
        const pedidos = await res.json();

        if (vistaCalendarioActual === 'semanal') {
            renderizarVistaSemanal(pedidos, diasSem);
        } else {
            cambiarDiaDiario();
        }
    } catch (err) {
        console.error('Error al cargar pedidos del calendario:', err);
    } finally {
        document.getElementById('loadingCalendarioSemanal')?.classList.add('hidden');
    }
}

async function cargarPedidosMensual() {
    const btnPeriodo = document.getElementById('btnPeriodoActual');
    if (btnPeriodo) btnPeriodo.textContent = 'Mes Actual';

    const hoy = new Date();
    const mesRef = new Date(hoy.getFullYear(), hoy.getMonth() + mesActualOffset, 1);

    document.getElementById('loadingCalendarioMensual')?.classList.remove('hidden');
    try {
        const res = await fetch(`/pedidos_calendario?vista=mensual&offset=${mesActualOffset}`);
        if (!res.ok) throw new Error('Error al cargar pedidos del calendario');
        const pedidos = await res.json();
        renderizarVistaMensual(pedidos, mesRef);
    } catch (err) {
        console.error('Error al cargar pedidos del calendario (mensual):', err);
    } finally {
        document.getElementById('loadingCalendarioMensual')?.classList.add('hidden');
    }
}

function cambiarVistaCalendario(vista) {
    vistaCalendarioActual = vista;
    const btnSemanal      = document.getElementById('btnVistaSemanal');
    const btnMensual       = document.getElementById('btnVistaMensual');
    const btnDiaria       = document.getElementById('btnVistaDiaria');
    const vistaSemanalDiv = document.getElementById('vistaSemanal');
    const vistaMensualDiv = document.getElementById('vistaMensual');
    const vistaDiariaDiv  = document.getElementById('vistaDiaria');
    const controlesNav    = document.getElementById('controlesNavegacion');

    const activoClass   = 'bg-[#158765] hover:bg-[#0f6b50] text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
    const inactivoClass = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';

    [btnSemanal, btnMensual, btnDiaria].forEach(btn => { if (btn) btn.className = inactivoClass; });
    vistaSemanalDiv?.classList.add('hidden');
    vistaMensualDiv?.classList.add('hidden');
    vistaDiariaDiv?.classList.add('hidden');

    if (vista === 'semanal') {
        if (btnSemanal) btnSemanal.className = activoClass;
        vistaSemanalDiv?.classList.remove('hidden');
        controlesNav?.classList.remove('hidden');
        cargarPedidosCalendario();
    } else if (vista === 'mensual') {
        if (btnMensual) btnMensual.className = activoClass;
        vistaMensualDiv?.classList.remove('hidden');
        controlesNav?.classList.remove('hidden');
        cargarPedidosCalendario();
    } else {
        if (btnDiaria) btnDiaria.className = activoClass;
        vistaDiariaDiv?.classList.remove('hidden');
        controlesNav?.classList.add('hidden');
        cambiarDiaDiario();
    }
}

function renderizarVistaMensual(pedidos, mesRef) {
    const contenedor = document.getElementById('gridMensual');
    const titulo = document.getElementById('tituloMesMensual');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    if (titulo) {
        titulo.textContent = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(mesRef);
    }

    const anio = mesRef.getFullYear();
    const mes  = mesRef.getMonth();
    const primerDia = new Date(anio, mes, 1);
    const ultimoDia = new Date(anio, mes + 1, 0);

    // Índice de columna (0=lunes ... 6=domingo) del día 1 del mes.
    const diaSemanaPrimero = (primerDia.getDay() + 6) % 7;

    // Celdas vacías de relleno antes del día 1.
    for (let i = 0; i < diaSemanaPrimero; i++) {
        const vacio = document.createElement('div');
        vacio.className = 'bg-gray-50 min-h-24';
        contenedor.appendChild(vacio);
    }

    const hoyStr = new Date().toISOString().split('T')[0];

    for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const fecha = new Date(anio, mes, dia);
        const fechaStr = fecha.toISOString().split('T')[0];
        const pedidosDia = pedidos.filter(p => (p.fecha_reparto || '').startsWith(fechaStr));
        const esHoy = fechaStr === hoyStr;

        const celda = document.createElement('div');
        celda.className = `bg-white min-h-24 p-1 flex flex-col ${esHoy ? 'ring-2 ring-inset ring-[#158765]' : ''}`;
        celda.innerHTML = `
            <p class="text-xs font-semibold text-gray-600 mb-1">${dia}</p>
            <div class="space-y-1 overflow-y-auto max-h-20">
                ${pedidosDia.map(p => `
                    <div class="bg-emerald-50 border border-emerald-100 rounded px-1 py-0.5 text-[10px] leading-tight cursor-pointer hover:bg-emerald-100 truncate"
                         title="${escapeHTML(p.apodo_cliente)}: ${escapeHTML(resumenItemsTexto(p.items))}"
                         onclick="mostrarDetallesPedido(${p.id})">
                        ${escapeHTML(p.apodo_cliente)}
                    </div>
                `).join('')}
            </div>
        `;
        contenedor.appendChild(celda);
    }
}

function periodoAnterior() {
    if (vistaCalendarioActual === 'mensual') { mesActualOffset--; }
    else { semanaActualOffset--; }
    cargarPedidosCalendario();
}

function periodoSiguiente() {
    if (vistaCalendarioActual === 'mensual') { mesActualOffset++; }
    else { semanaActualOffset++; }
    cargarPedidosCalendario();
}

function periodoActual() {
    if (vistaCalendarioActual === 'mensual') { mesActualOffset = 0; }
    else { semanaActualOffset = 0; }
    cargarPedidosCalendario();
}

function renderizarVistaSemanal(pedidos, diasSem) {
    const contenedor = document.getElementById('vistaSemanal');
    if (!contenedor) return;
    contenedor.innerHTML = '';

    diasSem.forEach(dia => {
        const fechaStr   = dia.toISOString().split('T')[0];
        const nombreDia  = new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(dia);
        // Filtramos por fecha_reparto que devuelve el servidor
        const pedidosDia = pedidos.filter(p => (p.fecha_reparto || '').startsWith(fechaStr));

        const col = document.createElement('div');
        col.className = 'bg-white p-4 rounded-lg shadow-md min-h-48 flex flex-col';
        col.innerHTML = `
            <p class="font-bold text-sm text-center text-gray-800 capitalize">${nombreDia}</p>
            <p class="text-xs text-gray-400 text-center mb-3">${dia.toLocaleDateString('es-ES')}</p>
            <div class="space-y-2 flex-grow">
                ${pedidosDia.length === 0
                    ? '<p class="text-xs text-gray-400 text-center mt-2">Sin pedidos</p>'
                    : pedidosDia.map(p => `
                        <div class="border border-gray-200 rounded-lg p-2 cursor-pointer hover:bg-emerald-50 transition-colors"
                             onclick="mostrarDetallesPedido(${p.id})">
                            <p class="text-sm font-semibold text-gray-800">${escapeHTML(p.apodo_cliente)}</p>
                            <p class="text-xs text-gray-500">${resumenItemsTexto(p.items)}</p>
                        </div>
                    `).join('')
                }
            </div>
        `;
        contenedor.appendChild(col);
    });
}

async function cambiarDiaDiario() {
    const select = document.getElementById('selectDiaDiario');
    const lista  = document.getElementById('pedidosDiarios');
    const vacio  = document.getElementById('mensajeVacioDiario');
    if (!select || !lista || !vacio) return;

    diaSeleccionadoDiario = select.value;
    lista.innerHTML = '';
    vacio.classList.add('hidden');
    document.getElementById('loadingCalendarioDiario')?.classList.remove('hidden');

    try {
        const res = await fetch(`/pedidos/diarios/${diaSeleccionadoDiario}`);
        const pedidos = await res.json();

        if (pedidos.length > 0) {
            vacio.classList.add('hidden');
            pedidos.forEach(p => {
                const div = document.createElement('div');
                div.className = 'bg-white p-4 rounded-lg shadow-md border cursor-pointer hover:bg-gray-50';
                div.onclick = () => mostrarDetallesPedido(p.id);
                div.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div>
                            <h3 class="font-bold text-lg">${escapeHTML(p.apodo_cliente)}</h3>
                            <p class="text-sm text-gray-600">${resumenItemsTexto(p.items)}</p>
                        </div>
                        <span class="text-xs text-gray-400">
                            ${p.fecha_reparto ? new Date(p.fecha_reparto).toLocaleDateString('es-ES') : ''}
                        </span>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">Obs: ${escapeHTML(p.observaciones) || 'Ninguna'}</p>
                `;
                lista.appendChild(div);
            });
        } else {
            vacio.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error al cargar pedidos diarios:', err);
    } finally {
        document.getElementById('loadingCalendarioDiario')?.classList.add('hidden');
    }
}

async function enviarDiaAHojaReparto() {
    const dia = document.getElementById('selectDiaDiario')?.value;
    try {
        const res = await fetch(`/pedidos/diarios/${dia}`);
        const pedidos = await res.json();
        if (pedidos.length === 0) { alert('No hay pedidos para este día.'); return; }
        const ids = pedidos.map(p => p.id);
        const res2 = await fetch('/pedidos/hoja-reparto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        if (!res2.ok) throw new Error('Error al enviar pedidos a la hoja');
        mostrarMensajeExito(`${pedidos.length} pedido(s) enviados a la hoja de reparto`);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// Modal de detalles (creado dinámicamente porque no existe en ningún HTML)
async function mostrarDetallesPedido(id) {
    try {
        const res = await fetch(`/pedidos/detalles/${id}`);
        if (!res.ok) throw new Error('Error al obtener detalles');
        const pedido = await res.json();
        pedidoParaEditarId = id;

        let modal = document.getElementById('detallesPedidoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'detallesPedidoModal';
            document.body.appendChild(modal);
        }
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Detalles del Pedido</h3>
                    <button onclick="cerrarDetallesPedidoModal()" class="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
                </div>
                <div class="space-y-2 text-sm text-gray-700">
                    <p><strong>Cliente:</strong> ${escapeHTML(pedido.apodo_cliente) || 'N/A'}</p>
                    <p><strong>Productos:</strong> ${resumenItemsTexto(pedido.items) || 'N/A'}</p>
                    <p><strong>Fecha de entrega:</strong> ${new Date(pedido.fecha_entrega).toLocaleDateString('es-ES')}</p>
                    <p><strong>Teléfono:</strong> ${escapeHTML(pedido.telefono) || 'N/A'}</p>
                    <p><strong>Localidad:</strong> ${escapeHTML(pedido.localidad) || 'N/A'}</p>
                    <p><strong>Observaciones:</strong> ${escapeHTML(pedido.observaciones) || 'N/A'}</p>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <button onclick="cerrarDetallesPedidoModal()"
                        class="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg text-sm">Cerrar</button>
                    <button onclick="mostrarModalEditarFecha('${new Date(pedido.fecha_entrega).toISOString().split('T')[0]}')"
                        class="px-4 py-2 bg-[#158765] hover:bg-[#0f6b50] text-white rounded-lg text-sm"><i class="fas fa-pen mr-1"></i> Editar Fecha</button>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Error al mostrar detalles:', err);
        alert('No se pudieron cargar los detalles del pedido.');
    }
}

function cerrarDetallesPedidoModal() {
    const modal = document.getElementById('detallesPedidoModal');
    if (modal) modal.classList.add('hidden');
}

function mostrarModalEditarFecha(fechaActual) {
    cerrarDetallesPedidoModal();
    const modal = document.getElementById('editarFechaModal');
    const input = document.getElementById('inputNuevaFecha');
    if (!modal || !input) return;
    input.value = fechaActual;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function cerrarModalEditarFecha() {
    const modal = document.getElementById('editarFechaModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    pedidoParaEditarId = null;
}

async function guardarNuevaFecha() {
    if (!pedidoParaEditarId) { alert('No hay pedido seleccionado.'); return; }
    const nuevaFecha = document.getElementById('inputNuevaFecha').value;
    if (!nuevaFecha) { alert('Selecciona una fecha válida.'); return; }

    try {
        const res = await fetch(`/pedidos/editar-fecha/${pedidoParaEditarId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha: nuevaFecha })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        cerrarModalEditarFecha();
        mostrarMensajeExito('Fecha actualizada correctamente');
        cargarPedidosCalendario();
    } catch (err) {
        alert('Error al actualizar fecha: ' + err.message);
    }
}

function semanaActual()    { semanaActualOffset = 0;  cargarPedidosCalendario(); }
function semanaAnterior()  { semanaActualOffset--;    cargarPedidosCalendario(); }
function semanaSiguiente() { semanaActualOffset++;    cargarPedidosCalendario(); }


// ============================================================
// GESTIÓN BBDD (Conductores, Camiones, Zonas)
// ============================================================

async function cargarConductores() {
    document.getElementById('loadingConductores')?.classList.remove('hidden');
    try {
        const res = await fetch('/conductores');
        const data = await res.json();
        const lista = document.getElementById('listaConductores');
        if (!lista) return;
        lista.innerHTML = '';
        data.forEach(c => {
            const li = document.createElement('li');
            li.className = 'p-3 flex items-center justify-between hover:bg-gray-100';
            li.innerHTML = `
                <span class="text-gray-800">${escapeHTML(c.nombre)}</span>
                <button onclick="eliminarConductor(${c.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar conductores:', err);
    } finally {
        document.getElementById('loadingConductores')?.classList.add('hidden');
    }
}

async function agregarConductor() {
    const input = document.getElementById('nuevoConductor');
    const nombre = input?.value.trim();
    if (!nombre) { marcarCampoInvalido(input, 'Escribe un nombre antes de agregar'); return; }
    try {
        const res = await fetch('/conductores', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        if (res.ok) { input.value = ''; cargarConductores(); }
    } catch (err) { console.error(err); }
}

async function eliminarConductor(id) {
    if (!(await confirmarAccion('¿Eliminar este conductor?'))) return;
    try {
        const res = await fetch(`/conductores/${id}`, { method: 'DELETE' });
        if (res.ok) cargarConductores();
    } catch (err) { console.error(err); }
}

async function cargarCamiones() {
    document.getElementById('loadingCamiones')?.classList.remove('hidden');
    try {
        const res = await fetch('/camiones');
        const data = await res.json();
        const lista = document.getElementById('listaCamiones');
        if (!lista) return;
        lista.innerHTML = '';
        data.forEach(c => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3';
            li.innerHTML = `
                <span>${escapeHTML(c.nombre)}</span>
                <button onclick="eliminarCamion(${c.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar camiones:', err);
    } finally {
        document.getElementById('loadingCamiones')?.classList.add('hidden');
    }
}

async function agregarCamion() {
    const input = document.getElementById('nuevoCamion');
    const matricula = input?.value.trim();
    if (!matricula) { marcarCampoInvalido(input, 'Escribe una matrícula antes de agregar'); return; }
    try {
        const res = await fetch('/camiones', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matricula })
        });
        if (res.ok) { input.value = ''; cargarCamiones(); }
    } catch (err) { console.error(err); }
}

async function eliminarCamion(id) {
    if (!(await confirmarAccion('¿Eliminar este camión?'))) return;
    try {
        const res = await fetch(`/camiones/${id}`, { method: 'DELETE' });
        if (res.ok) cargarCamiones();
    } catch (err) { console.error(err); }
}

async function cargarZonas() {
    document.getElementById('loadingZonas')?.classList.remove('hidden');
    try {
        const res = await fetch('/zonas');
        const data = await res.json();
        const lista = document.getElementById('listaZonas');
        if (!lista) return;
        lista.innerHTML = '';
        data.forEach(z => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3';
            li.innerHTML = `
                <span>${escapeHTML(z.nombre)}</span>
                <button onclick="eliminarZona(${z.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar zonas:', err);
    } finally {
        document.getElementById('loadingZonas')?.classList.add('hidden');
    }
}

async function agregarZona() {
    const input = document.getElementById('nuevaZona');
    const nombre = input?.value.trim();
    if (!nombre) { marcarCampoInvalido(input, 'Escribe un nombre antes de agregar'); return; }
    try {
        const res = await fetch('/zonas', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        if (res.ok) { input.value = ''; cargarZonas(); }
    } catch (err) { console.error(err); }
}

async function eliminarZona(id) {
    if (!(await confirmarAccion('¿Eliminar esta zona?'))) return;
    try {
        const res = await fetch(`/zonas/${id}`, { method: 'DELETE' });
        if (res.ok) cargarZonas();
    } catch (err) { console.error(err); }
}

// --- Usuarios con acceso a la app ---
// Jerarquía de roles (debe reflejar la del servidor en server.js:
// puedeGestionarRol): el desarrollador gestiona a cualquiera; el propietario
// gestiona propietarios y gestores pero nunca a un desarrollador; el gestor
// no gestiona usuarios (ni siquiera ve esta tarjeta, ver inicializarGestionBBDD).
function puedeGestionarRolCliente(rolObjetivo) {
    if (rolActual === 'desarrollador') return true;
    if (rolActual === 'propietario') return rolObjetivo !== 'desarrollador';
    return false;
}

async function cargarUsuarios() {
    document.getElementById('loadingUsuarios')?.classList.remove('hidden');
    try {
        const res = await fetch('/usuarios');
        if (!res.ok) throw new Error('Error al obtener usuarios');
        const data = await res.json();
        const lista = document.getElementById('listaUsuarios');
        if (!lista) return;
        lista.innerHTML = '';
        data.forEach(u => {
            const puedeGestionar = puedeGestionarRolCliente(u.rol) && u.id !== usuarioActualId;
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 gap-2';

            const opcionesRol = ['gestor', 'propietario', 'desarrollador']
                .filter(r => r !== 'desarrollador' || rolActual === 'desarrollador')
                .map(r => `<option value="${r}" ${r === u.rol ? 'selected' : ''}>${escapeHTML(ETIQUETAS_ROL[r])}</option>`)
                .join('');

            li.innerHTML = `
                <div class="min-w-0">
                    <span class="block truncate">${escapeHTML(u.nombre)} <span class="text-gray-400 text-sm">(${escapeHTML(u.nombre_usuario)})</span></span>
                    ${u.email ? `<span class="block text-xs text-gray-400 truncate">${escapeHTML(u.email)}</span>` : ''}
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    ${puedeGestionar
                        ? `<select onchange="cambiarRolUsuario(${u.id}, this.value)" class="text-xs border rounded px-1 py-1 focus:ring-2 focus:ring-[#20c997]">${opcionesRol}</select>`
                        : `<span class="text-xs text-gray-500">${escapeHTML(ETIQUETAS_ROL[u.rol] || u.rol)}</span>`}
                    ${puedeGestionar
                        ? `<button onclick="eliminarUsuario(${u.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>`
                        : ''}
                </div>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar usuarios:', err);
    } finally {
        document.getElementById('loadingUsuarios')?.classList.add('hidden');
    }
}

async function agregarUsuario() {
    const nombreInput = document.getElementById('nuevoUsuarioNombre');
    const loginInput = document.getElementById('nuevoUsuarioLogin');
    const emailInput = document.getElementById('nuevoUsuarioEmail');
    const rolInput = document.getElementById('nuevoUsuarioRol');
    const passwordInput = document.getElementById('nuevoUsuarioPassword');
    const nombre = nombreInput?.value.trim();
    const nombre_usuario = loginInput?.value.trim();
    const email = emailInput?.value.trim();
    const rol = rolInput?.value || 'gestor';
    const contrasena = passwordInput?.value;

    if (!nombre) { marcarCampoInvalido(nombreInput, 'Escribe un nombre'); return; }
    if (!nombre_usuario) { marcarCampoInvalido(loginInput, 'Escribe un usuario'); return; }
    if (!contrasena || contrasena.length < 8) { marcarCampoInvalido(passwordInput, 'Mínimo 8 caracteres'); return; }

    try {
        const res = await fetch('/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, nombre_usuario, email: email || null, contrasena, rol })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo crear el usuario');
        nombreInput.value = ''; loginInput.value = ''; emailInput.value = ''; passwordInput.value = '';
        cargarUsuarios();
        mostrarMensajeExito(`Usuario "${nombre_usuario}" creado`);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function cambiarRolUsuario(id, rol) {
    try {
        const res = await fetch(`/usuarios/${id}/rol`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rol })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo cambiar el rol');
        cargarUsuarios();
    } catch (err) {
        alert('Error: ' + err.message);
        cargarUsuarios();
    }
}

async function eliminarUsuario(id) {
    if (!(await confirmarAccion('¿Quitar el acceso a este usuario?', 'Quitar acceso'))) return;
    try {
        const res = await fetch(`/usuarios/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el usuario');
        cargarUsuarios();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function limpiarPedidosAntiguos() {
    if (await confirmarAccion('¿Limpiar pedidos antiguos? Esta acción no se puede deshacer.', 'Limpiar'))
        alert('Función pendiente de implementar en el servidor.');
}

// --- Exportación a Excel (listados) y PDF (hoja de reparto / historial) ---
async function exportarDatos() {
    try {
        const res = await fetch('/clientes');
        if (!res.ok) throw new Error('Error al obtener clientes');
        const datos = await res.json();
        if (!datos || datos.length === 0) { alert('No hay clientes para exportar.'); return; }

        const filas = datos.map(c => ({
            Apodo: c.apodo || '',
            'Nombre completo': c.nombre_completo || '',
            Teléfono: c.telefono || '',
            Localidad: c.localidad || '',
            Zona: c.zona_reparto || '',
            Observaciones: c.observaciones || '',
        }));

        const hoja = XLSX.utils.json_to_sheet(filas);
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, 'Clientes');
        const fecha = new Date().toISOString().split('T')[0];
        XLSX.writeFile(libro, `clientes_${fecha}.xlsx`);
    } catch (err) {
        console.error('Error al exportar clientes:', err);
        alert('Error al exportar clientes: ' + err.message);
    }
}


// Botón "Enviar Copia de Seguridad Ahora" (Gestión BD): dispara el mismo
// envío que la tarea programada, pero al momento, para poder comprobar
// que Resend está bien configurado sin esperar a la fecha automática.
async function enviarBackupManual() {
    const boton = document.getElementById('btnBackupManual');
    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> Enviando...';
    try {
        const res = await fetch('/backup-manual', { method: 'POST' });
        const esJSON = (res.headers.get('content-type') || '').includes('application/json');
        if (!esJSON) {
            throw new Error(`El servidor respondió algo inesperado (código ${res.status}). Puede que el último despliegue en Vercel aún no haya terminado o haya fallado: revisa la pestaña "Deployments" de Vercel.`);
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo enviar la copia de seguridad.');
        await mostrarAviso('Copia de seguridad enviada. Revisa la bandeja de entrada (y la de spam) del email configurado.', 'exito');
    } catch (err) {
        console.error('Error al enviar la copia de seguridad manual:', err);
        await mostrarAviso('No se pudo enviar la copia de seguridad:\n\n' + err.message, 'error');
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
}

// --- Importación masiva desde Excel (clientes y/o pedidos) ---
// El Excel se lee y se mapea aquí mismo, en el navegador, con la misma
// librería (SheetJS) que ya se usa para exportar; al servidor solo llegan
// los datos ya traducidos al formato de la web, para poder mapear
// cualquier Excel real sea cual sea el nombre de sus columnas.
let importarWorkbook = null;

function abrirModalImportarExcel() {
    document.getElementById('modalImportarExcel')?.classList.remove('hidden');
    resetearModalImportarExcel();
}

function cerrarModalImportarExcel() {
    document.getElementById('modalImportarExcel')?.classList.add('hidden');
}

function resetearModalImportarExcel() {
    importarWorkbook = null;
    const input = document.getElementById('inputArchivoImportar');
    if (input) input.value = '';
    const opcionInicial = '<option value="">-- Selecciona un archivo primero --</option>';
    document.getElementById('selectHojaClientes').innerHTML = opcionInicial;
    document.getElementById('selectHojaPedidos').innerHTML = opcionInicial;
    document.getElementById('panelMapeoClientes').classList.add('hidden');
    document.getElementById('panelMapeoClientes').innerHTML = '';
    document.getElementById('panelMapeoPedidos').classList.add('hidden');
    document.getElementById('panelMapeoPedidos').innerHTML = '';
    const resultado = document.getElementById('resultadoImportar');
    resultado.classList.add('hidden');
    resultado.innerHTML = '';
}

function manejarArchivoImportar(event) {
    const archivo = event.target.files[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = (e) => {
        try {
            const datos = new Uint8Array(e.target.result);
            importarWorkbook = XLSX.read(datos, { type: 'array' });
            const opciones = '<option value="">-- No importar --</option>'
                + importarWorkbook.SheetNames.map(n => `<option value="${escapeHTML(n)}">${escapeHTML(n)}</option>`).join('');
            document.getElementById('selectHojaClientes').innerHTML = opciones;
            document.getElementById('selectHojaPedidos').innerHTML = opciones;
            document.getElementById('panelMapeoClientes').classList.add('hidden');
            document.getElementById('panelMapeoPedidos').classList.add('hidden');
        } catch (err) {
            console.error('Error al leer el Excel:', err);
            alert('No se pudo leer ese archivo. Asegúrate de que es un Excel válido (.xlsx o .xls).');
        }
    };
    lector.readAsArrayBuffer(archivo);
}

function obtenerFilasHojaImportar(nombreHoja) {
    if (!importarWorkbook || !nombreHoja) return [];
    const hoja = importarWorkbook.Sheets[nombreHoja];
    return XLSX.utils.sheet_to_json(hoja, { defval: '' });
}

function obtenerColumnasHojaImportar(nombreHoja) {
    const filas = obtenerFilasHojaImportar(nombreHoja);
    const columnas = new Set();
    filas.forEach(fila => Object.keys(fila).forEach(clave => columnas.add(clave)));
    return Array.from(columnas);
}

// Genera un <select> con las columnas detectadas, intentando adivinar cuál
// es la correcta según nombres habituales (para no obligar a mapear a mano
// si el Excel ya usa nombres parecidos a los de la web).
function selectorColumnaImportar(id, columnas, posiblesNombres) {
    const coincidencia = columnas.find(c => posiblesNombres.includes(c.trim().toLowerCase()));
    const opciones = ['<option value="">-- No usar --</option>']
        .concat(columnas.map(c => `<option value="${escapeHTML(c)}" ${c === coincidencia ? 'selected' : ''}>${escapeHTML(c)}</option>`));
    return `<select id="${id}" class="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm">${opciones.join('')}</select>`;
}

function cambiarHojaClientes() {
    const nombreHoja = document.getElementById('selectHojaClientes').value;
    const panel = document.getElementById('panelMapeoClientes');
    if (!nombreHoja) { panel.classList.add('hidden'); panel.innerHTML = ''; return; }

    const columnas = obtenerColumnasHojaImportar(nombreHoja);
    const campos = [
        ['mapClienteApodo', 'Apodo *', ['apodo']],
        ['mapClienteNombre', 'Nombre y Apellidos *', ['nombre completo', 'nombre y apellidos', 'nombre']],
        ['mapClienteTelefono', 'Teléfono', ['telefono', 'teléfono', 'movil', 'móvil']],
        ['mapClienteLocalidad', 'Localidad', ['localidad', 'poblacion', 'población', 'ciudad']],
        ['mapClienteZona', 'Zona Reparto *', ['zona', 'zona reparto', 'zona de reparto']],
        ['mapClienteObservaciones', 'Observaciones', ['observaciones', 'notas']],
    ];
    panel.innerHTML = campos.map(([id, etiqueta, posibles]) => `
        <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">${etiqueta}</label>
            ${selectorColumnaImportar(id, columnas, posibles)}
        </div>
    `).join('');
    panel.classList.remove('hidden');
}

function cambiarHojaPedidos() {
    const nombreHoja = document.getElementById('selectHojaPedidos').value;
    const panel = document.getElementById('panelMapeoPedidos');
    if (!nombreHoja) { panel.classList.add('hidden'); panel.innerHTML = ''; return; }

    const columnas = obtenerColumnasHojaImportar(nombreHoja);
    const campos = [
        ['mapPedidoApodo', 'Apodo del Cliente *', ['apodo']],
        ['mapPedidoProducto', 'Producto *', ['producto', 'productos']],
        ['mapPedidoCantidad', 'Cantidad *', ['cantidad']],
        ['mapPedidoTipo', 'Tipo de Pedido', ['tipo', 'tipo de pedido']],
        ['mapPedidoDia', 'Día de la Semana', ['dia', 'día', 'dia semana', 'día de la semana']],
        ['mapPedidoFecha', 'Fecha de Entrega', ['fecha', 'fecha entrega', 'fecha de entrega']],
        ['mapPedidoObservaciones', 'Observaciones', ['observaciones', 'notas']],
    ];
    panel.innerHTML = campos.map(([id, etiqueta, posibles]) => `
        <div>
            <label class="text-xs font-medium text-gray-600 block mb-1">${etiqueta}</label>
            ${selectorColumnaImportar(id, columnas, posibles)}
        </div>
    `).join('') + `
        <div class="md:col-span-2 flex items-start gap-2 mt-1">
            <input type="checkbox" id="chkPedidosPendientes" class="w-4 h-4 mt-0.5">
            <label for="chkPedidosPendientes" class="text-sm text-gray-600">
                Marcar estos pedidos como pendientes de programar. Si lo dejas sin marcar, se guardan igualmente
                en el historial del cliente, pero no aparecerán en la pestaña "Pedidos Pendientes".
            </label>
        </div>
    `;
    panel.classList.remove('hidden');
}

// Convierte una fecha del Excel (puede venir como número de serie de Excel,
// como texto dd/mm/aaaa o ya en aaaa-mm-dd) al formato aaaa-mm-dd que espera la web.
function formatearFechaImportada(valor) {
    if (valor === '' || valor === null || valor === undefined) return '';
    if (typeof valor === 'number') {
        const fecha = XLSX.SSF.parse_date_code(valor);
        if (!fecha) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${fecha.y}-${pad(fecha.m)}-${pad(fecha.d)}`;
    }
    const texto = String(valor).trim();
    const coincideISO = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (coincideISO) return `${coincideISO[1]}-${coincideISO[2]}-${coincideISO[3]}`;
    const coincideDMY = texto.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (coincideDMY) {
        const [, d, m, y] = coincideDMY;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return '';
}

function listaErroresImportar(errores) {
    if (!errores || errores.length === 0) return '';
    return `<ul class="text-xs text-red-600 list-disc pl-5 mt-1 max-h-32 overflow-y-auto">
        ${errores.map(e => `<li>Fila ${e.fila}: ${escapeHTML(e.motivo)}</li>`).join('')}
    </ul>`;
}

async function ejecutarImportacion() {
    const resultadoDiv = document.getElementById('resultadoImportar');
    resultadoDiv.classList.remove('hidden');

    const hojaClientes = document.getElementById('selectHojaClientes').value;
    const hojaPedidos = document.getElementById('selectHojaPedidos').value;

    if (!hojaClientes && !hojaPedidos) {
        resultadoDiv.innerHTML = '<p class="text-red-600">Selecciona al menos una hoja para importar (clientes y/o pedidos).</p>';
        return;
    }

    resultadoDiv.innerHTML = '<p class="text-gray-500"><i class="fas fa-spinner fa-spin mr-1"></i> Importando, no cierres esta ventana...</p>';
    let resumenHtml = '';

    if (hojaClientes) {
        const val = (id) => document.getElementById(id)?.value || '';
        const mapeo = {
            apodo: val('mapClienteApodo'),
            nombre_completo: val('mapClienteNombre'),
            telefono: val('mapClienteTelefono'),
            localidad: val('mapClienteLocalidad'),
            zona_reparto: val('mapClienteZona'),
            observaciones: val('mapClienteObservaciones'),
        };
        if (!mapeo.apodo || !mapeo.nombre_completo || !mapeo.zona_reparto) {
            resultadoDiv.innerHTML = '<p class="text-red-600">En Clientes, indica qué columna es el Apodo, el Nombre y la Zona Reparto (son obligatorios).</p>';
            return;
        }
        const clientes = obtenerFilasHojaImportar(hojaClientes).map(f => ({
            apodo: String(f[mapeo.apodo] ?? '').trim(),
            nombre_completo: String(f[mapeo.nombre_completo] ?? '').trim(),
            telefono: mapeo.telefono ? String(f[mapeo.telefono] ?? '').trim() : '',
            localidad: mapeo.localidad ? String(f[mapeo.localidad] ?? '').trim() : '',
            zona_reparto: String(f[mapeo.zona_reparto] ?? '').trim(),
            observaciones: mapeo.observaciones ? String(f[mapeo.observaciones] ?? '').trim() : '',
        }));

        try {
            const res = await fetch('/clientes/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al importar clientes');
            resumenHtml += `<p class="text-green-700"><i class="fas fa-check-circle mr-1"></i> Clientes: ${data.creados} nuevos, ${data.actualizados} actualizados, ${data.errores.length} con error.</p>${listaErroresImportar(data.errores)}`;
        } catch (err) {
            console.error('Error al importar clientes:', err);
            resumenHtml += `<p class="text-red-600">Error al importar clientes: ${escapeHTML(err.message)}</p>`;
        }
    }

    if (hojaPedidos) {
        const val = (id) => document.getElementById(id)?.value || '';
        const mapeo = {
            apodo_cliente: val('mapPedidoApodo'),
            producto: val('mapPedidoProducto'),
            cantidad: val('mapPedidoCantidad'),
            tipo: val('mapPedidoTipo'),
            dia_semana: val('mapPedidoDia'),
            fecha_entrega: val('mapPedidoFecha'),
            observaciones: val('mapPedidoObservaciones'),
        };
        if (!mapeo.apodo_cliente || !mapeo.producto || !mapeo.cantidad) {
            resultadoDiv.innerHTML = resumenHtml + '<p class="text-red-600">En Pedidos, indica qué columna es el Apodo del Cliente, el Producto y la Cantidad (son obligatorios).</p>';
            return;
        }
        const marcarPendientes = document.getElementById('chkPedidosPendientes')?.checked || false;
        const pedidos = obtenerFilasHojaImportar(hojaPedidos).map(f => ({
            apodo_cliente: String(f[mapeo.apodo_cliente] ?? '').trim(),
            producto: String(f[mapeo.producto] ?? '').trim(),
            cantidad: String(f[mapeo.cantidad] ?? '').trim(),
            tipo: mapeo.tipo ? String(f[mapeo.tipo] ?? '').trim() : '',
            dia_semana: mapeo.dia_semana ? String(f[mapeo.dia_semana] ?? '').trim() : '',
            fecha_entrega: mapeo.fecha_entrega ? formatearFechaImportada(f[mapeo.fecha_entrega]) : '',
            observaciones: mapeo.observaciones ? String(f[mapeo.observaciones] ?? '').trim() : '',
        }));

        try {
            const res = await fetch('/pedidos/importar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pedidos, marcarPendientes }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al importar pedidos');
            resumenHtml += `<p class="text-green-700 mt-2"><i class="fas fa-check-circle mr-1"></i> Pedidos: ${data.creados} importados, ${data.errores.length} con error.</p>${listaErroresImportar(data.errores)}`;
        } catch (err) {
            console.error('Error al importar pedidos:', err);
            resumenHtml += `<p class="text-red-600 mt-2">Error al importar pedidos: ${escapeHTML(err.message)}</p>`;
        }
    }

    resultadoDiv.innerHTML = resumenHtml || '<p class="text-gray-500">No había nada que importar.</p>';
    if (hojaClientes) { cargarClientes(); cargarZonasClienteForm(); }
    if (hojaPedidos) { cargarPedidosPendientes(); }
}

async function exportarHistorialClientePDF(clienteId) {
    try {
        const res = await fetch(`/pedidos_historial/${clienteId}/completo`);
        if (!res.ok) throw new Error('Error al obtener el historial del cliente');
        const historial = await res.json();
        if (!historial || historial.length === 0) { alert('Este cliente no tiene historial de pedidos.'); return; }

        const cliente = clientes.find(c => c.id === clienteId);
        const apodo = cliente ? cliente.apodo : `cliente_${clienteId}`;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFontSize(14);
        doc.text(`Historial de pedidos: ${apodo}`, 14, 15);

        const filas = historial.map(h => [
            h.fecha_pedido ? new Date(h.fecha_pedido).toLocaleDateString('es-ES') : '',
            h.fecha_entrega ? new Date(h.fecha_entrega).toLocaleDateString('es-ES') : '',
            resumenItemsTexto(h.items),
            h.observaciones || '',
        ]);

        doc.autoTable({
            startY: 22,
            head: [['Fecha pedido', 'Fecha entrega', 'Productos', 'Observaciones']],
            body: filas,
            styles: { fontSize: 9 },
            headStyles: { fillColor: [21, 135, 101] },
        });

        const fecha = new Date().toISOString().split('T')[0];
        doc.save(`historial_${apodo}_${fecha}.pdf`);
    } catch (err) {
        console.error('Error al exportar historial a PDF:', err);
        alert('Error al exportar historial a PDF: ' + err.message);
    }
}

function exportarHojaRepartoPDF() {
    if (!pedidosHojaReparto || pedidosHojaReparto.length === 0) {
        alert('La hoja de reparto está vacía, no hay nada que exportar.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Hoja de Reparto', 14, 12);
    doc.setFontSize(10);
    doc.text(new Date().toLocaleDateString('es-ES'), 14, 18);

    const filas = pedidosHojaReparto.map((p, i) => [
        i + 1,
        p.apodo_cliente || '',
        p.telefono || '',
        resumenItemsTexto(p.items),
        p.dia_reparto || '',
        p.orden_reparto ?? '',
        p.camion || '',
        p.zona || '',
        p.conductor || '',
    ]);

    doc.autoTable({
        startY: 24,
        head: [['Nº', 'Cliente', 'Teléfono', 'Pedido', 'Día', 'Orden', 'Camión', 'Zona', 'Conductor']],
        body: filas,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [21, 135, 101] },
    });

    const fecha = new Date().toISOString().split('T')[0];
    doc.save(`hoja_reparto_${fecha}.pdf`);
}

async function resetearSistema() {
    if (await confirmarAccion('ATENCIÓN: ¿Resetear el sistema? Se eliminarán TODOS los datos. Acción irreversible.', 'Resetear'))
        alert('Función pendiente de implementar en el servidor.');
}


// ============================================================
// HOJA DE REPARTO
// ============================================================

// Listas de camiones/conductores para construir los <select> de cada fila.
// Se cargan una vez al entrar en la pestaña.
let camionesHoja = [];
let conductoresHoja = [];

async function cargarListasHojaReparto() {
    try {
        const [resCamiones, resConductores] = await Promise.all([fetch('/camiones'), fetch('/conductores')]);
        camionesHoja = resCamiones.ok ? await resCamiones.json() : [];
        conductoresHoja = resConductores.ok ? await resConductores.json() : [];
    } catch (err) {
        console.error('Error al cargar camiones/conductores para la hoja de reparto:', err);
        camionesHoja = [];
        conductoresHoja = [];
    }
}

function construirSelectHoja(valores, valorActual, onChangeAttr) {
    const opciones = ['<option value="">—</option>']
        .concat(valores.map(v => `<option value="${escapeHTML(v.nombre)}" ${v.nombre === valorActual ? 'selected' : ''}>${escapeHTML(v.nombre)}</option>`));
    return `<select class="hoja-select" ${onChangeAttr}>${opciones.join('')}</select>`;
}

function renderizarHojaReparto() {
    const tbody = document.getElementById('tablaPedidosHoja');
    const vacio = document.getElementById('mensajeVacioHoja');
    if (!tbody || !vacio) return;

    tbody.innerHTML = '';
    if (pedidosHojaReparto.length === 0) {
        vacio.classList.remove('hidden');
        return;
    }
    vacio.classList.add('hidden');

    pedidosHojaReparto.forEach((p, index) => {
        const fila = document.createElement('tr');
        fila.innerHTML = `
            <td class="border px-2 py-2 text-center orden-cell">${index + 1}</td>
            <td class="border px-2 py-2">${escapeHTML(p.apodo_cliente)}</td>
            <td class="border px-2 py-2">${escapeHTML(p.telefono)}</td>
            <td class="border px-2 py-2 observaciones-cell">${resumenItemsTexto(p.items)}</td>
            <td class="border px-2 py-2 capitalize">${escapeHTML(p.dia_reparto)}</td>
            <td class="border px-2 py-2 orden-cell">
                <input type="number" min="1" step="1" value="${p.orden_reparto ?? ''}" class="hoja-input"
                    onchange="actualizarCampoHoja(${p.id}, 'orden_reparto', this.value ? parseInt(this.value, 10) : null)">
            </td>
            <td class="border px-2 py-2 conductor-cell">
                ${construirSelectHoja(camionesHoja, p.camion, `onchange="actualizarCampoHoja(${p.id}, 'camion', this.value || null)"`)}
            </td>
            <td class="border px-2 py-2">${escapeHTML(p.zona)}</td>
            <td class="border px-2 py-2 conductor-cell">
                ${construirSelectHoja(conductoresHoja, p.conductor, `onchange="actualizarCampoHoja(${p.id}, 'conductor', this.value || null)"`)}
            </td>
            <td class="border px-2 py-2 text-center no-print">
                <button onclick="eliminarPedidoHoja(${p.id})" class="text-red-600 hover:text-red-800" title="Quitar de la hoja"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

async function cargarPedidosHoja() {
    try {
        document.getElementById('loadingPedidosHoja')?.classList.remove('hidden');
        const res = await fetch('/pedidos/hoja-reparto');
        if (!res.ok) throw new Error('Error al cargar hoja de reparto');
        pedidosHojaReparto = await res.json();
        renderizarHojaReparto();
    } catch (err) {
        console.error('Error al cargar hoja de reparto:', err);
    } finally {
        document.getElementById('loadingPedidosHoja')?.classList.add('hidden');
    }
}

/** Actualiza en el servidor el orden/camión/conductor de un pedido de la hoja (edición en línea). */
async function actualizarCampoHoja(id, campo, valor) {
    try {
        const res = await fetch(`/pedidos/hoja-reparto/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ [campo]: valor })
        });
        if (!res.ok) throw new Error('Error al guardar el cambio');
        // Reflejamos el cambio localmente para no perder la edición al re-renderizar,
        // y si cambió el orden, reordenamos la tabla igual que hace el servidor.
        const pedido = pedidosHojaReparto.find(p => p.id === id);
        if (pedido) pedido[campo] = valor;
        if (campo === 'orden_reparto') {
            pedidosHojaReparto.sort((a, b) => (a.orden_reparto ?? Infinity) - (b.orden_reparto ?? Infinity));
            renderizarHojaReparto();
        }
    } catch (err) {
        alert('Error al guardar el cambio: ' + err.message);
        cargarPedidosHoja();
    }
}

async function eliminarPedidoHoja(id) {
    if (!(await confirmarAccion('¿Quitar este pedido de la hoja de reparto? (el pedido programado no se borra)', 'Quitar'))) return;
    try {
        const res = await fetch(`/pedidos/hoja-reparto/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al quitar el pedido');
        pedidosHojaReparto = pedidosHojaReparto.filter(p => p.id !== id);
        renderizarHojaReparto();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function limpiarHojaReparto() {
    if (!(await confirmarAccion('¿Vaciar toda la hoja de reparto? Los pedidos seguirán programados en el calendario.', 'Vaciar hoja'))) return;
    try {
        const res = await fetch('/pedidos/hoja-reparto', { method: 'DELETE' });
        if (!res.ok) throw new Error('Error al limpiar la hoja');
        pedidosHojaReparto = [];
        renderizarHojaReparto();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function imprimirHojaReparto() { window.print(); }


// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        const modal = document.getElementById('clienteModal');
        if (modal && e.target === modal) cerrarModal();
    });

    cambiarPestana('BaseDatos');
});