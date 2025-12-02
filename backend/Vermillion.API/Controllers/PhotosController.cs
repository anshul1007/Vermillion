using Azure.Storage.Blobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Route("api/entryexit/[controller]")]
public class PhotosController : ControllerBase
{
    private readonly BlobServiceClient _blobServiceClient;
    private readonly string _containerName;

    public PhotosController(IConfiguration config)
    {
        // Support both configuration keys for backwards compatibility
        var connectionString = config["BlobStorage:ConnectionString"]
                               ?? config["AzureBlobStorage:ConnectionString"]
                               ?? config["AzureBlobStorage:ConnectionString"];

        _blobServiceClient = new BlobServiceClient(connectionString);

        _containerName = config["BlobStorage:ContainerName"]
                         ?? config["AzureBlobStorage:ContainerName"]
                         ?? "photos";
    }

    [HttpGet("{*blobPath}")]
    [Authorize]
    public async Task<IActionResult> Get(string blobPath)
    {
        if (string.IsNullOrEmpty(blobPath)) return BadRequest();

        var container = _blobServiceClient.GetBlobContainerClient(_containerName);
        var blob = container.GetBlobClient(blobPath);

        if (!await blob.ExistsAsync()) return NotFound();

        var stream = new MemoryStream();
        await blob.DownloadToAsync(stream);
        stream.Position = 0;

        return File(stream, "image/jpeg");
    }

    public class UploadPhotoRequest {
        public string Base64 { get; set; }
        public string Filename { get; set; }
        public string Subfolder { get; set; }
    }

    [HttpPost("upload")]
    [Authorize]
    public async Task<IActionResult> Upload([FromBody] UploadPhotoRequest req)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Base64)) return BadRequest(new { success = false, message = "Base64 data required" });

        var filename = string.IsNullOrEmpty(req.Filename) ? ($"photo_{Guid.NewGuid()}.jpg") : req.Filename;
        var folder = string.IsNullOrEmpty(req.Subfolder) ? "" : req.Subfolder.Trim('/');
        var blobPath = string.IsNullOrEmpty(folder) ? filename : $"{folder}/{filename}";

        try {
            // Support data URLs (data:<mime>;base64,...) by stripping prefix and detecting mime
            var b64 = req.Base64.Trim();
            string contentType = "image/jpeg";
            var comma = b64.IndexOf(',');
            if (comma >= 0) {
                var meta = b64.Substring(0, comma);
                b64 = b64.Substring(comma + 1);
                // meta example: data:image/png;base64
                var mimeMatch = System.Text.RegularExpressions.Regex.Match(meta, @"data:([^;]+);base64", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (mimeMatch.Success) contentType = mimeMatch.Groups[1].Value;
            }

            var bytes = Convert.FromBase64String(b64);
            var container = _blobServiceClient.GetBlobContainerClient(_containerName);
            var blob = container.GetBlobClient(blobPath);
            using (var ms = new MemoryStream(bytes)) {
                ms.Position = 0;
                var headers = new Azure.Storage.Blobs.Models.BlobHttpHeaders { ContentType = contentType };
                await blob.UploadAsync(ms, new Azure.Storage.Blobs.Models.BlobUploadOptions { HttpHeaders = headers });
            }

            return Ok(new { success = true, data = new { path = blobPath } });
        } catch (Exception ex) {
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }
}
