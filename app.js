// ============================================================================
// Image Resizer - Frontend Application Logic
// Student: Madhu Soodhan S | Register: 24UG00211
// ============================================================================

// Supabase Configuration for Project tkrywxnqlitacdfwtwou
const SUPABASE_URL = "https://tkrywxnqlitacdfwtwou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcnl3eG5xbGl0YWNkZnd0d291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODgwMzIsImV4cCI6MjEwNDY2NDAzMn0.IiQpFFFxQvTJertl9E6JNy61BxF8qdWxf9N71GYqXMo";
const BUCKET_NAME = "image-uploads";

// Initialize Supabase Client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// DOM Elements
const dropZone = document.getElementById("dropZone");
const dropZoneContent = document.getElementById("dropZoneContent");
const fileInput = document.getElementById("fileInput");
const selectedFileInfo = document.getElementById("selectedFileInfo");
const selectedFileName = document.getElementById("selectedFileName");
const selectedFileSize = document.getElementById("selectedFileSize");
const btnRemoveFile = document.getElementById("btnRemoveFile");
const btnUpload = document.getElementById("btnUpload");

const statusContainer = document.getElementById("statusContainer");
const statusText = document.getElementById("statusText");
const statusPercentage = document.getElementById("statusPercentage");
const progressBarFill = document.getElementById("progressBarFill");
const alertBox = document.getElementById("alertBox");
const alertMessage = document.getElementById("alertMessage");

const resultsSection = document.getElementById("resultsSection");
const summarySpaceSaved = document.getElementById("summarySpaceSaved");
const summarySizeSaved = document.getElementById("summarySizeSaved");

const imgOriginalPreview = document.getElementById("imgOriginalPreview");
const metaOrigSize = document.getElementById("metaOrigSize");
const metaOrigDimensions = document.getElementById("metaOrigDimensions");
const metaOrigPath = document.getElementById("metaOrigPath");

const imgOptimizedPreview = document.getElementById("imgOptimizedPreview");
const metaOptSize = document.getElementById("metaOptSize");
const metaOptDimensions = document.getElementById("metaOptDimensions");
const metaOptPath = document.getElementById("metaOptPath");
const badgeCompression = document.getElementById("badgeCompression");
const btnDownloadOptimized = document.getElementById("btnDownloadOptimized");

const jsonOutput = document.getElementById("jsonOutput");
const btnCopyJson = document.getElementById("btnCopyJson");

// Selected File State
let currentFile = null;

// Event Listeners
dropZone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFileSelect(e.target.files[0]));

// Drag & Drop
["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.add("dragover");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
    });
});

dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
});

btnRemoveFile.addEventListener("click", (e) => {
    e.stopPropagation();
    resetFileSelection();
});

btnUpload.addEventListener("click", processImageUpload);

btnCopyJson.addEventListener("click", () => {
    navigator.clipboard.writeText(jsonOutput.innerText);
    btnCopyJson.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => {
        btnCopyJson.innerHTML = '<i class="fa-regular fa-copy"></i> Copy JSON';
    }, 2000);
});

// File Selection Handler
function handleFileSelect(file) {
    if (!file) return;

    // Validate MIME type
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!validTypes.includes(file.type.toLowerCase())) {
        showAlert("error", "Invalid file type. Please select a JPG, PNG, or WEBP image.");
        return;
    }

    // Validate size (< 10MB)
    if (file.size > 10 * 1024 * 1024) {
        showAlert("error", "File size exceeds 10MB limit.");
        return;
    }

    currentFile = file;
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatBytes(file.size);

    dropZoneContent.classList.add("hidden");
    selectedFileInfo.classList.remove("hidden");
    btnUpload.disabled = false;
    hideAlert();
}

function resetFileSelection() {
    currentFile = null;
    fileInput.value = "";
    selectedFileName.textContent = "";
    selectedFileSize.textContent = "";

    dropZoneContent.classList.remove("hidden");
    selectedFileInfo.classList.add("hidden");
    btnUpload.disabled = true;
    hideAlert();
    resultsSection.classList.add("hidden");
}

// Upload & Process Workflow
async function processImageUpload() {
    if (!currentFile) return;

    try {
        btnUpload.disabled = true;
        showStatus("Uploading original image to Supabase Storage...", 25);
        hideAlert();

        // 1. Generate unique file path
        const fileExt = currentFile.name.split(".").pop();
        const fileNameWithoutExt = currentFile.name.substring(0, currentFile.name.lastIndexOf(".")) || "image";
        const sanitizedName = fileNameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_");
        const uploadPath = `uploads/${sanitizedName}_${Date.now()}.${fileExt}`;

        // 2. Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uploadPath, currentFile, {
                contentType: currentFile.type,
                upsert: true,
            });

        if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        showStatus("Invoking Edge Function 'image-resizer'...", 60);

        // 3. Invoke Supabase Edge Function 'image-resizer'
        const functionUrl = `${SUPABASE_URL}/functions/v1/image-resizer`;
        const response = await fetch(functionUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                bucket: BUCKET_NAME,
                imagePath: uploadData.path,
            }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || result.details || "Edge function processing failed.");
        }

        showStatus("Processing complete! Rendering metrics...", 100);

        // 4. Render Results
        displayResults(result);
        showAlert("success", "Image successfully uploaded, resized to max 1200px, and compressed!");

    } catch (err) {
        console.error("Error during processing:", err);
        showAlert("error", err.message || "An unexpected error occurred.");
    } finally {
        setTimeout(() => {
            statusContainer.classList.add("hidden");
            btnUpload.disabled = false;
        }, 1200);
    }
}

// Display Processing Results
function displayResults(data) {
    resultsSection.classList.remove("hidden");

    // Summary Cards
    summarySpaceSaved.textContent = data.metrics.compressionPercentage;
    summarySizeSaved.textContent = data.metrics.bytesSavedFormatted;

    // Original Details
    imgOriginalPreview.src = data.original.url;
    metaOrigSize.textContent = data.original.sizeFormatted;
    metaOrigDimensions.textContent = `${data.original.dimensions.width} x ${data.original.dimensions.height} px`;
    metaOrigPath.textContent = data.original.path;

    // Optimized Details
    imgOptimizedPreview.src = data.optimized.url;
    metaOptSize.textContent = data.optimized.sizeFormatted;
    metaOptDimensions.textContent = `${data.optimized.dimensions.width} x ${data.optimized.dimensions.height} px`;
    metaOptPath.textContent = data.optimized.path;
    badgeCompression.textContent = `Saved ${data.metrics.compressionPercentage}`;
    btnDownloadOptimized.href = data.optimized.url;

    // JSON Dump
    jsonOutput.textContent = JSON.stringify(data, null, 2);

    // Scroll smoothly to results
    resultsSection.scrollIntoView({ behavior: "smooth" });
}

// UI Helper Functions
function showStatus(text, percentage) {
    statusContainer.classList.remove("hidden");
    statusText.textContent = text;
    statusPercentage.textContent = `${percentage}%`;
    progressBarFill.style.width = `${percentage}%`;
}

function showAlert(type, message) {
    alertBox.className = `alert ${type}`;
    alertMessage.textContent = message;
    alertBox.classList.remove("hidden");
}

function hideAlert() {
    alertBox.classList.add("hidden");
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
