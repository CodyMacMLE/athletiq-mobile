import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region: process.env.AWS_REGION || "us-east-2",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET = process.env.S3_BUCKET_NAME || "athletiq-profile-pictures";

const ALLOWED_FILE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
};

export async function generateProfilePictureUploadUrl(
  userId: string,
  fileType: string
): Promise<{ uploadUrl: string; publicUrl: string }> {
  const ext = ALLOWED_FILE_TYPES[fileType];
  if (!ext) {
    throw new Error(
      `Unsupported file type: ${fileType}. Allowed: ${Object.keys(ALLOWED_FILE_TYPES).join(", ")}`
    );
  }

  const key = `profile-pictures/${userId}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const publicUrl = `https://${BUCKET}.s3.us-east-2.amazonaws.com/${key}`;

  return { uploadUrl, publicUrl };
}
