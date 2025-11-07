namespace EntryExitAPI.Services;

public interface IPhotoStorageService
{
    Task<string> SavePhotoAsync(string base64Photo, string category);
    Task<bool> DeletePhotoAsync(string photoUrl);
    string GetPhotoUrl(string photoPath);
}

public class LocalPhotoStorageService : IPhotoStorageService
{
    private readonly IWebHostEnvironment _environment;
    private readonly IConfiguration _configuration;
    private readonly ILogger<LocalPhotoStorageService> _logger;
    private readonly string _photosPath;

    public LocalPhotoStorageService(
        IWebHostEnvironment environment,
        IConfiguration configuration,
        ILogger<LocalPhotoStorageService> logger)
    {
        _environment = environment;
        _configuration = configuration;
        _logger = logger;
        
        // Photos stored in wwwroot/photos
        _photosPath = Path.Combine(_environment.WebRootPath ?? "wwwroot", "photos");
        
        // Ensure directory exists
        if (!Directory.Exists(_photosPath))
        {
            Directory.CreateDirectory(_photosPath);
        }
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

            byte[] imageBytes = Convert.FromBase64String(base64Data);

            // Generate unique filename
            string fileName = $"{category}_{Guid.NewGuid()}.jpg";
            string categoryPath = Path.Combine(_photosPath, category);
            
            if (!Directory.Exists(categoryPath))
            {
                Directory.CreateDirectory(categoryPath);
            }

            string filePath = Path.Combine(categoryPath, fileName);

            // Save file
            await File.WriteAllBytesAsync(filePath, imageBytes);

            // Return relative path for URL
            return $"/photos/{category}/{fileName}";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error saving photo");
            throw new InvalidOperationException("Failed to save photo", ex);
        }
    }

    public Task<bool> DeletePhotoAsync(string photoUrl)
    {
        try
        {
            if (string.IsNullOrEmpty(photoUrl))
                return Task.FromResult(false);

            // Convert URL to file path
            string relativePath = photoUrl.TrimStart('/');
            string filePath = Path.Combine(_environment.WebRootPath ?? "wwwroot", relativePath);

            if (File.Exists(filePath))
            {
                File.Delete(filePath);
                return Task.FromResult(true);
            }

            return Task.FromResult(false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting photo: {PhotoUrl}", photoUrl);
            return Task.FromResult(false);
        }
    }

    public string GetPhotoUrl(string photoPath)
    {
        var baseUrl = _configuration["ApiSettings:BaseUrl"] ?? "https://localhost:7001";
        return $"{baseUrl}{photoPath}";
    }
}
