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
async function cargarClientes() {
    try {
        const res = await fetch('/clientes');
        clientes = await res.json();
        const lista = document.getElementById('listaClientes');
        if (!lista) return;

        lista.innerHTML = '';
        clientes.forEach(cliente => {
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-4 py-2 border">${cliente.apodo}</td>
                <td class="px-4 py-2 border">${cliente.nombre_completo}</td>
                <td class="px-4 py-2 border">${cliente.telefono}</td>
                <td class="px-4 py-2 border">${cliente.localidad}</td>
                <td class="px-4 py-2 border">${cliente.zona_reparto}</td>
                <td class="px-4 py-2 border">${cliente.observaciones || ''}</td>
                <td class="px-4 py-2 border text-center">
                    <button onclick="abrirModal('editar', ${cliente.id})" class="text-blue-600 hover:text-blue-800 text-lg">✏️</button>
                    <button onclick="eliminarCliente(${cliente.id})" class="text-red-600 hover:text-red-800 ml-2 text-lg">🗑️</button>
                    <button onclick="mostrarHistorialPedidos(${cliente.id})" class="text-purple-600 hover:text-purple-800 ml-2 text-lg">📜</button>
                    <button onclick="mostrarNuevoPedido(${cliente.id})" class="text-green-600 hover:text-green-800 ml-2 text-lg">📝</button>
                </td>
            `;
            lista.appendChild(row);
        });
    } catch (err) {
        console.error('Error al cargar clientes:', err);
    }
}

function abrirModal(modo, id = null) {
    const modal = document.getElementById('clienteModal');
    const form = document.getElementById('clienteForm');
    const modalTitle = document.getElementById('modalTitle');
    
    if (modo === 'agregar') {
        modalTitle.textContent = 'Agregar Cliente';
        form.reset();
        editandoId = null;
    } else { // modo 'editar'
        modalTitle.textContent = 'Editar Cliente';
        const cliente = clientes.find(c => c.id === id);
        if (cliente) {
            document.getElementById('apodo').value = cliente.apodo;
            document.getElementById('nombre_completo').value = cliente.nombre_completo;
            document.getElementById('telefono').value = cliente.telefono;
            document.getElementById('localidad').value = cliente.localidad;
            document.getElementById('zona_reparto').value = cliente.zona_reparto;
            document.getElementById('observaciones').value = cliente.observaciones;
            editandoId = id;
        }
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function cerrarModal() {
    const modal = document.getElementById('clienteModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.getElementById('clienteForm').reset();
    editandoId = null;
}

async function guardarCliente(event) {
    event.preventDefault();
    const apodo = document.getElementById('apodo').value;
    const nombre_completo = document.getElementById('nombre_completo').value;
    const telefono = document.getElementById('telefono').value;
    const localidad = document.getElementById('localidad').value;
    const zona_reparto = document.getElementById('zona_reparto').value;
    const observaciones = document.getElementById('observaciones').value;
    const clienteData = { apodo, nombre_completo, telefono, localidad, zona_reparto, observaciones };
    try {
        let res;
        if (editandoId) {
            res = await fetch(`/clientes/${editandoId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clienteData)
            });
        } else {
            res = await fetch('/clientes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clienteData)
            });
        }
        if (res.ok) {
            cerrarModal();
            cargarClientes();
        } else {
            console.error('Error al guardar cliente');
        }
    } catch (err) {
        console.error('Error de red:', err);
    }
}

async function eliminarCliente(id) {
    if (confirm("¿Estás seguro de que quieres eliminar este cliente?")) {
        try {
            const res = await fetch(`/clientes/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarClientes();
            } else {
                console.error('Error al eliminar cliente');
            }
        } catch (err) {
            console.error('Error de red:', err);
        }
    }
}

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
