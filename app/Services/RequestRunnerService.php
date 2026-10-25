<?php

namespace App\Services;

use App\Repositories\CollectionRepository;
use App\Repositories\RequestRepository;
use App\Services\EnvironmentService;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\RequestException;
use Illuminate\Support\Carbon;

class RequestRunnerService
{
    public function __construct(
        private RequestRepository $repo,
        private EnvironmentService $environmentService,
        private CollectionRepository $collectionRepo,
    ) {}

    /**
     * Execute an outgoing HTTP request and log the result.
     *
     * @param  array  $headers  Array of {key, value, enabled} objects.
     * @param  string|null  $bodyType  none|raw|form-data|x-www-form-urlencoded
     * @param  string|null  $body  Raw string for 'raw'; JSON-encoded [{key,value,enabled}] for form types.
     * @param  string|null  $authType  none|bearer|basic|api_key
     * @param  array|null   $authData  Auth credentials keyed by type.
     * @param  int|null     $environmentId  When provided, resolves variables from this environment.
     * @return array{success:bool, status:int, response_headers:array, response_body:string, response_time_ms:int, error:?string}
     */
    public function run(
        string $method,
        string $url,
        array $headers = [],
        ?string $body = null,
        ?string $bodyType = null,
        ?string $authType = null,
        ?array $authData = null,
        ?int $userId = null,
        ?int $requestId = null,
        ?int $environmentId = null,
        ?int $collectionId = null,
        array $bodyFormRows = [],
        array $bodyFormFiles = [],
        array $params = [],
    ): array {
        // Collection variables are the base; env variables override them (env support coming in v2).
        $collectionVars = $collectionId !== null
            ? $this->collectionRepo->getVariablesMap($collectionId)
            : [];

        $envVars = $userId !== null
            ? $this->environmentService->getActiveVariables($userId)
            : [];

        $variables = array_merge($collectionVars, $envVars);

        $url     = $this->environmentService->substitute($url, $variables);
        $headers = $this->substituteHeaderValues($headers, $variables);
        $body    = $body !== null ? $this->environmentService->substitute($body, $variables) : null;

        foreach ($params as &$p) {
            if (isset($p['value'])) {
                $p['value'] = $this->environmentService->substitute((string) $p['value'], $variables);
            }
        }
        unset($p);

        $client = new Client([
            'timeout'         => 30,
            'connect_timeout' => 10,
            'http_errors'     => false, // Surface 4xx/5xx as responses, not exceptions
            'verify'          => resource_path('cacert.pem'), // TODO: allow per-request override in v2
            // TODO: expose verify_ssl as a per-request option in v2
        ]);

        $resolvedHeaders = $this->buildHeaders($headers, $authType, $authData, $variables);

        $userQuery = [];
        foreach ($params as $p) {
            if (! empty($p['enabled']) && isset($p['key']) && $p['key'] !== '') {
                $userQuery[$p['key']] = $p['value'] ?? '';
            }
        }
        $queryParams = array_merge($userQuery, $this->buildQueryParams($authType, $authData, $variables));

        $options = ['headers' => $resolvedHeaders];

        if ($queryParams) {
            $options['query'] = $queryParams;
        }

        $this->applyBody($options, $bodyType, $body, $bodyFormRows, $bodyFormFiles);

        $start = microtime(true);

        try {
            $response = $client->request(strtoupper($method), $url, $options);
            $elapsed  = (int) round((microtime(true) - $start) * 1000);

            $contentType = $response->getHeaderLine('Content-Type');
            $isBinary    = str_starts_with($contentType, 'image/') || str_starts_with($contentType, 'audio/');
            $body        = $isBinary ? base64_encode((string) $response->getBody()) : (string) $response->getBody();

            $result = [
                'success'             => true,
                'status'              => $response->getStatusCode(),
                'response_headers'    => $this->flattenHeaders($response->getHeaders()),
                'response_body'       => $body,
                'response_is_binary'  => $isBinary,
                'response_time_ms'    => $elapsed,
                'error'               => null,
            ];
        } catch (ConnectException $e) {
            $elapsed = (int) round((microtime(true) - $start) * 1000);
            $result  = $this->errorResult($e->getMessage(), $elapsed);
        } catch (RequestException $e) {
            $elapsed = (int) round((microtime(true) - $start) * 1000);
            $result  = $this->errorResult($e->getMessage(), $elapsed);
        } catch (\Exception $e) {
            $elapsed = (int) round((microtime(true) - $start) * 1000);
            $result  = $this->errorResult($e->getMessage(), $elapsed);
        }

        if ($userId !== null) {
            $this->repo->log([
                'user_id'          => $userId,
                'request_id'       => $requestId,
                'method'           => strtoupper($method),
                'url'              => $url,
                'request_headers'  => $resolvedHeaders,
                'request_body'     => $body,
                'response_status'  => $result['status'],
                'response_headers' => $result['response_headers'],
                'response_body'    => $result['response_body'],
                'response_time_ms' => $result['response_time_ms'],
                'executed_at'      => Carbon::now(),
            ]);
        }

        return $result;
    }

