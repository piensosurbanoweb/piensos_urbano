// Variable para mantener el contenido de la pestaña actual
let currentScript = null;

async function cambiarPestana(nombrePestana) {
    const pestañas = ['BaseDatos', 'NuevoPedido', 'Pendientes', 'Calendario', 'GestionBBDD', 'HojaReparto'];
    const baseClass = 'flex-1 px-5 py-4 text-center font-medium text-sm';
    const inactiveClass = baseClass + ' bg-gray-200 text-gray-700 hover:bg-gray-300';
    const activeClass = baseClass + ' bg-blue-600 text-white';

    // Desactivar todas las pestañas
    pestañas.forEach(p => {
        const tab = document.getElementById(`tab${p}`);
        if (tab) tab.className = inactiveClass;
    });

    // Activar la pestaña seleccionada
    const tabSeleccionada = document.getElementById(`tab${nombrePestana}`);
    if (tabSeleccionada) tabSeleccionada.className = activeClass;

    const contenedor = document.getElementById('contenidoPestanas');
    contenedor.innerHTML = ''; // Limpiar contenido anterior

    try {
        const res = await fetch(`${nombrePestana}.html`);
        if (!res.ok) {
            throw new Error(`No se pudo cargar la página ${nombrePestana}.html`);
        }
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const contenido = doc.body.querySelector('div');
        const script = doc.querySelector('script');

        if (contenido) {
            contenedor.appendChild(contenido);
        }
        
        if (script) {
            // Eliminar el script anterior si existe para evitar duplicaciones
            if (currentScript) {
                currentScript.remove();
            }
            // Crear y adjuntar un nuevo elemento <script> para que el navegador lo ejecute
            const nuevoScript = document.createElement('script');
            nuevoScript.textContent = script.textContent;
            document.body.appendChild(nuevoScript);
            currentScript = nuevoScript;
        }

    } catch (error) {
        console.error('Error al cambiar de pestaña:', error);
        contenedor.innerHTML = `<p class="text-red-500">Error al cargar el contenido.</p>`;
    }
}

// Cargar la pestaña de Base de Datos al iniciar
document.addEventListener('DOMContentLoaded', () => {
    cambiarPestana('BaseDatos');
});