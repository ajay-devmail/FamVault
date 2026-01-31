const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user', // Ensure this matches your userModel name
        required: true
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Folder', folderSchema);
