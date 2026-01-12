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
    lunes: [], martes: [], miercoles: [], jueves: [], viernes: [], sabado: [], domingo: []
};
const diasSemana = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const dias = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado', 'Domingo'];

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
        document.getElementById("loading").classList.remove("hidden");
        document.getElementById("mensajeVacio").classList.add("hidden");

        const response = await fetch('/clientes');
        // Asegúrate de que la respuesta sea OK antes de seguir
        if (!response.ok) throw new Error("Error en la respuesta del servidor");
        
        const datos = await response.json(); 
        clientes = datos; // Actualizamos la variable global

        const tabla = document.getElementById("listaClientes");
        tabla.innerHTML = "";

        if (clientes.length === 0) {
            document.getElementById("mensajeVacio").classList.remove("hidden");
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
        document.getElementById("loading").classList.add("hidden");
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