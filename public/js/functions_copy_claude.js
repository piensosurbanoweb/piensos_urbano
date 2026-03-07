// Variables de control, declaradas solo una vez para toda la aplicación
let editandoId = null;
let semanaActualOffset = 0;
let vistaCalendarioActual = 'semanal';
let diaSeleccionadoDiario = 'lunes';
let clienteSeleccionado = null;
let pedidoParaEditarId = null;
let pedidoParaProgramarId = null;

let pedidosPendientes = [];
let pedidosCalendario = {
    lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: []
};
const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

let clientes = [];
let zonas = [];
let pedidosHojaReparto = [];

// --- Funciones de pestañas ---
async function cambiarPestana(nombrePestana) {
    const contenedor = document.getElementById('contenidoPestanas');
    if (!contenedor) return;

    contenedor.innerHTML = '';

    // BUG FIX #5: El tab de Pendientes tiene id "tabPendientes", no "tabPedidosPendientes"
    const mapaBotones = {
        'BaseDatos': 'tabBaseDatos',
        'NuevoPedido': 'tabNuevoPedido',
        'Pendientes': 'tabPendientes',
        'Calendario': 'tabCalendario',
        'GestionBBDD': 'tabGestionBBDD',
        'HojaReparto': 'tabHojaReparto'
    };

    const baseClass = 'flex-1 px-5 py-4 text-center font-medium text-sm';
    const inactiveClass = `${baseClass} bg-gray-200 text-gray-700 hover:bg-gray-300`;
    const activeClass = `${baseClass} bg-blue-600 text-white`;

    Object.entries(mapaBotones).forEach(([pestana, tabId]) => {
        const tab = document.getElementById(tabId);
        if (tab) {
            tab.className = pestana === nombrePestana ? activeClass : inactiveClass;
        }
    });

    try {
        const res = await fetch(`${nombrePestana}.html`);
        if (!res.ok) throw new Error(`No se pudo cargar ${nombrePestana}.html`);
        const html = await res.text();
        contenedor.innerHTML = html;

        if (nombrePestana === "BaseDatos") {
            inicializarBaseDatos();
        } else if (nombrePestana === "NuevoPedido") {
            inicializarNuevoPedido();
        } else if (nombrePestana === "Pendientes") {
            inicializarPendientes();
        } else if (nombrePestana === "Calendario") {
            inicializarCalendario();
        } else if (nombrePestana === "GestionBBDD") {
            inicializarGestionBBDD();
        } else if (nombrePestana === "HojaReparto") {
            inicializarHojaReparto();
        }
    } catch (err) {
        console.error(`Error al cargar la pestaña ${nombrePestana}:`, err);
    }
}

function inicializarBaseDatos() {
    cargarClientes();
    const form = document.getElementById("clienteForm");
    if (form) form.addEventListener("submit", guardarCliente);
}

function inicializarNuevoPedido() {
    cargarZonasNuevoPedido();
    cargarClientesParaAutocomplete();
    inicializarFormularioPedidos();
}

async function inicializarPendientes() {
    await cargarPedidosPendientes();
    const ordenarPendientes = document.getElementById('ordenarPendientes');
    if (ordenarPendientes) {
        ordenarPendientes.addEventListener('change', ordenarPedidosPendientes);
    }
}

function inicializarCalendario() {
    vistaCalendarioActual = 'semanal';
    cargarPedidosCalendario();
    cambiarVistaCalendario('semanal');
}

function inicializarGestionBBDD() {
    cargarConductores();
    cargarCamiones();
    cargarZonas();
}

function inicializarHojaReparto() {
    cargarPedidosHoja();
    cargarZonasHoja();
}

