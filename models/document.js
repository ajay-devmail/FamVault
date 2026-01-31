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

        // Add this inside your documentSchema
folderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'folder',
        default: null // If null, the document is in the "General" area
    },
});

module.exports = mongoose.model("document", documentSchema);
