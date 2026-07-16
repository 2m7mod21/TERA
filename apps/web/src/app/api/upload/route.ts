import { NextRequest, NextResponse } from "next/server";
import { LocalStorageProvider } from "lib/storage";
import sharp from "sharp";
import * as path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ success: false, error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let finalBuffer = buffer;
    let fileName = file.name;
    let mimeType = file.type;

    // Optimize static images with Sharp (convert to webp and resize to max width 1920)
    if (file.type.startsWith("image/") && !file.type.endsWith("gif")) {
      try {
        finalBuffer = Buffer.from(await sharp(buffer)
          .resize({ width: 1920, withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer());
        
        const ext = path.extname(file.name);
        fileName = file.name.replace(ext, ".webp");
        mimeType = "image/webp";
      } catch (sharpError) {
        console.error("Sharp optimization failed, using original file instead:", sharpError);
      }
    }

    const storage = new LocalStorageProvider();
    const fileUrl = await storage.uploadFile(finalBuffer, fileName, mimeType);

    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
