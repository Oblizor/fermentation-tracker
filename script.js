// Tank data will be loaded from an external JSON file

// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Get references to the HTML elements
    const tankSelect = document.getElementById('tankSelect');
    const tankDetailsP = document.getElementById('tankDetails');
    const readingForm = document.getElementById('readingForm');
    const logTableBody = document.getElementById('logTableBody');
    const logTankIdSpan = document.getElementById('logTankId');
    
    let currentTankId = ''; // Variable to store the currently active tank ID
    let tanks = []; // Will hold the tank list loaded from JSON

    // ---- NEW: Function to populate the dropdown menu ----
    const populateTankSelector = () => {
        tankSelect.innerHTML = '';
        tanks.forEach(tank => {
            const option = document.createElement('option');
            option.value = tank.id;
            option.textContent = `${tank.id} (${tank.capacity} L)`;
            tankSelect.appendChild(option);
        });
    };
    
    // ---- NEW: Function to handle when a new tank is selected ----
    const handleTankSelection = () => {
        currentTankId = tankSelect.value;
        const selectedTank = tanks.find(tank => tank.id === currentTankId);

        if (selectedTank) {
            tankDetailsP.textContent = `Capacity: ${selectedTank.capacity} L. Details: ${selectedTank.description}`;
        } else {
            tankDetailsP.textContent = '';
        }
        
        renderLog(); // Load and display the log for the selected tank
    };

    // Function to render the log entries in the table
    const renderLog = () => {
        logTableBody.innerHTML = '';
        const tankData = getTankData(currentTankId);
        logTankIdSpan.textContent = currentTankId;

        tankData.forEach((reading, index) => {
            const row = document.createElement('tr');
            const formattedTimestamp = new Date(reading.timestamp).toLocaleString();
            
            row.innerHTML = `
                <td>${formattedTimestamp}</td>
                <td>${reading.temperature || ''}</td>
                <td>${reading.sugar || ''}</td>
                <td>${reading.ph || ''}</td>
                <td>${reading.ta || ''}</td>
                <td>${reading.notes || ''}</td>
                <td><button class="delete-btn" data-index="${index}">Delete</button></td>
            `;
            
            logTableBody.appendChild(row);
        });
    };

    // Function to get data for a specific tank from localStorage
    const getTankData = (tankId) => {
        if (!tankId) return [];
        const data = localStorage.getItem(tankId);
        return data ? JSON.parse(data) : [];
    };
    
    // Function to save data for a specific tank to localStorage
    const saveTankData = (tankId, data) => {
        localStorage.setItem(tankId, JSON.stringify(data));
    };

    // --- Event Listeners ---

    // NEW: Listen for changes on the dropdown menu
    tankSelect.addEventListener('change', handleTankSelection);

    // Handle the form submission for a new reading
    readingForm.addEventListener('submit', (event) => {
        event.preventDefault(); 

        if (!currentTankId) {
            alert('Please select a tank from the dropdown.');
            return;
        }

        const newReading = {
            timestamp: document.getElementById('timestamp').value,
            temperature: document.getElementById('temperature').value,
            sugar: document.getElementById('sugar').value,
            ph: document.getElementById('ph').value,
            ta: document.getElementById('ta').value,
            notes: document.getElementById('notes').value
        };

        const tankData = getTankData(currentTankId);
        tankData.push(newReading);
        tankData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        saveTankData(currentTankId, tankData);
        
        renderLog(); 
        readingForm.reset();
    });

    // Handle clicks on the "Delete" buttons
    logTableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const indexToDelete = parseInt(event.target.getAttribute('data-index'), 10);
            
            if (confirm('Are you sure you want to delete this entry?')) {
                const tankData = getTankData(currentTankId);
                const originalIndex = tankData.length - 1 - indexToDelete;
                tankData.splice(originalIndex, 1);
                saveTankData(currentTankId, tankData);
                renderLog();
            }
        }
    });
    
    // --- Initial Setup ---
    try {
        const response = await fetch('tanks.json');
        tanks = await response.json();
        populateTankSelector();
        handleTankSelection();
    } catch (error) {
        console.error('Failed to load tanks:', error);
    }
});