// --- Base de Datos de Clientes ---
async function cargarClientes() {
    try {
        document.getElementById("loading")?.classList.remove("hidden");
        document.getElementById("mensajeVacio")?.classList.add("hidden");

        const response = await fetch('/clientes');
        if (!response.ok) throw new Error("Error en la respuesta del servidor");

        const datos = await response.json();
        clientes = datos;

        const tabla = document.getElementById("listaClientes");
        if (!tabla) return;
        tabla.innerHTML = "";

        if (clientes.length === 0) {
            document.getElementById("mensajeVacio")?.classList.remove("hidden");
            return;
        }

        clientes.forEach(cliente => {
            const fila = document.createElement("tr");
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

    } catch (error) {
        console.error("Error cargando clientes:", error);
    } finally {
        document.getElementById("loading")?.classList.add("hidden");
    }
}

async function guardarCliente(event) {
    event.preventDefault();

    const id = document.getElementById("clienteId")?.value;
    const cliente = {
        apodo: document.getElementById("apodo").value,
        nombre_completo: document.getElementById("nombre_completo").value,
        telefono: document.getElementById("telefono").value,
        localidad: document.getElementById("localidad").value,
        zona_reparto: document.getElementById("zona_reparto").value,
        observaciones: document.getElementById("observaciones").value
    };

    try {
        const url = id ? `/clientes/${id}` : '/clientes';
        const method = id ? 'PUT' : 'POST';
        await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cliente)
        });
        cerrarModal();
        cargarClientes();
    } catch (error) {
        console.error("Error guardando cliente:", error);
    }
}

function abrirModal(cliente = null) {
    const form = document.getElementById("clienteForm");
    form?.reset();
    document.getElementById("clienteId").value = "";

    if (cliente) {
        document.getElementById("clienteId").value = cliente.id || '';
        document.getElementById("apodo").value = cliente.apodo || '';
        document.getElementById("nombre_completo").value = cliente.nombre_completo || '';
        document.getElementById("telefono").value = cliente.telefono || '';
        document.getElementById("localidad").value = cliente.localidad || '';
        document.getElementById("zona_reparto").value = cliente.zona_reparto || 'Zona A';
        document.getElementById("observaciones").value = cliente.observaciones || '';
        document.getElementById("modalTitle").innerText = "Editar Cliente";
    } else {
        document.getElementById("modalTitle").innerText = "Agregar Cliente";
    }

    const modal = document.getElementById("clienteModal");
    modal.classList.remove("hidden");
    setTimeout(() => {
        const content = modal.querySelector(".modal-content");
        content.classList.remove("scale-95", "opacity-0");
        content.classList.add("scale-100", "opacity-100");
    }, 10);
}

function cerrarModal() {
    const modal = document.getElementById("clienteModal");
    const content = modal.querySelector(".modal-content");
    content.classList.remove("scale-100", "opacity-100");
    content.classList.add("scale-95", "opacity-0");
    setTimeout(() => modal.classList.add("hidden"), 300);
}

