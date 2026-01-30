require("dotenv").config();
const express = require("express");
const app = express();
const cookieParser = require("cookie-parser");
const bcryptjs = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- IMPORT MODELS ---
const userModel = require("./models/user");
const postModel = require("./models/post"); // Keep if you still need it
const docModel = require("./models/document"); // NEW
const contactModel = require("./models/contact"); // NEW

// --- DATABASE CONNECTION ---
mongoose.connect("mongodb://127.0.0.1:27017/famvoult")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// --- MIDDLEWARE ---
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));

// --- MULTER CONFIG (File Uploads) ---
// 1. Ensure 'public/uploads' directory exists
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Configure Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './public/uploads');
    },
    filename: function (req, file, cb) {
        // Create unique filename: timestamp-random.ext
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- MAIL CONFIG ---
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

/* ====================== AUTH MIDDLEWARE ====================== */
function isLoggedIn(req, res, next) {
    if (!req.cookies.token) return res.redirect("/login");
    try {
        const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.clearCookie("token");
        res.redirect("/login");
    }
}

/* ====================== ROUTES ====================== */

// 1. LANDING & AUTH
app.get("/", (req, res) => {
    res.render("landingpage");
});

app.get("/register", (req, res) => {
    if (req.cookies.token) return res.redirect("/overview");
    res.render("register");
});

app.get("/login", (req, res) => {
    if (req.cookies.token) return res.redirect("/overview");
    res.render("login", { message: req.query.message || null });
});

app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

// REGISTER LOGIC
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        let user = await userModel.findOne({ email });

        if (user && user.isVerified) return res.redirect("/login?message=Email already exists");

        const hashPassword = await bcryptjs.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOTP = await bcryptjs.hash(otp, 10);

        if (user) {
            user.password = hashPassword;
            user.otp = hashedOTP;
            user.otpExpires = Date.now() + 3600000;
            await user.save();
        } else {
            await userModel.create({
                name, email,
                password: hashPassword,
                otp: hashedOTP,
                otpExpires: Date.now() + 3600000
            });
        }

        await transporter.sendMail({
            to: email,
            subject: "Verify Your FamVault Account",
            html: `<h3>Your Verification Code: ${otp}</h3>`
        });

        res.render("verify-otp", { email: email });
    } catch (err) {
        console.error(err);
        res.status(500).send("Registration Error");
    }
});

// VERIFY OTP
app.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await userModel.findOne({ email });
        if (!user) return res.send("User not found.");

        if (user.otpExpires < Date.now()) return res.send("❌ OTP expired.");

        const validOTP = await bcryptjs.compare(otp, user.otp);
        if (!validOTP) return res.send("❌ Invalid code.");

        await userModel.updateOne({ email }, { isVerified: true, $unset: { otp: 1, otpExpires: 1 } });
        res.redirect("/login?message=Verified! You can now login.");
    } catch (err) {
        res.status(500).send("Verification Error");
    }
});

// LOGIN LOGIC
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });

    if (!user) return res.redirect("/login?message=User not found");
    if (!user.isVerified) return res.send("Please verify your account first.");

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) return res.redirect("/login?message=Wrong password");

    const token = jwt.sign({ email: user.email, userid: user._id }, process.env.JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/overview");
});

/* ====================== DASHBOARD & FEATURES ====================== */

// 2. DASHBOARD (overview)
app.get("/overview", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        // Fetch stats
        const totalDocs = await docModel.countDocuments({ user: user._id });
        const medicalDocs = await docModel.countDocuments({ user: user._id, category: 'medical' });
        const contactsCount = await contactModel.countDocuments({ user: user._id });

        // Recent Documents (Sorted by lastAccessed)
        const recentDocs = await docModel.find({ user: user._id }).sort({ lastAccessed: -1 }).limit(5);

        // Pending Reminders (Next 10 days)
        const tenDaysFromNow = new Date();
        tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);
        const pendingReminders = await docModel.find({
            user: user._id,
            hasReminder: true,
            reminderDate: { $gte: new Date(), $lte: tenDaysFromNow }
        });

        res.render("overview", { user, totalDocs, medicalDocs, contactsCount, recentDocs, pendingReminders });
    } catch (err) {
        console.log(err);
        res.send("Error loading overview");
    }
});

