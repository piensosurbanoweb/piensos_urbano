// ============================================================
// SESIÓN
// ============================================================
// Se comprueba nada más cargar la página: si no hay sesión válida,
// redirige al login antes de que el resto de la app intente pedir datos.
(async function comprobarSesion() {
    try {
        const res = await fetch('/me');
        if (!res.ok) { window.location.href = 'login.html'; return; }
        const usuario = await res.json();
        const span = document.getElementById('usuarioActual');
        if (span) span.textContent = `${usuario.nombre} (${usuario.nombre_usuario})`;
    } catch (err) {
        window.location.href = 'login.html';
    }
})();

async function cerrarSesion() {
    try { await fetch('/logout', { method: 'POST' }); } catch (err) { /* ignorar */ }
    window.location.href = 'login.html';
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

    const baseClass     = 'px-3 py-3 text-center font-medium text-xs sm:text-sm';
    const inactiveClass = `${baseClass} bg-gray-200 text-gray-700 hover:bg-gray-300`;
    const activeClass   = `${baseClass} bg-blue-600 text-white`;

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
    const form = document.getElementById('clienteForm');
    if (form) form.addEventListener('submit', guardarCliente);
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
        document.getElementById('zona_reparto').value    = cliente.zona_reparto || 'Zona A';
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
    if (!id || !confirm('¿Seguro que deseas eliminar este cliente?')) return;
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

/** Busca y muestra los últimos pedidos del cliente para poder repetirlos con un clic. */
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
            li.className = 'cursor-pointer text-sm bg-white hover:bg-blue-100 border border-blue-200 rounded px-2 py-1 transition-colors';
            const fecha = p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleDateString('es-ES') : '';
            li.innerHTML = `<strong>${escapeHTML(p.cantidad)}</strong> de <strong>${escapeHTML(p.producto)}</strong> <span class="text-gray-400">— ${fecha}</span>`;
            li.addEventListener('click', () => repetirPedidoAnterior(p));
            lista.appendChild(li);
        });
        contenedor.classList.remove('hidden');
    } catch (err) {
        console.error('Error al cargar últimos pedidos del cliente:', err);
        contenedor.classList.add('hidden');
    }
}

/** Rellena cantidad y producto con los de un pedido anterior seleccionado. */
function repetirPedidoAnterior(pedido) {
    const cantidadInput = document.getElementById('cantidad');
    const productoInput = document.getElementById('producto');
    if (cantidadInput) {
        const cantidadNum = parseInt(pedido.cantidad, 10);
        cantidadInput.value = Number.isFinite(cantidadNum) ? cantidadNum : pedido.cantidad || '';
    }
    if (productoInput) productoInput.value = pedido.producto || '';
}

