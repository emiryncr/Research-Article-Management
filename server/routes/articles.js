const express = require("express");
const router = express.Router();
const Article = require("../models/Article");
const multer = require("multer");
const axios = require("axios");
const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const dotenv = require("dotenv");
dotenv.config();


// OpenRouter API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_API_BASE,
  defaultHeaders: {
    "HTTP-Referer": "https://yourwebsite.com", // Replace with your site
    "X-Title": "Research Article Management System" // Optional, for identification
  }
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});
const upload = multer({ storage });

async function extractTextFromFile(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      return data.text;
    } 
    else if (ext === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } 
    else {
      throw new Error('Desteklenmeyen dosya formatı');
    }
  } catch (error) {
    console.error("Dosya okuma hatası:", error);
    return "";
  }
}

function simpleTextSummarizer(text) {
  const sentences = text.match(/[^\.!\?]+[\.!\?]+/g) || [];
  
  if (sentences.length <= 5) return text;
  
  const firstPart = sentences.slice(0, 3).join(' ');
  
  const lastPart = sentences.slice(-2).join(' ');
  
  let summary = firstPart + " [...] " + lastPart;
  
  return summary;
}


async function summarizeText(text) {
  if (!text || text.trim() === "") return "";
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      return simpleTextSummarizer(text);
    }
    
    try {
      const response = await openai.chat.completions.create({
        model: "openai/gpt-3.5-turbo", 
        messages: [
          {
        "role": "system",
        "content": "You are an academic article summarization expert. Create a concise summary by extracting the key points from the given text."
          },
          {
        "role": "user", 
        "content": `Summarize this text (do not exceed 200 words): ${text.substring(0, 4000)}`
          }
        ],
        max_tokens: 500,
      });
      
      return response.choices[0].message.content;
    } catch (apiError) {
      console.error("API hatası, basit özetleme kullanılıyor:", apiError);
      return simpleTextSummarizer(text);
    }
  } catch (error) {
    console.error("Özet oluşturma hatası:", error);
    return "Özet oluşturulamadı.";
  }
}

// Mevcut rotalar
router.get("/", async (req, res) => {
  const { search } = req.query;
  const query = search ? { title: { $regex: search, $options: "i" } } : {};
  const articles = await Article.find(query);
  res.json(articles);
});

router.post("/fetch-doi", async (req, res) => {
  try {
    const { doi } = req.body;
    
    const response = await axios.get(`https://api.crossref.org/works/${doi}`);
    const data = response.data.message;
    
    let title = data.title ? data.title[0] : "";
    title = title.replace(/\[.*?\]/g, '').trim();
    
    let authors = data.author ? data.author.map(a => a.given + " " + a.family).join(", ") : "";
    let abstract = data.abstract || "";
    
    if (abstract) {
      abstract = abstract.replace(/<\/?[^>]+(>|$)/g, "");
    }
    
    if (!abstract) {
      abstract = await summarizeText(`Title: ${title}\nAuthors: ${authors}\n${data.description || ""}`);
    }
    
    console.log("Retrieved DOI data:", { title, authors }); // Debug için
    
    res.json({
      title,
      authors,
      summary: abstract,
      doi
    });
  } catch (error) {
    console.error("DOI hatası:", error);
    res.status(400).json({ error: "DOI verisi alınamadı" });
  }
});

router.post("/extract-summary", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Dosya yüklenmedi" });
    }
    
    console.log("File received:", req.file);
    
    const filePath = path.join(__dirname, "..", "uploads", req.file.filename);
    console.log("Extracting text from:", filePath);
    
    const text = await extractTextFromFile(filePath);
    console.log("Text extracted, length:", text.length); 

    if (!text || text.trim() === "") {
      return res.json({ summary: "Text could not extracted." });
    }
    
    console.log("Summarizing text"); 
    const summary = await summarizeText(text);
    
    
    console.log("Summary created:", summary); 
    
    res.json({ summary });
  } catch (error) {
    console.error("Özet çıkarma hatası:", error);
    res.status(500).json({ error: "Özet oluşturulamadı" });
  }
});


router.post("/", upload.single("file"), async (req, res) => {
  try {
    let summary = req.body.summary || "";
    
    if (req.file && (!summary || summary.trim() === "")) {
      const filePath = path.join(__dirname, "..", "uploads", req.file.filename);
      const text = await extractTextFromFile(filePath);
      summary = await summarizeText(text);
    }
    
    const article = new Article({
      ...req.body,
      summary: summary,
      file: req.file ? req.file.filename : null
    });
    
    await article.save();
    res.json(article);
  } catch (error) {
    console.error("Makale ekleme hatası:", error);
    res.status(400).json({ error: "Makale eklenirken hata oluştu" });
  }
});

router.get("/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "..", "uploads", req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath); 
  } else {
    res.status(404).send("Dosya bulunamadı");
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    

    if (article.file) {
      const filePath = path.join(__dirname, "..", "uploads", article.file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    await Article.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Silme hatası:", error);
    res.status(400).json({ error: "Makale silinemedi" });
  }
});



module.exports = router;