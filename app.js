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
const session = require('express-session');

// --- IMPORT MODELS ---
const userModel = require("./models/user");
const docModel = require("./models/document");
const contactModel = require("./models/contact");
const folderModel = require("./models/folder");

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
app.use(session({
    secret: process.env.SESSION_SECRET || 'famvault_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// --- MULTER CONFIG (File Uploads) ---
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

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

/* ====================== PUBLIC ROUTES ====================== */

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

app.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});

/* ====================== AUTH LOGIC ====================== */

// REGISTER
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
            user.otpExpires = Date.now() + 600000;
            await user.save();
        } else {
            await userModel.create({
                name, email,
                password: hashPassword,
                otp: hashedOTP,
                otpExpires: Date.now() + 600000
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

        // If verifying for registration
        if (!user.isVerified) {
            await userModel.updateOne({ email }, { isVerified: true, $unset: { otp: 1, otpExpires: 1 } });
            res.redirect("/login?message=Verified! You can now login.");
        } else {
            // If verifying for password reset
            res.render("reset-password", { email: email, otp: otp });
        }
    } catch (err) {
        res.status(500).send("Verification Error");
    }
});

// LOGIN
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

// FORGOT PASSWORD
app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email });
        if (user) {
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.otp = await bcryptjs.hash(otp, 10);
            user.otpExpires = Date.now() + 600000;
            await user.save();
            await transporter.sendMail({
                to: email, subject: "Reset Password", html: `<h3>Your Reset Code: ${otp}</h3>`
            });
            return res.render("verify-otp", { email: email });
        }
        res.render("login", { message: "If account exists, OTP sent." });
    } catch (err) { res.status(500).send("Error"); }
});

// UPDATE PASSWORD (RESET)
app.post("/update-password", async (req, res) => {
    try {
        const { email, otp, newPassword, confirmPassword } = req.body;
        if (newPassword !== confirmPassword) return res.send("Passwords do not match.");
        
        const user = await userModel.findOne({ email });
        if (!user) return res.send("User not found.");

        const validOTP = await bcryptjs.compare(otp, user.otp);
        if (!validOTP) return res.send("Invalid session or code expired.");

        const hashPassword = await bcryptjs.hash(newPassword, 10);
        await userModel.updateOne({ email }, { 
            password: hashPassword, 
            $unset: { otp: 1, otpExpires: 1 } 
        });

        res.redirect("/login?message=Password updated successfully.");
    } catch (err) {
        res.status(500).send("Error updating password.");
    }
});

/* ====================== DASHBOARD & FEATURES ====================== */

// OVERVIEW
app.get("/overview", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        
        const totalDocs = await docModel.countDocuments({ user: user._id });
        const medicalDocs = await docModel.countDocuments({ user: user._id, category: 'medical' });
        const contactsCount = await contactModel.countDocuments({ user: user._id });
        const recentDocs = await docModel.find({ user: user._id }).sort({ lastAccessed: -1 }).limit(5);

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

/* ====================== PROFILE MANAGEMENT ====================== */

// PROFILE VIEW
app.get("/profile", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        res.render("profile", { user });
    } catch (err) {
        console.error(err);
        res.redirect("/overview");
    }
});

// UPDATE PROFILE
app.post("/update-profile", isLoggedIn, upload.single("profilePic"), async (req, res) => {
    try {
        const { name, phone, dob, bloodGroup, address, gender, role, allergies, conditions } = req.body;
        
        let updateData = {
            name, phone, dob, bloodGroup, address, gender, role, allergies, conditions
        };

        if (req.file) {
            updateData.profilePic = `/uploads/${req.file.filename}`;
        }

        await userModel.findByIdAndUpdate(req.user.userid, updateData);
        res.redirect("/profile");
    } catch (err) {
        console.error(err);
        res.status(500).send("Error updating profile");
    }
});

/* ====================== DOCUMENTS & FOLDERS ====================== */

// DOCUMENTS LIST (Handles Search & Folder View)
app.get("/documents", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const searchQuery = req.query.search || "";
        const currentFolderId = req.query.folder || null;
        
        const folders = await folderModel.find({ user: user._id, category: 'document' });

        let query = { 
            user: user._id, 
            category: 'document',
            title: { $regex: searchQuery, $options: "i" }
        };

        // If folder selected, show files in folder. If search, show matches. Else show root.
        if (currentFolderId) {
            query.folder = currentFolderId;
        } else if (!searchQuery) {
            query.folder = null; 
        }

        const docs = await docModel.find(query).sort({ createdAt: -1 });
        
        let pageTitle = "All Documents";
        if(currentFolderId) {
            const activeFolder = folders.find(f => f._id.toString() === currentFolderId);
            if(activeFolder) pageTitle = activeFolder.name;
        }

        res.render("documents", { 
            user, docs, folders, 
            search: searchQuery, currentFolderId, 
            title: pageTitle 
        });
    } catch (err) {
        console.error(err);
        res.redirect("/overview");
    }
});

