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

// OpenAI API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


const mongoose = require("mongoose");


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

async function summarizeText(text) {
  if (!text || text.trim() === "") return "";
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          "role": "system",
          "content": "Sen bir akademik makale özetleme uzmanısın. Verilen metinden önemli noktaları çıkararak kısa ve özlü bir özet oluştur."
        },
        {
          "role": "user", 
          "content": `Bu metni özetle (300 kelimeyi geçme): ${text.substring(0, 4000)}` // Metin sınırı
        }
      ],
      max_tokens: 500,
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Özet oluşturma hatası:", error);
    return "Özet oluşturulamadı.";
  }
}


router.get("/", async (req, res) => {
  const { search } = req.query;
  const query = search ? { title: { $regex: search, $options: "i" } } : {};
  const articles = await Article.find(query);
  res.json(articles);
});

router.post("/", upload.single("file"), async (req, res) => {
  const article = new Article({
    ...req.body,
    file: req.file ? req.file.filename : null
  });
  await article.save();
  res.json(article);
});


router.post("/fetch-doi", async (req, res) => {
  const { doi } = req.body;
  if (!doi) return res.status(400).json({ error: "DOI required" });

  try {
    const response = await axios.get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (response.data && response.data.message) {
      const message = response.data.message;
      res.json({
        title: message.title ? message.title[0] : "",
        authors: message.author
          ? message.author.map(a => `${a.given} ${a.family}`).join(", ")
          : "",
        year: message.published && message.published["date-parts"]
          ? message.published["date-parts"][0][0]
          : "",
        summary: message.abstract || "No summary given on CrossRef",
        doi: message.DOI || "",
        file: null
      });
    } else {
      res.status(404).json({ error: "DOI not found" });
    }
  } catch (err) {
    res.status(404).json({ error: "DOI not found or invalid" });
  }
});

router.delete("/:id", async (req, res) => {
  await Article.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});


const path = require("path");
const fs = require("fs");
router.get("/download/:filename", (req, res) => {
  const filePath = path.join(__dirname, "..", "uploads", req.params.filename);
  if (fs.existsSync(filePath)) {
    res.download(filePath); 
  } else {
    res.status(404).send("File not found");
  }
});


module.exports = router;
