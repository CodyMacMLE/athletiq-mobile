"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@apollo/client/react";
import { useAuth } from "@/contexts/AuthContext";
import { UPDATE_USER, GENERATE_UPLOAD_URL } from "@/lib/graphql";
import { Loader2, Camera } from "lucide-react";

export default function AccountPage() {
  const { user, refetch } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");

  // Profile picture
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Mutations
  const [updateUser, { loading: saving }] = useMutation(UPDATE_USER);
  const [generateUploadUrl] = useMutation<{
    generateUploadUrl: { uploadUrl: string; publicUrl: string };
  }>(GENERATE_UPLOAD_URL);

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setPhone(user.phone || "");
      setAddress(user.address || "");
      setCity(user.city || "");
      setCountry(user.country || "");
      if (user.image) {
        setImagePreview(user.image);
      }
    }
  }, [user]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setProfileError("Please select a JPEG, PNG, or WebP image.");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("Image must be under 5MB.");
      return;
    }

    setUploading(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      // Get pre-signed upload URL
      const { data } = await generateUploadUrl({
        variables: { fileType: file.type },
      });

      const { uploadUrl, publicUrl } = data!.generateUploadUrl;

      // Upload to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image");
      }

      // Update user with the public URL (cache-bust with timestamp)
      const imageUrl = `${publicUrl}?t=${Date.now()}`;
      await updateUser({
        variables: {
          id: user!.id,
          input: { image: imageUrl },
        },
      });

      setImagePreview(imageUrl);
      await refetch();
      setProfileSuccess("Profile picture updated!");
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to upload image";
      setProfileError(message);
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-selected
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess("");
    setProfileError("");

    try {
      await updateUser({
        variables: {
          id: user!.id,
          input: {
            firstName,
            lastName,
            phone: phone || undefined,
            address: address || undefined,
            city: city || undefined,
            country: country || undefined,
          },
        },
      });
      refetch();
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => setProfileSuccess(""), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update profile";
      setProfileError(message);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>

      {/* Avatar with upload */}
      <div className="flex items-center gap-4 mb-8">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative w-20 h-20 rounded-full overflow-hidden group shrink-0"
        >
          {imagePreview ? (
            <img
              src={imagePreview}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-[#6c5ce7] flex items-center justify-center text-white text-2xl font-medium">
              {user?.firstName?.[0]}
              {user?.lastName?.[0]}
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : (
              <Camera className="w-6 h-6 text-white" />
            )}
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleImageSelect}
          className="hidden"
        />
        <div>
          <h2 className="text-lg font-semibold text-white">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-sm text-white/55">{user?.email}</p>
        </div>
      </div>

      {profileSuccess && (
        <div className="mb-4 px-4 py-3 bg-green-500/10 border border-green-500 text-green-400 rounded-lg text-sm">
          {profileSuccess}
        </div>
      )}
      {profileError && (
        <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500 text-red-400 rounded-lg text-sm">
          {profileError}
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/75 mb-1">First Name</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/75 mb-1">Last Name</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] focus:border-transparent"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white/75 mb-1">Email</label>
          <input
            type="email"
            value={user?.email || ""}
            disabled
            className="w-full px-4 py-2.5 bg-white/[0.08]/50 border border-white/[0.08] rounded-lg text-white/55 cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/75 mb-1">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] focus:border-transparent"
            placeholder="(555) 123-4567"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-white/75 mb-1">Address</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] focus:border-transparent"
            placeholder="123 Main St"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-white/75 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] focus:border-transparent"
              placeholder="New York"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/75 mb-1">Country</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-4 py-2.5 bg-white/[0.08] border border-white/[0.08] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#6c5ce7] focus:border-transparent"
              placeholder="United States"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="py-2.5 px-6 bg-[#6c5ce7] hover:bg-[#5a4dd4] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </form>
    </div>
  );
}
