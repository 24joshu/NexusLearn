import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

// Import the Firebase configuration to get the correct database ID
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  console.log("Firebase config loaded:", JSON.stringify({ ...firebaseConfig, apiKey: "REDACTED" }));
} catch (e: any) {
  console.error("Error loading firebase-applet-config.json:", e.message);
}

dotenv.config();

// Force the project ID from config into environment variables
if (firebaseConfig.projectId) {
  process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
  process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
  process.env.FIRESTORE_PROJECT_ID = firebaseConfig.projectId;
  console.log(`Forcing project ID environment variables to: ${firebaseConfig.projectId}`);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

let lastDbError: any = null;

// Initialize Firebase Admin
let db: any = null;
let auth: any = null;
let firebaseApp: admin.app.App | null = null;

const testDb = async (dbInstance: any, label: string) => {
  try {
    // Try a simple read to verify connection with a timeout
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Timeout connecting to Firestore")), 5000)
    );
    
    const fetchPromise = dbInstance.collection("courses").limit(1).get();
    const snap = await Promise.race([fetchPromise, timeoutPromise]) as any;
    
    console.log(`Firestore connection (${label}) verified. Project: ${dbInstance.projectId}, Database: ${dbInstance.databaseId}. Found ${snap.size} docs.`);
    return true;
  } catch (error: any) {
    console.error(`Firestore connection (${label}) failed (Project: ${dbInstance?.projectId}, Database: ${dbInstance?.databaseId}): ${error.message}`);
    if (error.code) console.error(`Error code: ${error.code}`);
    return false;
  }
};

const initializeDb = async () => {
  const dbId = firebaseConfig.firestoreDatabaseId;
  const projectId = firebaseConfig.projectId;
  
  if (!projectId) {
    console.error("No project ID found in firebase-applet-config.json");
    return null;
  }

  console.log(`Initializing Firestore. Target Project: ${projectId}, Target Database: ${dbId}`);
  
  if (!firebaseApp) {
    try {
      // Clear any existing apps to ensure we use the correct project ID for the default app
      if (admin.apps.length > 0) {
        console.log(`Clearing ${admin.apps.length} existing Firebase apps...`);
        await Promise.all(admin.apps.map(a => a?.delete()));
      }
      
      // Initialize with explicit project ID
      firebaseApp = admin.initializeApp({ projectId });
      console.log(`Firebase Admin initialized with project: ${projectId}`);
      
      if (firebaseApp) {
        console.log("App Options:", JSON.stringify({ ...firebaseApp.options, credential: "REDACTED" }));
      }
    } catch (e: any) {
      console.error("Firebase Admin initialization failed:", e.message);
      lastDbError = `Init failed: ${e.message}`;
      return null;
    }
  }

  if (!firebaseApp) return null;

  auth = getAuth(firebaseApp);
  
  // 1. Try named database if provided
  if (dbId && dbId !== "(default)") {
    try {
      console.log(`Attempting named database: ${dbId}`);
      const namedDb = getFirestore(firebaseApp, dbId);
      if (await testDb(namedDb, `named: ${dbId}`)) {
        return namedDb;
      }
    } catch (e: any) {
      console.error(`Error initializing named database ${dbId}:`, e.message);
    }
  }

  // 2. Try default database
  try {
    console.log("Attempting default database");
    const defaultDb = getFirestore(firebaseApp);
    if (await testDb(defaultDb, "default")) {
      return defaultDb;
    }
  } catch (e: any) {
    console.error("Error initializing default database:", e.message);
  }

  lastDbError = "All Firestore initialization attempts failed. Check project permissions and database existence.";
  console.warn(lastDbError);
  return null; 
};

// Initial initialization removed to avoid double init and potential hangs
// (async () => { ... })();

