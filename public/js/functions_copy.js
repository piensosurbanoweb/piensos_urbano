// Variables de control, declaradas solo una vez para toda la aplicación
let editandoId = null;
let semanaActualOffset = 0;
let vistaCalendarioActual = 'semanal';
let diaSeleccionadoDiario = 'lunes';
let clienteSeleccionado = null; // Variable para el autocompletado

let pedidoParaEditarId = null; // Almacenará el ID del pedido que se está editando

// Simulación de datos (reemplazar con llamadas a la API)
let pedidosPendientes = [];
let pedidosCalendario = {
    lunes: [], martes: [], miercoles: [], jueves: [], viernes: []
};

let clientes = [];
let zonas = [];
let conductores = ["Juan", "Pedro", "Manuel"];
let camiones = ["Camión 1", "Camión 2"];

let pedidosHojaReparto = [];

// --- Funciones de pestañas ---
async function cambiarPestana(nombrePestana) {
    const contenedor = document.getElementById('contenidoPestanas');
    if (!contenedor) {
        console.error("El elemento 'contenidoPestanas' no se encontró en el DOM.");
        return;
    }

    // Resetear el contenido del contenedor
    contenedor.innerHTML = '';

    // Gestionar el estado activo/inactivo de los botones
    const botones = ['BaseDatos', 'NuevoPedido', 'PedidosPendientes', 'Calendario', 'GestionBBDD', 'HojaReparto'];
    const baseClass = 'flex-1 px-5 py-4 text-center font-medium text-sm';
    const inactiveClass = `${baseClass} bg-gray-200 text-gray-700 hover:bg-gray-300`;
    const activeClass = `${baseClass} bg-blue-600 text-white`;

    botones.forEach(boton => {
        const tab = document.getElementById(`tab${boton}`);
        if (tab) {
            if (boton.toLowerCase() === nombrePestana.toLowerCase()) {
                tab.className = activeClass;
            } else {
                tab.className = inactiveClass;
            }
        }
    });

    // Cargar el contenido de la pestaña
    try {
        const res = await fetch(`${nombrePestana}.html`);
        if (!res.ok) {
            throw new Error(`No se pudo cargar la pestaña ${nombrePestana}.html`);
        }
        const html = await res.text();
        contenedor.innerHTML = html;

        // Después de que el HTML se haya inyectado, inicializar la pestaña
        if (nombrePestana === "BaseDatos") {
            inicializarBaseDatos();
        } else if (nombrePestana === "NuevoPedido") {
            inicializarNuevoPedido();
        } else if (nombrePestana === "Pendientes") {
            inicializarPendientes();
        } else if (nombrePestana === "Calendario") {
            inicializarCalendario();
            await cargarPedidosCalendario();
        } else if (nombrePestana === "GestionBBDD") {
            inicializarGestionBBDD();
        } else if (nombrePestana === "HojaReparto") {
            inicializarHojaReparto();
        }
    } catch (err) {
        console.error(`Error al cargar la pestaña ${nombrePestana}:`, err);
    }
}

// Funciones de inicialización para cada pestaña
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

