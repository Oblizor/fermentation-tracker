// Wait for the HTML document to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {
    // Get references to the HTML elements we will interact with
    const tankIdInput = document.getElementById('tankId');
    const loadTankBtn = document.getElementById('loadTankData');
    const readingForm = document.getElementById('readingForm');
    const logTableBody = document.getElementById('logTableBody');
    const logTankIdSpan = document.getElementById('logTankId');
    
    let currentTankId = ''; // Variable to store the currently active tank ID

    // Function to render the log entries in the table
    const renderLog = () => {
        // Clear the current table content
        logTableBody.innerHTML = '';
        
        // Get the data for the current tank from localStorage
        const tankData = getTankData(currentTankId);

        // Update the log header to show the current tank ID
        logTankIdSpan.textContent = currentTankId;

        // Loop through each reading and add it as a row to the table
        tankData.forEach((reading, index) => {
            const row = document.createElement('tr');
            
            // Format the timestamp to be more readable
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
        if (!tankId) return []; // Return empty array if no tankId is provided
        const data = localStorage.getItem(tankId);
        // If data exists, parse it from JSON string to an array; otherwise, return an empty array
        return data ? JSON.parse(data) : [];
    };
    
    // Function to save data for a specific tank to localStorage
    const saveTankData = (tankId, data) => {
        // Convert the data array to a JSON string and save it
        localStorage.setItem(tankId, JSON.stringify(data));
    };

    // --- Event Listeners ---

    // Handle the "Load Tank Data" button click
    loadTankBtn.addEventListener('click', () => {
        const tankId = tankIdInput.value.trim();
        if (tankId) {
            currentTankId = tankId;
            renderLog(); // Re-render the log for the new tank
        } else {
            alert('Please enter a Tank ID.');
        }
    });

    // Handle the form submission for a new reading
    readingForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Prevent the page from reloading on submit

        if (!currentTankId) {
            alert('Please load a tank before saving a reading.');
            return;
        }

        // Create a new reading object from the form inputs
        const newReading = {
            timestamp: document.getElementById('timestamp').value,
            temperature: document.getElementById('temperature').value,
            sugar: document.getElementById('sugar').value,
            ph: document.getElementById('ph').value,
            ta: document.getElementById('ta').value,
            notes: document.getElementById('notes').value
        };

        // Get the existing data, add the new reading, and save it back
        const tankData = getTankData(currentTankId);
        tankData.push(newReading);
        // Sort data by timestamp, newest first
        tankData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        saveTankData(currentTankId, tankData);
        
        renderLog(); // Update the table display
        readingForm.reset(); // Clear the form fields
    });

    // Handle clicks on the "Delete" buttons in the table
    logTableBody.addEventListener('click', (event) => {
        if (event.target.classList.contains('delete-btn')) {
            const indexToDelete = parseInt(event.target.getAttribute('data-index'), 10);
            
            if (confirm('Are you sure you want to delete this entry?')) {
                const tankData = getTankData(currentTankId);
                tankData.splice(indexToDelete, 1); // Remove the item at the specified index
                saveTankData(currentTankId, tankData);
                renderLog(); // Re-render the log
            }
        }
    });
    
    // Automatically load the default tank on page load
    loadTankBtn.click();
});