async function seedAdmin() {
  if (!db || !auth) {
    console.error("Cannot seed admin: db or auth is null");
    return;
  }
  const adminEmail = "saikrishnagummadidala34@gmail.com";
  const adminPassword = "password123";

  try {
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminEmail);
      console.log("Admin user already exists");
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        userRecord = await auth.createUser({
          email: adminEmail,
          password: adminPassword,
          displayName: "System Admin",
        });
        console.log("Admin user created");
      } else {
        throw error;
      }
    }

    // Ensure admin profile in Firestore
    const userDoc = await db.collection("users").doc(userRecord.uid).get();
    if (!userDoc.exists) {
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: adminEmail,
        displayName: "System Admin",
        role: "admin",
        photoURL: `https://ui-avatars.com/api/?name=Admin&background=4f46e5&color=fff`,
        createdAt: new Date().toISOString(),
      });
      console.log("Admin profile seeded in Firestore");
    }
  } catch (error) {
    console.error("Error seeding admin:", error);
  }
}

async function seedCourses() {
  console.log("seedCourses function called");
  if (!db) {
    console.error("Cannot seed courses: db is null");
    return;
  }

  const defaultCourses = [
    {
      title: "Java Script",
      description: "Master the fundamentals of JavaScript, the language of the web. From basics to advanced asynchronous patterns.",
      instructor: "Krishna",
      duration: "12h 30m",
      level: "Intermediate",
      category: "Programming",
      price: 0,
      rating: 5,
      thumbnailUrl: "https://picsum.photos/seed/js-nexus/800/500",
      published: true,
      createdAt: new Date().toISOString(),
      enrollmentCount: 0
    },
    {
      title: "Python for Data Science",
      description: "Learn Python from scratch and apply it to real-world data science problems. Includes NumPy, Pandas, and Scikit-Learn.",
      instructor: "sai",
      duration: "15h 45m",
      level: "Intermediate",
      category: "Data Science",
      price: 0,
      rating: 5,
      thumbnailUrl: "https://picsum.photos/seed/python-nexus/800/500",
      published: true,
      createdAt: new Date().toISOString(),
      enrollmentCount: 0
    },
    {
      title: "Full-Stack Web Development",
      description: "A comprehensive guide to building modern web applications from front-end to back-end.",
      instructor: "Prof. James Wilson",
      duration: "24h 45m",
      level: "Intermediate",
      category: "Web Development",
      price: 0,
      rating: 4.8,
      thumbnailUrl: "https://picsum.photos/seed/fullstack-nexus/800/500",
      published: true,
      createdAt: new Date().toISOString(),
      enrollmentCount: 850
    },
    {
      title: "Java Programming",
      description: "Deep dive into Java programming, from object-oriented principles to advanced concurrency.",
      instructor: "Dr. Marcus Thorne",
      duration: "20h 15m",
      level: "Beginner",
      category: "Programming",
      price: 0,
      rating: 4.9,
      thumbnailUrl: "https://picsum.photos/seed/java-nexus/800/500",
      published: true,
      createdAt: new Date().toISOString(),
      enrollmentCount: 120
    }
  ];

  try {
    console.log("Checking courses collection...");
    for (const course of defaultCourses) {
      console.log(`Checking if course exists: ${course.title}`);
      const q = await db.collection("courses").where("title", "==", course.title).get();
      if (q.empty) {
        console.log(`Seeding course: ${course.title}`);
        await db.collection("courses").add(course);
      } else {
        console.log(`Course already exists: ${course.title}, updating all fields...`);
        const docId = q.docs[0].id;
        // Update all fields from the defaultCourses definition
        await db.collection("courses").doc(docId).update({
          ...course,
          updatedAt: new Date().toISOString()
        });
      }
    }
    console.log("Default courses check/seed completed successfully");
  } catch (error) {
    console.error("Error seeding courses:", error);
  }
}