// MEDICAL RECORDS
app.get("/medical-records", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const searchQuery = req.query.search || "";
        const currentFolderId = req.query.folder || null;

        const folders = await folderModel.find({ user: user._id, category: 'medical' });

        let query = { 
            user: user._id, 
            category: 'medical',
            title: { $regex: searchQuery, $options: "i" }
        };

        if (currentFolderId) {
            query.folder = currentFolderId;
        } else if (!searchQuery) {
            query.folder = null;
        }

        const docs = await docModel.find(query).sort({ createdAt: -1 });

        let pageTitle = "Medical Records";
        if(currentFolderId) {
            const activeFolder = folders.find(f => f._id.toString() === currentFolderId);
            if(activeFolder) pageTitle = activeFolder.name;
        }
        
        res.render("documents", { 
            user, docs, folders, 
            search: searchQuery, currentFolderId, 
            title: pageTitle 
        });
    } catch (err) {
        res.redirect("/overview");
    }
});

// CREATE FOLDER
app.post("/create-folder", isLoggedIn, async (req, res) => {
    try {
        const { folderName, category } = req.body;
        
        await folderModel.create({
            name: folderName,
            user: req.user.userid,
            category: category || 'document'
        });

        res.redirect("back");
    } catch (err) {
        console.error("Folder Error:", err);
        res.redirect("back");
    }
});

// UPLOAD PAGE
app.get("/upload", isLoggedIn, async (req, res) => {
    const folders = await folderModel.find({ user: req.user.userid });
    res.render("upload", { user: req.user, folders: folders, selectedFolder: req.query.folderId || null });
});

// HANDLE UPLOAD
app.post("/upload", isLoggedIn, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.send("No file uploaded.");

        const { title, category, folderId, hasReminder, reminderDate, reminderNote } = req.body;
        const finalFolderId = (folderId && folderId !== "") ? folderId : null;
        
        await docModel.create({
            user: req.user.userid,
            title: title || req.file.originalname,
            category,
            folder: finalFolderId,
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            fileType: path.extname(req.file.originalname).substring(1),
            hasReminder: hasReminder === 'on',
            reminderDate: reminderDate || null,
            reminderNote: reminderNote || ""
        });

        if(category === 'medical') res.redirect("/medical-records");
        else res.redirect("/documents");
    } catch (err) {
        console.log(err);
        res.status(500).send("Upload Failed");
    }
});

// VIEW DOCUMENT
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

// DELETE DOCUMENT
app.get("/delete-doc/:id", isLoggedIn, async (req, res) => {
    try {
        const doc = await docModel.findOneAndDelete({ _id: req.params.id, user: req.user.userid });
        if (doc && doc.path) {
            fs.unlink(doc.path, (err) => { if(err) console.error(err); });
        }
        res.render("delete-success");
    } catch (err) {
        res.redirect("/overview");
    }
});

/* ====================== EMERGENCY & SETTINGS ====================== */

app.get("/emergency-mode", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    const contacts = await contactModel.find({ user: user._id });
    
    let age = "N/A";
    if(user.dob) {
        const birthDate = new Date(user.dob);
        const diff = Date.now() - birthDate.getTime();
        age = Math.abs(new Date(diff).getUTCFullYear() - 1970);
    }

    res.render("emergency-mode", { user, contacts, age });
});

app.get("/emergency-contacts", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    const contacts = await contactModel.find({ user: user._id });
    res.render("emergency-contacts", { user, contacts });
});

app.post("/add-contact", isLoggedIn, async (req, res) => {
    const { name, phone, relationship } = req.body;
    await contactModel.create({
        user: req.user.userid,
        name, phone, relationship
    });
    
    if (req.query.from === 'emergency') res.redirect("/emergency-mode");
    else res.redirect("/emergency-contacts");
});

app.get("/reminders", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    const reminders = await docModel.find({ user: user._id, hasReminder: true }).sort({ reminderDate: 1 });
    res.render("reminders", { user, reminders });
});

app.get("/settings", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    res.render("settings", { user });
});

app.post('/change-password', isLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;
        if (newPassword !== confirmPassword) return res.send("Passwords do not match");
        
        const user = await userModel.findById(req.user.userid);
        const isMatch = await bcryptjs.compare(currentPassword, user.password);
        if (!isMatch) return res.send("Incorrect current password");
        
        user.password = await bcryptjs.hash(newPassword, 10);
        await user.save();
        res.redirect('/settings');
    } catch (err) { res.status(500).send("Error"); }
});

app.post('/delete-account', isLoggedIn, async (req, res) => {
    await userModel.findByIdAndDelete(req.user.userid);
    res.clearCookie("token");
    res.redirect("/");
});

// --- SERVER START ---
app.listen(3001, () => console.log("🚀 Server running on http://localhost:3001"));
