// ============================================================================
// Image Resizer - Frontend Application Logic
// Student: Madhu Soodhan S | Register: 24UG00211
// ============================================================================

// Supabase Configuration for Project tkrywxnqlitacdfwtwou
const SUPABASE_URL = "https://tkrywxnqlitacdfwtwou.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcnl3eG5xbGl0YWNkZnd0d291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODgwMzIsImV4cCI6MjEwNDY2NDAzMn0.IiQpFFFxQvTJertl9E6JNy61BxF8qdWxf9N71GYqXMo";
const BUCKET_NAME = "image-uploads";

// Initialize Supabase Client safely
let supabase = null;
try {
    if (window.supabase && typeof window.supabase.createClient === "function") {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("[DEBUG] Supabase client initialized successfully.");
    } else {
        console.warn("[DEBUG] window.supabase not available yet.");
    }
} catch (e) {
    console.error("[DEBUG] Error initializing Supabase client:", e);
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

// Ensure fileInput exists and is enabled
if (fileInput) {
    fileInput.disabled = false;
    console.log("[DEBUG] fileInput initialized. disabled =", fileInput.disabled);
} else {
    console.error("[DEBUG] fileInput element NOT FOUND in DOM!");
}

// Click on dropzone container -> opens native file picker
if (dropZone) {
    dropZone.addEventListener("click", (e) => {
        if (e.target && e.target.closest("#btnRemoveFile")) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        if (fileInput) {
            console.log("[DEBUG] dropzone clicked -> calling fileInput.click()");
            fileInput.click();
        }
    });
} else {
    console.error("[DEBUG] dropZone element NOT FOUND in DOM!");
}

// Prevent click bubbling on fileInput
if (fileInput) {
    fileInput.addEventListener("click", (e) => {
        e.stopPropagation();
    });

    // Native file input change listener with required diagnostic logging
    fileInput.addEventListener("change", (e) => {
        console.log("[DEBUG] file input change fired");
        console.log("[DEBUG] files:", e.target.files);
        console.log("[DEBUG] selected file:", e.target.files?.[0]);

        const file = e.target.files && e.target.files[0];
        if (file) {
            handleFileSelect(file);
        } else {
            console.warn("[DEBUG] file input change fired but no file present.");
        }
    });
}

// Drag & Drop Listeners
if (dropZone) {
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
            console.log("[DEBUG] file dropped:", file);
            if (file) {
                handleFileSelect(file);
            }
        } catch (err) {
            console.error("[DEBUG] Error handling dropped file:", err);
        }
    });
}

if (btnRemoveFile) {
    btnRemoveFile.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        resetFileSelection();
    });
}

if (btnUpload) {
    btnUpload.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        processImageUpload();
    });
}

if (btnCopyJson) {
    btnCopyJson.addEventListener("click", () => {
        if (jsonOutput) {
            navigator.clipboard.writeText(jsonOutput.innerText);
            btnCopyJson.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                btnCopyJson.innerHTML = '<i class="fa-regular fa-copy"></i> Copy JSON';
            }, 2000);
        }
    });
}

// File Selection Handler
function handleFileSelect(file) {
    console.log("[DEBUG] handleFileSelect received file:", file);
    if (!file) {
        console.error("[DEBUG] handleFileSelect called with invalid/null file.");
        return;
    }

    console.log(`[DEBUG] Processing file: ${file.name} (${file.size} bytes, type: ${file.type})`);

    // Validate MIME type & file extension
    const validMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    const isExtValid = /\.(jpg|jpeg|png|webp)$/i.test(file.name);
    const isMimeValid = file.type ? validMimes.includes(file.type.toLowerCase()) : false;

    console.log("[DEBUG] File validation result:", { name: file.name, isExtValid, isMimeValid });

    if (!isExtValid && !isMimeValid) {
        const errMsg = `Invalid file type for "${file.name}". Please select a JPG, PNG, or WEBP image.`;
        console.error(`[DEBUG] Validation Error: ${errMsg}`);
        showAlert("error", errMsg);
        return;
    }

    // Validate size (< 10MB)
    if (file.size > 10 * 1024 * 1024) {
        const errMsg = `File size (${formatBytes(file.size)}) exceeds 10MB limit.`;
        console.error(`[DEBUG] Validation Error: ${errMsg}`);
        showAlert("error", errMsg);
        return;
    }

    // Store in application state variable
    currentFile = file;

    // Update UI text details
    if (selectedFileName) selectedFileName.textContent = file.name;
    if (selectedFileSize) selectedFileSize.textContent = formatBytes(file.size);

    // Generate instant preview thumbnail
    if (selectedFilePreview) {
        try {
            const objectUrl = URL.createObjectURL(file);
            selectedFilePreview.src = objectUrl;
            selectedFilePreview.classList.remove("hidden");
            console.log("[DEBUG] Instant preview ObjectURL set:", objectUrl);
        } catch (err) {
            console.warn("[DEBUG] Error generating ObjectURL for preview:", err);
        }
    }
    if (selectedFileIcon) {
        selectedFileIcon.classList.add("hidden");
    }

    // Update UI visibility
    if (dropZoneContent) dropZoneContent.classList.add("hidden");
    if (selectedFileInfo) selectedFileInfo.classList.remove("hidden");

    // Enable Upload & Resize Image button
    if (btnUpload) {
        btnUpload.disabled = false;
        console.log("[DEBUG] Upload button enabled: btnUpload.disabled =", btnUpload.disabled);
    }

    hideAlert();
    console.log("[DEBUG] handleFileSelect complete. UI successfully updated.");
}

