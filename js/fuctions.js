  // Variables de control
        let editandoId = null;
        let clienteSeleccionado = null;
        let semanaActualOffset = 0; // Para navegar entre semanas
        let vistaCalendarioActual = 'semanal'; // 'semanal' o 'diaria'
        let diaSeleccionadoDiario = 'lunes';

        // Funciones de pestañas
        function cambiarPestana(pestana) {
            // Ocultar todas las pestañas
            document.getElementById('pestanaBaseDatos').classList.add('hidden');
            document.getElementById('pestanaNuevoPedido').classList.add('hidden');
            document.getElementById('pestanaPedidosPendientes').classList.add('hidden');
            document.getElementById('pestanaCalendario').classList.add('hidden');
            document.getElementById('pestanaGestionBD').classList.add('hidden');
            document.getElementById('pestanaHojaReparto').classList.add('hidden');
            
            // Resetear estilos de botones
            const baseClass = 'flex-1 px-5 py-4 text-center font-medium text-sm';
            const inactiveClass = baseClass + ' bg-gray-200 text-gray-700 hover:bg-gray-300';
            const activeClass = baseClass + ' bg-blue-600 text-white';
            
            document.getElementById('tabBaseDatos').className = inactiveClass;
            document.getElementById('tabNuevoPedido').className = inactiveClass;
            document.getElementById('tabPedidosPendientes').className = inactiveClass;
            document.getElementById('tabCalendario').className = inactiveClass;
            document.getElementById('tabGestionBD').className = inactiveClass;
            document.getElementById('tabHojaReparto').className = inactiveClass;
            
            if (pestana === 'baseDatos') {
                document.getElementById('pestanaBaseDatos').classList.remove('hidden');
                document.getElementById('tabBaseDatos').className = activeClass;
            } else if (pestana === 'nuevoPedido') {
                document.getElementById('pestanaNuevoPedido').classList.remove('hidden');
                document.getElementById('tabNuevoPedido').className = activeClass;
                // Establecer fecha actual por defecto
                const hoy = new Date().toISOString().split('T')[0];
                document.getElementById('fechaPedidoNuevo').value = hoy;
            } else if (pestana === 'pedidosPendientes') {
                document.getElementById('pestanaPedidosPendientes').classList.remove('hidden');
                document.getElementById('tabPedidosPendientes').className = activeClass;
                actualizarListaPendientes();
            } else if (pestana === 'calendario') {
                document.getElementById('pestanaCalendario').classList.remove('hidden');
                document.getElementById('tabCalendario').className = activeClass;
                actualizarCalendario();
            } else if (pestana === 'gestionBD') {
                document.getElementById('pestanaGestionBD').classList.remove('hidden');
                document.getElementById('tabGestionBD').className = activeClass;
                actualizarEstadisticas();
                actualizarListaConductores();
                actualizarListaCamiones();
                actualizarListaZonas();
                actualizarSelectoresZonas();
                actualizarSelectoresConductores();
                actualizarSelectoresCamiones();
            } else if (pestana === 'hojaReparto') {
                document.getElementById('pestanaHojaReparto').classList.remove('hidden');
                document.getElementById('tabHojaReparto').className = activeClass;
                actualizarFechasReparto();
                actualizarTablaReparto();
            }
        }

        // Funciones para Pedidos Pendientes
        function actualizarListaPendientes() {
            const lista = document.getElementById('listaPedidosPendientes');
            const mensajeVacio = document.getElementById('mensajeVacioPendientes');
            const totalPendientes = document.getElementById('totalPendientes');
            const contadorPendientes = document.getElementById('contadorPendientes');
            
            if (pedidosPendientes.length === 0) {
                lista.innerHTML = '';
                mensajeVacio.classList.remove('hidden');
            } else {
                mensajeVacio.classList.add('hidden');
                
                lista.innerHTML = pedidosPendientes.map(pedido => `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="font-semibold text-lg text-gray-800">${pedido.apodo}</span>
                                    <span class="text-sm text-gray-600">${pedido.nombreCompleto}</span>
                                </div>
                                <div class="text-blue-600 font-medium mb-2">${pedido.pedido}</div>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                    <div><strong>Teléfono:</strong> ${pedido.telefono}</div>
                                    <div><strong>Localidad:</strong> ${pedido.localidad}</div>
                                    <div><strong>Zona:</strong> <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getZonaColor(pedido.zona)}">${pedido.zona}</span></div>
                                    <div><strong>Fecha Entrega:</strong> ${formatearFecha(pedido.fechaEntrega)}</div>
                                </div>
                                ${pedido.observaciones ? `<div class="mt-2 text-sm text-orange-600"><strong>Observaciones:</strong> ${pedido.observaciones}</div>` : ''}
                            </div>
                            <div class="ml-4 flex flex-col gap-2">
                                <div class="text-sm font-medium text-gray-700 mb-1">Programar para:</div>
                                <input type="date" onchange="programarPedidoConFecha('${pedido.id}', this.value)" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 mb-2" min="${new Date().toISOString().split('T')[0]}">
                                <select onchange="programarPedido('${pedido.id}', this.value)" class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                                    <option value="">O seleccionar día...</option>
                                    <option value="lunes">Lunes</option>
                                    <option value="martes">Martes</option>
                                    <option value="miercoles">Miércoles</option>
                                    <option value="jueves">Jueves</option>
                                    <option value="viernes">Viernes</option>
                                </select>
                                <button onclick="eliminarPedidoPendiente('${pedido.id}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium transition-colors duration-200">
                                    🗑️ Eliminar
                                </button>
                            </div>
                        </div>
                    </div>
                `).join('');
            }
            
            totalPendientes.textContent = pedidosPendientes.length;
            contadorPendientes.textContent = pedidosPendientes.length;
        }

        function programarPedido(pedidoId, dia) {
            if (!dia) return;
            
            const pedido = pedidosPendientes.find(p => p.id === pedidoId);
            if (!pedido) return;
            
            // Agregar al calendario
            const pedidoCalendario = {
                ...pedido,
                diaReparto: dia,
                orden: pedidosCalendario[dia].length + 1,
                conductor: "Sin asignar"
            };
            
            pedidosCalendario[dia].push(pedidoCalendario);
            
            // Remover de pendientes
            pedidosPendientes = pedidosPendientes.filter(p => p.id !== pedidoId);
            
            // Actualizar vistas
            actualizarListaPendientes();
            actualizarCalendario();
            
            alert(`Pedido programado para ${dia.charAt(0).toUpperCase() + dia.slice(1)}`);
        }

        function eliminarPedidoPendiente(pedidoId) {
            if (confirm('¿Estás seguro de que quieres eliminar este pedido pendiente?')) {
                pedidosPendientes = pedidosPendientes.filter(p => p.id !== pedidoId);
                actualizarListaPendientes();
            }
        }

        function ordenarPedidosPendientes() {
            const criterio = document.getElementById('ordenarPendientes').value;
            
            pedidosPendientes.sort((a, b) => {
                switch(criterio) {
                    case 'zona':
                        return a.zona.localeCompare(b.zona);
                    case 'fechaPedido':
                        return new Date(a.fechaPedido) - new Date(b.fechaPedido);
                    case 'fechaEntrega':
                        return new Date(a.fechaEntrega) - new Date(b.fechaEntrega);
                    case 'apodo':
                        return a.apodo.localeCompare(b.apodo);
                    default:
                        return 0;
                }
            });
            
            actualizarListaPendientes();
        }

        function programarPedidoConFecha(pedidoId, fecha) {
            if (!fecha) return;
            
            const fechaObj = new Date(fecha);
            const diaSemana = fechaObj.getDay(); // 0=domingo, 1=lunes, etc.
            
            // Convertir a nuestros días laborables (lunes=1, viernes=5)
            const diasLaborables = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const diaLaboral = diasLaborables[diaSemana];
            
            if (diaSemana === 0 || diaSemana === 6) {
                alert('Solo se pueden programar pedidos de lunes a viernes');
                return;
            }
            
            programarPedido(pedidoId, diaLaboral);
        }

        // Funciones para el Calendario Semanal
        function obtenerFechasSemana(offset = 0) {
            const hoy = new Date();
            const lunes = new Date(hoy);
            lunes.setDate(hoy.getDate() - hoy.getDay() + 1 + (offset * 7));
            
            const fechas = [];
            for (let i = 0; i < 5; i++) {
                const fecha = new Date(lunes);
                fecha.setDate(lunes.getDate() + i);
                fechas.push(fecha);
            }
            
            return fechas;
        }

        function actualizarCalendario() {
            const fechas = obtenerFechasSemana(semanaActualOffset);
            const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
            
            // Actualizar título de la semana
            const primerDia = fechas[0];
            const ultimoDia = fechas[4];
            document.getElementById('tituloSemana').textContent = 
                `Semana del ${primerDia.getDate()} al ${ultimoDia.getDate()} de ${meses[primerDia.getMonth()]} ${primerDia.getFullYear()}`;
            
            // Actualizar cada día
            dias.forEach((dia, index) => {
                const fecha = fechas[index];
                document.getElementById(`fecha${dia.charAt(0).toUpperCase() + dia.slice(1)}`).textContent = 
                    `${fecha.getDate()} ${meses[fecha.getMonth()]}`;
                
                // Actualizar pedidos del día
                actualizarPedidosDia(dia);
            });
        }

        function actualizarPedidosDia(dia) {
            const contenedor = document.getElementById(`pedidos${dia.charAt(0).toUpperCase() + dia.slice(1)}`);
            const pedidos = pedidosCalendario[dia];
            
            if (pedidos.length === 0) {
                contenedor.innerHTML = '<div class="text-center text-gray-400 text-sm py-8">Sin pedidos programados</div>';
            } else {
                // Ordenar por orden de reparto
                pedidos.sort((a, b) => a.orden - b.orden);
                
                contenedor.innerHTML = pedidos.map(pedido => `
                    <div class="bg-white border border-gray-200 rounded-lg p-3 mb-2 shadow-sm hover:shadow-md transition-shadow duration-200 ${pedido.enviadoAReparto ? 'bg-green-50 border-green-200' : ''}">
                        <div class="flex justify-between items-start mb-2">
                            <div class="font-semibold text-gray-800">${pedido.apodo}</div>
                            <div class="text-xs text-gray-500">
                                ${pedido.enviadoAReparto ? 
                                    `<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">📦 En Reparto</span>` : 
                                    `Orden: <select onchange="cambiarOrdenCalendario('${pedido.id}', '${dia}', parseInt(this.value))" class="ml-1 border-0 bg-transparent text-xs">
                                        ${Array.from({length: pedidos.length}, (_, i) => i + 1).map(num => 
                                            `<option value="${num}" ${num === pedido.orden ? 'selected' : ''}>${num}</option>`
                                        ).join('')}
                                    </select>`
                                }
                            </div>
                        </div>
                        <div class="text-sm text-blue-600 font-medium mb-1 ${pedido.enviadoAReparto ? 'cursor-default' : 'cursor-pointer hover:text-blue-800'}" ${pedido.enviadoAReparto ? '' : `onclick="editarPedidoCalendario('${pedido.id}', '${dia}')" title="Clic para editar pedido"`}>
                            ${pedido.enviadoAReparto ? '📦' : '✏️'} ${pedido.pedido}
                        </div>
                        <div class="text-xs text-gray-600 mb-2">
                            <div>${pedido.telefono} • ${pedido.localidad}</div>
                            <div>Entrega: <span class="${pedido.enviadoAReparto ? '' : 'cursor-pointer hover:text-blue-600'}" ${pedido.enviadoAReparto ? '' : `onclick="editarFechaEntregaCalendario('${pedido.id}', '${dia}')" title="Clic para cambiar fecha"`}>📅 ${formatearFecha(pedido.fechaEntrega)}</span></div>
                            ${pedido.zona ? `<div>Zona: <span class="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium ${getZonaColor(pedido.zona)}">${pedido.zona}</span></div>` : ''}
                            ${pedido.enviadoAReparto ? `<div class="text-green-600 font-medium">✅ Enviado a reparto: ${formatearFecha(pedido.fechaEnvioReparto)}</div>` : ''}
                        </div>
                        ${!pedido.enviadoAReparto ? `
                        <div class="mb-2">
                            <select onchange="cambiarConductorCalendario('${pedido.id}', '${dia}', this.value)" class="text-xs border border-gray-300 rounded px-2 py-1 w-full mb-1">
                                ${conductores.map(conductor => 
                                    `<option value="${conductor}" ${conductor === pedido.conductor ? 'selected' : ''}>${conductor}</option>`
                                ).join('')}
                            </select>
                            <select onchange="cambiarCamionCalendario('${pedido.id}', '${dia}', this.value)" class="text-xs border border-gray-300 rounded px-2 py-1 w-full">
                                ${camiones.map(camion => 
                                    `<option value="${camion}" ${camion === (pedido.camion || 'Sin asignar') ? 'selected' : ''}>${camion}</option>`
                                ).join('')}
                            </select>
                        </div>
                        ` : `
                        <div class="mb-2 text-xs text-gray-500">
                            <div>Conductor: ${pedido.conductor}</div>
                            <div>Camión: ${pedido.camion || 'Sin asignar'}</div>
                        </div>
                        `}
                        ${pedido.observaciones ? `<div class="text-xs text-orange-600 mb-2 ${pedido.enviadoAReparto ? '' : 'cursor-pointer hover:text-orange-800'}" ${pedido.enviadoAReparto ? '' : `onclick="editarObservacionesCalendario('${pedido.id}', '${dia}')" title="Clic para editar observaciones"`}>📝 ${pedido.observaciones}</div>` : `${!pedido.enviadoAReparto ? `<div class="text-xs text-gray-400 mb-2 cursor-pointer hover:text-gray-600" onclick="editarObservacionesCalendario('${pedido.id}', '${dia}')" title="Clic para añadir observaciones">📝 Añadir observaciones</div>` : ''}`}
                        <div class="flex gap-1">
                            ${!pedido.enviadoAReparto ? `
                            <button onclick="editarPedidoCompleto('${pedido.id}', '${dia}')" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs flex-1" title="Editar pedido completo">
                                ✏️ Editar
                            </button>
                            <button onclick="moverAHojaReparto('${pedido.id}', '${dia}')" class="bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded text-xs" title="Enviar a hoja de reparto">
                                📦
                            </button>
                            <button onclick="eliminarDelCalendario('${pedido.id}', '${dia}')" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" title="Eliminar">
                                🗑️
                            </button>
                            ` : `
                            <button onclick="restaurarDelReparto('${pedido.id}', '${dia}')" class="bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded text-xs flex-1" title="Restaurar para edición">
                                🔄 Restaurar
                            </button>
                            <button onclick="eliminarDelCalendario('${pedido.id}', '${dia}')" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs" title="Eliminar del historial">
                                🗑️
                            </button>
                            `}
                        </div>
                    </div>
                `).join('');
            }
        }

        function cambiarOrdenCalendario(pedidoId, dia, nuevaOrden) {
            const pedidos = pedidosCalendario[dia];
            const pedido = pedidos.find(p => p.id === pedidoId);
            
            if (pedido && nuevaOrden >= 1 && nuevaOrden <= pedidos.length) {
                // Reordenar
                pedidos.sort((a, b) => {
                    if (a.id === pedidoId) return nuevaOrden - 1;
                    if (b.id === pedidoId) return -(nuevaOrden - 1);
                    return a.orden - b.orden;
                });
                
                // Actualizar números de orden
                pedidos.forEach((p, index) => {
                    p.orden = index + 1;
                });
                
                actualizarPedidosDia(dia);
            }
        }

        function cambiarConductorCalendario(pedidoId, dia, conductor) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (pedido) {
                pedido.conductor = conductor;
            }
        }

        function cambiarCamionCalendario(pedidoId, dia, camion) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (pedido) {
                pedido.camion = camion;
            }
        }

        // Variables para edición de pedidos
        let pedidoEditandoId = null;
        let diaEditandoPedido = null;

        function editarPedidoCalendario(pedidoId, dia) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (!pedido) return;
            
            const nuevaDescripcion = prompt('Editar descripción del pedido:', pedido.pedido);
            if (nuevaDescripcion !== null && nuevaDescripcion.trim() !== '') {
                pedido.pedido = nuevaDescripcion.trim();
                actualizarPedidosDia(dia);
                if (vistaCalendarioActual === 'diaria') {
                    actualizarVistaDiaria();
                }
            }
        }

        function editarFechaEntregaCalendario(pedidoId, dia) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (!pedido) return;
            
            const fechaActual = pedido.fechaEntrega;
            const nuevaFecha = prompt('Cambiar fecha de entrega (YYYY-MM-DD):', fechaActual);
            
            if (nuevaFecha !== null && nuevaFecha.trim() !== '') {
                // Validar formato de fecha
                const fechaRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (fechaRegex.test(nuevaFecha)) {
                    pedido.fechaEntrega = nuevaFecha;
                    actualizarPedidosDia(dia);
                    if (vistaCalendarioActual === 'diaria') {
                        actualizarVistaDiaria();
                    }
                } else {
                    alert('Formato de fecha inválido. Use YYYY-MM-DD');
                }
            }
        }

        function editarObservacionesCalendario(pedidoId, dia) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (!pedido) return;
            
            const observacionesActuales = pedido.observaciones || '';
            const nuevasObservaciones = prompt('Editar observaciones:', observacionesActuales);
            
            if (nuevasObservaciones !== null) {
                pedido.observaciones = nuevasObservaciones.trim();
                actualizarPedidosDia(dia);
                if (vistaCalendarioActual === 'diaria') {
                    actualizarVistaDiaria();
                }
            }
        }

        function editarPedidoCompleto(pedidoId, dia) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (!pedido) return;
            
            pedidoEditandoId = pedidoId;
            diaEditandoPedido = dia;
            
            // Actualizar selectores antes de llenar el modal
            actualizarSelectoresZonas();
            actualizarSelectoresConductores();
            actualizarSelectoresCamiones();
            
            // Llenar el modal con los datos actuales
            document.getElementById('editApodo').value = pedido.apodo || '';
            document.getElementById('editNombreCompleto').value = pedido.nombreCompleto || '';
            document.getElementById('editTelefono').value = pedido.telefono || '';
            document.getElementById('editLocalidad').value = pedido.localidad || '';
            document.getElementById('editZonaReparto').value = pedido.zona || '';
            document.getElementById('editPedidoDescripcion').value = pedido.pedido || '';
            document.getElementById('editFechaPedido').value = pedido.fechaPedido || '';
            document.getElementById('editFechaEntrega').value = pedido.fechaEntrega || '';
            document.getElementById('editConductor').value = pedido.conductor || 'Sin asignar';
            document.getElementById('editCamion').value = pedido.camion || 'Sin asignar';
            document.getElementById('editObservaciones').value = pedido.observaciones || '';
            
            // Mostrar modal
            document.getElementById('editarPedidoModal').classList.remove('hidden');
            document.getElementById('editarPedidoModal').classList.add('flex');
        }

        function cerrarModalPedido() {
            document.getElementById('editarPedidoModal').classList.add('hidden');
            document.getElementById('editarPedidoModal').classList.remove('flex');
            pedidoEditandoId = null;
            diaEditandoPedido = null;
        }

        function moverAHojaReparto(pedidoId, dia) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (!pedido) return;
            
            // Agregar a hoja de reparto
            const pedidoReparto = {
                ...pedido,
                id: Date.now(), // Nuevo ID para evitar conflictos
                orden: pedidosReparto.length + 1,
                camion: "Sin asignar"
            };
            
            pedidosReparto.push(pedidoReparto);
            
            // Marcar como enviado a reparto (mantener en calendario como historial)
            pedido.enviadoAReparto = true;
            pedido.fechaEnvioReparto = new Date().toISOString().split('T')[0];
            
            actualizarPedidosDia(dia);
            if (vistaCalendarioActual === 'diaria') {
                actualizarVistaDiaria();
            }
            alert('Pedido enviado a la hoja de reparto (mantenido en calendario como historial)');
        }

        function eliminarDelCalendario(pedidoId, dia) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (!pedido) return;
            
            if (pedido.enviadoAReparto) {
                if (confirm('¿Estás seguro de que quieres eliminar este pedido del historial del calendario? Esta acción no afectará la hoja de reparto.')) {
                    pedidosCalendario[dia] = pedidosCalendario[dia].filter(p => p.id !== pedidoId);
                    actualizarPedidosDia(dia);
                    if (vistaCalendarioActual === 'diaria') {
                        actualizarVistaDiaria();
                    }
                }
            } else {
                if (confirm('¿Quieres eliminar este pedido del calendario o moverlo de vuelta a pendientes?')) {
                    const opciones = ['Eliminar completamente', 'Mover a pendientes', 'Cancelar'];
                    const opcion = prompt(`Selecciona una opción:\n1. ${opciones[0]}\n2. ${opciones[1]}\n3. ${opciones[2]}\n\nEscribe el número:`);
                    
                    if (opcion === '1') {
                        pedidosCalendario[dia] = pedidosCalendario[dia].filter(p => p.id !== pedidoId);
                        // Reordenar
                        pedidosCalendario[dia].forEach((p, index) => {
                            p.orden = index + 1;
                        });
                        actualizarPedidosDia(dia);
                        if (vistaCalendarioActual === 'diaria') {
                            actualizarVistaDiaria();
                        }
                    } else if (opcion === '2') {
                        // Mover a pendientes
                        const pedidoPendiente = { ...pedido };
                        delete pedidoPendiente.diaReparto;
                        delete pedidoPendiente.orden;
                        delete pedidoPendiente.conductor;
                        delete pedidoPendiente.enviadoAReparto;
                        delete pedidoPendiente.fechaEnvioReparto;
                        
                        pedidosPendientes.push(pedidoPendiente);
                        
                        // Remover del calendario
                        pedidosCalendario[dia] = pedidosCalendario[dia].filter(p => p.id !== pedidoId);
                        
                        // Reordenar
                        pedidosCalendario[dia].forEach((p, index) => {
                            p.orden = index + 1;
                        });
                        
                        actualizarPedidosDia(dia);
                        actualizarListaPendientes();
                        if (vistaCalendarioActual === 'diaria') {
                            actualizarVistaDiaria();
                        }
                    }
                }
            }
        }

        function restaurarDelReparto(pedidoId, dia) {
            const pedido = pedidosCalendario[dia].find(p => p.id === pedidoId);
            if (!pedido) return;
            
            if (confirm('¿Restaurar este pedido para poder editarlo? Esto lo quitará de la hoja de reparto actual.')) {
                // Eliminar de la hoja de reparto si existe
                pedidosReparto = pedidosReparto.filter(p => p.apodo !== pedido.apodo || p.pedido !== pedido.pedido || p.fechaEntrega !== pedido.fechaEntrega);
                
                // Reordenar hoja de reparto
                pedidosReparto.forEach((p, index) => {
                    p.orden = index + 1;
                });
                
                // Restaurar en calendario
                delete pedido.enviadoAReparto;
                delete pedido.fechaEnvioReparto;
                
                actualizarPedidosDia(dia);
                actualizarTablaReparto();
                if (vistaCalendarioActual === 'diaria') {
                    actualizarVistaDiaria();
                }
                
                alert('Pedido restaurado para edición y eliminado de la hoja de reparto');
            }
        }

        function semanaAnterior() {
            semanaActualOffset--;
            actualizarCalendario();
        }

        function semanaSiguiente() {
            semanaActualOffset++;
            actualizarCalendario();
        }

        function semanaActual() {
            semanaActualOffset = 0;
            actualizarCalendario();
        }

        function cambiarVistaCalendario(vista) {
            vistaCalendarioActual = vista;
            
            if (vista === 'semanal') {
                document.getElementById('vistaSemanal').classList.remove('hidden');
                document.getElementById('vistaDiaria').classList.add('hidden');
                document.getElementById('btnVistaSemanal').className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
                document.getElementById('btnVistaDiaria').className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
            } else {
                document.getElementById('vistaSemanal').classList.add('hidden');
                document.getElementById('vistaDiaria').classList.remove('hidden');
                document.getElementById('btnVistaSemanal').className = 'bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
                document.getElementById('btnVistaDiaria').className = 'bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200';
                actualizarVistaDiaria();
            }
        }

        function cambiarDiaDiario() {
            diaSeleccionadoDiario = document.getElementById('selectorDiaDiario').value;
            actualizarVistaDiaria();
        }

        function actualizarVistaDiaria() {
            const fechas = obtenerFechasSemana(semanaActualOffset);
            const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            
            const indiceDia = dias.indexOf(diaSeleccionadoDiario);
            const fecha = fechas[indiceDia];
            
            document.getElementById('tituloDiario').textContent = 
                `${diasSemana[fecha.getDay()]}, ${fecha.getDate()} de ${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
            
            const pedidos = pedidosCalendario[diaSeleccionadoDiario];
            const contenedor = document.getElementById('pedidosDiarios');
            const mensajeVacio = document.getElementById('mensajeVacioDiario');
            
            if (pedidos.length === 0) {
                contenedor.innerHTML = '';
                mensajeVacio.classList.remove('hidden');
            } else {
                mensajeVacio.classList.add('hidden');
                
                // Ordenar por orden de reparto
                pedidos.sort((a, b) => a.orden - b.orden);
                
                contenedor.innerHTML = pedidos.map(pedido => `
                    <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 ${pedido.enviadoAReparto ? 'bg-green-50 border-green-200' : ''}">
                        <div class="flex justify-between items-start mb-3">
                            <div class="flex-1">
                                <div class="flex items-center gap-3 mb-2">
                                    <span class="font-semibold text-lg text-gray-800">${pedido.apodo}</span>
                                    <span class="text-sm text-gray-600">${pedido.nombreCompleto}</span>
                                    <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getZonaColor(pedido.zona)}">${pedido.zona}</span>
                                    ${pedido.enviadoAReparto ? `<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">📦 En Reparto</span>` : ''}
                                </div>
                                <div class="text-blue-600 font-medium mb-2 ${pedido.enviadoAReparto ? 'cursor-default' : 'cursor-pointer hover:text-blue-800'}" ${pedido.enviadoAReparto ? '' : `onclick="editarPedidoCalendario('${pedido.id}', '${diaSeleccionadoDiario}')" title="Clic para editar pedido"`}>
                                    ${pedido.enviadoAReparto ? '📦' : '✏️'} ${pedido.pedido}
                                </div>
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-600">
                                    <div><strong>Teléfono:</strong> ${pedido.telefono}</div>
                                    <div><strong>Localidad:</strong> ${pedido.localidad}</div>
                                    <div><strong>Fecha Entrega:</strong> <span class="${pedido.enviadoAReparto ? '' : 'cursor-pointer hover:text-blue-600'}" ${pedido.enviadoAReparto ? '' : `onclick="editarFechaEntregaCalendario('${pedido.id}', '${diaSeleccionadoDiario}')" title="Clic para cambiar fecha"`}>📅 ${formatearFecha(pedido.fechaEntrega)}</span></div>
                                </div>
                                ${pedido.enviadoAReparto ? `<div class="mt-2 text-sm text-green-600 font-medium">✅ Enviado a reparto: ${formatearFecha(pedido.fechaEnvioReparto)}</div>` : ''}
                                ${pedido.observaciones ? `<div class="mt-2 text-sm text-orange-600 ${pedido.enviadoAReparto ? '' : 'cursor-pointer hover:text-orange-800'}" ${pedido.enviadoAReparto ? '' : `onclick="editarObservacionesCalendario('${pedido.id}', '${diaSeleccionadoDiario}')" title="Clic para editar observaciones"`}><strong>Observaciones:</strong> 📝 ${pedido.observaciones}</div>` : ''}
                            </div>
                            <div class="ml-4 flex flex-col gap-2 min-w-[200px]">
                                ${!pedido.enviadoAReparto ? `
                                <div class="grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="text-xs text-gray-600">Orden:</label>
                                        <select onchange="cambiarOrdenCalendario('${pedido.id}', '${diaSeleccionadoDiario}', parseInt(this.value))" class="w-full text-sm border border-gray-300 rounded px-2 py-1">
                                            ${Array.from({length: pedidos.length}, (_, i) => i + 1).map(num => 
                                                `<option value="${num}" ${num === pedido.orden ? 'selected' : ''}>${num}</option>`
                                            ).join('')}
                                        </select>
                                    </div>
                                    <div>
                                        <label class="text-xs text-gray-600">Conductor:</label>
                                        <select onchange="cambiarConductorCalendario('${pedido.id}', '${diaSeleccionadoDiario}', this.value)" class="w-full text-sm border border-gray-300 rounded px-2 py-1">
                                            ${conductores.map(conductor => 
                                                `<option value="${conductor}" ${conductor === pedido.conductor ? 'selected' : ''}>${conductor}</option>`
                                            ).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label class="text-xs text-gray-600">Camión:</label>
                                    <select onchange="cambiarCamionCalendario('${pedido.id}', '${diaSeleccionadoDiario}', this.value)" class="w-full text-sm border border-gray-300 rounded px-2 py-1">
                                        ${camiones.map(camion => 
                                            `<option value="${camion}" ${camion === (pedido.camion || 'Sin asignar') ? 'selected' : ''}>${camion}</option>`
                                        ).join('')}
                                    </select>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="editarPedidoCompleto('${pedido.id}', '${diaSeleccionadoDiario}')" class="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors duration-200">
                                        ✏️ Editar Todo
                                    </button>
                                    <button onclick="moverAHojaReparto('${pedido.id}', '${diaSeleccionadoDiario}')" class="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors duration-200">
                                        📦 A Reparto
                                    </button>
                                    <button onclick="eliminarDelCalendario('${pedido.id}', '${diaSeleccionadoDiario}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors duration-200">
                                        🗑️
                                    </button>
                                </div>
                                ` : `
                                <div class="text-sm text-gray-600 space-y-1">
                                    <div><strong>Orden:</strong> ${pedido.orden}</div>
                                    <div><strong>Conductor:</strong> ${pedido.conductor}</div>
                                    <div><strong>Camión:</strong> ${pedido.camion || 'Sin asignar'}</div>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="restaurarDelReparto('${pedido.id}', '${diaSeleccionadoDiario}')" class="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors duration-200">
                                        🔄 Restaurar
                                    </button>
                                    <button onclick="eliminarDelCalendario('${pedido.id}', '${diaSeleccionadoDiario}')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors duration-200">
                                        🗑️
                                    </button>
                                </div>
                                `}
                            </div>
                        </div>
                    </div>
                `).join('');
            }
        }

        function enviarDiaAHojaReparto() {
            const pedidos = pedidosCalendario[diaSeleccionadoDiario];
            const pedidosNoEnviados = pedidos.filter(p => !p.enviadoAReparto);
            
            if (pedidosNoEnviados.length === 0) {
                alert('No hay pedidos pendientes para enviar a la hoja de reparto');
                return;
            }
            
            if (confirm(`¿Enviar los ${pedidosNoEnviados.length} pedidos pendientes del ${diaSeleccionadoDiario} a la hoja de reparto?`)) {
                // Ordenar por orden de reparto
                pedidosNoEnviados.sort((a, b) => a.orden - b.orden);
                
                const fechaEnvio = new Date().toISOString().split('T')[0];
                
                pedidosNoEnviados.forEach(pedido => {
                    const pedidoReparto = {
                        ...pedido,
                        id: Date.now() + Math.random(), // Nuevo ID único
                        orden: pedidosReparto.length + 1,
                        camion: "Sin asignar"
                    };
                    
                    pedidosReparto.push(pedidoReparto);
                    
                    // Marcar como enviado en el calendario (mantener como historial)
                    pedido.enviadoAReparto = true;
                    pedido.fechaEnvioReparto = fechaEnvio;
                });
                
                actualizarVistaDiaria();
                actualizarPedidosDia(diaSeleccionadoDiario);
                actualizarTablaReparto();
                alert(`${pedidosNoEnviados.length} pedidos enviados a la hoja de reparto (mantenidos en calendario como historial)`);
            }
        }

        // Funciones para la Hoja de Reparto
        function actualizarFechasReparto() {
            const ahora = new Date();
            const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            
            const diaSemana = diasSemana[ahora.getDay()];
            const dia = ahora.getDate();
            const mes = meses[ahora.getMonth()];
            const año = ahora.getFullYear();
            
            const fechaCompleta = `${diaSemana}, ${dia} de ${mes} de ${año}`;
            
            document.getElementById('fechaImpresionReparto').textContent = fechaCompleta;
            document.getElementById('fechaPantallaReparto').textContent = fechaCompleta;
        }

        function mostrarSelectorClientes() {
            const selector = document.getElementById('selectorClientesReparto');
            const lista = document.getElementById('listaClientesSelectorReparto');
            
            lista.innerHTML = '';
            
            // Obtener todos los pedidos de todos los clientes
            const todosPedidos = [];
            clientes.forEach(cliente => {
                if (cliente.pedidos && cliente.pedidos.length > 0) {
                    cliente.pedidos.forEach(pedido => {
                        todosPedidos.push({
                            cliente: cliente,
                            pedido: pedido,
                            id: `${cliente.id}-${pedido.fecha}-${pedido.descripcion}`
                        });
                    });
                }
            });
            
            // Filtrar pedidos que no están ya en la hoja de reparto
            const pedidosDisponibles = todosPedidos.filter(item => 
                !pedidosReparto.some(pedidoReparto => pedidoReparto.pedidoId === item.id)
            );
            
            if (pedidosDisponibles.length === 0) {
                lista.innerHTML = '<div class="col-span-full text-center text-gray-500 py-4">No hay pedidos disponibles para agregar a la hoja</div>';
            } else {
                pedidosDisponibles.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'bg-white p-4 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors duration-200 shadow-sm';
                    card.innerHTML = `
                        <div class="font-semibold text-gray-800">${item.cliente.apodo}</div>
                        <div class="text-sm text-gray-600">${item.cliente.nombreCompleto}</div>
                        <div class="text-sm text-gray-600">${item.cliente.telefono}</div>
                        <div class="text-sm text-blue-600 font-medium mt-2">${item.pedido.descripcion}</div>
                        <div class="text-xs text-gray-500">${item.cliente.localidad} - ${item.cliente.zonaReparto}</div>
                        <div class="text-xs text-gray-500">Pedido: ${formatearFecha(item.pedido.fecha)}</div>
                        <div class="text-xs text-green-600 font-medium">Entrega: ${formatearFecha(item.pedido.entrega)}</div>
                        ${item.pedido.observaciones ? `<div class="text-xs text-orange-600 mt-1">📝 ${item.pedido.observaciones}</div>` : ''}
                    `;
                    card.addEventListener('click', () => agregarPedidoAHojaReparto(item.cliente, item.pedido, item.id));
                    lista.appendChild(card);
                });
            }
            
            selector.classList.remove('hidden');
        }

        function ocultarSelectorClientes() {
            document.getElementById('selectorClientesReparto').classList.add('hidden');
        }

        function agregarPedidoAHojaReparto(cliente, pedido, pedidoId) {
            const nuevoPedido = {
                id: Date.now(),
                pedidoId: pedidoId,
                clienteId: cliente.id,
                apodo: cliente.apodo,
                telefono: cliente.telefono,
                pedido: pedido.descripcion,
                fechaPedido: pedido.fecha,
                fechaEntrega: pedido.entrega,
                localidad: cliente.localidad,
                zona: cliente.zonaReparto,
                orden: pedidosReparto.length + 1,
                conductor: "Sin asignar",
                observaciones: pedido.observaciones || cliente.observaciones || ''
            };
            
            pedidosReparto.push(nuevoPedido);
            actualizarTablaReparto();
            ocultarSelectorClientes();
        }

        function eliminarPedidoReparto(id) {
            if (confirm('¿Confirmas que este pedido ha sido entregado y quieres eliminarlo de la hoja?')) {
                pedidosReparto = pedidosReparto.filter(pedido => pedido.id !== id);
                // Reordenar los números de orden
                pedidosReparto.forEach((pedido, index) => {
                    pedido.orden = index + 1;
                });
                actualizarTablaReparto();
            }
        }

        function cambiarOrdenReparto(id, nuevaOrden) {
            const pedido = pedidosReparto.find(p => p.id === id);
            if (pedido && nuevaOrden >= 1 && nuevaOrden <= pedidosReparto.length) {
                // Reordenar array
                pedidosReparto.sort((a, b) => {
                    if (a.id === id) return nuevaOrden - 1;
                    if (b.id === id) return -(nuevaOrden - 1);
                    return a.orden - b.orden;
                });
                
                // Actualizar números de orden
                pedidosReparto.forEach((p, index) => {
                    p.orden = index + 1;
                });
                
                actualizarTablaReparto();
            }
        }

        function cambiarConductorReparto(id, conductor) {
            const pedido = pedidosReparto.find(p => p.id === id);
            if (pedido) {
                pedido.conductor = conductor;
                actualizarTablaReparto();
            }
        }

        function cambiarCamionReparto(id, camion) {
            const pedido = pedidosReparto.find(p => p.id === id);
            if (pedido) {
                pedido.camion = camion;
                actualizarTablaReparto();
            }
        }

        function actualizarTablaReparto() {
            const cuerpo = document.getElementById('cuerpoTablaPedidosReparto');
            const mensajeVacio = document.getElementById('mensajeVacioReparto');
            const totalPedidos = document.getElementById('totalPedidosReparto');
            const totalPedidosPantalla = document.getElementById('totalPedidosPantallaReparto');
            
            if (pedidosReparto.length === 0) {
                cuerpo.innerHTML = '';
                mensajeVacio.classList.remove('hidden');
            } else {
                mensajeVacio.classList.add('hidden');
                
                // Ordenar por orden de reparto
                pedidosReparto.sort((a, b) => a.orden - b.orden);
                
                cuerpo.innerHTML = pedidosReparto.map(pedido => `
                    <tr class="hover:bg-gray-50 transition-colors duration-150">
                        <td class="px-3 py-2 text-sm text-center border border-gray-300 orden-cell">
                            <input type="number" value="${pedido.orden}" min="1" max="${pedidosReparto.length}" onchange="cambiarOrdenRepartoInput(${pedido.id}, parseInt(this.value))" class="w-full text-center border-0 bg-transparent focus:ring-2 focus:ring-blue-500 rounded" style="width: 50px;">
                        </td>
                        <td class="px-3 py-2 text-sm font-medium text-gray-900 border border-gray-300">${pedido.apodo}</td>
                        <td class="px-3 py-2 text-sm text-gray-700 border border-gray-300">
                            <a href="tel:${pedido.telefono}" class="text-blue-600 hover:text-blue-800">${pedido.telefono}</a>
                        </td>
                        <td class="px-3 py-2 text-sm text-gray-700 font-medium border border-gray-300">${pedido.pedido}</td>
                        <td class="px-3 py-2 text-sm text-gray-700 border border-gray-300">${formatearFecha(pedido.fechaPedido)}</td>
                        <td class="px-3 py-2 text-sm text-gray-700 border border-gray-300">${formatearFecha(pedido.fechaEntrega)}</td>
                        <td class="px-3 py-2 text-sm text-gray-700 border border-gray-300">${pedido.localidad}</td>
                        <td class="px-3 py-2 text-sm border border-gray-300">
                            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getZonaColor(pedido.zona)}">
                                ${pedido.zona}
                            </span>
                        </td>
                        <td class="px-3 py-2 text-sm border border-gray-300 conductor-cell">
                            <select onchange="cambiarConductorReparto(${pedido.id}, this.value)" class="w-full text-xs border-0 bg-transparent focus:ring-2 focus:ring-blue-500 rounded">
                                ${conductores.map(conductor => 
                                    `<option value="${conductor}" ${conductor === pedido.conductor ? 'selected' : ''}>${conductor}</option>`
                                ).join('')}
                            </select>
                        </td>
                        <td class="px-3 py-2 text-sm border border-gray-300 conductor-cell">
                            <select onchange="cambiarCamionReparto(${pedido.id}, this.value)" class="w-full text-xs border-0 bg-transparent focus:ring-2 focus:ring-blue-500 rounded">
                                ${camiones.map(camion => 
                                    `<option value="${camion}" ${camion === (pedido.camion || 'Sin asignar') ? 'selected' : ''}>${camion}</option>`
                                ).join('')}
                            </select>
                        </td>
                        <td class="px-3 py-2 text-xs text-gray-600 border border-gray-300 observaciones-cell" title="${pedido.observaciones}">
                            ${pedido.observaciones || '-'}
                        </td>
                        <td class="px-3 py-2 text-sm border border-gray-300 no-print">
                            <button onclick="eliminarPedidoReparto(${pedido.id})" class="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors duration-200" title="Marcar como entregado">
                                ✅ Entregado
                            </button>
                        </td>
                    </tr>
                `).join('');
            }
            
            if (totalPedidos) totalPedidos.textContent = pedidosReparto.length;
            if (totalPedidosPantalla) totalPedidosPantalla.textContent = pedidosReparto.length;
        }

        function limpiarHojaReparto() {
            if (confirm('¿Estás seguro de que quieres limpiar toda la hoja de reparto?')) {
                pedidosReparto = [];
                actualizarTablaReparto();
            }
        }

        function imprimirHojaReparto() {
            if (pedidosReparto.length === 0) {
                alert('No hay pedidos en la hoja para imprimir');
                return;
            }
            
            // Actualizar fecha de impresión
            actualizarFechasReparto();
            
            // Imprimir
            window.print();
        }

        function ordenarHojaReparto() {
            const criterio = document.getElementById('ordenarReparto').value;
            
            pedidosReparto.sort((a, b) => {
                switch(criterio) {
                    case 'orden':
                        return a.orden - b.orden;
                    case 'zona':
                        return a.zona.localeCompare(b.zona);
                    case 'conductor':
                        return a.conductor.localeCompare(b.conductor);
                    case 'camion':
                        return (a.camion || 'Sin asignar').localeCompare(b.camion || 'Sin asignar');
                    case 'apodo':
                        return a.apodo.localeCompare(b.apodo);
                    case 'localidad':
                        return a.localidad.localeCompare(b.localidad);
                    default:
                        return 0;
                }
            });
            
            // Reordenar números de orden después del ordenamiento
            pedidosReparto.forEach((pedido, index) => {
                pedido.orden = index + 1;
            });
            
            actualizarTablaReparto();
        }

        function reordenarAutomaticamente() {
            if (pedidosReparto.length === 0) {
                alert('No hay pedidos para reordenar');
                return;
            }
            
            // Ordenar primero por zona, luego por conductor
            pedidosReparto.sort((a, b) => {
                const zonaComparison = a.zona.localeCompare(b.zona);
                if (zonaComparison !== 0) return zonaComparison;
                return a.conductor.localeCompare(b.conductor);
            });
            
            // Reordenar números de orden
            pedidosReparto.forEach((pedido, index) => {
                pedido.orden = index + 1;
            });
            
            actualizarTablaReparto();
            alert('Hoja reordenada automáticamente por zona y conductor');
        }

        // Funciones para gestión de base de datos de conductores y camiones
        function actualizarListaConductores() {
            const lista = document.getElementById('listaConductores');
            const totalConductores = document.getElementById('totalConductores');
            lista.innerHTML = '';
            
            const conductoresEditables = conductores.filter(c => c !== "Sin asignar");
            
            if (conductoresEditables.length === 0) {
                lista.innerHTML = '<div class="px-3 py-4 text-center text-gray-500 text-sm">No hay conductores registrados</div>';
            } else {
                conductoresEditables.forEach((conductor, index) => {
                    const realIndex = conductores.indexOf(conductor);
                    const item = document.createElement('div');
                    item.className = 'flex justify-between items-center px-3 py-3 hover:bg-gray-100 transition-colors duration-150';
                    item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                                ${conductor.charAt(0).toUpperCase()}
                            </div>
                            <span class="font-medium text-gray-800">${conductor}</span>
                        </div>
                        <button onclick="eliminarConductor(${realIndex})" class="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors duration-150" title="Eliminar conductor">
                            🗑️
                        </button>
                    `;
                    lista.appendChild(item);
                });
            }
            
            if (totalConductores) {
                totalConductores.textContent = conductoresEditables.length;
            }
        }

        function actualizarListaCamiones() {
            const lista = document.getElementById('listaCamiones');
            const totalCamiones = document.getElementById('totalCamiones');
            lista.innerHTML = '';
            
            const camionesEditables = camiones.filter(c => c !== "Sin asignar");
            
            if (camionesEditables.length === 0) {
                lista.innerHTML = '<div class="px-3 py-4 text-center text-gray-500 text-sm">No hay camiones registrados</div>';
            } else {
                camionesEditables.forEach((camion, index) => {
                    const realIndex = camiones.indexOf(camion);
                    const item = document.createElement('div');
                    item.className = 'flex justify-between items-center px-3 py-3 hover:bg-gray-100 transition-colors duration-150';
                    item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-medium">
                                🚛
                            </div>
                            <span class="font-medium text-gray-800">${camion}</span>
                        </div>
                        <button onclick="eliminarCamion(${realIndex})" class="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors duration-150" title="Eliminar camión">
                            🗑️
                        </button>
                    `;
                    lista.appendChild(item);
                });
            }
            
            if (totalCamiones) {
                totalCamiones.textContent = camionesEditables.length;
            }
        }

        function actualizarListaZonas() {
            const lista = document.getElementById('listaZonas');
            const totalZonas = document.getElementById('totalZonas');
            lista.innerHTML = '';
            
            if (zonas.length === 0) {
                lista.innerHTML = '<div class="px-3 py-4 text-center text-gray-500 text-sm">No hay zonas registradas</div>';
            } else {
                zonas.forEach((zona, index) => {
                    const item = document.createElement('div');
                    item.className = 'flex justify-between items-center px-3 py-3 hover:bg-gray-100 transition-colors duration-150';
                    item.innerHTML = `
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 ${getZonaColor(zona)} rounded-full flex items-center justify-center text-sm font-medium">
                                🗺️
                            </div>
                            <span class="font-medium text-gray-800">${zona}</span>
                        </div>
                        <button onclick="eliminarZona(${index})" class="text-red-600 hover:text-red-800 hover:bg-red-50 px-2 py-1 rounded transition-colors duration-150" title="Eliminar zona">
                            🗑️
                        </button>
                    `;
                    lista.appendChild(item);
                });
            }
            
            if (totalZonas) {
                totalZonas.textContent = zonas.length;
            }
        }

        function agregarZona() {
            const input = document.getElementById('nuevaZona');
            const nombre = input.value.trim();
            
            if (nombre === '') {
                alert('Por favor, ingresa el nombre de la zona');
                return;
            }
            
            if (zonas.includes(nombre)) {
                alert('Esta zona ya existe en la base de datos');
                return;
            }
            
            zonas.push(nombre);
            input.value = '';
            actualizarListaZonas();
            actualizarSelectoresZonas();
            alert('Zona agregada correctamente');
        }

        function eliminarZona(index) {
            const zona = zonas[index];
            
            if (confirm(`¿Estás seguro de que quieres eliminar la zona "${zona}"?`)) {
                // Verificar si la zona está siendo usada
                const enUsoClientes = clientes.some(cliente => cliente.zonaReparto === zona);
                const enUsoPendientes = pedidosPendientes.some(pedido => pedido.zona === zona);
                const enUsoCalendario = Object.values(pedidosCalendario).some(dia => 
                    dia.some(pedido => pedido.zona === zona)
                );
                const enUsoReparto = pedidosReparto.some(pedido => pedido.zona === zona);
                
                if (enUsoClientes || enUsoPendientes || enUsoCalendario || enUsoReparto) {
                    if (confirm(`La zona "${zona}" está siendo usada por clientes o pedidos. ¿Quieres eliminarla de todos modos? Los elementos quedarán sin zona asignada.`)) {
                        // Cambiar asignaciones a la primera zona disponible o crear una zona por defecto
                        const zonaReemplazo = zonas.length > 1 ? zonas.find(z => z !== zona) : 'Sin zona';
                        
                        // Si no hay otras zonas, crear una zona por defecto
                        if (zonaReemplazo === 'Sin zona' && !zonas.includes('Sin zona')) {
                            zonas.push('Sin zona');
                        }
                        
                        // Actualizar clientes
                        clientes.forEach(cliente => {
                            if (cliente.zonaReparto === zona) {
                                cliente.zonaReparto = zonaReemplazo;
                            }
                        });
                        
                        // Actualizar pedidos pendientes
                        pedidosPendientes.forEach(pedido => {
                            if (pedido.zona === zona) {
                                pedido.zona = zonaReemplazo;
                            }
                        });
                        
                        // Actualizar calendario
                        Object.values(pedidosCalendario).forEach(dia => {
                            dia.forEach(pedido => {
                                if (pedido.zona === zona) {
                                    pedido.zona = zonaReemplazo;
                                }
                            });
                        });
                        
                        // Actualizar reparto
                        pedidosReparto.forEach(pedido => {
                            if (pedido.zona === zona) {
                                pedido.zona = zonaReemplazo;
                            }
                        });
                        
                        zonas.splice(index, 1);
                        actualizarListaZonas();
                        actualizarSelectoresZonas();
                        cargarClientes();
                        actualizarListaPendientes();
                        actualizarCalendario();
                        actualizarTablaReparto();
                        alert(`Zona eliminada y elementos actualizados a "${zonaReemplazo}"`);
                    }
                } else {
                    zonas.splice(index, 1);
                    actualizarListaZonas();
                    actualizarSelectoresZonas();
                    alert('Zona eliminada correctamente');
                }
            }
        }

        function actualizarSelectoresZonas() {
            // Actualizar todos los selectores de zonas en la página
            const selectores = [
                document.getElementById('zonaReparto'),
                document.getElementById('editZonaReparto')
            ];
            
            selectores.forEach(selector => {
                if (selector) {
                    const valorActual = selector.value;
                    const esRequerido = selector.hasAttribute('required');
                    
                    selector.innerHTML = '';
                    
                    if (esRequerido) {
                        selector.innerHTML += '<option value="">Seleccionar zona...</option>';
                    }
                    
                    zonas.forEach(zona => {
                        selector.innerHTML += `<option value="${zona}" ${zona === valorActual ? 'selected' : ''}>${zona}</option>`;
                    });
                }
            });
            
            // Actualizar selectores en la tabla de clientes
            const selectoresTabla = document.querySelectorAll('select[onchange*="zonaReparto"]');
            selectoresTabla.forEach(selector => {
                const valorActual = selector.value;
                selector.innerHTML = '';
                zonas.forEach(zona => {
                    selector.innerHTML += `<option value="${zona}" ${zona === valorActual ? 'selected' : ''}>${zona}</option>`;
                });
            });
        }

        function agregarConductor() {
            const input = document.getElementById('nuevoConductor');
            const nombre = input.value.trim();
            
            if (nombre === '') {
                alert('Por favor, ingresa el nombre del conductor');
                return;
            }
            
            if (conductores.includes(nombre)) {
                alert('Este conductor ya existe en la base de datos');
                return;
            }
            
            conductores.push(nombre);
            input.value = '';
            actualizarListaConductores();
            actualizarSelectoresConductores();
            alert('Conductor agregado correctamente');
        }

        function eliminarConductor(index) {
            const conductor = conductores[index];
            
            if (confirm(`¿Estás seguro de que quieres eliminar al conductor "${conductor}"?`)) {
                // Verificar si el conductor está siendo usado
                const enUso = pedidosReparto.some(pedido => pedido.conductor === conductor) ||
                             Object.values(pedidosCalendario).some(dia => 
                                 dia.some(pedido => pedido.conductor === conductor)
                             );
                
                if (enUso) {
                    if (confirm(`El conductor "${conductor}" está asignado a pedidos. ¿Quieres eliminarlo de todos modos? Los pedidos quedarán sin conductor asignado.`)) {
                        // Cambiar asignaciones a "Sin asignar"
                        pedidosReparto.forEach(pedido => {
                            if (pedido.conductor === conductor) {
                                pedido.conductor = "Sin asignar";
                            }
                        });
                        
                        Object.values(pedidosCalendario).forEach(dia => {
                            dia.forEach(pedido => {
                                if (pedido.conductor === conductor) {
                                    pedido.conductor = "Sin asignar";
                                }
                            });
                        });
                        
                        conductores.splice(index, 1);
                        actualizarListaConductores();
                        actualizarSelectoresConductores();
                        actualizarTablaReparto();
                        actualizarCalendario();
                        alert('Conductor eliminado y pedidos actualizados');
                    }
                } else {
                    conductores.splice(index, 1);
                    actualizarListaConductores();
                    actualizarSelectoresConductores();
                    alert('Conductor eliminado correctamente');
                }
            }
        }

        function agregarCamion() {
            const input = document.getElementById('nuevoCamion');
            const nombre = input.value.trim();
            
            if (nombre === '') {
                alert('Por favor, ingresa el nombre/placa del camión');
                return;
            }
            
            if (camiones.includes(nombre)) {
                alert('Este camión ya existe en la base de datos');
                return;
            }
            
            camiones.push(nombre);
            input.value = '';
            actualizarListaCamiones();
            actualizarSelectoresCamiones();
            alert('Camión agregado correctamente');
        }

        function eliminarCamion(index) {
            const camion = camiones[index];
            
            if (confirm(`¿Estás seguro de que quieres eliminar el camión "${camion}"?`)) {
                // Verificar si el camión está siendo usado
                const enUso = pedidosReparto.some(pedido => pedido.camion === camion) ||
                             Object.values(pedidosCalendario).some(dia => 
                                 dia.some(pedido => pedido.camion === camion)
                             );
                
                if (enUso) {
                    if (confirm(`El camión "${camion}" está asignado a pedidos. ¿Quieres eliminarlo de todos modos? Los pedidos quedarán sin camión asignado.`)) {
                        // Cambiar asignaciones a "Sin asignar"
                        pedidosReparto.forEach(pedido => {
                            if (pedido.camion === camion) {
                                pedido.camion = "Sin asignar";
                            }
                        });
                        
                        Object.values(pedidosCalendario).forEach(dia => {
                            dia.forEach(pedido => {
                                if (pedido.camion === camion) {
                                    pedido.camion = "Sin asignar";
                                }
                            });
                        });
                        
                        camiones.splice(index, 1);
                        actualizarListaCamiones();
                        actualizarSelectoresCamiones();
                        actualizarTablaReparto();
                        actualizarCalendario();
                        alert('Camión eliminado y pedidos actualizados');
                    }
                } else {
                    camiones.splice(index, 1);
                    actualizarListaCamiones();
                    actualizarSelectoresCamiones();
                    alert('Camión eliminado correctamente');
                }
            }
        }

        function actualizarSelectoresConductores() {
            // Actualizar todos los selectores de conductores en la página
            const selectores = document.querySelectorAll('select[onchange*="cambiarConductor"], select[id*="Conductor"], select[id*="conductor"]');
            selectores.forEach(selector => {
                const valorActual = selector.value;
                selector.innerHTML = conductores.map(conductor => 
                    `<option value="${conductor}" ${conductor === valorActual ? 'selected' : ''}>${conductor}</option>`
                ).join('');
            });
            
            // Actualizar también el modal de edición de pedidos
            const editConductor = document.getElementById('editConductor');
            if (editConductor) {
                const valorActual = editConductor.value;
                editConductor.innerHTML = conductores.map(conductor => 
                    `<option value="${conductor}" ${conductor === valorActual ? 'selected' : ''}>${conductor}</option>`
                ).join('');
            }
        }

        function actualizarSelectoresCamiones() {
            // Actualizar todos los selectores de camiones en la página
            const selectores = document.querySelectorAll('select[onchange*="cambiarCamion"], select[id*="Camion"], select[id*="camion"]');
            selectores.forEach(selector => {
                const valorActual = selector.value;
                selector.innerHTML = camiones.map(camion => 
                    `<option value="${camion}" ${camion === valorActual ? 'selected' : ''}>${camion}</option>`
                ).join('');
            });
            
            // Actualizar también el modal de edición de pedidos
            const editCamion = document.getElementById('editCamion');
            if (editCamion) {
                const valorActual = editCamion.value;
                editCamion.innerHTML = camiones.map(camion => 
                    `<option value="${camion}" ${camion === valorActual ? 'selected' : ''}>${camion}</option>`
                ).join('');
            }
        }

        function cambiarOrdenRepartoInput(id, nuevaOrden) {
            const pedido = pedidosReparto.find(p => p.id === id);
            if (!pedido || nuevaOrden < 1 || nuevaOrden > pedidosReparto.length) {
                actualizarTablaReparto(); // Restaurar valor original
                return;
            }
            
            // Verificar si ya existe un pedido con ese orden
            const pedidoExistente = pedidosReparto.find(p => p.orden === nuevaOrden && p.id !== id);
            if (pedidoExistente) {
                // Intercambiar órdenes
                const ordenAnterior = pedido.orden;
                pedido.orden = nuevaOrden;
                pedidoExistente.orden = ordenAnterior;
            } else {
                pedido.orden = nuevaOrden;
            }
            
            actualizarTablaReparto();
        }

        // Funciones para la pestaña de Gestión de BD
        function actualizarEstadisticas() {
            const estadClientes = document.getElementById('estadClientes');
            const estadPendientes = document.getElementById('estadPendientes');
            const estadCalendario = document.getElementById('estadCalendario');
            const estadReparto = document.getElementById('estadReparto');
            
            if (estadClientes) estadClientes.textContent = clientes.length;
            if (estadPendientes) estadPendientes.textContent = pedidosPendientes.length;
            
            // Contar pedidos en calendario
            let totalCalendario = 0;
            Object.values(pedidosCalendario).forEach(dia => {
                totalCalendario += dia.length;
            });
            if (estadCalendario) estadCalendario.textContent = totalCalendario;
            
            if (estadReparto) estadReparto.textContent = pedidosReparto.length;
        }

        function limpiarPedidosAntiguos() {
            const fechaLimite = prompt('¿Eliminar pedidos anteriores a qué fecha? (YYYY-MM-DD)', '2024-01-01');
            if (!fechaLimite) return;
            
            if (confirm(`¿Estás seguro de que quieres eliminar todos los pedidos anteriores al ${fechaLimite}? Esta acción no se puede deshacer.`)) {
                let eliminados = 0;
                
                // Limpiar pedidos pendientes
                const pendientesOriginales = pedidosPendientes.length;
                pedidosPendientes = pedidosPendientes.filter(p => p.fechaEntrega >= fechaLimite);
                eliminados += pendientesOriginales - pedidosPendientes.length;
                
                // Limpiar calendario
                Object.keys(pedidosCalendario).forEach(dia => {
                    const originales = pedidosCalendario[dia].length;
                    pedidosCalendario[dia] = pedidosCalendario[dia].filter(p => p.fechaEntrega >= fechaLimite);
                    eliminados += originales - pedidosCalendario[dia].length;
                    
                    // Reordenar
                    pedidosCalendario[dia].forEach((p, index) => {
                        p.orden = index + 1;
                    });
                });
                
                // Limpiar hoja de reparto
                const repartoOriginales = pedidosReparto.length;
                pedidosReparto = pedidosReparto.filter(p => p.fechaEntrega >= fechaLimite);
                eliminados += repartoOriginales - pedidosReparto.length;
                
                // Reordenar reparto
                pedidosReparto.forEach((p, index) => {
                    p.orden = index + 1;
                });
                
                // Limpiar historial de clientes
                clientes.forEach(cliente => {
                    if (cliente.pedidos) {
                        const originales = cliente.pedidos.length;
                        cliente.pedidos = cliente.pedidos.filter(p => p.entrega >= fechaLimite);
                        eliminados += originales - cliente.pedidos.length;
                    }
                });
                
                // Actualizar todas las vistas
                actualizarListaPendientes();
                actualizarCalendario();
                actualizarTablaReparto();
                cargarClientes();
                actualizarEstadisticas();
                
                alert(`Limpieza completada. Se eliminaron ${eliminados} pedidos antiguos.`);
            }
        }

        function exportarDatos() {
            const datos = {
                clientes: clientes,
                pedidosPendientes: pedidosPendientes,
                pedidosCalendario: pedidosCalendario,
                pedidosReparto: pedidosReparto,
                conductores: conductores,
                camiones: camiones,
                zonas: zonas,
                fechaExportacion: new Date().toISOString()
            };
            
            const dataStr = JSON.stringify(datos, null, 2);
            const dataBlob = new Blob([dataStr], {type: 'application/json'});
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `backup_sistema_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            alert('Datos exportados correctamente. El archivo se ha descargado.');
        }

        function resetearSistema() {
            const confirmacion = prompt('⚠️ PELIGRO: Esto eliminará TODOS los datos del sistema.\n\nPara confirmar, escribe: "RESETEAR SISTEMA"');
            
            if (confirmacion === 'RESETEAR SISTEMA') {
                // Resetear todas las variables
                clientes.length = 0;
                pedidosPendientes.length = 0;
                pedidosReparto.length = 0;
                
                // Resetear calendario
                Object.keys(pedidosCalendario).forEach(dia => {
                    pedidosCalendario[dia] = [];
                });
                
                // Mantener conductores, camiones y zonas básicos
                conductores.length = 0;
                conductores.push("Sin asignar", "Juan Pérez", "María García", "Carlos López");
                
                camiones.length = 0;
                camiones.push("Sin asignar", "Camión 1 - ABC123", "Camión 2 - DEF456", "Furgoneta 1 - JKL012");
                
                zonas.length = 0;
                zonas.push("Centro", "Norte", "Sur", "Este", "Oeste", "Periferia");
                
                // Actualizar todas las vistas
                cargarClientes();
                actualizarListaPendientes();
                actualizarCalendario();
                actualizarTablaReparto();
                actualizarListaConductores();
                actualizarListaCamiones();
                actualizarListaZonas();
                actualizarSelectoresZonas();
                actualizarEstadisticas();
                limpiarFormularioPedido();
                
                alert('✅ Sistema reseteado completamente. Todos los datos han sido eliminados.');
            } else {
                alert('Reseteo cancelado. Los datos permanecen intactos.');
            }
        }

        // Autocompletado
        function configurarAutocompletado() {
            const input = document.getElementById('apodoAutoComplete');
            const suggestions = document.getElementById('autocompleteSuggestions');

            input.addEventListener('input', function() {
                const valor = this.value.toLowerCase();
                suggestions.innerHTML = '';
                
                if (valor.length === 0) {
                    suggestions.classList.add('hidden');
                    limpiarCamposAutoFill();
                    return;
                }

                const coincidencias = clientes.filter(cliente => 
                    cliente.apodo.toLowerCase().includes(valor) ||
                    cliente.nombreCompleto.toLowerCase().includes(valor)
                );

                if (coincidencias.length > 0) {
                    suggestions.classList.remove('hidden');
                    coincidencias.forEach(cliente => {
                        const item = document.createElement('div');
                        item.className = 'autocomplete-item';
                        item.innerHTML = `<strong>${cliente.apodo}</strong> - ${cliente.nombreCompleto}`;
                        item.addEventListener('click', () => seleccionarCliente(cliente));
                        suggestions.appendChild(item);
                    });
                } else {
                    suggestions.classList.add('hidden');
                    limpiarCamposAutoFill();
                }
            });

            // Cerrar sugerencias al hacer clic fuera
            document.addEventListener('click', function(e) {
                if (!input.contains(e.target) && !suggestions.contains(e.target)) {
                    suggestions.classList.add('hidden');
                }
            });
        }

        function seleccionarCliente(cliente) {
            clienteSeleccionado = cliente;
            
            // Llenar campos
            document.getElementById('apodoAutoComplete').value = cliente.apodo;
            document.getElementById('nombreAutoFill').value = cliente.nombreCompleto;
            document.getElementById('telefonoAutoFill').value = cliente.telefono;
            document.getElementById('localidadAutoFill').value = cliente.localidad;
            document.getElementById('zonaAutoFill').value = cliente.zonaReparto;
            
            // Llenar dropdown de pedidos
            const dropdown = document.getElementById('ultimosPedidosDropdown');
            dropdown.innerHTML = '';
            
            if (cliente.pedidos.length > 0) {
                cliente.pedidos.forEach((pedido, index) => {
                    const item = document.createElement('div');
                    item.className = 'dropdown-item';
                    item.innerHTML = `
                        <div class="text-sm">
                            <strong>#${index + 1}:</strong> ${pedido.descripcion}
                            <br><span class="text-gray-500">${formatearFecha(pedido.fecha)} → ${formatearFecha(pedido.entrega)}</span>
                        </div>
                    `;
                    dropdown.appendChild(item);
                });
            } else {
                const item = document.createElement('div');
                item.className = 'dropdown-item text-gray-500';
                item.textContent = 'Sin pedidos anteriores';
                dropdown.appendChild(item);
            }
            
            // Ocultar sugerencias
            document.getElementById('autocompleteSuggestions').classList.add('hidden');
        }

        function limpiarCamposAutoFill() {
            clienteSeleccionado = null;
            document.getElementById('nombreAutoFill').value = '';
            document.getElementById('telefonoAutoFill').value = '';
            document.getElementById('localidadAutoFill').value = '';
            document.getElementById('zonaAutoFill').value = '';
            document.getElementById('ultimosPedidosDropdown').innerHTML = '';
        }

        function limpiarFormularioPedido() {
            document.getElementById('nuevoPedidoForm').reset();
            limpiarCamposAutoFill();
            const hoy = new Date().toISOString().split('T')[0];
            document.getElementById('fechaPedidoNuevo').value = hoy;
        }

        // Gestión de la base de datos
        const API_URL = window.location.origin; // Usa el dominio actual (local o Render)

        async function cargarClientes() {
            try {
                const res = await fetch(`${API_URL}/clientes`);
                let data = await res.json();
                clientes = data.map(c => ({
                    id: c.id,
                    apodo: c.apodo,
                    nombreCompleto: c.nombre_completo,
                    telefono: c.telefono,
                    localidad: c.localidad,
                    zonaReparto: c.zona_reparto,
                    observaciones: c.observaciones,
                    pedidos: [] // Puedes cargar los pedidos con otra petición si lo necesitas
                }));
                renderizarTablaClientes();
            } catch (err) {
                alert('Error al cargar clientes desde la base de datos');
                console.error(err);
            }
        }

        function renderizarTablaClientes() {
            const tbody = document.getElementById('clientesTable');
            tbody.innerHTML = '';
            clientes.forEach(cliente => {
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition-colors duration-150';
                row.innerHTML = `
                    <td class="px-4 py-3 text-sm text-gray-700 border">${cliente.apodo}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 border">${cliente.nombreCompleto}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 border">${cliente.telefono}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 border">${cliente.localidad}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 border">${cliente.zonaReparto}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 border">
                        ${cliente.pedidos && cliente.pedidos.length > 0
                            ? cliente.pedidos.map(p => `<div>${p.descripcion} (${formatearFecha(p.fecha)})</div>`).join('')
                            : '<span class="text-gray-400">Sin pedidos</span>'}
                    </td>
                    <td class="px-4 py-3 text-sm text-gray-700 border">${cliente.observaciones || ''}</td>
                    <td class="px-4 py-3 text-sm text-gray-700 border">
                        <button onclick="editarCliente(${cliente.id})" class="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs">✏️</button>
                        <button onclick="eliminarCliente(${cliente.id})" class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs">🗑️</button>
                    </td>
                `;
                tbody.appendChild(row);
            });
        }

        function getZonaColor(zona) {
            const colores = {
                'Centro': 'bg-blue-100 text-blue-800',
                'Norte': 'bg-green-100 text-green-800',
                'Sur': 'bg-yellow-100 text-yellow-800',
                'Este': 'bg-purple-100 text-purple-800',
                'Oeste': 'bg-pink-100 text-pink-800',
                'Periferia': 'bg-gray-100 text-gray-800'
            };
            return colores[zona] || 'bg-gray-100 text-gray-800';
        }

        function formatearFecha(fecha) {
            return new Date(fecha).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        }

        function agregarCliente() {
            editandoId = null;
            document.getElementById('modalTitle').textContent = 'Agregar Nuevo Cliente';
            document.getElementById('clienteForm').reset();
            //actualizarSelectoresZonas();
            document.getElementById('clienteModal').classList.remove('hidden');
            document.getElementById('clienteModal').classList.add('flex');
        }

        // Función para actualizar campos individuales de cliente
        function actualizarCampoCliente(id, campo, valor) {
            const cliente = clientes.find(c => c.id === id);
            if (cliente) {
                cliente[campo] = valor.trim();
                
                // Mostrar confirmación visual
                const mensaje = document.createElement('div');
                mensaje.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
                mensaje.textContent = `${campo === 'apodo' ? 'Apodo' : campo === 'nombreCompleto' ? 'Nombre' : campo === 'telefono' ? 'Teléfono' : campo === 'localidad' ? 'Localidad' : campo === 'zonaReparto' ? 'Zona' : 'Observaciones'} actualizado ✓`;
                document.body.appendChild(mensaje);
                
                setTimeout(() => {
                    mensaje.style.opacity = '0';
                    setTimeout(() => mensaje.remove(), 300);
                }, 2000);
                
                // Actualizar autocompletado si es necesario
                if (clienteSeleccionado && clienteSeleccionado.id === id) {
                    clienteSeleccionado = cliente;
                    if (campo === 'apodo') {
                        document.getElementById('apodoAutoComplete').value = valor;
                    }
                }
            }
        }

        // Función para eliminar pedidos individuales de un cliente
        function eliminarPedidoCliente(clienteId, pedidoIndex) {
            if (confirm('¿Estás seguro de que quieres eliminar este pedido del historial del cliente?')) {
                const cliente = clientes.find(c => c.id === clienteId);
                if (cliente && cliente.pedidos[pedidoIndex]) {
                    cliente.pedidos.splice(pedidoIndex, 1);
                    cargarClientes();
                    
                    // Mostrar confirmación
                    const mensaje = document.createElement('div');
                    mensaje.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
                    mensaje.textContent = 'Pedido eliminado del historial ✓';
                    document.body.appendChild(mensaje);
                    
                    setTimeout(() => {
                        mensaje.style.opacity = '0';
                        setTimeout(() => mensaje.remove(), 300);
                    }, 2000);
                }
            }
        }

        // Función para agregar pedido rápido
        function agregarPedidoRapido(clienteId) {
            const cliente = clientes.find(c => c.id === clienteId);
            if (!cliente) return;
            
            const descripcion = prompt('Descripción del pedido:', '');
            if (!descripcion || descripcion.trim() === '') return;
            
            const fechaPedido = prompt('Fecha del pedido (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
            if (!fechaPedido) return;
            
            const fechaEntrega = prompt('Fecha de entrega (YYYY-MM-DD):', fechaPedido);
            if (!fechaEntrega) return;
            
            const observaciones = prompt('Observaciones del pedido (opcional):', '');
            
            const nuevoPedido = {
                descripcion: descripcion.trim(),
                fecha: fechaPedido,
                entrega: fechaEntrega,
                observaciones: observaciones ? observaciones.trim() : ''
            };
            
            // Agregar al inicio del array
            cliente.pedidos.unshift(nuevoPedido);
            
            // Mantener solo los últimos 5 pedidos
            if (cliente.pedidos.length > 5) {
                cliente.pedidos = cliente.pedidos.slice(0, 5);
            }
            
            // Agregar a pedidos pendientes
            const pedidoPendiente = {
                id: `${clienteSeleccionado.id}-${Date.now()}`,
                clienteId: clienteSeleccionado.id,
                apodo: clienteSeleccionado.apodo,
                nombreCompleto: clienteSeleccionado.nombreCompleto,
                telefono: clienteSeleccionado.telefono,
                localidad: clienteSeleccionado.localidad,
                zona: clienteSeleccionado.zonaReparto,
                pedido: nuevoPedido.descripcion,
                fechaPedido: nuevoPedido.fecha,
                fechaEntrega: nuevoPedido.entrega,
                observaciones: nuevoPedido.observaciones || clienteSeleccionado.observaciones || ''
            };

            pedidosPendientes.push(pedidoPendiente);
            
            cargarClientes();
            actualizarListaPendientes();
            
            alert('Pedido agregado al historial y a la lista de pendientes ✓');
        }


        // Función para editar cliente en modal (funcionalidad completa)
        function editarClienteModal(id) {
            editandoId = id;
            const cliente = clientes.find(c => c.id === id);
            
            // Actualizar selector de zonas antes de llenar el modal
            actualizarSelectoresZonas();
            
            document.getElementById('modalTitle').textContent = 'Editar Cliente Completo';
            document.getElementById('apodo').value = cliente.apodo;
            document.getElementById('nombreCompleto').value = cliente.nombreCompleto;
            document.getElementById('telefono').value = cliente.telefono;
            document.getElementById('localidad').value = cliente.localidad;
            document.getElementById('zonaReparto').value = cliente.zonaReparto;
            document.getElementById('observaciones').value = cliente.observaciones;
            
            document.getElementById('clienteModal').classList.remove('hidden');
            document.getElementById('clienteModal').classList.add('flex');
        }

        // Función para eliminar cliente con confirmación mejorada
        function eliminarClienteConfirmacion(id) {
            const cliente = clientes.find(c => c.id === id);
            if (!cliente) return;
            
            // Verificar si el cliente tiene pedidos pendientes o programados
            const tienePendientes = pedidosPendientes.some(p => p.clienteId === id);
            const tieneEnCalendario = Object.values(pedidosCalendario).some(dia => 
                dia.some(p => p.clienteId === id)
            );
            const tieneEnReparto = pedidosReparto.some(p => p.clienteId === id);
            
            let mensaje = `¿Estás seguro de que quieres eliminar al cliente "${cliente.apodo}"?\n\n`;
            mensaje += `• Historial de pedidos: ${cliente.pedidos.length} pedidos\n`;
            
            if (tienePendientes) mensaje += `• ⚠️ Tiene pedidos PENDIENTES\n`;
            if (tieneEnCalendario) mensaje += `• ⚠️ Tiene pedidos en el CALENDARIO\n`;
            if (tieneEnReparto) mensaje += `• ⚠️ Tiene pedidos en HOJA DE REPARTO\n`;
            
            mensaje += `\n¡Esta acción NO se puede deshacer!`;
            
            if (confirm(mensaje)) {
                // Eliminar pedidos relacionados
                if (tienePendientes) {
                    pedidosPendientes = pedidosPendientes.filter(p => p.clienteId !== id);
                    actualizarListaPendientes();
                }
                
                if (tieneEnCalendario) {
                    Object.keys(pedidosCalendario).forEach(dia => {
                        pedidosCalendario[dia] = pedidosCalendario[dia].filter(p => p.clienteId !== id);
                        // Reordenar
                        pedidosCalendario[dia].forEach((p, index) => {
                            p.orden = index + 1;
                        });
                    });
                    actualizarCalendario();
                }
                
                if (tieneEnReparto) {
                    pedidosReparto = pedidosReparto.filter(p => p.clienteId !== id);
                    // Reordenar
                    pedidosReparto.forEach((p, index) => {
                        p.orden = index + 1;
                    });
                    actualizarTablaReparto();
                }
                
                // Eliminar cliente
                clientes = clientes.filter(c => c.id !== id);
                cargarClientes();
                
                // Limpiar autocompletado si era el cliente seleccionado
                if (clienteSeleccionado && clienteSeleccionado.id === id) {
                    limpiarFormularioPedido();
                }
                
                alert('Cliente y todos sus pedidos relacionados eliminados correctamente ✓');
            }
        }

        // Mantener función original para compatibilidad
        function editarCliente(id) {
            editarClienteModal(id);
        }

        function eliminarCliente(id) {
            eliminarClienteConfirmacion(id);
        }

        function cerrarModal() {
            document.getElementById('clienteModal').classList.add('hidden');
            document.getElementById('clienteModal').classList.remove('flex');
        }
        
        // Event Listeners
        document.getElementById("clienteForm").addEventListener("submit", async function(e) {
        e.preventDefault();

        const nuevoCliente = {
            apodo: document.getElementById("apodo").value,
            nombre_completo: document.getElementById("nombre_completo").value,
            telefono: document.getElementById("telefono").value,
            localidad: document.getElementById("localidad").value,
            zona_reparto: document.getElementById("zona_reparto").value,
            observaciones: document.getElementById("observaciones").value
        };

            try {
        let res = await fetch("https://piensos-urbano.onrender.com/clientes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(nuevoCliente)
        });

        if (res.ok) {
            await cargarClientes(); // refresca tabla
            cerrarModal();
        } else {
            alert("⚠️ Error al guardar cliente");
        }
            } catch (err) {
                console.error(err);
                alert("❌ Error de conexión con el servidor");
            }
        });

        document.getElementById('nuevoPedidoForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!clienteSeleccionado) {
                alert('Por favor, selecciona un cliente válido');
                return;
            }

            const nuevoPedido = {
                descripcion: document.getElementById('nuevoPedidoDescripcion').value,
                fecha: document.getElementById('fechaPedidoNuevo').value,
                entrega: document.getElementById('fechaEntregaNuevo').value,
                observaciones: document.getElementById('observacionesPedido').value
            };

            // Agregar pedido al cliente
            const clienteIndex = clientes.findIndex(c => c.id === clienteSeleccionado.id);
            clientes[clienteIndex].pedidos.unshift(nuevoPedido);
            
            // Mantener solo los últimos 5 pedidos
            if (clientes[clienteIndex].pedidos.length > 5) {
                clientes[clienteIndex].pedidos = clientes[clienteIndex].pedidos.slice(0, 5);
            }

            // Agregar a pedidos pendientes
            const pedidoPendiente = {
                id: `${clienteSeleccionado.id}-${Date.now()}`,
                clienteId: clienteSeleccionado.id,
                apodo: clienteSeleccionado.apodo,
                nombreCompleto: clienteSeleccionado.nombreCompleto,
                telefono: clienteSeleccionado.telefono,
                localidad: clienteSeleccionado.localidad,
                zona: clienteSeleccionado.zonaReparto,
                pedido: nuevoPedido.descripcion,
                fechaPedido: nuevoPedido.fecha,
                fechaEntrega: nuevoPedido.entrega,
                observaciones: nuevoPedido.observaciones || clienteSeleccionado.observaciones || ''
            };

            pedidosPendientes.push(pedidoPendiente);
            
            alert('¡Pedido registrado correctamente y agregado a pendientes!');
            limpiarFormularioPedido();
            cargarClientes();
            actualizarListaPendientes();
        });

        // Event listener para el formulario de edición de pedidos
        document.getElementById('editarPedidoForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            if (!pedidoEditandoId || !diaEditandoPedido) return;
            
            const pedido = pedidosCalendario[diaEditandoPedido].find(p => p.id === pedidoEditandoId);
            if (!pedido) return;
            
            // Actualizar datos del pedido
            pedido.telefono = document.getElementById('editTelefono').value;
            pedido.localidad = document.getElementById('editLocalidad').value;
            pedido.zona = document.getElementById('editZonaReparto').value;
            pedido.pedido = document.getElementById('editPedidoDescripcion').value;
            pedido.fechaPedido = document.getElementById('editFechaPedido').value;
            pedido.fechaEntrega = document.getElementById('editFechaEntrega').value;
            pedido.conductor = document.getElementById('editConductor').value;
            pedido.camion = document.getElementById('editCamion').value;
            pedido.observaciones = document.getElementById('editObservaciones').value;
            
            // Actualizar vistas
            actualizarPedidosDia(diaEditandoPedido);
            if (vistaCalendarioActual === 'diaria') {
                actualizarVistaDiaria();
            }
            
            cerrarModalPedido();
            alert('Pedido actualizado correctamente');
        });

        // Cerrar modal de edición de pedido al hacer clic fuera
        document.getElementById('editarPedidoModal').addEventListener('click', function(e) {
            if (e.target === this) {
                cerrarModalPedido();
            }
        });

        // Cerrar modal al hacer clic fuera
        document.getElementById('clienteModal').addEventListener('click', function(e) {
            if (e.target === this) {
                cerrarModal();
            }
        });

        // Inicialización
        document.addEventListener('DOMContentLoaded', function() {
            cargarClientes();
        });