function inicializarFormularioPedidos() {
    const tipoPedido = document.getElementById('tipoPedido');
    if (tipoPedido) {
        tipoPedido.addEventListener('change', () => {
            const container = document.getElementById('diasSemanaContainer');
            if (container) container.classList.toggle('hidden', tipoPedido.value !== 'semanal');
        });
    }

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

        const formValido = validarFormulario(form);
        if (!clienteValido || !formValido) {
            if (!clienteValido) apodoInput?.focus();
            return;
        }

        const pedidoData = {
            cliente_id:    clienteSeleccionado.id,
            apodo_cliente: clienteSeleccionado.apodo,
            tipo:          document.getElementById('tipoPedido').value,
            dia_semana:    document.getElementById('diaSemana')?.value || null,
            cantidad:      parseInt(document.getElementById('cantidad').value),
            producto:      document.getElementById('producto').value,
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
    if (document.getElementById('nombreCompleto')) document.getElementById('nombreCompleto').value = '';
    if (document.getElementById('zonaReparto'))    document.getElementById('zonaReparto').value    = '';
    if (document.getElementById('localidad'))      document.getElementById('localidad').value      = '';
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
    try {
        const res = await fetch('/pedidos/pendientes');
        pedidosPendientes = await res.json();
        renderizarPedidosPendientes(pedidosPendientes);
    } catch (err) {
        console.error('Error al cargar pedidos pendientes:', err);
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
                <p class="text-sm text-gray-500">Obs: ${escapeHTML(pedido.observaciones) || 'N/A'}</p>
                <div class="flex justify-end mt-4">
                    <button onclick="mostrarCalendarioModal(${pedido.historial_id})"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                        <i class="fas fa-calendar-days mr-1"></i> Programar en Calendario
                    </button>
                </div>
            `;
            lista.appendChild(item);
        });
    }

    if (totalSpan) totalSpan.textContent = pedidos.length;
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
    const diasSem = getWeekDays(semanaActualOffset);

    const titulo = document.getElementById('tituloCalendario');
    if (titulo) {
        titulo.textContent = `Semana: ${diasSem[0].toLocaleDateString('es-ES')} — ${diasSem[6].toLocaleDateString('es-ES')}`;
    }

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
    }
}

function cambiarVistaCalendario(vista) {
    vistaCalendarioActual = vista;
    const btnSemanal      = document.getElementById('btnVistaSemanal');
    const btnDiaria       = document.getElementById('btnVistaDiaria');
    const vistaSemanalDiv = document.getElementById('vistaSemanal');
    const vistaDiariaDiv  = document.getElementById('vistaDiaria');
    const controlesNav    = document.getElementById('controlesNavegacion');

    const activoClass   = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
    const inactivoClass = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';

    if (vista === 'semanal') {
        if (btnSemanal) btnSemanal.className = activoClass;
        if (btnDiaria)  btnDiaria.className  = inactivoClass;
        vistaSemanalDiv?.classList.remove('hidden');
        vistaDiariaDiv?.classList.add('hidden');
        controlesNav?.classList.remove('hidden');
        cargarPedidosCalendario();
    } else {
        if (btnDiaria)  btnDiaria.className  = activoClass;
        if (btnSemanal) btnSemanal.className = inactivoClass;
        vistaDiariaDiv?.classList.remove('hidden');
        vistaSemanalDiv?.classList.add('hidden');
        controlesNav?.classList.add('hidden');
        cambiarDiaDiario();
    }
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
                        <div class="border border-gray-200 rounded-lg p-2 cursor-pointer hover:bg-blue-50 transition-colors"
                             onclick="mostrarDetallesPedido(${p.id})">
                            <p class="text-sm font-semibold text-gray-800">${escapeHTML(p.apodo_cliente)}</p>
                            <p class="text-xs text-gray-500">${escapeHTML(p.producto)} (${escapeHTML(p.cantidad)})</p>
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
                            <p class="text-sm text-gray-600">${escapeHTML(p.producto)} — Cantidad: ${escapeHTML(p.cantidad)}</p>
                        </div>
                        <span class="text-xs text-gray-400">
                            ${p.fecha_reparto ? new Date(p.fecha_reparto).toLocaleDateString('es-ES') : ''}
                        </span>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">Obs: ${escapeHTML(p.observaciones) || 'N/A'}</p>
                `;
                lista.appendChild(div);
            });
        } else {
            vacio.classList.remove('hidden');
        }
    } catch (err) {
        console.error('Error al cargar pedidos diarios:', err);
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
                    <p><strong>Producto:</strong> ${escapeHTML(pedido.producto)} (${escapeHTML(pedido.cantidad)} uds.)</p>
                    <p><strong>Fecha de entrega:</strong> ${new Date(pedido.fecha_entrega).toLocaleDateString('es-ES')}</p>
                    <p><strong>Teléfono:</strong> ${escapeHTML(pedido.telefono) || 'N/A'}</p>
                    <p><strong>Localidad:</strong> ${escapeHTML(pedido.localidad) || 'N/A'}</p>
                    <p><strong>Observaciones:</strong> ${escapeHTML(pedido.observaciones) || 'N/A'}</p>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <button onclick="cerrarDetallesPedidoModal()"
                        class="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg text-sm">Cerrar</button>
                    <button onclick="mostrarModalEditarFecha('${new Date(pedido.fecha_entrega).toISOString().split('T')[0]}')"
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"><i class="fas fa-pen mr-1"></i> Editar Fecha</button>
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
    } catch (err) { console.error('Error al cargar conductores:', err); }
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
    if (!confirm('¿Eliminar este conductor?')) return;
    try {
        const res = await fetch(`/conductores/${id}`, { method: 'DELETE' });
        if (res.ok) cargarConductores();
    } catch (err) { console.error(err); }
}

