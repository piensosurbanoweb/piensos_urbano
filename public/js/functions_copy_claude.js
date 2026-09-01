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
}

function inicializarHojaReparto() {
    cargarPedidosHoja();
    cargarZonasHoja();
    const filtroZona = document.getElementById('filtroZonaHoja');
    if (filtroZona) filtroZona.addEventListener('change', cargarPedidosDisponibles);
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
                <td class="px-4 py-2 border">${cliente.apodo || ''}</td>
                <td class="px-4 py-2 border">${cliente.nombre_completo || ''}</td>
                <td class="px-4 py-2 border">${cliente.telefono || ''}</td>
                <td class="px-4 py-2 border">${cliente.localidad || ''}</td>
                <td class="px-4 py-2 border">${cliente.zona_reparto || ''}</td>
                <td class="px-4 py-2 border">${cliente.observaciones || ''}</td>
                <td class="px-4 py-2 border flex gap-2">
                    <button class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                        onclick='abrirModal(${JSON.stringify(cliente)})'>
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
        popup.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 opacity-0 transition-opacity duration-300';
        document.body.appendChild(popup);
    }
    popup.textContent = texto;
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
                        ${pedido.apodo} — ${pedido.localidad}
                    </span>
                    <span class="text-xs text-gray-500">
                        Zona: <strong>${pedido.zona || 'N/A'}</strong>
                        &nbsp;|&nbsp; Día: <strong>${pedido.dia_reparto || 'N/A'}</strong>
                    </span>
                </div>
                <p class="text-gray-800 text-lg font-bold">${pedido.pedido}</p>
                <p class="text-sm text-gray-500 mt-1">
                    Fecha programada: ${pedido.fecha_programacion
                        ? new Date(pedido.fecha_programacion).toLocaleDateString('es-ES')
                        : 'Sin fecha'}
                </p>
                <p class="text-sm text-gray-500">Obs: ${pedido.observaciones || 'N/A'}</p>
                <div class="flex justify-end mt-4">
                    <button onclick="mostrarCalendarioModal(${pedido.historial_id})"
                        class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                        📅 Programar en Calendario
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
        mostrarMensajeExito(`✅ Pedido de ${data.apodo} programado para el ${data.dia_reparto}`);
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
                            <p class="text-sm font-semibold text-gray-800">${p.apodo_cliente}</p>
                            <p class="text-xs text-gray-500">${p.producto} (${p.cantidad})</p>
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
                            <h3 class="font-bold text-lg">${p.apodo_cliente}</h3>
                            <p class="text-sm text-gray-600">${p.producto} — Cantidad: ${p.cantidad}</p>
                        </div>
                        <span class="text-xs text-gray-400">
                            ${p.fecha_reparto ? new Date(p.fecha_reparto).toLocaleDateString('es-ES') : ''}
                        </span>
                    </div>
                    <p class="text-sm text-gray-500 mt-1">Obs: ${p.observaciones || 'N/A'}</p>
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
        mostrarMensajeExito(`✅ ${pedidos.length} pedido(s) enviados a la hoja de reparto`);
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
                    <p><strong>Cliente:</strong> ${pedido.apodo_cliente || 'N/A'}</p>
                    <p><strong>Producto:</strong> ${pedido.producto} (${pedido.cantidad} uds.)</p>
                    <p><strong>Fecha de entrega:</strong> ${new Date(pedido.fecha_entrega).toLocaleDateString('es-ES')}</p>
                    <p><strong>Teléfono:</strong> ${pedido.telefono || 'N/A'}</p>
                    <p><strong>Localidad:</strong> ${pedido.localidad || 'N/A'}</p>
                    <p><strong>Observaciones:</strong> ${pedido.observaciones || 'N/A'}</p>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <button onclick="cerrarDetallesPedidoModal()"
                        class="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg text-sm">Cerrar</button>
                    <button onclick="mostrarModalEditarFecha('${new Date(pedido.fecha_entrega).toISOString().split('T')[0]}')"
                        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">✏️ Editar Fecha</button>
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
        mostrarMensajeExito('✅ Fecha actualizada correctamente');
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
                <span class="text-gray-800">${c.nombre}</span>
                <button onclick="eliminarConductor(${c.id})" class="text-red-600 hover:text-red-800">🗑️</button>
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
                <span>${c.nombre}</span>
                <button onclick="eliminarCamion(${c.id})" class="text-red-600 hover:text-red-800">🗑️</button>
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
                <span>${z.nombre}</span>
                <button onclick="eliminarZona(${z.id})" class="text-red-600 hover:text-red-800">🗑️</button>
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

function limpiarPedidosAntiguos() {
    if (confirm('¿Limpiar pedidos antiguos? Esta acción no se puede deshacer.'))
        alert('Función pendiente de implementar en el servidor.');
}
function exportarDatos()   { alert('Función pendiente de implementar en el servidor.'); }
function resetearSistema() {
    if (confirm('⚠️ ¿RESETEAR EL SISTEMA? Se eliminarán TODOS los datos. Acción IRREVERSIBLE.'))
        alert('Función pendiente de implementar en el servidor.');
}


