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

    botones.forEach(btn => {
        const elemento = document.getElementById(`btn${btn}`);
        if (elemento) {
            elemento.className = (btn === nombrePestana) ? activeClass : inactiveClass;
        }
    });

    // Cargar el contenido de la pestaña
    try {
        let contenidoHtml = '';
        switch (nombrePestana) {
            case 'BaseDatos':
                contenidoHtml = await (await fetch('BaseDatos.html')).text();
                break;
            case 'NuevoPedido':
                contenidoHtml = await (await fetch('NuevoPedido.html')).text();
                break;
            case 'PedidosPendientes':
                contenidoHtml = await (await fetch('PedidosPendientes.html')).text();
                break;
            case 'Calendario':
                contenidoHtml = await (await fetch('Calendario.html')).text();
                break;
            case 'GestionBBDD':
                contenidoHtml = await (await fetch('GestionBBDD.html')).text();
                break;
            case 'HojaReparto':
                contenidoHtml = await (await fetch('HojaReparto.html')).text();
                break;
            default:
                contenidoHtml = '<p>Pestaña no encontrada.</p>';
        }
        contenedor.innerHTML = contenidoHtml;
    } catch (err) {
        console.error('Error al cargar la pestaña:', err);
    }

    if (nombrePestana === 'BaseDatos') {
        cargarClientes();
    } else if (nombrePestana === 'NuevoPedido') {
        await cargarZonasParaNuevoPedido();
        await cargarClientesParaAutocompletado();
    } else if (nombrePestana === 'PedidosPendientes') {
        await cargarPedidosPendientes();
    } else if (nombrePestana === 'Calendario') {
        await cargarPedidosCalendario();
    } else if (nombrePestana === 'GestionBBDD') {
        cargarConductores();
        cargarCamiones();
        cargarZonas();
    } else if (nombrePestana === 'HojaReparto') {
        // Lógica de carga para la hoja de reparto, si es necesaria
    }

    vistaCalendarioActual = 'semanal';
    semanaActualOffset = 0;
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
function obtenerFechasSemana(offset) {
    const hoy = new Date();
    const diaActual = hoy.getDay();
    const diferencia = hoy.getDate() - diaActual + (diaActual === 0 ? -6 : 1);
    const inicioSemana = new Date(hoy.setDate(diferencia));
    inicioSemana.setDate(inicioSemana.getDate() + offset * 7);

    const fechas = [];
    for (let i = 0; i < 7; i++) {
        const fecha = new Date(inicioSemana);
        fecha.setDate(inicioSemana.getDate() + i);
        fechas.push(fecha);
    }
    return fechas;
}

function formatearFecha(fecha) {
    return `${fecha.getDate().toString().padStart(2, '0')}/${(fecha.getMonth() + 1).toString().padStart(2, '0')}`;
}

async function cargarPedidosCalendario() {
    try {
        const res = await fetch('/pedidos_calendario');
        if (!res.ok) throw new Error('Error al obtener los pedidos del calendario.');
        const pedidos = await res.json();

        // Renderizar la vista actual (semanal o diaria)
        renderizarVistaCalendario(pedidos);
    } catch (err) {
        console.error('Error al cargar pedidos del calendario:', err);
    }
}

function cambiarVistaCalendario(vista) {
    vistaCalendarioActual = vista;
    const vistaSemanalDiv = document.getElementById('vistaSemanal');
    const vistaDiariaDiv = document.getElementById('vistaDiaria');
    const controlesNavegacion = document.getElementById('controlesNavegacion');
    const btnVistaSemanal = document.getElementById('btnVistaSemanal');
    const btnVistaDiaria = document.getElementById('btnVistaDiaria');

    if (vista === 'semanal') {
        vistaSemanalDiv.classList.remove('hidden');
        vistaDiariaDiv.classList.add('hidden');
        controlesNavegacion.classList.remove('hidden');
        btnVistaSemanal.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        btnVistaDiaria.className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
    } else {
        vistaSemanalDiv.classList.add('hidden');
        vistaDiariaDiv.classList.remove('hidden');
        controlesNavegacion.classList.add('hidden');
        btnVistaSemanal.className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
        btnVistaDiaria.className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
    }
    cargarPedidosCalendario();
}

function semanaAnterior() {
    semanaActualOffset--;
    cargarPedidosCalendario();
}

function semanaSiguiente() {
    semanaActualOffset++;
    cargarPedidosCalendario();
}


