using Microsoft.Extensions.Logging;

namespace Vermillion.EntryExit.Domain.Services;

public interface IPhotoStorageService
{
    Task<string> SavePhotoAsync(string base64Photo, string category);
}

public class Base64PhotoStorageService : IPhotoStorageService
{
    private readonly ILogger<Base64PhotoStorageService> _logger;

    public Base64PhotoStorageService(ILogger<Base64PhotoStorageService> logger)
    {
        _logger = logger;
    }

    public Task<string> SavePhotoAsync(string base64Photo, string category)
    {
        try
        {
            // Parse base64 string (handle data:image/jpeg;base64,... format)
            string base64Data = base64Photo;
            if (base64Photo.Contains(","))
            {
                base64Data = base64Photo.Split(',')[1];
            }

            // Validate base64 string by attempting to decode it
            try
            {
                byte[] imageBytes = Convert.FromBase64String(base64Data);

                // Basic validation: check if it's not empty and has reasonable size (max 10MB)
                if (imageBytes.Length == 0)
                {
                    throw new InvalidOperationException("Photo data is empty");
                }

                if (imageBytes.Length > 10 * 1024 * 1024) // 10MB
                {
                    throw new InvalidOperationException("Photo size exceeds maximum allowed (10MB)");
                }
            }
            catch (FormatException)
            {
                throw new InvalidOperationException("Invalid base64 photo data");
            }

            // Return the clean base64 data (without the data:image/...;base64, prefix)
            return Task.FromResult(base64Data);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error validating photo");
            throw new InvalidOperationException("Failed to process photo", ex);
        }
    }
}