// --- Funciones de Base de Datos ---
async function cargarClientes() {
    try {
        const loadingEl = document.getElementById("loading");
        const mensajeVacioEl = document.getElementById("mensajeVacio");
        const tablaEl = document.getElementById("listaClientes");

        // Asegurarse de que los elementos existen antes de interactuar con ellos
        if (!loadingEl || !mensajeVacioEl || !tablaEl) {
            console.error("Elementos HTML para la pestaña 'BaseDatos' no encontrados.");
            return;
        }

        loadingEl.classList.remove("hidden");
        mensajeVacioEl.classList.add("hidden");

        const response = await fetch('/clientes');
        const clientesData = await response.json();
        clientes = clientesData; // Guardar en variable global

        tablaEl.innerHTML = "";

        if (clientes.length === 0) {
            mensajeVacioEl.classList.remove("hidden");
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
                        onclick="eliminarCliente('${cliente.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            `;
            tablaEl.appendChild(fila);
        });

    } catch (error) {
        console.error("Error cargando clientes:", error);
    } finally {
        const loadingEl = document.getElementById("loading");
        if (loadingEl) {
            loadingEl.classList.add("hidden");
        }
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
        if (id) {
            await fetch(`/clientes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cliente)
            });
        } else {
            await fetch('/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cliente)
            });
        }

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

    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300);
}

async function eliminarCliente(id) {
    if (!id) {
        console.error("ID de cliente no válido:", id);
        return;
    }

    if (!confirm("¿Seguro que deseas eliminar este cliente?")) return;

    try {
        const res = await fetch(`/clientes/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            throw new Error("Error al eliminar cliente");
        }
        cargarClientes();
    } catch (error) {
        console.error("Error eliminando cliente:", error);
    }
}


// --- Funciones de Nuevo Pedido ---

// Cargar clientes para autocompletado
async function cargarClientesParaAutocomplete() {
    const apodoInput = document.getElementById('apodoAutoComplete');
    const autocompleteSuggestions = document.getElementById('autocompleteSuggestions');
    if (!apodoInput) return;

    const res = await fetch('/clientes');
    const clientes = await res.json();

    apodoInput.addEventListener('input', () => {
        const query = apodoInput.value.toLowerCase();
        autocompleteSuggestions.innerHTML = '';
        if (!query) return autocompleteSuggestions.classList.add('hidden');

        const matches = clientes.filter(c => c.apodo.toLowerCase().includes(query));
        if (matches.length === 0) return autocompleteSuggestions.classList.add('hidden');

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
            const res = await fetch('https://piensos-urbano.onrender.com/pedidos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pedidoData)
            });

            if (!res.ok) throw new Error('Error al registrar pedido');

            const nuevoPedido = await res.json();
            console.log('Pedido registrado:', nuevoPedido);
            mostrarMensajeExito('Pedido registrado con éxito!');
        } catch (err) {
            console.error('Error al registrar pedido:', err);
            alert('No se pudo registrar el pedido. Revisa la consola.');
        }
    });
}


function limpiarFormularioPedido() {
    const form = document.getElementById('nuevoPedidoForm');
    if (form) form.reset();
    clienteSeleccionado = null;
    const suggestions = document.getElementById('autocompleteSuggestions');
    if (suggestions) suggestions.classList.add('hidden');
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

// --- Funciones de Pedidos Pendientes ---
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
    const lista = document.getElementById('listaPedidosPendientes');
    const mensajeVacio = document.getElementById('mensajeVacioPendientes');
    const totalPendientes = document.getElementById('totalPendientes');
    if (!lista || !mensajeVacio || !totalPendientes) return;

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
                        Zona: <span class="font-medium text-gray-700">${pedido.zona}</span>
                    </div>
                </div>
                <p class="text-gray-800 text-lg font-bold">${pedido.pedido}</p>
                <p class="text-sm text-gray-500 mt-1">Programado para: ${pedido.fecha_programacion}</p>
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
    totalPendientes.textContent = pedidos.length;
}


function ordenarPedidosPendientes() {
    const ordenarPor = document.getElementById('ordenarPendientes').value;

    pedidosPendientes.sort((a, b) => {
        if (ordenarPor === 'zona') {
            return a.zona.localeCompare(b.zona);
        }
        if (ordenarPor === 'apodo') {
            return a.apodo.localeCompare(b.apodo);
        }
        if (ordenarPor === 'fechaEntrega') {
            const fechaA = new Date(a.fecha_programacion);
            const fechaB = new Date(b.fecha_programacion);
            return fechaA - fechaB;
        }
        if (ordenarPor === 'fechaPedido') {
            const fechaA = new Date(a.fecha_pedido);
            const fechaB = new Date(b.fecha_pedido);
            return fechaA - fechaB;
        }
        return 0;
    });

    renderizarPedidosPendientes(pedidosPendientes);
}