async function startServer() {
  console.log("Starting NexusLearn server...");
  
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use("/uploads", express.static("uploads"));

  // Initialize Firebase
  db = await initializeDb();
  if (!db) {
    console.error("CRITICAL: Failed to initialize Firebase on startup. Check firebase-applet-config.json and project settings.");
  }

  // Run seeding in background to not block server startup
  (async () => {
    try {
      if (db) {
        console.log("Starting background seeding...");
        await seedAdmin();
        console.log("seedAdmin completed");
        await seedCourses();
        console.log("seedCourses completed");
      } else {
        console.warn("Skipping seeding because Firestore is not initialized");
      }
    } catch (err) {
      console.error("Error during background seeding:", err);
    }
  })();

  // Health check at the top
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "NexusLearn API is running",
      firebase: db ? "initialized" : "not initialized",
      projectId: firebaseConfig.projectId,
      databaseId: db ? db.databaseId : firebaseConfig.firestoreDatabaseId,
      lastError: lastDbError
    });
  });

  // Helper to get Firestore instance with fallback
  const getDbInstance = async () => {
    if (!db) {
      console.log("Global db variable is null. Attempting re-initialization...");
      try {
        db = await initializeDb();
      } catch (e: any) {
        lastDbError = `Re-initialization failed: ${e.message}`;
        console.error(lastDbError);
        return null;
      }
    }
    
    if (!db) {
      lastDbError = "Database initialization returned null. Check server logs.";
      return null;
    }

    try {
      // Test if the current db instance is working using 'courses' collection with a timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Timeout connecting to Firestore")), 5000)
      );
      const fetchPromise = db.collection("courses").limit(1).get();
      await Promise.race([fetchPromise, timeoutPromise]);
      return db;
    } catch (error: any) {
      const errorMsg = `Firestore connection error (Project: ${db.projectId}, Database: ${db.databaseId}): ${error.message}`;
      console.error(errorMsg);
      lastDbError = { message: errorMsg, code: error.code };
      
      // If NOT_FOUND (code 5), it means the database instance doesn't exist.
      if (error.code === 5) {
        // If we were using a named database, try the default one
        if (db.databaseId !== "(default)") {
          console.warn("Attempting fallback to default database...");
          try {
            const defaultDb = getFirestore(firebaseApp!);
            await defaultDb.collection("courses").limit(1).get();
            db = defaultDb;
            console.log("Successfully fell back to default database.");
            return db;
          } catch (fallbackError: any) {
            const fallbackMsg = `Fallback to default database failed: ${fallbackError.message}`;
            console.error(fallbackMsg);
            lastDbError = `Fallback failed: ${fallbackError.message}`;
          }
        }
      }
      return null;
    }
  };

  // Course Management API
  app.post("/api/courses", upload.fields([
    { name: "pdf", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]), async (req, res) => {
    const currentDb = await getDbInstance();
    if (!currentDb) return res.status(500).json({ error: "Firebase not initialized" });
    
    try {
      const { title, description, content, instructor, level, instructorId } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      const pdfFile = files["pdf"]?.[0];
      const thumbnailFile = files["thumbnail"]?.[0];

      const courseData = {
        title,
        description,
        instructor: instructor || "System",
        instructorId: instructorId || null,
        level: level || "Beginner",
        content: content || "",
        pdfUrl: pdfFile ? `/uploads/${pdfFile.filename}` : "",
        thumbnailUrl: thumbnailFile ? `/uploads/${thumbnailFile.filename}` : `https://picsum.photos/seed/${title.replace(/\s+/g, "").toLowerCase()}/800/600`,
        published: false,
        createdAt: new Date().toISOString(),
        enrollmentCount: 0
      };

      const docRef = await currentDb.collection("courses").add(courseData);
      res.json({ courseId: docRef.id, ...courseData });
    } catch (error: any) {
      console.error("Error creating course:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  app.delete("/api/courses/:id", async (req, res) => {
    const currentDb = await getDbInstance();
    if (!currentDb) return res.status(500).json({ error: "Firebase not initialized" });
    
    try {
      const { id } = req.params;
      const doc = await currentDb.collection("courses").doc(id).get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Course not found" });
      }

      const data = doc.data();
      
      // Delete files from disk
      if (data?.pdfUrl) {
        const pdfPath = path.join(process.cwd(), data.pdfUrl.startsWith('/') ? data.pdfUrl.slice(1) : data.pdfUrl);
        if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
      }
      if (data?.thumbnailUrl) {
        const thumbPath = path.join(process.cwd(), data.thumbnailUrl.startsWith('/') ? data.thumbnailUrl.slice(1) : data.thumbnailUrl);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      }

      await currentDb.collection("courses").doc(id).delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting course:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  app.patch("/api/courses/:id", async (req, res) => {
    const currentDb = await getDbInstance();
    if (!currentDb) return res.status(500).json({ error: "Firebase not initialized" });
    
    try {
      const { id } = req.params;
      const { published } = req.body;
      await currentDb.collection("courses").doc(id).update({ published });
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating course:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  app.put("/api/courses/:id", upload.fields([
    { name: "pdf", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]), async (req, res) => {
    const currentDb = await getDbInstance();
    if (!currentDb) return res.status(500).json({ error: "Firebase not initialized" });
    
    try {
      const { id } = req.params;
      const { title, description, content, instructor, level } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      
      const pdfFile = files["pdf"]?.[0];
      const thumbnailFile = files["thumbnail"]?.[0];

      // Get existing course data to delete old files if needed
      const courseDoc = await currentDb.collection("courses").doc(id).get();
      if (!courseDoc.exists) {
        return res.status(404).json({ error: "Course not found" });
      }
      const existingData = courseDoc.data();

      const updateData: any = {
        title,
        description,
        instructor: instructor || "System",
        level: level || "Beginner",
        content: content || "",
        updatedAt: new Date().toISOString()
      };

      if (pdfFile) {
        // Delete old PDF if it exists
        if (existingData?.pdfUrl) {
          const oldPdfPath = path.join(process.cwd(), existingData.pdfUrl.startsWith('/') ? existingData.pdfUrl.slice(1) : existingData.pdfUrl);
          if (fs.existsSync(oldPdfPath)) fs.unlinkSync(oldPdfPath);
        }
        updateData.pdfUrl = `/uploads/${pdfFile.filename}`;
      }
      if (thumbnailFile) {
        // Delete old thumbnail if it exists
        if (existingData?.thumbnailUrl && !existingData.thumbnailUrl.startsWith('http')) {
          const oldThumbPath = path.join(process.cwd(), existingData.thumbnailUrl.startsWith('/') ? existingData.thumbnailUrl.slice(1) : existingData.thumbnailUrl);
          if (fs.existsSync(oldThumbPath)) fs.unlinkSync(oldThumbPath);
        }
        updateData.thumbnailUrl = `/uploads/${thumbnailFile.filename}`;
      }

      await currentDb.collection("courses").doc(id).update(updateData);
      res.json({ success: true, id, ...updateData });
    } catch (error: any) {
      console.error("Error updating course:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  // Debug API to see all courses
  app.get("/api/debug/courses", async (req, res) => {
    const currentDb = await getDbInstance();
    if (!currentDb) return res.status(500).json({ error: "Firebase not initialized", lastError: lastDbError });
    
    try {
      const snap = await currentDb.collection("courses").get();
      const courses = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json({ count: snap.size, courses, lastError: lastDbError });
    } catch (error: any) {
      res.status(500).json({ error: error.message, lastError: lastDbError });
    }
  });

  app.get("/api/hello", (req, res) => {
    res.json({ message: "Hello from server" });
  });

  // Debug API to check Firebase status
  app.get("/api/debug/firebase", async (req, res) => {
    const apps = admin.apps.map(a => ({
      name: a?.name,
      projectId: a?.options.projectId,
    }));
    
    res.json({
      env: {
        GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
        GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
      },
      apps,
      configProjectId: firebaseConfig.projectId,
      lastError: lastDbError
    });
  });

  // Stats API with resilience
  app.get("/api/stats", async (req, res) => {
    console.log("Stats API called");
    const currentDb = await getDbInstance();
    if (!currentDb) {
      console.error("Stats API: Firebase not initialized");
      return res.status(500).json({ error: "Firebase not initialized" });
    }
    
    try {
      const studentsSnap = await currentDb.collection("users").where("role", "==", "student").get();
      const coursesSnap = await currentDb.collection("courses").get();
      const enrollmentsSnap = await currentDb.collection("enrollments").get();

      const stats = {
        totalStudents: studentsSnap?.size || 0,
        totalCourses: coursesSnap?.size || 0,
        totalEnrollments: enrollmentsSnap?.size || 0
      };

      console.log(`Stats API: Found ${stats.totalStudents} students, ${stats.totalCourses} courses, ${stats.totalEnrollments} enrollments`);

      res.json(stats);
    } catch (error: any) {
      console.error("Error fetching stats:", error);
      res.status(500).json({ error: "Internal server error", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
