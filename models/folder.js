const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    user: { // Changed from userId to user to match document model consistency
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', 
        required: true
    },
    category: { 
        type: String, 
        enum: ['document', 'medical'], 
        default: 'document' 
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('folder', folderSchema);
