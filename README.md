<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 33 10 PM" src="https://github.com/user-attachments/assets/5f53cd40-edd9-40b3-9d00-addc655b0b59" />
<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 32 58 PM" src="https://github.com/user-attachments/assets/08e268f8-ebaf-4296-8d1a-5782221df02a" />
<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 32 14 PM" src="https://github.com/user-attachments/assets/ed95c1ec-1ba8-43f5-a129-011feababeef" />
<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 32 10 PM" src="https://github.com/user-attachments/assets/0ade6bd7-f5e4-49a1-9eb7-167da6d658ef" />
<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 31 46 PM" src="https://github.com/user-attachments/assets/8a43ccbc-42bd-4b2d-8adb-a697f6742aa7" />
<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 31 40 PM" src="https://github.com/user-attachments/assets/347eab45-861c-4189-97a9-1695ee24c4b0" />

<!-- 
 ## ✨ Features
* **Dynamic Dashboard:** Overview of total documents and pending reminders.
* **Profile Management:** Centered profile picture upload and detailed family roles.
* **Emergency Mode:** Quick-access toggle for critical situations.
* **Responsive Sidebar:** Clean navigation for Documents, Medical Records, and Contacts.  -->

# FamVault
**Secure access to your family legacy.**

FamVault is a comprehensive digital legacy management system designed to store, organize, and protect critical family documents and medical records. It features a unique "Emergency Mode" for instant access to life-saving information.

 ## ✨ Features
* **Dynamic Dashboard:** Overview of total documents and pending reminders.
* **Profile Management:** Centered profile picture upload and detailed family roles.
* **Emergency Mode:** Quick-access toggle for critical situations.
* **Responsive Sidebar:** Clean navigation for Documents, Medical Records, and Contacts. 


## 📸 Screenshots

### 1. Secure Authentication & Login
The entry gateway to the application featuring a modern glassmorphism design. It ensures secure user access with encrypted credential handling, providing a seamless "Welcome Back" experience.

![Login Page](<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 31 46 PM" src="https://github.com/user-attachments/assets/6d533ef4-f3a6-483b-aff6-127f09d13f97" />

### 2. Document Repository Dashboard
The central hub for all family assets. Users can upload, organize into folders, and search for critical files (like Insurance, IDs, and Deeds). It provides metadata previews and quick management tools.

![Documents Dashboard](<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 32 05 PM" src="https://github.com/user-attachments/assets/813f75ef-e1fb-4bd1-b69c-f60cc93732d0" />
)

### 3. Smart Reminders & Alerts
A proactive notification system that tracks document expiration dates (e.g., Insurance Renewals). It highlights urgent tasks with status tags (e.g., "Due in 1 day") and links directly to the relevant document.

![Reminders Page](<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 32 46 PM" src="https://github.com/user-attachments/assets/b4fa2db3-be8b-4256-87a4-990872d0dcfb" />
)

### 4. Emergency Mode (SOS)
A specialized, high-contrast interface designed for crisis situations. It overrides the standard UI to prominently display Blood Group, Emergency Contacts (112), and Medical Records for first responders.

![Emergency Mode](<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 33 10 PM" src="https://github.com/user-attachments/assets/23bad66a-9afc-4cae-87a2-ea28a73f3fcb" />
)

### 5. User Profile Management
Comprehensive identity management allowing users to update personal details, family roles, and address information. This section also houses the toggle to activate/deactivate the global "Emergency Mode".

![Profile Page](<img width="1710" height="1107" alt="Screenshot 2026-02-04 at 9 32 52 PM" src="https://github.com/user-attachments/assets/4bb7d07b-648c-49d9-8005-53e84e6dc584" />
)

---

## 🛠 Tech Stacks

**Frontend:**
* EJS 
* Tailwind CSS (Glassmorphism & Responsive Design)
* Lucide React (Icons)

**Backend:**
* Node.js
* Express.js
* bcryptjs
* cookies-parser
* dotenv
* ejs
* express
* jsonwebtoken
* mongoose
* multer
* nodemailer
* nodemon

**Database:**
* MongoDB (for user data and document metadata)

---

## 🚀 How to Run Locally

Follow these steps to set up FamVault on your local machine:

1.  **Clone the repository**

    git clone [https://github.com/your-username/famvault.git]
    cd famvault


2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in the root directory and add your variables:
    ```env
    MONGO_URI=your_mongodb_connection_string
    JWT_SECRET=your_secret_key
    ```

4.  **Run the Application**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

---


## 📝 Important Notes

* **Security:** This application handles sensitive personal data. Ensure all database connections are secure and environment variables are not committed to version control.
* **Emergency Mode logic:** The Emergency Mode is designed to be accessible quickly. In a production build, consider adding SMS integration for the SOS button.

## 🙌 Acknowledgements

* Built for the WebSprint 2026.
* Design inspiration from MacOS aesthetics and Glassmorphism trends.
