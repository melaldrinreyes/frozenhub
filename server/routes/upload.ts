import { RequestHandler } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

// Use /tmp directory in serverless environments (Netlify, Vercel, AWS Lambda)
const isServerless = process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL;
const baseUploadDir = isServerless ? "/tmp/uploads" : path.join(process.cwd(), "public", "uploads");

const uploadsDir = path.join(baseUploadDir, "products");
const bannersDir = path.join(baseUploadDir, "banners");

// Ensure uploads directory exists (lazy initialization)
function ensureUploadDirs() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  if (!fs.existsSync(bannersDir)) {
    fs.mkdirSync(bannersDir, { recursive: true });
  }
}

// Configure multer storage for products
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs(); // Create directories on demand
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

// In serverless runtimes, local filesystem is ephemeral.
// Use memory storage and return a data URL so product images remain viewable.
const storage = isServerless ? multer.memoryStorage() : diskStorage;

// File filter to accept only images
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
  }
};

// Multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Banner storage configuration
const bannerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDirs(); // Create directories on demand
    cb(null, bannersDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `banner-${uniqueSuffix}${ext}`);
  },
});

// Banner upload instance
export const uploadBanner = multer({
  storage: bannerStorage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for banners
  },
});

// Upload handler
export const handleUploadProductImage: RequestHandler = (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    if (isServerless && req.file.buffer) {
      const mimeType = req.file.mimetype || "image/jpeg";
      const base64 = req.file.buffer.toString("base64");
      const imagePath = `data:${mimeType};base64,${base64}`;
      res.json({
        message: "File uploaded successfully",
        imagePath,
      });
      return;
    }

    // Return the file path relative to public directory
    const imagePath = `/uploads/products/${req.file.filename}`;
    res.json({ 
      message: "File uploaded successfully",
      imagePath 
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete image handler
export const handleDeleteProductImage: RequestHandler = (req, res) => {
  try {
    const { imagePath } = req.body;

    if (!imagePath) {
      res.status(400).json({ error: "Image path is required" });
      return;
    }

    // Extract filename from path
    const filename = path.basename(imagePath);
    const filePath = path.join(uploadsDir, filename);

    // Check if file exists and delete it
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: "Image deleted successfully" });
    } else {
      res.status(404).json({ error: "Image not found" });
    }
  } catch (error) {
    console.error("Delete image error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Upload banner handler
export const handleUploadBanner: RequestHandler = (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Return the file path relative to public directory
    const imagePath = `/uploads/banners/${req.file.filename}`;
    res.json({ 
      message: "Banner uploaded successfully",
      imagePath 
    });
  } catch (error) {
    console.error("Upload banner error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Delete banner handler
export const handleDeleteBanner: RequestHandler = (req, res) => {
  try {
    const { imagePath } = req.body;

    if (!imagePath) {
      res.status(400).json({ error: "Image path is required" });
      return;
    }

    // Extract filename from path
    const filename = path.basename(imagePath);
    const filePath = path.join(bannersDir, filename);

    // Check if file exists and delete it
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ message: "Banner deleted successfully" });
    } else {
      res.status(404).json({ error: "Banner not found" });
    }
  } catch (error) {
    console.error("Delete banner error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
