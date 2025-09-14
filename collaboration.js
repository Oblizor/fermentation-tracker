// collaboration.js - Real-time team collaboration
class CollaborationManager {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.activeUsers = new Map();
        this.comments = new Map();
        this.workflowTasks = new Map();
    }

    addComment(tankId, comment) {
        const tankComments = this.comments.get(tankId) || [];
        const newComment = {
            id: Date.now(),
            text: comment.text,
            author: comment.author || 'Anonymous',
            timestamp: new Date().toISOString(),
            type: comment.type || 'note', // note, alert, instruction
            priority: comment.priority || 'normal'
        };

        tankComments.push(newComment);
        this.comments.set(tankId, tankComments);
        
        // Save to localStorage
        localStorage.setItem(`comments_${tankId}`, JSON.stringify(tankComments));
        
        this.renderCommentsForTank(tankId);
    }

    createWorkflowTask(tankId, task) {
        const tankTasks = this.workflowTasks.get(tankId) || [];
        const newTask = {
            id: Date.now(),
            title: task.title,
            description: task.description,
            assignee: task.assignee,
            dueDate: task.dueDate,
            priority: task.priority || 'medium',
            status: 'pending',
            createdAt: new Date().toISOString(),
            type: task.type // analysis, addition, monitoring, maintenance
        };

        tankTasks.push(newTask);
        this.workflowTasks.set(tankId, tankTasks);
        
        localStorage.setItem(`tasks_${tankId}`, JSON.stringify(tankTasks));
        
        this.renderTasksForTank(tankId);
    }

    renderCommentsForTank(tankId) {
        const container = document.getElementById(`comments-${tankId}`);
        if (!container) return;

        const comments = this.comments.get(tankId) || [];
        
        container.innerHTML = `
            <div class="comments-header">
                <h4>Team Notes & Observations</h4>
                <button class="add-comment-btn" onclick="collaboration.showCommentDialog('${tankId}')">
                    + Add Note
                </button>
            </div>
            <div class="comments-list">
                ${comments.map(comment => `
                    <div class="comment comment-${comment.type} priority-${comment.priority}">
                        <div class="comment-header">
                            <span class="comment-author">${comment.author}</span>
                            <span class="comment-time">${new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <div class="comment-text">${comment.text}</div>
                        ${comment.type === 'instruction' ? '<div class="comment-action">Action Required</div>' : ''}
                    </div>
                `).join('')}
            </div>
        `;
    }

    showCommentDialog(tankId) {
        const dialog = document.createElement('div');
        dialog.className = 'comment-dialog-overlay';
        dialog.innerHTML = `
            <div class="comment-dialog">
                <h3>Add Team Note - Tank ${tankId}</h3>
                <textarea id="comment-text" placeholder="Enter your observation, note, or instruction..."></textarea>
                <div class="comment-options">
                    <select id="comment-type">
                        <option value="note">General Note</option>
                        <option value="alert">Alert/Warning</option>
                        <option value="instruction">Instruction</option>
                    </select>
                    <select id="comment-priority">
                        <option value="low">Low Priority</option>
                        <option value="normal" selected>Normal</option>
                        <option value="high">High Priority</option>
                        <option value="urgent">Urgent</option>
                    </select>
                </div>
                <div class="comment-actions">
                    <button onclick="this.closest('.comment-dialog-overlay').remove()">Cancel</button>
                    <button onclick="collaboration.submitComment('${tankId}')">Add Note</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
    }

    submitComment(tankId) {
        const text = document.getElementById('comment-text').value;
        const type = document.getElementById('comment-type').value;
        const priority = document.getElementById('comment-priority').value;

        if (!text.trim()) return;

        this.addComment(tankId, {
            text: text.trim(),
            type,
            priority,
            author: localStorage.getItem('username') || 'User'
        });

        document.querySelector('.comment-dialog-overlay').remove();
    }
}
