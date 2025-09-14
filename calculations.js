// calculations.js - Pure calculation functions
const FermentationCalculations = {
    // Unit conversions
    baumeToGL: (baume) => baume * 18,
    
    glToBaume: (gl) => gl / 18,
    
    // Additive calculations
    calculateNutrients: (volume, rateGHL) => volume * rateGHL / 100,
    
    calculateEnzymes: (volume, rateGHL) => volume * rateGHL / 100,
    
    calculateSO2: (volume, rateMGL) => volume * rateMGL / 1000,
    
    calculateTannins: (volume, rateGHL) => volume * rateGHL / 100,
    
    calculateBentonite: (volume, rate, unit) => {
        switch(unit) {
            case 'g/L': return volume * rate;
            case 'mg/L': return volume * rate / 1000;
            case 'g/hL': return volume * rate / 100;
            default: return 0;
        }
    },
    
    // pH adjustment calculation
    calculateAcidAddition: (currentPH, targetPH, volume) => {
        if (currentPH <= targetPH) {
            return {
                error: 'Current pH must be higher than target pH',
                valid: false
            };
        }
        
        const diff = currentPH - targetPH;
        const acidPerLiter = diff / 0.1; // Tartaric acid factor
        
        return {
            valid: true,
            perLiter: acidPerLiter,
            total: acidPerLiter * volume,
            acid: 'Tartaric'
        };
    },
    
    // Fermentation analysis
    analyzeFermentationRate: (readings) => {
        const sugarReadings = readings
            .filter(r => r.sugar !== undefined && r.sugar !== null)
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        if (sugarReadings.length < 2) return null;
        
        const rates = [];
        for (let i = 1; i < sugarReadings.length; i++) {
            const timeDiff = new Date(sugarReadings[i].timestamp) - 
                           new Date(sugarReadings[i-1].timestamp);
            const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
            const sugarDiff = sugarReadings[i-1].sugar - sugarReadings[i].sugar;
            
            if (daysDiff > 0) {
                rates.push(sugarDiff / daysDiff);
            }
        }
        
        if (rates.length === 0) return null;
        
        const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
        const currentSugar = sugarReadings[sugarReadings.length - 1].sugar;
        
        return {
            averageRate: avgRate,
            currentSugar: currentSugar,
            rates: rates,
            daysToComplete: currentSugar > 0 ? currentSugar / avgRate : 0
        };
    }
};
