// Tank data will be loaded from an external JSON file

// Wait for the HTML document to be fully loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Get references to the HTML elements
    const tankSelect = document.getElementById('tankSelect');
    const tankDetailsP = document.getElementById('tankDetails');
    const readingForm = document.getElementById('readingForm');
    const logTableBody = document.getElementById('logTableBody');
    const logTankIdSpan = document.getElementById('logTankId');
    const exportJsonBtn = document.getElementById('exportJsonBtn');
    const exportCsvBtn = document.getElementById('exportCsvBtn');
    const importJsonBtn = document.getElementById('importJsonBtn');
    const importCsvBtn = document.getElementById('importCsvBtn');
    const importFileInput = document.getElementById('importFile');
    const submitBtn = readingForm.querySelector('button[type="submit"]');

    let currentTankId = ''; // Variable to store the currently active tank ID
    let tanks = []; // Will hold the tank list loaded from JSON
    let editingIndex = null; // Track index of reading being edited
    let importFormat = null; // Track desired import format

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
        readingForm.reset();
        editingIndex = null;
        submitBtn.textContent = 'Save Reading';
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

    const toCSV = (data) => {
        if (!data.length) return '';
        const headers = Object.keys(data[0]);
        const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const parseCSV = (text) => {
        const [headerLine, ...lines] = text.trim().split(/\r?\n/);
        const headers = headerLine.split(',');
        return lines.filter(l => l.trim()).map(line => {
            const values = line.split(',');
            const entry = {};
            headers.forEach((h, i) => {
                let value = values[i];
                if (value) {
                    value = value.replace(/^"|"$/g, '');
                }
                entry[h] = value;
            });
            return entry;
        });
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

        const timestamp = document.getElementById('timestamp').value.trim();
        const notes = document.getElementById('notes').value;

        const rawValues = {
            temperature: document.getElementById('temperature').value.trim(),
            sugar: document.getElementById('sugar').value.trim(),
            ph: document.getElementById('ph').value.trim(),
            ta: document.getElementById('ta').value.trim(),
        };

        const newReading = { timestamp, notes };

        for (const [key, val] of Object.entries(rawValues)) {
            if (val === '') continue;
            const parsed = parseFloat(val);
            if (Number.isNaN(parsed)) {
                alert(`Please enter a valid ${key}.`);
                return;
            }
            newReading[key] = parsed;
        }

        const tankData = getTankData(currentTankId);
        if (editingIndex !== null) {
            tankData[editingIndex] = newReading;
        } else {
            tankData.push(newReading);
        }
        tankData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        saveTankData(currentTankId, tankData);

        renderLog();
        readingForm.reset();
        editingIndex = null;
        submitBtn.textContent = 'Save Reading';
    });

    // Handle clicks on the Edit and Delete buttons
    logTableBody.addEventListener('click', (event) => {
        const index = parseInt(event.target.getAttribute('data-index'), 10);

        if (event.target.classList.contains('edit-btn')) {
            const tankData = getTankData(currentTankId);
            const entry = tankData[index];
            document.getElementById('timestamp').value = entry.timestamp;
            document.getElementById('temperature').value = entry.temperature ?? '';
            document.getElementById('sugar').value = entry.sugar ?? '';
            document.getElementById('ph').value = entry.ph ?? '';
            document.getElementById('ta').value = entry.ta ?? '';
            document.getElementById('notes').value = entry.notes ?? '';
            editingIndex = index;
            submitBtn.textContent = 'Update Reading';
        } else if (event.target.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this entry?')) {
                const tankData = getTankData(currentTankId);
                tankData.splice(index, 1);
                saveTankData(currentTankId, tankData);
                renderLog();
            }
        }
    });

      const handleExport = (format) => {
          if (!currentTankId) {
              alert('Please select a tank from the dropdown.');
              return;
          }
          const tankData = getTankData(currentTankId);
          if (tankData.length === 0) {
              alert('No data to export for this tank.');
              return;
          }
          let content, mime, ext;
          if (format === 'csv') {
              content = toCSV(tankData);
              mime = 'text/csv';
              ext = 'csv';
          } else {
              content = JSON.stringify(tankData, null, 2);
              mime = 'application/json';
              ext = 'json';
          }
          const blob = new Blob([content], { type: mime });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${currentTankId}_log.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
      };

      exportJsonBtn.addEventListener('click', () => handleExport('json'));
      exportCsvBtn.addEventListener('click', () => handleExport('csv'));

      importJsonBtn.addEventListener('click', () => {
          if (!currentTankId) {
              alert('Please select a tank from the dropdown.');
              return;
          }
          importFormat = 'json';
          importFileInput.click();
      });

      importCsvBtn.addEventListener('click', () => {
          if (!currentTankId) {
              alert('Please select a tank from the dropdown.');
              return;
          }
          importFormat = 'csv';
          importFileInput.click();
      });

      importFileInput.addEventListener('change', (event) => {
          const file = event.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
              try {
                  let imported;
                  if (importFormat === 'csv' || file.name.toLowerCase().endsWith('.csv')) {
                      imported = parseCSV(e.target.result);
                  } else {
                      imported = JSON.parse(e.target.result);
                  }
                  if (!Array.isArray(imported)) throw new Error('Invalid file format');

                  const tankData = getTankData(currentTankId);
                  const numericFields = ['temperature', 'sugar', 'ph', 'ta'];

                  imported.forEach(entry => {
                      numericFields.forEach(field => {
                          if (entry[field] !== undefined && entry[field] !== '') {
                              const num = parseFloat(entry[field]);
                              if (!Number.isNaN(num)) {
                                  entry[field] = num;
                              }
                          }
                      });
                      tankData.push(entry);
                  });

                  tankData.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                  saveTankData(currentTankId, tankData);
                  renderLog();
                  alert('Import successful!');
              } catch (err) {
                  alert('Failed to import file: ' + err.message);
              }
          };
          reader.readAsText(file);
          event.target.value = '';
          importFormat = null;
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