async function eliminarCliente(id) {
    if (!id || !confirm("¿Seguro que deseas eliminar este cliente?")) return;
    try {
        const res = await fetch(`/clientes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error("Error al eliminar cliente");
        cargarClientes();
    } catch (error) {
        console.error("Error eliminando cliente:", error);
    }
}

// --- Nuevo Pedido ---
async function cargarClientesParaAutocomplete() {
    const apodoInput = document.getElementById('apodoAutoComplete');
    const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');
    if (!apodoInput) return;

    const res = await fetch('/clientes');
    const clientesData = await res.json();

    apodoInput.addEventListener('input', () => {
        const query = apodoInput.value.toLowerCase();
        autocompleteSuggestions.innerHTML = '';
        if (!query) { autocompleteSuggestions.classList.add('hidden'); return; }

        const matches = clientesData.filter(c => c.apodo.toLowerCase().includes(query));
        if (matches.length === 0) { autocompleteSuggestions.classList.add('hidden'); return; }

        matches.forEach(cliente => {
            const li = document.createElement('li');
            li.textContent = cliente.apodo;
            li.classList.add('cursor-pointer', 'px-4', 'py-2', 'hover:bg-gray-200');
            li.addEventListener('click', () => {
                apodoInput.value = cliente.apodo;
                clienteSeleccionado = cliente;
                rellenarCamposCliente(cliente);
                autocompleteSuggestions.classList.add('hidden');
            });
            autocompleteSuggestions.appendChild(li);
        });
        autocompleteSuggestions.classList.remove('hidden');
    });
}

function rellenarCamposCliente(cliente) {
    document.getElementById('nombreCompleto').value = cliente.nombre_completo;
    document.getElementById('zonaReparto').value = cliente.zona_reparto;
    document.getElementById('localidad').value = cliente.localidad;
}

function inicializarFormularioPedidos() {
    const tipoPedido = document.getElementById('tipoPedido');
    if (tipoPedido) {
        tipoPedido.addEventListener('change', () => {
            const container = document.getElementById('diasSemanaContainer');
            if (container) {
                container.classList.toggle('hidden', tipoPedido.value !== 'semanal');
            }
        });
    }

    const form = document.getElementById('nuevoPedidoForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!clienteSeleccionado) return alert('Selecciona un cliente válido.');

        const pedidoData = {
            cliente_id: clienteSeleccionado.id,
            apodo_cliente: clienteSeleccionado.apodo,
            tipo: document.getElementById('tipoPedido').value,
            dia_semana: document.getElementById('diaSemana')?.value || null,
            cantidad: parseInt(document.getElementById('cantidad').value),
            producto: document.getElementById('producto').value,
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
            if (!res.ok) throw new Error(data.details || data.error || 'Error desconocido en el servidor');

            mostrarMensajeExito('¡Pedido registrado con éxito!');
        } catch (err) {
            console.error('ERROR:', err.message);
            alert('Error: ' + err.message);
        }
    });
}

function limpiarFormularioPedido() {
    const form = document.getElementById('nuevoPedidoForm');
    if (form) form.reset();
    clienteSeleccionado = null;
    document.getElementById('autocompleteSuggestions')?.classList.add('hidden');
}

function mostrarMensajeExito(texto) {
    let popup = document.getElementById('mensajeExito');
    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'mensajeExito';
        popup.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded shadow-lg z-50 opacity-0 transition-opacity duration-300';
        document.body.appendChild(popup);
    }
    popup.textContent = texto;
    popup.classList.add('opacity-100');
    setTimeout(() => {
        popup.classList.remove('opacity-100');
        limpiarFormularioPedido();
    }, 2000);
}

async function cargarZonasNuevoPedido() {
    try {
        const res = await fetch('/zonas');
        const zonasData = await res.json();
        const select = document.getElementById('zonaRepartoNuevo');
        if (!select) return;
        select.innerHTML = '';
        zonasData.forEach(zona => {
            const option = document.createElement('option');
            option.value = zona.nombre;
            option.textContent = zona.nombre;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Error al cargar zonas:', err);
    }
}

// --- Pedidos Pendientes ---
async function cargarPedidosPendientes() {
    try {
        const res = await fetch('/pedidos_pendientes');
        pedidosPendientes = await res.json();
        renderizarPedidosPendientes(pedidosPendientes);
    } catch (err) {
        console.error('Error al cargar pedidos pendientes:', err);
    }
}

function renderizarPedidosPendientes(pedidos) {
    const lista = document.getElementById('listaPedidosPendientes');
    const mensajeVacio = document.getElementById('mensajeVacioPendientes');
    const totalPendientes = document.getElementById('totalPendientes');
    if (!lista || !mensajeVacio) return;

    lista.innerHTML = '';
    if (pedidos.length === 0) {
        mensajeVacio.classList.remove('hidden');
    } else {
        mensajeVacio.classList.add('hidden');
        pedidos.forEach(pedido => {
            const item = document.createElement('div');
            item.className = 'bg-white rounded-lg shadow-sm p-4 border border-gray-200';
            item.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <span class="text-sm font-semibold text-gray-700">Pedido para ${pedido.apodo} (${pedido.localidad})</span>
                    <div class="text-xs text-gray-500">
                        Zona: <span class="font-medium text-gray-700">${pedido.zona || 'N/A'}</span>
                    </div>
                </div>
                <p class="text-gray-800 text-lg font-bold">${pedido.pedido}</p>
                <p class="text-sm text-gray-500 mt-1">Programado para: ${pedido.fecha_programacion ? new Date(pedido.fecha_programacion).toLocaleDateString('es-ES') : 'Sin fecha'}</p>
                <p class="text-sm text-gray-500 mt-1">Observaciones: ${pedido.observaciones || 'N/A'}</p>
                <div class="flex justify-end gap-2 mt-4">
                    <button onclick="mostrarCalendarioModal(${pedido.historial_id})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-200">
                        📅 Programar en Calendario
                    </button>
                </div>
            `;
            lista.appendChild(item);
        });
    }
    if (totalPendientes) totalPendientes.textContent = pedidos.length;
}

