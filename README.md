# Cloud Image Resizer & Compressor

**Course:** Cloud Computing Practical Assignment  
**Student Name:** Madhu Soodhan S  
**Register Number:** 24UG00211  
**Supabase Project Ref:** `tkrywxnqlitacdfwtwou`  
**Supabase Project URL:** `https://tkrywxnqlitacdfwtwou.supabase.co`  
**Tech Stack:** Supabase Storage, Supabase Edge Functions (Deno / TypeScript), HTML5 / CSS3 / JavaScript  

---

## 1. Problem Statement

Modern cloud web applications receive user-uploaded images that are frequently large in dimensions (e.g., 4K/1080p camera photos) and uncompressed in file size (multiple megabytes). Storing and serving high-resolution raw images directly from cloud storage degrades page load performance, increases bandwidth utilization costs, and wastes cloud storage quota. There is a need for an automated serverless cloud processing function that resizes high-resolution uploads to a standard web maximum width and compresses them while preserving visual fidelity.

---

## 2. Objective

Build an end-to-end cloud image resizing and compression system using **Supabase Storage** and **Supabase Edge Functions**. The system must automatically take images uploaded to storage, download them into a serverless edge environment, resize images exceeding 1200px width down to 1200px (maintaining aspect ratio), compress the file size, store the optimized image back to Supabase Storage in an `optimized/` subfolder, and return processing metrics (dimensions, file sizes, and compression percentage).

---

## 3. Technologies Used

* **Cloud Object Storage:** Supabase Storage (Bucket: `image-uploads`)
* **Serverless Compute Layer:** Supabase Edge Functions (Deno / TypeScript)
* **Image Processing Engine:** `ImageScript` (Deno WASM / Pure JS image processing engine)
* **Database & Security:** Supabase PostgreSQL with Row Level Security (RLS) Policies
* **CLI & Deployment Tools:** Supabase CLI v2.101.0
* **Frontend Test Interface:** HTML5, Modern Vanilla CSS (Glassmorphism), JavaScript (ES6+), Supabase JS SDK v2

---

## 4. Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              USER CLIENT                                |
|   (Frontend Web Interface / HTTP API Client / File Drag & Drop)        |
+-------------------------------------------------------------------------+
                                    |
                                    | 1. Upload original image (JPG/PNG/WEBP)
                                    v
