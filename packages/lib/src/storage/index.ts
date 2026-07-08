import * as fs from "fs/promises";
import * as path from "path";

export interface StorageProvider {
  uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string): Promise<string>;
  deleteFile(fileUrl: string): Promise<void>;
}

// Local filesystem mock of S3-compatible storage
export class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;
  private publicPath: string;

  constructor() {
    // In a Next.js environment, we write to public/uploads directory during dev
    this.uploadDir = path.join(process.cwd(), "public", "uploads");
    this.publicPath = "/uploads";
  }

  private async ensureDir() {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, _mimeType: string): Promise<string> {
    await this.ensureDir();
    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const targetPath = path.join(this.uploadDir, safeName);
    
    await fs.writeFile(targetPath, fileBuffer);
    
    // Return relative URL for static serving
    return `${this.publicPath}/${safeName}`;
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (!fileUrl.startsWith(this.publicPath)) {
      return; // Only delete local upload files
    }
    const fileName = fileUrl.replace(`${this.publicPath}/`, "");
    const filePath = path.join(this.uploadDir, fileName);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      console.error(`Failed to delete local file ${filePath}:`, err);
    }
  }
}
