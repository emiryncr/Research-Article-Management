// === client/src/App.js ===
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Grid,
  Paper,
  IconButton,
  Stack,
  CircularProgress,
  Tooltip,
  InputAdornment 
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
//axios.defaults.baseURL = 'http://localhost:5000';
axios.defaults.baseURL = process.env.REACT_APP_API_URL;

const App = () => {
  const [form, setForm] = useState({ title: "", author: "", summary: "", notes: "", doi: "" });
  const [file, setFile] = useState(null);
  const [search, setSearch] = useState("");
  const [articles, setArticles] = useState([]);
  const [doiLoading, setDoiLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);


const fetchArticles = useCallback(async () => {
  const res = await axios.get(`/api/articles?search=${search}`);
  setArticles(res.data);
}, [search]);

useEffect(() => {
  fetchArticles();
}, [fetchArticles]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

const handleFileChange = (e) => {
  const selectedFile = e.target.files[0];
  if (selectedFile) {
    setFile(selectedFile);
    
    const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
    
    console.log("File extension:", fileExtension);
    
    if (fileExtension === 'pdf' || fileExtension === 'docx') {
      const formData = new FormData();
      formData.append("file", selectedFile);
      
      console.log("Sending file for summary extraction");
      
      setFileLoading(true);
      axios.post("/api/articles/extract-summary", formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      .then(res => {
        console.log("Summary received:", res.data); 
        setForm(prev => ({
          ...prev,
          summary: res.data.summary || prev.summary
        }));
      })
      .catch(err => {
        console.error("Özet çıkarma hatası:", err);
        alert("Dosyadan özet çıkarılamadı.");
      })
      .finally(() => setFileLoading(false));
    } else {
      console.log("Unsupported file type"); 
    }
  }
};

  const handleDOIFetch = async () => {
    if (!form.doi) return;
    setDoiLoading(true);
    try {
      const res = await axios.post("/api/articles/fetch-doi", { doi: form.doi });
      setForm((prev) => ({
        ...prev,
        title: res.data.title || "",
        author: res.data.authors || "",
        summary: res.data.summary || "",
        doi: res.data.doi || form.doi,
      }));
    } catch (error) {
      alert("DOI not found or invalid.");
    }
    setDoiLoading(false);
};

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!form.title.trim()) {
    alert("Title is required.");
    return;
  }

  const data = new FormData();
  Object.entries(form).forEach(([key, val]) => data.append(key, val));
  if (file) data.append("file", file);

  try {
    await axios.post("/api/articles", data);
    setForm({ title: "", author: "", summary: "", notes: "", doi: "" });
    setFile(null);
    fetchArticles();
  } catch (error) {
    alert("Failed to add article. Please check your input and try again.");
    console.error(error);
  }
};

  const handleDelete = async (id) => {
    try {
      await axios.delete(`/api/articles/${id}`);
      fetchArticles();
    } catch (error) {
      alert("Failed to delete article.");
      console.error(error);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
    <Typography variant="h3" gutterBottom align="center" fontWeight={700}>
      Research Article Management System
    </Typography>

    <Paper elevation={4} sx={{ p: 3, mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Add New Article
      </Typography>
      <Box component="form" onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Stack direction="row" spacing={2} alignItems="center">
              <TextField
                fullWidth
                label="DOI (Optional)"
                name="doi"
                value={form.doi}
                onChange={handleChange}
                size="small"
                variant="outlined"
                
              />
              <Tooltip title="Fetch article details from DOI" arrow>
                <span>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={handleDOIFetch}
                    disabled={doiLoading || !form.doi}
                    sx={{ height: 40, boxShadow: 2 }}
                    
                  >
                    {doiLoading ? <CircularProgress size={24} color="inherit" /> : "Fetch"}
                  </Button>
                </span>
              </Tooltip>
            </Stack>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Title"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Author"
              name="author"
              value={form.author}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
        <TextField
          fullWidth
          multiline
          rows={3}
          label="Summary"
          name="summary"
          value={form.summary}
          onChange={handleChange}
          size="small"
          InputProps={{
            endAdornment: fileLoading && (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            ),
          }}
        />
      </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <Button
              variant="contained"
              component="label"
              fullWidth
              sx={{ height: 40 }}
            >
              {file ? file.name : "Upload File"}
              <input
                type="file"
                hidden
                accept=".pdf,.docx"
                onChange={handleFileChange}
              />
            </Button>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{ height: 40 }}
            >
              Add Article
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Paper>

    <TextField
      fullWidth
      label="Search Articles by Title"
      value={search}
      onChange={(e) => setSearch(e.target.value)}
      sx={{ mb: 4 }}
      size="small"
    />
    <Typography variant="h5" gutterBottom>
      Saved Articles
    </Typography>
    <Grid container spacing={2}>
      {articles.map((a) => (
        <Grid item xs={12} key={a._id} sx={{ width: "100%" }}>
          <Paper elevation={2} sx={{ p: 2}}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start" justifyContent="space-between">
              <Box flex={1}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  {a.title}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  {a.author}
                </Typography>
                {a.notes && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Notes:</strong> {a.notes}
                  </Typography>
                )}
                {a.summary && (
                  <Typography variant="body2" sx={{ mb: 0.5 }}>
                    <strong>Summary:</strong> {a.summary}
                  </Typography>
                )}
                {a.doi && (
                  <Typography variant="body2" color="primary" sx={{ mb: 0.5 }}>
                    <strong>DOI:</strong> {a.doi}
                  </Typography>
                )}
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {a.file && (
                  <Button
                    variant="outlined"
                    href={`/api/articles/download/${a.file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                  >
                    Download File
                  </Button>
                )}
                <IconButton onClick={() => handleDelete(a._id)} color="error">
                  <DeleteIcon />
                </IconButton>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      ))}
      {articles.length === 0 && (
        <Grid item xs={12}>
          <Typography color="text.secondary" align="center">
            No articles found.
          </Typography>
        </Grid>
      )}
    </Grid>
  </Container>
  );
};

export default App;
