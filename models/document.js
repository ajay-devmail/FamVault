const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    title: String,
    category: { type: String, enum: ['document', 'medical'], default: 'document' },
    filename: String,
    originalName: String,
    path: String,
    fileType: String,
    size: Number,
    hasReminder: { type: Boolean, default: false },
    reminderDate: Date,
    reminderNote: String,
    createdAt: { type: Date, default: Date.now },
    lastAccessed: { type: Date, default: Date.now },
    
    // Updated Folder Reference
    folder: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'folder', 
        default: null 
    }
});

module.exports = mongoose.model("document", documentSchema);
