const mongoose = require("mongoose");

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: String,
  summary: String,
  notes: String,
  file: String,
  doi: String
});

module.exports = mongoose.model("Article", ArticleSchema);
