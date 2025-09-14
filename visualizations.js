// Enhanced visualizations.js - Advanced chart rendering and analytics
class VisualizationEngine {
    constructor() {
        this.charts = new Map();
        this.colorPalette = {
            primary: '#4a6da7',
            secondary: '#667eea',
            accent: '#764ba2',
            warning: '#ffc107',
            critical: '#dc3545',
            success: '#28a745'
        };
    }

    renderFermentationCurve(containerId, tankId, dataManager) {
        const data = dataManager.getTankData(tankId);
        const sugarData = data.filter(d => d.sugar !== undefined)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (sugarData.length < 2) return;

        const ctx = document.getElementById(containerId)?.getContext('2d');
        if (!ctx) return;

        const chartData = {
            labels: sugarData.map(d => new Date(d.timestamp).toLocaleDateString()),
            datasets: [{
                label: 'Sugar (Baumé)',
                data: sugarData.map(d => d.sugar),
                borderColor: this.colorPalette.primary,
                backgroundColor: this.colorPalette.primary + '20',
                fill: true,
                tension: 0.4
            }]
        };

        // Calculate trend line
        const trendLine = this.calculateTrendLine(sugarData);
        if (trendLine) {
            chartData.datasets.push({
                label: 'Trend',
                data: trendLine.data,
                borderColor: this.colorPalette.accent,
                borderDash: [5, 5],
                fill: false,
                pointRadius: 0
            });
        }

        // Predictive completion line
        const prediction = this.predictCompletion(sugarData);
        if (prediction) {
            chartData.datasets.push({
                label: 'Predicted Completion',
                data: prediction.data,
                borderColor: this.colorPalette.warning,
                borderDash: [2, 8],
                fill: false,
                pointRadius: 0
            });
        }

        this.createChart(containerId, 'line', chartData, {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `Fermentation Curve - Tank ${tankId}`
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        afterBody: (context) => {
                            const point = context[0];
                            const reading = sugarData[point.dataIndex];
                            return [
                                `Temperature: ${reading.temperature || 'N/A'}°C`,
                                `pH: ${reading.ph || 'N/A'}`,
                                `SG: ${reading.sg || 'N/A'}`
                            ];
                        }
                    }
                }
            },
            scales: {
                y: {
                    title: {
                        display: true,
                        text: 'Sugar (Baumé)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        });
    }

    calculateTrendLine(data) {
        if (data.length < 3) return null;
        
        const n = data.length;
        const sumX = data.reduce((sum, d, i) => sum + i, 0);
        const sumY = data.reduce((sum, d) => sum + d.sugar, 0);
        const sumXY = data.reduce((sum, d, i) => sum + (i * d.sugar), 0);
        const sumXX = data.reduce((sum, d, i) => sum + (i * i), 0);
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        return {
            data: data.map((d, i) => slope * i + intercept),
            slope,
            intercept
        };
    }

    predictCompletion(data) {
        const trend = this.calculateTrendLine(data);
        if (!trend || trend.slope >= 0) return null;
        
        const lastIndex = data.length - 1;
        const daysToZero = Math.ceil(-trend.intercept / trend.slope) - lastIndex;
        
        if (daysToZero <= 0) return null;
        
        const prediction = [];
        for (let i = 0; i <= daysToZero + 2; i++) {
            prediction.push(Math.max(0, trend.slope * (lastIndex + i) + trend.intercept));
        }
        
        return {
            data: data.map(d => null).concat(prediction),
            daysToCompletion: daysToZero
        };
    }

    renderMultiParameterDashboard(containerId, tankId, dataManager) {
        const data = dataManager.getTankData(tankId);
        const recent = data.slice(0, 20).reverse();
        
        const ctx = document.getElementById(containerId)?.getContext('2d');
        if (!ctx) return;

        this.createChart(containerId, 'line', {
            labels: recent.map(d => new Date(d.timestamp).toLocaleDateString()),
            datasets: [
                {
                    label: 'Temperature (°C)',
                    data: recent.map(d => d.temperature),
                    borderColor: this.colorPalette.critical,
                    yAxisID: 'y'
                },
                {
                    label: 'pH',
                    data: recent.map(d => d.ph ? d.ph * 10 : null), // Scale for visibility
                    borderColor: this.colorPalette.success,
                    yAxisID: 'y1'
                },
                {
                    label: 'Sugar (Baumé)',
                    data: recent.map(d => d.sugar),
                    borderColor: this.colorPalette.primary,
                    yAxisID: 'y2'
                }
            ]
        }, {
            responsive: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Date'
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'pH (×10)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                },
                y2: {
                    type: 'linear',
                    display: false
                }
            }
        });
    }

    createChart(containerId, type, data, options) {
        if (this.charts.has(containerId)) {
            this.charts.get(containerId).destroy();
        }

        const ctx = document.getElementById(containerId)?.getContext('2d');
        if (!ctx) return;

        const chart = new Chart(ctx, {
            type,
            data,
            options
        });

        this.charts.set(containerId, chart);
        return chart;
    }
}
