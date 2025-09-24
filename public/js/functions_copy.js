// Variables de control, declaradas solo una vez para toda la aplicación
let editandoId = null;
let semanaActualOffset = 0;
let vistaCalendarioActual = 'semanal';
let diaSeleccionadoDiario = 'lunes';
let clienteSeleccionado = null; // Variable para el autocompletado

// Simulación de datos (reemplazar con llamadas a la API)
let pedidosPendientes = [];
let pedidosCalendario = {
    lunes: [], martes: [], miercoles: [], jueves: [], viernes: []
};
let pedidoParaEditarId = null; // Almacenará el ID del pedido que se está editando
let clientes = [];
let zonas = [];
let conductores = ["Juan", "Pedro", "Manuel"];
let camiones = ["Camión 1", "Camión 2"];

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
async function cargarPedidosCalendario() {
    try {
        const res = await fetch('/pedidos_calendario');
        const pedidos = await res.json();
        pedidosCalendario = {
            lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: []
        };
        pedidos.forEach(p => {
            const dia = p.dia_reparto.toLowerCase();
            if (pedidosCalendario[dia]) {
                pedidosCalendario[dia].push(p);
            }
        });
        renderizarVistaCalendario();
    } catch (err) {
        console.error('Error al cargar pedidos del calendario:', err);
    }
}

// Lógica para alternar entre la vista semanal y diaria
function cambiarVistaCalendario(vista) {
    vistaCalendarioActual = vista;
    const btnSemanal = document.getElementById('btnVistaSemanal');
    const btnDiaria = document.getElementById('btnVistaDiaria');
    const vistaSemanalDiv = document.getElementById('vistaSemanal');
    const vistaDiariaDiv = document.getElementById('vistaDiaria');
    const controlesNavegacion = document.getElementById('controlesNavegacion');

    if (vista === 'semanal') {
        btnSemanal.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        btnDiaria.className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        vistaSemanalDiv.classList.remove('hidden');
        vistaDiariaDiv.classList.add('hidden');
        controlesNavegacion.classList.remove('hidden');
        renderizarVistaSemanal();
    } else if (vista === 'diaria') {
        btnDiaria.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        btnSemanal.className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        vistaDiariaDiv.classList.remove('hidden');
        vistaSemanalDiv.classList.add('hidden');
        controlesNavegacion.classList.add('hidden');
        renderizarVistaDiaria();
    }
}

// Renderiza la vista semanal con el recuadro más grande y botón de edición
function renderizarVistaSemanal() {
    const contenedor = document.getElementById('vistaSemanal');
    if (!contenedor) return;
    contenedor.innerHTML = '';
    Object.entries(pedidosCalendario).forEach(([dia, pedidos]) => {
        const col = document.createElement('div');
        col.className = 'bg-white p-6 rounded-lg shadow-md min-h-64 flex flex-col items-center justify-start'; 
        col.innerHTML = `
            <h4 class="font-bold mb-2 text-center text-gray-800">${dia.charAt(0).toUpperCase() + dia.slice(1)}</h4>
            <div class="space-y-2 w-full flex-grow">
                ${pedidos.map(p => `
                    <div class="border border-gray-200 rounded-lg p-3">
                        <div class="flex justify-between items-center">
                            <div>
                                <p class="text-sm font-medium">${p.pedido}</p>
                                <p class="text-xs text-gray-600">Para: ${p.apodo}</p>
                            </div>
                            <button onclick="mostrarModalEditarFecha(${p.historial_id}, '${p.fecha_reparto}')" class="text-blue-500 hover:text-blue-700">
                                ✏️
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        contenedor.appendChild(col);
    });
}