+-------------------------------------------------------------------------+
|                           SUPABASE STORAGE                              |
|                   Project: [tkrywxnqlitacdfwtwou]                       |
|                       Bucket: [image-uploads]                           |
|                      Subfolder: /uploads/*.jpg                          |
+-------------------------------------------------------------------------+
                                    |
                                    | 2. Edge Function Invocation (API / Storage Event)
                                    v
+-------------------------------------------------------------------------+
|                        SUPABASE EDGE FUNCTION                           |
|                        Function: [image-resizer]                        |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | 1. Input Validation & MIME Type Check                             |  |
|  | 2. Download Original File Buffer via Supabase Storage SDK         |  |
|  | 3. Decode Image Dimensions (Width x Height)                       |  |
|  | 4. Aspect Ratio Resizing (If Width > 1200px -> Width = 1200px)    |  |
|  | 5. Quality Compression (Quality 75 Encoding)                      |  |
|  | 6. Upload Processed Image to /optimized/* Subfolder             |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
                                    |
                                    | 3. Save optimized binary
                                    v
+-------------------------------------------------------------------------+
|                           SUPABASE STORAGE                              |
|                       Bucket: [image-uploads]                           |
|                    Subfolder: /optimized/*.jpg                          |
+-------------------------------------------------------------------------+
                                    |
                                    | 4. Return JSON Metrics & Public URLs
                                    v
+-------------------------------------------------------------------------+
|                              USER CLIENT                                |
|   (Renders Original vs. Optimized Preview, Sizes, & % Reduction)       |
+-------------------------------------------------------------------------+
```

---

## 5. Workflow Execution Steps

1. **User Upload:** The user selects or drags an image file (`.jpg`, `.jpeg`, `.png`, `.webp`) in the frontend interface.
2. **Storage Ingestion:** The frontend uploads the raw image to Supabase Storage inside `image-uploads/uploads/<filename>`.
3. **Function Triggering:** The frontend invokes the `image-resizer` Supabase Edge Function passing `{ "bucket": "image-uploads", "imagePath": "uploads/<filename>" }`.
4. **Cloud Processing:**
   - The Edge Function retrieves the file from Supabase Storage using service role credentials.
   - It validates that the file exists and is a supported MIME type.
   - It decodes image pixels and inspects the width and height.
   - If the width exceeds 1200px, it resizes the width to 1200px while scaling height proportionally (`targetHeight = Math.round(originalHeight * (1200 / originalWidth))`).
   - It applies quality compression (Quality 75 JPEG encoding).
5. **Storage Persistence:** The compressed image is written to `image-uploads/optimized/<filename>-optimized.jpg` without overwriting the raw original file.
6. **Metrics Response:** The function calculates exact original size, optimized size, dimension changes, and compression percentage (`((Original - Optimized) / Original) * 100`), returning structured JSON metrics to the user.

---

## 6. Supabase Storage Setup

1. **Bucket Name:** `image-uploads` (Public Bucket)
2. **Target Project:** `tkrywxnqlitacdfwtwou` (`https://tkrywxnqlitacdfwtwou.supabase.co`)
3. **Row Level Security (RLS) Policies Applied:**
   - **SELECT Policy:** Allows public read access to all images inside `image-uploads`.
   - **INSERT Policy:** Allows public / client uploads into `image-uploads`.

```sql
-- SQL Setup Executed on tkrywxnqlitacdfwtwou
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('image-uploads', 'image-uploads', true, 10485760, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

CREATE POLICY "Allow public select on image-uploads" ON storage.objects FOR SELECT TO public USING (bucket_id = 'image-uploads');
CREATE POLICY "Allow public insert on image-uploads" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'image-uploads');
```

---

## 7. Edge Function Setup & Code Architecture

The Edge Function is deployed to `tkrywxnqlitacdfwtwou` at `supabase/functions/image-resizer/index.ts`.

### Key Functions & Implementation Highlights (Viva Voce Reference)

* **Receiving Image Path:** The function inspects the incoming JSON HTTP request payload (`req.json()`) or Supabase Storage Webhook payload (`req.body.record`).
* **Accessing Supabase Storage:** It instantiates the Supabase JS client using serverless environment variables `Deno.env.get("SUPABASE_URL")` and `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`, executing `supabase.storage.from(bucket).download(imagePath)`.
* **Aspect-Ratio Resizing Logic:**
  ```typescript
  if (originalWidth > 1200) {
    targetWidth = 1200;
    targetHeight = Math.round((originalHeight / originalWidth) * 1200);
    image.resize(targetWidth, targetHeight);
  }
  ```
* **Image Compression Logic:**
  ```typescript
  const COMPRESSION_QUALITY = 75;
  const optimizedBuffer = await image.encodeJPEG(COMPRESSION_QUALITY);
  ```
* **Uploading Optimized Binary:**
  ```typescript
  await supabase.storage.from(bucket).upload(`optimized/${fileName}-optimized.jpg`, optimizedBuffer, {
    contentType: "image/jpeg",
    upsert: true,
  });
  ```
* **Compression Percentage Formula:**
  $$\text{Compression \%} = \left( \frac{\text{Original Size} - \text{Optimized Size}}{\text{Original Size}} \right) \times 100$$

---

## 8. Empirical Test Execution Results (Verified on tkrywxnqlitacdfwtwou)

An automated end-to-end cloud processing test was executed on project `tkrywxnqlitacdfwtwou` with a high-resolution 1600x1200 image file:

| Metric Parameter | Original Image | Optimized Image | Difference / Saving |
| :--- | :--- | :--- | :--- |
| **Storage Path** | `uploads/sample-1600x1200-1789100231162.jpg` | `optimized/sample-1600x1200-1789100231162-optimized.jpg` | Separate folder in bucket |
| **Dimensions (WxH)** | **1600 x 1200 pixels** | **1200 x 900 pixels** | **Resized to Max 1200px** |
| **File Size (Bytes)** | **318,372 Bytes** | **217,310 Bytes** | **101,062 Bytes Saved** |
| **File Size (Formatted)** | **310.91 KB** | **212.22 KB** | **98.69 KB Saved** |
| **Compression Ratio** | — | — | **31.74% Space Saved** |
| **HTTP Status Code** | 200 OK | 200 OK | Success |

#### Compression Percentage Calculation Verification:
$$\text{Compression \%} = \left( \frac{318372 - 217310}{318372} \right) \times 100 = \left( \frac{101062}{318372} \right) \times 100 = 31.7433\% \approx 31.74\%$$

---

## 9. Sample JSON Response from Project `tkrywxnqlitacdfwtwou`

```json
{
  "success": true,
  "message": "Image processed, resized, and compressed successfully!",
  "studentDetails": {
    "name": "Madhu Soodhan S",
    "registerNumber": "24UG00211"
  },
  "original": {
    "path": "uploads/sample-1600x1200-1789100231162.jpg",
    "sizeBytes": 318372,
    "sizeFormatted": "310.91 KB",
    "dimensions": {
      "width": 1600,
      "height": 1200
    },
    "url": "https://tkrywxnqlitacdfwtwou.supabase.co/storage/v1/object/public/image-uploads/uploads/sample-1600x1200-1789100231162.jpg"
  },
  "optimized": {
    "path": "optimized/sample-1600x1200-1789100231162-optimized.jpg",
    "sizeBytes": 217310,
    "sizeFormatted": "212.22 KB",
    "dimensions": {
      "width": 1200,
      "height": 900
    },
    "url": "https://tkrywxnqlitacdfwtwou.supabase.co/storage/v1/object/public/image-uploads/optimized/sample-1600x1200-1789100231162-optimized.jpg"
  },
  "metrics": {
    "compressionPercentage": "31.74%",
    "bytesSaved": 101062,
    "bytesSavedFormatted": "98.69 KB",
    "maxWidthConstraint": 1200
  }
}
```

---

## 10. Result & Conclusion

The **Image Resizer** project for **Madhu Soodhan S (Reg: 24UG00211)** has been deployed and verified on Supabase project **`tkrywxnqlitacdfwtwou`**. Images uploaded to storage bucket `image-uploads` are automatically processed by the `image-resizer` Edge Function, resized from 1600px width down to 1200px width (preserving a 4:3 aspect ratio), compressed by 31.74%, saved in `optimized/`, and rendered on the frontend interface with empirical metrics.
