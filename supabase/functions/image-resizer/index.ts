// ============================================================================
// Supabase Edge Function: image-resizer
// Student Name: Madhu Soodhan S
// Register Number: 24UG00211
// Course: Cloud Computing Assignment - Image Resizer & Compressor
// ============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { Image } from "https://deno.land/x/imagescript@1.2.15/mod.ts";

// Standard CORS headers for cross-origin frontend requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req: Request) => {
  // 1. Handle CORS Pre-flight Options Request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Read Request Payload
    // How the function receives the image path:
    // The request body can either come directly from a client call ({ bucket, imagePath })
    // or from a Supabase Storage Webhook trigger ({ record: { bucket_id, name } }).
    let bucket = "image-uploads";
    let imagePath = "";

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      
      // Check if payload comes from direct client request
      if (body.imagePath) {
        imagePath = body.imagePath;
        if (body.bucket) bucket = body.bucket;
      } 
      // Check if payload comes from Supabase Storage Webhook Trigger
      else if (body.record && body.record.name) {
        imagePath = body.record.name;
        if (body.record.bucket_id) bucket = body.record.bucket_id;
      }
    }

    // Input Validation: Check missing storage path
    if (!imagePath) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameter 'imagePath'. Please provide the file path in Supabase Storage.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Ignore already optimized images to prevent infinite loops if stored in same bucket
    if (imagePath.startsWith("optimized/") || imagePath.includes("-optimized.")) {
      return new Response(
        JSON.stringify({
          message: "File is already in optimized path. Skipping processing.",
          imagePath,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. How it accesses Supabase Storage:
    // Initialize Supabase Client using environment variables (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Supabase environment variables (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) are missing.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log(`[image-resizer] Downloading image '${imagePath}' from bucket '${bucket}'...`);

    // Download original image bytes from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(imagePath);

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({
          error: `File not found in Supabase Storage bucket '${bucket}': ${imagePath}`,
          details: downloadError?.message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Input Validation: Check MIME type
    const mimeType = fileData.type.toLowerCase();
    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg", "application/octet-stream"];
    const isExtensionValid = /\.(jpg|jpeg|png|webp)$/i.test(imagePath);

    if (!isExtensionValid && !validTypes.some(t => mimeType.includes(t))) {
      return new Response(
        JSON.stringify({
          error: `Unsupported file format: ${mimeType}. Only JPG, PNG, and WEBP images are supported.`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const originalBuffer = new Uint8Array(await fileData.arrayBuffer());
    const originalSize = originalBuffer.byteLength;

    // 4. How decoding and resizing works:
    // Decode image buffer using ImageScript engine
    let image: Image;
    try {
      image = (await Image.decode(originalBuffer)) as Image;
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Failed to decode image file. File may be corrupted or invalid image format.",
          details: String(err),
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const originalWidth = image.width;
    const originalHeight = image.height;

    // Calculate aspect-ratio preserving dimensions (Max Width: 1200px)
    const MAX_WIDTH = 1200;
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    if (originalWidth > MAX_WIDTH) {
      targetWidth = MAX_WIDTH;
      // Maintain aspect ratio: (originalHeight / originalWidth) * targetWidth
      targetHeight = Math.round((originalHeight / originalWidth) * MAX_WIDTH);
      
      // Perform resize using high-quality aspect-preserving algorithm
      image.resize(targetWidth, targetHeight);
      console.log(`[image-resizer] Resized image from ${originalWidth}x${originalHeight} to ${targetWidth}x${targetHeight}`);
    } else {
      console.log(`[image-resizer] Image width ${originalWidth}px <= ${MAX_WIDTH}px. Retaining dimensions.`);
    }

    // 5. How compression works:
    // Compress image and encode to output format (JPEG quality 75 for optimal size/quality ratio)
    // Quality 75 preserves high visual fidelity while reducing byte size by 40-70%.
    const COMPRESSION_QUALITY = 75;
    const optimizedBuffer = await image.encodeJPEG(COMPRESSION_QUALITY);
    const optimizedSize = optimizedBuffer.byteLength;

    // Calculate compression percentage: ((Original Size - Optimized Size) / Original Size) * 100
    const rawCompressionRatio = ((originalSize - optimizedSize) / originalSize) * 100;
    const compressionPercentage = Math.max(0, parseFloat(rawCompressionRatio.toFixed(2)));

    // 6. How the optimized image is uploaded:
    // Construct target optimized path inside `optimized/` subfolder to avoid overwriting original
    const pathParts = imagePath.split("/");
    const fileName = pathParts.pop() || "image.jpg";
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf(".")) || fileName;
    
    // Save to optimized/ folder inside same storage bucket
    const optimizedPath = `optimized/${nameWithoutExt}-optimized.jpg`;

    console.log(`[image-resizer] Uploading optimized image to '${optimizedPath}'...`);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(optimizedPath, optimizedBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return new Response(
        JSON.stringify({
          error: `Failed to upload optimized image to Supabase Storage: ${uploadError.message}`,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate Public URLs for both original and optimized images
    const { data: originalUrlData } = supabase.storage.from(bucket).getPublicUrl(imagePath);
    const { data: optimizedUrlData } = supabase.storage.from(bucket).getPublicUrl(optimizedPath);

    // 7. How the response is generated:
    // Return structured JSON response with detailed metrics
    const responsePayload = {
      success: true,
      message: "Image processed, resized, and compressed successfully!",
      studentDetails: {
        name: "Madhu Soodhan S",
        registerNumber: "24UG00211",
      },
      original: {
        path: imagePath,
        sizeBytes: originalSize,
        sizeFormatted: formatBytes(originalSize),
        dimensions: {
          width: originalWidth,
          height: originalHeight,
        },
        url: originalUrlData.publicUrl,
      },
      optimized: {
        path: optimizedPath,
        sizeBytes: optimizedSize,
        sizeFormatted: formatBytes(optimizedSize),
        dimensions: {
          width: targetWidth,
          height: targetHeight,
        },
        url: optimizedUrlData.publicUrl,
      },
      metrics: {
        compressionPercentage: `${compressionPercentage}%`,
        bytesSaved: Math.max(0, originalSize - optimizedSize),
        bytesSavedFormatted: formatBytes(Math.max(0, originalSize - optimizedSize)),
        maxWidthConstraint: MAX_WIDTH,
      },
    };

    return new Response(JSON.stringify(responsePayload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[image-resizer] Processing Error:", err);
    return new Response(
      JSON.stringify({
        error: "An error occurred during image processing.",
        details: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// Helper function to format byte size into human readable string
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
