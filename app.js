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
const crypto = require('crypto');

// --- IMPORT MODELS ---
const userModel = require("./models/user");
const postModel = require("./models/post"); // Keep if you still need it
const docModel = require("./models/document"); // NEW
const contactModel = require("./models/contact"); // NEW
const folderModel = require("./models/folder"); // NEW

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
if (!fs.existsSync(uploadDir)) {
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

app.get('/forgot-password', (req, res) => {
    res.render('forgot-password');
});
// Forgot Password Route
app.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        const user = await userModel.findOne({ email });

        if (user) {
            // 2. Generate and Hash OTP 
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const hashedOTP = await bcryptjs.hash(otp, 10);

            user.otp = hashedOTP;
            user.otpExpires = Date.now() + 600000;
            await user.save();
            await transporter.sendMail({
                to: email,
                subject: "Password Reset Code - FamVault",
                html: `<h3>Your Password Reset Code is: <b>${otp}</b></h3>
                       <p>This code expires in 10 minutes.</p>`
            });
            return res.render("verify-otp", { email: email });
        }
        //if exist
        res.render("login", { message: "If an account exists, an OTP has been sent." });
    } catch (err) {
        console.error("MAILING ERROR:", err);
        res.status(500).send("Error sending email. Check server logs.");
    }
});

