using AttendanceAPI.Models.DTOs;
using AttendanceAPI.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace AttendanceAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class FeatureToggleController : ControllerBase
    {
        private readonly IFeatureToggleService _featureToggleService;
        private readonly ILogger<FeatureToggleController> _logger;

        public FeatureToggleController(IFeatureToggleService featureToggleService, ILogger<FeatureToggleController> logger)
        {
            _featureToggleService = featureToggleService;
            _logger = logger;
        }

        /// <summary>
        /// Get all feature toggles (accessible to SystemUser only)
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "SystemUser")]
        public async Task<IActionResult> GetAllFeatureToggles()
        {
            try
            {
                var toggles = await _featureToggleService.GetAllFeatureTogglesAsync();
                return Ok(ApiResponse<List<FeatureToggleDto>>.SuccessResponse(toggles));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting feature toggles");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Get a specific feature toggle by ID (accessible to SystemUser only)
        /// </summary>
        [HttpGet("{id}")]
        [Authorize(Roles = "SystemUser")]
        public async Task<IActionResult> GetFeatureToggle(Guid id)
        {
            try
            {
                var toggle = await _featureToggleService.GetFeatureToggleAsync(id);
                if (toggle == null)
                {
                    return NotFound(ApiResponse<object>.ErrorResponse("Feature toggle not found"));
                }
                return Ok(ApiResponse<FeatureToggleDto>.SuccessResponse(toggle));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting feature toggle {Id}", id);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Get a feature toggle by key (accessible to SystemUser only)
        /// </summary>
        [HttpGet("key/{featureKey}")]
        [Authorize(Roles = "SystemUser")]
        public async Task<IActionResult> GetFeatureToggleByKey(string featureKey)
        {
            try
            {
                var toggle = await _featureToggleService.GetFeatureToggleByKeyAsync(featureKey);
                if (toggle == null)
                {
                    return NotFound(ApiResponse<object>.ErrorResponse("Feature toggle not found"));
                }
                return Ok(ApiResponse<FeatureToggleDto>.SuccessResponse(toggle));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting feature toggle by key {Key}", featureKey);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Check if a feature is enabled (accessible to all authenticated users)
        /// </summary>
        [HttpGet("check/{featureKey}")]
        public async Task<IActionResult> IsFeatureEnabled(string featureKey)
        {
            try
            {
                var isEnabled = await _featureToggleService.IsFeatureEnabledAsync(featureKey);
                return Ok(ApiResponse<bool>.SuccessResponse(isEnabled));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking feature {Key}", featureKey);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Create a new feature toggle (SystemUser only)
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "SystemUser")]
        public async Task<IActionResult> CreateFeatureToggle([FromBody] CreateFeatureToggleRequest request)
        {
            try
            {
                var userId = GetUserId();
                var toggle = await _featureToggleService.CreateFeatureToggleAsync(request, userId);
                return Ok(ApiResponse<FeatureToggleDto>.SuccessResponse(toggle, "Feature toggle created successfully"));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating feature toggle");
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Update a feature toggle (SystemUser only)
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "SystemUser")]
        public async Task<IActionResult> UpdateFeatureToggle(Guid id, [FromBody] UpdateFeatureToggleRequest request)
        {
            try
            {
                var userId = GetUserId();
                var toggle = await _featureToggleService.UpdateFeatureToggleAsync(id, request, userId);
                return Ok(ApiResponse<FeatureToggleDto>.SuccessResponse(toggle, "Feature toggle updated successfully"));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating feature toggle {Id}", id);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Toggle a feature on/off (SystemUser only)
        /// </summary>
        [HttpPatch("{id}/toggle")]
        [Authorize(Roles = "SystemUser")]
        public async Task<IActionResult> ToggleFeature(Guid id, [FromBody] ToggleFeatureRequest request)
        {
            try
            {
                var userId = GetUserId();
                var toggle = await _featureToggleService.ToggleFeatureAsync(id, request.IsEnabled, userId);
                return Ok(ApiResponse<FeatureToggleDto>.SuccessResponse(toggle, 
                    $"Feature {(request.IsEnabled ? "enabled" : "disabled")} successfully"));
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ApiResponse<object>.ErrorResponse(ex.Message));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error toggling feature {Id}", id);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        /// <summary>
        /// Delete a feature toggle (SystemUser only)
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "SystemUser")]
        public async Task<IActionResult> DeleteFeatureToggle(Guid id)
        {
            try
            {
                var result = await _featureToggleService.DeleteFeatureToggleAsync(id);
                if (!result)
                {
                    return NotFound(ApiResponse<object>.ErrorResponse("Feature toggle not found"));
                }
                return Ok(ApiResponse<bool>.SuccessResponse(true, "Feature toggle deleted successfully"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting feature toggle {Id}", id);
                return StatusCode(500, ApiResponse<object>.ErrorResponse("An error occurred", ex.Message));
            }
        }

        private Guid GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            {
                throw new UnauthorizedAccessException("User ID not found in token");
            }
            return userId;
        }
    }
}
