// validator.js - Input validation rules
class Validator {
    static rules = {
        temperature: { 
            min: -5, 
            max: 40, 
            step: 0.1,
            name: 'Temperature',
            unit: '°C'
        },
        ph: { 
            min: 2.8, 
            max: 4.2, 
            step: 0.01,
            name: 'pH'
        },
        sugar: { 
            min: 0, 
            max: 30, 
            step: 0.1,
            name: 'Sugar',
            unit: 'Baumé'
        },
        sg: {
            min: 0.980,
            max: 1.200,
            step: 0.001,
            name: 'Specific Gravity'
        },
        ta: {
            min: 0,
            max: 20,
            step: 0.1,
            name: 'Total Acidity',
            unit: 'g/L'
        },
        volume: { 
            min: 0, 
            max: 100000, 
            step: 0.1,
            name: 'Volume',
            unit: 'L'
        }
    };

    static validate(field, value) {
        const rule = this.rules[field];
        if (!rule) return { valid: true, value };
        
        // Allow empty values (optional fields)
        if (value === '' || value === null || value === undefined) {
            return { valid: true, value: null };
        }
        
        const numValue = parseFloat(value);
        
        if (isNaN(numValue)) {
            return { 
                valid: false, 
                error: `${rule.name} must be a number` 
            };
        }
        
        if (numValue < rule.min) {
            return { 
                valid: false, 
                error: `${rule.name} must be at least ${rule.min}${rule.unit ? ' ' + rule.unit : ''}` 
            };
        }
        
        if (numValue > rule.max) {
            return { 
                valid: false, 
                error: `${rule.name} must be at most ${rule.max}${rule.unit ? ' ' + rule.unit : ''}` 
            };
        }
        
        return { valid: true, value: numValue };
    }

    static validateForm(formData) {
        const errors = [];
        const validated = {};
        let hasValidData = false;
        
        // Timestamp is required
        if (!formData.timestamp) {
            errors.push('Date & Time is required');
        } else {
            validated.timestamp = formData.timestamp;
        }
        
        // Validate numeric fields
        const numericFields = ['temperature', 'sugar', 'sg', 'ph', 'ta', 'volume'];
        
        for (const field of numericFields) {
            if (field in formData) {
                const result = this.validate(field, formData[field]);
                
                if (!result.valid) {
                    errors.push(result.error);
                } else if (result.value !== null) {
                    validated[field] = result.value;
                    hasValidData = true;
                }
            }
        }
        
        // Notes are always valid
        if (formData.notes) {
            validated.notes = formData.notes;
            hasValidData = true;
        }
        
        // Must have at least one data point besides timestamp
        if (!hasValidData) {
            errors.push('Please enter at least one measurement or note');
        }
        
        return { 
            valid: errors.length === 0, 
            errors, 
            data: validated 
        };
    }

    static getWarnings(field, value) {
        const warnings = [];
        
        if (field === 'temperature' && value !== null) {
            if (value < 10) warnings.push('Low temperature may slow fermentation');
            if (value > 25) warnings.push('High temperature may stress yeast');
            if (value > 30) warnings.push('Critical: Temperature too high for fermentation');
        }
        
        if (field === 'ph' && value !== null) {
            if (value < 3.0) warnings.push('Very low pH - consider adjustment');
            if (value > 3.8) warnings.push('High pH - monitor for spoilage');
        }
        
        if (field === 'sugar' && value !== null) {
            if (value < 2 && value > 0) warnings.push('Fermentation nearly complete');
            if (value === 0) warnings.push('Fermentation complete - ready for next stage');
        }
        
        return warnings;
    }
}
