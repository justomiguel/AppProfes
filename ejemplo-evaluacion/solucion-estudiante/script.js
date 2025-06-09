// Clase principal para manejar la aplicación de tareas
class TodoApp {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all';
        this.editingTaskId = null;
        
        // Elementos del DOM
        this.taskInput = document.getElementById('taskInput');
        this.addBtn = document.getElementById('addBtn');
        this.tasksList = document.getElementById('tasksList');
        this.emptyState = document.getElementById('emptyState');
        this.errorMessage = document.getElementById('errorMessage');
        this.filterBtns = document.querySelectorAll('.filter-btn');
        this.editModal = document.getElementById('editModal');
        this.editInput = document.getElementById('editInput');
        this.saveEditBtn = document.getElementById('saveEditBtn');
        this.cancelEditBtn = document.getElementById('cancelEditBtn');
        
        // Contadores
        this.allCount = document.getElementById('allCount');
        this.pendingCount = document.getElementById('pendingCount');
        this.completedCount = document.getElementById('completedCount');
        
        this.init();
    }
    
    // Inicializar la aplicación
    init() {
        this.loadTasks();
        this.bindEvents();
        this.render();
        this.updateCounts();
    }
    
    // Vincular eventos
    bindEvents() {
        // Agregar tarea
        this.addBtn.addEventListener('click', () => this.addTask());
        this.taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });
        
        // Filtros
        this.filterBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
        
        // Modal de edición
        this.saveEditBtn.addEventListener('click', () => this.saveEdit());
        this.cancelEditBtn.addEventListener('click', () => this.closeEditModal());
        this.editInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveEdit();
            if (e.key === 'Escape') this.closeEditModal();
        });
        
        // Cerrar modal al hacer clic fuera
        this.editModal.addEventListener('click', (e) => {
            if (e.target === this.editModal) this.closeEditModal();
        });
    }
    
    // Agregar nueva tarea
    addTask() {
        const text = this.taskInput.value.trim();
        
        if (!this.validateTask(text)) return;
        
        const task = {
            id: this.generateId(),
            text: text,
            completed: false,
            createdAt: new Date().toISOString()
        };
        
        this.tasks.unshift(task); // Agregar al inicio
        this.taskInput.value = '';
        this.hideError();
        this.saveTasks();
        this.render();
        this.updateCounts();
        
        // Feedback visual
        this.showSuccessAnimation();
    }
    
    // Validar tarea
    validateTask(text) {
        if (!text) {
            this.showError('Por favor, ingresa una tarea');
            return false;
        }
        
        if (text.length > 100) {
            this.showError('La tarea no puede tener más de 100 caracteres');
            return false;
        }
        
        // Verificar si ya existe una tarea similar
        const exists = this.tasks.some(task => 
            task.text.toLowerCase() === text.toLowerCase()
        );
        
        if (exists) {
            this.showError('Ya existe una tarea similar');
            return false;
        }
        
        return true;
    }
    
    // Mostrar error
    showError(message) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.add('show');
        this.taskInput.focus();
        
        setTimeout(() => this.hideError(), 3000);
    }
    
    // Ocultar error
    hideError() {
        this.errorMessage.classList.remove('show');
    }
    
    // Animación de éxito
    showSuccessAnimation() {
        this.addBtn.style.transform = 'scale(1.2)';
        setTimeout(() => {
            this.addBtn.style.transform = 'scale(1)';
        }, 200);
    }
    
    // Alternar completado
    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            task.updatedAt = new Date().toISOString();
            this.saveTasks();
            this.render();
            this.updateCounts();
        }
    }
    
    // Eliminar tarea
    deleteTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task && confirm(`¿Estás seguro de eliminar "${task.text}"?`)) {
            this.tasks = this.tasks.filter(t => t.id !== id);
            this.saveTasks();
            this.render();
            this.updateCounts();
        }
    }
    
    // Abrir modal de edición
    openEditModal(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            this.editingTaskId = id;
            this.editInput.value = task.text;
            this.editModal.classList.add('show');
            this.editInput.focus();
            this.editInput.select();
        }
    }
    
    // Guardar edición
    saveEdit() {
        const newText = this.editInput.value.trim();
        
        if (!newText) {
            this.editInput.focus();
            return;
        }
        
        if (newText.length > 100) {
            alert('La tarea no puede tener más de 100 caracteres');
            return;
        }
        
        const task = this.tasks.find(t => t.id === this.editingTaskId);
        if (task) {
            task.text = newText;
            task.updatedAt = new Date().toISOString();
            this.saveTasks();
            this.render();
        }
        
        this.closeEditModal();
    }
    
    // Cerrar modal de edición
    closeEditModal() {
        this.editModal.classList.remove('show');
        this.editingTaskId = null;
    }
    
    // Establecer filtro
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Actualizar botones activos
        this.filterBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filter);
        });
        
        this.render();
    }
    
    // Obtener tareas filtradas
    getFilteredTasks() {
        switch (this.currentFilter) {
            case 'pending':
                return this.tasks.filter(task => !task.completed);
            case 'completed':
                return this.tasks.filter(task => task.completed);
            default:
                return this.tasks;
        }
    }
    
    // Renderizar tareas
    render() {
        const filteredTasks = this.getFilteredTasks();
        
        if (filteredTasks.length === 0) {
            this.showEmptyState();
        } else {
            this.hideEmptyState();
            this.renderTasks(filteredTasks);
        }
    }
    
    // Renderizar lista de tareas
    renderTasks(tasks) {
        this.tasksList.innerHTML = tasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}" 
                     onclick="todoApp.toggleTask('${task.id}')">
                    ${task.completed ? '✓' : ''}
                </div>
                <div class="task-text ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.text)}</div>
                <div class="task-actions">
                    <button class="task-btn edit-btn" onclick="todoApp.openEditModal('${task.id}')" title="Editar">
                        ✏️
                    </button>
                    <button class="task-btn delete-btn" onclick="todoApp.deleteTask('${task.id}')" title="Eliminar">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    // Mostrar estado vacío
    showEmptyState() {
        this.tasksList.innerHTML = '';
        this.emptyState.classList.remove('hidden');
        
        // Personalizar mensaje según filtro
        const messages = {
            all: 'No hay tareas aún',
            pending: 'No hay tareas pendientes',
            completed: 'No hay tareas completadas'
        };
        
        const h3 = this.emptyState.querySelector('h3');
        h3.textContent = messages[this.currentFilter] || messages.all;
    }
    
    // Ocultar estado vacío
    hideEmptyState() {
        this.emptyState.classList.add('hidden');
    }
    
    // Actualizar contadores
    updateCounts() {
        const all = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = all - completed;
        
        this.allCount.textContent = all;
        this.pendingCount.textContent = pending;
        this.completedCount.textContent = completed;
    }
    
    // Generar ID único
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Escapar HTML para prevenir XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Guardar tareas en localStorage
    saveTasks() {
        try {
            localStorage.setItem('todoApp_tasks', JSON.stringify(this.tasks));
        } catch (error) {
            console.error('Error al guardar tareas:', error);
            alert('Error al guardar las tareas. Verifica el espacio de almacenamiento.');
        }
    }
    
    // Cargar tareas desde localStorage
    loadTasks() {
        try {
            const saved = localStorage.getItem('todoApp_tasks');
            if (saved) {
                this.tasks = JSON.parse(saved);
                
                // Validar estructura de datos
                this.tasks = this.tasks.filter(task => 
                    task && typeof task.id === 'string' && typeof task.text === 'string'
                );
            }
        } catch (error) {
            console.error('Error al cargar tareas:', error);
            this.tasks = [];
        }
    }
    
    // Exportar tareas (funcionalidad extra)
    exportTasks() {
        const data = {
            tasks: this.tasks,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mis-tareas-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // Limpiar tareas completadas
    clearCompleted() {
        const completedCount = this.tasks.filter(t => t.completed).length;
        
        if (completedCount === 0) {
            alert('No hay tareas completadas para eliminar');
            return;
        }
        
        if (confirm(`¿Eliminar ${completedCount} tarea(s) completada(s)?`)) {
            this.tasks = this.tasks.filter(t => !t.completed);
            this.saveTasks();
            this.render();
            this.updateCounts();
        }
    }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoApp();
});

// Manejar errores globales
window.addEventListener('error', (e) => {
    console.error('Error en la aplicación:', e.error);
});

// Prevenir pérdida de datos al cerrar
window.addEventListener('beforeunload', (e) => {
    const pendingTasks = todoApp?.tasks?.filter(t => !t.completed).length || 0;
    if (pendingTasks > 0) {
        e.preventDefault();
        e.returnValue = `Tienes ${pendingTasks} tarea(s) pendiente(s). ¿Estás seguro de salir?`;
    }
}); 