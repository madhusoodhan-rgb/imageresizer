// ============================================================================
// Image Resizer - Frontend Application Logic
// Student: Madhu Soodhan S | Register: 24UG00211
// ============================================================================

// Supabase Configuration for Project tkrywxnqlitacdfwtwou
const SUPABASE_URL = "https://tkrywxnqlitacdfwtwou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcnl3eG5xbGl0YWNkZnd0d291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODgwMzIsImV4cCI6MjEwNDY2NDAzMn0.IiQpFFFxQvTJertl9E6JNy61BxF8qdWxf9N71GYqXMo";
const BUCKET_NAME = "image-uploads";

// Initialize Supabase Client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.error("[Image Resizer] Error initializing Supabase client:", e);
}

// DOM Elements
const dropZone = document.getElementById("dropZone");
const dropZoneContent = document.getElementById("dropZoneContent");
const fileInput = document.getElementById("fileInput");
const selectedFileInfo = document.getElementById("selectedFileInfo");
const selectedFilePreview = document.getElementById("selectedFilePreview");
const selectedFileIcon = document.getElementById("selectedFileIcon");
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

// Ensure file input is enabled and reset
if (fileInput) {
    fileInput.disabled = false;
}

// Click on dropzone container -> opens native file picker
dropZone.addEventListener("click", (e) => {
    // Ignore if clicking remove button or fileInput itself
    if (e.target.closest("#btnRemoveFile")) {
        e.preventDefault();
        e.stopPropagation();
        return;
    }
    if (e.target !== fileInput) {
        console.log("[Image Resizer] Dropzone clicked -> opening native file picker");
        fileInput.click();
    }
});

// Stop fileInput click from bubbling back to dropZone
fileInput.addEventListener("click", (e) => {
    e.stopPropagation();
});

// Native file input change listener
fileInput.addEventListener("change", (e) => {
    try {
        console.log("[Image Resizer] Native fileInput change event triggered!", e.target.files);
        const file = e.target.files && e.target.files[0];
        if (file) {
            handleFileSelect(file);
        } else {
            console.warn("[Image Resizer] fileInput change event fired with 0 files.");
        }
    } catch (err) {
        console.error("[Image Resizer] Error in fileInput change listener:", err);
    }
});

// Drag & Drop Listeners
["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add("dragover");
    });
});

["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove("dragover");
    });
});

dropZone.addEventListener("drop", (e) => {
    try {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
            console.log("[Image Resizer] File dropped:", file.name, file.size, file.type);
            handleFileSelect(file);
        }
    } catch (err) {
        console.error("[Image Resizer] Error in drop listener:", err);
    }
});

btnRemoveFile.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetFileSelection();
});

btnUpload.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    processImageUpload();
});

btnCopyJson.addEventListener("click", () => {
    navigator.clipboard.writeText(jsonOutput.innerText);
    btnCopyJson.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => {
        btnCopyJson.innerHTML = '<i class="fa-regular fa-copy"></i> Copy JSON';
    }, 2000);
});

// File Selection Handler
function handleFileSelect(file) {
    if (!file) {
        console.error("[Image Resizer] handleFileSelect received null/undefined file.");
        return;
    }

    console.log(`[Image Resizer] Processing file selection: ${file.name} (${file.size} bytes, type: ${file.type})`);

    // Validate MIME type & file extension
    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    const isExtValid = /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    const isMimeValid = file.type ? validMimes.includes(file.type.toLowerCase()) : false;

    if (!isExtValid && !isMimeValid) {
        const errMsg = `Invalid file type for "${file.name}". Please select a JPG, PNG, or WEBP image.`;
        console.error(`[Image Resizer] Validation Error: ${errMsg}`);
        showAlert("error", errMsg);
        return;
    }

    // Validate size (< 10MB)
    if (file.size > 10 * 1024 * 1024) {
        const errMsg = `File size (${formatBytes(file.size)}) exceeds 10MB limit.`;
        console.error(`[Image Resizer] Validation Error: ${errMsg}`);
        showAlert("error", errMsg);
        return;
    }

    // Update state
    currentFile = file;

    // Update file details in UI
    selectedFileName.textContent = file.name;
    selectedFileSize.textContent = formatBytes(file.size);

    // Generate instant preview thumbnail
    try {
        const objectUrl = URL.createObjectURL(file);
        if (selectedFilePreview) {
            selectedFilePreview.src = objectUrl;
            selectedFilePreview.classList.remove("hidden");
        }
        if (selectedFileIcon) {
            selectedFileIcon.classList.add("hidden");
        }
    } catch (err) {
        console.warn("[Image Resizer] Could not create ObjectURL for preview:", err);
    }

    // Update UI visibility
    dropZoneContent.classList.add("hidden");
    selectedFileInfo.classList.remove("hidden");

    // Enable Upload Button
    btnUpload.disabled = false;
    hideAlert();

    console.log("[Image Resizer] File selection successful! Upload & Resize button is ENABLED.");
}

function resetFileSelection() {
    console.log("[Image Resizer] Resetting file selection.");
    currentFile = null;
    fileInput.value = "";
    selectedFileName.textContent = "";
    selectedFileSize.textContent = "";

    if (selectedFilePreview) {
        selectedFilePreview.src = "";
        selectedFilePreview.classList.add("hidden");
    }
    if (selectedFileIcon) {
        selectedFileIcon.classList.remove("hidden");
    }

    dropZoneContent.classList.remove("hidden");
    selectedFileInfo.classList.add("hidden");
    btnUpload.disabled = true;
    hideAlert();
    resultsSection.classList.add("hidden");
}

// Upload & Process Workflow
async function processImageUpload() {
    if (!currentFile) {
        console.error("[Image Resizer] processImageUpload called without currentFile.");
        return;
    }

    try {
        btnUpload.disabled = true;
        showStatus("Uploading original image to Supabase Storage...", 25);
        hideAlert();

        // 1. Generate unique file path
        const fileExt = currentFile.name.split(".").pop();
        const fileNameWithoutExt = currentFile.name.substring(0, currentFile.name.lastIndexOf(".")) || "image";
        const sanitizedName = fileNameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_");
        const uploadPath = `uploads/${sanitizedName}_${Date.now()}.${fileExt}`;

        console.log(`[Image Resizer] Uploading ${currentFile.name} to ${uploadPath}...`);

        // 2. Upload file to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(uploadPath, currentFile, {
                contentType: currentFile.type || "image/jpeg",
                upsert: true,
            });

        if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        console.log(`[Image Resizer] Upload success. Remote path: ${uploadData.path}`);
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

        console.log("[Image Resizer] Edge Function returned success:", result);
        showStatus("Processing complete! Rendering metrics...", 100);

        // 4. Render Results
        displayResults(result);
        showAlert("success", "Image successfully uploaded, resized to max 1200px, and compressed!");

    } catch (err) {
        console.error("[Image Resizer] Processing Error:", err);
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
