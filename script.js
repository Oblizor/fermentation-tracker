// --- ALL YOUR TANK DATA LIVES HERE ---
// I've converted your list into a format JavaScript can understand.
const tanks = [
    // Cu manta
    { id: 'R1', capacity: 3528, description: 'Inox, manta' },
    { id: 'R2', capacity: 3911, description: 'Inox, manta' },
    { id: 'R3', capacity: 3528, description: 'Inox, manta' },
    { id: 'R4', capacity: 3528, description: 'Inox, manta' },
    { id: 'R5', capacity: 3528, description: 'Inox, manta' },
    { id: 'R6', capacity: 3911, description: 'Inox, manta' },
    { id: 'R7', capacity: 8133, description: 'Vinificator roșu, manta încălzire + piston + pompă remontaj' },
    { id: 'R8', capacity: 8133, description: 'Vinificator roșu, manta încălzire + piston + pompă remontaj' },
    { id: 'R9', capacity: 2966, description: 'Inox, manta' },
    { id: 'R10', capacity: 2181, description: 'Inox, manta' },
    { id: 'R11', capacity: 2017, description: 'Inox, manta' },
    { id: 'R12', capacity: 1684, description: 'Inox, manta' },
    { id: 'R13', capacity: 2631, description: 'Inox, manta' },
    { id: 'R14', capacity: 2609, description: 'Inox, manta' },
    { id: 'R15', capacity: 3424, description: 'Inox, manta' },
    { id: 'R16', capacity: 3424, description: 'Inox, manta' },
    { id: 'R17', capacity: 3435, description: 'Inox, manta' },
    { id: 'R18', capacity: 3436, description: 'Inox, manta' },
    { id: 'R34', capacity: 5295, description: 'Inox, manta' },
    { id: 'R35', capacity: 5295, description: 'Inox, manta' },
    { id: 'R36', capacity: 5295, description: 'Inox, manta' },
    { id: 'R37', capacity: 5295, description: 'Inox, manta' },
    { id: 'R39', capacity: 5295, description: 'Inox, manta' },
    { id: 'R40', capacity: 5295, description: 'Inox, manta' },
    { id: 'R41', capacity: 5295, description: 'Inox, manta' },
    { id: 'R43', capacity: 5295, description: 'Inox, manta' },
    { id: 'R44', capacity: 5295, description: 'Inox, manta' },
    { id: 'R45', capacity: 5295, description: 'Inox, manta' },
    { id: 'R46', capacity: 5295, description: 'Inox, manta' },
    // Fără manta
    { id: 'R19', capacity: 4216, description: 'Inox, fără manta' },
    { id: 'R20', capacity: 4216, description: 'Inox, fără manta' },
    { id: 'R21', capacity: 4216, description: 'Inox, fără manta' },
    { id: 'R22', capacity: 4216, description: 'Inox, fără manta' },
    { id: 'R23', capacity: 4216, description: 'Inox, fără manta' },
    { id: 'R24', capacity: 4216, description: 'Inox, fără manta' },
    { id: 'R25', capacity: 4216, description: 'Inox, fără manta' },
    { id: 'R26', capacity: 5106, description: 'Inox, fără manta' },
    { id: 'R27', capacity: 1587, description: 'Inox, fără manta' },
    { id: 'R28', capacity: 1584, description: 'Inox, fără manta' },
    { id: 'R29', capacity: 5243, description: 'Inox, fără manta' },
    { id: 'R30', capacity: 3435, description: 'Inox, fără manta' },
    { id: 'R31', capacity: 3422, description: 'Inox, fără manta' },
    { id: 'R32', capacity: 1054, description: 'Inox, fără manta' },
    { id: 'R33', capacity: 1000, description: 'Inox, fără manta' },
    { id: 'R38', capacity: 3250, description: 'Inox, fără manta' },
    { id: 'R42', capacity: 1180, description: 'Inox, fără manta' },
    // Mari (afară)
    { id: 'R47', capacity: 4900, description: 'Inox, afară, fără manta' },
    { id: 'R48', capacity: 10200, description: 'Inox, afară, fără manta' },
    { id: 'R49', capacity: 10200, description: 'Inox, afară, fără manta' }
];

// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
    // Get references to the HTML elements
    const tankSelect = document.getElementById('tankSelect');
    const tankDetailsP = document.getElementById('tankDetails');
    const readingForm = document.getElementById('readingForm');
    const logTableBody = document.getElementById('logTableBody');
    const logTankIdSpan = document.getElementById('logTankId');
    const submitButton = readingForm.querySelector('button[type="submit"]');
    
    let currentTankId = ''; // Variable to store the currently active tank ID
    let editingIndex = null; // Track which log entry is being edited

    // ---- NEW: Function to populate the dropdown menu ----
    const populateTankSelector = () => {
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

          readingForm.reset();
          submitButton.textContent = 'Save Reading';
          editingIndex = null;

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
                  <td>
                      <button class="edit-btn" data-index="${index}">Edit</button>
                      <button class="delete-btn" data-index="${index}">Delete</button>
                  </td>
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

          if (editingIndex !== null) {
              tankData[editingIndex] = newReading;
              editingIndex = null;
              submitButton.textContent = 'Save Reading';
          } else {
              tankData.push(newReading);
          }

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
                  tankData.splice(indexToDelete, 1);
                  saveTankData(currentTankId, tankData);
                  renderLog();
              }
          } else if (event.target.classList.contains('edit-btn')) {
              const indexToEdit = parseInt(event.target.getAttribute('data-index'), 10);
              const tankData = getTankData(currentTankId);
              const reading = tankData[indexToEdit];

              document.getElementById('timestamp').value = reading.timestamp;
              document.getElementById('temperature').value = reading.temperature || '';
              document.getElementById('sugar').value = reading.sugar || '';
              document.getElementById('ph').value = reading.ph || '';
              document.getElementById('ta').value = reading.ta || '';
              document.getElementById('notes').value = reading.notes || '';

              editingIndex = indexToEdit;
              submitButton.textContent = 'Update Reading';
          }
      });
    
    // --- Initial Setup ---
    populateTankSelector(); // Fill the dropdown with your tanks
    handleTankSelection(); // Load the data for the first tank in the list by default
});
