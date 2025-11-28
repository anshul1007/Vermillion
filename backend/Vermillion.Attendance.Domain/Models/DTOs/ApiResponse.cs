namespace Vermillion.Attendance.Domain.Models.DTOs
{
    public class AttendanceApiResponse<T>
    {
        public bool Success { get; set; }
        public T? Data { get; set; }
        public string? Error { get; set; }
        public string? Message { get; set; }

        public static AttendanceApiResponse<T> SuccessResponse(T data, string? message = null)
        {
            return new AttendanceApiResponse<T>
            {
                Success = true,
                Data = data,
                Message = message
            };
        }

        public static AttendanceApiResponse<T> ErrorResponse(string error, string? message = null)
        {
            return new AttendanceApiResponse<T>
            {
                Success = false,
                Error = error,
                Message = message
            };
        }
    }
}