function ordenarPedidosPendientes() {
    const ordenarPor = document.getElementById('ordenarPendientes').value;
    pedidosPendientes.sort((a, b) => {
        if (ordenarPor === 'zona') return (a.zona || '').localeCompare(b.zona || '');
        if (ordenarPor === 'apodo') return (a.apodo || '').localeCompare(b.apodo || '');
        if (ordenarPor === 'fechaEntrega') return new Date(a.fecha_programacion) - new Date(b.fecha_programacion);
        return 0;
    });
    renderizarPedidosPendientes(pedidosPendientes);
}

// Modal de calendario para programar pendientes
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

// BUG FIX #1: La función usaba el parámetro "id" pero debería usar la variable global pedidoParaProgramarId
async function programarPedidoConFecha() {
    const fechaSeleccionada = document.getElementById('fechaProgramacion').value;

    if (!fechaSeleccionada) {
        alert("Por favor, selecciona una fecha.");
        return;
    }

    if (!pedidoParaProgramarId) {
        alert("Error: no hay pedido seleccionado.");
        return;
    }

    try {
        const res = await fetch(`/pedidos/programar-con-fecha/${pedidoParaProgramarId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha: fechaSeleccionada })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'No se pudo programar el pedido.');
        }

        const data = await res.json();
        cerrarCalendarioModal();
        mostrarMensajeExito(`✅ Pedido programado para el ${data.dia_reparto} ${data.fecha_entrega}`);
        await cargarPedidosPendientes();

    } catch (err) {
        console.error('Error al programar pedido:', err.message);
        alert('Error: ' + err.message);
    }
}

// --- Calendario ---
async function cargarPedidosCalendario() {
    try {
        const res = await fetch(`/pedidos_calendario?offset=${semanaActualOffset}`);
        if (!res.ok) throw new Error('Error al cargar los pedidos del calendario.');

        const pedidos = await res.json();
        pedidosCalendario = {
            lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: []
        };

        pedidos.forEach(p => {
            const dia = p.dia_reparto?.toLowerCase();
            if (dia && pedidosCalendario[dia] !== undefined) {
                pedidosCalendario[dia].push(p);
            }
        });

        actualizarFranjaFechas();
        renderizarVistaCalendario();
    } catch (err) {
        console.error('Error al cargar pedidos del calendario:', err);
    }
}

function renderizarVistaCalendario() {
    if (vistaCalendarioActual === 'semanal') {
        renderizarVistaSemanal();
    } else {
        renderizarVistaDiaria();
    }
}

function cambiarVistaCalendario(vista) {
    vistaCalendarioActual = vista;
    const btnSemanal = document.getElementById('btnVistaSemanal');
    const btnDiaria = document.getElementById('btnVistaDiaria');
    const vistaSemanalDiv = document.getElementById('vistaSemanal');
    const vistaDiariaDiv = document.getElementById('vistaDiaria');
    const controlesNavegacion = document.getElementById('controlesNavegacion');

    if (vista === 'semanal') {
        btnSemanal?.classList.replace('bg-gray-500', 'bg-blue-600');
        btnDiaria?.classList.replace('bg-blue-600', 'bg-gray-500');
        vistaSemanalDiv?.classList.remove('hidden');
        vistaDiariaDiv?.classList.add('hidden');
        controlesNavegacion?.classList.remove('hidden');
        renderizarVistaSemanal();
    } else {
        btnDiaria?.classList.replace('bg-gray-500', 'bg-blue-600');
        btnSemanal?.classList.replace('bg-blue-600', 'bg-gray-500');
        vistaDiariaDiv?.classList.remove('hidden');
        vistaSemanalDiv?.classList.add('hidden');
        controlesNavegacion?.classList.add('hidden');
        renderizarVistaDiaria();
    }
}

function renderizarVistaSemanal() {
    const contenedor = document.getElementById('vistaSemanal');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    const fechas = obtenerFechasSemana();

    // BUG FIX #2: Usar claves sin tildes, igual que el objeto pedidosCalendario
    const diasOrden = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
    const diasNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    diasOrden.forEach((dia, index) => {
        const pedidos = pedidosCalendario[dia] || [];
        const fechaDia = fechas[dia];
        const col = document.createElement('div');
        col.className = 'bg-white p-4 rounded-lg shadow-md min-h-64 flex flex-col';
        col.innerHTML = `
            <p class="font-bold text-base text-center text-gray-800">${fechaDia}</p>
            <p class="text-sm text-gray-500 mb-3 text-center">${diasNombres[index]}</p>
            <div class="space-y-2 w-full flex-grow">
                ${pedidos.length === 0 ? '<p class="text-xs text-gray-400 text-center mt-4">Sin pedidos</p>' : ''}
                ${pedidos.map(p => `
                    <div class="border border-gray-200 rounded-lg p-2 cursor-pointer hover:bg-blue-50 transition-colors" onclick="mostrarDetallesPedido(${p.id})">
                        <p class="text-sm font-medium text-gray-800">${p.apodo_cliente}</p>
                        <p class="text-xs text-gray-600">${p.producto} (${p.cantidad})</p>
                    </div>
                `).join('')}
            </div>
        `;
        contenedor.appendChild(col);
    });
}

function renderizarVistaDiaria() {
    const listaPedidos = document.getElementById('pedidosDiarios');
    const mensajeVacio = document.getElementById('mensajeVacioDiario');
    const selectDia = document.getElementById('selectDiaDiario');
    if (!listaPedidos || !mensajeVacio || !selectDia) return;

    const diaSeleccionado = selectDia.value;
    listaPedidos.innerHTML = '';
    const pedidosDelDia = pedidosCalendario[diaSeleccionado] || [];

    if (pedidosDelDia.length > 0) {
        mensajeVacio.classList.add('hidden');
        pedidosDelDia.forEach(p => {
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-lg shadow-md cursor-pointer hover:bg-gray-50 border';
            div.onclick = () => mostrarDetallesPedido(p.id);
            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-lg">${p.apodo_cliente}</h3>
                        <p class="text-sm text-gray-600">${p.producto} (${p.cantidad})</p>
                    </div>
                    <span class="text-xs text-gray-400">${p.fecha_reparto ? new Date(p.fecha_reparto).toLocaleDateString('es-ES') : ''}</span>
                </div>
                <p class="text-sm text-gray-500 mt-1">Obs: ${p.observaciones || 'N/A'}</p>
            `;
            listaPedidos.appendChild(div);
        });
    } else {
        mensajeVacio.classList.remove('hidden');
    }
}