function resetFileSelection() {
    console.log("[DEBUG] Resetting file selection.");
    currentFile = null;
    if (fileInput) fileInput.value = "";
    if (selectedFileName) selectedFileName.textContent = "";
    if (selectedFileSize) selectedFileSize.textContent = "";

    if (selectedFilePreview) {
        selectedFilePreview.src = "";
        selectedFilePreview.classList.add("hidden");
    }
    if (selectedFileIcon) {
        selectedFileIcon.classList.remove("hidden");
    }

    if (dropZoneContent) dropZoneContent.classList.remove("hidden");
    if (selectedFileInfo) selectedFileInfo.classList.add("hidden");
    if (btnUpload) btnUpload.disabled = true;
    hideAlert();
    if (resultsSection) resultsSection.classList.add("hidden");
}

// Upload & Process Workflow
async function processImageUpload() {
    if (!currentFile) {
        console.error("[DEBUG] processImageUpload called without currentFile.");
        return;
    }

    try {
        if (!supabase) {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        }

        if (btnUpload) btnUpload.disabled = true;
        showStatus("Uploading original image to Supabase Storage...", 25);
        hideAlert();

        // 1. Generate unique file path
        const fileExt = currentFile.name.split(".").pop();
        const fileNameWithoutExt = currentFile.name.substring(0, currentFile.name.lastIndexOf(".")) || "image";
        const sanitizedName = fileNameWithoutExt.replace(/[^a-zA-Z0-9_-]/g, "_");
        const uploadPath = `uploads/${sanitizedName}_${Date.now()}.${fileExt}`;

        console.log(`[DEBUG] Uploading ${currentFile.name} to ${uploadPath}...`);

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

        console.log(`[DEBUG] Upload success. Remote path: ${uploadData.path}`);
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

        console.log("[DEBUG] Edge Function returned success:", result);
        showStatus("Processing complete! Rendering metrics...", 100);

        // 4. Render Results
        displayResults(result);
        showAlert("success", "Image successfully uploaded, resized to max 1200px, and compressed!");

    } catch (err) {
        console.error("[DEBUG] Processing Error:", err);
        showAlert("error", err.message || "An unexpected error occurred.");
    } finally {
        setTimeout(() => {
            if (statusContainer) statusContainer.classList.add("hidden");
            if (btnUpload) btnUpload.disabled = false;
        }, 1200);
    }
}

// Display Processing Results
function displayResults(data) {
    if (resultsSection) resultsSection.classList.remove("hidden");

    // Summary Cards
    if (summarySpaceSaved) summarySpaceSaved.textContent = data.metrics.compressionPercentage;
    if (summarySizeSaved) summarySizeSaved.textContent = data.metrics.bytesSavedFormatted;

    // Original Details
    if (imgOriginalPreview) imgOriginalPreview.src = data.original.url;
    if (metaOrigSize) metaOrigSize.textContent = data.original.sizeFormatted;
    if (metaOrigDimensions) metaOrigDimensions.textContent = `${data.original.dimensions.width} x ${data.original.dimensions.height} px`;
    if (metaOrigPath) metaOrigPath.textContent = data.original.path;

    // Optimized Details
    if (imgOptimizedPreview) imgOptimizedPreview.src = data.optimized.url;
    if (metaOptSize) metaOptSize.textContent = data.optimized.sizeFormatted;
    if (metaOptDimensions) metaOptDimensions.textContent = `${data.optimized.dimensions.width} x ${data.optimized.dimensions.height} px`;
    if (metaOptPath) metaOptPath.textContent = data.optimized.path;
    if (badgeCompression) badgeCompression.textContent = `Saved ${data.metrics.compressionPercentage}`;
    if (btnDownloadOptimized) btnDownloadOptimized.href = data.optimized.url;

    // JSON Dump
    if (jsonOutput) jsonOutput.textContent = JSON.stringify(data, null, 2);

    // Scroll smoothly to results
    if (resultsSection) resultsSection.scrollIntoView({ behavior: "smooth" });
}

// UI Helper Functions
function showStatus(text, percentage) {
    if (statusContainer) statusContainer.classList.remove("hidden");
    if (statusText) statusText.textContent = text;
    if (statusPercentage) statusPercentage.textContent = `${percentage}%`;
    if (progressBarFill) progressBarFill.style.width = `${percentage}%`;
}

function showAlert(type, message) {
    if (alertBox) {
        alertBox.className = `alert ${type}`;
        if (alertMessage) alertMessage.textContent = message;
        alertBox.classList.remove("hidden");
    }
}

function hideAlert() {
    if (alertBox) alertBox.classList.add("hidden");
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
