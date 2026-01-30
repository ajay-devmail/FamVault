const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    name: String,
    relationship: String, // e.g., "Doctor", "Spouse"
    phone: String,
    isEmergencyService: { type: Boolean, default: false } // To distinguish 911 vs Mom
});

module.exports = mongoose.model("contact", contactSchema);