// 3. DOCUMENTS PAGE (List & Search)
app.get("/documents", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const searchQuery = req.query.search || "";
        
        const query = { 
            user: user._id,
            title: { $regex: searchQuery, $options: "i" } 
        };

        const docs = await docModel.find(query).sort({ createdAt: -1 });
        
        // Pass 'title' to fix the ReferenceError
        res.render("documents", { 
            user, 
            docs, 
            search: searchQuery, 
            title: "All Documents" 
        });
    } catch (err) {
        console.log(err);
        res.redirect("/overview");
    }
});

// 4. MEDICAL RECORDS
app.get("/medical-records", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const docs = await docModel.find({ user: user._id, category: 'medical' }).sort({ createdAt: -1 });
        
        res.render("documents", { 
            user, 
            docs, 
            search: "", 
            title: "Medical Records" 
        });
    } catch (err) {
        res.redirect("/overview");
    }
});

// 5. UPLOAD (Get & Post)
app.get("/upload", isLoggedIn, (req, res) => {
    res.render("upload", { user: req.user });
});

app.post("/upload", isLoggedIn, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.send("No file uploaded.");

        const { title, category, hasReminder, reminderDate, reminderNote } = req.body;
        
        await docModel.create({
            user: req.user.userid,
            title: title || req.file.originalname,
            category,
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            fileType: path.extname(req.file.originalname).substring(1),
            hasReminder: hasReminder === 'on',
            reminderDate: reminderDate || null,
            reminderNote: reminderNote || ""
        });

        res.redirect("/documents");
    } catch (err) {
        console.log(err);
        res.status(500).send("Upload Failed");
    }
});

// 6. VIEW DOCUMENT (Tracks History)
app.get("/view-document/:id", isLoggedIn, async (req, res) => {
    try {
        const doc = await docModel.findOneAndUpdate(
            { _id: req.params.id, user: req.user.userid },
            { lastAccessed: Date.now() },
            { new: true }
        );
        if(!doc) return res.status(404).send("File not found");
        res.redirect(`/uploads/${doc.filename}`);
    } catch (err) {
        res.status(500).send("Error");
    }
});


// 7. DELETE DOCUMENT
app.get("/delete-doc/:id", isLoggedIn, async (req, res) => {
    try {
        // 1. Delete the document entry from MongoDB
        const doc = await docModel.findOneAndDelete({ 
            _id: req.params.id, 
            user: req.user.userid 
        });

        // 2. Delete the actual file from the 'uploads' folder
        if (doc && doc.path) {
            fs.unlink(doc.path, (err) => {
                if (err) console.error("File unlink error:", err);
            });
        }

        // 3. RENDER THE SUCCESS PAGE (Fixes the loop error)
        res.render("delete-success");

    } catch (err) {
        console.error(err);
        // If error, safely go back to documents
        res.redirect("/documents"); 
    }
});

// 8. REMINDERS
app.get("/reminders", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    const reminders = await docModel.find({ user: user._id, hasReminder: true }).sort({ reminderDate: 1 });
    res.render("reminders", { user, reminders });
});

// 9. EMERGENCY CONTACTS
app.get("/emergency-contacts", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    const contacts = await contactModel.find({ user: user._id });
    res.render("emergency-contacts", { user, contacts });
});

app.post("/add-contact", isLoggedIn, async (req, res) => {
    const { name, phone, relationship } = req.body;
    await contactModel.create({ user: req.user.userid, name, phone, relationship });
    res.redirect("/emergency-contacts");
});

// 10. EMERGENCY MODE
app.get("/emergency-mode", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    // Fetch critical data
    const contacts = await contactModel.find({ user: user._id });
    res.render("emergency-mode", { user, contacts });
});

// 11. SETTINGS
app.get("/settings", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    res.render("settings", { user });
});

// --- SERVER START ---
app.listen(3001, () => console.log("🚀 Server running on http://localhost:3001"));