// BUG FIX #7: Modal de detalles — añadido inline ya que no existe en ningún HTML
async function mostrarDetallesPedido(id) {
    try {
        const res = await fetch(`/pedidos/detalles/${id}`);
        if (!res.ok) throw new Error('Error al obtener detalles del pedido');
        const pedido = await res.json();

        pedidoParaEditarId = id;

        // Crear modal dinámicamente si no existe
        let modal = document.getElementById('detallesPedidoModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'detallesPedidoModal';
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div class="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-xl font-bold text-gray-800">Detalles del Pedido</h3>
                    <button onclick="cerrarDetallesPedidoModal()" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>
                <div class="space-y-2 text-sm">
                    <p><strong>Cliente:</strong> ${pedido.apodo_cliente || 'N/A'}</p>
                    <p><strong>Producto:</strong> ${pedido.producto} (${pedido.cantidad} unidades)</p>
                    <p><strong>Fecha de Entrega:</strong> ${new Date(pedido.fecha_entrega).toLocaleDateString('es-ES')}</p>
                    <p><strong>Teléfono:</strong> ${pedido.telefono || 'N/A'}</p>
                    <p><strong>Localidad:</strong> ${pedido.localidad || 'N/A'}</p>
                    <p><strong>Observaciones:</strong> ${pedido.observaciones || 'N/A'}</p>
                </div>
                <div class="flex justify-end gap-2 mt-6">
                    <button onclick="cerrarDetallesPedidoModal()" class="px-4 py-2 bg-gray-300 hover:bg-gray-400 rounded-lg text-sm">Cerrar</button>
                    <button onclick="mostrarModalEditarFecha('${new Date(pedido.fecha_entrega).toISOString().split('T')[0]}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
                        ✏️ Editar Fecha
                    </button>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
        modal.classList.add('flex');

    } catch (err) {
        console.error('Error al mostrar detalles:', err);
        alert('Error al cargar los detalles del pedido.');
    }
}

function cerrarDetallesPedidoModal() {
    const modal = document.getElementById('detallesPedidoModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

function mostrarModalEditarFecha(fechaActual) {
    cerrarDetallesPedidoModal();
    const modal = document.getElementById('editarFechaModal');
    const inputFecha = document.getElementById('inputNuevaFecha');
    if (!modal || !inputFecha) return;
    inputFecha.value = fechaActual;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function cerrarModalEditarFecha() {
    const modal = document.getElementById('editarFechaModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
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
        await cargarPedidosCalendario();
    } catch (err) {
        alert('Error al actualizar la fecha: ' + err.message);
    }
}

function cambiarDiaDiario() {
    diaSeleccionadoDiario = document.getElementById('selectDiaDiario').value;
    renderizarVistaDiaria();
}

function obtenerFechasSemana() {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + semanaActualOffset * 7);
    const diaSemana = hoy.getDay();
    const diffLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() + diffLunes);

    const fechas = {};
    diasSemana.forEach((dia, i) => {
        const fecha = new Date(lunes);
        fecha.setDate(lunes.getDate() + i);
        fechas[dia] = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    });
    return fechas;
}

function actualizarFranjaFechas() {
    const fechas = obtenerFechasSemana();
    const contenedorFechas = document.getElementById('fechasSemana');
    if (contenedorFechas) {
        contenedorFechas.innerHTML = `Semana del ${fechas.lunes} al ${fechas.domingo}`;
    }
}

function semanaActual() { semanaActualOffset = 0; cargarPedidosCalendario(); }
function semanaAnterior() { semanaActualOffset--; cargarPedidosCalendario(); }
function semanaSiguiente() { semanaActualOffset++; cargarPedidosCalendario(); }

async function enviarDiaAHojaReparto() {
    const diaSeleccionado = document.getElementById('selectDiaDiario')?.value;
    const pedidosDelDia = pedidosCalendario[diaSeleccionado] || [];

    if (pedidosDelDia.length === 0) {
        alert('No hay pedidos para este día.');
        return;
    }

    const ids = pedidosDelDia.map(p => p.id);
    try {
        const res = await fetch('/pedidos/hoja-reparto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error('Error al enviar pedidos a la hoja.');
        mostrarMensajeExito(`✅ ${pedidosDelDia.length} pedidos enviados a la hoja de reparto`);
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

// --- Gestión BBDD ---
async function cargarConductores() {
    try {
        const res = await fetch('/conductores');
        const conductoresData = await res.json();
        const lista = document.getElementById('listaConductores');
        if (!lista) return;
        lista.innerHTML = '';
        conductoresData.forEach(c => {
            const li = document.createElement('li');
            li.className = 'p-3 flex items-center justify-between hover:bg-gray-100';
            li.innerHTML = `
                <span class="text-gray-800">${c.nombre}</span>
                <button onclick="eliminarConductor(${c.id})" class="text-red-600 hover:text-red-800">🗑️</button>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar conductores:', err);
    }
}

async function agregarConductor() {
    const input = document.getElementById('nuevoConductor');
    const nombre = input?.value.trim();
    if (!nombre) return;
    try {
        const res = await fetch('/conductores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

// BUG FIX #3: Los camiones usan c.nombre, no c.matricula
async function cargarCamiones() {
    try {
        const res = await fetch('/camiones');
        const camionesData = await res.json();
        const lista = document.getElementById('listaCamiones');
        if (!lista) return;
        lista.innerHTML = '';
        camionesData.forEach(c => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 text-sm';
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
    if (!matricula) return;
    try {
        const res = await fetch('/camiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        const zonasData = await res.json();
        const lista = document.getElementById('listaZonas');
        if (!lista) return;
        lista.innerHTML = '';
        zonasData.forEach(z => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 text-sm';
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
    if (!nombre) return;
    try {
        const res = await fetch('/zonas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

// --- Hoja de Reparto ---
function renderizarHojaReparto() {
    const lista = document.getElementById('listaPedidosHoja');
    const mensajeVacio = document.getElementById('mensajeVacioHoja');
    if (!lista || !mensajeVacio) return;

    lista.innerHTML = '';
    if (pedidosHojaReparto.length === 0) {
        mensajeVacio.classList.remove('hidden');
    } else {
        mensajeVacio.classList.add('hidden');
        pedidosHojaReparto.forEach(pedido => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-4 bg-gray-50 rounded-lg border';
            li.innerHTML = `
                <div>
                    <p class="font-bold text-lg">${pedido.apodo_cliente} - ${pedido.producto}</p>
                    <p class="text-sm text-gray-600">${pedido.cantidad} unidades</p>
                    <p class="text-xs text-gray-400">Entrega: ${new Date(pedido.fecha_entrega).toLocaleDateString('es-ES')}</p>
                </div>
                <button onclick="eliminarPedidoHoja(${pedido.id})" class="text-red-600 hover:text-red-800 no-print">🗑️</button>
            `;
            lista.appendChild(li);
        });
    }
}

async function cargarPedidosHoja() {
    try {
        const res = await fetch('/pedidos/hoja-reparto');
        if (!res.ok) throw new Error('Error al cargar pedidos.');
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
        const zonasData = await res.json();
        const select = document.getElementById('filtroZonaHoja');
        if (!select) return;
        select.innerHTML = '<option value="">Todas las zonas</option>';
        zonasData.forEach(zona => {
            const option = document.createElement('option');
            option.value = zona.nombre;
            option.textContent = zona.nombre;
            select.appendChild(option);
        });
    } catch (err) { console.error(err); }
}

// BUG FIX #4: El campo zona en pedidos_pendientes es "zona", no "zona_reparto"
async function cargarPedidosDisponibles() {
    const zonaFiltro = document.getElementById('filtroZonaHoja')?.value;
    const lista = document.getElementById('listaPedidosSelector');
    if (!lista) return;

    lista.innerHTML = '<p class="text-center text-gray-500">Cargando pedidos...</p>';

    try {
        const res = await fetch('/pedidos_pendientes');
        let pedidos = await res.json();

        if (zonaFiltro) {
            pedidos = pedidos.filter(p => p.zona === zonaFiltro);
        }

        lista.innerHTML = '';
        if (pedidos.length > 0) {
            pedidos.forEach(p => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-3 bg-gray-100 p-3 rounded-md';
                div.innerHTML = `
                    <input type="checkbox" data-pedido-id="${p.id}" class="form-checkbox text-blue-600 h-5 w-5">
                    <div>
                        <p class="font-bold">${p.apodo}</p>
                        <p class="text-sm text-gray-600">${p.pedido}</p>
                        <p class="text-xs text-gray-400">Zona: ${p.zona || 'N/A'}</p>
                    </div>
                `;
                lista.appendChild(div);
            });
        } else {
            lista.innerHTML = '<p class="text-center text-gray-500">No hay pedidos disponibles.</p>';
        }
    } catch (err) {
        lista.innerHTML = '<p class="text-center text-red-500">Error al cargar los pedidos.</p>';
    }
}

function cerrarSelectorPedidos() {
    const modal = document.getElementById('selectorPedidosModal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
}

async function agregarSeleccionadosALaHoja() {
    const checkboxes = document.querySelectorAll('#listaPedidosSelector input[type="checkbox"]:checked');
    const ids = Array.from(checkboxes).map(cb => parseInt(cb.dataset.pedidoId));

    if (ids.length === 0) { alert('Selecciona al menos un pedido.'); return; }

    try {
        const res = await fetch('/pedidos/hoja-reparto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error('Error al agregar pedidos.');
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

function imprimirHojaReparto() {
    window.print();
}

// --- Herramientas de Mantenimiento ---
function limpiarPedidosAntiguos() {
    if (confirm('¿Limpiar pedidos antiguos? Esta acción no se puede deshacer.')) {
        alert('Función pendiente de implementar en el servidor.');
    }
}

function exportarDatos() {
    alert('Función pendiente de implementar en el servidor.');
}

function resetearSistema() {
    if (confirm('⚠️ ¿RESETEAR EL SISTEMA? Se eliminarán TODOS los datos. Acción IRREVERSIBLE.')) {
        alert('Función pendiente de implementar en el servidor.');
    }
}

// BUG FIX #6: Un solo DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', function (e) {
        const modal = document.getElementById('clienteModal');
        if (modal && e.target === modal) cerrarModal();
    });

    cambiarPestana('BaseDatos');
});