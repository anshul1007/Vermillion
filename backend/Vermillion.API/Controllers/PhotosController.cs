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
}
