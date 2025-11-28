namespace Vermillion.API.Middleware
{
    public class CorrelationIdMiddleware
    {
        private readonly RequestDelegate _next;
        private const string HeaderKey = "X-Correlation-Id";

        public CorrelationIdMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            string correlationId = context.Request.Headers.ContainsKey(HeaderKey)
                ? context.Request.Headers[HeaderKey].ToString()!
                : Guid.NewGuid().ToString();

            // store for later retrieval by controllers or other middleware
            context.Items[HeaderKey] = correlationId;

            // ensure header is present on the response
            context.Response.OnStarting(() =>
            {
                // use indexer to set header (safe for duplicates)
                context.Response.Headers[HeaderKey] = correlationId;
                return Task.CompletedTask;
            });

            await _next(context);
        }
    }
}