async function cargarCamiones() {
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
    } catch (err) { console.error('Error al cargar camiones:', err); }
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
    if (!confirm('¿Eliminar este camión?')) return;
    try {
        const res = await fetch(`/camiones/${id}`, { method: 'DELETE' });
        if (res.ok) cargarCamiones();
    } catch (err) { console.error(err); }
}

async function cargarZonas() {
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
    } catch (err) { console.error(err); }
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
    if (!confirm('¿Eliminar esta zona?')) return;
    try {
        const res = await fetch(`/zonas/${id}`, { method: 'DELETE' });
        if (res.ok) cargarZonas();
    } catch (err) { console.error(err); }
}

// --- Usuarios con acceso a la app ---
async function cargarUsuarios() {
    try {
        const res = await fetch('/usuarios');
        if (!res.ok) throw new Error('Error al obtener usuarios');
        const data = await res.json();
        const lista = document.getElementById('listaUsuarios');
        if (!lista) return;
        lista.innerHTML = '';
        data.forEach(u => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3';
            li.innerHTML = `
                <span>${escapeHTML(u.nombre)} <span class="text-gray-400 text-sm">(${escapeHTML(u.nombre_usuario)})</span></span>
                <button onclick="eliminarUsuario(${u.id})" class="text-red-600 hover:text-red-800"><i class="fas fa-trash"></i></button>
            `;
            lista.appendChild(li);
        });
    } catch (err) { console.error('Error al cargar usuarios:', err); }
}

async function agregarUsuario() {
    const nombreInput = document.getElementById('nuevoUsuarioNombre');
    const loginInput = document.getElementById('nuevoUsuarioLogin');
    const passwordInput = document.getElementById('nuevoUsuarioPassword');
    const nombre = nombreInput?.value.trim();
    const nombre_usuario = loginInput?.value.trim();
    const contrasena = passwordInput?.value;

    if (!nombre) { marcarCampoInvalido(nombreInput, 'Escribe un nombre'); return; }
    if (!nombre_usuario) { marcarCampoInvalido(loginInput, 'Escribe un usuario'); return; }
    if (!contrasena || contrasena.length < 8) { marcarCampoInvalido(passwordInput, 'Mínimo 8 caracteres'); return; }

    try {
        const res = await fetch('/usuarios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, nombre_usuario, contrasena })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo crear el usuario');
        nombreInput.value = ''; loginInput.value = ''; passwordInput.value = '';
        cargarUsuarios();
        mostrarMensajeExito(`Usuario "${nombre_usuario}" creado`);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

async function eliminarUsuario(id) {
    if (!confirm('¿Quitar el acceso a este usuario?')) return;
    try {
        const res = await fetch(`/usuarios/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el usuario');
        cargarUsuarios();
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function limpiarPedidosAntiguos() {
    if (confirm('¿Limpiar pedidos antiguos? Esta acción no se puede deshacer.'))
        alert('Función pendiente de implementar en el servidor.');
}
function exportarDatos()   { alert('Función pendiente de implementar en el servidor.'); }
function resetearSistema() {
    if (confirm('ATENCIÓN: ¿Resetear el sistema? Se eliminarán TODOS los datos. Acción irreversible.'))
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
            <td class="border px-2 py-2 observaciones-cell">${escapeHTML(p.cantidad)} ${escapeHTML(p.producto)}</td>
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
    if (!confirm('¿Quitar este pedido de la hoja de reparto? (el pedido programado no se borra)')) return;
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
    if (!confirm('¿Vaciar toda la hoja de reparto? Los pedidos seguirán programados en el calendario.')) return;
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