    // -------------------------------------------------------------------------
    // Variable substitution helpers
    // -------------------------------------------------------------------------

    /**
     * Substitute {{variable}} placeholders in header values.
     */
    private function substituteHeaderValues(array $headers, array $variables): array
    {
        foreach ($headers as &$h) {
            if (isset($h['value'])) {
                $h['value'] = $this->environmentService->substitute((string) $h['value'], $variables);
            }
        }

        return $headers;
    }

    // -------------------------------------------------------------------------
    // Auth
    // -------------------------------------------------------------------------

    /**
     * Merge enabled user-supplied headers with auth headers derived from auth config.
     * Auth credential values are variable-substituted before use.
     */
    private function buildHeaders(array $headers, ?string $authType, ?array $authData, array $variables = []): array
    {
        $resolved = [];

        foreach ($headers as $h) {
            if (! empty($h['enabled']) && isset($h['key']) && $h['key'] !== '') {
                $resolved[$h['key']] = $h['value'] ?? '';
            }
        }

        $sub = fn (string $v) => $this->environmentService->substitute($v, $variables);

        switch ($authType) {
            case 'bearer':
                $resolved['Authorization'] = 'Bearer ' . $sub($authData['token'] ?? '');
                break;

            case 'basic':
                $credentials = $sub($authData['username'] ?? '') . ':' . $sub($authData['password'] ?? '');
                $resolved['Authorization'] = 'Basic ' . base64_encode($credentials);
                break;

            case 'api_key':
                if (($authData['in'] ?? 'header') === 'header') {
                    $resolved[$authData['key'] ?? 'X-API-Key'] = $sub($authData['value'] ?? '');
                }
                break;
        }

        return $resolved;
    }

    /**
     * Returns query params to append (used when API key placement is 'query').
     * The API key value is variable-substituted before use.
     */
    private function buildQueryParams(?string $authType, ?array $authData, array $variables = []): array
    {
        if ($authType === 'api_key' && ($authData['in'] ?? 'header') === 'query') {
            $value = $this->environmentService->substitute($authData['value'] ?? '', $variables);

            return [($authData['key'] ?? 'api_key') => $value];
        }

        return [];
    }

    // -------------------------------------------------------------------------
    // Body
    // -------------------------------------------------------------------------

    private function applyBody(array &$options, ?string $bodyType, ?string $body, array $bodyFormRows = [], array $bodyFormFiles = []): void
    {
        switch ($bodyType) {
            case 'raw':
                $options['body'] = $body ?? '';
                break;

            case 'form-data':
                $options['multipart'] = $bodyFormRows
                    ? $this->buildMultipartFromRows($bodyFormRows, $bodyFormFiles)
                    : $this->parseAsMultipart($body);
                break;

            case 'x-www-form-urlencoded':
                $options['form_params'] = $this->parseAsFormParams($body);
                break;

            // 'none' and null: no body options added
        }
    }

