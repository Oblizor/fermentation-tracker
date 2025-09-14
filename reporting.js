// reporting.js - Professional reporting system
class ReportingEngine {
    constructor(dataManager, tanks) {
        this.dataManager = dataManager;
        this.tanks = tanks;
    }

    generateFermentationReport(tankId, startDate, endDate) {
        const data = this.dataManager.getTankData(tankId);
        const filteredData = data.filter(d => {
            const date = new Date(d.timestamp);
            return date >= new Date(startDate) && date <= new Date(endDate);
        });

        const tank = this.tanks.find(t => t.id === tankId);
        const analysis = FermentationCalculations.analyzeFermentationRate(filteredData);

        return {
            reportId: `RPT-${tankId}-${Date.now()}`,
            generatedAt: new Date().toISOString(),
            reportPeriod: { startDate, endDate },
            tank: {
                id: tankId,
                capacity: tank?.capacity,
                variety: this.dataManager.getTankVariety(tankId),
                description: tank?.description
            },
            summary: {
                totalReadings: filteredData.length,
                fermentationDays: this.calculateFermentationDays(filteredData),
                sugarReduction: this.calculateSugarReduction(filteredData),
                averageTemperature: this.calculateAverage(filteredData, 'temperature'),
                pHRange: this.calculateRange(filteredData, 'ph'),
                completionStatus: this.getCompletionStatus(filteredData)
            },
            analytics: analysis,
            qualityMetrics: this.assessQuality(filteredData),
            recommendations: this.generateRecommendations(filteredData, analysis),
            chartData: this.prepareChartData(filteredData)
        };
    }

    exportToPDF(report) {
        // Using jsPDF library
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text('Fermentation Report', 20, 30);
        
        doc.setFontSize(12);
        doc.text(`Tank: ${report.tank.id}`, 20, 45);
        doc.text(`Period: ${new Date(report.reportPeriod.startDate).toLocaleDateString()} - ${new Date(report.reportPeriod.endDate).toLocaleDateString()}`, 20, 55);
        doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 20, 65);

        // Summary section
        doc.setFontSize(14);
        doc.text('Summary', 20, 85);
        
        doc.setFontSize(10);
        let yPos = 95;
        Object.entries(report.summary).forEach(([key, value]) => {
            doc.text(`${this.formatLabel(key)}: ${value}`, 20, yPos);
            yPos += 10;
        });

        // Quality Assessment
        yPos += 10;
        doc.setFontSize(14);
        doc.text('Quality Assessment', 20, yPos);
        
        yPos += 10;
        doc.setFontSize(10);
        report.qualityMetrics.forEach(metric => {
            doc.text(`• ${metric.parameter}: ${metric.assessment} (${metric.score}/10)`, 20, yPos);
            yPos += 8;
        });

        // Recommendations
        yPos += 15;
        doc.setFontSize(14);
        doc.text('Recommendations', 20, yPos);
        
        yPos += 10;
        doc.setFontSize(10);
        report.recommendations.forEach((rec, index) => {
            const lines = doc.splitTextToSize(`${index + 1}. ${rec}`, 170);
            doc.text(lines, 20, yPos);
            yPos += lines.length * 6 + 5;
        });

        // Save the PDF
        doc.save(`fermentation-report-${report.tank.id}-${new Date().toISOString().split('T')[0]}.pdf`);
    }

    calculateFermentationDays(data) {
        if (data.length < 2) return 0;
        const sorted = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const start = new Date(sorted[0].timestamp);
        const end = new Date(sorted[sorted.length - 1].timestamp);
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }

    assessQuality(data) {
        const metrics = [];
        
        // Temperature stability
        const temps = data.filter(d => d.temperature !== undefined).map(d => d.temperature);
        if (temps.length > 0) {
            const tempStability = this.calculateStandardDeviation(temps);
            metrics.push({
                parameter: 'Temperature Stability',
                score: Math.max(1, 10 - tempStability),
                assessment: tempStability < 2 ? 'Excellent' : tempStability < 4 ? 'Good' : 'Needs Attention'
            });
        }

        // pH consistency
        const pHs = data.filter(d => d.ph !== undefined).map(d => d.ph);
        if (pHs.length > 0) {
            const pHStability = this.calculateStandardDeviation(pHs);
            metrics.push({
                parameter: 'pH Consistency',
                score: Math.max(1, 10 - pHStability * 10),
                assessment: pHStability < 0.1 ? 'Excellent' : pHStability < 0.2 ? 'Good' : 'Needs Attention'
            });
        }

        return metrics;
    }

    generateRecommendations(data, analysis) {
        const recommendations = [];
        
        if (analysis && analysis.averageRate < 0.5) {
            recommendations.push('Consider checking yeast viability and nutrient levels due to slow fermentation rate');
        }
        
        if (analysis && analysis.averageRate > 3) {
            recommendations.push('Monitor temperature closely as fermentation rate is very rapid');
        }

        const temps = data.filter(d => d.temperature !== undefined).map(d => d.temperature);
        if (temps.length > 0) {
            const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
            if (avgTemp < 12) {
                recommendations.push('Consider increasing fermentation temperature to improve yeast activity');
            }
            if (avgTemp > 28) {
                recommendations.push('Reduce fermentation temperature to prevent yeast stress and off-flavors');
            }
        }

        return recommendations;
    }

    calculateSugarReduction(data) {
        if (data.length < 2) return 0;
        const sorted = data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        return sorted[0].sugar - sorted[sorted.length - 1].sugar;
    }

    calculateAverage(data, field) {
        const values = data.filter(d => d[field] !== undefined).map(d => d[field]);
        if (!values.length) return 0;
        return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
    }

    calculateRange(data, field) {
        const values = data.filter(d => d[field] !== undefined).map(d => d[field]);
        if (!values.length) return 'N/A';
        const min = Math.min(...values);
        const max = Math.max(...values);
        return `${min.toFixed(2)} - ${max.toFixed(2)}`;
    }

    getCompletionStatus(data) {
        const latest = data[data.length - 1];
        return latest && latest.sugar <= 0 ? 'Complete' : 'In Progress';
    }

    calculateStandardDeviation(values) {
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
        return Math.sqrt(variance);
    }

    prepareChartData(data) {
        return data.map(d => ({
            timestamp: d.timestamp,
            sugar: d.sugar,
            temperature: d.temperature,
            ph: d.ph
        }));
    }

    formatLabel(label) {
        return label.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }
}
