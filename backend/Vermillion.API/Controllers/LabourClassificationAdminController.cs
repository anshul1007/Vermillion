using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vermillion.EntryExit.Domain.Data;
using Vermillion.EntryExit.Domain.Models.Entities;
using Vermillion.Shared.Domain.Models.DTOs;

namespace Vermillion.API.Controllers;

[ApiController]
[Route("api/entryexit/admin/labour-classifications")]
[Authorize(Roles = "SystemAdmin,Admin")]
public class LabourClassificationAdminController : ControllerBase
{
    private readonly EntryExitDbContext _context;
    private readonly ILogger<LabourClassificationAdminController> _logger;

    public LabourClassificationAdminController(EntryExitDbContext context, ILogger<LabourClassificationAdminController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<object>>>> GetAll()
    {
        var list = await _context.LabourClassifications
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.IsActive })
            .ToListAsync();

        var objList = list.Select(x => (object)x).ToList();
        return Ok(ApiResponse<List<object>>.SuccessResponse(objList));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<object>>> Create([FromBody] LabourClassification payload)
    {
        if (string.IsNullOrWhiteSpace(payload.Name))
            return BadRequest(ApiResponse<object>.ErrorResponse("Name is required"));

        var exists = await _context.LabourClassifications.AnyAsync(c => c.Name == payload.Name);
        if (exists)
            return BadRequest(ApiResponse<object>.ErrorResponse("Classification with the same name already exists"));

        var entity = new LabourClassification { Name = payload.Name.Trim(), IsActive = payload.IsActive, CreatedAt = DateTime.UtcNow };
        _context.LabourClassifications.Add(entity);
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.SuccessResponse(new { entity.Id, entity.Name, entity.IsActive }, "Created"));
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Update(int id, [FromBody] LabourClassification payload)
    {
        var entity = await _context.LabourClassifications.FindAsync(id);
        if (entity == null)
            return NotFound(ApiResponse<object>.ErrorResponse("Not found"));

        if (!string.IsNullOrWhiteSpace(payload.Name))
            entity.Name = payload.Name.Trim();

        entity.IsActive = payload.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.SuccessResponse(new { entity.Id, entity.Name, entity.IsActive }, "Updated"));
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult<ApiResponse<object>>> Delete(int id)
    {
        var entity = await _context.LabourClassifications.FindAsync(id);
        if (entity == null)
            return NotFound(ApiResponse<object>.ErrorResponse("Not found"));

        // Soft delete
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.SuccessResponse(new {}, "Deleted"));
    }

    [HttpPut("labour/{labourId}/classification/{classificationId}")]
    public async Task<ActionResult<ApiResponse<object>>> ChangeLabourClassification(int labourId, int classificationId)
    {
        var labour = await _context.Labours.FindAsync(labourId);
        if (labour == null)
            return NotFound(ApiResponse<object>.ErrorResponse("Labour not found"));

        var cls = await _context.LabourClassifications.FindAsync(classificationId);
        if (cls == null || !cls.IsActive)
            return BadRequest(ApiResponse<object>.ErrorResponse("Invalid classification"));

        labour.ClassificationId = classificationId;
        labour.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return Ok(ApiResponse<object>.SuccessResponse(new {}, "Classification updated"));
    }
}
