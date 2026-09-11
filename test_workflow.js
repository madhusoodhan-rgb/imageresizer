const fs = require('fs');
const http = require('https');
const { createClient } = require('@supabase/supabase-js');

// Create a high resolution 1600x1200 test PNG image using pure JS canvas/BMP generator if needed
// Or download a high quality sample test image from public URL
const TEST_IMAGE_URL = 'https://picsum.photos/1600/1200';
const LOCAL_IMAGE_PATH = './test-image-1600x1200.jpg';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tkrywxnqlitacdfwtwou.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrcnl3eG5xbGl0YWNkZnd0d291Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwODgwMzIsImV4cCI6MjEwNDY2NDAzMn0.IiQpFFFxQvTJertl9E6JNy61BxF8qdWxf9N71GYqXMo';

async function downloadSampleImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        http.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                return downloadSampleImage(response.headers.location, dest).then(resolve).catch(reject);
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close(() => resolve(dest));
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function testWorkflow() {
    console.log("1. Downloading high-res sample image (1600x1200)...");
    await downloadSampleImage(TEST_IMAGE_URL, LOCAL_IMAGE_PATH);
    const stats = fs.statSync(LOCAL_IMAGE_PATH);
    console.log(`Downloaded image size: ${stats.size} bytes (${(stats.size / 1024).toFixed(2)} KB)`);

    console.log("\n2. Uploading original image to Supabase Storage bucket 'image-uploads'...");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const imageBuffer = fs.readFileSync(LOCAL_IMAGE_PATH);
    const remotePath = `uploads/sample-1600x1200-${Date.now()}.jpg`;

    const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('image-uploads')
        .upload(remotePath, imageBuffer, {
            contentType: 'image/jpeg',
            upsert: true
        });

    if (uploadErr) {
        console.error("Upload failed:", uploadErr);
        return;
    }
    console.log("Upload successful! File path in storage:", uploadData.path);

    console.log("\n3. Invoking Supabase Edge Function 'image-resizer'...");
    const funcUrl = `${SUPABASE_URL}/functions/v1/image-resizer`;
    const response = await fetch(funcUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
            bucket: 'image-uploads',
            imagePath: remotePath
        })
    });

    const result = await response.json();
    console.log("\n================ EDGE FUNCTION RESPONSE ================");
    console.log(JSON.stringify(result, null, 2));
    console.log("========================================================");
}

testWorkflow().catch(console.error);