    /**
     * Build Guzzle multipart array from structured rows + uploaded files.
     * Used when /run is called as multipart/form-data (i.e. file upload path).
     */
    private function buildMultipartFromRows(array $rows, array $files): array
    {
        $parts = [];

        foreach ($rows as $i => $row) {
            if (empty($row['key'])) {
                continue;
            }

            if (($row['type'] ?? 'text') === 'file') {
                if (isset($files[$i])) {
                    $parts[] = [
                        'name'     => $row['key'],
                        'contents' => fopen($files[$i]->getRealPath(), 'r'),
                        'filename' => $files[$i]->getClientOriginalName(),
                    ];
                }
            } else {
                $parts[] = [
                    'name'     => $row['key'],
                    'contents' => (string) ($row['value'] ?? ''),
                ];
            }
        }

        return $parts;
    }

    /**
     * Stored body is a JSON-encoded [{key, value, enabled}] array.
     * Convert to Guzzle multipart format.
     */
    private function parseAsMultipart(?string $body): array
    {
        $pairs = json_decode($body ?? '[]', true) ?? [];
        $parts = [];

        foreach ($pairs as $pair) {
            if (! empty($pair['enabled']) && isset($pair['key']) && $pair['key'] !== '') {
                $parts[] = [
                    'name'     => $pair['key'],
                    'contents' => (string) ($pair['value'] ?? ''),
                ];
            }
        }

        return $parts;
    }

    /**
     * Stored body is a JSON-encoded [{key, value, enabled}] array.
     * Convert to Guzzle form_params format.
     */
    private function parseAsFormParams(?string $body): array
    {
        $pairs  = json_decode($body ?? '[]', true) ?? [];
        $params = [];

        foreach ($pairs as $pair) {
            if (! empty($pair['enabled']) && isset($pair['key']) && $pair['key'] !== '') {
                $params[$pair['key']] = (string) ($pair['value'] ?? '');
            }
        }

        return $params;
    }

    // -------------------------------------------------------------------------
    // Response helpers
    // -------------------------------------------------------------------------

    /**
     * Guzzle returns headers as ['Name' => ['v1', 'v2']].
     * Flatten to ['Name' => 'v1, v2'] for storage and display.
     */
    private function flattenHeaders(array $headers): array
    {
        $flat = [];

        foreach ($headers as $name => $values) {
            $flat[$name] = implode(', ', $values);
        }

        return $flat;
    }

    private function errorResult(string $rawMessage, int $elapsed): array
    {
        return [
            'success'          => false,
            'status'           => 0,
            'response_headers' => [],
            'response_body'    => '',
            'response_time_ms' => $elapsed,
            'error'            => $this->friendlyError($rawMessage),
        ];
    }

    private function friendlyError(string $message): string
    {
        if (str_contains($message, 'Connection refused')) {
            return 'Connection refused. Is the server running?';
        }
        if (str_contains($message, 'Could not resolve host') || str_contains($message, 'DNS')) {
            return 'Could not resolve hostname. Check the URL.';
        }
        if (str_contains($message, 'timed out') || str_contains($message, 'Operation timed out') || str_contains($message, 'timeout')) {
            return 'Request timed out after 30 seconds.';
        }
        if (str_contains($message, 'SSL') || str_contains($message, 'certificate')) {
            return 'SSL certificate error. The server may be using a self-signed certificate.';
        }
        if (str_contains($message, 'cURL error 6')) {
            return 'Could not resolve hostname. Check the URL.';
        }
        if (str_contains($message, 'cURL error 7')) {
            return 'Connection refused. Is the server running?';
        }

        // Truncate verbose Guzzle messages at a readable length
        return strlen($message) > 200 ? substr($message, 0, 200) . '…' : $message;
    }
}
