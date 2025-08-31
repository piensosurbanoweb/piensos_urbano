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
                cargarZonas();
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

// Funciones de Base de Datos
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
