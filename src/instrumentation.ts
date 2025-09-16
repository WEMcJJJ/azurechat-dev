import { RequestOptions } from "https";

/**
 * Minimal server-side instrumentation bootstrap.
 * - Only runs in Node runtime (skips edge / browser)
 * - Sets up Azure Monitor with a custom span processor
 * - Filters: ignores OPTIONS & Cosmos DB outbound noise; keeps other outbound spans
 * - Does NOT log secrets or connection strings
 */
export function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { useAzureMonitor } = require("@azure/monitor-opentelemetry");
  const { SpanEnrichingProcessor } = require('./span-enriching-processor');

  // Defensive parsing – if URI missing or invalid, skip host-based filtering
  let cosmosdbHost: string | undefined;
  try {
    if (process.env.AZURE_COSMOSDB_URI) {
      cosmosdbHost = new URL(process.env.AZURE_COSMOSDB_URI).hostname;
    }
  } catch {/* noop */}

  const httpInstrumentationConfig = {
    enabled: true,
    ignoreIncomingRequestHook: (request: any) => request.method === 'OPTIONS',
    ignoreOutgoingRequestHook: (options: RequestOptions) => {
      if (cosmosdbHost && options.hostname === cosmosdbHost) return true; // suppress Cosmos noise only
      return false; // keep everything else for visibility
    }
  };

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || '';
  if (!connectionString) {
    // Intentionally silent – absence will simply mean no backend export.
    return;
  }

  useAzureMonitor({
    spanProcessors: [new SpanEnrichingProcessor()],
    azureMonitorExporterOptions: { connectionString },
    enableStandardMetrics: true,
    enableLiveMetrics: false,
    instrumentationOptions: {
      azureSdk: { enabled: true },
      http: httpInstrumentationConfig
    }
  });
}