// ============================================================
// HOJA DE REPARTO
// ============================================================

function renderizarHojaReparto() {
    const lista = document.getElementById('listaPedidosHoja');
    const vacio = document.getElementById('mensajeVacioHoja');
    if (!lista || !vacio) return;

    lista.innerHTML = '';
    if (pedidosHojaReparto.length === 0) {
        vacio.classList.remove('hidden');
    } else {
        vacio.classList.add('hidden');
        pedidosHojaReparto.forEach(p => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-4 bg-gray-50 rounded-lg border';
            li.innerHTML = `
                <div>
                    <p class="font-bold text-lg">${p.apodo_cliente} — ${p.producto}</p>
                    <p class="text-sm text-gray-600">${p.cantidad} unidades</p>
                    <p class="text-xs text-gray-400">Entrega: ${new Date(p.fecha_entrega).toLocaleDateString('es-ES')}</p>
                </div>
                <button onclick="eliminarPedidoHoja(${p.id})" class="text-red-600 hover:text-red-800 no-print">🗑️</button>
            `;
            lista.appendChild(li);
        });
    }
}

async function cargarPedidosHoja() {
    try {
        const res = await fetch('/pedidos/hoja-reparto');
        if (!res.ok) throw new Error('Error al cargar hoja de reparto');
        pedidosHojaReparto = await res.json();
        renderizarHojaReparto();
    } catch (err) {
        console.error('Error al cargar hoja de reparto:', err);
    }
}

async function mostrarSelectorPedidos() {
    const modal = document.getElementById('selectorPedidosModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    await Promise.all([cargarZonasHoja(), cargarPedidosDisponibles()]);
}

async function cargarZonasHoja() {
    try {
        const res = await fetch('/zonas');
        const data = await res.json();
        const select = document.getElementById('filtroZonaHoja');
        if (!select) return;
        select.innerHTML = '<option value="">Todas las zonas</option>';
        data.forEach(z => {
            const opt = document.createElement('option');
            opt.value = z.nombre; opt.textContent = z.nombre;
            select.appendChild(opt);
        });
    } catch (err) { console.error(err); }
}

async function cargarPedidosDisponibles() {
    const zonaFiltro = document.getElementById('filtroZonaHoja')?.value;
    const lista = document.getElementById('listaPedidosSelector');
    if (!lista) return;

    lista.innerHTML = '<p class="text-center text-gray-500 py-4">Cargando...</p>';

    try {
        const res = await fetch('/pedidos/pendientes');
        let pedidos = await res.json();

        // El campo de zona en pedidos_pendientes se llama "zona" (no "zona_reparto")
        if (zonaFiltro) pedidos = pedidos.filter(p => p.zona === zonaFiltro);

        lista.innerHTML = '';
        if (pedidos.length > 0) {
            pedidos.forEach(p => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-3 bg-gray-100 p-3 rounded-md';
                div.innerHTML = `
                    <input type="checkbox" data-pedido-id="${p.id}" class="h-5 w-5 text-blue-600">
                    <div>
                        <p class="font-bold">${p.apodo}</p>
                        <p class="text-sm text-gray-600">${p.pedido}</p>
                        <p class="text-xs text-gray-400">Zona: ${p.zona || 'N/A'} | Día: ${p.dia_reparto || 'N/A'}</p>
                    </div>
                `;
                lista.appendChild(div);
            });
        } else {
            lista.innerHTML = '<p class="text-center text-gray-500 py-4">No hay pedidos disponibles.</p>';
        }
    } catch (err) {
        lista.innerHTML = '<p class="text-center text-red-500 py-4">Error al cargar pedidos.</p>';
    }
}

function cerrarSelectorPedidos() {
    const modal = document.getElementById('selectorPedidosModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function agregarSeleccionadosALaHoja() {
    const checks = document.querySelectorAll('#listaPedidosSelector input[type="checkbox"]:checked');
    const ids = Array.from(checks).map(cb => parseInt(cb.dataset.pedidoId));
    if (ids.length === 0) { alert('Selecciona al menos un pedido.'); return; }

    try {
        const res = await fetch('/pedidos/hoja-reparto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error('Error al agregar pedidos a la hoja');
        pedidosHojaReparto = await res.json();
        renderizarHojaReparto();
        cerrarSelectorPedidos();
        mostrarMensajeExito(`✅ ${ids.length} pedido(s) agregado(s) a la hoja`);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function eliminarPedidoHoja(id) {
    if (confirm('¿Quitar este pedido de la hoja?')) {
        pedidosHojaReparto = pedidosHojaReparto.filter(p => p.id !== id);
        renderizarHojaReparto();
    }
}

function limpiarHojaReparto() {
    if (confirm('¿Limpiar toda la hoja de reparto?')) {
        pedidosHojaReparto = [];
        renderizarHojaReparto();
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