// --- Funciones de Calendario ---
// --- Funciones de Calendario ---
async function cargarPedidosCalendario() {
    try {
        const res = await fetch(`/pedidos_calendario?offset=${semanaActualOffset}`);
        if (!res.ok) throw new Error('Error al cargar los pedidos del calendario.');

        const pedidos = await res.json();
        pedidosCalendario = {
            lunes: [], martes: [], 'miércoles': [], jueves: [], viernes: [], 'sábado': [], domingo: []
        };
        pedidos.forEach(p => {
            const dia = p.dia_reparto.toLowerCase();
            if (pedidosCalendario[dia]) {
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
        if (btnSemanal) btnSemanal.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        if (btnDiaria) btnDiaria.className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        if (vistaSemanalDiv) vistaSemanalDiv.classList.remove('hidden');
        if (vistaDiariaDiv) vistaDiariaDiv.classList.add('hidden');
        if (controlesNavegacion) controlesNavegacion.classList.remove('hidden');
        renderizarVistaSemanal();
    } else if (vista === 'diaria') {
        if (btnDiaria) btnDiaria.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        if (btnSemanal) btnSemanal.className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        if (vistaDiariaDiv) vistaDiariaDiv.classList.remove('hidden');
        if (vistaSemanalDiv) vistaSemanalDiv.classList.add('hidden');
        if (controlesNavegacion) controlesNavegacion.classList.add('hidden');
        renderizarVistaDiaria();
    }
}

function renderizarVistaSemanal() {
    const contenedor = document.getElementById('vistaSemanal');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    const fechas = obtenerFechasSemana();

    const diasSemana = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

    diasSemana.forEach(dia => {
        const pedidos = pedidosCalendario[dia] || [];
        const fechaDia = fechas[dia];
        const col = document.createElement('div');
        col.className = 'bg-white p-6 rounded-lg shadow-md min-h-64 flex flex-col items-center justify-start';
        col.innerHTML = `
            <p class="font-bold text-lg text-center text-gray-800">${fechaDia}</p>
            <p class="text-sm text-gray-500 mb-4">${dia.charAt(0).toUpperCase() + dia.slice(1)}</p>
            <div class="space-y-2 w-full flex-grow">
                ${pedidos.map(p => `
                    <div class="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-100" onclick="mostrarDetallesPedido(${p.id})">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="text-sm font-medium">${p.apodo_cliente}</p>
                                <p class="text-xs text-gray-600">${p.producto} (${p.cantidad})</p>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        contenedor.appendChild(col);
    });
}

async function mostrarDetallesPedido(id) {
    try {
        const res = await fetch(`/pedidos/detalles/${id}`);
        if (!res.ok) {
            // Se lanza un error con un mensaje más detallado
            const errorData = await res.json();
            throw new Error(errorData.error || 'Error al obtener los detalles del pedido.');
        }

        const pedido = await res.json();
        const modal = document.getElementById('detallesPedidoModal');
        const contenido = document.getElementById('detallesPedidoContenido');

        if (!modal || !contenido) return;

        pedidoParaEditarId = pedido.id;

        contenido.innerHTML = `
            <div class="p-6">
                <h3 class="font-bold text-2xl mb-4 text-center">Detalles del Pedido</h3>
                <p><strong>Cliente:</strong> ${pedido.apodo_cliente || 'N/A'}</p>
                <p><strong>Producto:</strong> ${pedido.producto} (${pedido.cantidad} unidades)</p>
                <p><strong>Fecha de Entrega:</strong> ${new Date(pedido.fecha_entrega).toLocaleDateString()}</p>
                <p><strong>Teléfono:</strong> ${pedido.telefono || 'N/A'}</p>
                <p><strong>Dirección:</strong> ${pedido.localidad || 'N/A'}</p>
                <p><strong>Observaciones:</strong> ${pedido.observaciones || 'N/A'}</p>
                <div class="mt-6 flex justify-center">
                    <button onclick="mostrarModalEditarFecha('${new Date(pedido.fecha_entrega).toISOString().split('T')[0]}')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                        Editar Fecha
                    </button>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    } catch (err) {
        console.error('Error al mostrar los detalles del pedido:', err);
        alert(`Hubo un error al cargar los detalles del pedido: ${err.message}`);
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
    const modal = document.getElementById('editarFechaModal');
    const inputFecha = document.getElementById('inputNuevaFecha');

    cerrarDetallesPedidoModal();

    if (!modal || !inputFecha) return;

    inputFecha.value = fechaActual;
    modal.classList.remove('hidden');
}

function renderizarVistaDiaria() {
    const listaPedidos = document.getElementById('pedidosDiarios');
    const mensajeVacio = document.getElementById('mensajeVacioDiario');
    const diaSeleccionado = document.getElementById('selectDiaDiario').value;

    if (!listaPedidos || !mensajeVacio) return;

    listaPedidos.innerHTML = '';
    const pedidosDelDia = pedidosCalendario[diaSeleccionado] || [];

    if (pedidosDelDia.length > 0) {
        mensajeVacio.classList.add('hidden');
        pedidosDelDia.forEach(p => {
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-lg shadow-md cursor-pointer hover:bg-gray-100';
            div.onclick = () => mostrarDetallesPedido(p.id);
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="font-bold text-lg">${p.apodo_cliente} - ${p.producto}</h3>
                        <p class="text-sm text-gray-600">Para: ${p.apodo_cliente}</p>
                    </div>
                </div>
                <p class="text-sm text-gray-500">Observaciones: ${p.observaciones || 'N/A'}</p>
            `;
            listaPedidos.appendChild(div);
        });
    } else {
        mensajeVacio.classList.remove('hidden');
    }
}

function cerrarModalEditarFecha() {
    const modal = document.getElementById('editarFechaModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    pedidoParaEditarId = null;
}

async function guardarNuevaFecha() {
    if (!pedidoParaEditarId) {
        alert('No se ha seleccionado un pedido para editar.');
        return;
    }

    const nuevaFecha = document.getElementById('inputNuevaFecha').value;
    if (!nuevaFecha) {
        alert('Por favor, selecciona una fecha válida.');
        return;
    }

    try {
        const res = await fetch(`/pedidos/editar-fecha/${pedidoParaEditarId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha: nuevaFecha })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || 'Error al actualizar la fecha del pedido.');
        }

        cerrarModalEditarFecha();
        await cargarPedidosCalendario();

    } catch (err) {
        console.error('Error al guardar la nueva fecha:', err);
        alert(`Hubo un error al actualizar la fecha del pedido: ${err.message}`);
    }
}

function cambiarDiaDiario() {
    const selectDia = document.getElementById('selectDiaDiario');
    diaSeleccionadoDiario = selectDia.value;
    renderizarVistaDiaria();
}

function obtenerFechasSemana() {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() + semanaActualOffset * 7);
    const primerDia = new Date(hoy.setDate(hoy.getDate() - hoy.getDay() + (hoy.getDay() === 0 ? -6 : 1)));
    const dias = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const fechas = {};

    for (let i = 0; i < 7; i++) {
        const fecha = new Date(primerDia);
        fecha.setDate(primerDia.getDate() + i);
        fechas[dias[i].toLowerCase()] = fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
    }
    return fechas;
}

function actualizarFranjaFechas() {
    const fechas = obtenerFechasSemana();
    const contenedorFechas = document.getElementById('fechasSemana');
    if (contenedorFechas) {
        const inicioSemana = fechas.lunes;
        const finSemana = fechas.domingo;
        contenedorFechas.innerHTML = `Semana del ${inicioSemana} al ${finSemana}`;
    }
}

function semanaAnterior() {
    semanaActualOffset--;
    cargarPedidosCalendario();
}

function semanaSiguiente() {
    semanaActualOffset++;
    cargarPedidosCalendario();
}


// -- Funciones de gestión BBDD --
async function cargarConductores() {
    try {
        const res = await fetch('/conductores');
        const conductoresData = await res.json();
        const lista = document.getElementById('listaConductores');
        if (!lista) return;

        lista.innerHTML = '';
        conductoresData.forEach(conductor => {
            const li = document.createElement('li');
            li.className = 'p-3 flex items-center justify-between hover:bg-gray-100 transition-colors duration-200';
            li.innerHTML = `
                <span class="text-gray-800">${conductor.nombre}</span>
                <button onclick="eliminarConductor(${conductor.id})" class="text-red-600 hover:text-red-800 text-lg">🗑️</button>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar conductores:', err);
    }
}

async function eliminarConductor(id) {
    if (confirm("¿Estás seguro de que quieres eliminar este conductor?")) {
        try {
            const res = await fetch(`/conductores/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarConductores();
            } else {
                console.error('Error al eliminar conductor');
            }
        } catch (err) {
            console.error('Error de red:', err);
        }
    }
}

async function cargarCamiones() {
    try {
        const res = await fetch('/camiones');
        const camiones = await res.json();
        const lista = document.getElementById('listaCamiones'); // Ahora 'lista' no será null
        lista.innerHTML = '';
        camiones.forEach(c => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 text-sm';
            li.innerHTML = `
                    <span>${c.matricula}</span>
                    <button onclick="eliminarCamion(${c.id})" class="text-red-600 hover:text-red-800">🗑️</button>
                `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar camiones:', err);
    }
}

async function eliminarCamion(id) {
    if (confirm("¿Estás seguro de que quieres eliminar este camión?")) {
        try {
            const res = await fetch(`/camiones/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarCamiones();
            } else {
                console.error('Error al eliminar camión');
            }
        } catch (err) {
            console.error('Error de red:', err);
        }
    }
}

async function cargarZonas() {
    try {
        const res = await fetch('/zonas');
        const zonasData = await res.json();
        const lista = document.getElementById('listaZonas');
        if (!lista) return;

        lista.innerHTML = '';
        zonasData.forEach(zona => {
            const li = document.createElement('li');
            li.className = 'p-3 flex items-center justify-between hover:bg-gray-100 transition-colors duration-200';
            li.innerHTML = `
                <span class="text-gray-800">${zona.nombre}</span>
                <button onclick="eliminarZona(${zona.id})" class="text-red-600 hover:text-red-800 text-lg">🗑️</button>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar zonas:', err);
    }
}

async function eliminarZona(id) {
    if (confirm("¿Estás seguro de que quieres eliminar esta zona?")) {
        try {
            const res = await fetch(`/zonas/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarZonas();
            } else {
                console.error('Error al eliminar zona');
            }
        } catch (err) {
            console.error('Error de red:', err);
        }
    }
}

// --- Funciones de Hoja de Reparto ---

function renderizarHojaReparto() {
    const lista = document.getElementById('listaPedidosHoja');
    const mensajeVacio = document.getElementById('mensajeVacioHoja');

    if (!lista || !mensajeVacio) return;

    lista.innerHTML = ''; // Limpia la lista existente

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
                    <p class="text-xs text-gray-400">Entrega: ${new Date(pedido.fecha_entrega).toLocaleDateString()}</p>
                </div>
                <button onclick="eliminarPedidoHoja(${pedido.id})" class="text-red-600 hover:text-red-800 no-print">🗑️</button>
            `;
            lista.appendChild(li);
        });
    }
}


/**
 * Carga los pedidos específicos para la hoja de reparto haciendo una llamada a la API.
 */
async function cargarPedidosHoja() {
    try {
        const res = await fetch('/pedidos/hoja-reparto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [] }) // Petición vacía para cargar la vista inicial
        });
        if (!res.ok) {
            throw new Error('Error en el servidor al cargar los pedidos.');
        }
        const pedidos = await res.json();
        pedidosHojaReparto = pedidos;
        renderizarHojaReparto();
    } catch (err) {
        console.error('Error al cargar pedidos de la hoja de reparto:', err);
    }
}



/**
 * Muestra el modal del selector de pedidos y carga las zonas y pedidos disponibles.
 */
async function mostrarSelectorPedidos() {
    const modal = document.getElementById('selectorPedidosModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Cargar zonas y pedidos simultáneamente para optimizar
    await Promise.all([cargarZonasHoja(), cargarPedidosDisponibles()]);
}

/**
 * Carga las zonas para el filtro de la hoja de reparto.
 */
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
    } catch (err) {
        console.error('Error al cargar zonas de la hoja de reparto:', err);
    }
}

/**
 * Carga los pedidos disponibles para ser agregados a la hoja de reparto,
 * con la opción de filtrar por zona.
 */
async function cargarPedidosDisponibles() {
    const zonaFiltro = document.getElementById('filtroZonaHoja').value;
    const lista = document.getElementById('listaPedidosSelector');

    if (!lista) return;

    lista.innerHTML = '<p class="text-center text-gray-500">Cargando pedidos...</p>';

    try {
        const res = await fetch('/pedidos_pendientes');
        let pedidos = await res.json();

        if (zonaFiltro) {
            pedidos = pedidos.filter(p => p.zona_reparto === zonaFiltro);
        }

        lista.innerHTML = '';
        if (pedidos.length > 0) {
            pedidos.forEach(p => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-3 bg-gray-100 p-3 rounded-md';
                div.innerHTML = `
                    <input type="checkbox" data-pedido-id="${p.id}" class="form-checkbox text-blue-600 h-5 w-5">
                    <div>
                        <p class="font-bold">${p.apodo_cliente}</p>
                        <p class="text-sm text-gray-600">${p.producto} (${p.cantidad})</p>
                    </div>
                `;
                lista.appendChild(div);
            });
        } else {
            lista.innerHTML = '<p class="text-center text-gray-500">No hay pedidos disponibles para esta zona.</p>';
        }
    } catch (err) {
        console.error('Error al cargar pedidos disponibles:', err);
        lista.innerHTML = '<p class="text-center text-red-500">Error al cargar los pedidos.</p>';
    }
}

/**
 * Cierra el modal del selector de pedidos.
 */
function cerrarSelectorPedidos() {
    const modal = document.getElementById('selectorPedidosModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

/**
 * Agrega los pedidos seleccionados en el modal a la hoja de reparto.
 */
async function agregarSeleccionadosALaHoja() {
    const checkboxes = document.querySelectorAll('#listaPedidosSelector input[type="checkbox"]:checked');
    const ids = Array.from(checkboxes).map(cb => cb.dataset.pedidoId);

    if (ids.length === 0) {
        alert('Por favor, selecciona al menos un pedido.');
        return;
    }

    try {
        const res = await fetch('/pedidos/hoja-reparto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids })
        });

        if (!res.ok) {
            throw new Error('Error en el servidor al agregar pedidos.');
        }

        const nuevosPedidos = await res.json();
        pedidosHojaReparto = [...pedidosHojaReparto, ...nuevosPedidos];
        renderizarHojaReparto();
        cerrarSelectorPedidos();
    } catch (err) {
        console.error('Error al agregar pedidos a la hoja:', err);
        alert('Hubo un error al agregar los pedidos. Revisa la consola.');
    }
}

/**
 * Elimina un pedido de la hoja de reparto (solo del frontend).
 */
function eliminarPedidoHoja(id) {
    if (confirm('¿Quieres eliminar este pedido de la hoja de reparto?')) {
        pedidosHojaReparto = pedidosHojaReparto.filter(p => p.id !== id);
        renderizarHojaReparto();
    }
}

/**
 * Limpia todos los pedidos de la hoja de reparto (solo del frontend).
 */
function limpiarHojaReparto() {
    if (confirm('¿Estás seguro de que quieres limpiar la hoja de reparto?')) {
        pedidosHojaReparto = [];
        renderizarHojaReparto();
    }
}

/**
 * Imprime el contenido de la hoja de reparto.
 */
function imprimirHojaReparto() {
    window.print();
}


// Inicialización de eventos al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
    renderizarHojaReparto();
    const filtroZona = document.getElementById('filtroZonaHoja');
    if (filtroZona) {
        filtroZona.addEventListener('change', cargarPedidosDisponibles);
    }
    const modal = document.getElementById('selectorPedidosModal');
    if (modal) {
        modal.addEventListener('click', function (e) {
            if (e.target === this) {
                cerrarSelectorPedidos();
            }
        });
    }
});


// --- Funciones de Nuevo Pedido ---
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
        console.error('Error al cargar zonas para nuevo pedido:', err);
    }
}

// Variable global para guardar el ID del pedido
let pedidoParaProgramarId = null;

// Función que se llama desde el botón para abrir el modal
function mostrarCalendarioModal(pedidoId) {
    pedidoParaProgramarId = pedidoId;
    const modal = document.getElementById('calendarModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

// Función para cerrar el modal
function cerrarCalendarioModal() {
    const modal = document.getElementById('calendarModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    pedidoParaProgramarId = null;
}

// NUEVA FUNCIÓN para programar el pedido con la fecha seleccionada
async function programarPedidoConFecha() {
    const fechaSeleccionada = document.getElementById('fechaEntregaInput').value;

    if (!fechaSeleccionada) {
        alert("Por favor, selecciona una fecha.");
        return;
    }

    if (!pedidoParaProgramarId) {
        alert("Error: No se encontró el ID del pedido.");
        return;
    }

    try {
        const res = await fetch(`/pedidos/programar-con-fecha/${pedidoParaProgramarId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha: fechaSeleccionada })
        });

        if (!res.ok) {
            throw new Error('No se pudo programar el pedido en el calendario.');
        }

        const data = await res.json();
        alert(`Pedido programado:\n\nDía: ${data.dia_reparto}\nFecha: ${data.fecha_reparto}\nPara: ${data.apodo} - ${data.pedido}`);

        cerrarCalendarioModal();

        // Recargar las listas para que se reflejen los cambios
        await cargarPedidosPendientes();
        await cambiarPestana('Calendario');

        if (typeof cargarPedidosCalendario === 'function') {
            cargarPedidosCalendario();
        }

    } catch (err) {
        console.error('Error al programar el pedido:', err);
        alert('Hubo un error al intentar programar el pedido. Revisa la consola.');
    }
}


// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    // Cerrar modal al hacer click fuera del contenido
    document.addEventListener('click', function (e) {
        const modal = document.getElementById('clienteModal');
        if (modal && e.target === modal) {
            cerrarModal();
        }
    });

    // Iniciar con la primera pestaña
    cambiarPestana('BaseDatos');
    cargarConductores();
    cargarCamiones();
    cargarZonas();
});

// --- Gestión de Conductores ---
async function cargarConductores() {
    try {
        const res = await fetch('/conductores');
        const conductores = await res.json();
        const lista = document.getElementById('listaConductores');
        lista.innerHTML = '';
        conductores.forEach(c => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 text-sm';
            li.innerHTML = `
                    <span>${c.nombre}</span>
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
    const nombre = input.value.trim();
    if (!nombre) return;

    try {
        const res = await fetch('/conductores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        if (res.ok) {
            input.value = '';
            cargarConductores();
        }
    } catch (err) {
        console.error('Error al agregar conductor:', err);
    }
}

async function eliminarConductor(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este conductor?')) {
        try {
            const res = await fetch(`/conductores/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarConductores();
            }
        } catch (err) {
            console.error('Error al eliminar conductor:', err);
        }
    }
}

// --- Gestión de Camiones ---
async function cargarCamiones() {
    try {
        const res = await fetch('/camiones');
        const camiones = await res.json();
        const lista = document.getElementById('listaCamiones');
        lista.innerHTML = '';
        camiones.forEach(c => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 text-sm';
            li.innerHTML = `
                <span>${c.nombre}</span>
                <button onclick="eliminarCamion(${c.id})" class="text-red-600 hover:text-red-800">🗑️</button>
            `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar camiones:', err);
    }
}


async function agregarCamion() {
    const input = document.getElementById('nuevoCamion');
    const matricula = input.value.trim();
    if (!matricula) return;

    try {
        const res = await fetch('/camiones', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ matricula })
        });
        if (res.ok) {
            input.value = '';
            cargarCamiones();
        }
    } catch (err) {
        console.error('Error al agregar camión:', err);
    }
}