// --- NUEVA FUNCIÓN AÑADIDA ---
function renderizarVistaCalendario(pedidos) {
    const vistaSemanalDiv = document.getElementById('vistaSemanal');
    const vistaDiariaDiv = document.getElementById('vistaDiaria');
    const tituloCalendario = document.getElementById('tituloCalendario');

    const diasDeLaSemana = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    // Si la vista es semanal
    if (vistaCalendarioActual === 'semanal') {
        vistaSemanalDiv.innerHTML = '';
        const fechasSemana = obtenerFechasSemana(semanaActualOffset);

        // Actualizar el título del calendario
        const fechaInicio = formatearFecha(fechasSemana[0]);
        const fechaFin = formatearFecha(fechasSemana[6]);
        tituloCalendario.textContent = `${fechaInicio} - ${fechaFin}`;

        // Crear la estructura para cada día de la semana
        fechasSemana.forEach((fecha, index) => {
            const diaDiv = document.createElement('div');
            const fechaFormateada = fecha.toISOString().split('T')[0];
            const diaNombre = diasDeLaSemana[index];

            diaDiv.className = 'bg-white p-4 rounded-lg shadow-md flex flex-col min-h-[150px]';
            diaDiv.innerHTML = `
                <div class="flex justify-between items-center mb-2">
                    <h3 class="font-bold text-center w-full">${diaNombre} - ${formatearFecha(fecha)}</h3>
                </div>
            `;

            // Filtrar y mostrar los pedidos de ese día
            const pedidosDelDia = pedidos.filter(p => p.fecha_reparto === fechaFormateada);
            if (pedidosDelDia.length > 0) {
                pedidosDelDia.forEach(pedido => {
                    const pedidoCard = crearCardPedidoSemanal(pedido);
                    diaDiv.appendChild(pedidoCard);
                });
            } else {
                diaDiv.innerHTML += `<p class="text-sm text-gray-400 mt-2 text-center">No hay pedidos</p>`;
            }

            vistaSemanalDiv.appendChild(diaDiv);
        });
    } else { // Si la vista es diaria
        // Lógica de renderizado para la vista diaria (si se implementa)
        console.log('Vista diaria aún no implementada.');
    }
}

function crearCardPedidoSemanal(pedido) {
    const card = document.createElement('div');
    card.className = 'bg-gray-100 p-3 rounded-lg border border-gray-200 mb-2 hover:bg-gray-200 transition-colors duration-200';
    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <p class="text-sm font-semibold">${pedido.apodo}</p>
                <p class="text-xs text-gray-600">${pedido.pedido}</p>
                <p class="text-xs text-blue-600 font-medium">${pedido.localidad}</p>
            </div>
            <div class="flex gap-1">
                <button onclick="abrirModalEditarFecha('${pedido.id}')" class="text-gray-500 hover:text-blue-500 transition-colors duration-200">
                    <i class="fas fa-pencil-alt"></i>
                </button>
            </div>
        </div>
        ${pedido.observaciones ? `<p class="text-xs text-gray-500 mt-1">Obs: ${pedido.observaciones}</p>` : ''}
    `;
    return card;
}

function abrirModalEditarFecha(idPedido) {
    pedidoParaEditarId = idPedido;
    const modal = document.getElementById('editarFechaModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function cerrarModalEditarFecha() {
    const modal = document.getElementById('editarFechaModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function guardarNuevaFecha() {
    const nuevaFecha = document.getElementById('inputNuevaFecha').value;

    if (!nuevaFecha || !pedidoParaEditarId) {
        alert('Por favor, selecciona una nueva fecha y asegúrate de que el pedido esté seleccionado.');
        return;
    }

    try {
        const res = await fetch(`/pedidos/editar-fecha/${pedidoParaEditarId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fecha: nuevaFecha })
        });

        if (!res.ok) {
            throw new Error('Error al actualizar la fecha del pedido.');
        }

        const pedidoActualizado = await res.json();
        alert(`Fecha actualizada correctamente a ${pedidoActualizado.fecha_reparto}`);

        cerrarModalEditarFecha();
        await cargarPedidosCalendario(); // Recargar el calendario
    } catch (err) {
        console.error('Error al guardar la nueva fecha:', err);
        alert('Hubo un error al guardar la fecha. Revisa la consola para más detalles.');
    }
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
                    <span>${c.matricula}</span>
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

// Inicializar al cargar esta pestaña
document.addEventListener('DOMContentLoaded', () => {
    cambiarPestana('BaseDatos');
    cargarConductores();
    cargarCamiones();
    cargarZonas();

});
