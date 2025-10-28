// EXAMPLE: How to use Feature Toggles in your controllers

using AttendanceAPI.Filters;
using AttendanceAPI.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.FeatureManagement;

namespace AttendanceAPI.Controllers.Examples
{
    /// <summary>
    /// Example controller showing different ways to use feature toggles
    /// </summary>
    [ApiController]
    [Route("api/example")]
    [Authorize]
    public class FeatureToggleExampleController : ControllerBase
    {
        private readonly IFeatureManager _featureManager;
        private readonly ILogger<FeatureToggleExampleController> _logger;

        public FeatureToggleExampleController(
            IFeatureManager featureManager,
            ILogger<FeatureToggleExampleController> logger)
        {
            _featureManager = featureManager;
            _logger = logger;
        }

        // ============================================================
        // METHOD 1: Using [FeatureGate] Attribute
        // ============================================================
        // This is the EASIEST way - the entire endpoint is blocked if feature is disabled
        
        /// <summary>
        /// This endpoint only works if AdvancedAnalytics feature is enabled
        /// </summary>
        [HttpGet("advanced-report")]
        [FeatureGate("AdvancedAnalytics")]
        public async Task<IActionResult> GetAdvancedReport()
        {
            _logger.LogInformation("Generating advanced report...");
            
            // This code only runs if AdvancedAnalytics is enabled
            // Otherwise, the caller receives 403 Forbidden
            
            return Ok(new { report = "Advanced analytics data..." });
        }

        // ============================================================
        // METHOD 2: Using IFeatureManager - Inline Check
        // ============================================================
        // Use this when you want to conditionally execute code
        
        /// <summary>
        /// Check-in with optional geolocation based on feature toggle
        /// </summary>
        [HttpPost("checkin")]
        public async Task<IActionResult> CheckIn([FromBody] CheckInRequest request)
        {
            _logger.LogInformation("Processing check-in...");

            // Check if geolocation feature is enabled
            if (await _featureManager.IsEnabledAsync("AttendanceGeolocation"))
            {
                // Validate geolocation only if feature is enabled
                if (request.Latitude == null || request.Longitude == null)
                {
                    return BadRequest(new { message = "Geolocation is required" });
                }

                _logger.LogInformation("Validating geolocation: {Lat}, {Lon}", 
                    request.Latitude, request.Longitude);
                
                // Validate user is within company premises
                if (!IsWithinCompanyPremises(request.Latitude.Value, request.Longitude.Value))
                {
                    return BadRequest(new { message = "You must be at company location to check in" });
                }
            }

            // Continue with normal check-in logic
            _logger.LogInformation("Check-in successful");
            return Ok(new { message = "Check-in successful" });
        }

        // ============================================================
        // METHOD 3: Using IFeatureManager - Branch Logic
        // ============================================================
        // Use different code paths based on feature state
        
        /// <summary>
        /// Send notification via email if feature is enabled, otherwise log it
        /// </summary>
        [HttpPost("notify")]
        public async Task<IActionResult> SendNotification([FromBody] NotificationRequest request)
        {
            if (await _featureManager.IsEnabledAsync("EmailNotifications"))
            {
                // Email notification path
                _logger.LogInformation("Sending email notification to {Email}", request.RecipientEmail);
                await SendEmailAsync(request.RecipientEmail, request.Message);
                return Ok(new { message = "Email sent successfully" });
            }
            else
            {
                // Fallback: Just log the notification
                _logger.LogInformation("Email notifications disabled. Logging notification instead: {Message}", 
                    request.Message);
                return Ok(new { message = "Notification logged (email disabled)" });
            }
        }

        // ============================================================
        // METHOD 4: Multiple Feature Checks
        // ============================================================
        // Check multiple features in one endpoint
        
