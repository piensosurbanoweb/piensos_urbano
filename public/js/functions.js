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
let clientes = [];
let zonas = [];
let conductores = ["Juan", "Pedro", "Manuel"];
let camiones = ["Camión 1", "Camión 2"];


// Funciones de pestañas
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
        
        // Ejecutar funciones específicas de la pestaña si existen
        switch (nombrePestana) {
            case 'BaseDatos':
                cargarClientes();
                break;
            case 'NuevoPedido':
                cargarZonasNuevoPedido();
                break;
            case 'PedidosPendientes':
                cargarPedidosPendientes();
                break;
            case 'Calendario':
                cargarPedidosCalendario();
                break;
            case 'GestionBBDD':
                cargarConductores();
                cargarCamiones();
                cargarZonas();
                break;
            case 'HojaReparto':
                cargarPedidosHoja();
                cargarZonasHoja();
                break;
        }
    } catch (err) {
        console.error(`Error al cargar la pestaña ${nombrePestana}:`, err);
    }
}

// --- Funciones de Base de Datos ---
// --- Funciones de Base de Datos (con backend propio) ---

async function cargarClientes() {
    try {
        const response = await fetch('/clientes');
        const clientes = await response.json();

        const tabla = document.querySelector("#clientesTable tbody");
        if (!tabla) return;
        tabla.innerHTML = "";

        clientes.forEach(cliente => {
            const fila = `
                <tr>
                    <td>${cliente.id}</td>
                    <td>${cliente.nombre}</td>
                    <td>${cliente.email}</td>
                    <td>${cliente.telefono}</td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="abrirModal(${JSON.stringify(cliente).replace(/"/g, '&quot;')})">Editar</button>
                        <button class="btn btn-danger btn-sm" onclick="eliminarCliente('${cliente.id}')">Eliminar</button>
                        <button class="btn btn-info btn-sm" onclick="verHistorial('${cliente.id}')">Historial</button>
                        <button class="btn btn-success btn-sm" onclick="nuevoPedido('${cliente.id}')">Nuevo Pedido</button>
                    </td>
                </tr>
            `;
            tabla.innerHTML += fila;
        });
    } catch (error) {
        console.error("Error cargando clientes:", error);
    }
}

async function guardarCliente(event) {
    event.preventDefault();

    const id = document.getElementById("clienteId").value;
    const cliente = {
        nombre: document.getElementById("nombre").value,
        email: document.getElementById("email").value,
        telefono: document.getElementById("telefono").value
    };

    try {
        if (id) {
            // Actualizar cliente
            await fetch(`/clientes/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cliente)
            });
        } else {
            // Crear cliente nuevo
            await fetch('/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cliente)
            });
        }

        const modal = bootstrap.Modal.getInstance(document.getElementById("clienteModal"));
        modal.hide();
        cargarClientes();
    } catch (error) {
        console.error("Error guardando cliente:", error);
    }
}

function abrirModal(cliente = null) {
    document.getElementById("clienteForm").reset();
    document.getElementById("clienteId").value = "";

    if (cliente) {
        document.getElementById("clienteId").value = cliente.id;
        document.getElementById("nombre").value = cliente.nombre;
        document.getElementById("email").value = cliente.email;
        document.getElementById("telefono").value = cliente.telefono;
    }

    const modal = new bootstrap.Modal(document.getElementById("clienteModal"));
    modal.show();
}

async function eliminarCliente(id) {
    if (!confirm("¿Seguro que deseas eliminar este cliente?")) return;

    try {
        await fetch(`/clientes/${id}`, { method: 'DELETE' });
        cargarClientes();
    } catch (error) {
        console.error("Error eliminando cliente:", error);
    }
}

function verHistorial(idCliente) {
    alert("Función para ver historial del cliente " + idCliente);
}

function nuevoPedido(idCliente) {
    alert("Función para crear un nuevo pedido para el cliente " + idCliente);
}

// --- Inicialización ---
document.addEventListener("DOMContentLoaded", () => {
    cargarClientes();
    document.getElementById("clienteForm").addEventListener("submit", guardarCliente);
});



// --- Funciones de Pedidos Pendientes ---
async function cargarPedidosPendientes() {
    try {
        const res = await fetch('/pedidos_pendientes');
        pedidosPendientes = await res.json();
        const lista = document.getElementById('listaPedidosPendientes');
        const mensajeVacio = document.getElementById('mensajeVacioPendientes');
        const totalPendientes = document.getElementById('totalPendientes');
        if (!lista || !mensajeVacio || !totalPendientes) return;

        lista.innerHTML = '';
        if (pedidosPendientes.length === 0) {
            mensajeVacio.classList.remove('hidden');
        } else {
            mensajeVacio.classList.add('hidden');
            pedidosPendientes.forEach(pedido => {
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
                        <button onclick="moverApendientes(${pedido.historial_id})" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors duration-200">
                            📅 Programar en Calendario
                        </button>
                    </div>
                `;
                lista.appendChild(item);
            });
        }
        totalPendientes.textContent = pedidosPendientes.length;
    } catch (err) {
        console.error('Error al cargar pedidos pendientes:', err);
    }
}

// --- Funciones de Calendario ---
async function cargarPedidosCalendario() {
    try {
        const res = await fetch('/pedidos_calendario');
        const pedidos = await res.json();
        pedidosCalendario = {
            lunes: [], martes: [], miercoles: [], jueves: [], viernes: []
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

function renderizarVistaCalendario() {
    if (vistaCalendarioActual === 'semanal') {
        const contenedor = document.getElementById('vistaSemanal');
        if (!contenedor) return;
        contenedor.classList.remove('hidden');
        contenedor.innerHTML = '';
        Object.entries(pedidosCalendario).forEach(([dia, pedidos]) => {
            const col = document.createElement('div');
            col.className = 'bg-white p-4 rounded-lg shadow-sm';
            col.innerHTML = `
                <h4 class="font-bold mb-2 text-center text-gray-800">${dia.charAt(0).toUpperCase() + dia.slice(1)}</h4>
                <div class="space-y-2">
                    ${pedidos.map(p => `
                        <div class="border border-gray-200 rounded-lg p-3">
                            <p class="text-sm font-medium">${p.pedido}</p>
                            <p class="text-xs text-gray-600">Para: ${p.apodo}</p>
                        </div>
                    `).join('')}
                </div>
            `;
            contenedor.appendChild(col);
        });
    }
    // Lógica para vista diaria se implementará más adelante
}

// --- Funciones de Gestión BBDD ---
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

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', function(e) {
        const modal = document.getElementById('clienteModal');
        if (modal && e.target === modal) {
            cerrarModal();
        }
    });

    const clienteForm = document.getElementById('clienteForm');
    if (clienteForm) {
        clienteForm.addEventListener('submit', guardarCliente);
    }
    
    // Iniciar con la primera pestaña
    cambiarPestana('BaseDatos');
});