// LÓGICA PARA LA VISTA DIARIA (con botón de edición)
function renderizarVistaDiaria() {
    const listaPedidos = document.getElementById('pedidosDiarios');
    const mensajeVacio = document.getElementById('mensajeVacioDiario');
    const diaSeleccionado = document.getElementById('selectDiaDiario').value;

    listaPedidos.innerHTML = '';
    const pedidosDelDia = pedidosCalendario[diaSeleccionado] || [];
    
    if (pedidosDelDia.length > 0) {
        mensajeVacio.classList.add('hidden');
        pedidosDelDia.forEach(p => {
            const div = document.createElement('div');
            div.className = 'bg-white p-4 rounded-lg shadow-md';
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="font-bold text-lg">${p.apodo} - ${p.pedido}</h3>
                        <p class="text-sm text-gray-600">Teléfono: ${p.telefono}</p>
                    </div>
                    <button onclick="mostrarModalEditarFecha(${p.historial_id}, '${p.fecha_reparto}')" class="text-blue-500 hover:text-blue-700">
                        ✏️
                    </button>
                </div>
                <p class="text-sm text-gray-500">Observaciones: ${p.observaciones || 'N/A'}</p>
            `;
            listaPedidos.appendChild(div);
        });
    } else {
        mensajeVacio.classList.remove('hidden');
    }
}

// LÓGICA PARA MOSTRAR EL MODAL DE EDICIÓN DE FECHA (NUEVA FUNCIÓN)
function mostrarModalEditarFecha(id, fechaActual) {
    const modal = document.getElementById('editarFechaModal');
    const inputFecha = document.getElementById('inputNuevaFecha');
    
    pedidoParaEditarId = id; // Guardamos el ID del pedido a nivel global
    inputFecha.value = fechaActual;
    modal.classList.remove('hidden');
}

// LÓGICA PARA CERRAR EL MODAL
function cerrarModalEditarFecha() {
    const modal = document.getElementById('editarFechaModal');
    modal.classList.add('hidden');
    pedidoParaEditarId = null; // Reiniciamos el ID
}

// LÓGICA PARA GUARDAR LA NUEVA FECHA (NUEVA FUNCIÓN)
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
            throw new Error('Error al actualizar la fecha del pedido.');
        }

        const data = await res.json();
        alert('Fecha del pedido actualizada con éxito.');
        cerrarModalEditarFecha();
        await cargarPedidosCalendario(); // Recargamos el calendario
        
    } catch (err) {
        console.error('Error al guardar la nueva fecha:', err);
        alert('Hubo un error al actualizar la fecha del pedido. Revisa la consola.');
    }
}

// LÓGICA PARA CAMBIAR EL DÍA EN LA VISTA DIARIA
function cambiarDiaDiario() {
    const selectDia = document.getElementById('selectDiaDiario');
    diaSeleccionadoDiario = selectDia.value;
    renderizarVistaDiaria();
}

// Funciones para navegar por las semanas
function semanaAnterior() {
    semanaActualOffset--;
    cargarPedidosCalendario();
}

function semanaSiguiente() {
    semanaActualOffset++;
    cargarPedidosCalendario();
}


// Funciones de gestión BBDD
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
        const camionesData = await res.json();
        const lista = document.getElementById('listaCamiones');
        if (!lista) return;

        lista.innerHTML = '';
        camionesData.forEach(camion => {
            const li = document.createElement('li');
            li.className = 'p-3 flex items-center justify-between hover:bg-gray-100 transition-colors duration-200';
            li.innerHTML = `
                <span class="text-gray-800">${camion.nombre}</span>
                <button onclick="eliminarCamion(${camion.id})" class="text-red-600 hover:text-red-800 text-lg">🗑️</button>
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
async function cargarPedidosHoja() {
    try {
        // Lógica para cargar pedidos específicos de la hoja de reparto.
        // Por ahora, lo dejamos vacío para evitar errores.
        console.log("Función cargarPedidosHoja ejecutada.");
    } catch (err) {
        console.error('Error al cargar pedidos de la hoja de reparto:', err);
    }
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
    } catch (err) {
        console.error('Error al cargar zonas de la hoja de reparto:', err);
    }
}

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
});

function agregarConductor() {
    const input = document.getElementById('nuevoConductor');
    const nombreConductor = input.value.trim();

    if (!nombreConductor) {
        alert('Por favor, ingresa un nombre válido para el conductor.');
        return;
    }

    conductores.push(nombreConductor); // Agregar el conductor al array global
    input.value = ''; // Limpiar el campo de entrada
    console.log('Conductor agregado:', nombreConductor);
    cargarConductores(); // Actualizar la lista de conductores en la interfaz
}