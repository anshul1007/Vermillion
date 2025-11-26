using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.Processing;

namespace Vermillion.EntryExit.Domain.Services;

public class BlobStoragePhotoService : IPhotoStorageService
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly ILogger<BlobStoragePhotoService> _logger;
    private readonly string _containerName;
    private const int MaxImageWidth = 800;
    private const int MaxImageHeight = 800;
    private const int JpegQuality = 85;

    public BlobStoragePhotoService(
        IConfiguration configuration,
        ILogger<BlobStoragePhotoService> logger)
    {
        _logger = logger;
        
        var connectionString = configuration["AzureBlobStorage:ConnectionString"];
        _containerName = configuration["AzureBlobStorage:ContainerName"] ?? "photos";
        
        if (string.IsNullOrEmpty(connectionString))
        {
            throw new InvalidOperationException(
                "Azure Blob Storage connection string is not configured. " +
                "Add 'AzureBlobStorage:ConnectionString' to appsettings.json");
        }

        _blobServiceClient = new BlobServiceClient(connectionString);
    }

    public async Task<string> SavePhotoAsync(string base64Photo, string category)
    {
        try
        {
            // Parse base64 string (handle data:image/jpeg;base64,... format)
            string base64Data = base64Photo;
            if (base64Photo.Contains(","))
            {
                base64Data = base64Photo.Split(',')[1];
            }

            // Convert base64 to bytes
            byte[] imageBytes = Convert.FromBase64String(base64Data);

            // Validate size
            if (imageBytes.Length == 0)
            {
                throw new InvalidOperationException("Photo data is empty");
            }

            if (imageBytes.Length > 10 * 1024 * 1024) // 10MB
            {
                throw new InvalidOperationException("Photo size exceeds maximum allowed (10MB)");
            }

            // Compress and resize image
            byte[] compressedImageBytes;
            using (var inputStream = new MemoryStream(imageBytes))
            using (var outputStream = new MemoryStream())
            {
                using (var image = await Image.LoadAsync(inputStream))
                {
                    // Resize if needed while maintaining aspect ratio
                    if (image.Width > MaxImageWidth || image.Height > MaxImageHeight)
                    {
                        image.Mutate(x => x.Resize(new ResizeOptions
                        {
                            Size = new Size(MaxImageWidth, MaxImageHeight),
                            Mode = ResizeMode.Max
                        }));
                    }

                    // Save as JPEG with quality setting
                    var encoder = new JpegEncoder
                    {
                        Quality = JpegQuality
                    };

                    await image.SaveAsync(outputStream, encoder);
                }

                compressedImageBytes = outputStream.ToArray();
            }

            _logger.LogInformation(
                "Image compressed: {OriginalSize}KB -> {CompressedSize}KB ({Reduction}% reduction)",
                imageBytes.Length / 1024,
                compressedImageBytes.Length / 1024,
                (int)((1 - (double)compressedImageBytes.Length / imageBytes.Length) * 100));

            // Generate unique filename
            var fileName = $"{category}/{Guid.NewGuid()}.jpg";

            // Get container client (create container if it doesn't exist)
            var containerClient = _blobServiceClient.GetBlobContainerClient(_containerName);
            await containerClient.CreateIfNotExistsAsync(PublicAccessType.Blob);

            // Upload to blob storage
            var blobClient = containerClient.GetBlobClient(fileName);
            
            using (var uploadStream = new MemoryStream(compressedImageBytes))
            {
                await blobClient.UploadAsync(uploadStream, new BlobHttpHeaders
                {
                    ContentType = "image/jpeg"
                });
            }

            // Return the public URL
            var photoUrl = blobClient.Uri.ToString();
            _logger.LogInformation("Photo uploaded successfully to {Url}", photoUrl);

            return photoUrl;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading photo to blob storage");
            throw new InvalidOperationException("Failed to upload photo", ex);
        }
    }
}
