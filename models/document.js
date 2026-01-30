const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    title: String,
    category: { 
        type: String, 
        enum: ['document', 'medical'], 
        default: 'document' 
    },
    filename: String, // The actual file name on disk
    originalName: String,
    path: String,
    fileType: String, // 'pdf', 'png', etc.
    size: Number, // in bytes
    
    // Reminder Logic
    hasReminder: { type: Boolean, default: false },
    reminderDate: Date,
    reminderNote: String, // e.g., "Renew Insurance"
    
    // Tracking
    createdAt: { type: Date, default: Date.now },
    lastAccessed: { type: Date, default: Date.now } // For "Recently Opened"
});

module.exports = mongoose.model("document", documentSchema);