        /// <summary>
        /// Advanced check-in with multiple optional features
        /// </summary>
        [HttpPost("advanced-checkin")]
        public async Task<IActionResult> AdvancedCheckIn([FromBody] AdvancedCheckInRequest request)
        {
            var features = new
            {
                Geolocation = await _featureManager.IsEnabledAsync("AttendanceGeolocation"),
                FacialRecognition = await _featureManager.IsEnabledAsync("FacialRecognition"),
                Analytics = await _featureManager.IsEnabledAsync("AdvancedAnalytics")
            };

            _logger.LogInformation("Processing advanced check-in. Active features: {@Features}", features);

            // Geolocation validation
            if (features.Geolocation)
            {
                if (!ValidateLocation(request.Latitude, request.Longitude))
                    return BadRequest(new { message = "Invalid location" });
            }

            // Facial recognition
            if (features.FacialRecognition)
            {
                if (string.IsNullOrEmpty(request.FaceImageBase64))
                    return BadRequest(new { message = "Face image required" });
                    
                if (!await ValidateFaceAsync(request.FaceImageBase64))
                    return BadRequest(new { message = "Face recognition failed" });
            }

            // Save check-in
            var checkInId = await SaveCheckInAsync(request);

            // Send analytics if enabled
            if (features.Analytics)
            {
                await TrackAnalyticsAsync(checkInId, features);
            }

            return Ok(new
            {
                message = "Check-in successful",
                checkInId,
                featuresUsed = features
            });
        }

        // ============================================================
        // METHOD 5: Get All Feature States
        // ============================================================
        // Useful for frontend to know which features to show/hide
        
        /// <summary>
        /// Get current state of all features (useful for frontend)
        /// </summary>
        [HttpGet("features/status")]
        public async Task<IActionResult> GetFeatureStates()
        {
            var featureStates = new Dictionary<string, bool>
            {
                ["AttendanceGeolocation"] = await _featureManager.IsEnabledAsync("AttendanceGeolocation"),
                ["LeaveAutoApproval"] = await _featureManager.IsEnabledAsync("LeaveAutoApproval"),
                ["AdvancedAnalytics"] = await _featureManager.IsEnabledAsync("AdvancedAnalytics"),
                ["EmailNotifications"] = await _featureManager.IsEnabledAsync("EmailNotifications"),
                ["FacialRecognition"] = await _featureManager.IsEnabledAsync("FacialRecognition")
            };

            return Ok(featureStates);
        }

        // ============================================================
        // Helper Methods
        // ============================================================

        private bool IsWithinCompanyPremises(double lat, double lon)
        {
            // Example: Check if coordinates are within company location
            // Replace with actual logic
            return true;
        }

        private bool ValidateLocation(double? lat, double? lon)
        {
            if (lat == null || lon == null) return false;
            return IsWithinCompanyPremises(lat.Value, lon.Value);
        }

        private async Task<bool> ValidateFaceAsync(string faceImageBase64)
        {
            // TODO: Implement facial recognition validation
            await Task.Delay(100); // Simulate async operation
            return true;
        }

        private async Task SendEmailAsync(string email, string message)
        {
            // TODO: Implement email sending
            await Task.Delay(100);
        }

        private async Task<Guid> SaveCheckInAsync(AdvancedCheckInRequest request)
        {
            // TODO: Save to database
            await Task.Delay(50);
            return Guid.NewGuid();
        }

        private async Task TrackAnalyticsAsync(Guid checkInId, object features)
        {
            // TODO: Send analytics data
            await Task.Delay(50);
        }

        // ============================================================
        // Request Models
        // ============================================================

        public class CheckInRequest
        {
            public double? Latitude { get; set; }
            public double? Longitude { get; set; }
        }

        public class AdvancedCheckInRequest
        {
            public double? Latitude { get; set; }
            public double? Longitude { get; set; }
            public string? FaceImageBase64 { get; set; }
        }

        public class NotificationRequest
        {
            public string RecipientEmail { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
        }
    }
}