async function eliminarCamion(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este camión?')) {
        try {
            const res = await fetch(`/camiones/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarCamiones();
            }
        } catch (err) {
            console.error('Error al eliminar camión:', err);
        }
    }
}

// --- Gestión de Zonas ---
async function cargarZonas() {
    try {
        const res = await fetch('/zonas');
        const zonas = await res.json();
        const lista = document.getElementById('listaZonas');
        lista.innerHTML = '';
        zonas.forEach(z => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center p-3 text-sm';
            li.innerHTML = `
                    <span>${z.nombre}</span>
                    <button onclick="eliminarZona(${z.id})" class="text-red-600 hover:text-red-800">🗑️</button>
                `;
            lista.appendChild(li);
        });
    } catch (err) {
        console.error('Error al cargar zonas:', err);
    }
}

async function agregarZona() {
    const input = document.getElementById('nuevaZona');
    const nombre = input.value.trim();
    if (!nombre) return;

    try {
        const res = await fetch('/zonas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre })
        });
        if (res.ok) {
            input.value = '';
            cargarZonas();
        }
    } catch (err) {
        console.error('Error al agregar zona:', err);
    }
}

async function eliminarZona(id) {
    if (confirm('¿Estás seguro de que quieres eliminar esta zona?')) {
        try {
            const res = await fetch(`/zonas/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarZonas();
            }
        } catch (err) {
            console.error('Error al eliminar zona:', err);
        }
    }
}

// --- Herramientas de Mantenimiento (Funciones simuladas) ---
function limpiarPedidosAntiguos() {
    if (confirm('¿Estás seguro de que quieres limpiar los pedidos antiguos? Esta acción no se puede deshacer.')) {
        alert('Limpieza de pedidos antiguos simulada. Se ha llamado a la API para realizar la acción.');
        // Aquí iría el fetch a la API: await fetch('/api/limpiar-pedidos', { method: 'POST' });
    }
}

function exportarDatos() {
    alert('Exportación de datos simulada. Se está preparando el archivo para descarga.');
    // Aquí iría el fetch a la API para descargar un archivo: await fetch('/api/exportar-datos');
}

function resetearSistema() {
    if (confirm('⚠️ ¡ADVERTENCIA! ¿Estás seguro de que quieres RESETEAR EL SISTEMA? Se eliminarán todos los clientes, pedidos y registros. Esta acción es IRREVERSIBLE.')) {
        alert('El reseteo del sistema se ha simulado. Se ha llamado a la API para realizar la acción.');
        // Aquí iría el fetch a la API: await fetch('/api/resetear-sistema', { method: 'POST' });
    }
}