// REGISTER LOGIC
app.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (password.length < 8) {
            return res.render("register", { error: "Password must be at least 8 characters long." });
        }
        let user = await userModel.findOne({ email });

        if (user && user.isVerified) return res.redirect("/login?message=Email already exists");

        const hashPassword = await bcryptjs.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOTP = await bcryptjs.hash(otp, 10);

        if (user) {
            // Update existing unverified user
            user.password = hashPassword;
            user.otp = hashedOTP;
            user.otpExpires = Date.now() + 600000;
            await user.save();
        } else {
            // Create new user
            await userModel.create({
                name,
                email,
                password: hashPassword,
                otp: hashedOTP,
                otpExpires: Date.now() + 600000 // Valid for 10 minutes
            });
        }

        await transporter.sendMail({
            to: email,
            subject: "Verify Your FamVault Account",
            html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8f9fa; padding: 20px; border-radius: 12px;">
                <div style="background-color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                    
                    <div style="text-align: center; margin-bottom: 30px;">
                        <div style="display: inline-block; background-color: #2563eb; padding: 12px; border-radius: 12px;">
                            <span style="color: white; font-size: 24px; font-weight: bold;">🛡️</span>
                        </div>
                        <h2 style="color: #1e293b; margin-top: 15px; font-size: 24px; font-weight: 700;">FamVault</h2>
                    </div>

                    <div style="text-align: center;">
                        <h3 style="color: #334155; font-size: 20px; margin-bottom: 10px;">Verify your email address</h3>
                        <p style="color: #64748b; font-size: 16px; margin-bottom: 30px; line-height: 1.5;">
                            Welcome to FamVault! Please enter the 6-digit code below to verify your account and secure your digital legacy.
                        </p>

                        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; display: inline-block; margin-bottom: 30px; border: 1px dashed #2563eb;">
                            <h1 style="color: #2563eb; font-size: 36px; letter-spacing: 8px; margin: 0; font-family: monospace; font-weight: bold;">${otp}</h1>
                        </div>

                        <p style="color: #94a3b8; font-size: 14px;">
                            This code will expire in <b>10 minutes</b>.
                        </p>
                    </div>

                    <div style="border-top: 1px solid #e2e8f0; margin: 30px 0;"></div>

                    <div style="text-align: center; color: #94a3b8; font-size: 12px;">
                        <p>If you didn't request this code, you can safely ignore this email.</p>
                        <p>&copy; ${new Date().getFullYear()} FamVault Security Team.</p>
                    </div>
                </div>
            </div>`
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

        if (user.otpExpires < Date.now()) {
            await userModel.deleteOne({ email });
            return res.send("❌ OTP expired. Please register again.");
        }

        const validOTP = await bcryptjs.compare(otp, user.otp);

        if (!validOTP) {
            return res.send("❌ Invalid code. Check your email.");
        }

        await userModel.updateOne({ email }, {
            isVerified: true,
            $unset: { otp: 1, otpExpires: 1 }
        });

        console.log(`✅ ${email} is now verified.`);
        res.redirect("/login?message=Verified! You can now login.");
    } catch (err) {
        res.status(500).send("Verification Error");
    }
});

// RESEND OTP ROUTE
app.post("/resend-otp", async (req, res) => {
    try {
        const { email } = req.body;

        // 1. Find the user
        const user = await userModel.findOne({ email });
        if (!user) return res.redirect("/register?message=User not found");

        // 2. Generate New OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOTP = await bcryptjs.hash(otp, 10);

        // 3. Update Database
        user.otp = hashedOTP;
        user.otpExpires = Date.now() + 600000; // 10 minutes
        await user.save();

        // 4. Send Email
        await transporter.sendMail({
            to: email,
            subject: "New Verification Code - FamVault",
            html: `<h3>Your New OTP is: ${otp}</h3>`
        });

        // 5. Go back to verify page
        res.render("verify-otp", { email: email, message: "New code sent!" });

    } catch (err) {
        console.error(err);
        res.redirect("/register?message=Error resending OTP");
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

    // Create Token with 'userid' to match your other routes
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

        // Recent Reminders (Recently Added)
        const pendingReminders = await docModel.find({
            user: user._id,
            hasReminder: true
        }).sort({ createdAt: -1 }).limit(5);

        res.render("overview", { user, totalDocs, medicalDocs, contactsCount, recentDocs, pendingReminders });
    } catch (err) {
        console.log(err);
        res.send("Error loading overview");
    }
});

/* ====================== FOLDER & DOCUMENT LOGIC ====================== */
app.get("/documents", isLoggedIn, async (req, res) => {
    try {
        const searchQuery = req.query.search || "";
        const folderFilter = req.query.folder || null;

        // 1. Fetch folders belonging to this user
        const folders = await folderModel.find({ userId: req.user.userid });
        const user = await userModel.findOne({ email: req.user.email });

        // 2. Build Query for documents
        const query = {
            user: req.user.userid,
            title: { $regex: searchQuery, $options: "i" }
        };

        // If a specific folder is clicked, filter docs by that folderId
        if (folderFilter) {
            query.folderId = folderFilter;
        }

        const docs = await docModel.find(query).sort({ createdAt: -1 });

        res.render("documents", {
            user,
            docs: docs,
            folders: folders,
            search: searchQuery,
            currentFolderId: folderFilter, // Pass the current folder ID
            title: folderFilter ? "Folder View" : "All Documents"
        });
    } catch (err) {
        console.error("Error loading documents:", err);
        res.redirect("/overview");
    }
});

// POST: Create Folder
app.post('/create-folder', isLoggedIn, async (req, res) => {
    try {
        const { folderName } = req.body;

        if (!folderName) {
            return res.status(400).send("Folder name is required");
        }
        await folderModel.create({
            name: folderName,
            userId: req.user.userid
        });

        res.redirect('/documents');
    } catch (err) {
        console.error("Folder Creation Error:", err);
        res.status(500).send("Error creating folder");
    }
});

// POST: Rename Folder
app.post('/rename-folder/:id', isLoggedIn, async (req, res) => {
    try {
        const { folderName } = req.body;
        if (!folderName) return res.status(400).send("New name is required");

        await folderModel.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userid },
            { name: folderName }
        );
        res.redirect('/documents');
    } catch (err) {
        console.error("Rename Folder Error:", err);
        res.redirect('/documents');
    }
});

// GET: Delete Folder
app.get('/delete-folder/:id', isLoggedIn, async (req, res) => {
    try {
        // 1. Unlink documents from this folder (move to root)
        await docModel.updateMany(
            { folderId: req.params.id, user: req.user.userid },
            { folderId: null }
        );

        // 2. Delete the folder
        await folderModel.findOneAndDelete({ _id: req.params.id, userId: req.user.userid });

        res.redirect('/documents');
    } catch (err) {
        console.error("Delete Folder Error:", err);
        res.redirect('/documents');
    }
});

// 4. MEDICAL RECORDS
// 4. MEDICAL RECORDS
app.get("/medical-records", isLoggedIn, async (req, res) => {
    try {
        const user = await userModel.findOne({ email: req.user.email });
        const folderFilter = req.query.folder || null;

        // Fetch folders
        const folders = await folderModel.find({ userId: req.user.userid });

        // Build query
        const query = {
            user: user._id,
            category: 'medical'
        };

        if (folderFilter) {
            query.folderId = folderFilter;
        }

        const docs = await docModel.find(query).sort({ createdAt: -1 });

        res.render("documents", {
            user,
            docs,
            folders, // Pass folders to view
            currentFolderId: folderFilter, // Pass current folder ID
            search: "",
            title: "Medical Records"
        });
    } catch (err) {
        console.error("Error loading medical records:", err);
        res.redirect("/overview");
    }
});

// 5. UPLOAD (Get & Post)
app.get("/upload", isLoggedIn, async (req, res) => {
    try {
        const folders = await folderModel.find({ userId: req.user.userid });
        const selectedFolder = req.query.folder || "";
        const selectedCategory = req.query.category || "";
        res.render("upload", { user: req.user, folders, selectedFolder, selectedCategory });
    } catch (err) {
        console.error("Error loading upload page:", err);
        res.redirect("/overview");
    }
});

app.post("/upload", isLoggedIn, upload.single("file"), async (req, res) => {
    try {
        if (!req.file) return res.send("No file uploaded.");

        const { title, category, hasReminder, reminderDate, reminderNote, folderId } = req.body;
        console.log("DEBUG: Upload Body:", req.body);
        console.log("DEBUG: Selected Folder ID:", folderId);

        await docModel.create({
            user: req.user.userid,
            title: title || req.file.originalname,
            category,
            folderId: folderId || null, // Save the folder ID here
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            size: req.file.size,
            fileType: path.extname(req.file.originalname).substring(1),
            hasReminder: hasReminder === 'on',
            reminderDate: reminderDate || null,
            reminderNote: reminderNote || ""
        });

        res.redirect(folderId ? `/documents?folder=${folderId}` : "/documents");
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
        if (!doc) return res.status(404).send("File not found");

        const filePath = path.join(__dirname, 'public', 'uploads', doc.filename);

        if (!fs.existsSync(filePath)) {
            return res.status(404).send("File not found on server");
        }

        // Force inline display
        res.setHeader('Content-Disposition', 'inline');
        res.sendFile(filePath);

    } catch (err) {
        console.error("View Error:", err);
        res.status(500).send("Error viewing document");
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

        // 3. Redirect back immediately
        res.redirect("back");

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

app.post("/edit-contact/:id", isLoggedIn, async (req, res) => {
    try {
        const { name, phone, relationship } = req.body;
        await contactModel.findOneAndUpdate(
            { _id: req.params.id, user: req.user.userid },
            { name, phone, relationship }
        );
        res.redirect("/emergency-contacts");
    } catch (err) {
        console.error("Edit Contact Error:", err);
        res.redirect("/emergency-contacts");
    }
});

app.get("/delete-contact/:id", isLoggedIn, async (req, res) => {
    try {
        await contactModel.findOneAndDelete({ _id: req.params.id, user: req.user.userid });
        res.redirect("/emergency-contacts");
    } catch (err) {
        console.error("Delete Contact Error:", err);
        res.redirect("/emergency-contacts");
    }
});

// 10. EMERGENCY MODE
app.get("/emergency-mode", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    // Fetch critical data
    const contacts = await contactModel.find({ user: user._id });
    const medicalRecords = await docModel.find({ user: user._id, category: 'medical' });
    res.render("emergency-mode", { user, contacts, medicalRecords });
});

// 11. PROFILE & SETTINGS
app.get("/profile", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    res.render("profile", { user });
});

app.get("/edit-profile", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    res.render("edit-profile", { user });
});

app.post("/edit-profile", isLoggedIn, upload.single("profilePic"), async (req, res) => {
    try {
        const { name, phone, dob, gender, bloodGroup, address, role } = req.body;

        let updateData = {
            name,
            phone,
            dob,
            gender,
            bloodGroup,
            address,
            role
        };

        if (req.file) {
            updateData.profilePic = "/uploads/" + req.file.filename;
        }

        await userModel.findOneAndUpdate(
            { email: req.user.email },
            updateData
        );

        res.redirect("/profile");
    } catch (err) {
        console.error("Profile Edit Error:", err);
        res.status(500).send("Error updating profile");
    }
});

app.get("/settings", isLoggedIn, async (req, res) => {
    const user = await userModel.findOne({ email: req.user.email });
    res.render("settings", { user });
});
app.post('/update-overview', isLoggedIn, async (req, res) => {
    try {
        // 1. Get the data from the form
        const { name } = req.body;

        // 2. Update the User in the Database
        // Use req.user.userid (set by isLoggedIn)
        await userModel.findOneAndUpdate(
            { _id: req.user.userid },
            { name: name }
        );

        console.log("Profile name updated to:", name);

        // 3. Redirect back to the overview page to see changes
        res.redirect('/overview');

    } catch (error) {
        console.error("Update Error:", error);
        res.status(500).send("Error updating profile");
    }
});
// 2. Route to HANDLE the form submission (POST)
app.post('/change-password', isLoggedIn, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // 1. Validate: Check if new passwords match
        if (newPassword !== confirmPassword) {
            return res.send("New passwords do not match");
        }

        // 2. Database: Find the user (req.user.userid is available thanks to isLoggedIn)
        const user = await userModel.findOne({ _id: req.user.userid });
        if (!user) return res.redirect("/login");

        // 3. Security: Verify the CURRENT password matches the database
        const isMatch = await bcryptjs.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.send("Incorrect current password");
        }

        // 4. Hash the NEW password
        const hashedPassword = await bcryptjs.hash(newPassword, 10);

        // 5. Update the database
        await userModel.findOneAndUpdate(
            { _id: req.user.userid },
            { password: hashedPassword }
        );

        console.log("Password updated successfully for user:", req.user.userid);

        // 6. Success: Redirect back to settings or logout
        res.redirect('/settings');

    } catch (error) {
        console.error("Change Password Error:", error);
        res.status(500).send("Server Error");
    }
});


app.post('/delete-account', async (req, res) => {
    try {
        // 1. GET THE TOKEN FROM COOKIES
        const token = req.cookies.token;

        // If no token, they aren't logged in
        if (!token) {
            return res.redirect("/login?message=Please log in to perform this action");
        }

        // 2. VERIFY & DECODE THE TOKEN
        // We use the same secret you used in your login route
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // In your login route, you signed it as: { userid: user._id }
        // So we extract it here:
        const userId = decoded.userid;

        console.log("Authorized to delete User ID:", userId);

        // 3. DELETE THE USER
        await userModel.findByIdAndDelete(userId);

        // 4. CLEAR THE COOKIE & REDIRECT
        res.clearCookie("token");
        res.redirect("/");

    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).send("Something went wrong deleting your account.");
    }
});

// --- SERVER START ---
app.listen(3001, () => console.log("🚀 Server running on http://localhost:3001"));
