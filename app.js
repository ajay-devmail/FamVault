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

// --- 1. MODELS ---
const userModel = require("./models/user");
const docModel = require("./models/document"); // Shared document model
const contactModel = require("./models/contact");
const reminderModel = require("./models/reminder");

// --- 2. DATABASE CONNECTION ---
mongoose.connect("mongodb://127.0.0.1:27017/famvoult")
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

// --- 3. MIDDLEWARE ---
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static("public"));
app.use("/uploads", express.static("public/uploads")); // Serve uploaded files

// --- 4. MULTER CONFIG ---
const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, './public/uploads'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// --- 5. MAIL CONFIG ---
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// --- 6. AUTH MIDDLEWARE ---
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

/* ====================== AUTH ROUTES ====================== */

app.get("/", (req, res) => res.render("landingpage"));

app.get("/register", (req, res) => {
    if (req.cookies.token) return res.redirect("/overview");
    res.render("register");
});

app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (password.length < 8) return res.render("register", { error: "Password too short." });

        let user = await userModel.findOne({ email });
        if (user && user.isVerified) return res.redirect("/login?message=Email already exists");

        const hashPassword = await bcryptjs.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOTP = await bcryptjs.hash(otp, 10);

        const userData = {
            name, email, password: hashPassword,
            otp: hashedOTP, otpExpires: Date.now() + 600000 
        };

        if (user) {
            Object.assign(user, userData);
            await user.save();
        } else {
            await userModel.create(userData);
        }

        await transporter.sendMail({
            to: email,
            subject: "Verify Your FamVault Account",
            html: `<h3>Your Verification Code: ${otp}</h3>`
        });

        res.render("verify-otp", { email });
    } catch (err) {
        res.status(500).send("Registration Error");
    }
});

app.post("/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await userModel.findOne({ email });
        if (!user || user.otpExpires < Date.now()) return res.send("❌ Expired or User not found.");

        const validOTP = await bcryptjs.compare(otp, user.otp);
        if (!validOTP) return res.send("❌ Invalid code.");

        await userModel.updateOne({ email }, { isVerified: true, $unset: { otp: 1, otpExpires: 1 } });
        res.redirect("/login?message=Verified! You can now login.");
    } catch (err) {
        res.status(500).send("Verification Error");
    }
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await userModel.findOne({ email });
    if (!user || !user.isVerified) return res.redirect("/login?message=Unauthorized");

    const isMatch = await bcryptjs.compare(password, user.password);
    if (!isMatch) return res.redirect("/login?message=Wrong password");

    const token = jwt.sign({ email: user.email, userid: user._id }, process.env.JWT_SECRET);
    res.cookie("token", token, { httpOnly: true });
    res.redirect("/overview");
});

app.get("/logout", (req, res) => {
    res.clearCookie("token");
    res.redirect("/login");
});

/* ====================== CORE FEATURES ====================== */

// OVERVIEW
app.get("/overview", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findById(req.user.userid);
        const totalDocs = await docModel.countDocuments({ user: req.user.userid });
        const medicalDocs = await docModel.countDocuments({ user: req.user.userid, category: 'medical' });
        const contactsCount = await contactModel.countDocuments({ user: req.user.userid });
        const recentDocs = await docModel.find({ user: req.user.userid }).sort({ lastAccessed: -1 }).limit(5);

        res.render("overview", { user, totalDocs, medicalDocs, contactsCount, recentDocs });
    } catch (err) {
        res.send("Error loading dashboard");
    }
});

// DOCUMENTS & SEARCH
app.get("/documents", isLoggedIn, async (req, res) => {
    const searchQuery = req.query.search || "";
    const docs = await docModel.find({ 
        user: req.user.userid, 
        title: { $regex: searchQuery, $options: "i" } 
    }).sort({ createdAt: -1 });
    
    res.render("documents", { user: req.user, docs, search: searchQuery, title: "All Documents" });
});

// FILE UPLOAD
app.get("/upload", isLoggedIn, (req, res) => res.render("upload", { user: req.user }));

app.post("/upload", isLoggedIn, upload.single("file"), async (req, res) => {
    try {
        const { title, category, hasReminder, reminderDate } = req.body;
        await docModel.create({
            user: req.user.userid,
            title: title || req.file.originalname,
            category,
            filename: req.file.filename,
            path: req.file.path,
            size: req.file.size,
            fileType: path.extname(req.file.originalname).substring(1),
            hasReminder: hasReminder === 'on',
            reminderDate: reminderDate || null
        });
        res.redirect("/documents");
    } catch (err) {
        res.status(500).send("Upload Failed");
    }
});

// REMINDERS (Unified)
app.get("/reminders", isLoggedIn, async (req, res) => {
    const reminders = await reminderModel.find({ user: req.user.userid });
    const docReminders = await docModel.find({ user: req.user.userid, hasReminder: true });
    res.render("reminders", { user: req.user, reminders, docReminders });
});

app.post("/reminders/add", isLoggedIn, async (req, res) => {
    const { title, description, date, category, priority } = req.body;
    let icon = category === "Medical" ? "heart-pulse" : "bell";
    await reminderModel.create({ user: req.user.userid, title, description, date, category, priority, icon });
    res.redirect("/reminders");
});

// EMERGENCY SECTION
app.get("/emergency-contacts", isLoggedIn, async (req, res) => {
    const contacts = await contactModel.find({ user: req.user.userid });
    res.render("emergency-contacts", { user: req.user, contacts });
});

app.post("/add-contact", isLoggedIn, async (req, res) => {
    await contactModel.create({ user: req.user.userid, ...req.body });
    res.redirect("/emergency-contacts");
});

app.get("/emergency-mode", isLoggedIn, async (req, res) => {
    const user = await userModel.findById(req.user.userid);
    const contacts = await contactModel.find({ user: req.user.userid });
    res.render("emergency-mode", { user, contacts });
});

app.listen(3001, () => console.log("🚀 Server: http://localhost:3001"));
